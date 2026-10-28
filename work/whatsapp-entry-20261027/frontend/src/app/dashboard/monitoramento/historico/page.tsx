"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import { ChevronLeft } from "lucide-react";

type Ev = {
  id: string; assetId: string; statusAnterior: string; statusNovo: string;
  severidade: string; iniciadoEm: string; finalizadoEm: string | null;
  duracaoSeg: number | null; mensagem: string | null;
  asset: { id: string; nome: string; ip: string; categoria: string };
};

const SEV_COLOR: Record<string, string> = { INFO: "#0284c7", ATENCAO: "#f59e0b", CRITICO: "#ef4444" };

const fmtDur = (s: number | null) => {
  if (s == null) return "—";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m ${s%60}s`;
  return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
};

export default function HistoricoPage() {
  const sp = useSearchParams();
  const [events, setEvents] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<any>({ assetId: sp?.get("assetId") || undefined });

  useEffect(() => {
    setLoading(true);
    api.get("/monitoramento/events", { params: filter })
      .then(r => setEvents(r.data))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <>
      <Topbar />
      <div className="page-content" style={{ padding: 24 }}>
        <Link href="/dashboard/monitoramento" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>
          <ChevronLeft size={12} style={{ display: "inline" }} /> Monitoramento
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-display)", marginBottom: 18 }}>Histórico de Eventos</h1>

        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {(["INFO","ATENCAO","CRITICO"] as const).map(s => (
            <button key={s} className="btn btn-ghost" style={{ fontSize: 11, color: filter.severidade === s ? SEV_COLOR[s] : undefined }}
                    onClick={() => setFilter((f: any) => ({ ...f, severidade: f.severidade === s ? undefined : s }))}>
              ● {s.toLowerCase()}
            </button>
          ))}
          {(["ONLINE","OFFLINE","INSTAVEL"] as const).map(s => (
            <button key={s} className="btn btn-ghost" style={{ fontSize: 11 }}
                    onClick={() => setFilter((f: any) => ({ ...f, statusNovo: f.statusNovo === s ? undefined : s }))}>
              {s}
            </button>
          ))}
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-hover)" }}>
                <th style={th}>Data/Hora</th>
                <th style={th}>Equipamento</th>
                <th style={th}>De → Para</th>
                <th style={th}>Severidade</th>
                <th style={th}>Duração</th>
                <th style={th}>Mensagem</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "var(--text-muted)" }}>Carregando…</td></tr>}
              {!loading && events.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "var(--text-muted)" }}>Nenhum evento registrado.</td></tr>}
              {events.map(e => (
                <tr key={e.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <td style={{ ...td, fontFamily: "var(--font-mono)", fontSize: 11 }}>{new Date(e.iniciadoEm).toLocaleString("pt-BR")}</td>
                  <td style={td}>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{e.asset.nome}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{e.asset.ip}</div>
                  </td>
                  <td style={td}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{e.statusAnterior}</span>
                    <span style={{ margin: "0 6px" }}>→</span>
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{e.statusNovo}</span>
                  </td>
                  <td style={td}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: SEV_COLOR[e.severidade] }}>{e.severidade}</span>
                  </td>
                  <td style={{ ...td, fontFamily: "var(--font-mono)", fontSize: 11 }}>{fmtDur(e.duracaoSeg)}</td>
                  <td style={{ ...td, fontSize: 11, color: "var(--text-muted)" }}>{e.mensagem || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

const th: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", fontWeight: 600 };
const td: React.CSSProperties = { padding: "10px 14px" };
