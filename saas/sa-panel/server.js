const express = require("express");
const cors = require("cors");
const { execSync, exec } = require("child_process");
const fs = require("fs");
const path = require("path");

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

const ALLOWED_ORIGINS = process.env.SA_ALLOWED_ORIGINS
  ? process.env.SA_ALLOWED_ORIGINS.split(",").map(s => s.trim())
  : [];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, server-to-server)
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error("CORS not allowed"));
  },
  credentials: true,
}));
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
    try {
      const data = readTenants();
      const idx = data.tenants.findIndex(t => t.slug === slug);
      const extra = { cnpj, telefone, website, plano: plano || "profissional", observacoes };
      if (idx >= 0) {
        data.tenants[idx] = { ...data.tenants[idx], ...extra };
      } else {
        // Fallback: cria entrada se provision.sh não criou
        data.tenants.push({
          slug, nome, domain: `${slug}.orkestri.com.br`,
          adminEmail, provisionedAt: new Date().toISOString(), ...extra,
        });
      }
      writeTenants(data);
    } catch {}

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
