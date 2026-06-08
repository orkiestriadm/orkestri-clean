#!/usr/bin/env node
/**
 * smoke-health.js — verifica que a API subiu sem erros de DI.
 *
 * Como usar:
 *   npm run smoke:health                                # default http://localhost:3000
 *   API_URL=https://orkiestri.com npm run smoke:health  # explícito
 *
 * Sai com código 0 se /health retornou 200, código 1 caso contrário.
 *
 * Esse é o canário que teria detectado o crash de DI da última deploy:
 *   container subia healthy, mas /api/health respondia 502 — invertido.
 *   Rodar isso depois de `docker compose up -d api` aborta deploy quando quebra.
 */

const http = require("http");
const https = require("https");

const URL = process.env.API_URL || "http://localhost:3000";
const PATH = process.env.API_HEALTH_PATH || "/api/health";
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 60_000);
const POLL_INTERVAL = 2_000;

const fullUrl = URL + PATH;
const lib = fullUrl.startsWith("https") ? https : http;

const started = Date.now();

function tryOnce() {
  return new Promise((resolve) => {
    const req = lib.get(fullUrl, { rejectUnauthorized: false }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", (err) => resolve({ status: 0, error: err.message }));
    req.setTimeout(5_000, () => { req.destroy(); resolve({ status: 0, error: "timeout" }); });
  });
}

(async () => {
  console.log(`[smoke] aguardando ${fullUrl} responder 200 (até ${TIMEOUT_MS / 1000}s)...`);
  while (Date.now() - started < TIMEOUT_MS) {
    const r = await tryOnce();
    if (r.status === 200) {
      console.log(`[smoke] ✓ OK em ${Math.round((Date.now() - started) / 1000)}s — ${r.body.slice(0, 200)}`);
      process.exit(0);
    }
    process.stdout.write(`[smoke] tentativa: status=${r.status} ${r.error || ""}\n`);
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
  console.error(`[smoke] ✗ falhou — ${fullUrl} não respondeu 200 em ${TIMEOUT_MS / 1000}s`);
  process.exit(1);
})();
