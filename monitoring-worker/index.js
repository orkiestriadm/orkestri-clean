/**
 * Worker de Monitoramento Operacional
 *
 * Responsabilidades:
 *  - Ler assets ativos do Postgres
 *  - Agendar pings por asset conforme intervaloSeg
 *  - Executar ICMP via comando 'ping' (sem CAP_NET_RAW gracas a iputils alpine)
 *  - Gravar mon_probe_result (raw) + UPSERT mon_rollup_minute
 *  - Aplicar logica de status (ONLINE/OFFLINE/INSTAVEL + anti-flap)
 *  - Emitir eventos via Redis pub/sub: 'mon:status_change' e 'mon:probe_tick'
 *  - Rollup horario consolidado (a cada hora cheia)
 *  - Cleanup automatico (retencao 14d para raw, 90d para rollup_minute)
 *
 * Concorrencia: pool simples, default 50 pings simultaneos.
 * Idempotente: pode rodar N replicas (cada replica processa subset por hash do assetId).
 */

const { PrismaClient } = require("@prisma/client");
const Redis = require("ioredis");
const { exec } = require("child_process");
const { promisify } = require("util");
const { randomUUID } = require("crypto");
const zbx = require("./lib/zabbix");
const osa = require("./lib/osa");
const vault = require("./lib/vault");
const execAsync = promisify(exec);

const prisma = new PrismaClient();

// ── Config via env ──────────────────────────────────────────────────────────
const PARALLEL          = parseInt(process.env.MON_PARALLEL || "50", 10);
const TICK_INTERVAL_MS  = parseInt(process.env.MON_TICK_MS  || "5000", 10);  // 5s loop
const FAIL_THRESHOLD    = parseInt(process.env.MON_FAIL_THRESHOLD    || "3", 10);
const SUCCESS_THRESHOLD = parseInt(process.env.MON_SUCCESS_THRESHOLD || "2", 10);
const INSTAB_WINDOW     = parseInt(process.env.MON_INSTAB_WINDOW     || "10", 10);
const INSTAB_PCT        = parseFloat(process.env.MON_INSTAB_PCT      || "0.20");
const SHARD_INDEX       = parseInt(process.env.MON_SHARD_INDEX || "0", 10);
const SHARD_TOTAL       = parseInt(process.env.MON_SHARD_TOTAL || "1", 10);
const RAW_RETENTION_DAYS    = parseInt(process.env.MON_RAW_RETENTION_DAYS    || "14", 10);
const MINUTE_RETENTION_DAYS = parseInt(process.env.MON_MINUTE_RETENTION_DAYS || "90", 10);

// Leitura do Zabbix (serviços + hardware). Desligado se URL/TOKEN não setados.
const ZBX_URL           = process.env.ZABBIX_API_URL   || "";
const ZBX_TOKEN         = process.env.ZABBIX_API_TOKEN || "";
const ZBX_INTERVAL_MS   = parseInt(process.env.MON_ZABBIX_INTERVAL_MS || "60000", 10);
const SVC_FAIL_THRESHOLD = parseInt(process.env.MON_SVC_FAIL_THRESHOLD || "2", 10);
const SVC_OK_THRESHOLD   = parseInt(process.env.MON_SVC_OK_THRESHOLD   || "1", 10);

// OSA: leitura leve (metadados) de diretório remoto via SMB
const OSA_TICK_MS = parseInt(process.env.OSA_TICK_MS || "30000", 10);

const CHAN_STATUS_CHANGE = "mon:status_change";
const CHAN_PROBE_TICK    = "mon:probe_tick";

// ── Redis ────────────────────────────────────────────────────────────────────
function redisUrl() {
  const host = process.env.REDIS_HOST || "redis";
  const port = process.env.REDIS_PORT || 6379;
  const pwd  = process.env.REDIS_PASSWORD;
  return pwd ? `redis://:${encodeURIComponent(pwd)}@${host}:${port}` : `redis://${host}:${port}`;
}
const pub = new Redis(redisUrl(), { maxRetriesPerRequest: null, enableReadyCheck: false });
pub.on("error", e => console.warn("[redis-pub]", e.message));

// ── Estado local: ultimo agendamento por asset + janela de N checks ─────────
const lastScheduled = new Map();              // assetId -> ts of last enqueued probe
const recentChecks  = new Map();              // assetId -> array<boolean> (ultimos N)
const inFlight      = new Set();              // assetId em probe
let runningProbes = 0;

// FNV-1a 32-bit p/ sharding determinístico por assetId
function hashShard(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % SHARD_TOTAL;
}
const isMyShard = (id) => SHARD_TOTAL === 1 || hashShard(id) === SHARD_INDEX;

// ── Validacao do host (evita command injection) ─────────────────────────────
function safeHost(s) {
  if (!s) return null;
  const t = String(s).trim();
  if (t.length > 255) return null;
  // permite apenas alphanum, ponto, hifen, dois-pontos (IPv6)
  if (!/^[a-zA-Z0-9.\-:]+$/.test(t)) return null;
  return t;
}

// ── ICMP ─────────────────────────────────────────────────────────────────────
async function ping(host, timeoutSec) {
  const h = safeHost(host);
  if (!h) return { ok: false, latenciaMs: null, erro: "host invalido" };
  try {
    // Alpine iputils: -c count, -W timeout em segundos, -w deadline
    const cmd = `ping -c 1 -W ${timeoutSec} ${h}`;
    const { stdout } = await execAsync(cmd, { timeout: (timeoutSec + 1) * 1000 });
    const m = stdout.match(/time[=<]([\d.]+)\s*ms/);
    return { ok: true, latenciaMs: m ? Math.round(parseFloat(m[1])) : null, erro: null };
  } catch (e) {
    return { ok: false, latenciaMs: null, erro: (e && e.message || "fail").slice(0, 200) };
  }
}

// ── State engine ────────────────────────────────────────────────────────────
function computeNewStatus(asset, ok) {
  // Janela curta para INSTAVEL
  const arr = recentChecks.get(asset.id) || [];
  arr.push(ok);
  while (arr.length > INSTAB_WINDOW) arr.shift();
  recentChecks.set(asset.id, arr);

  const falhasJanela = arr.filter(x => !x).length;
  const perdaPct     = arr.length ? falhasJanela / arr.length : 0;

  let consecutivoFalhas   = asset.consecutivo_falhas   || 0;
  let consecutivoSucessos = asset.consecutivo_sucessos || 0;
  if (ok) { consecutivoSucessos++; consecutivoFalhas = 0; }
  else    { consecutivoFalhas++;   consecutivoSucessos = 0; }

  const cur = asset.ultimo_status;
  let novo = cur;

  if (cur === "ONLINE" || cur === "NAO_MONITORADO") {
    if (consecutivoFalhas >= FAIL_THRESHOLD) novo = "OFFLINE";
    else if (arr.length >= INSTAB_WINDOW && perdaPct >= INSTAB_PCT) novo = "INSTAVEL";
    else if (cur === "NAO_MONITORADO" && ok) novo = "ONLINE";
  } else if (cur === "OFFLINE") {
    if (consecutivoSucessos >= SUCCESS_THRESHOLD) novo = "ONLINE";
  } else if (cur === "INSTAVEL") {
    if (arr.length >= INSTAB_WINDOW && perdaPct < INSTAB_PCT && consecutivoSucessos >= SUCCESS_THRESHOLD) novo = "ONLINE";
    else if (consecutivoFalhas >= FAIL_THRESHOLD) novo = "OFFLINE";
  }
  return { novo, consecutivoFalhas, consecutivoSucessos, perdaPct };
}

// ── Abertura automatica de chamado ──────────────────────────────────────────
// Quando um ativo com abre_chamado_auto=true entra em OFFLINE, cria um chamado
// no modulo de Chamados (categoria "Monitoramento"), evitando duplicar. Quando
// volta a ONLINE, comenta no chamado aberto e libera para futuras quedas.
const _orgRequester = new Map(); // cache org -> userId (solicitante do sistema)

async function getRequesterId(orgId) {
  if (_orgRequester.has(orgId)) return _orgRequester.get(orgId);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id FROM users WHERE organization_id = $1 ORDER BY criado_em ASC LIMIT 1`, orgId);
  const uid = rows && rows[0] ? rows[0].id : null;
  _orgRequester.set(orgId, uid);
  return uid;
}

async function handleAutoChamado(asset, novoStatus, now) {
  if (!asset.abre_chamado_auto) return;

  // OFFLINE → abre chamado (se ainda nao houver um aberto)
  if (novoStatus === "OFFLINE" && !asset.chamado_aberto_id) {
    // Supressao por dependencia: se o ativo do qual este depende (uplink) tambem
    // esta OFFLINE, a queda provavelmente eh consequencia — nao abre chamado pro filho.
    if (asset.depende_de_id) {
      const pai = await prisma.$queryRawUnsafe(
        `SELECT ultimo_status FROM mon_asset WHERE id = $1`, asset.depende_de_id);
      if (pai && pai[0] && pai[0].ultimo_status === "OFFLINE") {
        console.log(`[autoChamado] ${asset.nome} OFFLINE suprimido (uplink offline)`);
        return;
      }
    }
    const solicitanteId = await getRequesterId(asset.organization_id);
    if (!solicitanteId) return; // org sem usuarios — nao da pra abrir
    const titulo = `[AUTO] ${asset.nome} sem resposta (OFFLINE)`;
    const descricao =
      `Chamado aberto automaticamente pelo Monitoramento Operacional.\n\n` +
      `Equipamento: ${asset.nome}\n` +
      `IP: ${asset.ip}\n` +
      `Categoria: ${asset.categoria}${asset.tipo ? " / " + asset.tipo : ""}\n` +
      `Localização: ${asset.localizacao || "—"}\n` +
      `Detectado em: ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}\n\n` +
      `O equipamento parou de responder ao ping (ICMP).`;
    const ch = await prisma.chamado.create({
      data: {
        organizationId: asset.organization_id,
        titulo,
        descricao,
        status: "aberto",
        prioridade: "alta",
        categoria: "Monitoramento",
        tags: `monitoramento,auto,${asset.categoria}`.toLowerCase(),
        solicitanteId,
      },
      select: { id: true, numero: true },
    });
    await prisma.monAsset.update({ where: { id: asset.id }, data: { chamadoAbertoId: ch.id } });
    // Auditoria do chamado (consistente com o modulo)
    await prisma.chamadoAuditoria.create({
      data: { chamadoId: ch.id, userId: solicitanteId, acao: "criado", de: null, para: "aberto",
        metadata: { origem: "monitoramento", assetId: asset.id, ip: asset.ip } },
    }).catch(() => {});
    console.log(`[autoChamado] OFFLINE ${asset.nome} -> chamado #${ch.numero}`);
  }

  // ONLINE de novo → comenta no chamado e libera
  if (novoStatus === "ONLINE" && asset.chamado_aberto_id) {
    const solicitanteId = await getRequesterId(asset.organization_id);
    const texto = `✅ Equipamento ${asset.nome} (${asset.ip}) voltou a responder em ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Detectado automaticamente pelo Monitoramento Operacional.`;
    if (solicitanteId) {
      await prisma.chamadoComentario.create({
        data: { chamadoId: asset.chamado_aberto_id, userId: solicitanteId, texto, interno: false },
      }).catch(() => {});
      await prisma.chamadoAuditoria.create({
        data: { chamadoId: asset.chamado_aberto_id, userId: solicitanteId, acao: "comentario", de: null, para: "publico",
          metadata: { origem: "monitoramento", recuperado: true } },
      }).catch(() => {});
    }
    await prisma.monAsset.update({ where: { id: asset.id }, data: { chamadoAbertoId: null } });
    console.log(`[autoChamado] ONLINE ${asset.nome} -> comentou e liberou chamado`);
  }
}

// ── Probe + persist + emit ──────────────────────────────────────────────────
async function executeProbe(asset) {
  inFlight.add(asset.id);
  runningProbes++;
  try {
    const now = new Date();
    const result = await ping(asset.ip, asset.timeout_seg || 3);

    // 1) Raw
    await prisma.monProbeResult.create({
      data: { assetId: asset.id, ts: now, ok: result.ok, latenciaMs: result.latenciaMs, erro: result.erro },
    });

    // 2) Rollup minuto (upsert). Casts explicitos para evitar erro 42P08:
    //    avg_lat_ms eh DOUBLE PRECISION, max_lat_ms eh INTEGER — Postgres nao
    //    consegue inferir tipo unico do mesmo parametro usado em ambos.
    const bucket = new Date(now); bucket.setSeconds(0, 0);
    const lat = result.latenciaMs;
    await prisma.$executeRawUnsafe(`
      INSERT INTO mon_rollup_minute(asset_id, bucket, total, ok, avg_lat_ms, max_lat_ms)
      VALUES ($1, $2, 1, $3, $4::double precision, $4::integer)
      ON CONFLICT (asset_id, bucket) DO UPDATE
      SET total = mon_rollup_minute.total + 1,
          ok = mon_rollup_minute.ok + EXCLUDED.ok,
          avg_lat_ms = CASE WHEN $4::double precision IS NULL THEN mon_rollup_minute.avg_lat_ms
                            WHEN mon_rollup_minute.avg_lat_ms IS NULL THEN $4::double precision
                            ELSE (mon_rollup_minute.avg_lat_ms * mon_rollup_minute.total + $4::double precision) / (mon_rollup_minute.total + 1) END,
          max_lat_ms = GREATEST(COALESCE(mon_rollup_minute.max_lat_ms, 0), COALESCE($4::integer, 0))
    `, asset.id, bucket, result.ok ? 1 : 0, lat);

    // 3) State engine
    const eng = computeNewStatus(asset, result.ok);
    const mudou = eng.novo !== asset.ultimo_status;

    // 4) Update asset state
    await prisma.monAsset.update({
      where: { id: asset.id },
      data: {
        ultimoCheckEm: now,
        ultimaLatenciaMs: lat ?? null,
        ultimoStatus: eng.novo,
        consecutivoFalhas: eng.consecutivoFalhas,
        consecutivoSucessos: eng.consecutivoSucessos,
        perdaPctUltimaHora: eng.perdaPct,
      },
    });

    // 5) Status event
    if (mudou) {
      const severidade = eng.novo === "OFFLINE" ? "CRITICO" : eng.novo === "INSTAVEL" ? "ATENCAO" : "INFO";
      // Fecha evento(s) anterior(es) aberto(s) calculando a duracao real.
      // duracaoSeg = quanto tempo o asset ficou no status anterior (ex: tempo offline).
      const abertos = await prisma.monStatusEvent.findMany({
        where: { assetId: asset.id, finalizadoEm: null },
        select: { id: true, iniciadoEm: true },
      });
      for (const ab of abertos) {
        const dur = Math.max(0, Math.floor((now.getTime() - new Date(ab.iniciadoEm).getTime()) / 1000));
        await prisma.monStatusEvent.update({
          where: { id: ab.id },
          data: { finalizadoEm: now, duracaoSeg: dur },
        });
      }
      const ev = await prisma.monStatusEvent.create({
        data: {
          organizationId: asset.organization_id,
          assetId: asset.id,
          statusAnterior: asset.ultimo_status,
          statusNovo: eng.novo,
          severidade,
          iniciadoEm: now,
          mensagem: result.erro || null,
        },
      });
      await pub.publish(CHAN_STATUS_CHANGE, JSON.stringify({
        organizationId: asset.organization_id,
        assetId: asset.id,
        nome: asset.nome,
        ip: asset.ip,
        anterior: asset.ultimo_status,
        novo: eng.novo,
        severidade,
        ts: now.toISOString(),
        eventId: ev.id,
      }));

      // Abertura/encerramento automatico de chamado
      await handleAutoChamado(asset, eng.novo, now).catch(e => console.warn(`[autoChamado ${asset.id}]`, e.message));
    }

    // 6) Probe tick (throttle: emite no maximo 1/s por asset)
    await pub.publish(CHAN_PROBE_TICK, JSON.stringify({
      organizationId: asset.organization_id,
      assetId: asset.id,
      ok: result.ok,
      latenciaMs: lat,
      status: eng.novo,
      ts: now.toISOString(),
    }));
  } catch (e) {
    console.warn(`[probe ${asset.id}]`, e.message);
  } finally {
    inFlight.delete(asset.id);
    runningProbes--;
  }
}

// ── Loop principal: agenda assets que precisam ser pingados ─────────────────
async function tick() {
  if (runningProbes >= PARALLEL) return;
  const slotsLivres = PARALLEL - runningProbes;
  try {
    const assets = await prisma.$queryRawUnsafe(`
      SELECT id, organization_id, nome, ip, categoria, localizacao, tipo,
             intervalo_seg, timeout_seg,
             ultimo_status, ultimo_check_em, consecutivo_falhas, consecutivo_sucessos,
             abre_chamado_auto, chamado_aberto_id, depende_de_id
      FROM mon_asset
      WHERE ativo = true AND protocolo = 'ICMP'
    `);

    const now = Date.now();
    const candidatos = [];
    for (const a of assets) {
      if (!isMyShard(a.id)) continue;
      if (inFlight.has(a.id)) continue;
      const last = lastScheduled.get(a.id) || (a.ultimo_check_em ? new Date(a.ultimo_check_em).getTime() : 0);
      const intervaloMs = Math.max(10, a.intervalo_seg) * 1000;
      if (now - last >= intervaloMs) candidatos.push(a);
    }

    // Distribui aleatoriamente para nao todos baterem ao mesmo tempo
    candidatos.sort(() => Math.random() - 0.5);

    for (const a of candidatos.slice(0, slotsLivres)) {
      lastScheduled.set(a.id, now);
      executeProbe(a); // fire-and-forget — controle via runningProbes
    }
  } catch (e) {
    console.warn("[tick]", e.message);
  }
}

// ── Rollup horario ──────────────────────────────────────────────────────────
async function rollupHour() {
  try {
    // Backfill: reconsolida TODOS os buckets de hora das ultimas 48h a partir do
    // rollup_minute. Idempotente (ON CONFLICT). Isso preenche buracos que surgem
    // quando o worker fica fora do ar por horas — antes so consolidava a ultima hora.
    const now = new Date();
    const janelaEnd = new Date(now); janelaEnd.setMinutes(0, 0, 0);
    const janelaStart = new Date(janelaEnd.getTime() - 48 * 3600 * 1000);

    await prisma.$executeRawUnsafe(`
      INSERT INTO mon_rollup_hour (asset_id, bucket, total, ok, avg_lat_ms)
      SELECT asset_id, date_trunc('hour', bucket) AS h, SUM(total)::int, SUM(ok)::int,
             CASE WHEN SUM(total) = 0 THEN NULL ELSE SUM(avg_lat_ms * total) / SUM(total) END
      FROM mon_rollup_minute
      WHERE bucket >= $1 AND bucket < $2
      GROUP BY asset_id, date_trunc('hour', bucket)
      ON CONFLICT (asset_id, bucket) DO UPDATE
      SET total = EXCLUDED.total, ok = EXCLUDED.ok, avg_lat_ms = EXCLUDED.avg_lat_ms
    `, janelaStart, janelaEnd);

    // uptime_24h consolidado em mon_asset
    await prisma.$executeRawUnsafe(`
      UPDATE mon_asset a
      SET uptime_24h = (
        SELECT CASE WHEN SUM(total) > 0 THEN (SUM(ok)::float / SUM(total)::float) * 100 ELSE NULL END
        FROM mon_rollup_hour r WHERE r.asset_id = a.id AND r.bucket >= NOW() - INTERVAL '24 hours'
      )
      WHERE ativo = true
    `);

    // Baseline de latencia (media ponderada das ultimas 7d) p/ deteccao de anomalia
    await prisma.$executeRawUnsafe(`
      UPDATE mon_asset a
      SET latencia_base_ms = (
        SELECT CASE WHEN SUM(total) > 0 AND SUM(CASE WHEN avg_lat_ms IS NULL THEN 0 ELSE total END) > 0
                    THEN SUM(avg_lat_ms * total) / SUM(CASE WHEN avg_lat_ms IS NULL THEN 0 ELSE total END)
                    ELSE NULL END
        FROM mon_rollup_hour r WHERE r.asset_id = a.id AND r.bucket >= NOW() - INTERVAL '7 days'
      )
      WHERE ativo = true
    `);
  } catch (e) {
    console.warn("[rollupHour]", e.message);
  }
}

// ── Cleanup ─────────────────────────────────────────────────────────────────
async function cleanup() {
  try {
    const cutRaw = new Date(Date.now() - RAW_RETENTION_DAYS * 86400 * 1000);
    const cutMin = new Date(Date.now() - MINUTE_RETENTION_DAYS * 86400 * 1000);
    const a = await prisma.$executeRawUnsafe(`DELETE FROM mon_probe_result WHERE ts < $1`, cutRaw);
    const b = await prisma.$executeRawUnsafe(`DELETE FROM mon_rollup_minute WHERE bucket < $1`, cutMin);
    console.log(`[cleanup] raw=${a} rollup_minute=${b}`);
  } catch (e) {
    console.warn("[cleanup]", e.message);
  }
}

// ── Leitura do Zabbix (serviços + desempenho de hardware) ───────────────────
// SOMENTE LEITURA da API do Zabbix. Não toca em nenhum servidor monitorado.
// Casa hosts do Zabbix com mon_asset (por zabbix_host_id ou IP), grava serviços
// (mon_service, com anti-flap) e métricas (mon_metric snapshot + mon_metric_sample).
let zbxRunning = false;

async function upsertMetrics(asset, metrics, now) {
  for (const m of metrics) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO mon_metric (id, asset_id, chave, rotulo, valor, unidade, coletado_em)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (asset_id, chave, rotulo) DO UPDATE
      SET valor = EXCLUDED.valor, unidade = EXCLUDED.unidade, coletado_em = EXCLUDED.coletado_em
    `, randomUUID(), asset.id, m.chave, m.rotulo || "", m.valor, m.unidade || null, now);
    // Histórico só de CPU/RAM (séries p/ gráfico); disco/uptime ficam só no snapshot.
    if (m.chave === "cpu" || m.chave === "mem") {
      await prisma.$executeRawUnsafe(`
        INSERT INTO mon_metric_sample (asset_id, chave, rotulo, valor, ts) VALUES ($1, $2, $3, $4, $5)
      `, asset.id, m.chave, m.rotulo || "", m.valor, now);
    }
  }
}

async function handleServiceChamado(asset, prevSvc, novo, now) {
  if (!prevSvc.abre_chamado_auto) return;
  if (novo === "DOWN" && !prevSvc.chamado_aberto_id) {
    const solicitanteId = await getRequesterId(asset.organization_id);
    if (!solicitanteId) return;
    const titulo = `[AUTO] Serviço "${prevSvc.nome}" parado em ${asset.nome}`;
    const descricao =
      `Chamado aberto automaticamente pelo Monitoramento Operacional.\n\n` +
      `Serviço: ${prevSvc.nome}\nEquipamento: ${asset.nome} (${asset.ip})\n` +
      `Detectado em: ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}\n\n` +
      `O serviço deixou de responder (estado reportado pelo Zabbix).`;
    const ch = await prisma.chamado.create({
      data: { organizationId: asset.organization_id, titulo, descricao, status: "aberto",
        prioridade: "alta", categoria: "Monitoramento", tags: "monitoramento,auto,servico", solicitanteId },
      select: { id: true, numero: true },
    });
    await prisma.$executeRawUnsafe(`UPDATE mon_service SET chamado_aberto_id = $2 WHERE id = $1`, prevSvc.id, ch.id);
    console.log(`[svcChamado] DOWN ${asset.nome}/${prevSvc.nome} -> chamado #${ch.numero}`);
  }
  if (novo === "UP" && prevSvc.chamado_aberto_id) {
    const solicitanteId = await getRequesterId(asset.organization_id);
    if (solicitanteId) {
      await prisma.chamadoComentario.create({
        data: { chamadoId: prevSvc.chamado_aberto_id, userId: solicitanteId, interno: false,
          texto: `✅ Serviço "${prevSvc.nome}" em ${asset.nome} (${asset.ip}) voltou a responder em ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.` },
      }).catch(() => {});
    }
    await prisma.$executeRawUnsafe(`UPDATE mon_service SET chamado_aberto_id = NULL WHERE id = $1`, prevSvc.id);
    console.log(`[svcChamado] UP ${asset.nome}/${prevSvc.nome} -> liberou chamado`);
  }
}

async function upsertServices(asset, services, now) {
  if (!services.length) return;
  const existing = await prisma.$queryRawUnsafe(`
    SELECT id, nome, alvo, estado, consecutivo_falhas, consecutivo_sucessos, abre_chamado_auto, chamado_aberto_id
    FROM mon_service WHERE asset_id = $1
  `, asset.id);
  const byAlvo = {}; for (const s of existing) byAlvo[s.alvo] = s;

  for (const svc of services) {
    const prev = byAlvo[svc.alvo];
    if (!prev) {
      const estado = svc.up ? "UP" : "DOWN";
      await prisma.$executeRawUnsafe(`
        INSERT INTO mon_service (id, organization_id, asset_id, nome, tipo, alvo, esperado, intervalo_seg, ativo,
          estado, ultimo_valor, ultimo_check_em, ultima_transicao, consecutivo_falhas, consecutivo_sucessos,
          abre_chamado_auto, criado_em, atualizado_em)
        VALUES ($1,$2,$3,$4,'ZABBIX',$5,'1',60,true,$6::"MonServiceEstado",$7,$8,$8,$9,$10,false,NOW(),NOW())
      `, randomUUID(), asset.organization_id, asset.id, svc.nome, svc.alvo, estado, svc.valor, now,
         svc.up ? 0 : 1, svc.up ? 1 : 0);
      continue;
    }
    let cf = prev.consecutivo_falhas || 0, cs = prev.consecutivo_sucessos || 0;
    if (svc.up) { cs++; cf = 0; } else { cf++; cs = 0; }
    let novo = prev.estado;
    if (prev.estado === "UP") { if (cf >= SVC_FAIL_THRESHOLD) novo = "DOWN"; }
    else { if (svc.up && cs >= SVC_OK_THRESHOLD) novo = "UP"; else if (cf >= SVC_FAIL_THRESHOLD) novo = "DOWN"; }
    const mudou = novo !== prev.estado;

    await prisma.$executeRawUnsafe(`
      UPDATE mon_service SET estado=$2::"MonServiceEstado", ultimo_valor=$3, ultimo_check_em=$4,
        consecutivo_falhas=$5, consecutivo_sucessos=$6,
        ultima_transicao = CASE WHEN $7 THEN $4 ELSE ultima_transicao END, atualizado_em = NOW()
      WHERE id=$1
    `, prev.id, novo, svc.valor, now, cf, cs, mudou);

    if (mudou) {
      await prisma.$executeRawUnsafe(`
        UPDATE mon_service_event SET finalizado_em=$2,
          duracao_seg = GREATEST(0, EXTRACT(EPOCH FROM ($2 - iniciado_em))::int)
        WHERE service_id=$1 AND finalizado_em IS NULL
      `, prev.id, now);
      await prisma.$executeRawUnsafe(`
        INSERT INTO mon_service_event (id, organization_id, service_id, estado_anterior, estado_novo, iniciado_em, mensagem)
        VALUES ($1,$2,$3,$4::"MonServiceEstado",$5::"MonServiceEstado",$6,$7)
      `, randomUUID(), asset.organization_id, prev.id, prev.estado, novo, now, svc.valor);
      await pub.publish(CHAN_STATUS_CHANGE, JSON.stringify({
        tipo: "service", organizationId: asset.organization_id, assetId: asset.id,
        nome: asset.nome, ip: asset.ip, servico: prev.nome, anterior: prev.estado, novo, ts: now.toISOString(),
      })).catch(() => {});
      await handleServiceChamado(asset, prev, novo, now).catch(e => console.warn(`[svcChamado ${prev.id}]`, e.message));
    }
  }
}

async function pollZabbix() {
  if (!ZBX_URL || !ZBX_TOKEN) return;            // integração não configurada
  if (SHARD_INDEX !== 0) return;                 // só o shard 0 lê o Zabbix (evita duplicar)
  if (zbxRunning) return; zbxRunning = true;
  const now = new Date();
  try {
    const hosts = await zbx.fetchHosts(ZBX_URL, ZBX_TOKEN);
    const hidByIp = {};
    for (const h of hosts) {
      const ip = (h.interfaces || []).map(i => i.ip).find(Boolean);
      if (ip && !hidByIp[ip]) hidByIp[ip] = String(h.hostid);
    }
    const assets = await prisma.$queryRawUnsafe(`
      SELECT id, organization_id, nome, ip, zabbix_host_id, coleta_profunda
      FROM mon_asset WHERE ativo = true
    `);
    const assetByHid = {}; const hostids = [];
    for (const a of assets) {
      let hid = a.zabbix_host_id || (a.ip ? hidByIp[a.ip] : null);
      if (!hid) continue;
      assetByHid[hid] = a; hostids.push(hid);
    }
    if (!hostids.length) return;

    const items = await zbx.fetchDeepItems(ZBX_URL, ZBX_TOKEN, hostids);
    const grouped = zbx.classifyByHost(items);
    let nServ = 0, nMet = 0, nHosts = 0;
    for (const hid of Object.keys(grouped)) {
      const a = assetByHid[hid];
      if (!a) continue;
      const g = grouped[hid];
      if (!g.services.length && !g.metrics.length) continue;
      nHosts++; nServ += g.services.length; nMet += g.metrics.length;
      // Descoberta automática: marca o asset como coleta profunda e fixa o hostid.
      if (!a.coleta_profunda || a.zabbix_host_id !== hid) {
        await prisma.$executeRawUnsafe(
          `UPDATE mon_asset SET coleta_profunda = true, zabbix_host_id = $2 WHERE id = $1`, a.id, hid).catch(() => {});
      }
      await upsertMetrics(a, g.metrics, now);
      await upsertServices(a, g.services, now);
    }
    console.log(`[zabbix] hosts=${nHosts} servicos=${nServ} metricas=${nMet}`);
  } catch (e) {
    console.warn("[zabbix]", e.message);
  } finally {
    zbxRunning = false;
  }
}

// ── Monitoramento OSA (auto-descoberta do item fadami.tag.recebido no Zabbix) ──
let osaRunning = false;
const OSA_DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";
const OSA_ITEM_KEY = process.env.OSA_ITEM_KEY || "fadami.tag.recebido";

function osaStatus(ultimaAtualizacao, tempoMaxMin, now) {
  if (!ultimaAtualizacao) return "DESCONHECIDO";
  const min = (now.getTime() - new Date(ultimaAtualizacao).getTime()) / 60000;
  const max = tempoMaxMin || 5;
  if (min > max) return "ATRASADO";
  if (min >= max * 0.8) return "ATENCAO";
  return "ONLINE";
}

async function pollOsa() {
  if (SHARD_INDEX !== 0) return;             // só o shard 0 coleta
  if (!ZBX_URL || !ZBX_TOKEN) return;        // OSA agora lê do Zabbix
  if (osaRunning) return; osaRunning = true;
  const now = new Date();
  try {
    const { items, hosts } = await zbx.fetchOsaItems(ZBX_URL, ZBX_TOKEN);
    const porHost = {};
    for (const it of items) {
      const hid = String(it.hostid);
      porHost[hid] = porHost[hid] || {};
      if ((it.key_ || "").indexOf(OSA_ITEM_KEY) === 0) porHost[hid].tag = it;
      else if ((it.key_ || "").indexOf("service.info") === 0) porHost[hid].svc = it;
    }
    let n = 0;
    for (const hid of Object.keys(porHost)) {
      const tag = porHost[hid].tag;
      if (!tag) continue;                      // só hosts que têm o item de tag
      const h = hosts[hid] || { nome: hid, ip: "" };
      const valor = (tag.lastvalue == null ? "" : String(tag.lastvalue)).trim();
      const svc = porHost[hid].svc;
      const servicoEstado = svc ? (String(svc.lastvalue).trim() === "0" ? "RUNNING" : "STOPPED") : null;
      let serie = null, sequencial = valor;
      const p = valor.indexOf(".");
      if (p >= 0) { serie = valor.slice(0, p); sequencial = valor.slice(p + 1); }
      const lc = tag.lastclock && tag.lastclock !== "0" ? new Date(Number(tag.lastclock) * 1000) : now;
      const arquivo = valor ? valor + ".tag" : null;

      const ex = await prisma.$queryRawUnsafe(
        `SELECT id, valor_atual, ultima_atualizacao, tempo_max_min FROM osa_monitor
         WHERE zabbix_host_id = $1 OR ip = $2 LIMIT 1`, hid, h.ip);
      if (ex && ex[0]) {
        const m = ex[0];
        const mudou = (m.valor_atual || "") !== valor;          // valor novo = chegou tag
        const ua = mudou ? lc : m.ultima_atualizacao;
        const status = osaStatus(ua, m.tempo_max_min, now);
        await prisma.$executeRawUnsafe(
          `UPDATE osa_monitor SET zabbix_host_id=$2, item_key=$3, valor_atual=$4, serie=$5, sequencial=$6,
             ultima_atualizacao=$7, servico_estado=$8, status=$9, ultimo_arquivo=$10,
             ultimo_check_em=$11, ultimo_erro=NULL, atualizado_em=NOW() WHERE id=$1`,
          m.id, hid, OSA_ITEM_KEY, valor, serie, sequencial, ua, servicoEstado, status, arquivo, now);
      } else {
        const status = osaStatus(lc, 5, now);
        await prisma.$executeRawUnsafe(
          `INSERT INTO osa_monitor (id, organization_id, descricao, ip, zabbix_host_id, item_key,
             valor_atual, serie, sequencial, ultima_atualizacao, servico_estado, status, ultimo_arquivo,
             ultimo_check_em, tempo_max_min, intervalo_seg, ativo, criado_em, atualizado_em)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,5,60,true,NOW(),NOW())`,
          randomUUID(), OSA_DEFAULT_ORG, h.nome, h.ip, hid, OSA_ITEM_KEY,
          valor, serie, sequencial, lc, servicoEstado, status, arquivo, now);
      }
      n++;
    }
    if (n) console.log(`[osa] ${n} monitor(es) sincronizados do Zabbix`);
  } catch (e) {
    console.warn("[osa]", e.message);
  } finally {
    osaRunning = false;
  }
}

// ── Lifecycle ───────────────────────────────────────────────────────────────
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  console.log("[worker] stopping...");
  setTimeout(() => process.exit(0), 1500);
}
process.on("SIGTERM", stop);
process.on("SIGINT",  stop);

async function main() {
  console.log(`[worker] start parallel=${PARALLEL} shard=${SHARD_INDEX}/${SHARD_TOTAL}`);

  // Tick principal
  setInterval(() => { if (!stopping) tick().catch(() => {}); }, TICK_INTERVAL_MS);

  // Rollup horario: roda no comeco de cada hora + 1min de buffer
  setInterval(() => {
    const d = new Date();
    if (d.getMinutes() === 1) rollupHour().catch(() => {});
  }, 60 * 1000);

  // Cleanup diario as 03:30
  setInterval(() => {
    const d = new Date();
    if (d.getHours() === 3 && d.getMinutes() === 30) cleanup().catch(() => {});
  }, 60 * 1000);

  // Leitura do Zabbix (serviços + hardware), se configurado
  if (ZBX_URL && ZBX_TOKEN && SHARD_INDEX === 0) {
    console.log(`[worker] integração Zabbix ativa — poll a cada ${ZBX_INTERVAL_MS}ms`);
    setTimeout(() => { if (!stopping) pollZabbix().catch(() => {}); }, 8000); // 1º ciclo após warm-up
    setInterval(() => { if (!stopping) pollZabbix().catch(() => {}); }, ZBX_INTERVAL_MS);
  } else {
    console.log("[worker] integração Zabbix desligada (ZABBIX_API_URL/TOKEN ausentes)");
  }

  // Monitoramento OSA (auto-descoberta lendo do Zabbix)
  if (SHARD_INDEX === 0) {
    setTimeout(() => { if (!stopping) pollOsa().catch(() => {}); }, 12000);
    setInterval(() => { if (!stopping) pollOsa().catch(() => {}); }, OSA_TICK_MS);
  }

  // Heartbeat
  setInterval(() => console.log(`[hb] inFlight=${runningProbes} schedMap=${lastScheduled.size}`), 60_000);
}

main().catch(e => { console.error(e); process.exit(1); });
