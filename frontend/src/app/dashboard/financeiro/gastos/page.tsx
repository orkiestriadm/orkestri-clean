"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback, type CSSProperties, type ReactNode } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import {
  Receipt, Plus, Pencil, Trash2, X, CalendarDays, Wallet, TrendingDown,
  Loader2, MessageCircle, Search,
} from "lucide-react";

// ── Config ──────────────────────────────────────────────────────────────────
const FORMAS = ["CREDITO", "DEBITO", "PIX", "DINHEIRO", "BOLETO", "NAO_INFORMADO"] as const;
const FORMA_LABEL: Record<string, string> = {
  CREDITO: "Crédito", DEBITO: "Débito", PIX: "Pix", DINHEIRO: "Dinheiro", BOLETO: "Boleto", NAO_INFORMADO: "Não informada",
};
const FORMA_COR: Record<string, string> = {
  CREDITO: "#6366f1", DEBITO: "#3b82f6", PIX: "#10b981", DINHEIRO: "#f59e0b", BOLETO: "#8b5cf6", NAO_INFORMADO: "#94a3b8",
};
type Preset = "hoje" | "sem" | "mes" | "anterior" | null;

// ── Types ───────────────────────────────────────────────────────────────────
type Gasto = {
  id: string; descricao: string; categoria?: string | null; valor: number;
  formaPagamento: string; parcelas: number; valorParcela?: number | null;
  dataGasto: string; origem: string;
};
type Meta = { id: string; categoria: string; limiteMensal: number; gastoMes: number };
type Resumo = {
  cards: { hoje: { total: number; qtd: number }; semana: { total: number; qtd: number }; mes: { total: number; qtd: number } };
  insights: {
    maiorGasto: { descricao: string; valor: number } | null;
    mediaDia: number; mesAtual: number; mesAnterior: number;
    projecaoMes: number; variacaoMes: number | null;
  };
  periodo: {
    inicio: string; fim: string; total: number; qtd: number;
    porForma: { forma: string; label: string; valor: number; qtd: number }[];
    porCategoria: { categoria: string; valor: number; qtd: number }[];
    porDia: { dia: string; label: string; valor: number }[];
  };
};

// ── Formatters ──────────────────────────────────────────────────────────────
const R = (v?: number | null) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const R0 = (v?: number | null) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtD = (iso?: string) => iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hojeStr = () => isoDay(new Date());
const inicioMes = () => { const d = new Date(); return isoDay(new Date(d.getFullYear(), d.getMonth(), 1)); };
const fimMes = () => { const d = new Date(); return isoDay(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };

const card: CSSProperties = {
  background: "var(--surface, #fff)", border: "1px solid var(--border, #e5e7eb)",
  borderRadius: 14, padding: 18,
};

// ── Page ────────────────────────────────────────────────────────────────────
export default function GastosPage() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [rows, setRows] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [inicio, setInicio] = useState(inicioMes());
  const [fim, setFim] = useState(fimMes());
  const [preset, setPreset] = useState<Preset>("mes");
  const [q, setQ] = useState("");
  const [forma, setForma] = useState("");        // filtra a tabela
  const [categoria, setCategoria] = useState(""); // filtra a tabela
  const [metas, setMetas] = useState<Meta[]>([]);
  const [modal, setModal] = useState<null | { editing?: Gasto }>(null);
  const [metaModal, setMetaModal] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { inicio, fim };
      const [r, l] = await Promise.all([
        api.get("/gastos/resumo", { params }),
        api.get("/gastos", { params: { ...params, q: q || undefined, forma: forma || undefined, categoria: categoria || undefined, limit: 200 } }),
      ]);
      setResumo(r.data);
      setRows(l.data.rows || []);
    } catch {
      // silencioso: a tela mostra estado vazio
    } finally {
      setLoading(false);
    }
  }, [inicio, fim, q, forma, categoria]);

  const carregarMetas = useCallback(async () => {
    try { const { data } = await api.get("/gastos/metas"); setMetas(data || []); } catch { /* vazio */ }
  }, []);
  useEffect(() => { carregarMetas(); }, [carregarMetas]);

  useEffect(() => { carregar(); }, [carregar]);

  const aplicarPreset = (tipo: Exclude<Preset, null>) => {
    const d = new Date();
    if (tipo === "hoje") { setInicio(hojeStr()); setFim(hojeStr()); }
    else if (tipo === "sem") { const i = new Date(); i.setDate(i.getDate() - 6); setInicio(isoDay(i)); setFim(hojeStr()); }
    else if (tipo === "mes") { setInicio(inicioMes()); setFim(fimMes()); }
    else { setInicio(isoDay(new Date(d.getFullYear(), d.getMonth() - 1, 1))); setFim(isoDay(new Date(d.getFullYear(), d.getMonth(), 0))); }
    setPreset(tipo);
  };
  const mudarData = (qual: "inicio" | "fim", v: string) => { (qual === "inicio" ? setInicio : setFim)(v); setPreset(null); };

  const excluir = async (g: Gasto) => {
    if (!confirm(`Excluir o gasto "${g.descricao}"?`)) return;
    await api.delete(`/gastos/${g.id}`).catch(() => {});
    carregar();
  };
  const excluirMeta = async (m: Meta) => {
    if (!confirm(`Remover a meta de ${m.categoria}?`)) return;
    await api.delete(`/gastos/metas/${m.id}`).catch(() => {});
    carregarMetas();
  };

  const per = resumo?.periodo;
  const donut = (per?.porForma || []).map(f => ({ name: f.label, value: f.valor, forma: f.forma }));
  const temFiltroTabela = !!forma || !!categoria;

  return (
    <>
      <Topbar />
      <div className="page-content">
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "20px 20px 60px" }}>

          {/* Cabeçalho */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(99,102,241,0.12)", display: "grid", placeItems: "center" }}>
                <Receipt size={22} color="#6366f1" />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Meus Gastos</h1>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted, #6b7280)" }}>Só você vê os seus gastos. Toque num cartão para filtrar.</p>
              </div>
            </div>
            <button onClick={() => setModal({})} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#6366f1", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 700, cursor: "pointer" }}>
              <Plus size={16} /> Novo gasto
            </button>
          </div>

          {/* Cartões clicáveis (filtram o período) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 16 }}>
            <ResumoCard titulo="Hoje" valor={resumo?.cards.hoje.total} qtd={resumo?.cards.hoje.qtd} cor="#10b981" icon={<CalendarDays size={18} color="#10b981" />} ativo={preset === "hoje"} onClick={() => aplicarPreset("hoje")} />
            <ResumoCard titulo="Últimos 7 dias" valor={resumo?.cards.semana.total} qtd={resumo?.cards.semana.qtd} cor="#3b82f6" icon={<TrendingDown size={18} color="#3b82f6" />} ativo={preset === "sem"} onClick={() => aplicarPreset("sem")} />
            <ResumoCard titulo="Este mês" valor={resumo?.cards.mes.total} qtd={resumo?.cards.mes.qtd} cor="#6366f1" icon={<Wallet size={18} color="#6366f1" />} ativo={preset === "mes"} onClick={() => aplicarPreset("mes")} />
          </div>

          {/* Filtro de período */}
          <div style={{ ...card, marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {([["hoje", "Hoje"], ["sem", "7 dias"], ["mes", "Este mês"], ["anterior", "Mês passado"]] as [Exclude<Preset, null>, string][]).map(([k, lbl]) => (
                <button key={k} onClick={() => aplicarPreset(k)} style={chip(preset === k)}>{lbl}</button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
              <input type="date" value={inicio} onChange={e => mudarData("inicio", e.target.value)} style={inp} />
              <span style={{ color: "var(--text-muted,#6b7280)" }}>até</span>
              <input type="date" value={fim} onChange={e => mudarData("fim", e.target.value)} style={inp} />
            </div>
          </div>

          {/* Insights */}
          {resumo?.insights && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 16 }}>
              <Insight rotulo="Maior gasto" valor={resumo.insights.maiorGasto ? R(resumo.insights.maiorGasto.valor) : "—"} nota={resumo.insights.maiorGasto?.descricao || "no período"} />
              <Insight rotulo="Média por dia" valor={R(resumo.insights.mediaDia)} nota="no período" />
              <Insight rotulo="Projeção do mês" valor={R(resumo.insights.projecaoMes)} nota="no ritmo atual" />
              <Insight rotulo="vs. mês passado" valor={<Variacao v={resumo.insights.variacaoMes} />} nota={resumo.insights.mesAnterior ? `mês passado: ${R(resumo.insights.mesAnterior)}` : "sem base anterior"} />
            </div>
          )}

          {/* Gráficos */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 16 }} className="gastos-charts">
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Gasto por dia</h3>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted,#6b7280)" }}>Total no período</div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{R(per?.total)}</div>
                </div>
              </div>
              <div style={{ height: 260 }}>
                {per && per.porDia.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={per.porDia} margin={{ top: 6, right: 6, left: -18, bottom: 0 }} barCategoryGap={per.porDia.length > 12 ? 2 : "28%"}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border,#eef0f3)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => R0(v)} width={64} />
                      <Tooltip cursor={{ fill: "rgba(99,102,241,0.06)" }} formatter={(v: any) => R(Number(v))} labelFormatter={(l) => `Dia ${l}`} />
                      <Bar dataKey="valor" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={46} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Vazio texto="Sem gastos no período." />}
              </div>
            </div>

            <div style={card}>
              <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700 }}>Por forma de pagamento</h3>
              {donut.length > 0 ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 150, height: 190 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={donut} dataKey="value" nameKey="name" innerRadius={44} outerRadius={72} paddingAngle={2}>
                          {donut.map((d, i) => <Cell key={i} fill={FORMA_COR[d.forma] || "#94a3b8"} opacity={forma && forma !== d.forma ? 0.35 : 1} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => R(Number(v))} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ flex: 1, display: "grid", gap: 4 }}>
                    {(per?.porForma || []).map(f => (
                      <button key={f.forma} onClick={() => setForma(forma === f.forma ? "" : f.forma)} title="Filtrar a lista por esta forma"
                        style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, background: forma === f.forma ? "var(--bg,#f1f2f4)" : "transparent", border: "none", borderRadius: 8, padding: "6px 8px", cursor: "pointer", textAlign: "left", width: "100%", color: "inherit" }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: FORMA_COR[f.forma] || "#94a3b8" }} />
                        <span style={{ flex: 1 }}>{f.label}</span>
                        <b>{R(f.valor)}</b>
                      </button>
                    ))}
                  </div>
                </div>
              ) : <Vazio texto="Sem dados." />}
            </div>
          </div>

          {/* Por categoria (clicável) */}
          {per && per.porCategoria.length > 0 && (
            <div style={{ ...card, marginBottom: 16 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>Por categoria</h3>
              <div style={{ display: "grid", gap: 6 }}>
                {per.porCategoria.slice(0, 8).map(c => {
                  const pct = per.total > 0 ? (c.valor / per.total) * 100 : 0;
                  const on = categoria === c.categoria;
                  return (
                    <button key={c.categoria} onClick={() => setCategoria(on ? "" : c.categoria)} title="Filtrar a lista por esta categoria"
                      style={{ display: "flex", alignItems: "center", gap: 10, background: on ? "var(--bg,#f1f2f4)" : "transparent", border: "none", borderRadius: 8, padding: "6px 8px", cursor: "pointer", width: "100%", color: "inherit" }}>
                      <span style={{ width: 120, fontSize: 13, fontWeight: 600, textAlign: "left" }}>{c.categoria}</span>
                      <div style={{ flex: 1, height: 10, background: "var(--bg,#f1f2f4)", borderRadius: 999 }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: on ? "#4f46e5" : "#6366f1", borderRadius: 999 }} />
                      </div>
                      <span style={{ width: 110, textAlign: "right", fontSize: 13 }}><b>{R(c.valor)}</b></span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Orçamentos do mês */}
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: metas.length ? 14 : 6 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Orçamentos do mês</h3>
              <button onClick={() => setMetaModal(true)} style={{ ...chip(false), fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}><Plus size={13} /> Nova meta</button>
            </div>
            {metas.length === 0 ? (
              <p style={{ margin: 0, color: "var(--text-muted,#6b7280)", fontSize: 13 }}>Defina um limite por categoria (ex.: <b>Alimentação R$ 800/mês</b>) e eu te aviso ao chegar em 80% e ao estourar — inclusive pelo WhatsApp.</p>
            ) : (
              <div style={{ display: "grid", gap: 13 }}>
                {metas.map(m => {
                  const pct = m.limiteMensal > 0 ? m.gastoMes / m.limiteMensal : 0;
                  const cor = pct >= 1 ? "#dc2626" : pct >= 0.8 ? "#d97706" : "#16a34a";
                  return (
                    <div key={m.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, marginBottom: 5 }}>
                        <b>{m.categoria}</b>
                        <span style={{ color: "var(--text-muted,#6b7280)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {R(m.gastoMes)} <span style={{ color: "var(--line-strong,#d3d6e6)" }}>/</span> {R(m.limiteMensal)}
                          <button onClick={() => excluirMeta(m)} style={{ ...iconBtn, padding: 2, color: "#dc2626" }} title="Remover meta"><Trash2 size={13} /></button>
                        </span>
                      </div>
                      <div style={{ height: 10, background: "var(--bg,#f1f2f4)", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(100, pct * 100)}%`, height: "100%", background: cor, borderRadius: 999, transition: "width .3s" }} />
                      </div>
                      {pct >= 0.8 && <div style={{ fontSize: 11, color: cor, marginTop: 4, fontWeight: 700 }}>{pct >= 1 ? "⚠️ Estourou o orçamento" : `${Math.round(pct * 100)}% do limite`}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Busca + filtro forma + chips de filtro ativo */}
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "#9ca3af" }} />
              <input placeholder="Buscar por descrição…" value={q} onChange={e => setQ(e.target.value)} style={{ ...inp, width: "100%", paddingLeft: 32 }} />
            </div>
            <select value={forma} onChange={e => setForma(e.target.value)} style={inp}>
              <option value="">Todas as formas</option>
              {FORMAS.filter(f => f !== "NAO_INFORMADO").map(f => <option key={f} value={f}>{FORMA_LABEL[f]}</option>)}
            </select>
          </div>
          {temFiltroTabela && (
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted,#6b7280)" }}>Filtrando:</span>
              {forma && <Chip label={FORMA_LABEL[forma] || forma} onX={() => setForma("")} />}
              {categoria && <Chip label={categoria} onX={() => setCategoria("")} />}
              <button onClick={() => { setForma(""); setCategoria(""); }} style={{ ...chip(false), fontSize: 12 }}>Limpar</button>
            </div>
          )}

          {/* Tabela */}
          <div style={{ ...card, padding: 0, overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted,#6b7280)" }}><Loader2 className="spin" size={22} /></div>
            ) : rows.length === 0 ? (
              temFiltroTabela ? (
                <div style={{ padding: "36px 20px", textAlign: "center" }}>
                  <p style={{ margin: "0 0 6px", fontWeight: 700 }}>Nenhum gasto com esse filtro.</p>
                  <button onClick={() => { setForma(""); setCategoria(""); }} style={{ ...chip(false), fontSize: 13 }}>Limpar filtros</button>
                </div>
              ) : (
                <div style={{ padding: "44px 24px", textAlign: "center", display: "grid", gap: 14, placeItems: "center" }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(99,102,241,0.12)", display: "grid", placeItems: "center" }}>
                    <Receipt size={26} color="#6366f1" />
                  </div>
                  <div>
                    <p style={{ margin: "0 0 4px", fontWeight: 800, fontSize: 17 }}>Comece a anotar seus gastos</p>
                    <p style={{ margin: 0, color: "var(--text-muted,#6b7280)", fontSize: 14 }}>É rápido, e só você vê. Dá pra fazer de dois jeitos:</p>
                  </div>
                  <div style={{ display: "grid", gap: 10, width: "100%", maxWidth: 440, textAlign: "left" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid var(--border,#e5e7eb)", borderRadius: 12 }}>
                      <MessageCircle size={20} color="#25D366" style={{ flexShrink: 0 }} />
                      <div style={{ fontSize: 13 }}>Pelo WhatsApp, mande: <b>Gasto: Mercado 150 no crédito</b></div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid var(--border,#e5e7eb)", borderRadius: 12 }}>
                      <Plus size={20} color="#6366f1" style={{ flexShrink: 0 }} />
                      <div style={{ fontSize: 13 }}>Aqui na tela, toque em <b>Novo gasto</b> e preencha.</div>
                    </div>
                  </div>
                  <button onClick={() => setModal({})} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#6366f1", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer" }}>
                    <Plus size={16} /> Lançar meu primeiro gasto
                  </button>
                </div>
              )
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--bg,#f7f8fa)", textAlign: "left" }}>
                      <th style={th}>Data</th><th style={th}>Descrição</th><th style={th}>Categoria</th>
                      <th style={th}>Forma</th><th style={{ ...th, textAlign: "right" }}>Valor</th><th style={{ ...th, width: 80 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(g => (
                      <tr key={g.id} style={{ borderTop: "1px solid var(--border,#eef0f3)" }}>
                        <td style={td}>{fmtD(g.dataGasto)}</td>
                        <td style={{ ...td, fontWeight: 600 }}>
                          {g.descricao}
                          {g.origem === "WHATSAPP" && <MessageCircle size={12} color="#25D366" style={{ marginLeft: 6, verticalAlign: "middle" }} />}
                        </td>
                        <td style={td}>{g.categoria || <span style={{ color: "#9ca3af" }}>—</span>}</td>
                        <td style={td}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: FORMA_COR[g.formaPagamento] || "#94a3b8" }} />
                            {FORMA_LABEL[g.formaPagamento] || g.formaPagamento}
                            {g.parcelas > 1 && <span style={{ color: "#6b7280" }}> · {g.parcelas}x</span>}
                          </span>
                        </td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{R(g.valor)}</td>
                        <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                          <button onClick={() => setModal({ editing: g })} style={iconBtn} title="Editar"><Pencil size={14} /></button>
                          <button onClick={() => excluir(g)} style={{ ...iconBtn, color: "#dc2626" }} title="Excluir"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {modal && <GastoModal gasto={modal.editing} onClose={() => setModal(null)} onSaved={() => { setModal(null); carregar(); }} />}
      {metaModal && <MetaModal sugestoes={(resumo?.periodo.porCategoria || []).map(c => c.categoria)} onClose={() => setMetaModal(false)} onSaved={() => { setMetaModal(false); carregarMetas(); }} />}

      <style jsx global>{`
        .spin { animation: girar 1s linear infinite; }
        @keyframes girar { to { transform: rotate(360deg); } }
        @media (max-width: 820px) { .gastos-charts { grid-template-columns: 1fr !important; } }
      `}</style>
    </>
  );
}

// ── Sub-componentes ─────────────────────────────────────────────────────────
function ResumoCard({ titulo, valor, qtd, cor, icon, ativo, onClick }: { titulo: string; valor?: number; qtd?: number; cor: string; icon: ReactNode; ativo?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      ...card, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left", width: "100%", color: "inherit",
      borderColor: ativo ? cor : "var(--border,#e5e7eb)",
      boxShadow: ativo ? `0 0 0 2px ${cor}33` : "none", transition: "box-shadow .15s, border-color .15s",
    }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: cor + "1f", display: "grid", placeItems: "center" }}>{icon}</div>
      <div>
        <div style={{ fontSize: 12, color: "var(--text-muted,#6b7280)" }}>{titulo}</div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{R(valor)}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted,#9ca3af)" }}>{qtd || 0} {qtd === 1 ? "lançamento" : "lançamentos"}</div>
      </div>
    </button>
  );
}

function Chip({ label, onX }: { label: string; onX: () => void }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(99,102,241,0.12)", color: "#4f46e5", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700 }}>
      {label}
      <X size={13} style={{ cursor: "pointer" }} onClick={onX} />
    </span>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--text-muted,#9ca3af)", fontSize: 13 }}>{texto}</div>;
}

function Insight({ rotulo, valor, nota }: { rotulo: string; valor: ReactNode; nota?: string }) {
  return (
    <div style={{ ...card, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", color: "var(--text-muted,#9ca3af)" }}>{rotulo}</div>
      <div style={{ fontSize: 19, fontWeight: 800, marginTop: 6 }}>{valor}</div>
      {nota && <div style={{ fontSize: 12, color: "var(--text-muted,#9ca3af)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nota}</div>}
    </div>
  );
}

// Variação de gasto: gastar MAIS é ruim (vermelho ▲), gastar MENOS é bom (verde ▼).
function Variacao({ v }: { v: number | null }) {
  if (v == null) return <span style={{ color: "var(--text-muted,#9ca3af)" }}>—</span>;
  const pct = Math.round(Math.abs(v) * 100);
  if (pct === 0) return <span>igual</span>;
  const subiu = v > 0;
  return <span style={{ color: subiu ? "#dc2626" : "#16a34a" }}>{subiu ? "▲" : "▼"} {pct}%</span>;
}

function GastoModal({ gasto, onClose, onSaved }: { gasto?: Gasto; onClose: () => void; onSaved: () => void }) {
  const [descricao, setDescricao] = useState(gasto?.descricao || "");
  const [valor, setValor] = useState(gasto ? String(gasto.valor) : "");
  const [formaPagamento, setForma] = useState(gasto?.formaPagamento || "NAO_INFORMADO");
  const [parcelas, setParcelas] = useState(String(gasto?.parcelas || 1));
  const [categoria, setCategoria] = useState(gasto?.categoria || "");
  const [dataGasto, setDataGasto] = useState(gasto ? isoDay(new Date(gasto.dataGasto)) : hojeStr());
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  const salvar = async () => {
    setErro("");
    const v = parseFloat(valor.replace(",", "."));
    if (!descricao.trim()) return setErro("Escreva o que você gastou.");
    if (!v || v <= 0) return setErro("Informe um valor válido.");
    setSaving(true);
    try {
      const body = { descricao: descricao.trim(), valor: v, formaPagamento, parcelas: Math.max(1, parseInt(parcelas) || 1), categoria: categoria.trim() || undefined, dataGasto };
      if (gasto) await api.put(`/gastos/${gasto.id}`, body);
      else await api.post("/gastos", body);
      onSaved();
    } catch {
      setErro("Não consegui salvar. Tente de novo.");
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", zIndex: 50, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface,#fff)", borderRadius: 16, width: "100%", maxWidth: 420, padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{gasto ? "Editar gasto" : "Novo gasto"}</h3>
          <button onClick={onClose} style={{ ...iconBtn }}><X size={18} /></button>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <Campo label="O que você gastou?"><input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: Mercado" style={inpFull} autoFocus /></Campo>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Campo label="Valor (R$)"><input value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" inputMode="decimal" style={inpFull} /></Campo>
            <Campo label="Data"><input type="date" value={dataGasto} onChange={e => setDataGasto(e.target.value)} style={inpFull} /></Campo>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Campo label="Como pagou?">
              <select value={formaPagamento} onChange={e => setForma(e.target.value)} style={inpFull}>
                {FORMAS.map(f => <option key={f} value={f}>{FORMA_LABEL[f]}</option>)}
              </select>
            </Campo>
            <Campo label="Parcelas"><input value={parcelas} onChange={e => setParcelas(e.target.value)} inputMode="numeric" style={inpFull} /></Campo>
          </div>
          <Campo label="Categoria (opcional)"><input value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Ex.: Mercado" style={inpFull} /></Campo>
          {erro && <div style={{ color: "#dc2626", fontSize: 13 }}>{erro}</div>}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1px solid var(--border,#e5e7eb)", background: "var(--surface,#fff)", fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
          <button onClick={salvar} disabled={saving} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: "#6366f1", color: "#fff", fontWeight: 700, cursor: "pointer", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 6 }}>
            {saving && <Loader2 className="spin" size={15} />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function MetaModal({ sugestoes, onClose, onSaved }: { sugestoes: string[]; onClose: () => void; onSaved: () => void }) {
  const [categoria, setCategoria] = useState("");
  const [limite, setLimite] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const opcoes = Array.from(new Set(sugestoes.filter(Boolean)));

  const salvar = async () => {
    setErro("");
    const v = parseFloat(limite.replace(",", "."));
    if (!categoria.trim()) return setErro("Escolha a categoria.");
    if (!v || v <= 0) return setErro("Informe um limite válido.");
    setSaving(true);
    try {
      await api.post("/gastos/metas", { categoria: categoria.trim(), limiteMensal: v });
      onSaved();
    } catch { setErro("Não consegui salvar. Tente de novo."); setSaving(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", zIndex: 50, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface,#fff)", borderRadius: 16, width: "100%", maxWidth: 400, padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Nova meta do mês</h3>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <Campo label="Categoria">
            <input value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Ex.: Alimentação" list="cats-meta" style={inpFull} autoFocus />
            <datalist id="cats-meta">{opcoes.map(c => <option key={c} value={c} />)}</datalist>
          </Campo>
          <Campo label="Limite por mês (R$)"><input value={limite} onChange={e => setLimite(e.target.value)} placeholder="0,00" inputMode="decimal" style={inpFull} /></Campo>
          {erro && <div style={{ color: "#dc2626", fontSize: 13 }}>{erro}</div>}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1px solid var(--border,#e5e7eb)", background: "var(--surface,#fff)", fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
          <button onClick={salvar} disabled={saving} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: "#6366f1", color: "#fff", fontWeight: 700, cursor: "pointer", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 6 }}>
            {saving && <Loader2 className="spin" size={15} />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 5 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted,#6b7280)" }}>{label}</span>
      {children}
    </label>
  );
}

// ── Estilos ─────────────────────────────────────────────────────────────────
const inp: CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border,#e5e7eb)", background: "var(--surface,#fff)", fontSize: 13, color: "inherit" };
const inpFull: CSSProperties = { ...inp, width: "100%" };
const th: CSSProperties = { padding: "11px 14px", fontSize: 12, fontWeight: 700, color: "var(--text-muted,#6b7280)", textTransform: "uppercase", letterSpacing: 0.3 };
const td: CSSProperties = { padding: "11px 14px" };
const iconBtn: CSSProperties = { background: "transparent", border: "none", cursor: "pointer", padding: 6, borderRadius: 6, color: "inherit" };
const chip = (on: boolean): CSSProperties => ({
  padding: "7px 12px", borderRadius: 8, border: `1px solid ${on ? "#6366f1" : "var(--border,#e5e7eb)"}`,
  background: on ? "rgba(99,102,241,0.10)" : "var(--surface,#fff)", color: on ? "#4f46e5" : "inherit",
  cursor: "pointer", fontWeight: 600, fontSize: 13,
});
