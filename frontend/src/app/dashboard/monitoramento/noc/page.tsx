"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { connectMonitoringSocket, disconnectMonitoringSocket, getMonitoringSocket, type StatusChange, type ProbeTick } from "@/lib/monitoringSocket";

type Asset = {
  id: string; nome: string; ip: string; categoria: string;
  ultimoStatus: "ONLINE"|"OFFLINE"|"INSTAVEL"|"NAO_MONITORADO";
  ultimaLatenciaMs: number | null;
};
type EvItem = {
  id: string; assetId: string; statusAnterior: string; statusNovo: string;
  severidade: string; iniciadoEm: string; reconhecidoEm?: string | null;
  asset?: { nome: string; ip: string };
  nome?: string; ip?: string; // quando vem do WS
};

const STATUS = {
  ONLINE:         { bg: "#0a2a18", border: "#16a34a", text: "#22c55e" },
  OFFLINE:        { bg: "#2a0a0e", border: "#dc2626", text: "#ef4444" },
  INSTAVEL:       { bg: "#2a1f0a", border: "#d97706", text: "#f59e0b" },
  NAO_MONITORADO: { bg: "#1a1a20", border: "#475569", text: "#94a3b8" },
};
const SEV_COLOR: Record<string, string> = { INFO: "#38bdf8", ATENCAO: "#f59e0b", CRITICO: "#ef4444" };
const CAT_LABEL: Record<string, string> = { ITS: "ITS", SERVIDORES: "Servidores", COMPUTADORES: "Computadores", PRACAS: "Praças", INFRAESTRUTURA: "Infra" };

// Beep via Web Audio API (sem arquivo). Dois tons pra "alarme".
function playAlert(kind: "down" | "up") {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const seq = kind === "down" ? [[880, 0], [620, 0.18]] : [[620, 0], [880, 0.16]];
    seq.forEach(([freq, at]) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = "square"; o.frequency.value = freq as number;
      o.connect(g); g.connect(ctx.destination);
      const t0 = ctx.currentTime + (at as number);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
      o.start(t0); o.stop(t0 + 0.18);
    });
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {}
}

const fmtTime = (s: string) => new Date(s).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function NocPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [now, setNow] = useState(new Date());
  const [events, setEvents] = useState<EvItem[]>([]);
  const [conn, setConn] = useState<"ok"|"lost">("ok");
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  const load = useCallback(async () => {
    const [a, s, e] = await Promise.all([
      api.get("/monitoramento/assets"),
      api.get("/monitoramento/dashboard/summary"),
      api.get("/monitoramento/events", { params: { naoReconhecidos: true, limit: 40 } }).catch(() => ({ data: [] })),
    ]);
    setAssets(a.data); setSummary(s.data); setEvents(e.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(load, 60_000); return () => clearInterval(t); }, [load]);

  useEffect(() => {
    const sock = connectMonitoringSocket();
    const onStatus = (ev: StatusChange) => {
      setAssets(prev => prev.map(a => a.id === ev.assetId ? { ...a, ultimoStatus: ev.novo as any } : a));
      api.get("/monitoramento/dashboard/summary").then(r => setSummary(r.data)).catch(() => {});
      // som + adiciona no painel de eventos
      if (ev.novo === "OFFLINE" || ev.novo === "INSTAVEL") {
        if (!mutedRef.current) playAlert("down");
        setEvents(prev => [{
          id: ev.eventId || `${ev.assetId}-${ev.ts}`, assetId: ev.assetId,
          statusAnterior: ev.anterior, statusNovo: ev.novo, severidade: ev.severidade || "ATENCAO",
          iniciadoEm: ev.ts, reconhecidoEm: null, nome: ev.nome, ip: ev.ip,
        }, ...prev].slice(0, 60));
      } else if (ev.novo === "ONLINE") {
        if (!mutedRef.current) playAlert("up");
        // remove eventos pendentes desse asset (recuperou)
        setEvents(prev => prev.filter(x => x.assetId !== ev.assetId));
      }
    };
    const onTick = (ev: ProbeTick) => {
      setAssets(prev => prev.map(a => a.id === ev.assetId ? { ...a, ultimaLatenciaMs: ev.latenciaMs, ultimoStatus: ev.status as any } : a));
    };
    sock.on("status_change", onStatus);
    sock.on("probe_tick", onTick);
    sock.on("connect",    () => setConn("ok"));
    sock.on("disconnect", () => setConn("lost"));
    sock.on("connect_error", () => setConn("lost"));
    setConn(sock.connected ? "ok" : "lost");
    return () => { sock.off("status_change", onStatus); sock.off("probe_tick", onTick); disconnectMonitoringSocket(); };
  }, []);

  const ack = async (ev: EvItem) => {
    setEvents(prev => prev.filter(x => x.id !== ev.id));
    if (ev.id && !ev.id.includes("-")) { // id real (uuid), nao o fallback
      try { await api.post(`/monitoramento/events/${ev.id}/ack`); } catch {}
    }
  };

  const grouped = (cat: string) => assets.filter(a => a.categoria === cat);
  const pendentes = events.filter(e => !e.reconhecidoEm);

  return (
    <div style={{ background: "#000", color: "#e5e7eb", minHeight: "100vh", padding: 20, fontFamily: "var(--font-display)", display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
      {/* COLUNA PRINCIPAL */}
      <div>
        {/* Banner conexão perdida */}
        {conn === "lost" && (
          <div style={{ background: "#7f1d1d", border: "1px solid #ef4444", borderRadius: 8, padding: "10px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10, animation: "pulse 1.5s infinite" }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: "#ef4444", display: "inline-block" }} />
            <span style={{ fontWeight: 700, color: "#fff" }}>Conexão em tempo real perdida</span>
            <span style={{ color: "#fca5a5", fontSize: 12 }}>— tentando reconectar… (dados podem estar desatualizados)</span>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", marginBottom: 16, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>Network Operations Center</div>
            <div style={{ fontSize: 13, color: "#94a3b8" }}>Triunfo Transbrasiliana · Monitoramento Operacional</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button onClick={() => setMuted(m => !m)} title={muted ? "Ativar som" : "Silenciar"}
              style={{ background: muted ? "#3f1d1d" : "#0a2a18", border: `1px solid ${muted ? "#ef4444" : "#16a34a"}`, color: muted ? "#fca5a5" : "#22c55e", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
              {muted ? "🔇 Mudo" : "🔊 Som"}
            </button>
            <div style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#fff" }}>{now.toLocaleTimeString("pt-BR")}</div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>{now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 18 }}>
          <NocKpi label="DISPONIBILIDADE" value={`${(summary?.disponPct||0).toFixed(1)}%`} color="#D32F2F" big />
          <NocKpi label="ONLINE"          value={summary?.online ?? 0}   color="#22c55e" />
          <NocKpi label="OFFLINE"         value={summary?.offline ?? 0}  color="#ef4444" />
          <NocKpi label="INSTÁVEIS"       value={summary?.instavel ?? 0} color="#f59e0b" />
          <NocKpi label="MONITORADOS"     value={summary?.monitorados ?? 0} color="#94a3b8" />
        </div>

        {Object.keys(CAT_LABEL).map(cat => {
          const items = grouped(cat);
          if (!items.length) return null;
          const online = items.filter(a => a.ultimoStatus === "ONLINE").length;
          const offline = items.filter(a => a.ultimoStatus === "OFFLINE").length;
          return (
            <div key={cat} style={{ marginBottom: 22 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, borderBottom: "1px solid #1f2937", paddingBottom: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{CAT_LABEL[cat]} <span style={{ color: "#475569" }}>({items.length})</span></div>
                <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "var(--font-mono)" }}>
                  <span style={{ color: "#22c55e" }}>● {online}</span>{" · "}<span style={{ color: "#ef4444" }}>● {offline}</span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
                {items.map(a => {
                  const c = STATUS[a.ultimoStatus] || STATUS.NAO_MONITORADO;
                  return (
                    <div key={a.id} style={{ background: c.bg, border: `2px solid ${c.border}`, borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nome}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, fontFamily: "var(--font-mono)" }}>
                        <span style={{ color: "#94a3b8" }}>{a.ip}</span>
                        <span style={{ color: c.text, fontWeight: 700 }}>{a.ultimaLatenciaMs != null ? `${a.ultimaLatenciaMs}ms` : "—"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* PAINEL DE EVENTOS (Central de Eventos) */}
      <div style={{ background: "#0a0a0c", border: "1px solid #1f2937", borderRadius: 12, padding: 14, height: "fit-content", position: "sticky", top: 20, maxHeight: "calc(100vh - 40px)", overflow: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Central de Eventos</div>
          <span style={{ background: pendentes.length ? "#7f1d1d" : "#14532d", color: pendentes.length ? "#fca5a5" : "#86efac", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12 }}>
            {pendentes.length} pendente{pendentes.length === 1 ? "" : "s"}
          </span>
        </div>
        {pendentes.length === 0 ? (
          <div style={{ color: "#475569", fontSize: 12, textAlign: "center", padding: "30px 0" }}>
            ✓ Nenhum evento pendente
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendentes.map(ev => {
              const nome = ev.asset?.nome || ev.nome || "—";
              const ip = ev.asset?.ip || ev.ip || "";
              const sc = SEV_COLOR[ev.severidade] || "#94a3b8";
              return (
                <div key={ev.id} style={{ background: "#141417", border: `1px solid ${sc}40`, borderLeft: `3px solid ${sc}`, borderRadius: 6, padding: "8px 10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 6 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome}</div>
                      <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "var(--font-mono)" }}>{ip}</div>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, color: sc, whiteSpace: "nowrap" }}>{ev.statusNovo}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                    <span style={{ fontSize: 10, color: "#64748b", fontFamily: "var(--font-mono)" }}>{fmtTime(ev.iniciadoEm)}</span>
                    <button onClick={() => ack(ev)}
                      style={{ background: "#1e293b", border: "1px solid #334155", color: "#cbd5e1", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, cursor: "pointer" }}>
                      ✓ Reconhecer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.55 } }`}</style>
    </div>
  );
}

function NocKpi({ label, value, color, big }: { label: string; value: any; color: string; big?: boolean }) {
  return (
    <div style={{ background: "#0a0a0c", border: `2px solid ${color}`, borderRadius: 12, padding: big ? "20px 22px" : "16px 18px", textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "var(--font-mono)", letterSpacing: 2, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: big ? 56 : 38, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
    </div>
  );
}
