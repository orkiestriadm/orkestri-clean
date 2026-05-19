"use client";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import Topbar from "@/components/layout/Topbar";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  FolderKanban, CheckSquare, Calendar, StickyNote,
  ChevronRight, Plus, Check, CircleCheckBig,
  Headphones, AlertTriangle, FileText, SmilePlus,
  ArrowUpRight, ArrowDownRight, Minus, Loader2
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
  aberto: "text-blue-500 dark:text-blue-400", 
  em_atendimento: "text-amber-500 dark:text-amber-400", 
  aguardando: "text-violet-500 dark:text-violet-400",
  resolvido: "text-emerald-500 dark:text-emerald-400", 
  fechado: "text-[var(--text-muted)]", 
  cancelado: "text-red-500 dark:text-red-400",
};
const PRIO_DOT: Record<string, string> = {
  baixa: "bg-[var(--border-strong)]", 
  media: "bg-blue-400", 
  alta: "bg-amber-400", 
  urgente: "bg-red-500",
};
const TIPO_COLORS: Record<string, string> = {
  TAREFA:      "text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/20",
  COMPROMISSO: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
  HABITO:      "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
};

/* ── Skeleton ── */
function Sk({ w = "100%", h = 16 }: { w?: string | number; h?: number }) {
  return <div className="skeleton rounded-md" style={{ width: w, height: h }} />;
}

/* ── KPI Card ── */
function KpiCard({ label, value, sub, trend, accent, icon: Icon, href, delay = 0 }: {
  label: string; value: string | number; sub: string;
  trend?: "up" | "down" | "flat"; accent: string; icon: any; href?: string; delay?: number;
}) {
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  const trendColor = trend === "up" ? "text-emerald-500" : trend === "down" ? "text-red-500" : "text-[var(--text-muted)]";

  const inner = (
    <div 
      className={cn(
        "group relative p-5 card-premium animate-fade-up overflow-hidden",
        href && "cursor-pointer"
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-[var(--text-muted)]">{label}</span>
          <div className="w-8 h-8 rounded-[10px] flex items-center justify-center transition-transform group-hover:scale-110 duration-300"
            style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}>
            <Icon size={14} style={{ color: accent }} strokeWidth={2.5} />
          </div>
        </div>
        <div className="font-display text-[32px] font-bold text-[var(--text-primary)] leading-none mb-2 tracking-tight">{value}</div>
        <div className="flex items-center gap-1.5">
          {trend && <TrendIcon size={14} className={trendColor} strokeWidth={2.5} />}
          <span className="text-[12px] font-medium text-[var(--text-muted)]">{sub}</span>
        </div>
      </div>
    </div>
  );

  return href ? <Link href={href} className="block no-underline outline-none">{inner}</Link> : inner;
}

/* ── Chart tooltip ── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-glass)] backdrop-blur-md text-[12px] shadow-premium-md">
      <div className="text-[var(--text-muted)] font-mono mb-1">{label}</div>
      <div className="text-[var(--text-primary)] font-semibold">{payload[0].value} chamados</div>
    </div>
  );
}

/* ── Progress bar ── */
function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 bg-[var(--bg-hover)] rounded-full overflow-hidden border border-[var(--border-subtle)]">
      <div
        className="h-full rounded-full bg-violet-500 transition-all duration-1000 ease-out"
        style={{ width: `${value}%` }}
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
    setDaily(prev => prev.map(t => t.id === id ? { ...t, concluido: !concluido } : t));
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
    { href: "/dashboard/contratos", label: "Contratos", desc: "Gestão comercial",         accent: "#0ea5e9", badge: stats?.contratos?.vencendo30 ? `${stats.contratos.vencendo30} vencendo` : null },
    ...(user?.isMaster ? [{ href: "/dashboard/cadastros", label: "Usuários", desc: "Gestão de acessos", accent: "#ec4899", badge: stats ? `${stats.usuarios.total} cadastros` : null }] : []),
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      <Topbar />

      <div className="flex-1 overflow-y-auto page-content">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8 space-y-8 pb-20">

          {/* ── Greeting ── */}
          <div className="animate-fade-in">
            <h2 className="font-display text-[26px] font-bold text-[var(--text-primary)] tracking-tight">
              {greeting}, {firstName}
            </h2>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1 font-medium">
              Aqui está o resumo da sua operação hoje.
            </p>
          </div>

          {/* ── KPI Row 1 ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {loadingS ? Array(4).fill(0).map((_, i) => (
              <div key={i} className="p-6 rounded-[16px] border border-[var(--border-subtle)] bg-[var(--bg-card)] space-y-4">
                <Sk h={12} w="40%" /><Sk h={32} w="30%" /><Sk h={12} w="60%" />
              </div>
            )) : (<>
              <KpiCard
                label="Chamados abertos" href="/dashboard/chamados"
                value={stats?.chamados?.abertos ?? 0}
                sub={stats?.chamados?.urgentes ? `${stats.chamados.urgentes} urgentes` : "Nenhum urgente"}
                trend={stats?.chamados?.urgentes ? "down" : "flat"}
                accent="#3b82f6" icon={Headphones} delay={0}
              />
              <KpiCard
                label="SLA em risco" href="/dashboard/chamados"
                value={stats?.chamados?.slaRisco ?? 0}
                sub="Vencendo em breve"
                trend={stats?.chamados?.slaRisco ? "down" : "flat"}
                accent={stats?.chamados?.slaRisco ? "#ef4444" : "#10b981"} icon={AlertTriangle} delay={50}
              />
              <KpiCard
                label="Contratos vencendo" href="/dashboard/contratos"
                value={stats?.contratos?.vencendo30 ?? 0}
                sub="Próximos 30 dias"
                trend={stats?.contratos?.vencendo30 ? "down" : "flat"}
                accent={stats?.contratos?.vencendo30 ? "#f59e0b" : "#10b981"} icon={FileText} delay={100}
              />
              <KpiCard
                label="CSAT médio" href="/dashboard/csat"
                value={stats?.csat?.media ? `${stats.csat.media}★` : "—"}
                sub={stats?.csat?.media ? (stats.csat.media >= 4 ? "Excelente" : "Bom") : "Sem avaliações"}
                trend={stats?.csat?.media ? "up" : "flat"}
                accent="#10b981" icon={SmilePlus} delay={150}
              />
            </>)}
          </div>

          {/* ── Chart + Activity ── */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

            {/* Chart */}
            <div className="xl:col-span-3 card-premium p-6 animate-fade-up" style={{ animationDelay: "200ms" }}>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Volume de Chamados</h3>
                  <p className="text-[13px] text-[var(--text-muted)] mt-1">Criados nos últimos 14 dias</p>
                </div>
                <Link href="/dashboard/chamados" className="text-[13px] font-medium text-[var(--accent-violet)] hover:opacity-80 transition-opacity flex items-center gap-1">
                  Ver todos <ChevronRight size={14} />
                </Link>
              </div>

              {loadingS ? (
                <Sk h={180} />
              ) : chartData.length > 0 ? (
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
                        axisLine={false} 
                        tickLine={false} 
                        interval={2} 
                        dy={10}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#8b5cf6" 
                        strokeWidth={2.5}
                        fill="url(#areaGrad)" 
                        dot={{ r: 0 }} 
                        activeDot={{ r: 5, fill: "#8b5cf6", stroke: "var(--bg-card)", strokeWidth: 2 }} 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-[13px] text-[var(--text-muted)] border border-dashed border-[var(--border-medium)] rounded-xl">
                  Sem dados suficientes para gerar o gráfico
                </div>
              )}
            </div>

            {/* Activity feed */}
            <div className="xl:col-span-2 card-premium flex flex-col animate-fade-up" style={{ animationDelay: "250ms" }}>
              <div className="flex items-center justify-between p-6 border-b border-[var(--border-subtle)]">
                <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Atividade Recente</h3>
                <Link href="/dashboard/chamados" className="text-[13px] font-medium text-[var(--accent-violet)] hover:opacity-80 transition-opacity">
                  Ver todos
                </Link>
              </div>

              {loadingS ? (
                <div className="p-6 space-y-4">
                  {Array(4).fill(0).map((_, i) => <Sk key={i} h={40} />)}
                </div>
              ) : !stats?.ativRecentes?.length ? (
                <div className="flex-1 flex items-center justify-center text-[13px] text-[var(--text-muted)] p-8 text-center">
                  Nenhuma atividade nas últimas 24 horas.
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  {stats.ativRecentes.map(c => (
                    <Link key={c.id} href={`/dashboard/chamados/${c.id}`} className="group flex items-start gap-4 p-4 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors block no-underline last:border-0">
                      <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", PRIO_DOT[c.prioridade] ?? "bg-[var(--border-strong)]")} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--accent-violet)] transition-colors">#{c.numero} {c.titulo}</div>
                        <div className="text-[12px] text-[var(--text-muted)] mt-0.5 truncate">{c.cliente?.empresa || c.cliente?.nome || "Sem empresa"}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={cn("text-[11px] font-semibold uppercase tracking-wider", STATUS_COLOR[c.status])}>{STATUS_LABEL[c.status]}</div>
                        <div className="text-[10px] text-[var(--text-faint)] font-mono mt-1">
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {loadingS ? Array(4).fill(0).map((_, i) => (
              <div key={i} className="p-6 rounded-[16px] border border-[var(--border-subtle)] bg-[var(--bg-card)] space-y-4">
                <Sk h={12} w="40%" /><Sk h={32} w="30%" /><Sk h={12} w="60%" />
              </div>
            )) : (<>
              <KpiCard label="Projetos" href="/dashboard/projetos"
                value={stats?.projetos.total ?? 0}
                sub={stats?.projetos.ativos ? `${stats.projetos.ativos} em andamento` : "Nenhum projeto"}
                accent="#a78bfa" icon={FolderKanban} delay={300} />
              <KpiCard label="Tasks hoje" href="/dashboard/keep"
                value={pendentes}
                sub={daily.length > 0 ? `${progresso}% concluídas` : "Nenhuma task"}
                accent="#0ea5e9" icon={CheckSquare} delay={350} />
              <KpiCard label="Eventos hoje" href="/dashboard/agenda"
                value={stats?.eventos.hoje ?? 0}
                sub={`${stats?.eventos.total ?? 0} no total`}
                accent="#f59e0b" icon={Calendar} delay={400} />
              <KpiCard label="Notas Keep" href="/dashboard/keep"
                value={stats?.notas.total ?? 0}
                sub="Anotações salvas"
                accent="#10b981" icon={StickyNote} delay={450} />
            </>)}
          </div>

          {/* ── Tasks + Modules ── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            {/* Daily tasks */}
            <div className="card-premium flex flex-col animate-fade-up" style={{ animationDelay: "500ms" }}>
              <div className="flex items-center justify-between p-6 border-b border-[var(--border-subtle)]">
                <div>
                  <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Suas Tasks de Hoje</h3>
                  <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                    {today.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}
                  </p>
                </div>
                <Link href="/dashboard/keep" className="text-[13px] font-medium text-[var(--accent-violet)] hover:opacity-80 transition-opacity flex items-center gap-1">
                  Abrir Keep <ChevronRight size={14} />
                </Link>
              </div>

              {daily.length > 0 && (
                <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-medium text-[var(--text-muted)]">{concluidas} de {daily.length} concluídas</span>
                    <span className="text-[12px] font-bold text-violet-500">{progresso}%</span>
                  </div>
                  <ProgressBar value={progresso} />
                </div>
              )}

              <div className="flex-1 overflow-y-auto">
                {loadingD ? (
                  <div className="p-6 space-y-3">
                    {Array(4).fill(0).map((_, i) => <Sk key={i} h={48} />)}
                  </div>
                ) : daily.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                    <CircleCheckBig size={32} className="text-[var(--text-faint)] mb-4" />
                    <p className="text-[14px] font-medium text-[var(--text-primary)] mb-1">Tudo limpo por aqui</p>
                    <p className="text-[13px] text-[var(--text-muted)]">Adicione tarefas abaixo para organizar seu dia.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border-subtle)]">
                    {daily.slice(0, 6).map(task => (
                      <div
                        key={task.id}
                        onClick={() => toggleTask(task.id, task.concluido)}
                        className={cn(
                          "group flex items-center gap-4 px-6 py-3.5 cursor-pointer hover:bg-[var(--bg-hover)] transition-all",
                          task.concluido && "opacity-50"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded-[6px] flex items-center justify-center shrink-0 transition-all border",
                          task.concluido
                            ? "bg-violet-500 border-violet-500 text-white"
                            : "border-[var(--border-strong)] bg-transparent text-transparent group-hover:border-violet-500/50"
                        )}>
                          <Check size={12} strokeWidth={3} />
                        </div>
                        <span className={cn(
                          "flex-1 text-[13px] font-medium truncate transition-all",
                          task.concluido ? "text-[var(--text-muted)] line-through decoration-[var(--text-faint)]" : "text-[var(--text-primary)]"
                        )}>
                          {task.titulo}
                        </span>
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider shrink-0", TIPO_COLORS[task.tipo])}>
                          {task.tipo}
                        </span>
                      </div>
                    ))}
                    {daily.length > 6 && (
                      <Link href="/dashboard/keep" className="block px-6 py-3.5 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors text-center border-t border-[var(--border-subtle)]">
                        Ver as {daily.length - 6} tasks ocultas
                      </Link>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex gap-3">
                <input
                  className="input-o"
                  placeholder="Criar nova tarefa rápida (Enter)"
                  value={newTask}
                  onChange={e => setNewTask(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && createTask()}
                />
                <button
                  onClick={createTask}
                  disabled={addingTask || !newTask.trim()}
                  className="btn btn-primary px-4 shrink-0"
                >
                  {addingTask ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                </button>
              </div>
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-6 animate-fade-up" style={{ animationDelay: "550ms" }}>
              {/* Modules */}
              <div className="card-premium p-6">
                <div className="text-[12px] font-semibold tracking-widest text-[var(--text-muted)] uppercase mb-4">Acesso Rápido</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {modules.map(m => (
                    <Link key={m.href} href={m.href} className="group flex items-start gap-3.5 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-medium)] transition-all shadow-premium-sm">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-inner"
                        style={{ background: `${m.accent}15`, border: `1px solid ${m.accent}20` }}>
                        <div className="w-4 h-4 rounded-md" style={{ background: m.accent, opacity: 0.8 }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-violet)] transition-colors">{m.label}</div>
                        <div className="text-[12px] text-[var(--text-muted)] mt-0.5">{m.desc}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Latest users (master only) */}
              {user?.isMaster && (
                <div className="card-premium">
                  <div className="flex items-center justify-between p-6 border-b border-[var(--border-subtle)]">
                    <h3 className="text-[12px] font-semibold tracking-widest text-[var(--text-muted)] uppercase">Novos Usuários</h3>
                    <Link href="/dashboard/cadastros" className="text-[12px] font-medium text-[var(--accent-violet)] hover:opacity-80 transition-colors">Ver todos</Link>
                  </div>
                  <div className="divide-y divide-[var(--border-subtle)]">
                    {loadingS ? Array(3).fill(0).map((_, i) => (
                      <div key={i} className="flex items-center gap-4 p-4">
                        <Sk h={36} w={36} /><div className="flex-1 space-y-2"><Sk h={12} w="60%" /><Sk h={10} w="40%" /></div>
                      </div>
                    )) : stats?.usuarios.ultimos.slice(0, 4).map(u => {
                      const ini = u.nome.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
                      return (
                        <div key={u.id} className="flex items-center gap-4 px-6 py-4 hover:bg-[var(--bg-hover)] transition-colors">
                          <div className="w-9 h-9 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-[12px] font-bold text-violet-500 shrink-0">
                            {ini}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] font-medium text-[var(--text-primary)] truncate">{u.nome}</div>
                            <div className="text-[12px] text-[var(--text-muted)] truncate">{u.email}</div>
                          </div>
                          <div className="text-[11px] font-medium text-[var(--text-faint)] font-mono whitespace-nowrap">
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
