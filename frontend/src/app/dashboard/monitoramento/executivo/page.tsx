"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import { ChevronLeft, TrendingDown, Clock, Target, Download, Printer, Activity, RefreshCw, PieChart as PieIcon } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LabelList, Cell,
  PieChart, Pie, Legend,
} from "recharts";

type SlaItem = { id: string; nome: string; ip: string; categoria: string; disponibilidadePct: number | null; amostras: number };

const CATS = ["ITS","SERVIDORES","COMPUTADORES","PRACAS","INFRAESTRUTURA"];
const CAT_LABEL: Record<string,string> = { ITS:"ITS", SERVIDORES:"Servidores", COMPUTADORES:"Computadores", PRACAS:"Praças", INFRAESTRUTURA:"Infra" };
const PERIODO_LABEL: Record<string,string> = { "24h": "Últimas 24h", "7d": "Últimos 7 dias", "30d": "Últimos 30 dias" };
const STATUS_COR: Record<string,string> = { online:"#22c55e", offline:"#ef4444", instavel:"#f59e0b", naoMon:"#94a3b8" };

const latColor = (ms: number) => ms < 50 ? "#22c55e" : ms < 200 ? "#f59e0b" : "#ef4444";
const trunc = (s: string, n = 22) => s.length > n ? s.slice(0, n - 1) + "…" : s;

export default function ExecutivoPage() {
  const [periodo, setPeriodo] = useState<"24h" | "7d" | "30d">("24h");
  const [sla, setSla] = useState<SlaItem[]>([]);
  const [topLat, setTopLat] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [eventos, setEventos] = useState<any[]>([]);
  const [metas, setMetas] = useState<Record<string, number>>({});
  const [showMetas, setShowMetas] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const horas = periodo === "24h" ? 24 : periodo === "7d" ? 168 : 720;
    const desde = new Date(Date.now() - horas * 3600 * 1000).toISOString();
    Promise.all([
      api.get("/monitoramento/dashboard/sla", { params: { periodo } }).then(r => setSla(r.data)),
      api.get("/monitoramento/dashboard/top-latencia").then(r => setTopLat(r.data)),
      api.get("/monitoramento/dashboard/summary").then(r => setSummary(r.data)),
      api.get("/monitoramento/events", { params: { desde, limit: 500 } }).then(r => setEventos(r.data)).catch(() => setEventos([])),
    ]).finally(() => setLoading(false));
  }, [periodo]);
  useEffect(() => { api.get("/monitoramento/sla/metas").then(r => setMetas(r.data)).catch(() => {}); }, []);

  const metaDe = (cat: string) => metas[cat] ?? 99;
  const cumpriu = (s: SlaItem) => s.disponibilidadePct != null && s.disponibilidadePct >= metaDe(s.categoria);
  const corSla = (s: SlaItem) => {
    if (s.disponibilidadePct == null) return "#94a3b8";
    return cumpriu(s) ? "#22c55e" : (s.disponibilidadePct >= metaDe(s.categoria) - 5 ? "#f59e0b" : "#ef4444");
  };

  const comDados = sla.filter(s => s.disponibilidadePct != null);
  const semDados = sla.length - comDados.length;
  const avg = comDados.length ? comDados.reduce((a, b) => a + (b.disponibilidadePct||0), 0) / comDados.length : 0;
  const foraMeta = sla.filter(s => s.disponibilidadePct != null && !cumpriu(s)).length;
  const latMedia = topLat.length ? Math.round(topLat.reduce((a,b) => a + (b.ultimaLatenciaMs||0), 0) / topLat.length) : 0;

  // Top INDISPONIBILIDADE (pior = barra maior, visivel). Inverte a metrica.
  const topIndisp = useMemo(() => comDados
    .map(s => ({ nome: trunc(s.nome), full: s.nome, indisp: +(100 - (s.disponibilidadePct||0)).toFixed(2), pct: s.disponibilidadePct||0 }))
    .filter(x => x.indisp > 0)
    .sort((a,b) => b.indisp - a.indisp).slice(0, 10), [comDados]);

  const latData = useMemo(() => topLat.slice(0, 10).map(t => ({ nome: trunc(t.nome), full: t.nome, ms: t.ultimaLatenciaMs || 0 })), [topLat]);

  // Disponibilidade media por categoria
  const porCat = useMemo(() => CATS.map(c => {
    const arr = comDados.filter(s => s.categoria === c);
    const media = arr.length ? arr.reduce((a,b) => a + (b.disponibilidadePct||0), 0) / arr.length : null;
    return { categoria: CAT_LABEL[c], media: media != null ? +media.toFixed(1) : null, meta: metaDe(c), n: arr.length };
  }).filter(x => x.media != null), [comDados, metas]);

  // Donut de status (snapshot atual)
  const statusData = summary ? [
    { name: "Online", value: summary.online, key: "online" },
    { name: "Offline", value: summary.offline, key: "offline" },
    { name: "Instável", value: summary.instavel, key: "instavel" },
    { name: "Não monit.", value: summary.naoMon, key: "naoMon" },
  ].filter(x => x.value > 0) : [];

  // Top reincidentes (mais quedas no período) — conta eventos OFFLINE/INSTAVEL por asset
  const reincidentes = useMemo(() => {
    const cont: Record<string, { nome: string; ip: string; n: number }> = {};
    for (const e of eventos) {
      if (e.statusNovo !== "OFFLINE" && e.statusNovo !== "INSTAVEL") continue;
      const k = e.asset?.id || e.assetId;
      if (!k) continue;
      cont[k] = cont[k] || { nome: e.asset?.nome || "—", ip: e.asset?.ip || "", n: 0 };
      cont[k].n++;
    }
    return Object.values(cont).sort((a,b) => b.n - a.n).slice(0, 10);
  }, [eventos]);

  async function salvarMeta(cat: string, val: number) {
    setMetas(m => ({ ...m, [cat]: val }));
    try { await api.put("/monitoramento/sla/metas", { categoria: cat, metaPct: val }); } catch {}
  }

  function exportCSV() {
    const head = ["Equipamento","Categoria","IP","Disponibilidade(%)","Meta(%)","Cumpriu","Amostras"];
    const linhas = sla.map(s => [
      `"${s.nome.replace(/"/g,'""')}"`, s.categoria, s.ip,
      s.disponibilidadePct != null ? s.disponibilidadePct.toFixed(2) : "",
      metaDe(s.categoria).toFixed(0),
      s.disponibilidadePct == null ? "" : (cumpriu(s) ? "SIM" : "NAO"),
      s.amostras,
    ].join(";"));
    const csv = "﻿" + [head.join(";"), ...linhas].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `sla_${periodo}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <>
      <Topbar />
      <div className="page-content" style={{ padding: 24, maxWidth: 1500, margin: "0 auto" }}>
        <Link href="/dashboard/monitoramento" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>
          <ChevronLeft size={12} style={{ display: "inline" }} /> Monitoramento
        </Link>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-display)" }}>Dashboard Executivo</h1>
          <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }} className="no-print">
            {(["24h","7d","30d"] as const).map(p => (
              <button key={p} className="btn btn-ghost" style={{ fontSize: 12, background: periodo === p ? "rgba(211,47,47,0.12)" : undefined, color: periodo === p ? "#D32F2F" : undefined }} onClick={() => setPeriodo(p)}>
                {PERIODO_LABEL[p]}
              </button>
            ))}
            <div style={{ width: 1, height: 20, background: "var(--border-subtle)", margin: "0 4px" }} />
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowMetas(s => !s)}><Target size={13} style={{ marginRight: 4 }} /> Metas</button>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={exportCSV}><Download size={13} style={{ marginRight: 4 }} /> CSV</button>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => window.print()}><Printer size={13} style={{ marginRight: 4 }} /> PDF</button>
          </div>
        </div>

        <div className="print-only" style={{ display: "none", marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Relatório de SLA — Monitoramento Operacional</div>
          <div style={{ fontSize: 12 }}>Triunfo Transbrasiliana · Período: {PERIODO_LABEL[periodo]} · Emitido em {new Date().toLocaleString("pt-BR")}</div>
        </div>

        {showMetas && (
          <div className="card no-print" style={{ padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <Target size={14} style={{ color: "#D32F2F" }} /> Metas de disponibilidade por categoria
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))", gap: 10 }}>
              {CATS.map(c => (
                <div key={c}>
                  <label style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{CAT_LABEL[c]}</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="number" min={0} max={100} step={0.1} className="input-o" style={{ width: 90 }}
                      value={metaDe(c)} onChange={e => salvarMeta(c, Math.max(0, Math.min(100, Number(e.target.value))))} />
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16 }}>
          <Kpi label="SLA médio"      value={`${avg.toFixed(2)}%`} color="#D32F2F" sub={`${comDados.length} com dados`} />
          <Kpi label="Dentro da meta" value={sla.filter(s => cumpriu(s)).length} color="#22c55e" />
          <Kpi label="Fora da meta"   value={foraMeta} color="#ef4444" />
          <Kpi label="Latência média" value={`${latMedia}ms`} color={latColor(latMedia)} sub="top 10 atuais" />
          <Kpi label="Sem dados"      value={semDados} color="#94a3b8" sub="aguardando coleta" />
        </div>

        {/* Linha: status donut + disponibilidade por categoria */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 360px) 1fr", gap: 14, marginBottom: 16 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 13, fontWeight: 700 }}>
              <PieIcon size={14} style={{ color: "#D32F2F" }} /> Status atual
            </div>
            <div style={{ height: 230 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {statusData.map(d => <Cell key={d.key} fill={STATUS_COR[d.key]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any, n: any) => [`${v}`, n]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 13, fontWeight: 700 }}>
              <Activity size={14} style={{ color: "#D32F2F" }} /> Disponibilidade média por categoria
            </div>
            <div style={{ height: 230 }}>
              <ResponsiveContainer>
                <BarChart data={porCat} margin={{ left: 0, right: 20, top: 10 }}>
                  <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
                  <XAxis dataKey="categoria" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                  <Tooltip formatter={(v: any, n: any, p: any) => [`${v}% (meta ${p.payload.meta}% · ${p.payload.n} eq.)`, "Disponibilidade"]} />
                  <Bar dataKey="media" radius={[4,4,0,0]}>
                    {porCat.map((d, i) => <Cell key={i} fill={(d.media||0) >= d.meta ? "#22c55e" : (d.media||0) >= d.meta - 5 ? "#f59e0b" : "#ef4444"} />)}
                    <LabelList dataKey="media" position="top" formatter={(v: any) => `${v}%`} style={{ fontSize: 10, fill: "var(--text-secondary)" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Linha: indisponibilidade + latência */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 13, fontWeight: 700 }}>
              <TrendingDown size={14} style={{ color: "#ef4444" }} /> Maior indisponibilidade do período
            </div>
            {topIndisp.length === 0 ? (
              <Vazio loading={loading} msg="Sem indisponibilidade registrada no período (ou dados ainda em coleta)." />
            ) : (
              <div style={{ height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={topIndisp} layout="vertical" margin={{ left: 70, right: 40 }}>
                    <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, "dataMax"]} tick={{ fontSize: 10 }} unit="%" />
                    <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} width={130} />
                    <Tooltip formatter={(v: any, _n: any, p: any) => [`${v}% indisponível · ${p.payload.pct.toFixed(2)}% disponível`, p.payload.full]} />
                    <Bar dataKey="indisp" fill="#ef4444" radius={[0,4,4,0]}>
                      <LabelList dataKey="indisp" position="right" formatter={(v: any) => `${v}%`} style={{ fontSize: 10, fill: "var(--text-secondary)" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 13, fontWeight: 700 }}>
              <Clock size={14} style={{ color: "#f59e0b" }} /> Maior latência atual
            </div>
            {latData.length === 0 ? (
              <Vazio loading={loading} msg="Sem dados de latência." />
            ) : (
              <div style={{ height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={latData} layout="vertical" margin={{ left: 70, right: 48 }}>
                    <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 10 }} unit="ms" />
                    <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} width={130} />
                    <Tooltip formatter={(v: any, _n: any, p: any) => [`${v}ms`, p.payload.full]} />
                    <Bar dataKey="ms" radius={[0,4,4,0]}>
                      {latData.map((d, i) => <Cell key={i} fill={latColor(d.ms)} />)}
                      <LabelList dataKey="ms" position="right" formatter={(v: any) => `${v}ms`} style={{ fontSize: 10, fill: "var(--text-secondary)" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Top reincidentes */}
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 13, fontWeight: 700 }}>
            <RefreshCw size={14} style={{ color: "#f59e0b" }} /> Equipamentos que mais caíram ({PERIODO_LABEL[periodo]})
          </div>
          {reincidentes.length === 0 ? (
            <Vazio loading={loading} msg="Nenhuma queda registrada no período. 🎉" />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
              {reincidentes.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: "var(--bg-hover)" }}>
                  <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "var(--font-display)", color: i < 3 ? "#ef4444" : "var(--text-muted)", minWidth: 28 }}>{r.n}×</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nome}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{r.ip}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tabela SLA */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", fontWeight: 700, fontSize: 13, background: "var(--bg-hover)" }}>SLA por equipamento ({PERIODO_LABEL[periodo]})</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr><th style={th}>Equipamento</th><th style={th}>Categoria</th><th style={th}>IP</th><th style={th}>Disponibilidade</th><th style={th}>Meta</th><th style={th}>Amostras</th></tr>
            </thead>
            <tbody>
              {sla.map(s => {
                const pct = s.disponibilidadePct;
                const cor = corSla(s);
                return (
                  <tr key={s.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <td style={{ ...td, fontWeight: 600 }}>{s.nome}</td>
                    <td style={td}>{CAT_LABEL[s.categoria] || s.categoria}</td>
                    <td style={{ ...td, fontFamily: "var(--font-mono)", fontSize: 12 }}>{s.ip}</td>
                    <td style={{ ...td, color: cor, fontWeight: 700 }}>
                      {pct != null ? `${pct.toFixed(2)}%` : "Sem dados"}
                      {pct != null && (cumpriu(s)
                        ? <span style={{ marginLeft: 6, fontSize: 10, color: "#22c55e" }}>✓</span>
                        : <span style={{ marginLeft: 6, fontSize: 10, color: "#ef4444" }}>✗</span>)}
                    </td>
                    <td style={{ ...td, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>{metaDe(s.categoria).toFixed(0)}%</td>
                    <td style={{ ...td, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>{s.amostras}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .print-only { display: none; }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: #fff !important; }
          .card { box-shadow: none !important; border: 1px solid #ddd !important; break-inside: avoid; }
        }
      `}</style>
    </>
  );
}

function Kpi({ label, value, color, sub }: { label: string; value: any; color: string; sub?: string }) {
  return (
    <div className="card" style={{ padding: 16, borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "var(--font-display)", color, lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Vazio({ loading, msg }: { loading: boolean; msg: string }) {
  return (
    <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 20 }}>
      {loading ? "Carregando…" : msg}
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", fontWeight: 600 };
const td: React.CSSProperties = { padding: "10px 14px" };
