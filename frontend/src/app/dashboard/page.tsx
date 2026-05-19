"use client";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import Topbar from "@/components/layout/Topbar";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  FolderKanban, CheckSquare, Calendar, StickyNote,
  ChevronRight, Plus, Check, MoreHorizontal, CircleCheckBig,
  Headphones, AlertTriangle, FileText, SmilePlus, TrendingUp,
  ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";

/* ── Types ── */
type ChamadoDia = { data: string; total: number };
type AtivRecente = {
  id: string; numero: number; titulo: string; status: string;
  prioridade: string; atualizadoEm: string;
  cliente?: { nome: string; empresa?: string };
};
type Stats = {
  usuarios: { total: number; ativos: number; ultimos: { id: string; nome: string; email: string; criadoEm: string }[] };
  projetos: { total: number; ativos: number };
  tasks: { total: number; concluidas: number; hoje: number; progresso: number };
  eventos: { total: number; hoje: number };
  notas: { total: number };
  chamados?: { abertos: number; urgentes: number; slaRisco: number };
  contratos?: { vencendo30: number };
  csat?: { media: number };
  chamadosPorDia?: ChamadoDia[];
  ativRecentes?: AtivRecente[];
};
type DailyTask = { id: string; titulo: string; concluido: boolean; tipo: string };

/* ── Status config ── */
const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto", em_atendimento: "Em atendimento", aguardando: "Aguardando",
  resolvido: "Resolvido", fechado: "Fechado", cancelado: "Cancelado",
};
const STATUS_COLOR: Record<string, string> = {
  aberto: "text-blue-400", em_atendimento: "text-amber-400", aguardando: "text-violet-400",
  resolvido: "text-emerald-400", fechado: "text-white/30", cancelado: "text-red-400",
};
const STATUS_DOT: Record<string, string> = {
  aberto: "bg-blue-400", em_atendimento: "bg-amber-400", aguardando: "bg-violet-400",
  resolvido: "bg-emerald-400", fechado: "bg-white/20", cancelado: "bg-red-400",
};
const PRIO_DOT: Record<string, string> = {
  baixa: "bg-white/20", media: "bg-blue-400", alta: "bg-amber-400", urgente: "bg-red-500",
};
const TIPO_COLORS: Record<string, string> = {
  TAREFA:      "text-violet-400 bg-violet-500/10 border-violet-500/20",
  COMPROMISSO: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  HABITO:      "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
};

/* ── Skeleton ── */
function Sk({ w = "100%", h = 16 }: { w?: string | number; h?: number }) {
  return <div className="skeleton rounded-md" style={{ width: w, height: h }} />;
}

/* ── KPI Card ── */
function KpiCard({ label, value, sub, trend, accent, icon: Icon, href }: {
  label: string; value: string | number; sub: string;
  trend?: "up" | "down" | "flat"; accent: string; icon: any; href?: string;
}) {
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  const trendColor = trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-white/25";

  const inner = (
    <div className={cn(
      "group relative p-5 rounded-[14px] border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/[0.1] transition-all duration-200 overflow-hidden",
      href && "cursor-pointer"
    )}>
      {/* Subtle glow from icon color */}
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `${accent}20` }} />

      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-mono tracking-[0.1em] uppercase text-white/30">{label}</span>
          <div className="w-8 h-8 rounded-[9px] flex items-center justify-center"
            style={{ background: `${accent}14`, border: `1px solid ${accent}25` }}>
            <Icon size={15} style={{ color: accent }} />
          </div>
        </div>
        <div className="font-display text-[28px] font-bold text-white leading-none mb-2">{value}</div>
        <div className="flex items-center gap-1.5">
          {trend && <TrendIcon size={12} className={trendColor} />}
          <span className="text-[11px] text-white/30">{sub}</span>
        </div>
      </div>
    </div>
  );

  return href ? <Link href={href} className="block no-underline">{inner}</Link> : inner;
}

/* ── Chart tooltip ── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-[8px] border border-white/[0.08] bg-[#0d0d1c] text-[12px]">
      <div className="text-white/40 font-mono mb-0.5">{label}</div>
      <div className="text-violet-400 font-semibold">{payload[0].value} chamados</div>
    </div>
  );
}

/* ── Progress bar ── */
function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all duration-700 ease-out"
        style={{ width: `${value}%`, boxShadow: "0 0 8px rgba(124,58,237,0.5)" }}
      />
    </div>
  );
}

/* ── Main Component ── */
export default function DashboardHome() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [daily, setDaily] = useState<DailyTask[]>([]);
  const [loadingS, setLoadingS] = useState(true);
  const [loadingD, setLoadingD] = useState(true);
  const [newTask, setNewTask] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const hour = today.getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const firstName = user?.nome?.split(" ")[0] || "usuário";

  useEffect(() => {
    api.get("/stats/dashboard")
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoadingS(false));
    loadDaily();
  }, []);

  const loadDaily = () => {
    setLoadingD(true);
    api.get("/keep/daily", { params: { data: todayStr } })
      .then(r => setDaily(r.data))
      .catch(() => {})
      .finally(() => setLoadingD(false));
  };

  const toggleTask = async (id: string, concluido: boolean) => {
    await api.patch("/keep/daily/" + id, { concluido: !concluido });
    loadDaily();
  };

  const createTask = async () => {
    if (!newTask.trim()) return;
    setAddingTask(true);
    try {
      await api.post("/keep/daily", { titulo: newTask, tipo: "TAREFA", data: todayStr });
      setNewTask("");
      loadDaily();
    } catch {
      useToastStore.getState().error("Erro", "Não foi possível criar a task.");
    } finally {
      setAddingTask(false);
    }
  };

  const concluidas = daily.filter(t => t.concluido).length;
  const pendentes  = daily.filter(t => !t.concluido).length;
  const progresso  = daily.length > 0 ? Math.round((concluidas / daily.length) * 100) : 0;

  /* Chart data */
  const chartData = stats?.chamadosPorDia?.map(d => ({
    name: d.data.slice(5).replace("-", "/"),
    value: d.total,
  })) ?? [];

  const modules = [
    { href: "/dashboard/agenda",    label: "Agenda",    desc: "Eventos e compromissos", accent: "#f59e0b", badge: stats?.eventos.hoje ? `${stats.eventos.hoje} hoje` : null },
    { href: "/dashboard/projetos",  label: "Projetos",  desc: "Planner Kanban",          accent: "#a78bfa", badge: stats?.projetos.ativos ? `${stats.projetos.ativos} ativos` : null },
    { href: "/dashboard/contratos", label: "Contratos", desc: "Gestão comercial",         accent: "#22d3ee", badge: stats?.contratos?.vencendo30 ? `${stats.contratos.vencendo30} vencendo` : null },
    ...(user?.isMaster ? [{ href: "/dashboard/cadastros", label: "Usuários", desc: "Gestão de acessos", accent: "#ec4899", badge: stats ? `${stats.usuarios.total} cadastros` : null }] : []),
  ];

  return (
    <div className="flex flex-col" style={{ height: "100%", background: "var(--bg-primary)" }}>
      <Topbar />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">

          {/* ── Greeting ── */}
          <div>
            <div className="flex items-baseline gap-2 mb-1">
              <h2 className="font-display text-[22px] font-bold text-white/85">
                {greeting},{" "}
                <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                  {firstName}
                </span>
              </h2>
            </div>
            <p className="text-[12px] text-white/25 font-mono capitalize">
              {today.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          {/* ── KPI Row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {loadingS ? Array(4).fill(0).map((_, i) => (
              <div key={i} className="p-5 rounded-[14px] border border-white/[0.06] bg-white/[0.02] space-y-3">
                <Sk h={10} w="55%" /><Sk h={28} w="40%" /><Sk h={10} w="70%" />
              </div>
            )) : (<>
              <KpiCard
                label="Chamados abertos" href="/dashboard/chamados"
                value={stats?.chamados?.abertos ?? 0}
                sub={stats?.chamados?.urgentes ? `${stats.chamados.urgentes} urgentes` : "Nenhum urgente"}
                trend={stats?.chamados?.urgentes ? "down" : "flat"}
                accent="#3b82f6" icon={Headphones}
              />
              <KpiCard
                label="SLA em risco" href="/dashboard/chamados"
                value={stats?.chamados?.slaRisco ?? 0}
                sub="Vencendo em breve"
                trend={stats?.chamados?.slaRisco ? "down" : "flat"}
                accent={stats?.chamados?.slaRisco ? "#ef4444" : "#10b981"} icon={AlertTriangle}
              />
              <KpiCard
                label="Contratos vencendo" href="/dashboard/contratos"
                value={stats?.contratos?.vencendo30 ?? 0}
                sub="Próximos 30 dias"
                trend={stats?.contratos?.vencendo30 ? "down" : "flat"}
                accent={stats?.contratos?.vencendo30 ? "#f59e0b" : "#10b981"} icon={FileText}
              />
              <KpiCard
                label="CSAT médio" href="/dashboard/csat"
                value={stats?.csat?.media ? `${stats.csat.media}★` : "—"}
                sub={stats?.csat?.media ? (stats.csat.media >= 4 ? "Excelente" : "Bom") : "Sem avaliações"}
                trend={stats?.csat?.media ? "up" : "flat"}
                accent="#10b981" icon={SmilePlus}
              />
            </>)}
          </div>

          {/* ── Chart + Activity ── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

            {/* Chart */}
            <div className="lg:col-span-3 rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="text-[13px] font-semibold text-white/70">Chamados criados</div>
                  <div className="text-[11px] text-white/25 font-mono mt-0.5">Últimos 14 dias</div>
                </div>
                <Link href="/dashboard/chamados" className="text-[11px] text-violet-400/70 hover:text-violet-400 transition-colors flex items-center gap-1">
                  Ver todos <ChevronRight size={12} />
                </Link>
              </div>

              {loadingS ? (
                <Sk h={100} />
              ) : chartData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={100}>
                    <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)", fontFamily: "var(--font-mono)" }}
                        axisLine={false} tickLine={false} interval={3} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="value" stroke="#7c3aed" strokeWidth={2}
                        fill="url(#areaGrad)" dot={false} activeDot={{ r: 4, fill: "#a78bfa", stroke: "#070711", strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="flex gap-5 mt-3 text-[11px] text-white/25 font-mono">
                    <span>Total: <span className="text-white/50">{chartData.reduce((s, d) => s + d.value, 0)}</span></span>
                    <span>Média: <span className="text-white/50">{(chartData.reduce((s, d) => s + d.value, 0) / 14).toFixed(1)}/dia</span></span>
                  </div>
                </>
              ) : (
                <div className="h-[100px] flex items-center justify-center text-[12px] text-white/25">Sem dados</div>
              )}
            </div>

            {/* Activity feed */}
            <div className="lg:col-span-2 rounded-[14px] border border-white/[0.06] bg-white/[0.02] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
                <span className="text-[13px] font-semibold text-white/70">Atividade recente</span>
                <Link href="/dashboard/chamados" className="text-[11px] text-violet-400/70 hover:text-violet-400 transition-colors">
                  Ver todos
                </Link>
              </div>

              {loadingS ? (
                <div className="p-4 space-y-3">
                  {Array(4).fill(0).map((_, i) => <Sk key={i} h={44} />)}
                </div>
              ) : !stats?.ativRecentes?.length ? (
                <div className="flex-1 flex items-center justify-center text-[12px] text-white/25 p-6 text-center">
                  Nenhuma atividade recente
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto divide-y divide-white/[0.03]">
                  {stats.ativRecentes.map(c => (
                    <Link key={c.id} href={`/dashboard/chamados/${c.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors block no-underline">
                      <div className={cn("w-1.5 h-1.5 rounded-full mt-2 shrink-0", PRIO_DOT[c.prioridade] ?? "bg-white/20")} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-white/65 truncate">#{c.numero} {c.titulo}</div>
                        <div className="text-[10px] text-white/25 font-mono">{c.cliente?.empresa || c.cliente?.nome || "—"}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={cn("text-[10px] font-medium", STATUS_COLOR[c.status])}>{STATUS_LABEL[c.status]}</div>
                        <div className="text-[9px] text-white/20 font-mono mt-0.5">
                          {new Date(c.atualizadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Second KPI row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {loadingS ? Array(4).fill(0).map((_, i) => (
              <div key={i} className="p-5 rounded-[14px] border border-white/[0.06] bg-white/[0.02] space-y-3">
                <Sk h={10} w="55%" /><Sk h={28} w="40%" /><Sk h={10} w="70%" />
              </div>
            )) : (<>
              <KpiCard label="Projetos" href="/dashboard/projetos"
                value={stats?.projetos.total ?? 0}
                sub={stats?.projetos.ativos ? `${stats.projetos.ativos} em andamento` : "Nenhum projeto"}
                accent="#a78bfa" icon={FolderKanban} />
              <KpiCard label="Tasks hoje" href="/dashboard/keep"
                value={pendentes}
                sub={daily.length > 0 ? `${progresso}% concluídas` : "Nenhuma task"}
                accent="#22d3ee" icon={CheckSquare} />
              <KpiCard label="Eventos hoje" href="/dashboard/agenda"
                value={stats?.eventos.hoje ?? 0}
                sub={`${stats?.eventos.total ?? 0} no total`}
                accent="#f59e0b" icon={Calendar} />
              <KpiCard label="Notas" href="/dashboard/keep"
                value={stats?.notas.total ?? 0}
                sub={`${stats?.usuarios.ativos ?? 0} usuários ativos`}
                accent="#10b981" icon={StickyNote} />
            </>)}
          </div>

          {/* ── Tasks + Modules ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Daily tasks */}
            <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.04]">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-white/70">Tasks de hoje</span>
                  <span className="text-[10px] font-mono text-white/20">
                    {today.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
                  </span>
                </div>
                <Link href="/dashboard/keep" className="text-[11px] text-violet-400/70 hover:text-violet-400 transition-colors flex items-center gap-1">
                  Ver tudo <ChevronRight size={12} />
                </Link>
              </div>

              {daily.length > 0 && (
                <div className="px-5 py-3 border-b border-white/[0.04]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-white/30">{concluidas}/{daily.length} concluídas</span>
                    <span className="text-[11px] font-mono text-emerald-400">{progresso}%</span>
                  </div>
                  <ProgressBar value={progresso} />
                </div>
              )}

              <div className="flex-1 overflow-y-auto">
                {loadingD ? (
                  <div className="p-4 space-y-2">
                    {Array(3).fill(0).map((_, i) => <Sk key={i} h={40} />)}
                  </div>
                ) : daily.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center px-6">
                    <CircleCheckBig size={28} className="text-white/10 mb-3" />
                    <p className="text-[12px] text-white/25">Nenhuma task hoje. Dia livre!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.03]">
                    {daily.slice(0, 6).map(task => (
                      <div
                        key={task.id}
                        onClick={() => toggleTask(task.id, task.concluido)}
                        className={cn(
                          "flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors",
                          task.concluido && "opacity-45"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded-[5px] border flex items-center justify-center shrink-0 transition-all",
                          task.concluido
                            ? "bg-emerald-500 border-emerald-500"
                            : "border-white/[0.15] bg-transparent hover:border-white/30"
                        )}>
                          {task.concluido && <Check size={11} strokeWidth={3} className="text-white" />}
                        </div>
                        <span className={cn(
                          "flex-1 text-[13px] truncate",
                          task.concluido ? "text-white/30 line-through" : "text-white/65"
                        )}>
                          {task.titulo}
                        </span>
                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded border uppercase font-semibold tracking-wider shrink-0", TIPO_COLORS[task.tipo])}>
                          {task.tipo}
                        </span>
                      </div>
                    ))}
                    {daily.length > 6 && (
                      <Link href="/dashboard/keep" className="block px-5 py-2.5 text-[11px] text-violet-400/60 hover:text-violet-400 hover:bg-white/[0.03] transition-colors text-center">
                        +{daily.length - 6} tasks
                      </Link>
                    )}
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-white/[0.04] flex gap-2">
                <input
                  className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-[8px] px-3 py-2 text-[12px] text-white/65 placeholder-white/20 outline-none focus:border-violet-500/40 focus:bg-violet-500/[0.04] transition-all"
                  placeholder="Adicionar task rápida..."
                  value={newTask}
                  onChange={e => setNewTask(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && createTask()}
                />
                <button
                  onClick={createTask}
                  disabled={addingTask || !newTask.trim()}
                  className="w-8 h-8 rounded-[8px] bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors shrink-0"
                >
                  {addingTask ? <MoreHorizontal size={14} className="animate-pulse" /> : <Plus size={14} />}
                </button>
              </div>
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-4">
              {/* Modules */}
              <div>
                <div className="text-[10px] font-mono tracking-[0.12em] text-white/20 uppercase mb-3 px-0.5">Módulos</div>
                <div className="space-y-2">
                  {modules.map(m => (
                    <Link key={m.href} href={m.href} className="group flex items-center gap-3.5 p-3.5 rounded-[12px] border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.09] transition-all no-underline">
                      <div className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0"
                        style={{ background: `${m.accent}12`, border: `1px solid ${m.accent}20` }}>
                        <div className="w-3 h-3 rounded-[3px]" style={{ background: m.accent, opacity: 0.7 }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-white/65 group-hover:text-white/85 transition-colors">{m.label}</div>
                        <div className="text-[11px] text-white/25">{m.desc}</div>
                      </div>
                      {m.badge && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono shrink-0"
                          style={{ color: m.accent, background: `${m.accent}12`, border: `1px solid ${m.accent}25` }}>
                          {m.badge}
                        </span>
                      )}
                      <ChevronRight size={14} className="text-white/15 group-hover:text-white/40 transition-colors shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>

              {/* Latest users (master only) */}
              {user?.isMaster && (
                <div>
                  <div className="flex items-center justify-between mb-3 px-0.5">
                    <div className="text-[10px] font-mono tracking-[0.12em] text-white/20 uppercase">Últimos usuários</div>
                    <Link href="/dashboard/cadastros" className="text-[11px] text-violet-400/60 hover:text-violet-400 transition-colors">Ver todos</Link>
                  </div>
                  <div className="rounded-[12px] border border-white/[0.05] bg-white/[0.02] overflow-hidden divide-y divide-white/[0.03]">
                    {loadingS ? Array(3).fill(0).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-3">
                        <Sk h={28} w={28} /><div className="flex-1 space-y-1.5"><Sk h={10} w="60%" /><Sk h={9} w="40%" /></div>
                      </div>
                    )) : stats?.usuarios.ultimos.slice(0, 4).map(u => {
                      const ini = u.nome.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
                      return (
                        <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors">
                          <div className="w-7 h-7 rounded-full bg-violet-500/20 border border-violet-500/25 flex items-center justify-center text-[10px] font-bold text-violet-400 shrink-0">
                            {ini}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-medium text-white/60 truncate">{u.nome}</div>
                            <div className="text-[10px] text-white/25 truncate font-mono">{u.email}</div>
                          </div>
                          <div className="text-[10px] text-white/20 font-mono whitespace-nowrap">
                            {new Date(u.criadoEm).toLocaleDateString("pt-BR")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
