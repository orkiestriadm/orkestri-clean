"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import {
  Truck, CheckCircle2, Wrench, CalendarDays, CreditCard, Package, Activity, DollarSign, BarChart2, TrendingUp, Filter, RefreshCw, ChevronRight, X, AlertTriangle
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

function KpiCard({ label, valor, icon, color, index = 0 }: { label: string; valor: string; icon: React.ReactNode; color: string; index?: number }) {
  return (
    <div className="kpi-card" style={{ ["--sc" as any]: color, animationDelay: `${index * 40}ms` }}>
      <span className="kpi-card__halo" />
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="kpi-card__icon">{icon}</span>
        <div style={{ minWidth: 0 }}>
          <div className="metric kpi-card__value">{valor}</div>
          <div className="kpi-card__label">{label}</div>
        </div>
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
  const [f, setF] = useState<any>({ from: "", to: "", unidade: "", centroCusto: "", tipo: "", veiculoId: "", motoristaId: "" });
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
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Topbar />
      
      <main className="flex-1 overflow-y-auto page-content">
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 24px 60px" }}>

          {/* Header Row */}
          <header className="page-head">
            <div className="page-head__icon"><Truck size={22} /></div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <h1 className="page-head__title">Dashboard de Frota</h1>
              <p className="page-head__sub">Visão geral e custos da frota de veículos</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => setShowFilters(s => !s)} className={`btn ${showFilters ? 'btn-violet' : 'btn-ghost'}`} style={{ fontSize: 12, gap: 6 }}>
                <Filter size={14} /> Filtros
              </button>
              <button onClick={load} className="btn btn-ghost" style={{ fontSize: 12 }} title="Recarregar"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button>
              <Link href="/dashboard/frota/relatorios" className="btn btn-violet" style={{ fontSize: 12, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                Central de Relatórios <ChevronRight size={14} />
              </Link>
            </div>
          </header>

          {/* Filters Area */}
          {showFilters && (
            <div className="surface-card rounded-2xl border border-subtle-o shadow-sm p-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-primary-o">Filtros do Dashboard</span>
                <button onClick={() => setF({ from: "", to: "", unidade: "", centroCusto: "", tipo: "", veiculoId: "", motoristaId: "" })} className="text-xs text-red-500 hover:text-red-600 transition-colors flex items-center gap-1">
                  <X size={12} /> Limpar
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-muted-o mb-1.5 block">Início</label>
                  <input type="date" value={f.from} onChange={e => setFilter("from", e.target.value)} className="w-full surface-sunken border-none rounded-xl text-xs px-3 py-2 outline-none focus-accent" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-o mb-1.5 block">Fim</label>
                  <input type="date" value={f.to} onChange={e => setFilter("to", e.target.value)} className="w-full surface-sunken border-none rounded-xl text-xs px-3 py-2 outline-none focus-accent" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-o mb-1.5 block">Unidade</label>
                  <select value={f.unidade} onChange={e => setFilter("unidade", e.target.value)} className="w-full surface-sunken border-none rounded-xl text-xs px-3 py-2 outline-none focus-accent">
                    <option value="">Todas</option>
                    {unidades.map(u => <option key={String(u)} value={String(u)}>{String(u)}</option>)}
                  </select>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-muted-o uppercase tracking-wider mb-1 block">Centro de Custo</span>
                  <input type="text" value={f.centroCusto} onChange={e => setFilter("centroCusto", e.target.value)} placeholder="Ex: CC-01" className="w-full surface-sunken border-none rounded-xl text-xs px-3 py-2 outline-none focus-accent" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-o mb-1.5 block">Tipo Veículo</label>
                  <select value={f.tipo} onChange={e => setFilter("tipo", e.target.value)} className="w-full surface-sunken border-none rounded-xl text-xs px-3 py-2 outline-none focus-accent">
                    <option value="">Todos</option>
                    {TIPO_OPTS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-o mb-1.5 block">Veículo</label>
                  <select value={f.veiculoId} onChange={e => setFilter("veiculoId", e.target.value)} className="w-full surface-sunken border-none rounded-xl text-xs px-3 py-2 outline-none focus-accent">
                    <option value="">Todos</option>
                    {veiculos.map((v: any) => <option key={v.id} value={v.id}>{v.placa}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-o mb-1.5 block">Motorista</label>
                  <select value={f.motoristaId} onChange={e => setFilter("motoristaId", e.target.value)} className="w-full surface-sunken border-none rounded-xl text-xs px-3 py-2 outline-none focus-accent">
                    <option value="">Todos</option>
                    {motoristas.map((m: any) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {loading ? <LoadingSkeleton /> : (
            <>
              {/* KPIs Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                <KpiCard index={0} label="Total de Veículos" valor={k.totalVeiculos.toLocaleString("pt-BR")} icon={<Truck size={18} />} color="var(--accent-red)" />
                <KpiCard index={1} label="Veículos Ativos" valor={k.ativos.toLocaleString("pt-BR")} icon={<CheckCircle2 size={18} />} color="var(--accent-green)" />
                {/* Parado e com avaria vem das ORDENS DE SERVICO, mesma fonte do
                    Farol. Cor so acende quando ha o que acender: ambar fixo fazia
                    zero e sete parecerem a mesma coisa. */}
                <KpiCard index={2} label="Em Manutenção" valor={k.emManutencao.toLocaleString("pt-BR")} icon={<Wrench size={18} />} color={k.emManutencao > 0 ? "var(--accent-red)" : "var(--text-muted)"} />
                <KpiCard index={3} label="Com Avaria" valor={(k.comAvaria ?? 0).toLocaleString("pt-BR")} icon={<AlertTriangle size={18} />} color={(k.comAvaria ?? 0) > 0 ? "var(--accent-amber)" : "var(--text-muted)"} />
                <KpiCard index={4} label="Próximas Revisões" valor={k.proximasRevisoes.toLocaleString("pt-BR")} icon={<CalendarDays size={18} />} color="var(--accent-cyan)" />
                <KpiCard index={5} label="CNHs a Vencer" valor={k.cnhVencer.toLocaleString("pt-BR")} icon={<CreditCard size={18} />} color="#f97316" />
                <KpiCard index={6} label="Pneus em Estoque" valor={k.pneusEstoque.toLocaleString("pt-BR")} icon={<Package size={18} />} color="#8b5cf6" />
                <KpiCard index={7} label="Pneus em Uso" valor={k.pneusUso.toLocaleString("pt-BR")} icon={<Activity size={18} />} color="#0d9488" />
                <KpiCard index={8} label="Custos do Mês" valor={R(k.custoMes)} icon={<DollarSign size={18} />} color="var(--accent-green)" />
                <KpiCard index={9} label="Custo por Veículo" valor={R(k.custoPorVeiculo)} icon={<BarChart2 size={18} />} color="var(--accent-amber)" />
                <KpiCard index={10} label="Disponibilidade" valor={`${k.disponibilidade}%`} icon={<TrendingUp size={18} />} color={k.disponibilidade >= 70 ? "var(--accent-green)" : "var(--accent-red)"} />
              </div>

              {/* Charts row 1 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <div className="surface-card rounded-2xl border border-subtle-o shadow-sm p-4 relative transition-all duration-300 hover:scale-105 hover:-translate-y-1 hover:shadow-2xl hover:z-10">
                  <h3 className="text-sm font-bold text-primary-o mb-3">Custos Mensais</h3>
                  <div className="w-full h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={c.custosMensais || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(v) => R(v)} width={75} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-medium)", borderRadius: 10, fontSize: 12 }} formatter={(v: any, n: string) => [R(v), ({ manut: "Manutenção", abast: "Abastec.", revisao: "Revisão", doc: "Documento" } as any)[n] || n]} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} formatter={(n) => ({ manut: "Manutenção", abast: "Abastec.", revisao: "Revisão", doc: "Documento" } as any)[n] || n} />
                        <Bar dataKey="manut" stackId="a" fill="#f59e0b" />
                        <Bar dataKey="abast" stackId="a" fill="#22c55e" />
                        <Bar dataKey="revisao" stackId="a" fill="#06b6d4" />
                        <Bar dataKey="doc" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="surface-card rounded-2xl border border-subtle-o shadow-sm p-4 relative transition-all duration-300 hover:scale-105 hover:-translate-y-1 hover:shadow-2xl hover:z-10">
                  <h3 className="text-sm font-bold text-primary-o mb-3">Custos por Veículo (top 10)</h3>
                  <div className="w-full h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={c.custosPorVeiculo || []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(v) => R(v)} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="placa" tick={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 600 }} width={75} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-medium)", borderRadius: 10, fontSize: 12 }} formatter={(v: any) => R(v)} />
                        <Bar dataKey="total" radius={[0, 4, 4, 0]}>{(c.custosPorVeiculo || []).map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Charts row 2 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <div className="surface-card rounded-2xl border border-subtle-o shadow-sm p-4 relative transition-all duration-300 hover:scale-105 hover:-translate-y-1 hover:shadow-2xl hover:z-10">
                  <h3 className="text-sm font-bold text-primary-o mb-3">Custos por Unidade</h3>
                  <div className="w-full h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={c.custosPorUnidade || []} dataKey="total" nameKey="unidade" cx="50%" cy="50%" outerRadius={90} label={(e: any) => e.unidade} labelLine={{ stroke: "var(--border-medium)" }}>
                          {(c.custosPorUnidade || []).map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-medium)", borderRadius: 10, fontSize: 12 }} formatter={(v: any) => R(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="surface-card rounded-2xl border border-subtle-o shadow-sm p-4 relative transition-all duration-300 hover:scale-105 hover:-translate-y-1 hover:shadow-2xl hover:z-10">
                  <h3 className="text-sm font-bold text-primary-o mb-3">Consumo de Combustível</h3>
                  <div className="w-full h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={c.consumo || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="l" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-medium)", borderRadius: 10, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} formatter={(n) => n === "litros" ? "Litros" : "km/L"} />
                        <Bar yAxisId="l" dataKey="litros" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="r" type="monotone" dataKey="kmL" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Charts row 3 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="surface-card rounded-2xl border border-subtle-o shadow-sm p-4 relative transition-all duration-300 hover:scale-[1.15] hover:-translate-y-2 hover:shadow-2xl hover:z-20">
                  <h3 className="text-sm font-bold text-primary-o mb-3">Manutenções (status)</h3>
                  <div className="w-full h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={(c.manutencoes || []).map((x: any) => ({ ...x, label: MANUT_LABEL[x.status] || x.status }))} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={75} label={(e: any) => `${e.label}: ${e.count}`} labelLine={{ stroke: "var(--border-medium)" }}>
                          {(c.manutencoes || []).map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-medium)", borderRadius: 10, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="surface-card rounded-2xl border border-subtle-o shadow-sm p-4 relative transition-all duration-300 hover:scale-[1.15] hover:-translate-y-2 hover:shadow-2xl hover:z-20">
                  <h3 className="text-sm font-bold text-primary-o mb-3">Revisões (status)</h3>
                  <div className="w-full h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={(c.revisoes || []).map((x: any) => ({ ...x, label: REV_LABEL[x.status] || x.status }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-medium)", borderRadius: 10, fontSize: 12 }} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>{(c.revisoes || []).map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="surface-card rounded-2xl border border-subtle-o shadow-sm p-4 relative transition-all duration-300 hover:scale-[1.15] hover:-translate-y-2 hover:shadow-2xl hover:z-20">
                  <h3 className="text-sm font-bold text-primary-o mb-3">Trocas de Pneus</h3>
                  <div className="w-full h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={(c.trocasPneus || []).map((x: any) => ({ ...x, label: PNEU_LABEL[x.tipo] || x.tipo }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-medium)", borderRadius: 10, fontSize: 12 }} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>{(c.trocasPneus || []).map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="surface-card rounded-2xl border border-subtle-o shadow-sm p-4 relative transition-all duration-300 hover:scale-[1.15] hover:-translate-y-2 hover:shadow-2xl hover:z-20">
                  <h3 className="text-sm font-bold text-primary-o mb-3">Vencimentos (Docs)</h3>
                  <div className="w-full h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={c.vencimentos || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                        <XAxis dataKey="faixa" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-medium)", borderRadius: 10, fontSize: 12 }} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {(c.vencimentos || []).map((_: any, i: number) => <Cell key={i} fill={["#ef4444", "#f59e0b", "#eab308", "#22c55e"][i] || "#8b5cf6"} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-subtle-o surface-sunken h-[88px] animate-pulse" />
      ))}
    </div>
  );
}
