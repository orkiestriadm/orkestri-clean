"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import {
  Truck, CheckCircle2, Wrench, CalendarDays, CreditCard, Package, Activity, DollarSign, BarChart2, TrendingUp, Filter, RefreshCw, ChevronRight, X
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

function KpiCard({ label, valor, icon, colorClass, textClass, ringClass }: { label: string; valor: string; icon: React.ReactNode; colorClass: string; textClass: string; ringClass: string }) {
  return (
    <div className={`flex-1 min-w-[180px] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-950 p-4 transition-all relative overflow-hidden group`}>
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity blur-2xl ${colorClass}`} />
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-50 dark:bg-slate-900 ${textClass}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className={`text-2xl font-black tracking-tight leading-tight ${textClass} truncate`}>
            {valor}
          </div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            {label}
          </div>
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
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Topbar />
      
      <main className="flex-1 overflow-y-auto page-content">
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 24px 60px" }}>

          {/* Header Row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--accent-violet)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px -6px rgba(109,40,217,0.6)", flexShrink: 0 }}>
              <Truck size={22} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Dashboard de Frota</h1>
              <p style={{ color: "var(--text-muted)", margin: "2px 0 0", fontSize: 13 }}>Visão geral e custos da frota de veículos</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => setShowFilters(s => !s)} className={`btn ${showFilters ? 'btn-violet' : 'btn-ghost'}`} style={{ fontSize: 12, gap: 6 }}>
                <Filter size={14} /> Filtros
              </button>
              <button onClick={load} className="btn btn-ghost" style={{ fontSize: 12 }}><RefreshCw size={14} /></button>
              <Link href="/dashboard/frota/relatorios" className="btn btn-violet" style={{ fontSize: 12, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                Central de Relatórios <ChevronRight size={14} />
              </Link>
            </div>
          </div>

          {/* Filters Area */}
          {showFilters && (
            <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Filtros do Dashboard</span>
                <button onClick={() => setF({ from: "", to: "", unidade: "", centroCustoId: "", tipo: "", veiculoId: "", motoristaId: "" })} className="text-xs text-red-500 hover:text-red-600 transition-colors flex items-center gap-1">
                  <X size={12} /> Limpar
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-slate-500 mb-1.5 block">Início</label>
                  <input type="date" value={f.from} onChange={e => setFilter("from", e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-xs px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/50" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500 mb-1.5 block">Fim</label>
                  <input type="date" value={f.to} onChange={e => setFilter("to", e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-xs px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/50" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500 mb-1.5 block">Unidade</label>
                  <select value={f.unidade} onChange={e => setFilter("unidade", e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-xs px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/50">
                    <option value="">Todas</option>
                    {unidades.map(u => <option key={String(u)} value={String(u)}>{String(u)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500 mb-1.5 block">Centro de Custo</label>
                  <select value={f.centroCustoId} onChange={e => setFilter("centroCustoId", e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-xs px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/50">
                    <option value="">Todos</option>
                    {centros.map((x: any) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500 mb-1.5 block">Tipo Veículo</label>
                  <select value={f.tipo} onChange={e => setFilter("tipo", e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-xs px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/50">
                    <option value="">Todos</option>
                    {TIPO_OPTS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500 mb-1.5 block">Veículo</label>
                  <select value={f.veiculoId} onChange={e => setFilter("veiculoId", e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-xs px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/50">
                    <option value="">Todos</option>
                    {veiculos.map((v: any) => <option key={v.id} value={v.id}>{v.placa}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500 mb-1.5 block">Motorista</label>
                  <select value={f.motoristaId} onChange={e => setFilter("motoristaId", e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-xs px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/50">
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
                <KpiCard label="Total de Veículos" valor={k.totalVeiculos.toString()} icon={<Truck size={18} />} colorClass="bg-red-500" textClass="text-red-600 dark:text-red-400" ringClass="ring-red-500" />
                <KpiCard label="Veículos Ativos" valor={k.ativos.toString()} icon={<CheckCircle2 size={18} />} colorClass="bg-emerald-500" textClass="text-emerald-600 dark:text-emerald-400" ringClass="ring-emerald-500" />
                <KpiCard label="Em Manutenção" valor={k.emManutencao.toString()} icon={<Wrench size={18} />} colorClass="bg-amber-500" textClass="text-amber-600 dark:text-amber-400" ringClass="ring-amber-500" />
                <KpiCard label="Próximas Revisões" valor={k.proximasRevisoes.toString()} icon={<CalendarDays size={18} />} colorClass="bg-cyan-500" textClass="text-cyan-600 dark:text-cyan-400" ringClass="ring-cyan-500" />
                <KpiCard label="CNHs a Vencer" valor={k.cnhVencer.toString()} icon={<CreditCard size={18} />} colorClass="bg-orange-500" textClass="text-orange-600 dark:text-orange-400" ringClass="ring-orange-500" />
                <KpiCard label="Pneus em Estoque" valor={k.pneusEstoque.toString()} icon={<Package size={18} />} colorClass="bg-violet-500" textClass="text-violet-600 dark:text-violet-400" ringClass="ring-violet-500" />
                <KpiCard label="Pneus em Uso" valor={k.pneusUso.toString()} icon={<Activity size={18} />} colorClass="bg-teal-500" textClass="text-teal-600 dark:text-teal-400" ringClass="ring-teal-500" />
                <KpiCard label="Custos do Mês" valor={R(k.custoMes)} icon={<DollarSign size={18} />} colorClass="bg-emerald-500" textClass="text-emerald-600 dark:text-emerald-400" ringClass="ring-emerald-500" />
                <KpiCard label="Custo por Veículo" valor={R(k.custoPorVeiculo)} icon={<BarChart2 size={18} />} colorClass="bg-amber-500" textClass="text-amber-600 dark:text-amber-400" ringClass="ring-amber-500" />
                <KpiCard label="Disponibilidade" valor={`${k.disponibilidade}%`} icon={<TrendingUp size={18} />} colorClass={k.disponibilidade >= 70 ? "bg-emerald-500" : "bg-red-500"} textClass={k.disponibilidade >= 70 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"} ringClass={k.disponibilidade >= 70 ? "ring-emerald-500" : "ring-red-500"} />
              </div>

              {/* Charts row 1 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 relative transition-all duration-300 hover:scale-105 hover:-translate-y-1 hover:shadow-2xl hover:z-10">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Custos Mensais</h3>
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

                <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 relative transition-all duration-300 hover:scale-105 hover:-translate-y-1 hover:shadow-2xl hover:z-10">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Custos por Veículo (top 10)</h3>
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
                <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 relative transition-all duration-300 hover:scale-105 hover:-translate-y-1 hover:shadow-2xl hover:z-10">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Custos por Unidade</h3>
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

                <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 relative transition-all duration-300 hover:scale-105 hover:-translate-y-1 hover:shadow-2xl hover:z-10">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Consumo de Combustível</h3>
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
                <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 relative transition-all duration-300 hover:scale-[1.15] hover:-translate-y-2 hover:shadow-2xl hover:z-20">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Manutenções (status)</h3>
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

                <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 relative transition-all duration-300 hover:scale-[1.15] hover:-translate-y-2 hover:shadow-2xl hover:z-20">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Revisões (status)</h3>
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

                <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 relative transition-all duration-300 hover:scale-[1.15] hover:-translate-y-2 hover:shadow-2xl hover:z-20">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Trocas de Pneus</h3>
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

                <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 relative transition-all duration-300 hover:scale-[1.15] hover:-translate-y-2 hover:shadow-2xl hover:z-20">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Vencimentos (Docs)</h3>
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
        <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 h-[88px] animate-pulse" />
      ))}
    </div>
  );
}
