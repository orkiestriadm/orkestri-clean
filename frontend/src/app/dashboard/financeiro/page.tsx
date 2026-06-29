"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import {
  Wallet, TrendingDown, AlertCircle, Clock, Building2, CheckCircle2,
  RefreshCw, ChevronRight, Filter, CalendarClock, Coins, AlertTriangle,
} from "lucide-react";

const R = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

const STATUS_COLOR: Record<string, string> = {
  pago: "#16a34a",
  vencido: "#dc2626",
  a_vencer: "#d97706",
};
const STATUS_LABEL: Record<string, string> = {
  pago: "Pago",
  vencido: "Vencido",
  a_vencer: "A Vencer",
};

const CHART_COLORS = ["#6366f1","#f59e0b","#10b981","#ef4444","#3b82f6","#8b5cf6","#ec4899","#14b8a6"];

type Kpis = {
  total: number; valorTotal: number; valorPago: number; valorPendente: number;
  valorVencido: number; valorAVencer: number; ticketMedio: number;
  qVencidas: number; qAVencer: number; qFornecedores: number;
};

export default function FinanceiroDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ inicio: "", fim: "", fornecedor: "", centroCusto: "" });
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filters.inicio) params.inicio = filters.inicio;
      if (filters.fim)    params.fim    = filters.fim;
      if (filters.fornecedor)  params.fornecedor  = filters.fornecedor;
      if (filters.centroCusto) params.centroCusto = filters.centroCusto;
      const { data: d } = await api.get("/financeiro/dashboard", { params });
      setData(d);
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const kpis: Kpis = data?.kpis || { total: 0, valorTotal: 0, valorPago: 0, valorPendente: 0, valorVencido: 0, valorAVencer: 0, ticketMedio: 0, qVencidas: 0, qAVencer: 0, qFornecedores: 0 };
  const proximos = data?.proximos || { d7: { qty: 0, valor: 0 }, d30: { qty: 0, valor: 0 } };

  return (
    <>
      <Topbar />
      <div className="page-content">
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 24px 60px" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px -6px rgba(99,102,241,0.6)" }}>
              <Wallet size={22} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Dashboard Financeiro</h1>
              <p style={{ color: "var(--text-muted)", margin: "2px 0 0", fontSize: 13 }}>Visão geral das contas a pagar</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowFilters(s => !s)} className="btn btn-ghost" style={{ fontSize: 12, gap: 6 }}>
                <Filter size={14} /> Filtros
              </button>
              <button onClick={load} className="btn btn-ghost" style={{ fontSize: 12 }}><RefreshCw size={14} /></button>
              <Link href="/dashboard/financeiro/contas-a-pagar" className="btn btn-violet" style={{ fontSize: 12, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                Ver Títulos <ChevronRight size={14} />
              </Link>
            </div>
          </div>

          {/* Filters bar */}
          {showFilters && (
            <div className="card-premium" style={{ padding: "14px 18px", marginBottom: 20, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              <FilterInput label="Período início" type="date" value={filters.inicio} onChange={v => setFilters(f => ({ ...f, inicio: v }))} />
              <FilterInput label="Período fim"    type="date" value={filters.fim}    onChange={v => setFilters(f => ({ ...f, fim: v }))} />
              <FilterInput label="Fornecedor"     value={filters.fornecedor}  onChange={v => setFilters(f => ({ ...f, fornecedor: v }))} />
              <FilterInput label="C. Custo"       value={filters.centroCusto} onChange={v => setFilters(f => ({ ...f, centroCusto: v }))} />
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                <button onClick={load} className="btn btn-violet" style={{ fontSize: 12, flex: 1 }}>Aplicar</button>
                <button onClick={() => { setFilters({ inicio: "", fim: "", fornecedor: "", centroCusto: "" }); }} className="btn btn-ghost" style={{ fontSize: 12 }}>Limpar</button>
              </div>
            </div>
          )}

          {loading ? <LoadingSkeleton /> : (
            <>
              {/* KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
                <KpiCard label="Total de Títulos"   valor={kpis.total.toString()} icon={<TrendingDown size={18} />} cor="#6366f1" />
                <KpiCard label="Valor Total"         valor={R(kpis.valorTotal)}    icon={<Wallet size={18} />} cor="var(--text-primary)" />
                <KpiCard label="Valor Pago"          valor={R(kpis.valorPago)}     icon={<CheckCircle2 size={18} />} cor="#16a34a" />
                <KpiCard label="Valor Pendente"      valor={R(kpis.valorPendente)} icon={<Clock size={18} />} cor="#d97706" />
                <KpiCard label="Valor Vencido"       valor={R(kpis.valorVencido)}  icon={<AlertTriangle size={18} />} cor={kpis.valorVencido > 0 ? "#dc2626" : "var(--text-muted)"} sub={`${kpis.qVencidas} título${kpis.qVencidas !== 1 ? "s" : ""}`} />
                <KpiCard label="Valor a Vencer"      valor={R(kpis.valorAVencer)}  icon={<CalendarClock size={18} />} cor="#3b82f6" sub={`${kpis.qAVencer} título${kpis.qAVencer !== 1 ? "s" : ""}`} />
                <KpiCard label="Vencendo em 7 dias"  valor={R(proximos.d7.valor)}  icon={<AlertCircle size={18} />} cor="#d97706" sub={`${proximos.d7.qty} título${proximos.d7.qty !== 1 ? "s" : ""}`} />
                <KpiCard label="Vencendo em 30 dias" valor={R(proximos.d30.valor)} icon={<CalendarClock size={18} />} cor="#0891b2" sub={`${proximos.d30.qty} título${proximos.d30.qty !== 1 ? "s" : ""}`} />
                <KpiCard label="Ticket Médio"        valor={R(kpis.ticketMedio)}   icon={<Coins size={18} />} cor="#8b5cf6" />
                <KpiCard label="Fornecedores"        valor={kpis.qFornecedores.toString()} icon={<Building2 size={18} />} cor="var(--text-muted)" />
              </div>

              {/* Charts row 1 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 16 }}>
                {/* Status donut */}
                <div className="card-premium" style={{ padding: "18px 20px" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px" }}>Por Status</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={data?.distribuicaoStatus || []} dataKey="qty" nameKey="status" cx="50%" cy="50%" innerRadius={50} outerRadius={80} label={(props: any) => `${STATUS_LABEL[props.status] || props.status} ${((props.percent || 0) * 100).toFixed(0)}%`} labelLine={false}>
                        {(data?.distribuicaoStatus || []).map((e: any, i: number) => (
                          <Cell key={i} fill={STATUS_COLOR[e.status] || CHART_COLORS[i]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any, name: string) => [v, STATUS_LABEL[name] || name]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                    {(data?.distribuicaoStatus || []).map((e: any) => (
                      <span key={e.status} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--text-muted)" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLOR[e.status] || "#888", flexShrink: 0 }} />
                        {STATUS_LABEL[e.status] || e.status}: <b style={{ color: "var(--text-primary)" }}>{e.qty}</b>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Evolução mensal */}
                <div className="card-premium" style={{ padding: "18px 20px" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px" }}>Evolução Mensal (R$)</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={data?.evolucaoMensal || []}>
                      <defs>
                        <linearGradient id="gradPend" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                        <linearGradient id="gradPago" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#16a34a" stopOpacity={0.25}/><stop offset="95%" stopColor="#16a34a" stopOpacity={0}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <YAxis tickFormatter={(v) => R(v).replace("R$ ", "R$")} tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={80} />
                      <Tooltip formatter={(v: any) => R(Number(v))} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="pendente" name="Pendente" stroke="#f59e0b" fill="url(#gradPend)" strokeWidth={2} />
                      <Area type="monotone" dataKey="pago"     name="Pago"     stroke="#16a34a" fill="url(#gradPago)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Charts row 2 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {/* Top fornecedores */}
                <div className="card-premium" style={{ padding: "18px 20px" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px" }}>Top Fornecedores por Valor</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={data?.topFornecedores || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                      <XAxis type="number" tickFormatter={(v) => R(v)} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                      <YAxis type="category" dataKey="nome" tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={120} />
                      <Tooltip formatter={(v: any) => R(Number(v))} />
                      <Bar dataKey="valor" name="Valor" radius={[0, 4, 4, 0]}>
                        {(data?.topFornecedores || []).map((_: any, i: number) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Por tipo */}
                <div className="card-premium" style={{ padding: "18px 20px" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px" }}>Distribuição por Tipo</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={data?.distribuicaoTipo || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                      <XAxis dataKey="tipo" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <Tooltip />
                      <Bar dataKey="qty" name="Qtd" radius={[4, 4, 0, 0]}>
                        {(data?.distribuicaoTipo || []).map((_: any, i: number) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Charts row 3 — Aging + Natureza */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                {/* Aging (vencidos por faixa de atraso) */}
                <div className="card-premium" style={{ padding: "18px 20px" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>Vencidos por Faixa de Atraso</h3>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 14px" }}>Valor em aberto, agrupado por dias de atraso (calculado pela data real)</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data?.aging || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                      <XAxis dataKey="faixa" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <YAxis tickFormatter={(v) => R(v).replace("R$ ", "R$")} tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={80} />
                      <Tooltip formatter={(v: any, n: string) => n === "valor" ? R(Number(v)) : v} labelStyle={{ fontWeight: 700 }} />
                      <Bar dataKey="valor" name="Valor" radius={[4, 4, 0, 0]}>
                        {(data?.aging || []).map((_: any, i: number) => (
                          <Cell key={i} fill={["#f59e0b", "#f97316", "#ea580c", "#dc2626"][i] || "#dc2626"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", justifyContent: "space-around", marginTop: 8, flexWrap: "wrap", gap: 8 }}>
                    {(data?.aging || []).map((a: any, i: number) => (
                      <span key={i} style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
                        <span style={{ color: ["#f59e0b","#f97316","#ea580c","#dc2626"][i], fontWeight: 700 }}>{a.qty}</span> tít.
                      </span>
                    ))}
                  </div>
                </div>

                {/* Por natureza */}
                <div className="card-premium" style={{ padding: "18px 20px" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px" }}>Top Naturezas por Valor</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={data?.topNatureza || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                      <XAxis type="number" tickFormatter={(v) => R(v)} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                      <YAxis type="category" dataKey="natureza" tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={90} />
                      <Tooltip formatter={(v: any) => R(Number(v))} />
                      <Bar dataKey="valor" name="Valor" radius={[0, 4, 4, 0]}>
                        {(data?.topNatureza || []).map((_: any, i: number) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function KpiCard({ label, valor, icon, cor, sub }: { label: string; valor: string; icon: React.ReactNode; cor: string; sub?: string }) {
  return (
    <div className="card-premium" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ color: cor }}>{icon}</span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: cor, lineHeight: 1.1, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{valor}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1, opacity: 0.8 }}>{sub}</div>}
      </div>
    </div>
  );
}

function FilterInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 12 }} />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
      {[...Array(7)].map((_, i) => (
        <div key={i} className="card-premium" style={{ padding: "14px 18px", height: 70, background: "var(--bg-secondary)", animation: "pulse 1.5s infinite" }} />
      ))}
    </div>
  );
}
