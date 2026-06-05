"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────
type AtivoStatus = {
  id: string; codigo: string; nome: string; ip: string | null;
  online: boolean | null; ultimoPing: string | null; latenciaMs: number | null;
  uptime24h: number | null; status: string;
  categoria?: { nome: string; cor: string; icone: string; };
  setor?: { nome: string; };
};
type Stats = { todos: number; monitorados: number; online: number; offline: number; semIp: number; };
type PingLog = { id: string; online: boolean; latenciaMs: number | null; erro: string | null; criadoEm: string; };

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtAgo = (d: string | null) => {
  if (!d) return "Nunca";
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 60000)  return `${Math.round(diff / 1000)}s atrás`;
  if (diff < 3600000) return `${Math.round(diff / 60000)}m atrás`;
  return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

const statusDot = (online: boolean | null, ip: string | null) => {
  if (!ip)             return { color: "var(--text-muted)",  label: "Sem IP",   pulse: false };
  if (online === null) return { color: "#94a3b8",            label: "Aguardando", pulse: false };
  if (online)          return { color: "var(--accent-green)", label: "Online",  pulse: true };
  return               { color: "var(--accent-red)",          label: "Offline", pulse: false };
};

const uptimeColor = (u: number | null) => {
  if (u === null) return "var(--text-muted)";
  if (u >= 99)   return "var(--accent-green)";
  if (u >= 90)   return "var(--accent-yellow, #f59e0b)";
  return "var(--accent-red)";
};

// ── PingHistoryBar ────────────────────────────────────────────────────────────
function PingHistoryBar({ ativoId }: { ativoId: string }) {
  const [logs,    setLogs]    = useState<PingLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/ativos/monitoramento/historico/${ativoId}`, { params: { limit: 48 } })
      .then(r => setLogs(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ativoId]);

  if (loading) return <div style={{ height: 20, background: "var(--bg-hover)", borderRadius: 4 }} />;
  if (!logs.length) return <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Sem histórico</span>;

  const recent = [...logs].reverse().slice(-48);

  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center", height: 20 }}>
      {recent.map((l, i) => (
        <div
          key={l.id}
          title={`${new Date(l.criadoEm).toLocaleString("pt-BR")} — ${l.online ? `${l.latenciaMs}ms` : (l.erro || "Offline")}`}
          style={{
            flex: 1, height: l.online ? Math.min(20, 8 + (l.latenciaMs || 0) / 20) : 20,
            minHeight: 8,
            background: l.online ? "var(--accent-green)" : "var(--accent-red)",
            borderRadius: 2, opacity: 0.7 + (i / recent.length) * 0.3,
          }}
        />
      ))}
    </div>
  );
}

// ── AtivoCard ─────────────────────────────────────────────────────────────────
function AtivoCard({ ativo, onDetail }: { ativo: AtivoStatus; onDetail: () => void }) {
  const dot = statusDot(ativo.online, ativo.ip);

  return (
    <div className="card" style={{
      padding: "16px 18px",
      borderLeft: `3px solid ${dot.color}`,
      cursor: "pointer",
      transition: "opacity 0.2s",
    }} onClick={onDetail}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ position: "relative", width: 10, height: 10, flexShrink: 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: dot.color }} />
              {dot.pulse && (
                <div style={{
                  position: "absolute", inset: 0, borderRadius: "50%",
                  background: dot.color, opacity: 0.4,
                  animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
                }} />
              )}
            </div>
            <span style={{ fontSize: 10, color: dot.color, fontFamily: "var(--font-mono)", fontWeight: 700 }}>{dot.label}</span>
            {ativo.latenciaMs != null && ativo.online && (
              <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{ativo.latenciaMs}ms</span>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-display)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {ativo.nome}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            <span style={{ fontFamily: "var(--font-mono)" }}>{ativo.codigo}</span>
            {ativo.ip && <span> · <span style={{ color: "var(--accent-cyan)" }}>{ativo.ip}</span></span>}
            {ativo.setor && <span> · {ativo.setor.nome}</span>}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {ativo.uptime24h !== null && (
            <div style={{ fontSize: 16, fontWeight: 800, color: uptimeColor(ativo.uptime24h), fontFamily: "var(--font-mono)" }}>
              {ativo.uptime24h}%
            </div>
          )}
          <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>uptime 24h</div>
        </div>
      </div>

      <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 8, fontFamily: "var(--font-mono)" }}>
        Último ping: {fmtAgo(ativo.ultimoPing)}
      </div>

      <PingHistoryBar ativoId={ativo.id} />
    </div>
  );
}

// ── AgentSetup ────────────────────────────────────────────────────────────────
function AgentSetup({ apiUrl }: { apiUrl: string }) {
  const [key,       setKey]       = useState<string | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [showKey,   setShowKey]   = useState(false);
  const [copied,    setCopied]    = useState("");

  const gerar = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/ativos/monitoramento/gerar-chave");
      setKey(data.key);
      setShowKey(true);
    } catch {}
    finally { setLoading(false); }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(label); setTimeout(() => setCopied(""), 2000); });
  };

  const installCmd  = `curl -fsSL ${apiUrl.replace("/api", "")}/agent/orkestri-agent.js -o orkestri-agent.js`;
  const runCmd      = key ? `ORKESTRI_URL="${apiUrl}" MONITORING_KEY="${key}" node orkestri-agent.js` : `ORKESTRI_URL="${apiUrl}" MONITORING_KEY="<sua-chave>" node orkestri-agent.js`;

  return (
    <div className="card" style={{ padding: "20px 22px" }}>
      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-display)", marginBottom: 4 }}>
        Configurar Agente de Monitoramento
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
        O agente roda na sua rede interna, faz o ping dos ativos e envia os resultados para o Orkiestri. Não é necessário abrir portas — só precisa de acesso à internet de saída.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Step 1 */}
        <div>
          <div style={{ fontSize: 11, color: "var(--accent-violet)", fontFamily: "var(--font-mono)", fontWeight: 700, marginBottom: 6 }}>PASSO 1 — Gerar chave de autenticação</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn btn-violet" style={{ fontSize: 12 }} onClick={gerar} disabled={loading}>
              {loading ? "Gerando..." : "Gerar nova chave"}
            </button>
            {key && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, background: "var(--bg-hover)", borderRadius: 6, padding: "6px 10px", border: "1px solid var(--border-subtle)" }}>
                <code style={{ fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--accent-green)" }}>
                  {showKey ? key : key.slice(0, 12) + "•".repeat(20)}
                </code>
                <button onClick={() => setShowKey(s => !s)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 11 }}>
                  {showKey ? "Ocultar" : "Mostrar"}
                </button>
                <button onClick={() => copy(key, "key")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent-violet)", fontSize: 11 }}>
                  {copied === "key" ? "✓ Copiado" : "Copiar"}
                </button>
              </div>
            )}
          </div>
          {key && <div style={{ fontSize: 11, color: "var(--accent-amber, #f59e0b)", marginTop: 6 }}>⚠ Salve essa chave agora. Ao gerar uma nova, a anterior para de funcionar.</div>}
        </div>

        {/* Step 2 */}
        <div>
          <div style={{ fontSize: 11, color: "var(--accent-violet)", fontFamily: "var(--font-mono)", fontWeight: 700, marginBottom: 6 }}>PASSO 2 — Instalar Node.js na máquina da sua rede</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            O agente requer <strong>Node.js 18+</strong>. Baixe em <span style={{ color: "var(--accent-cyan)" }}>nodejs.org</span> ou use: <code style={{ fontSize: 11, background: "var(--bg-hover)", padding: "2px 6px", borderRadius: 3 }}>sudo apt install nodejs</code>
          </div>
        </div>

        {/* Step 3 */}
        <div>
          <div style={{ fontSize: 11, color: "var(--accent-violet)", fontFamily: "var(--font-mono)", fontWeight: 700, marginBottom: 6 }}>PASSO 3 — Baixar e rodar o agente</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 6, padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 12, position: "relative" }}>
              <div style={{ color: "var(--text-muted)", fontSize: 10, marginBottom: 4 }}>BAIXAR AGENTE</div>
              <code style={{ color: "var(--accent-cyan)" }}>{installCmd}</code>
              <button onClick={() => copy(installCmd, "install")} style={{ position: "absolute", top: 8, right: 10, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 11 }}>
                {copied === "install" ? "✓" : "Copiar"}
              </button>
            </div>
            <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 6, padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 12, position: "relative" }}>
              <div style={{ color: "var(--text-muted)", fontSize: 10, marginBottom: 4 }}>EXECUTAR</div>
              <code style={{ color: "var(--accent-green)" }}>{runCmd}</code>
              <button onClick={() => copy(runCmd, "run")} style={{ position: "absolute", top: 8, right: 10, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 11 }}>
                {copied === "run" ? "✓" : "Copiar"}
              </button>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
            Para rodar em segundo plano: <code style={{ fontSize: 10, background: "var(--bg-hover)", padding: "1px 5px", borderRadius: 3 }}>nohup node orkestri-agent.js &</code> ou use PM2/systemd.
          </div>
        </div>

        {/* Step 4 */}
        <div>
          <div style={{ fontSize: 11, color: "var(--accent-violet)", fontFamily: "var(--font-mono)", fontWeight: 700, marginBottom: 6 }}>PASSO 4 — Cadastrar IPs nos ativos</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Volte para a lista de ativos, edite cada ativo que deseja monitorar, preencha o campo <strong>Endereço IP</strong> e ative a chave <strong>Monitorar</strong>. O agente começará a pingar automaticamente.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AtivoDetail ───────────────────────────────────────────────────────────────
function AtivoDetail({ ativo, onClose }: { ativo: AtivoStatus; onClose: () => void }) {
  const [logs,    setLogs]    = useState<PingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const dot = statusDot(ativo.online, ativo.ip);

  useEffect(() => {
    api.get(`/ativos/monitoramento/historico/${ativo.id}`, { params: { limit: 48 } })
      .then(r => setLogs(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ativo.id]);

  const recent  = [...logs].reverse();
  const avgLat  = recent.filter(l => l.online && l.latenciaMs).reduce((s, l, _, a) => s + (l.latenciaMs! / a.length), 0);
  const maxLat  = Math.max(...recent.filter(l => l.latenciaMs).map(l => l.latenciaMs!));

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={onClose}>← Voltar</button>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)" }}>{ativo.nome}</h2>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {ativo.codigo}{ativo.ip && ` · ${ativo.ip}`}
          </div>
        </div>
        <span style={{ marginLeft: "auto", fontSize: 12, color: dot.color, fontWeight: 700 }}>{dot.label}</span>
      </div>

      {/* Métricas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Status",       value: dot.label,                              color: dot.color },
          { label: "Latência",     value: ativo.latenciaMs ? `${ativo.latenciaMs}ms` : "—", color: "var(--accent-cyan)" },
          { label: "Uptime 24h",   value: ativo.uptime24h !== null ? `${ativo.uptime24h}%` : "—", color: uptimeColor(ativo.uptime24h) },
          { label: "Último ping",  value: fmtAgo(ativo.ultimoPing),              color: "var(--text-secondary)" },
        ].map(m => (
          <div key={m.label} className="card" style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: m.color, fontFamily: "var(--font-mono)" }}>{m.value}</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Histograma de latência */}
      {!loading && recent.length > 0 && (
        <div className="card" style={{ padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600, marginBottom: 12 }}>
            HISTÓRICO — ÚLTIMAS {recent.length} MEDIÇÕES
            {avgLat > 0 && <span style={{ marginLeft: 12, color: "var(--accent-cyan)" }}>méd {Math.round(avgLat)}ms / max {maxLat}ms</span>}
          </div>
          <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 60 }}>
            {recent.slice(-60).map((l, i) => {
              const h = l.online ? Math.max(4, Math.min(60, (l.latenciaMs || 5) * 0.8)) : 60;
              return (
                <div
                  key={l.id}
                  title={`${new Date(l.criadoEm).toLocaleString("pt-BR")} · ${l.online ? `${l.latenciaMs}ms` : "Offline"}`}
                  style={{
                    flex: 1, height: h,
                    background: l.online ? "var(--accent-cyan)" : "var(--accent-red)",
                    borderRadius: "2px 2px 0 0",
                    opacity: 0.5 + (i / 60) * 0.5,
                  }}
                />
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 4 }}>
            <span>{recent.length > 0 ? new Date(recent[0].criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
            <span>agora</span>
          </div>
        </div>
      )}

      {/* Log table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>LOG DE PINGS</div>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Carregando...</div>
        ) : recent.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>Nenhum ping registrado ainda</div>
        ) : recent.slice(0, 20).map((l, i) => (
          <div key={l.id} style={{ display: "grid", gridTemplateColumns: "140px 70px 80px 1fr", gap: 10, padding: "10px 16px", borderBottom: i < 19 ? "1px solid var(--border-subtle)" : "none", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
              {new Date(l.criadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: l.online ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 700 }}>
              {l.online ? "ONLINE" : "OFFLINE"}
            </span>
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--accent-cyan)" }}>
              {l.latenciaMs != null ? `${l.latenciaMs}ms` : "—"}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {l.erro || ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MonitoramentoPage() {
  const router  = useRouter();
  const { user } = useAuthStore();
  const [data,     setData]     = useState<{ stats: Stats; ativos: AtivoStatus[]; temChave: boolean } | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<"todos" | "online" | "offline" | "sem_ip">("todos");
  const [search,   setSearch]   = useState("");
  const [detail,   setDetail]   = useState<AtivoStatus | null>(null);
  const [showSetup,setShowSetup]= useState(false);
  const [msg,      setMsg]      = useState("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const apiUrl = typeof window !== "undefined" ? `${window.location.origin}/api` : "/api";

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data: d } = await api.get("/ativos/monitoramento");
      setData(d);
    } catch {}
    finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(() => load(true), 30000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  const ativos = data?.ativos ?? [];
  const filtered = ativos.filter(a => {
    if (filter === "online")  return a.online === true;
    if (filter === "offline") return a.online === false;
    if (filter === "sem_ip")  return !a.ip;
    return true;
  }).filter(a => !search || a.nome.toLowerCase().includes(search.toLowerCase()) || (a.ip || "").includes(search) || a.codigo.toLowerCase().includes(search.toLowerCase()));

  if (detail) return (
    <div className="flex flex-col h-full">
      <Topbar>
        <button className="btn btn-ghost text-xs" onClick={() => router.push("/dashboard/ativos")}>← Ativos</button>
      </Topbar>
      <div className="flex-1 overflow-y-auto p-6">
        <AtivoDetail ativo={detail} onClose={() => setDetail(null)} />
      </div>
    </div>
  );

  const s = data?.stats;

  return (
    <div className="flex flex-col h-full">
      <Topbar>
        <button className="btn btn-ghost text-xs" onClick={() => router.push("/dashboard/ativos")}>← Ativos</button>
        <button className="btn btn-ghost text-xs" onClick={() => setShowSetup(s => !s)}>
          {showSetup ? "Fechar configuração" : "⚙ Configurar agente"}
        </button>
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          Auto-refresh 30s
        </span>
      </Topbar>

      <div className="flex-1 overflow-y-auto p-6">
        <div style={{ maxWidth: 900 }}>
          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--font-display)", marginBottom: 4 }}>
              Monitoramento de Ativos
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Status em tempo real dos ativos cadastrados na sua rede.
            </p>
          </div>

          {/* Agent setup */}
          {(showSetup || (data && !data.temChave && ativos.length === 0)) && (
            <div style={{ marginBottom: 24 }}>
              <AgentSetup apiUrl={apiUrl} />
            </div>
          )}

          {/* Stats */}
          {s && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 24 }}>
              {[
                { label: "Monitorados",   value: s.monitorados, color: "var(--accent-violet)" },
                { label: "Online",        value: s.online,      color: "var(--accent-green)" },
                { label: "Offline",       value: s.offline,     color: "var(--accent-red)" },
                { label: "Sem IP",        value: s.semIp,       color: "var(--text-muted)" },
                { label: "Total ativos",  value: s.todos,       color: "var(--accent-cyan)" },
              ].map(stat => (
                <div key={stat.label} className="card" style={{ padding: "14px 16px", borderLeft: `3px solid ${stat.color}` }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: stat.color, fontFamily: "var(--font-mono)" }}>{stat.value}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 0, borderRadius: 6, overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
              {([
                { key: "todos",   label: "Todos" },
                { key: "online",  label: "Online" },
                { key: "offline", label: "Offline" },
                { key: "sem_ip",  label: "Sem IP" },
              ] as const).map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)} style={{
                  padding: "6px 14px", background: filter === f.key ? "var(--accent-violet)" : "transparent",
                  border: "none", cursor: "pointer", fontSize: 12,
                  color: filter === f.key ? "#fff" : "var(--text-muted)",
                  fontWeight: filter === f.key ? 600 : 400,
                }}>
                  {f.label}
                </button>
              ))}
            </div>
            <input
              className="input-o"
              style={{ fontSize: 12, maxWidth: 240 }}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome, IP ou código..."
            />
          </div>

          {/* Grid */}
          {loading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card skeleton" style={{ height: 130 }} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                {ativos.length === 0
                  ? "Nenhum ativo com monitoramento ativo. Edite os ativos e ative a opção Monitorar."
                  : "Nenhum ativo corresponde ao filtro."}
              </p>
              {ativos.length === 0 && (
                <button className="btn btn-violet" style={{ marginTop: 12 }} onClick={() => router.push("/dashboard/ativos")}>
                  Ir para Ativos
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {filtered.map(a => (
                <AtivoCard key={a.id} ativo={a} onDetail={() => setDetail(a)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
