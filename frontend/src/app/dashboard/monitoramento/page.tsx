"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import { connectMonitoringSocket, disconnectMonitoringSocket, type ProbeTick, type StatusChange } from "@/lib/monitoringSocket";
import {
  Activity, AlertTriangle, CheckCircle2, CircleSlash, Radio, ChevronDown, ChevronRight,
  MapPin, Tv2, BarChart3, Search, X, Filter, Zap, Cpu, Camera, Server, Building, Network,
  ExternalLink, FolderClock,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────────
// Types & constants
// ──────────────────────────────────────────────────────────────────────────────
type Status = "ONLINE" | "OFFLINE" | "INSTAVEL" | "NAO_MONITORADO";
type Asset = {
  id: string; nome: string; ip: string; hostname?: string; categoria: string; tipo: string;
  link?: string | null;
  ultimoStatus: Status; ultimaLatenciaMs: number | null; ultimoCheckEm: string | null;
  unidade?: { id: string; nome: string };
  supressedByDep?: boolean; latenciaAnomala?: boolean; latenciaBaseMs?: number | null;
  dependeDe?: { id: string; nome: string; ultimoStatus: string } | null;
};

function normalizeLink(s: string): string {
  const t = s.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return "http://" + t;
}
// Deriva a URL da IMAGEM (snapshot) a partir do link da camera.
// Se o link ja aponta pra um endpoint de imagem, usa direto; senao tenta o caminho padrao.
function snapshotUrl(link: string): string {
  const base = normalizeLink(link).replace(/\/+$/, "");
  if (/(snapshot|\.cgi|\.jpe?g|\.mjpe?g)/i.test(base)) return base;
  return base + "/cgi-bin/snapshot.cgi";
}
type Summary = { total: number; monitorados: number; online: number; offline: number; instavel: number; naoMon: number; disponPct: number };

const STATUS: Record<Status, { dot: string; bg: string; fg: string; label: string; ring: string }> = {
  ONLINE:         { dot: "#22c55e", bg: "rgba(34,197,94,0.10)",  fg: "#16a34a", label: "Online",         ring: "rgba(34,197,94,0.30)"  },
  OFFLINE:        { dot: "#ef4444", bg: "rgba(239,68,68,0.10)",  fg: "#dc2626", label: "Offline",        ring: "rgba(239,68,68,0.30)"  },
  INSTAVEL:       { dot: "#f59e0b", bg: "rgba(245,158,11,0.10)", fg: "#b45309", label: "Instável",       ring: "rgba(245,158,11,0.30)" },
  NAO_MONITORADO: { dot: "#94a3b8", bg: "rgba(148,163,184,0.10)",fg: "#64748b", label: "Não monitorado", ring: "rgba(148,163,184,0.25)"},
};

const CATEGORIAS = [
  { v: "ITS",            label: "ITS",            icon: Camera,   tag: "Câmeras, PMV, radar" },
  { v: "SERVIDORES",     label: "Servidores",     icon: Server,   tag: "Físicos, virtuais, storage" },
  { v: "COMPUTADORES",   label: "Computadores",   icon: Cpu,      tag: "Desktops, notebooks" },
  { v: "PRACAS",         label: "Praças",         icon: Building, tag: "Pedágio, cabines" },
  { v: "INFRAESTRUTURA", label: "Infraestrutura", icon: Network,  tag: "Switches, roteadores, nobreak" },
] as const;

const fmtAgo = (s: string | null) => {
  if (!s) return "—";
  const diff = Date.now() - new Date(s).getTime();
  if (diff < 60_000)    return `${Math.round(diff/1000)}s`;
  if (diff < 3_600_000) return `${Math.round(diff/60_000)}m`;
  return `${Math.round(diff/3_600_000)}h`;
};

const latencyColor = (ms: number | null) => {
  if (ms == null) return "var(--text-muted)";
  if (ms < 50)  return "#22c55e";
  if (ms < 200) return "#f59e0b";
  return "#ef4444";
};

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────
export default function MonitoramentoDashboard() {
  const [assets, setAssets]       = useState<Asset[]>([]);
  const [summary, setSummary]     = useState<Summary | null>(null);
  const [porCategoria, setPorCat] = useState<Record<string, any>>({});
  const [loading, setLoading]     = useState(true);

  const [q, setQ]               = useState("");
  const [statusFilter, setStat] = useState<Status | "">("");
  const [catFilter, setCat]     = useState<string>("");
  const [showCatMenu, setShowCatMenu] = useState(false);
  const catMenuRef = useRef<HTMLDivElement | null>(null);
  const [incidentes, setIncidentes] = useState<any>(null);
  const [snapshots, setSnapshots] = useState(false); // miniaturas de camera (opt-in)
  const [snapTick, setSnapTick] = useState(0);
  useEffect(() => {
    if (!snapshots) return;
    const t = setInterval(() => setSnapTick(x => x + 1), 30000); // refresca miniaturas a cada 30s
    return () => clearInterval(t);
  }, [snapshots]);

  const load = useCallback(async () => {
    try {
      const [a, s, c, inc] = await Promise.all([
        api.get("/monitoramento/assets"),
        api.get("/monitoramento/dashboard/summary"),
        api.get("/monitoramento/dashboard/por-categoria"),
        api.get("/monitoramento/dashboard/incidentes").catch(() => ({ data: null })),
      ]);
      setAssets(a.data); setSummary(s.data); setPorCat(c.data); setIncidentes(inc.data);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  // recarrega incidentes a cada mudança de status (via WS) com debounce leve
  const recarregaIncidentes = useCallback(() => {
    api.get("/monitoramento/dashboard/incidentes").then(r => setIncidentes(r.data)).catch(() => {});
  }, []);

  // WebSocket — atualizacao ao vivo
  useEffect(() => {
    const sock = connectMonitoringSocket();
    const onStatus = (ev: StatusChange) => {
      setAssets(prev => prev.map(a => a.id === ev.assetId
        ? { ...a, ultimoStatus: ev.novo as Status, ultimoCheckEm: ev.ts } : a));
      api.get("/monitoramento/dashboard/summary").then(r => setSummary(r.data)).catch(() => {});
      recarregaIncidentes();
    };
    const onTick = (ev: ProbeTick) => {
      setAssets(prev => prev.map(a => a.id === ev.assetId
        ? { ...a, ultimoStatus: ev.status as Status, ultimaLatenciaMs: ev.latenciaMs, ultimoCheckEm: ev.ts } : a));
    };
    sock.on("status_change", onStatus);
    sock.on("probe_tick",    onTick);
    return () => { sock.off("status_change", onStatus); sock.off("probe_tick", onTick); disconnectMonitoringSocket(); };
  }, []);

  // Fecha dropdown de categoria ao clicar fora
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (catMenuRef.current && !catMenuRef.current.contains(e.target as Node)) setShowCatMenu(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Filtragem
  const visiveis = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return assets.filter(a => {
      if (statusFilter && a.ultimoStatus !== statusFilter) return false;
      if (catFilter    && a.categoria   !== catFilter)    return false;
      if (ql) {
        if (!a.nome.toLowerCase().includes(ql) && !(a.ip||"").toLowerCase().includes(ql) && !(a.tipo||"").toLowerCase().includes(ql)) return false;
      }
      return true;
    });
  }, [assets, q, statusFilter, catFilter]);

  const catSelecionada = CATEGORIAS.find(c => c.v === catFilter);

  // KPI ring (disponibilidade) — visual
  const disponPct = summary?.disponPct ?? 0;
  const ringDash = (disponPct / 100) * 188.5; // perimeter of r=30

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <>
      <Topbar />
      <div className="page-content" style={{ padding: "24px 28px 60px", maxWidth: 1600, margin: "0 auto" }}>
        {/* ── Hero ─────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, marginBottom: 22, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px 4px 8px", borderRadius: 999, background: "rgba(211,47,47,0.08)", border: "1px solid rgba(211,47,47,0.15)", marginBottom: 12 }}>
              <span className="dot-live" style={{ width: 6, height: 6, background: disponPct > 90 ? "#22c55e" : "#ef4444" }} />
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "#D32F2F", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" }}>ICMP · tempo real</span>
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 800, fontFamily: "var(--font-display)", letterSpacing: "-0.025em", lineHeight: 1.1 }}>
              Monitoramento Operacional
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
              Saúde dos ativos da rede em tempo real · {summary?.monitorados ?? 0} equipamentos sendo pingados
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/dashboard/monitoramento/equipamentos" className="btn btn-ghost" style={{ fontSize: 12 }}>
              <Radio size={14} style={{ marginRight: 4 }} /> Equipamentos
            </Link>
            <Link href="/dashboard/monitoramento/servicos" className="btn btn-ghost" style={{ fontSize: 12 }}>
              <Server size={14} style={{ marginRight: 4 }} /> Serviços
            </Link>
            <Link href="/dashboard/monitoramento/osa" className="btn btn-ghost" style={{ fontSize: 12 }}>
              <FolderClock size={14} style={{ marginRight: 4 }} /> OSA
            </Link>
            <Link href="/dashboard/monitoramento/historico" className="btn btn-ghost" style={{ fontSize: 12 }}>
              <Activity size={14} style={{ marginRight: 4 }} /> Histórico
            </Link>
            <Link href="/dashboard/monitoramento/mapas" className="btn btn-ghost" style={{ fontSize: 12 }}>
              <MapPin size={14} style={{ marginRight: 4 }} /> Mapas
            </Link>
            <Link href="/dashboard/monitoramento/executivo" className="btn btn-ghost" style={{ fontSize: 12 }}>
              <BarChart3 size={14} style={{ marginRight: 4 }} /> Executivo
            </Link>
            <Link href="/dashboard/monitoramento/noc" className="btn btn-violet" style={{ fontSize: 12 }}>
              <Tv2 size={14} style={{ marginRight: 4 }} /> Modo NOC
            </Link>
            <button onClick={() => setSnapshots(s => !s)} className="btn btn-ghost" style={{ fontSize: 12, background: snapshots ? "rgba(211,47,47,0.12)" : undefined, color: snapshots ? "#D32F2F" : undefined }} title="Mostrar miniaturas de câmeras (ITS com link)">
              <Camera size={14} style={{ marginRight: 4 }} /> {snapshots ? "Miniaturas ON" : "Miniaturas"}
            </button>
          </div>
        </div>

        {/* ── KPI principal + secundarios ───────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 mb-6">
          {/* Disponibilidade — destaque com ring */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-subtle-o shadow-sm surface-card p-6 flex items-center gap-6 relative overflow-hidden group"
          >
            <svg width="84" height="84" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="30" stroke="var(--border-subtle)" strokeWidth="6" fill="none" />
              <motion.circle
                cx="40" cy="40" r="30"
                stroke={disponPct >= 95 ? "#22c55e" : disponPct >= 80 ? "#f59e0b" : "#ef4444"}
                strokeWidth="6" fill="none" strokeLinecap="round"
                transform="rotate(-90 40 40)"
                initial={{ strokeDasharray: "0 188.5" }}
                animate={{ strokeDasharray: `${ringDash} 188.5` }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              />
            </svg>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 1.5 }}>Disponibilidade geral</div>
              <div className="metric" style={{ fontSize: 34, marginTop: 2, color: "var(--accent-red)" }}>
                {disponPct.toFixed(1)}<span style={{ fontSize: 18, color: "var(--text-muted)" }}>%</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                <b style={{ color: "#22c55e" }}>{summary?.online ?? 0}</b> de <b>{summary?.monitorados ?? 0}</b> online
              </div>
            </div>
          </motion.div>

          {/* KPIs secundarios em strip */}
          <div className="grid grid-cols-4 gap-3">
            <KpiTile clickable active={statusFilter==="ONLINE"}        label="Online"           value={summary?.online ?? 0}   colorName="emerald" icon={<CheckCircle2 size={18}/>} onClick={() => setStat(statusFilter==="ONLINE"?"":"ONLINE")} />
            <KpiTile clickable active={statusFilter==="OFFLINE"}       label="Offline"          value={summary?.offline ?? 0}  colorName="red"     icon={<CircleSlash size={18}/>}  onClick={() => setStat(statusFilter==="OFFLINE"?"":"OFFLINE")} />
            <KpiTile clickable active={statusFilter==="INSTAVEL"}      label="Instáveis"        value={summary?.instavel ?? 0} colorName="amber"   icon={<AlertTriangle size={18}/>} onClick={() => setStat(statusFilter==="INSTAVEL"?"":"INSTAVEL")} />
            <KpiTile clickable active={statusFilter==="NAO_MONITORADO"} label="Não monitorado"  value={summary?.naoMon ?? 0}   colorName="slate"   icon={<Radio size={18}/>}        onClick={() => setStat(statusFilter==="NAO_MONITORADO"?"":"NAO_MONITORADO")} />
          </div>
        </div>

        {/* ── Chips de categoria (horizontal, scroll suave) ─────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
          {CATEGORIAS.map(c => {
            const r = porCategoria[c.v] || { online: 0, offline: 0, instavel: 0, total: 0 };
            const Icon = c.icon;
            const active = catFilter === c.v;
            return (
              <motion.button
                key={c.v}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setCat(active ? "" : c.v)}
                className={`rounded-2xl border shadow-sm p-4 transition-all relative overflow-hidden group w-full text-left cursor-pointer
                  ${active ? 'border-accent-o ring-1 ring-[var(--accent-violet)] accent-text accent-soft' : 'border-subtle-o surface-card'}`}
              >
                <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity blur-2xl bg-[var(--accent-violet)]" />
                <div className="flex items-center justify-between mb-3 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${active ? 'accent-solid' : 'surface-sunken text-muted-o'}`}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <div className={`text-sm font-bold ${active ? '' : 'text-primary-o'}`}>{c.label}</div>
                    </div>
                  </div>
                  <div className="metric" style={{ fontSize: 22, color: active ? "inherit" : "var(--text-primary)" }}>{r.total}</div>
                </div>
                <div className="flex gap-3 text-[11px] font-bold uppercase tracking-wider relative z-10" style={{ fontFamily: "var(--font-mono)" }}>
                  <span className="text-emerald-500">● {r.online}</span>
                  <span className="text-red-500">● {r.offline}</span>
                  <span className="text-amber-500">● {r.instavel}</span>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* ── Incidentes (correlação / causa-raiz) ──────────────────────────── */}
        {incidentes && incidentes.incidentes && incidentes.incidentes.length > 0 && (
          <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {incidentes.incidentes.map((inc: any, i: number) => {
              const isRoot = inc.tipo === "causa_raiz";
              const cor = isRoot ? "#ef4444" : "#f59e0b";
              return (
                <div key={i} className="card" style={{ padding: "12px 16px", borderLeft: `3px solid ${cor}`, background: `${cor}08` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <AlertTriangle size={15} style={{ color: cor }} />
                    {isRoot ? (
                      <span style={{ fontSize: 13 }}>
                        <b style={{ color: cor }}>Causa provável:</b>{" "}
                        <b>{inc.causa.nome}</b> <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 11 }}>({inc.causa.ip})</span> offline
                        {" — "}<b>{inc.afetados.length}</b> equipamento(s) dependente(s) afetado(s)
                        {inc.unidade && <span style={{ color: "var(--text-muted)" }}> · {inc.unidade}</span>}
                      </span>
                    ) : (
                      <span style={{ fontSize: 13 }}>
                        <b style={{ color: cor }}>Falha em massa:</b>{" "}
                        <b>{inc.total}</b> equipamentos offline na unidade <b>{inc.unidade}</b>
                        <span style={{ color: "var(--text-muted)" }}> — {inc.dica}</span>
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8, marginLeft: 23 }}>
                    {inc.afetados.slice(0, 12).map((f: any) => (
                      <span key={f.id} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "var(--bg-hover)", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                        {f.nome}
                      </span>
                    ))}
                    {inc.afetados.length > 12 && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>+{inc.afetados.length - 12}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Filtro bar (sticky) ───────────────────────────────────────────── */}
        <div style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--bg-primary)", padding: "10px 0", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* Busca + Categoria dropdown */}
            <div style={{ display: "flex", flex: 1, minWidth: 280, maxWidth: 600, alignItems: "stretch", borderRadius: 10, border: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", overflow: "visible" }}>
              <div style={{ display: "flex", alignItems: "center", padding: "0 12px", color: "var(--text-muted)" }}>
                <Search size={14} />
              </div>
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Buscar por nome, IP ou tipo..."
                style={{ flex: 1, padding: "10px 4px", background: "transparent", border: 0, color: "var(--text-primary)", fontSize: 13, outline: "none", minWidth: 0 }}
              />
              {q && (
                <button onClick={() => setQ("")} className="btn-icon" style={{ width: 32, height: 32, margin: 3 }} title="Limpar"><X size={14}/></button>
              )}

              {/* Divisor */}
              <div style={{ width: 1, background: "var(--border-subtle)" }} />

              {/* Categoria dropdown */}
              <div ref={catMenuRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setShowCatMenu(s => !s)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "0 14px", height: "100%",
                    background: "transparent", border: 0, cursor: "pointer", fontSize: 12, fontWeight: 600,
                    color: catFilter ? "#D32F2F" : "var(--text-secondary)",
                    minWidth: 160, justifyContent: "space-between",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Filter size={13} />
                    {catSelecionada ? catSelecionada.label : "Todas categorias"}
                  </span>
                  <ChevronDown size={14} style={{ transform: showCatMenu ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}/>
                </button>
                <AnimatePresence>
                  {showCatMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                      style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: 240, background: "var(--bg-card)", border: "1px solid var(--border-medium)", borderRadius: 10, boxShadow: "var(--shadow-elevated)", overflow: "hidden", zIndex: 50 }}
                    >
                      <button
                        onClick={() => { setCat(""); setShowCatMenu(false); }}
                        style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: !catFilter ? "var(--bg-hover)" : "transparent", border: 0, cursor: "pointer", fontSize: 12, color: "var(--text-primary)", textAlign: "left" }}
                      >
                        <span>Todas categorias</span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{assets.length}</span>
                      </button>
                      <div style={{ height: 1, background: "var(--border-subtle)" }} />
                      {CATEGORIAS.map(c => {
                        const r = porCategoria[c.v] || { total: 0 };
                        const Icon = c.icon;
                        return (
                          <button key={c.v}
                            onClick={() => { setCat(c.v); setShowCatMenu(false); }}
                            style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: catFilter === c.v ? "var(--bg-hover)" : "transparent", border: 0, cursor: "pointer", fontSize: 12, color: "var(--text-primary)", textAlign: "left" }}
                          >
                            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Icon size={13} style={{ color: catFilter === c.v ? "#D32F2F" : "var(--text-secondary)" }} />
                              <span>
                                <div style={{ fontWeight: 600 }}>{c.label}</div>
                                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{c.tag}</div>
                              </span>
                            </span>
                            <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{r.total}</span>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Contador + clear */}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                <b style={{ color: "var(--text-primary)" }}>{visiveis.length}</b> de {assets.length}
              </span>
              {(q || statusFilter || catFilter) && (
                <button onClick={() => { setQ(""); setStat(""); setCat(""); }} style={{ border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "6px 12px", background: "var(--bg-primary)", fontSize: 11, cursor: "pointer", color: "var(--text-primary)" }}>Limpar filtros</button>
              )}
            </div>
          </div>
        </div>

        {/* ── Grid de status ────────────────────────────────────────────────── */}
        {loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 88 }} />
            ))}
          </div>
        )}

        {!loading && visiveis.length === 0 && (
          <div className="card" style={{ padding: 48, textAlign: "center" }}>
            <div style={{ width: 56, height: 56, margin: "0 auto 14px", borderRadius: 14, background: "rgba(211,47,47,0.08)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <Radio size={26} style={{ color: "#D32F2F" }} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              {assets.length === 0 ? "Nenhum equipamento cadastrado" : "Nenhum equipamento no filtro atual"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {assets.length === 0
                ? <>Comece em <Link href="/dashboard/monitoramento/equipamentos" style={{ color: "#D32F2F" }}>Equipamentos →</Link></>
                : <>Ajuste a busca ou os filtros pra ver resultados</>}
            </div>
          </div>
        )}

        {!loading && visiveis.length > 0 && (
          <motion.div
            initial="hidden" animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.012 } } }}
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}
          >
            {visiveis.map(a => <AssetCard key={a.id} a={a} showSnap={snapshots} snapTick={snapTick} />)}
          </motion.div>
        )}
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ──────────────────────────────────────────────────────────────────────────────
function KpiTile({ label, value, colorName, onClick, active, clickable }: {
  label: string; value: any; colorName: string; icon?: React.ReactNode;
  onClick?: () => void; active?: boolean; clickable?: boolean;
}) {
  const c = {
    emerald: "#22c55e",
    red: "#ef4444",
    amber: "#f59e0b",
    slate: "var(--text-muted)"
  }[colorName] || "var(--text-muted)";
  
  const Comp: any = clickable ? motion.button : "div";
  return (
    <Comp
      {...(clickable ? { whileHover: { y: -2 }, whileTap: { scale: 0.98 }, onClick } : {})}
      className="stat-card flex-1 min-w-[150px]"
      data-active={active ? "true" : "false"}
      style={{ ["--sc" as any]: c, cursor: clickable ? "pointer" : "default" }}
    >
      <span className="stat-card__head">
        <span className="stat-card__dot" />
        <span className="mono-cap">{label}</span>
      </span>
      <span className="metric stat-card__value">{value}</span>
      {clickable && (
        <span className="stat-card__foot">
          <span style={{ flex: 1 }} />
          <span className="stat-card__hint">{active ? "● filtrando" : "filtrar"}</span>
        </span>
      )}
    </Comp>
  );
}

function AssetCard({ a, showSnap, snapTick }: { a: Asset; showSnap?: boolean; snapTick?: number }) {
  const s = STATUS[a.ultimoStatus] || STATUS.NAO_MONITORADO;
  const router = useRouter();
  const hasLink = !!a.link;
  const [snapErr, setSnapErr] = useState(false);
  // Miniatura: so pra ITS com link, quando ligado e o ativo nao esta offline.
  const podeSnap = !!showSnap && a.categoria === "ITS" && hasLink && a.ultimoStatus !== "OFFLINE" && a.ultimoStatus !== "NAO_MONITORADO";
  // Debounce: single-click vai pro historico apos 250ms; dblclick cancela e abre o link
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (clickTimer.current) return;
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      router.push(`/dashboard/monitoramento/historico?assetId=${a.id}`);
    }, 250);
  };
  const handleDblClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
    if (hasLink) window.open(normalizeLink(a.link as string), "_blank", "noopener,noreferrer");
    else router.push(`/dashboard/monitoramento/historico?assetId=${a.id}`);
  };

  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
      whileHover={{ y: -3, boxShadow: "var(--shadow-elevated)" }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      style={{ borderRadius: 10 }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onDoubleClick={handleDblClick}
        title={hasLink ? `Clique: histórico · Duplo-clique: abrir ${a.link}` : "Clique: histórico"}
        className="card"
        style={{
          padding: "12px 14px", display: "block", textDecoration: "none", color: "inherit",
          borderLeft: `3px solid ${s.dot}`,
          position: "relative", overflow: "hidden",
          cursor: hasLink ? "alias" : "pointer", userSelect: "none",
        }}
      >
        {/* sutil glow do status */}
        <div aria-hidden style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: s.bg, filter: "blur(20px)", opacity: 0.6 }} />

        {/* miniatura da camera (opt-in) */}
        {podeSnap && !snapErr && (
          <img
            src={`${snapshotUrl(a.link as string)}${snapshotUrl(a.link as string).includes("?") ? "&" : "?"}_t=${snapTick}`}
            alt=""
            onError={() => setSnapErr(true)}
            style={{ position: "relative", width: "100%", height: 110, objectFit: "cover", borderRadius: 6, marginBottom: 8, background: "#000" }}
          />
        )}

        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{a.nome}</span>
              {hasLink && <ExternalLink size={11} style={{ color: "#D32F2F", opacity: 0.7, flexShrink: 0 }} />}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 3 }}>{a.ip}</div>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: s.bg, color: s.fg, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap", boxShadow: `inset 0 0 0 1px ${s.ring}` }}>
            <motion.span
              style={{ display: "inline-block", width: 6, height: 6, borderRadius: 3, background: s.dot }}
              animate={a.ultimoStatus === "ONLINE" ? { opacity: [1, 0.4, 1] } : {}}
              transition={a.ultimoStatus === "ONLINE" ? { duration: 1.6, repeat: Infinity } : {}}
            />
            {s.label}
          </span>
        </div>

        {/* Badges de inteligência: dependência / anomalia */}
        {(a.supressedByDep || a.latenciaAnomala) && (
          <div style={{ position: "relative", display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
            {a.supressedByDep && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(148,163,184,0.15)", color: "#64748b" }}
                title={`Offline por dependência: uplink "${a.dependeDe?.nome}" está offline`}>
                ⛓ por dependência
              </span>
            )}
            {a.latenciaAnomala && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(245,158,11,0.15)", color: "#b45309" }}
                title={`Latência ${a.ultimaLatenciaMs}ms muito acima do normal (~${Math.round(a.latenciaBaseMs||0)}ms)`}>
                ⚡ latência alta
              </span>
            )}
          </div>
        )}

        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 11 }}>
          <span style={{ color: "var(--text-muted)" }}>{a.tipo || a.categoria}</span>
          <span style={{ fontFamily: "var(--font-mono)" }}>
            <span style={{ color: latencyColor(a.ultimaLatenciaMs), fontWeight: 700 }}>{a.ultimaLatenciaMs != null ? `${a.ultimaLatenciaMs}ms` : "—"}</span>
            <span style={{ color: "var(--text-muted)", margin: "0 4px" }}>·</span>
            <span style={{ color: "var(--text-muted)" }}>{fmtAgo(a.ultimoCheckEm)}</span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}
