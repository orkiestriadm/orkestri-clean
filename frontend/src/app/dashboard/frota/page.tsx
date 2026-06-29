"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import {
  Truck, CheckCircle2, Wrench, CalendarDays, CreditCard, Package, Activity, DollarSign, BarChart2, TrendingUp, Filter, RefreshCw, ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, ComposedChart, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const CHART_COLORS = ["#8b5cf6", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#f97316"];
const R = (v: any) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const TIPO_OPTS = [{ value: "carro", label: "Carro" }, { value: "moto", label: "Moto" }, { value: "van", label: "Van" }, { value: "caminhao", label: "Caminhão" }, { value: "onibus", label: "Ônibus" }];
const MANUT_LABEL: Record<string, string> = { aberta: "Aberta", em_andamento: "Em andamento", aguardando_pecas: "Aguard. peças", finalizada: "Finalizada", cancelada: "Cancelada" };
const REV_LABEL: Record<string, string> = { agendada: "Agendada", realizada: "Realizada", atrasada: "Atrasada", cancelada: "Cancelada" };
const PNEU_LABEL: Record<string, string> = { instalacao: "Instalação", remocao: "Remoção", rodizio: "Rodízio", recapagem: "Recapagem", descarte: "Descarte" };

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border-subtle)",
  background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 12.5,
};
const lblStyle: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 };
const chartTitleStyle: React.CSSProperties = { fontSize: 14, fontWeight: 700, margin: "0 0 16px" };
const tooltipStyle = { background: "var(--bg-card)", border: "1px solid var(--border-medium)", borderRadius: 10, fontSize: 12 };

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

export default function FrotaDashboardPage() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [centros, setCentros] = useState<any[]>([]);
  const [motoristas, setMotoristas] = useState<any[]>([]);
  const [f, setF] = useState<any>({ from: "", to: "", unidade: "", centroCustoId: "", tipo: "", veiculoId: "", motoristaId: "" });
  const [showFilters, setShowFilters] = useState(false);

  const setFilter = (k: string, v: string) => setF((p: any) => ({ ...p, [k]: v }));

  useEffect(() => {
    api.get("/frota/veiculos", { params: { limit: 500 } }).then(r => setVeiculos(r.data?.items || [])).catch(() => {});
    api.get("/orcamento/centros-custo").then(r => setCentros(r.data?.items ?? r.data ?? [])).catch(() => {});
    api.get("/frota/motoristas", { params: { limit: 500 } }).then(r => setMotoristas(r.data?.items || [])).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params: any = {};
    Object.entries(f).forEach(([k, v]) => { if (v) params[k] = v; });
    api.get("/frota/dashboard/executivo", { params }).then(r => setD(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [f]);

  useEffect(() => { load(); }, [load]);

  const unidades = Array.from(new Set(veiculos.map(v => v.unidade).filter(Boolean)));
  const k = d?.kpis || { totalVeiculos: 0, ativos: 0, emManutencao: 0, proximasRevisoes: 0, cnhVencer: 0, pneusEstoque: 0, pneusUso: 0, custoMes: 0, custoPorVeiculo: 0, disponibilidade: 0 };
  const c = d?.charts || {};

  return (
    <>
      <Topbar />
      <div className="page-content">
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 24px 60px" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#6d28d9", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px -6px rgba(109,40,217,0.6)" }}>
              <Truck size={22} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Dashboard de Frota</h1>
              <p style={{ color: "var(--text-muted)", margin: "2px 0 0", fontSize: 13 }}>Visão geral e custos da frota de veículos</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowFilters(s => !s)} className="btn btn-ghost" style={{ fontSize: 12, gap: 6 }}>
                <Filter size={14} /> Filtros
              </button>
              <button onClick={load} className="btn btn-ghost" style={{ fontSize: 12 }}><RefreshCw size={14} /></button>
              <Link href="/dashboard/frota/relatorios" className="btn btn-violet" style={{ fontSize: 12, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                Central de Relatórios <ChevronRight size={14} />
              </Link>
            </div>
          </div>

          {/* Filters bar */}
          {showFilters && (
            <div className="card-premium" style={{ padding: "14px 18px", marginBottom: 20, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              <div>
                <label style={lblStyle}>Período início</label>
                <input type="date" value={f.from} onChange={e => setFilter("from", e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={lblStyle}>Período fim</label>
                <input type="date" value={f.to} onChange={e => setFilter("to", e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={lblStyle}>Unidade</label>
                <select value={f.unidade} onChange={e => setFilter("unidade", e.target.value)} style={inputStyle}>
                  <option value="">Todas</option>
                  {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label style={lblStyle}>Centro de Custo</label>
                <select value={f.centroCustoId} onChange={e => setFilter("centroCustoId", e.target.value)} style={inputStyle}>
                  <option value="">Todos</option>
                  {centros.map((x: any) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={lblStyle}>Tipo Veículo</label>
                <select value={f.tipo} onChange={e => setFilter("tipo", e.target.value)} style={inputStyle}>
                  <option value="">Todos</option>
                  {TIPO_OPTS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lblStyle}>Veículo</label>
                <select value={f.veiculoId} onChange={e => setFilter("veiculoId", e.target.value)} style={inputStyle}>
                  <option value="">Todos</option>
                  {veiculos.map((v: any) => <option key={v.id} value={v.id}>{v.placa}</option>)}
                </select>
              </div>
              <div>
                <label style={lblStyle}>Motorista</label>
                <select value={f.motoristaId} onChange={e => setFilter("motoristaId", e.target.value)} style={inputStyle}>
                  <option value="">Todos</option>
                  {motoristas.map((m: any) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                <button onClick={load} className="btn btn-violet" style={{ fontSize: 12, flex: 1 }}>Aplicar</button>
                <button onClick={() => setF({ from: "", to: "", unidade: "", centroCustoId: "", tipo: "", veiculoId: "", motoristaId: "" })} className="btn btn-ghost" style={{ fontSize: 12 }}>Limpar</button>
              </div>
            </div>
          )}

          {loading ? <LoadingSkeleton /> : (
            <>
              {/* KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
                <KpiCard label="Total de Veículos" valor={k.totalVeiculos.toString()} icon={<Truck size={18} />} cor="var(--accent-violet)" />
                <KpiCard label="Veículos Ativos" valor={k.ativos.toString()} icon={<CheckCircle2 size={18} />} cor="var(--accent-green)" />
                <KpiCard label="Em Manutenção" valor={k.emManutencao.toString()} icon={<Wrench size={18} />} cor="var(--accent-amber)" />
                <KpiCard label="Próximas Revisões" valor={k.proximasRevisoes.toString()} icon={<CalendarDays size={18} />} cor="#06b6d4" />
                <KpiCard label="CNHs a Vencer" valor={k.cnhVencer.toString()} icon={<CreditCard size={18} />} cor="#f97316" />
                <KpiCard label="Pneus em Estoque" valor={k.pneusEstoque.toString()} icon={<Package size={18} />} cor="#8b5cf6" />
                <KpiCard label="Pneus em Uso" valor={k.pneusUso.toString()} icon={<Activity size={18} />} cor="#14b8a6" />
                <KpiCard label="Custos do Mês" valor={R(k.custoMes)} icon={<DollarSign size={18} />} cor="var(--accent-green)" />
                <KpiCard label="Custo por Veículo" valor={R(k.custoPorVeiculo)} icon={<BarChart2 size={18} />} cor="var(--accent-amber)" />
                <KpiCard label="Disponibilidade" valor={`${k.disponibilidade}%`} icon={<TrendingUp size={18} />} cor={k.disponibilidade >= 70 ? "var(--accent-green)" : "var(--accent-red)"} />
              </div>

              {/* Charts row 1 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16, marginBottom: 16 }}>
                <div className="card-premium" style={{ padding: "18px 20px" }}>
                  <h3 style={chartTitleStyle}>Custos Mensais</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={c.custosMensais || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={(v) => R(v)} width={70} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: string) => [R(v), ({ manut: "Manutenção", abast: "Abastec.", revisao: "Revisão", doc: "Documento" } as any)[n] || n]} />
                      <Legend wrapperStyle={{ fontSize: 11 }} formatter={(n) => ({ manut: "Manutenção", abast: "Abastec.", revisao: "Revisão", doc: "Documento" } as any)[n] || n} />
                      <Bar dataKey="manut" stackId="a" fill="#f59e0b" />
                      <Bar dataKey="abast" stackId="a" fill="#22c55e" />
                      <Bar dataKey="revisao" stackId="a" fill="#06b6d4" />
                      <Bar dataKey="doc" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="card-premium" style={{ padding: "18px 20px" }}>
                  <h3 style={chartTitleStyle}>Custos por Veículo (top 10)</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={c.custosPorVeiculo || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={(v) => R(v)} />
                      <YAxis type="category" dataKey="placa" tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={70} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => R(v)} />
                      <Bar dataKey="total" radius={[0, 4, 4, 0]}>{(c.custosPorVeiculo || []).map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Charts row 2 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16, marginBottom: 16 }}>
                <div className="card-premium" style={{ padding: "18px 20px" }}>
                  <h3 style={chartTitleStyle}>Custos por Unidade</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={c.custosPorUnidade || []} dataKey="total" nameKey="unidade" cx="50%" cy="50%" outerRadius={80} label={(e: any) => e.unidade}>
                        {(c.custosPorUnidade || []).map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => R(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="card-premium" style={{ padding: "18px 20px" }}>
                  <h3 style={chartTitleStyle}>Consumo de Combustível</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={c.consumo || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <YAxis yAxisId="l" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                      <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11 }} formatter={(n) => n === "litros" ? "Litros" : "km/L"} />
                      <Bar yAxisId="l" dataKey="litros" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="r" type="monotone" dataKey="kmL" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Charts row 3 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
                <div className="card-premium" style={{ padding: "18px 20px" }}>
                  <h3 style={chartTitleStyle}>Manutenções (por status)</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={(c.manutencoes || []).map((x: any) => ({ ...x, label: MANUT_LABEL[x.status] || x.status }))} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={80} label={(e: any) => `${e.label}: ${e.count}`}>
                        {(c.manutencoes || []).map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="card-premium" style={{ padding: "18px 20px" }}>
                  <h3 style={chartTitleStyle}>Revisões (por status)</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={(c.revisoes || []).map((x: any) => ({ ...x, label: REV_LABEL[x.status] || x.status }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>{(c.revisoes || []).map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="card-premium" style={{ padding: "18px 20px" }}>
                  <h3 style={chartTitleStyle}>Trocas de Pneus</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={(c.trocasPneus || []).map((x: any) => ({ ...x, label: PNEU_LABEL[x.tipo] || x.tipo }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>{(c.trocasPneus || []).map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="card-premium" style={{ padding: "18px 20px" }}>
                  <h3 style={chartTitleStyle}>Vencimentos de Documentos</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={c.vencimentos || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                      <XAxis dataKey="faixa" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {(c.vencimentos || []).map((_: any, i: number) => <Cell key={i} fill={["#ef4444", "#f59e0b", "#eab308", "#22c55e"][i] || "#8b5cf6"} />)}
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

function LoadingSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
      {[...Array(10)].map((_, i) => (
        <div key={i} className="card-premium" style={{ padding: "14px 18px", height: 70, background: "var(--bg-secondary)", animation: "pulse 1.5s infinite" }} />
      ))}
    </div>
  );
}
