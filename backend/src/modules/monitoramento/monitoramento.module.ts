import {
  Module, Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards, Req, Logger,
  Injectable, NotFoundException, BadRequestException, OnModuleInit,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";
import { PrismaService } from "../../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { MonitoramentoGateway } from "./monitoramento.gateway";
import Redis from "ioredis";
import * as crypto from "crypto";

// ── Constantes ───────────────────────────────────────────────────────────────
const CATEGORIA_VALID = ["ITS", "SERVIDORES", "COMPUTADORES", "PRACAS", "INFRAESTRUTURA"];
const PROTOCOLO_VALID = ["ICMP", "TCP", "HTTP", "SNMP"];
const STATUS_VALID    = ["ONLINE", "OFFLINE", "INSTAVEL", "NAO_MONITORADO"];

// Anti-flap (tambem usado pelo worker)
const FAIL_THRESHOLD       = 3;   // n falhas seguidas pra virar OFFLINE
const SUCCESS_THRESHOLD    = 2;   // n sucessos seguidos pra voltar ONLINE
const INSTABILIDADE_PCT    = 0.20; // >=20% perda em 10 checks = INSTAVEL
const INSTABILIDADE_WINDOW = 10;

// Canal Redis (pub/sub)
const CHAN_STATUS_CHANGE = "mon:status_change";
const CHAN_PROBE_TICK    = "mon:probe_tick";

// IPv4/IPv6/hostname basicos — antes de mandar pro worker
function ipOuHostnameValido(s: string): boolean {
  if (!s) return false;
  const trim = s.trim();
  if (trim.length > 255) return false;
  // IPv4
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(trim)) {
    return trim.split(".").every(o => Number(o) <= 255);
  }
  // hostname / FQDN (alfa-num + . + -)
  if (/^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/.test(trim)) return true;
  // IPv6 simples
  if (/^[0-9a-fA-F:]+$/.test(trim) && trim.includes(":")) return true;
  return false;
}

// ── Service ──────────────────────────────────────────────────────────────────
@Injectable()
export class MonitoramentoService implements OnModuleInit {
  private readonly logger = new Logger("MonitoramentoService");
  private redisSub?: Redis;

  constructor(private readonly db: PrismaService, private readonly gateway: MonitoramentoGateway) {}

  async onModuleInit() {
    // Assina Redis pub/sub do worker e repassa pro gateway WebSocket.
    const url = process.env.REDIS_HOST
      ? `redis://:${encodeURIComponent(process.env.REDIS_PASSWORD || "")}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`
      : null;
    if (!url) {
      this.logger.warn("REDIS_HOST nao configurado — pub/sub de monitoramento desabilitado");
      return;
    }
    try {
      this.redisSub = new Redis(url, { maxRetriesPerRequest: null, enableReadyCheck: false });
      await this.redisSub.subscribe(CHAN_STATUS_CHANGE, CHAN_PROBE_TICK);
      this.redisSub.on("message", (channel, msg) => {
        try {
          const data = JSON.parse(msg);
          if (channel === CHAN_STATUS_CHANGE) this.gateway.emitStatusChange(data);
          else if (channel === CHAN_PROBE_TICK) this.gateway.emitProbeTick(data);
        } catch (e: any) { this.logger.warn("pub/sub parse: " + e.message); }
      });
      this.logger.log("Pub/Sub Monitoramento conectado");
    } catch (e: any) {
      this.logger.warn("Falha conectar Redis pub/sub: " + e.message);
    }
  }

  // ── Assets CRUD ──────────────────────────────────────────────────────────
  async listAssets(orgId: string, filtros: any = {}) {
    const where: any = { organizationId: orgId };
    if (filtros.categoria && CATEGORIA_VALID.includes(filtros.categoria)) where.categoria = filtros.categoria;
    if (filtros.status && STATUS_VALID.includes(filtros.status))         where.ultimoStatus = filtros.status;
    if (filtros.unidadeId)                                                where.unidadeId = filtros.unidadeId;
    if (filtros.q) {
      where.OR = [
        { nome: { contains: String(filtros.q), mode: "insensitive" } },
        { ip:   { contains: String(filtros.q), mode: "insensitive" } },
        { hostname: { contains: String(filtros.q), mode: "insensitive" } },
      ];
    }
    const rows = await this.db.monAsset.findMany({
      where,
      include: {
        unidade:     { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true, email: true } },
        dependeDe:   { select: { id: true, nome: true, ultimoStatus: true } },
      },
      orderBy: [{ ultimoStatus: "asc" }, { nome: "asc" }],
      take: 2000,
    });
    return rows.map((a: any) => this.enrich(a));
  }

  // Deriva supressao por dependencia e anomalia de latencia (read-time).
  private enrich(a: any) {
    const supressedByDep = a.ultimoStatus === "OFFLINE" && a.dependeDe && a.dependeDe.ultimoStatus === "OFFLINE";
    const base = a.latenciaBaseMs;
    const lat = a.ultimaLatenciaMs;
    // anomalia: online, com baseline confiavel (>5ms) e latencia atual >2x base + 20ms
    const latenciaAnomala = a.ultimoStatus === "ONLINE" && base != null && base > 5 && lat != null && lat > base * 2 + 20;
    return { ...a, supressedByDep, latenciaAnomala };
  }

  async getAsset(orgId: string, id: string) {
    const a = await this.db.monAsset.findFirst({
      where: { id, organizationId: orgId },
      include: { unidade: true, responsavel: { select: { id: true, nome: true, email: true } } },
    });
    if (!a) throw new NotFoundException("Equipamento nao encontrado");
    return a;
  }

  async createAsset(orgId: string, body: any) {
    this.validatePayload(body);
    return this.db.monAsset.create({
      data: {
        id: crypto.randomUUID(),
        organizationId: orgId,
        nome:          body.nome.trim(),
        categoria:     body.categoria,
        tipo:          (body.tipo || "Outros").toString().trim(),
        localizacao:   body.localizacao || null,
        unidadeId:     body.unidadeId || null,
        responsavelId: body.responsavelId || null,
        observacoes:   body.observacoes || null,
        ip:            body.ip.trim(),
        hostname:      body.hostname || null,
        porta:         body.porta ? Number(body.porta) : null,
        link:          body.link ? String(body.link).trim() : null,
        intervaloSeg:  body.intervaloSeg ? Math.max(10, Math.min(3600, Number(body.intervaloSeg))) : 60,
        timeoutSeg:    body.timeoutSeg ? Math.max(1, Math.min(30, Number(body.timeoutSeg))) : 3,
        protocolo:     PROTOCOLO_VALID.includes(body.protocolo) ? body.protocolo : "ICMP",
        ativo:         body.ativo !== false,
        abreChamadoAuto: body.abreChamadoAuto === true,
        dependeDeId:   body.dependeDeId || null,
      } as any,
    });
  }

  async updateAsset(orgId: string, id: string, body: any) {
    const existing = await this.getAsset(orgId, id);
    if (body.nome != null || body.ip != null) this.validatePayload({ ...existing, ...body });
    const data: any = {};
    const keys = ["nome","categoria","tipo","localizacao","unidadeId","responsavelId","observacoes",
                  "ip","hostname","porta","link","intervaloSeg","timeoutSeg","protocolo","ativo","abreChamadoAuto","dependeDeId"];
    for (const k of keys) if (body[k] !== undefined) data[k] = body[k];
    if (data.intervaloSeg != null) data.intervaloSeg = Math.max(10, Math.min(3600, Number(data.intervaloSeg)));
    if (data.timeoutSeg   != null) data.timeoutSeg   = Math.max(1, Math.min(30,   Number(data.timeoutSeg)));
    if (data.protocolo    && !PROTOCOLO_VALID.includes(data.protocolo)) delete data.protocolo;
    if (data.ativo === false) data.ultimoStatus = "NAO_MONITORADO";
    return this.db.monAsset.update({ where: { id }, data });
  }

  async deleteAsset(orgId: string, id: string) {
    await this.getAsset(orgId, id);
    await this.db.monAsset.delete({ where: { id } });
    return { ok: true };
  }

  // ── Bulk actions ───────────────────────────────────────────────────────────
  async bulkAction(orgId: string, ids: string[], acao: string, valor?: any) {
    if (!Array.isArray(ids) || !ids.length) throw new BadRequestException("Nenhum item selecionado");
    const where = { id: { in: ids }, organizationId: orgId };
    if (acao === "ativar")        return { ok: true, n: (await this.db.monAsset.updateMany({ where, data: { ativo: true } })).count };
    if (acao === "desativar")     return { ok: true, n: (await this.db.monAsset.updateMany({ where, data: { ativo: false, ultimoStatus: "NAO_MONITORADO" } })).count };
    if (acao === "excluir")       return { ok: true, n: (await this.db.monAsset.deleteMany({ where })).count };
    if (acao === "intervalo") {
      const v = Math.max(10, Math.min(3600, Number(valor) || 60));
      return { ok: true, n: (await this.db.monAsset.updateMany({ where, data: { intervaloSeg: v } })).count };
    }
    if (acao === "auto_chamado") return { ok: true, n: (await this.db.monAsset.updateMany({ where, data: { abreChamadoAuto: valor === true } as any })).count };
    if (acao === "uplink") {
      // valor = id do ativo-pai (uplink). Nao deixa um ativo depender de si mesmo.
      const paiId = valor ? String(valor) : null;
      if (paiId) {
        const pai = await this.db.monAsset.findFirst({ where: { id: paiId, organizationId: orgId } });
        if (!pai) throw new BadRequestException("Uplink invalido");
      }
      const idsSemSelf = ids.filter(i => i !== paiId);
      return { ok: true, n: (await this.db.monAsset.updateMany({ where: { id: { in: idsSemSelf }, organizationId: orgId }, data: { dependeDeId: paiId } as any })).count };
    }
    if (acao === "link_auto") {
      // gera link http://<ip> (ou snapshot.cgi pra cameras) nos selecionados sem link
      const assets = await this.db.monAsset.findMany({ where, select: { id: true, ip: true, categoria: true, tipo: true } });
      const ops = assets.map((a: any) => {
        const isCam = a.categoria === "PRACAS" && ["OCR","VAS","VES","RESERVA1","RESERVA2"].includes(a.tipo);
        const link = isCam ? `http://${a.ip}/cgi-bin/snapshot.cgi` : `http://${a.ip}`;
        return this.db.monAsset.update({ where: { id: a.id }, data: { link } });
      });
      await this.db.$transaction(ops);
      return { ok: true, n: ops.length };
    }
    throw new BadRequestException("Acao invalida");
  }

  // ── Import em massa (CSV parseado no frontend → array de linhas) ─────────────
  async importAssets(orgId: string, linhas: any[]) {
    if (!Array.isArray(linhas) || !linhas.length) throw new BadRequestException("Nada para importar");
    let criados = 0, ignorados = 0; const erros: string[] = [];
    for (const row of linhas.slice(0, 2000)) {
      try {
        const ip = String(row.ip || "").trim();
        const nome = String(row.nome || "").trim();
        const categoria = String(row.categoria || "INFRAESTRUTURA").toUpperCase();
        if (!ip || !ipOuHostnameValido(ip) || !nome || !CATEGORIA_VALID.includes(categoria)) { ignorados++; continue; }
        const dup = await this.db.monAsset.findFirst({ where: { organizationId: orgId, ip } });
        if (dup) { ignorados++; continue; }
        await this.db.monAsset.create({
          data: {
            id: crypto.randomUUID(), organizationId: orgId, nome, categoria: categoria as any,
            tipo: String(row.tipo || "Outros").trim(),
            localizacao: row.localizacao || null,
            ip, hostname: row.hostname || null,
            link: row.link || null,
            intervaloSeg: row.intervaloSeg ? Math.max(10, Math.min(3600, Number(row.intervaloSeg))) : 60,
            timeoutSeg: 3, protocolo: "ICMP", ativo: true,
          } as any,
        });
        criados++;
      } catch (e: any) { erros.push(e.message); ignorados++; }
    }
    return { ok: true, criados, ignorados, erros: erros.slice(0, 5) };
  }

  private validatePayload(body: any) {
    if (!body.nome || !String(body.nome).trim()) throw new BadRequestException("Nome obrigatorio");
    if (!body.categoria || !CATEGORIA_VALID.includes(body.categoria)) throw new BadRequestException("Categoria invalida");
    if (!body.ip || !ipOuHostnameValido(String(body.ip))) throw new BadRequestException("IP/hostname invalido");
  }

  // ── Dashboard ────────────────────────────────────────────────────────────
  async dashboardSummary(orgId: string) {
    const assets = await this.db.monAsset.findMany({
      where: { organizationId: orgId },
      select: { id: true, ativo: true, ultimoStatus: true, uptime24h: true },
    });
    const total      = assets.length;
    const monitorados= assets.filter(a => a.ativo).length;
    const online     = assets.filter(a => a.ultimoStatus === "ONLINE").length;
    const offline    = assets.filter(a => a.ultimoStatus === "OFFLINE").length;
    const instavel   = assets.filter(a => a.ultimoStatus === "INSTAVEL").length;
    const naoMon     = assets.filter(a => a.ultimoStatus === "NAO_MONITORADO").length;
    const disponPct  = monitorados ? (online / monitorados) * 100 : 0;
    return { total, monitorados, online, offline, instavel, naoMon, disponPct };
  }

  // ── Correlação / causa-raiz ──────────────────────────────────────────────
  // Agrupa quedas: (1) uplink offline com dependentes offline = causa provavel;
  // (2) unidade com varios offline sem uplink mapeado = falha em massa.
  async incidentes(orgId: string) {
    const assets = await this.db.monAsset.findMany({
      where: { organizationId: orgId, ativo: true },
      select: {
        id: true, nome: true, ip: true, categoria: true, ultimoStatus: true,
        dependeDeId: true, unidadeId: true,
        unidade: { select: { id: true, nome: true } },
      },
    });
    const offline = assets.filter(a => a.ultimoStatus === "OFFLINE" || a.ultimoStatus === "INSTAVEL");
    const byId = new Map(assets.map(a => [a.id, a]));
    const incidentes: any[] = [];
    const cobertos = new Set<string>();

    // (1) Causa-raiz por uplink
    const offlineParents = offline.filter(a => assets.some(c => c.dependeDeId === a.id && (c.ultimoStatus === "OFFLINE" || c.ultimoStatus === "INSTAVEL")));
    for (const pai of offlineParents) {
      const filhos = offline.filter(c => c.dependeDeId === pai.id);
      if (!filhos.length) continue;
      cobertos.add(pai.id); filhos.forEach(f => cobertos.add(f.id));
      incidentes.push({
        tipo: "causa_raiz",
        causa: { id: pai.id, nome: pai.nome, ip: pai.ip, categoria: pai.categoria },
        afetados: filhos.map(f => ({ id: f.id, nome: f.nome, ip: f.ip, categoria: f.categoria, status: f.ultimoStatus })),
        total: filhos.length + 1,
        unidade: pai.unidade?.nome || null,
        severidade: "CRITICO",
      });
    }

    // (2) Falha em massa por unidade (>=3 offline, fora dos ja cobertos)
    const porUnidade: Record<string, any[]> = {};
    for (const a of offline) {
      if (cobertos.has(a.id)) continue;
      const k = a.unidadeId || "_sem_unidade";
      (porUnidade[k] = porUnidade[k] || []).push(a);
    }
    for (const [k, arr] of Object.entries(porUnidade)) {
      if (arr.length < 3 || k === "_sem_unidade") continue;
      arr.forEach(a => cobertos.add(a.id));
      incidentes.push({
        tipo: "falha_massa",
        unidade: arr[0].unidade?.nome || "—",
        afetados: arr.map(a => ({ id: a.id, nome: a.nome, ip: a.ip, categoria: a.categoria, status: a.ultimoStatus })),
        total: arr.length,
        severidade: "ATENCAO",
        dica: "Vários equipamentos da mesma unidade offline — verifique link/energia da unidade.",
      });
    }

    // (3) Quedas isoladas (resto)
    const isolados = offline.filter(a => !cobertos.has(a.id));
    return {
      incidentes: incidentes.sort((a, b) => b.total - a.total),
      isolados: isolados.map(a => ({ id: a.id, nome: a.nome, ip: a.ip, categoria: a.categoria, status: a.ultimoStatus, unidade: a.unidade?.nome || null })),
      resumo: { gruposCorrelacionados: incidentes.length, totalOffline: offline.length, isolados: isolados.length },
    };
  }

  async dashboardPorCategoria(orgId: string) {
    const rows = await this.db.monAsset.groupBy({
      by: ["categoria", "ultimoStatus"],
      where: { organizationId: orgId, ativo: true },
      _count: true,
    });
    const out: Record<string, { online: number; offline: number; instavel: number; total: number }> = {};
    for (const c of CATEGORIA_VALID) out[c] = { online: 0, offline: 0, instavel: 0, total: 0 };
    for (const r of rows) {
      const k = r.categoria as string;
      const c = (r._count as any) ?? 0;
      out[k] = out[k] || { online: 0, offline: 0, instavel: 0, total: 0 };
      if (r.ultimoStatus === "ONLINE")    out[k].online   += c;
      if (r.ultimoStatus === "OFFLINE")   out[k].offline  += c;
      if (r.ultimoStatus === "INSTAVEL")  out[k].instavel += c;
      out[k].total += c;
    }
    return out;
  }

  async topOffline(orgId: string, limit = 10) {
    return this.db.monAsset.findMany({
      where: { organizationId: orgId, ativo: true, ultimoStatus: { in: ["OFFLINE", "INSTAVEL"] } },
      orderBy: { atualizadoEm: "desc" },
      take: limit,
      select: { id: true, nome: true, ip: true, ultimoStatus: true, categoria: true, ultimoCheckEm: true },
    });
  }

  async topLatencia(orgId: string, limit = 10) {
    return this.db.monAsset.findMany({
      where: { organizationId: orgId, ativo: true, ultimaLatenciaMs: { not: null } },
      orderBy: { ultimaLatenciaMs: "desc" },
      take: limit,
      select: { id: true, nome: true, ip: true, categoria: true, ultimaLatenciaMs: true, ultimoStatus: true },
    });
  }

  async sla(orgId: string, periodo: "24h" | "7d" | "30d") {
    const horas = periodo === "24h" ? 24 : periodo === "7d" ? 24*7 : 24*30;
    const desde = new Date(Date.now() - horas * 3600 * 1000);
    // Usa rollup hour pra periodos grandes
    const assets = await this.db.monAsset.findMany({
      where: { organizationId: orgId, ativo: true }, select: { id: true, nome: true, categoria: true, ip: true },
    });
    if (!assets.length) return [];
    const ids = assets.map(a => a.id);
    const rows: any[] = await this.db.$queryRawUnsafe(`
      SELECT asset_id, SUM(ok)::int AS ok, SUM(total)::int AS total
      FROM mon_rollup_hour
      WHERE asset_id = ANY($1) AND bucket >= $2
      GROUP BY asset_id
    `, ids, desde);
    const idxOk = new Map(rows.map(r => [r.asset_id, { ok: r.ok, total: r.total }]));
    return assets.map(a => {
      const r = idxOk.get(a.id);
      const pct = r && r.total ? (r.ok / r.total) * 100 : null;
      return { ...a, disponibilidadePct: pct, amostras: r?.total || 0 };
    });
  }

  // ── Eventos ──────────────────────────────────────────────────────────────
  async listEvents(orgId: string, filtros: any = {}) {
    const where: any = { organizationId: orgId };
    if (filtros.assetId)  where.assetId    = filtros.assetId;
    if (filtros.severidade && ["INFO","ATENCAO","CRITICO"].includes(filtros.severidade)) where.severidade = filtros.severidade;
    if (filtros.statusNovo && STATUS_VALID.includes(filtros.statusNovo)) where.statusNovo = filtros.statusNovo;
    if (filtros.desde)    where.iniciadoEm = { gte: new Date(filtros.desde) };
    if (filtros.naoReconhecidos === "true" || filtros.naoReconhecidos === true) where.reconhecidoEm = null;
    return this.db.monStatusEvent.findMany({
      where,
      orderBy: { iniciadoEm: "desc" },
      take: Math.min(500, Number(filtros.limit) || 100),
      include: { asset: { select: { id: true, nome: true, ip: true, categoria: true } } },
    });
  }

  // ── Metas de SLA por categoria ───────────────────────────────────────────
  async listSlaMetas(orgId: string) {
    const rows = await (this.db as any).monSlaMeta.findMany({ where: { organizationId: orgId } });
    const map: Record<string, number> = {};
    for (const r of rows) map[r.categoria] = r.metaPct;
    // defaults pra categorias sem meta definida
    for (const c of CATEGORIA_VALID) if (map[c] == null) map[c] = 99;
    return map;
  }

  async setSlaMeta(orgId: string, categoria: string, metaPct: number) {
    if (!CATEGORIA_VALID.includes(categoria)) throw new BadRequestException("Categoria invalida");
    const pct = Math.max(0, Math.min(100, Number(metaPct)));
    const existing = await (this.db as any).monSlaMeta.findFirst({ where: { organizationId: orgId, categoria } });
    if (existing) return (this.db as any).monSlaMeta.update({ where: { id: existing.id }, data: { metaPct: pct } });
    return (this.db as any).monSlaMeta.create({
      data: { id: crypto.randomUUID(), organizationId: orgId, categoria, metaPct: pct },
    });
  }

  // Reconhecer (ack) um evento — operador marca ciência no NOC.
  async ackEvent(orgId: string, eventId: string, userId: string) {
    const ev: any = await (this.db as any).monStatusEvent.findFirst({ where: { id: eventId, organizationId: orgId } });
    if (!ev) throw new NotFoundException("Evento nao encontrado");
    if (ev.reconhecidoEm) return ev; // ja reconhecido
    return (this.db as any).monStatusEvent.update({
      where: { id: eventId },
      data: { reconhecidoPorId: userId, reconhecidoEm: new Date() },
      include: { asset: { select: { id: true, nome: true, ip: true, categoria: true } } },
    });
  }

  async historicoAsset(orgId: string, assetId: string, horas: number) {
    const asset = await this.getAsset(orgId, assetId);
    const desde = new Date(Date.now() - horas * 3600 * 1000);
    const rollup: any[] = await this.db.$queryRawUnsafe(`
      SELECT bucket, total, ok, avg_lat_ms FROM mon_rollup_minute
      WHERE asset_id = $1 AND bucket >= $2
      ORDER BY bucket ASC
    `, assetId, desde);
    return { asset: { id: asset.id, nome: asset.nome, ip: asset.ip }, serie: rollup };
  }

  // ── Coleta profunda (serviços + hardware lidos do Zabbix) ──────────────────
  async assetDeep(orgId: string, assetId: string) {
    const asset = await this.getAsset(orgId, assetId);
    const [services, metrics] = await Promise.all([
      (this.db as any).monService.findMany({
        where: { assetId, organizationId: orgId },
        orderBy: [{ estado: "asc" }, { nome: "asc" }],
      }),
      (this.db as any).monMetric.findMany({
        where: { assetId },
        orderBy: [{ chave: "asc" }, { rotulo: "asc" }],
      }),
    ]);
    return {
      asset: { id: asset.id, nome: asset.nome, ip: asset.ip, coletaProfunda: (asset as any).coletaProfunda },
      services,
      metrics,
    };
  }

  async listServices(orgId: string, filtros: any = {}) {
    const where: any = { organizationId: orgId };
    if (filtros.estado) where.estado = String(filtros.estado).toUpperCase();
    if (filtros.assetId) where.assetId = filtros.assetId;
    return (this.db as any).monService.findMany({
      where,
      orderBy: [{ estado: "asc" }, { nome: "asc" }],
      include: { asset: { select: { id: true, nome: true, ip: true, categoria: true, localizacao: true } } },
      take: Math.min(2000, Number(filtros.limit) || 1000),
    });
  }

  async servicesSummary(orgId: string) {
    const rows: any[] = await this.db.$queryRawUnsafe(`
      SELECT
        (SELECT COUNT(*) FROM mon_service WHERE organization_id = $1 AND ativo = true) AS total,
        (SELECT COUNT(*) FROM mon_service WHERE organization_id = $1 AND ativo = true AND estado = 'DOWN') AS down,
        (SELECT COUNT(*) FROM mon_asset   WHERE organization_id = $1 AND coleta_profunda = true) AS hosts
    `, orgId);
    const r = rows[0] || {};
    const total = Number(r.total || 0), down = Number(r.down || 0);
    return { total, down, up: total - down, hosts: Number(r.hosts || 0) };
  }

  async updateService(orgId: string, id: string, body: any) {
    const svc = await (this.db as any).monService.findFirst({ where: { id, organizationId: orgId } });
    if (!svc) throw new NotFoundException("Servico nao encontrado");
    const data: any = {};
    if (body.abreChamadoAuto !== undefined) data.abreChamadoAuto = !!body.abreChamadoAuto;
    if (body.ativo !== undefined) data.ativo = !!body.ativo;
    if (body.nome) data.nome = String(body.nome).trim();
    return (this.db as any).monService.update({ where: { id }, data });
  }

  async deepOverview(orgId: string) {
    const assets: any[] = await (this.db as any).monAsset.findMany({
      where: { organizationId: orgId, coletaProfunda: true },
      select: { id: true, nome: true, ip: true, categoria: true, tipo: true, localizacao: true, ultimoStatus: true },
      orderBy: { nome: "asc" },
    });
    if (!assets.length) return { assets: [] };
    const ids = assets.map((a) => a.id);
    const [services, metrics] = await Promise.all([
      (this.db as any).monService.findMany({ where: { organizationId: orgId, assetId: { in: ids } }, orderBy: [{ nome: "asc" }] }),
      (this.db as any).monMetric.findMany({ where: { assetId: { in: ids } } }),
    ]);
    const svcByAsset: Record<string, any[]> = {}, metByAsset: Record<string, any[]> = {};
    for (const s of services) (svcByAsset[s.assetId] ||= []).push(s);
    for (const m of metrics) (metByAsset[m.assetId] ||= []).push(m);

    // Mini-série de CPU (últimos ~90min) por asset, para as sparklines dos cards.
    // Em uma query só; se falhar, segue sem sparkline (não quebra a página).
    const sparkByAsset: Record<string, number[]> = {};
    try {
      const desde = new Date(Date.now() - 90 * 60 * 1000);
      const samples: any[] = await this.db.$queryRawUnsafe(
        `SELECT asset_id, valor FROM mon_metric_sample WHERE asset_id = ANY($1) AND chave = 'cpu' AND ts >= $2 ORDER BY ts ASC`,
        ids, desde,
      );
      for (const s of samples) (sparkByAsset[s.asset_id] ||= []).push(Number(s.valor));
    } catch { /* sem sparkline */ }
    const downsample = (arr: number[], n = 20) =>
      !arr || arr.length <= n ? (arr || []) : arr.filter((_, i) => i % Math.ceil(arr.length / n) === 0);

    return {
      assets: assets.map((a) => ({
        ...a,
        services: svcByAsset[a.id] || [],
        metrics: metByAsset[a.id] || [],
        sparkCpu: downsample(sparkByAsset[a.id]),
      })),
    };
  }

  async metricHistory(orgId: string, assetId: string, chave: string, horas: number) {
    await this.getAsset(orgId, assetId); // valida posse pela org
    const desde = new Date(Date.now() - horas * 3600 * 1000);
    const serie: any[] = await this.db.$queryRawUnsafe(`
      SELECT ts, valor FROM mon_metric_sample
      WHERE asset_id = $1 AND chave = $2 AND ts >= $3
      ORDER BY ts ASC
    `, assetId, chave, desde);
    return { assetId, chave, serie };
  }

  // ── Mapas ────────────────────────────────────────────────────────────────
  async listMapas(orgId: string) {
    return this.db.monMap.findMany({
      where: { organizationId: orgId },
      orderBy: { criadoEm: "desc" },
      include: { _count: { select: { positions: true } } },
    });
  }

  async createMap(orgId: string, body: any) {
    if (!body.nome) throw new BadRequestException("Nome obrigatorio");
    return this.db.monMap.create({
      data: {
        id: crypto.randomUUID(),
        organizationId: orgId,
        nome: String(body.nome).trim(),
        tipo: body.tipo === "GEO" ? "GEO" : "INFRA",
        unidadeId: body.unidadeId || null,
        backgroundUrl: body.backgroundUrl || null,
        centroLat: body.centroLat != null ? Number(body.centroLat) : null,
        centroLng: body.centroLng != null ? Number(body.centroLng) : null,
        zoom:      body.zoom != null ? Number(body.zoom) : null,
      } as any,
    });
  }

  async getMap(orgId: string, id: string) {
    const m = await this.db.monMap.findFirst({
      where: { id, organizationId: orgId },
      include: {
        positions: {
          include: {
            asset: {
              select: {
                id: true, nome: true, ip: true, categoria: true,
                ultimoStatus: true, ultimaLatenciaMs: true, ultimoCheckEm: true,
              },
            },
          },
        },
      },
    });
    if (!m) throw new NotFoundException("Mapa nao encontrado");
    return m;
  }

  async updateMap(orgId: string, id: string, body: any) {
    await this.getMap(orgId, id);
    const data: any = {};
    for (const k of ["nome","tipo","unidadeId","backgroundUrl","centroLat","centroLng","zoom"]) if (body[k] !== undefined) data[k] = body[k];
    return this.db.monMap.update({ where: { id }, data });
  }

  async upsertPositions(orgId: string, mapId: string, positions: any[]) {
    await this.getMap(orgId, mapId);
    // Limpa e recria (operacao curta, simples e idempotente).
    await this.db.$transaction([
      this.db.monMapPosition.deleteMany({ where: { mapId } }),
      ...positions.map((p: any) => this.db.monMapPosition.create({
        data: {
          id: crypto.randomUUID(),
          mapId,
          assetId: p.assetId,
          x: Number(p.x) || 0,
          y: Number(p.y) || 0,
          z: p.z != null ? Number(p.z) : 0,
          width:  p.width != null ? Number(p.width) : 40,
          height: p.height != null ? Number(p.height) : 40,
          rotulo: p.rotulo || null,
        } as any,
      })),
    ]);
    return { ok: true, total: positions.length };
  }

  async deleteMap(orgId: string, id: string) {
    await this.getMap(orgId, id);
    await this.db.monMap.delete({ where: { id } });
    return { ok: true };
  }

  // ── Unidades ─────────────────────────────────────────────────────────────
  async listUnidades(orgId: string) {
    return this.db.monUnidade.findMany({ where: { organizationId: orgId }, orderBy: { nome: "asc" } });
  }
  async createUnidade(orgId: string, body: any) {
    if (!body.nome) throw new BadRequestException("Nome obrigatorio");
    return this.db.monUnidade.create({
      data: {
        id: crypto.randomUUID(),
        organizationId: orgId,
        nome: String(body.nome).trim(),
        tipo: body.tipo || null,
        latitude: body.latitude != null ? Number(body.latitude) : null,
        longitude: body.longitude != null ? Number(body.longitude) : null,
      } as any,
    });
  }

  // ── Alertas (preparacao — dispatch desligado) ────────────────────────────
  async listAlertChannels(orgId: string) {
    return this.db.monAlertChannel.findMany({ where: { organizationId: orgId }, orderBy: { criadoEm: "desc" } });
  }
  async createAlertChannel(orgId: string, body: any) {
    if (!body.tipo || !["EMAIL","WHATSAPP","TELEGRAM","PUSH"].includes(body.tipo)) throw new BadRequestException("Tipo invalido");
    if (!body.nome) throw new BadRequestException("Nome obrigatorio");
    return this.db.monAlertChannel.create({
      data: {
        id: crypto.randomUUID(),
        organizationId: orgId,
        tipo: body.tipo,
        nome: String(body.nome).trim(),
        configJson: body.configJson || {},
        ativo: false, // sempre OFF por enquanto
      } as any,
    });
  }
  async listAlertRules(orgId: string) {
    return this.db.monAlertRule.findMany({ where: { organizationId: orgId }, orderBy: { criadoEm: "desc" } });
  }
  async createAlertRule(orgId: string, body: any) {
    if (!body.nome) throw new BadRequestException("Nome obrigatorio");
    if (!body.severidade || !["INFO","ATENCAO","CRITICO"].includes(body.severidade)) throw new BadRequestException("Severidade invalida");
    return this.db.monAlertRule.create({
      data: {
        id: crypto.randomUUID(),
        organizationId: orgId,
        nome: String(body.nome).trim(),
        condicaoJson: body.condicaoJson || {},
        channelIds: Array.isArray(body.channelIds) ? body.channelIds : [],
        severidade: body.severidade,
        ativo: false,
      } as any,
    });
  }
}

// ── Controllers (tudo em /api/monitoramento) ────────────────────────────────
@Controller("monitoramento")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class MonitoramentoController {
  constructor(private readonly svc: MonitoramentoService) {}

  private org(req: any) {
    const orgId = req?.user?.organizationId;
    if (!orgId) throw new BadRequestException("Organizacao nao identificada");
    return orgId;
  }

  // Assets
  @Get("assets")   @Permissions("monitoramento:ver")
  listAssets(@Req() req: any, @Query() q: any) { return this.svc.listAssets(this.org(req), q); }
  @Get("assets/:id") @Permissions("monitoramento:ver")
  getAsset(@Req() req: any, @Param("id") id: string) { return this.svc.getAsset(this.org(req), id); }
  @Post("assets")  @Permissions("monitoramento:gerenciar")
  createAsset(@Req() req: any, @Body() body: any) { return this.svc.createAsset(this.org(req), body); }
  @Patch("assets/:id") @Permissions("monitoramento:gerenciar")
  updateAsset(@Req() req: any, @Param("id") id: string, @Body() body: any) { return this.svc.updateAsset(this.org(req), id, body); }
  @Delete("assets/:id") @Permissions("monitoramento:gerenciar")
  delAsset(@Req() req: any, @Param("id") id: string) { return this.svc.deleteAsset(this.org(req), id); }
  @Post("assets/bulk") @Permissions("monitoramento:gerenciar")
  bulkAction(@Req() req: any, @Body() b: any) { return this.svc.bulkAction(this.org(req), b.ids || [], b.acao, b.valor); }
  @Post("assets/import") @Permissions("monitoramento:gerenciar")
  importAssets(@Req() req: any, @Body() b: any) { return this.svc.importAssets(this.org(req), b.linhas || []); }

  // Coleta profunda (serviços + hardware do Zabbix)
  @Get("assets/:id/deep") @Permissions("monitoramento:ver")
  assetDeep(@Req() req: any, @Param("id") id: string) { return this.svc.assetDeep(this.org(req), id); }
  @Get("assets/:id/metric-history") @Permissions("monitoramento:ver")
  metricHist(@Req() req: any, @Param("id") id: string, @Query("chave") chave: string, @Query("horas") h: any) {
    const horas = Math.max(1, Math.min(168, Number(h) || 24));
    return this.svc.metricHistory(this.org(req), id, chave === "mem" ? "mem" : "cpu", horas);
  }
  @Get("deep/overview")    @Permissions("monitoramento:ver") deepOverview(@Req() req: any) { return this.svc.deepOverview(this.org(req)); }
  @Get("services")         @Permissions("monitoramento:ver") listServices(@Req() req: any, @Query() q: any) { return this.svc.listServices(this.org(req), q); }
  @Get("services/summary") @Permissions("monitoramento:ver") servicesSummary(@Req() req: any) { return this.svc.servicesSummary(this.org(req)); }
  @Patch("services/:id")   @Permissions("monitoramento:gerenciar") updateService(@Req() req: any, @Param("id") id: string, @Body() b: any) { return this.svc.updateService(this.org(req), id, b); }

  // Dashboard
  @Get("dashboard/summary")       @Permissions("monitoramento:ver") summary(@Req() req: any) { return this.svc.dashboardSummary(this.org(req)); }
  @Get("dashboard/por-categoria") @Permissions("monitoramento:ver") porCat (@Req() req: any) { return this.svc.dashboardPorCategoria(this.org(req)); }
  @Get("dashboard/incidentes")    @Permissions("monitoramento:ver") incidentes(@Req() req: any) { return this.svc.incidentes(this.org(req)); }
  @Get("dashboard/top-offline")   @Permissions("monitoramento:ver") topOff (@Req() req: any) { return this.svc.topOffline(this.org(req)); }
  @Get("dashboard/top-latencia")  @Permissions("monitoramento:ver") topLat (@Req() req: any) { return this.svc.topLatencia(this.org(req)); }
  @Get("dashboard/sla")           @Permissions("monitoramento:ver")
  sla(@Req() req: any, @Query("periodo") periodo: any) {
    const p = ["24h","7d","30d"].includes(periodo) ? periodo : "24h";
    return this.svc.sla(this.org(req), p);
  }

  // Events
  @Get("events") @Permissions("monitoramento:ver")
  listEvents(@Req() req: any, @Query() q: any) { return this.svc.listEvents(this.org(req), q); }
  @Post("events/:id/ack") @Permissions("monitoramento:ver")
  ackEvent(@Req() req: any, @Param("id") id: string) { return this.svc.ackEvent(this.org(req), id, req.user.id); }
  @Get("sla/metas") @Permissions("monitoramento:ver")
  listSlaMetas(@Req() req: any) { return this.svc.listSlaMetas(this.org(req)); }
  @Put("sla/metas") @Permissions("monitoramento:gerenciar")
  setSlaMeta(@Req() req: any, @Body() b: any) { return this.svc.setSlaMeta(this.org(req), b.categoria, b.metaPct); }
  @Get("events/:assetId/historico") @Permissions("monitoramento:ver")
  hist(@Req() req: any, @Param("assetId") aid: string, @Query("horas") h: any) {
    const horas = Math.max(1, Math.min(720, Number(h) || 24));
    return this.svc.historicoAsset(this.org(req), aid, horas);
  }

  // Mapas
  @Get("mapas")           @Permissions("monitoramento:ver")        listMapas(@Req() req: any) { return this.svc.listMapas(this.org(req)); }
  @Post("mapas")          @Permissions("monitoramento:gerenciar")  createMap(@Req() req: any, @Body() b: any) { return this.svc.createMap(this.org(req), b); }
  @Get("mapas/:id")       @Permissions("monitoramento:ver")        getMap(@Req() req: any, @Param("id") id: string) { return this.svc.getMap(this.org(req), id); }
  @Patch("mapas/:id")     @Permissions("monitoramento:gerenciar")  updateMap(@Req() req: any, @Param("id") id: string, @Body() b: any) { return this.svc.updateMap(this.org(req), id, b); }
  @Put("mapas/:id/positions") @Permissions("monitoramento:gerenciar")
  upsertPos(@Req() req: any, @Param("id") id: string, @Body() b: any) { return this.svc.upsertPositions(this.org(req), id, b.positions || []); }
  @Delete("mapas/:id")    @Permissions("monitoramento:gerenciar")  delMap(@Req() req: any, @Param("id") id: string) { return this.svc.deleteMap(this.org(req), id); }

  // Unidades
  @Get("unidades")  @Permissions("monitoramento:ver")       listUni(@Req() req: any) { return this.svc.listUnidades(this.org(req)); }
  @Post("unidades") @Permissions("monitoramento:gerenciar") createUni(@Req() req: any, @Body() b: any) { return this.svc.createUnidade(this.org(req), b); }

  // Alertas (preparacao — apenas CRUD, dispatch nao implementado)
  @Get("alerts/channels")  @Permissions("monitoramento:ver")       listCh(@Req() req: any) { return this.svc.listAlertChannels(this.org(req)); }
  @Post("alerts/channels") @Permissions("monitoramento:gerenciar") createCh(@Req() req: any, @Body() b: any) { return this.svc.createAlertChannel(this.org(req), b); }
  @Get("alerts/rules")     @Permissions("monitoramento:ver")       listRu(@Req() req: any) { return this.svc.listAlertRules(this.org(req)); }
  @Post("alerts/rules")    @Permissions("monitoramento:gerenciar") createRu(@Req() req: any, @Body() b: any) { return this.svc.createAlertRule(this.org(req), b); }
}

// ── Module ───────────────────────────────────────────────────────────────────
@Module({
  imports: [
    JwtModule.register({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: "1h" } }),
  ],
  controllers: [MonitoramentoController],
  providers: [MonitoramentoService, MonitoramentoGateway],
  exports: [MonitoramentoService, MonitoramentoGateway],
})
export class MonitoramentoModule {}
