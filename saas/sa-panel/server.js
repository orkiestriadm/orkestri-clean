const express = require("express");
const cors = require("cors");
const { execSync, exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const { Resend } = require("resend");

const app = express();
const PORT = process.env.PORT || 3001;
const SA_TOKEN = process.env.SA_TOKEN || "change-me-in-production";

const SAAS_DIR = fs.existsSync("/saas") ? "/saas" : path.resolve(__dirname, "..");
const TENANTS_FILE = path.join(SAAS_DIR, "tenants.json");
const PROVISION_SCRIPT = path.join(SAAS_DIR, "provision.sh");
const DEPROVISION_SCRIPT = path.join(SAAS_DIR, "deprovision.sh");
const STATUS_SCRIPT = path.join(SAAS_DIR, "status.sh");
const UPDATE_SCRIPT = path.join(SAAS_DIR, "update-all.sh");
const BACKUP_SCRIPT = path.join(SAAS_DIR, "backup-tenant.sh");

// ── E-mail ──────────────────────────────────────────────────────────────────
const RESEND_API_KEY  = process.env.RESEND_API_KEY || "";
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "Orkiestri";
const EMAIL_FROM_ADDR = process.env.EMAIL_FROM || "noreply@orkiestri.com";
const APP_URL         = process.env.APP_URL || "https://orkiestri.com";
const resend          = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

async function sendTenantWelcomeEmail({ adminEmail, adminNome, slug, nome, domain, adminPass }) {
  if (!resend) { console.warn("[email] RESEND_API_KEY não configurada — e-mail não enviado."); return; }
  const from = `${EMAIL_FROM_NAME} <${EMAIL_FROM_ADDR}>`;
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><style>
  body{margin:0;padding:0;background:#f4f4f8;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e}
  .wrap{max-width:580px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#1e1b4b,#4c1d95);padding:28px 32px;text-align:center}
  .header h1{color:#fff;font-size:22px;font-weight:800;margin:0;letter-spacing:-0.5px}
  .header span{color:#a78bfa;font-size:13px}
  .body{padding:32px}
  .body p{margin:0 0 16px;font-size:14px;line-height:1.65;color:#374151}
  .info-box{background:#f9f7ff;border:1px solid #ede9fe;border-radius:8px;padding:16px 20px;margin:16px 0}
  .info-row{display:flex;gap:8px;margin-bottom:8px;font-size:13px}
  .info-row:last-child{margin-bottom:0}
  .info-label{color:#6b7280;min-width:110px;flex-shrink:0}
  .info-value{color:#1e1b4b;font-weight:600;word-break:break-all}
  .btn{display:inline-block;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:700;font-size:14px;margin:8px 0}
  .warn{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:16px 0;font-size:12px;color:#92400e}
  .footer{background:#f9f7ff;padding:20px 32px;text-align:center;font-size:11px;color:#9ca3af;border-top:1px solid #ede9fe}
</style></head>
<body><div class="wrap">
  <div class="header">
    <h1>Orkiestri</h1>
    <span>Sistema de Gestão — Novo Acesso</span>
  </div>
  <div class="body">
    <p>Olá, <strong>${adminNome || "Administrador"}</strong>! 🎉</p>
    <p>Sua instância do <strong>Orkiestri</strong> para a empresa <strong>${nome}</strong> foi provisionada com sucesso. Você já pode acessar o sistema com as credenciais abaixo.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Empresa:</span><span class="info-value">${nome}</span></div>
      <div class="info-row"><span class="info-label">URL:</span><span class="info-value"><a href="https://${domain}" style="color:#4f46e5">https://${domain}</a></span></div>
      <div class="info-row"><span class="info-label">E-mail:</span><span class="info-value">${adminEmail}</span></div>
      <div class="info-row"><span class="info-label">Senha:</span><span class="info-value">${adminPass}</span></div>
    </div>
    <div class="warn">⚠️ <strong>Guarde estas informações.</strong> Por segurança, troque a senha no primeiro acesso. Esta mensagem não será reenviada.</div>
    <div style="text-align:center;margin:24px 0">
      <a href="https://${domain}/login" class="btn">Acessar o Sistema</a>
    </div>
    <p style="font-size:12px;color:#6b7280">Em caso de dúvidas, entre em contato com o suporte através do e-mail <a href="mailto:${EMAIL_FROM_ADDR}" style="color:#4f46e5">${EMAIL_FROM_ADDR}</a>.</p>
  </div>
  <div class="footer">© ${new Date().getFullYear()} Orkiestri — Todos os direitos reservados.</div>
</div></body></html>`;
  try {
    await resend.emails.send({ from, to: adminEmail, subject: `Acesso criado — ${nome} no Orkiestri`, html });
    console.log(`[email] Boas-vindas enviado para ${adminEmail} (tenant: ${slug})`);
  } catch (e) {
    console.error(`[email] Erro ao enviar para ${adminEmail}: ${e.message}`);
  }
}

const ALLOWED_ORIGINS = process.env.SA_ALLOWED_ORIGINS
  ? process.env.SA_ALLOWED_ORIGINS.split(",").map(s => s.trim())
  : [];

// Custom CORS: allows same-host origin (browser accessing SA Panel directly)
// + any origin in SA_ALLOWED_ORIGINS + requests with no origin (curl/server)
app.use((req, res, next) => {
  const origin = req.headers["origin"];
  const host   = req.headers["host"];

  if (!origin) return next();

  const originHost = origin.replace(/^https?:\/\//, "");
  const allowed =
    ALLOWED_ORIGINS.length === 0 ||
    ALLOWED_ORIGINS.includes(origin) ||
    originHost === host;

  if (!allowed) return res.status(403).json({ error: "CORS not allowed" });

  res.setHeader("Access-Control-Allow-Origin",      origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods",     "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers",     "Content-Type,Authorization");

  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json());

// Static files — served WITHOUT the SA token
app.use(express.static(path.join(__dirname)));

function auth(req, res, next) {
  const header = req.headers["authorization"] || "";
  const token = header.replace("Bearer ", "").trim();
  if (!token || token !== SA_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function readTenants() {
  try {
    return JSON.parse(fs.readFileSync(TENANTS_FILE, "utf8"));
  } catch {
    return { tenants: [] };
  }
}

function writeTenants(data) {
  fs.writeFileSync(TENANTS_FILE, JSON.stringify(data, null, 2));
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,19}$/;

function requireTenant(slug) {
  if (!SLUG_RE.test(slug)) throw { status: 400, error: "Slug inválido" };
  const { tenants } = readTenants();
  const tenant = tenants.find(t => t.slug === slug);
  if (!tenant) throw { status: 404, error: "Tenant not found" };
  return tenant;
}

function execScript(script, args = []) {
  return new Promise((resolve, reject) => {
    const cmd = `bash "${script}" ${args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(" ")}`;
    exec(cmd, { timeout: 300_000 }, (err, stdout, stderr) => {
      if (err) reject({ code: err.code, stdout, stderr });
      else resolve({ stdout, stderr });
    });
  });
}

function getContainerStatus(slug) {
  const services = ["postgres", "redis", "api", "frontend"];
  const status = {};
  for (const svc of services) {
    const name = `ork_${slug}_${svc}`;
    try {
      const state = execSync(`docker inspect --format='{{.State.Status}}' ${name} 2>/dev/null || echo absent`, { encoding: "utf8" }).trim();
      const health = execSync(`docker inspect --format='{{.State.Health.Status}}' ${name} 2>/dev/null || echo ""`, { encoding: "utf8" }).trim();
      status[svc] = health || state;
    } catch {
      status[svc] = "absent";
    }
  }
  return status;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get("/health", (_, res) => res.json({ ok: true }));

app.get("/api/tenants", auth, (req, res) => {
  const { tenants } = readTenants();
  const enriched = tenants.map(t => ({ ...t, containers: getContainerStatus(t.slug) }));
  res.json({ tenants: enriched });
});

app.get("/api/tenants/:slug", auth, (req, res) => {
  try {
    const t = requireTenant(req.params.slug);
    res.json({ ...t, containers: getContainerStatus(t.slug) });
  } catch (e) {
    res.status(e.status || 400).json({ error: e.error || "Error" });
  }
});

app.post("/api/tenants", auth, async (req, res) => {
  const { slug, nome, adminEmail, adminNome, cnpj, telefone, website, plano, observacoes } = req.body;

  if (!slug || !nome || !adminEmail) {
    return res.status(400).json({ error: "slug, nome e adminEmail são obrigatórios" });
  }
  if (!/^[a-z0-9][a-z0-9-]{0,19}$/.test(slug)) {
    return res.status(400).json({ error: "Slug inválido" });
  }

  try {
    const args = [slug, nome, adminEmail];
    if (adminNome) args.push(adminNome);
    const result = await execScript(PROVISION_SCRIPT, args);

    const passMatch = result.stdout.match(/Admin Senha:\s+(\S+)/);
    const adminPass = passMatch ? passMatch[1] : null;

    // Enriquece o registro com campos adicionais
    let domain = `${slug}.orkiestri.com`;
    try {
      const data = readTenants();
      const idx = data.tenants.findIndex(t => t.slug === slug);
      const extra = { cnpj, telefone, website, plano: plano || "profissional", observacoes };
      if (idx >= 0) {
        data.tenants[idx] = { ...data.tenants[idx], ...extra };
        domain = data.tenants[idx].domain || domain;
      } else {
        data.tenants.push({
          slug, nome, domain,
          adminEmail, provisionedAt: new Date().toISOString(), ...extra,
        });
      }
      writeTenants(data);
    } catch {}

    // Envia e-mail com credenciais ao administrador do tenant
    if (adminPass) {
      sendTenantWelcomeEmail({ adminEmail, adminNome, slug, nome, domain, adminPass }).catch(() => {});
    }

    res.json({ ok: true, adminPass, output: result.stdout });
  } catch (err) {
    res.status(500).json({ error: "Provisioning failed", detail: err.stderr || err.stdout });
  }
});

app.delete("/api/tenants/:slug", auth, async (req, res) => {
  try {
    const { slug } = requireTenant(req.params.slug);
    const result = await execScript(DEPROVISION_SCRIPT, [slug, "--force"]);
    res.json({ ok: true, output: result.stdout });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.error });
    res.status(500).json({ error: "Deprovisioning failed", detail: err.stderr || err.stdout });
  }
});

app.post("/api/tenants/:slug/backup", auth, async (req, res) => {
  try {
    const { slug } = requireTenant(req.params.slug);
    const result = await execScript(BACKUP_SCRIPT, [slug]);
    res.json({ ok: true, output: result.stdout });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.error });
    res.status(500).json({ error: "Backup failed", detail: err.stderr || err.stdout });
  }
});

app.post("/api/update-all", auth, async (req, res) => {
  try {
    const result = await execScript(UPDATE_SCRIPT);
    res.json({ ok: true, output: result.stdout });
  } catch (err) {
    res.status(500).json({ error: "Update failed", detail: err.stderr || err.stdout });
  }
});

app.patch("/api/tenants/:slug", auth, (req, res) => {
  try {
    requireTenant(req.params.slug);
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.error || "Error" });
  }
  const data = readTenants();
  const idx = data.tenants.findIndex(t => t.slug === req.params.slug);
  const allowed = ["nome", "cnpj", "telefone", "website", "plano", "observacoes"];
  allowed.forEach(k => { if (req.body[k] !== undefined) data.tenants[idx][k] = req.body[k]; });
  writeTenants(data);
  res.json({ ok: true, tenant: data.tenants[idx] });
});

app.post("/api/tenants/:slug/restart", auth, async (req, res) => {
  let slug;
  try {
    ({ slug } = requireTenant(req.params.slug));
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.error || "Error" });
  }
  try {
    const output = execSync(
      `docker restart ork_${slug}_api ork_${slug}_frontend 2>&1 || true`,
      { encoding: "utf8", timeout: 60_000 }
    );
    res.json({ ok: true, output: output.trim() });
  } catch (err) {
    res.status(500).json({ error: "Restart failed", detail: err.message });
  }
});

const VALID_SERVICES = new Set(["postgres", "redis", "api", "frontend"]);

app.get("/api/tenants/:slug/logs/:service", auth, (req, res) => {
  const { service } = req.params;
  if (!VALID_SERVICES.has(service)) return res.status(400).json({ error: "Invalid service" });
  let slug;
  try {
    ({ slug } = requireTenant(req.params.slug));
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.error || "Error" });
  }
  try {
    const logs = execSync(`docker logs --tail 100 ork_${slug}_${service} 2>&1`, { encoding: "utf8" });
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: "Failed to get logs", detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Orkestri SA Panel rodando na porta ${PORT}`);
  console.log(`Token SA: ${SA_TOKEN === "change-me-in-production" ? "[PADRÃO — TROQUE EM PRODUÇÃO]" : "[configurado]"}`);
});
