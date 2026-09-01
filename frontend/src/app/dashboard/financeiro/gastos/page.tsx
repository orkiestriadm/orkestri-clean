"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback, type CSSProperties, type ReactNode } from "react";
import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
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

// ── Types ───────────────────────────────────────────────────────────────────
type Gasto = {
  id: string; descricao: string; categoria?: string | null; valor: number;
  formaPagamento: string; parcelas: number; valorParcela?: number | null;
  dataGasto: string; origem: string;
};
type Resumo = {
  cards: { hoje: { total: number; qtd: number }; semana: { total: number; qtd: number }; mes: { total: number; qtd: number } };
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
  const [q, setQ] = useState("");
  const [forma, setForma] = useState("");
  const [modal, setModal] = useState<null | { editing?: Gasto }>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { inicio, fim };
      const [r, l] = await Promise.all([
        api.get("/gastos/resumo", { params }),
        api.get("/gastos", { params: { ...params, q: q || undefined, forma: forma || undefined, limit: 200 } }),
      ]);
      setResumo(r.data);
      setRows(l.data.rows || []);
    } catch {
      // silencioso: a tela mostra estado vazio
    } finally {
      setLoading(false);
    }
  }, [inicio, fim, q, forma]);

  useEffect(() => { carregar(); }, [carregar]);

  const setPeriodo = (tipo: "hoje" | "sem" | "mes" | "anterior") => {
    const d = new Date();
    if (tipo === "hoje") { setInicio(hojeStr()); setFim(hojeStr()); }
    else if (tipo === "sem") { const i = new Date(); i.setDate(i.getDate() - 6); setInicio(isoDay(i)); setFim(hojeStr()); }
    else if (tipo === "mes") { setInicio(inicioMes()); setFim(fimMes()); }
    else { setInicio(isoDay(new Date(d.getFullYear(), d.getMonth() - 1, 1))); setFim(isoDay(new Date(d.getFullYear(), d.getMonth(), 0))); }
  };

  const excluir = async (g: Gasto) => {
    if (!confirm(`Excluir o gasto "${g.descricao}"?`)) return;
    await api.delete(`/gastos/${g.id}`).catch(() => {});
    carregar();
  };

  const per = resumo?.periodo;
  const donut = (per?.porForma || []).map(f => ({ name: f.label, value: f.valor, forma: f.forma }));

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, #f7f8fa)" }}>
      <Topbar />
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "20px 20px 60px" }}>

        {/* Cabeçalho */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(99,102,241,0.12)", display: "grid", placeItems: "center" }}>
              <Receipt size={22} color="#6366f1" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Meus Gastos</h1>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted, #6b7280)" }}>Só você vê os seus gastos.</p>
            </div>
          </div>
          <button onClick={() => setModal({})} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#6366f1", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 700, cursor: "pointer" }}>
            <Plus size={16} /> Novo gasto
          </button>
        </div>

        {/* Cartões resumo */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 16 }}>
          <ResumoCard titulo="Hoje" valor={resumo?.cards.hoje.total} qtd={resumo?.cards.hoje.qtd} cor="#10b981" icon={<CalendarDays size={18} color="#10b981" />} />
          <ResumoCard titulo="Últimos 7 dias" valor={resumo?.cards.semana.total} qtd={resumo?.cards.semana.qtd} cor="#3b82f6" icon={<TrendingDown size={18} color="#3b82f6" />} />
          <ResumoCard titulo="Este mês" valor={resumo?.cards.mes.total} qtd={resumo?.cards.mes.qtd} cor="#6366f1" icon={<Wallet size={18} color="#6366f1" />} />
        </div>

        {/* Filtro de período */}
        <div style={{ ...card, marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[["hoje", "Hoje"], ["sem", "7 dias"], ["mes", "Este mês"], ["anterior", "Mês passado"]].map(([k, lbl]) => (
              <button key={k} onClick={() => setPeriodo(k as any)} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border,#e5e7eb)", background: "var(--surface,#fff)", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>{lbl}</button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
            <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} style={inp} />
            <span style={{ color: "var(--text-muted,#6b7280)" }}>até</span>
            <input type="date" value={fim} onChange={e => setFim(e.target.value)} style={inp} />
          </div>
        </div>

        {/* Total do período + gráficos */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 16 }} className="gastos-charts">
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Gasto por dia</h3>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: "var(--text-muted,#6b7280)" }}>Total no período</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{R(per?.total)}</div>
              </div>
            </div>
            <div style={{ height: 220 }}>
              {per && per.porDia.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={per.porDia} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gGasto" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border,#eef0f3)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => R0(v)} width={64} />
                    <Tooltip formatter={(v: any) => R(Number(v))} labelFormatter={(l) => `Dia ${l}`} />
                    <Area type="monotone" dataKey="valor" stroke="#6366f1" strokeWidth={2} fill="url(#gGasto)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <Vazio texto="Sem gastos no período." />}
            </div>
          </div>

          <div style={card}>
            <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700 }}>Por forma de pagamento</h3>
            {donut.length > 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 130, height: 150 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donut} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={2}>
                        {donut.map((d, i) => <Cell key={i} fill={FORMA_COR[d.forma] || "#94a3b8"} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => R(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: 1, display: "grid", gap: 6 }}>
                  {(per?.porForma || []).map(f => (
                    <div key={f.forma} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: FORMA_COR[f.forma] || "#94a3b8" }} />
                      <span style={{ flex: 1 }}>{f.label}</span>
                      <b>{R(f.valor)}</b>
                    </div>
                  ))}
                </div>
              </div>
            ) : <Vazio texto="Sem dados." />}
          </div>
        </div>

        {/* Por categoria */}
        {per && per.porCategoria.length > 0 && (
          <div style={{ ...card, marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>Por categoria</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {per.porCategoria.slice(0, 8).map(c => {
                const pct = per.total > 0 ? (c.valor / per.total) * 100 : 0;
                return (
                  <div key={c.categoria} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 120, fontSize: 13, fontWeight: 600 }}>{c.categoria}</span>
                    <div style={{ flex: 1, height: 10, background: "var(--bg,#f1f2f4)", borderRadius: 999 }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "#6366f1", borderRadius: 999 }} />
                    </div>
                    <span style={{ width: 110, textAlign: "right", fontSize: 13 }}><b>{R(c.valor)}</b></span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Busca + filtro forma */}
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "#9ca3af" }} />
            <input placeholder="Buscar por descrição…" value={q} onChange={e => setQ(e.target.value)} style={{ ...inp, width: "100%", paddingLeft: 32 }} />
          </div>
          <select value={forma} onChange={e => setForma(e.target.value)} style={inp}>
            <option value="">Todas as formas</option>
            {FORMAS.filter(f => f !== "NAO_INFORMADO").map(f => <option key={f} value={f}>{FORMA_LABEL[f]}</option>)}
          </select>
        </div>

        {/* Tabela */}
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted,#6b7280)" }}><Loader2 className="spin" size={22} /></div>
          ) : rows.length === 0 ? (
            <div style={{ padding: "36px 20px", textAlign: "center" }}>
              <p style={{ margin: "0 0 6px", fontWeight: 700 }}>Nenhum gasto neste período.</p>
              <p style={{ margin: 0, color: "var(--text-muted,#6b7280)", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <MessageCircle size={15} color="#25D366" /> Dica: anote pelo WhatsApp — <b>Gasto: Mercado 150 no crédito</b>
              </p>
            </div>
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

      {modal && <GastoModal gasto={modal.editing} onClose={() => setModal(null)} onSaved={() => { setModal(null); carregar(); }} />}

      <style jsx global>{`
        .spin { animation: girar 1s linear infinite; }
        @keyframes girar { to { transform: rotate(360deg); } }
        @media (max-width: 820px) { .gastos-charts { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}

// ── Sub-componentes ─────────────────────────────────────────────────────────
function ResumoCard({ titulo, valor, qtd, cor, icon }: { titulo: string; valor?: number; qtd?: number; cor: string; icon: ReactNode }) {
  return (
    <div style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: cor + "1f", display: "grid", placeItems: "center" }}>{icon}</div>
      <div>
        <div style={{ fontSize: 12, color: "var(--text-muted,#6b7280)" }}>{titulo}</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{R(valor)}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted,#9ca3af)" }}>{qtd || 0} {qtd === 1 ? "lançamento" : "lançamentos"}</div>
      </div>
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--text-muted,#9ca3af)", fontSize: 13 }}>{texto}</div>;
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
