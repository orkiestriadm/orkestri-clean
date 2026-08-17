"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import { ChevronLeft, TrendingDown, Clock, Target, Download, Printer, Activity, RefreshCw, PieChart as PieIcon } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LabelList, Cell,
  PieChart, Pie, Legend, ReferenceLine,
} from "recharts";

type SlaItem = { id: string; nome: string; ip: string; categoria: string; disponibilidadePct: number | null; amostras: number };

const CATS = ["ITS","SERVIDORES","COMPUTADORES","PRACAS","INFRAESTRUTURA"];
const CAT_LABEL: Record<string,string> = { ITS:"ITS", SERVIDORES:"Servidores", COMPUTADORES:"Computadores", PRACAS:"Praças", INFRAESTRUTURA:"Infra" };
const PERIODO_LABEL: Record<string,string> = { "24h": "Últimas 24h", "7d": "Últimos 7 dias", "30d": "Últimos 30 dias" };
const STATUS_COR: Record<string,string> = { online:"var(--mon-ok)", offline:"var(--mon-down)", instavel:"var(--mon-warn)", naoMon:"var(--mon-idle)" };

const latColor = (ms: number) => ms < 50 ? "var(--mon-ok)" : ms < 200 ? "var(--mon-warn)" : "var(--mon-down)";
const trunc = (s: string, n = 22) => s.length > n ? s.slice(0, n - 1) + "…" : s;

export default function ExecutivoPage() {
  const [periodo, setPeriodo] = useState<"24h" | "7d" | "30d">("24h");
  const [sla, setSla] = useState<SlaItem[]>([]);
  const [topLat, setTopLat] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [eventos, setEventos] = useState<any[]>([]);
  const [metas, setMetas] = useState<Record<string, number>>({});
  const [showMetas, setShowMetas] = useState(false);
  const [verSemResposta, setVerSemResposta] = useState(false);
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
    if (s.disponibilidadePct == null) return "var(--mon-idle)";
    return cumpriu(s) ? "var(--mon-ok)" : (s.disponibilidadePct >= metaDe(s.categoria) - 5 ? "var(--mon-warn)" : "var(--mon-down)");
  };

  const comDados = sla.filter(s => s.disponibilidadePct != null);
  const semDados = sla.length - comDados.length;
  const avg = comDados.length ? comDados.reduce((a, b) => a + (b.disponibilidadePct||0), 0) / comDados.length : 0;
  const foraMeta = sla.filter(s => s.disponibilidadePct != null && !cumpriu(s)).length;
  const latMedia = topLat.length ? Math.round(topLat.reduce((a,b) => a + (b.ultimaLatenciaMs||0), 0) / topLat.length) : 0;

  /**
   * Indisponibilidade, separada em duas leituras que o gráfico único misturava.
   *
   * O ranking mostrava dez barras cravadas em 100% — todas do mesmo tamanho,
   * ordenadas por nada visível. Não era erro de cálculo: 100% de
   * indisponibilidade significa que o equipamento não respondeu UMA VEZ no
   * período, e num parque com câmeras fora do ar há meses isso enche a lista
   * inteira e esconde quem oscila.
   *
   * São problemas de naturezas diferentes: o que nunca respondeu é cadastro a
   * revisar ou obra a fazer; o que respondeu em parte do tempo é rede
   * instável. Agora cada um tem seu lugar, e o gráfico fica só com quem
   * realmente varia — onde a barra volta a comparar alguma coisa.
   */
  const semResposta = useMemo(() => comDados
    .filter(s => (s.disponibilidadePct ?? 0) <= 0)
    .map(s => ({ nome: s.nome, ip: (s as any).ip as string | undefined })), [comDados]);

  const topIndisp = useMemo(() => comDados
    .map(s => ({ nome: trunc(s.nome), full: s.nome, indisp: +(100 - (s.disponibilidadePct||0)).toFixed(2), pct: s.disponibilidadePct||0 }))
    .filter(x => x.indisp > 0 && x.indisp < 100)
    .sort((a,b) => b.indisp - a.indisp).slice(0, 10), [comDados]);

  const latData = useMemo(() => topLat.slice(0, 10).map(t => ({ nome: trunc(t.nome), full: t.nome, ms: t.ultimaLatenciaMs || 0 })), [topLat]);

  // Disponibilidade media por categoria
  const porCat = useMemo(() => CATS.map(c => {
    const arr = comDados.filter(s => s.categoria === c);
    const media = arr.length ? arr.reduce((a,b) => a + (b.disponibilidadePct||0), 0) / arr.length : null;
    return { categoria: CAT_LABEL[c], media: media != null ? +media.toFixed(1) : null, meta: metaDe(c), n: arr.length };
  }).filter(x => x.media != null), [comDados, metas]);

  /** Meta comum a todas as categorias, quando existe: vira uma régua só. */
  const metaUnica = useMemo(() => {
    const vals = [...new Set(porCat.map(c => c.meta))];
    return vals.length === 1 ? vals[0] : null;
  }, [porCat]);

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
              <Target size={14} style={{ color: "var(--accent-violet)" }} /> Metas de disponibilidade por categoria
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
          <Kpi destaque label="SLA médio" value={`${avg.toFixed(2)}%`} sub={`${comDados.length} com dados · meta ${metaUnica ?? 99}%`} color={avg >= (metaUnica ?? 99) ? "var(--mon-ok)" : avg >= (metaUnica ?? 99) - 1 ? "var(--mon-warn)" : "var(--mon-down)"} />
          <Kpi label="Dentro da meta" value={sla.filter(s => cumpriu(s)).length} color="var(--mon-ok)" />
          <Kpi label="Fora da meta"   value={foraMeta} color="var(--mon-down)" />
          <Kpi label="Latência média" value={`${latMedia}ms`} color={latColor(latMedia)} sub="top 10 atuais" />
          <Kpi label="Sem dados"      value={semDados} color="var(--mon-idle)" sub="aguardando coleta" />
        </div>

        {/* Linha: status donut + disponibilidade por categoria */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 360px) 1fr", gap: 14, marginBottom: 16 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 13, fontWeight: 700 }}>
              <PieIcon size={14} style={{ color: "var(--accent-violet)" }} /> Status atual
            </div>
            {/* O buraco do donut estava vazio. É o lugar mais visível do
                gráfico e vale o número que resume tudo: quanto da frota está
                de pé agora. */}
            <div style={{ height: 230, position: "relative" }}>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <span className="metric" style={{ fontSize: 26, lineHeight: 1, color: "var(--text-primary)" }}>
                  {summary ? Math.round((summary.online / Math.max(1, summary.monitorados)) * 100) : 0}%
                </span>
                <span style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>no ar agora</span>
                <span className="num" style={{ fontSize: 10, color: "var(--text-faint)" }}>
                  {summary?.online ?? 0} de {summary?.monitorados ?? 0}
                </span>
              </div>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={85} paddingAngle={2} stroke="none">
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
              <Activity size={14} style={{ color: "var(--accent-violet)" }} /> Disponibilidade média por categoria
            </div>
            {/* Régua por categoria, não coluna.
                O gráfico de colunas 0–100 gastava nove décimos da altura na
                faixa onde nada acontece: quatro categorias entre 94% e 99%
                saíam do mesmo tamanho, e os rótulos batiam na linha da meta.
                Truncar o eixo resolveria o desenho e mentiria no dado — barra
                que não começa em zero exagera diferença.
                A saída é medir o que decide: a DISTÂNCIA até a meta. Cada
                categoria vira uma régua com o alvo marcado e o desvio escrito
                em pontos, que é a frase que alguém leva para a reunião. */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 4 }}>
              {porCat.map(d => {
                const media = d.media || 0;
                const desvio = +(media - d.meta).toFixed(1);
                const cor = media >= d.meta ? "var(--mon-ok)" : media >= d.meta - 1 ? "var(--mon-warn)" : "var(--mon-down)";
                return (
                  <div key={d.categoria}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{d.categoria}</span>
                      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
                        <span className="num" style={{ fontSize: 13, fontWeight: 700, color: cor, fontVariantNumeric: "tabular-nums" }}>
                          {media.toFixed(1)}%
                        </span>
                        <span className="num" style={{ fontSize: 11, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", minWidth: 58, textAlign: "right" }}>
                          {desvio >= 0 ? `+${desvio}` : desvio} pts
                        </span>
                      </span>
                    </div>
                    <div style={{ position: "relative", height: 10, borderRadius: 5, background: "var(--bg-hover)", overflow: "hidden" }}>
                      <div style={{ position: "absolute", inset: 0, width: `${Math.max(0, Math.min(100, media))}%`, background: cor, borderRadius: 5, transition: "width 600ms cubic-bezier(0.22,1,0.36,1)" }} />
                    </div>
                    {/* O alvo fica FORA da barra, na mesma escala: dentro dela
                        sumiria sob o preenchimento justamente quando a categoria
                        está perto da meta, que é quando ele importa. */}
                    <div style={{ position: "relative", height: 9 }}>
                      <span style={{ position: "absolute", left: `${Math.min(100, d.meta)}%`, transform: "translateX(-50%)", width: 1.5, height: 6, background: "var(--text-secondary)" }} />
                      <span style={{ position: "absolute", left: `${Math.min(100, d.meta)}%`, transform: "translateX(-50%)", top: 6, fontSize: 9, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        meta {d.meta}%
                      </span>
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 7 }}>{d.n} equipamento(s)</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Linha: indisponibilidade + latência */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 13, fontWeight: 700 }}>
              <TrendingDown size={14} style={{ color: "var(--mon-down)" }} /> Maior indisponibilidade do período
            </div>

            {/* Quem não respondeu NENHUMA vez sai do ranking e vira lista.
                No gráfico eles empatavam em 100% e ocupavam as dez posições,
                escondendo quem oscila — que é o problema com conserto. */}
            {/* Uma linha, não um bloco. Com 39 nomes em fichas monoespaçadas e
                um parágrafo de explicação, isto ocupava metade do painel e
                empurrava o gráfico — que é o conteúdo — para fora da dobra. */}
            {semResposta.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <button
                  onClick={() => setVerSemResposta(v => !v)}
                  style={{
                    display: "flex", alignItems: "center", gap: 7, width: "100%",
                    padding: "8px 11px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                    border: "1px dashed var(--border-medium)", background: "transparent",
                    color: "var(--text-secondary)", fontSize: 12,
                  }}
                  title="Zero resposta costuma ser equipamento desativado ainda cadastrado, ou obra pendente — e cada um puxa a disponibilidade geral para baixo."
                >
                  <b className="num" style={{ color: "var(--mon-down)" }}>{semResposta.length}</b>
                  <span>sem responder o período inteiro</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{verSemResposta ? "recolher" : "ver lista"}</span>
                </button>
                {verSemResposta && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 7 }}>
                    {semResposta.map((s, i) => (
                      <span key={i} title={s.ip || s.nome}
                        style={{ fontSize: 10, fontFamily: "var(--font-mono)", padding: "2px 6px", borderRadius: 4, background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
                        {s.nome}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {topIndisp.length === 0 ? (
              <Vazio loading={loading} msg={semResposta.length ? "Fora os acima, ninguém oscilou no período." : "Sem indisponibilidade registrada no período (ou dados ainda em coleta)."} />
            ) : (
              <div style={{ height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={topIndisp} layout="vertical" margin={{ left: 70, right: 40 }}>
                    <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, "dataMax"]} tick={{ fontSize: 10 }} unit="%" />
                    <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} width={130} />
                    <Tooltip formatter={(v: any, _n: any, p: any) => [`${v}% indisponível · ${p.payload.pct.toFixed(2)}% disponível`, p.payload.full]} />
                    <Bar dataKey="indisp" fill="var(--mon-down)" radius={[0,4,4,0]}>
                      <LabelList dataKey="indisp" position="right" formatter={(v: any) => `${v}%`} style={{ fontSize: 10, fill: "var(--text-secondary)" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 13, fontWeight: 700 }}>
              <Clock size={14} style={{ color: "var(--mon-warn)" }} /> Maior latência atual
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
                      {/* Este gráfico já É o ranking dos dez piores: pintar cada
                          barra pelo limiar absoluto deixa as dez da mesma cor e
                          a cor para de informar. Quem compara aqui é o
                          comprimento; a cor fica reservada para quem passa do
                          limite que dói de verdade. */}
                      {latData.map((d, i) => <Cell key={i} fill={d.ms >= 200 ? "var(--mon-down)" : "var(--accent-cyan)"} />)}
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
            <RefreshCw size={14} style={{ color: "var(--mon-warn)" }} /> Equipamentos que mais caíram ({PERIODO_LABEL[periodo]})
          </div>
          {reincidentes.length === 0 ? (
            <Vazio loading={loading} msg="Nenhuma queda registrada no período. 🎉" />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
              {reincidentes.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: "var(--bg-hover)" }}>
                  <span className="metric" style={{ fontSize: 17, color: i < 3 ? "var(--accent-red)" : "var(--text-muted)", minWidth: 28 }}>{r.n}×</span>
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
                        ? <span style={{ marginLeft: 6, fontSize: 10, color: "var(--mon-ok)" }}>✓</span>
                        : <span style={{ marginLeft: 6, fontSize: 10, color: "var(--mon-down)" }}>✗</span>)}
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

/**
 * Indicador do topo.
 *
 * `destaque` existe porque os cinco tinham o mesmo peso: o SLA médio, que é a
 * resposta da tela, competia de igual para igual com "sem dados: 0". Numa
 * faixa achatada o olho não sabe por onde começar.
 */
function Kpi({ label, value, color, sub, destaque }: { label: string; value: any; color: string; sub?: string; destaque?: boolean }) {
  return (
    <div
      className="card"
      style={{
        padding: destaque ? "18px 20px" : 16,
        borderLeft: `3px solid ${color}`,
        background: destaque ? `color-mix(in srgb, ${color} 6%, var(--bg-card))` : undefined,
      }}
    >
      <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div className="metric" style={{ fontSize: destaque ? 36 : 25, color, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{value}</div>
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
