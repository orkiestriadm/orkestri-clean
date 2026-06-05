#!/usr/bin/env node
/**
 * Orkiestri — Agente de Monitoramento de Ativos
 *
 * Roda na sua rede interna, pinga os ativos cadastrados e envia
 * os resultados para o Orkiestri em nuvem.
 *
 * Requer: Node.js 18+ (sem dependências externas)
 *
 * Uso:
 *   ORKESTRI_URL=https://orkiestri.com/api \
 *   MONITORING_KEY=mkey_... \
 *   node orkestri-agent.js
 *
 * Opções via variável de ambiente:
 *   ORKESTRI_URL     URL base da API do Orkiestri (obrigatório)
 *   MONITORING_KEY   Chave gerada em Ativos > Monitoramento (obrigatório)
 *   INTERVAL         Intervalo entre ciclos em segundos (padrão: 60)
 *   TIMEOUT          Timeout do ping em ms (padrão: 3000)
 *   CONCURRENCY      Pings simultâneos (padrão: 10)
 *   LOG_LEVEL        "quiet" | "normal" | "verbose" (padrão: normal)
 */

"use strict";

const { execFile }   = require("child_process");
const { promisify }  = require("util");
const https          = require("https");
const http           = require("http");

const execFileAsync = promisify(execFile);

// ── Config ────────────────────────────────────────────────────────────────────
const CONFIG = {
  apiUrl:      (process.env.ORKESTRI_URL || "").replace(/\/$/, ""),
  key:         process.env.MONITORING_KEY || "",
  interval:    parseInt(process.env.INTERVAL   || "60") * 1000,
  timeout:     parseInt(process.env.TIMEOUT    || "3000"),
  concurrency: parseInt(process.env.CONCURRENCY || "10"),
  logLevel:    process.env.LOG_LEVEL || "normal",
};

if (!CONFIG.apiUrl || !CONFIG.key) {
  console.error("ERRO: ORKESTRI_URL e MONITORING_KEY são obrigatórios.");
  console.error("Exemplo: ORKESTRI_URL=https://orkiestri.com/api MONITORING_KEY=mkey_... node orkestri-agent.js");
  process.exit(1);
}

// ── Logger ────────────────────────────────────────────────────────────────────
const log = {
  info:    (...a) => CONFIG.logLevel !== "quiet"   && console.log(  `[${ts()}] INFO `, ...a),
  ok:      (...a) => CONFIG.logLevel !== "quiet"   && console.log(  `[${ts()}] OK   `, ...a),
  warn:    (...a) =>                                   console.warn( `[${ts()}] WARN `, ...a),
  error:   (...a) =>                                   console.error(`[${ts()}] ERROR`, ...a),
  verbose: (...a) => CONFIG.logLevel === "verbose" && console.log(  `[${ts()}] DBG  `, ...a),
};
const ts = () => new Date().toLocaleTimeString("pt-BR");

// ── HTTP helper ───────────────────────────────────────────────────────────────
function request(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u       = new URL(url);
    const isHttps = u.protocol === "https:";
    const lib     = isHttps ? https : http;
    const data    = body ? JSON.stringify(body) : null;

    const req = lib.request({
      hostname: u.hostname,
      port:     u.port || (isHttps ? 443 : 80),
      path:     u.pathname + u.search,
      method,
      headers: {
        "Content-Type":      "application/json",
        "x-monitoring-key":  CONFIG.key,
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        ...headers,
      },
    }, res => {
      let raw = "";
      res.on("data", c => raw += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });

    req.on("error", reject);
    req.setTimeout(10000, () => { req.destroy(new Error("Request timeout")); });
    if (data) req.write(data);
    req.end();
  });
}

// ── Ping ──────────────────────────────────────────────────────────────────────
async function pingHost(ip) {
  const isWin   = process.platform === "win32";
  const isMac   = process.platform === "darwin";
  const timeoutS = Math.ceil(CONFIG.timeout / 1000);

  const [cmd, args] = isWin
    ? ["ping", ["-n", "1", "-w", String(CONFIG.timeout), ip]]
    : isMac
      ? ["ping", ["-c", "1", "-W", String(timeoutS * 1000), ip]]
      : ["ping", ["-c", "1", "-W", String(timeoutS), ip]];

  const started = Date.now();
  try {
    const { stdout } = await execFileAsync(cmd, args, { timeout: CONFIG.timeout + 2000 });
    const elapsed = Date.now() - started;

    // Parse latency from output
    let latenciaMs = elapsed;
    const winMatch  = stdout.match(/[Tt]empo[=<](\d+)ms/);
    const unixMatch = stdout.match(/time[=<](\d+\.?\d*)\s*ms/i);
    if (winMatch)  latenciaMs = parseInt(winMatch[1]);
    if (unixMatch) latenciaMs = Math.round(parseFloat(unixMatch[1]));

    return { online: true, latenciaMs };
  } catch {
    return { online: false, latenciaMs: null, erro: "Timeout ou host inacessível" };
  }
}

// ── Concurrency pool ──────────────────────────────────────────────────────────
async function pool(tasks, concurrency) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

// ── Main cycle ────────────────────────────────────────────────────────────────
async function ciclo() {
  log.info("Buscando ativos para monitorar...");

  let ativos;
  try {
    const res = await request("GET", `${CONFIG.apiUrl}/ativos/monitoramento/agent/assets`);
    if (res.status === 401) { log.error("Chave de monitoramento inválida. Verifique MONITORING_KEY."); return; }
    if (res.status !== 200) { log.error("Erro ao buscar ativos:", res.status, res.body); return; }
    ativos = res.body.ativos || [];
  } catch (e) {
    log.error("Erro de conexão com a API:", e.message);
    return;
  }

  if (!ativos.length) {
    log.info("Nenhum ativo com IP configurado para monitorar.");
    return;
  }

  log.info(`Pingando ${ativos.length} ativo(s)...`);

  const tasks     = ativos.map(a => async () => {
    const result = await pingHost(a.ip);
    const status = result.online ? `✓ ${result.latenciaMs}ms` : "✗ offline";
    log.verbose(`  ${a.nome} (${a.ip}): ${status}`);
    return { ativoId: a.id, ...result };
  });

  const resultados = await pool(tasks, CONFIG.concurrency);

  const online  = resultados.filter(r => r.online).length;
  const offline = resultados.filter(r => !r.online).length;
  log.ok(`Ping concluído: ${online} online, ${offline} offline`);

  try {
    const res = await request("POST", `${CONFIG.apiUrl}/ativos/monitoramento/agent/report`, { resultados });
    if (res.status !== 200 && res.status !== 201) {
      log.warn("Erro ao enviar resultados:", res.status, res.body);
    } else {
      log.info(`Resultados enviados: ${res.body.processados}/${resultados.length} processados`);
    }
  } catch (e) {
    log.error("Erro ao enviar resultados:", e.message);
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   Orkiestri — Agente de Monitoramento        ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`  API:       ${CONFIG.apiUrl}`);
  console.log(`  Intervalo: ${CONFIG.interval / 1000}s`);
  console.log(`  Timeout:   ${CONFIG.timeout}ms`);
  console.log(`  Paralelo:  ${CONFIG.concurrency} pings simultâneos`);
  console.log("");

  // Roda imediatamente e depois em loop
  await ciclo();
  setInterval(ciclo, CONFIG.interval);
}

main().catch(e => { console.error("Falha fatal:", e); process.exit(1); });
