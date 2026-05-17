"use client";
import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import Topbar from "@/components/layout/Topbar";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  FolderKanban, CheckSquare, Calendar, StickyNote,
  ChevronRight, Plus, Check, MoreHorizontal, LayoutDashboard,
  CircleCheckBig, Headphones, AlertTriangle, FileText, SmilePlus,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ChamadoDia = { data: string; total: number };
type AtivRecente = { id: string; numero: number; titulo: string; status: string; prioridade: string; atualizadoEm: string; cliente?: { nome: string; empresa?: string } };
type Stats = {
  usuarios: { total: number; ativos: number; ultimos: { id: string; nome: string; email: string; criadoEm: string; ultimoLogin?: string }[] };
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
type DailyTask = { id: string; titulo: string; concluido: boolean; tipo: string; };

const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto", em_atendimento: "Em atendimento", aguardando: "Aguardando",
  resolvido: "Resolvido", fechado: "Fechado", cancelado: "Cancelado",
};
const STATUS_COLOR: Record<string, string> = {
  aberto: "text-blue-400", em_atendimento: "text-amber-400", aguardando: "text-purple-400",
  resolvido: "text-emerald-400", fechado: "text-muted-foreground", cancelado: "text-red-400",
};
const PRIO_DOT: Record<string, string> = {
  baixa: "bg-slate-400", media: "bg-blue-400", alta: "bg-amber-400", urgente: "bg-red-500",
};
const TIPO_COLORS: Record<string, string> = {
  TAREFA: "text-violet-500 bg-violet-500/10 border-violet-500/20",
  COMPROMISSO: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  HABITO: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
};

function StatCard({ label, value, sub, colorClass, icon: Icon, href }: any) {
  const inner = (
    <div className={cn("p-5 flex flex-col gap-3 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors", href && "cursor-pointer")}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground font-mono tracking-[0.08em]">{label}</span>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border", colorClass)}>
          <Icon size={16} />
        </div>
      </div>
      <div className="font-display text-3xl font-bold text-foreground leading-none">{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
  return href ? <Link href={href} className="no-underline">{inner}</Link> : inner;
}

function ProgressBar({ value, colorClass }: { value:number; colorClass:string }) {
  return (
    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
      <div className={cn("h-full rounded-full transition-all duration-1000 ease-out", colorClass)} style={{ width: `${value}%` }} />
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

function ChamadosChart({ data }: { data: ChamadoDia[] }) {
  const max = Math.max(...data.map(d => d.total), 1);
  const labels = data.map(d => {
    const [,, dd] = d.data.split("-");
    return dd;
  });
  return (
    <div className="flex items-end gap-[3px] h-14 w-full">
      {data.map((d, i) => {
        const pct = d.total / max;
        const isWeekend = new Date(d.data + "T12:00:00").getDay() % 6 === 0;
        return (
          <div key={d.data} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div
              className={cn(
                "w-full rounded-sm transition-all",
                d.total === 0 ? "bg-border" : isWeekend ? "bg-amber-500/60" : "bg-primary/70",
                "group-hover:brightness-125"
              )}
              style={{ height: `${Math.max(pct * 44, d.total > 0 ? 6 : 2)}px` }}
            />
            {(i === 0 || i === 6 || i === 13) && (
              <span className="text-[8px] text-muted-foreground font-mono">{labels[i]}</span>
            )}
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-popover border border-border rounded px-1.5 py-0.5 text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {d.data.slice(5)}: {d.total}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardHome() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats|null>(null);
  const [daily, setDaily] = useState<DailyTask[]>([]);
  const [loadingS, setLoadingS] = useState(true);
  const [loadingD, setLoadingD] = useState(true);
  const [newTask, setNewTask] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  const today = new Date();
  const todayStr = today.toISOString().slice(0,10);
  const hour = today.getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const dateLabel = today.toLocaleDateString("pt-BR", { weekday:"long", day:"numeric", month:"long", year:"numeric" });

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
    await api.patch("/keep/daily/"+id, { concluido: !concluido });
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

  const pendentes = daily.filter(t => !t.concluido).length;
  const concluidas = daily.filter(t => t.concluido).length;
  const progresso = daily.length > 0 ? Math.round((concluidas / daily.length) * 100) : 0;

  const modules = [
    { href:"/dashboard/agenda",   title:"Agenda",   desc:"Eventos e compromissos", colorClass:"text-amber-500 bg-amber-500/10 border-amber-500/20", badge:stats?.eventos.hoje ? stats.eventos.hoje+" hoje" : null },
    { href:"/dashboard/projetos", title:"Projetos", desc:"Planner Kanban",          colorClass:"text-violet-500 bg-violet-500/10 border-violet-500/20", badge:stats?.projetos.ativos ? stats.projetos.ativos+" ativos" : null },
    { href:"/dashboard/contratos",title:"Contratos",desc:"Gestão de contratos",     colorClass:"text-cyan-500 bg-cyan-500/10 border-cyan-500/20",   badge:stats?.contratos?.vencendo30 ? stats.contratos.vencendo30+" vencendo" : null },
    ...(user?.isMaster ? [{ href:"/dashboard/usuarios", title:"Usuários", desc:"Gestão de acessos", colorClass:"text-pink-500 bg-pink-500/10 border-pink-500/20", badge:stats ? stats.usuarios.total+" cadastrados" : null }] : []),
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      <Topbar />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

        {/* Saudação */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="font-display text-2xl font-bold tracking-tight mb-1 text-foreground">
            {greeting}, <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-cyan-400">{user?.nome?.split(" ")[0] || "usuário"}</span>
          </h2>
          <p className="text-[13px] text-muted-foreground capitalize">{dateLabel}</p>
        </div>

        {/* Stats CRM */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-75 fill-mode-both">
          {loadingS ? Array(4).fill(0).map((_,i) => (
            <div key={i} className="p-5 flex flex-col gap-3 rounded-xl border border-border bg-card">
              <Skeleton className="h-3 w-[60%]" />
              <Skeleton className="h-8 w-[40%]" />
              <Skeleton className="h-3 w-[80%]" />
            </div>
          )) : <>
            <StatCard label="CHAMADOS ABERTOS" href="/dashboard/chamados"
              value={stats?.chamados?.abertos ?? 0}
              sub={stats?.chamados?.urgentes ? `${stats.chamados.urgentes} urgentes` : "Nenhum urgente"}
              colorClass="text-blue-500 bg-blue-500/10 border-blue-500/20"
              icon={Headphones}
            />
            <StatCard label="SLA EM RISCO" href="/dashboard/chamados?status=aberto"
              value={stats?.chamados?.slaRisco ?? 0}
              sub="SLA vencendo em 2h"
              colorClass={stats?.chamados?.slaRisco ? "text-red-500 bg-red-500/10 border-red-500/20" : "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"}
              icon={AlertTriangle}
            />
            <StatCard label="CONTRATOS VENCENDO" href="/dashboard/contratos"
              value={stats?.contratos?.vencendo30 ?? 0}
              sub="Nos próximos 30 dias"
              colorClass={stats?.contratos?.vencendo30 ? "text-amber-500 bg-amber-500/10 border-amber-500/20" : "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"}
              icon={FileText}
            />
            <StatCard label="CSAT MÉDIO (MÊS)" href="/dashboard/csat"
              value={stats?.csat?.media ? `${stats.csat.media}★` : "—"}
              sub={stats?.csat?.media ? (stats.csat.media >= 4 ? "Ótimo" : stats.csat.media >= 3 ? "Bom" : "Atenção necessária") : "Sem avaliações"}
              colorClass="text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
              icon={SmilePlus}
            />
          </>}
        </div>

        {/* Gráfico chamados por dia + feed de atividade */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 fill-mode-both">

          {/* Chamados por dia */}
          <div className="p-5 rounded-xl border border-border bg-card flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[13px] font-semibold text-foreground">Chamados criados</span>
                <span className="text-[11px] text-muted-foreground ml-2">últimos 14 dias</span>
              </div>
              <Link href="/dashboard/chamados" className="text-[11px] text-primary hover:underline">Ver todos</Link>
            </div>
            {loadingS ? (
              <Skeleton className="h-14 w-full" />
            ) : stats?.chamadosPorDia ? (
              <ChamadosChart data={stats.chamadosPorDia} />
            ) : (
              <div className="h-14 flex items-center justify-center text-[11px] text-muted-foreground">Sem dados</div>
            )}
            {!loadingS && stats?.chamadosPorDia && (
              <div className="flex gap-4 text-[11px] text-muted-foreground">
                <span>Total: <span className="text-foreground font-medium">{stats.chamadosPorDia.reduce((s,d)=>s+d.total,0)}</span></span>
                <span>Média/dia: <span className="text-foreground font-medium">{(stats.chamadosPorDia.reduce((s,d)=>s+d.total,0)/14).toFixed(1)}</span></span>
              </div>
            )}
          </div>

          {/* Feed de atividade recente */}
          <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <span className="text-[13px] font-semibold text-foreground">Atividade recente</span>
              <Link href="/dashboard/chamados" className="text-[11px] text-primary hover:underline">Ver chamados</Link>
            </div>
            {loadingS ? (
              <div className="p-4 flex flex-col gap-3">
                {Array(4).fill(0).map((_,i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : !stats?.ativRecentes?.length ? (
              <div className="p-6 text-center text-[12px] text-muted-foreground">Nenhuma atividade recente</div>
            ) : (
              <div className="divide-y divide-border">
                {stats.ativRecentes.map(c => (
                  <Link key={c.id} href={`/dashboard/chamados/${c.id}`} className="no-underline">
                    <div className="flex items-start gap-3 px-5 py-3 hover:bg-accent/50 transition-colors">
                      <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", PRIO_DOT[c.prioridade] || "bg-slate-400")} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-foreground truncate">#{c.numero} {c.titulo}</div>
                        <div className="text-[10px] text-muted-foreground">{c.cliente?.empresa || c.cliente?.nome || "Sem cliente"}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={cn("text-[10px] font-medium", STATUS_COLOR[c.status])}>{STATUS_LABEL[c.status]}</div>
                        <div className="text-[9px] text-muted-foreground font-mono">
                          {new Date(c.atualizadoEm).toLocaleDateString("pt-BR", { day:"2-digit", month:"short" })}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats projetos + progresso geral */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150 fill-mode-both">
          {loadingS ? Array(4).fill(0).map((_,i) => (
            <div key={i} className="p-5 flex flex-col gap-3 rounded-xl border border-border bg-card">
              <Skeleton className="h-3 w-[60%]" />
              <Skeleton className="h-8 w-[40%]" />
              <Skeleton className="h-3 w-[80%]" />
            </div>
          )) : <>
            <StatCard label="PROJETOS" href="/dashboard/projetos"
              value={stats?.projetos.total ?? 0}
              sub={stats?.projetos.ativos ? `${stats.projetos.ativos} em andamento` : "Nenhum projeto"}
              colorClass="text-violet-500 bg-violet-500/10 border-violet-500/20"
              icon={FolderKanban}
            />
            <StatCard label="TASKS HOJE" href="/dashboard/keep"
              value={pendentes}
              sub={daily.length > 0 ? `${progresso}% concluídas hoje` : "Nenhuma task"}
              colorClass="text-cyan-500 bg-cyan-500/10 border-cyan-500/20"
              icon={CheckSquare}
            />
            <StatCard label="EVENTOS HOJE" href="/dashboard/agenda"
              value={stats?.eventos.hoje ?? 0}
              sub={stats?.eventos.total ? `${stats.eventos.total} no total` : "Sem eventos"}
              colorClass="text-amber-500 bg-amber-500/10 border-amber-500/20"
              icon={Calendar}
            />
            <StatCard label="NOTAS" href="/dashboard/keep"
              value={stats?.notas.total ?? 0}
              sub={stats?.usuarios.ativos ? `${stats.usuarios.ativos} usuários ativos` : "Keep vazio"}
              colorClass="text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
              icon={StickyNote}
            />
          </>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Tasks diárias */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 fill-mode-both">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[13px] font-semibold text-foreground">Tasks de hoje</span>
                <span className="text-[11px] text-muted-foreground ml-2">
                  {today.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
                </span>
              </div>
              <Link href="/dashboard/keep?view=tasks" className="text-[11px] text-primary hover:underline">
                Ver todas
              </Link>
            </div>

            {daily.length > 0 && (
              <div className="mb-3">
                <div className="flex justify-between mb-1.5">
                  <span className="text-[11px] text-muted-foreground">{concluidas}/{daily.length} concluídas</span>
                  <span className="text-[11px] font-mono text-emerald-500">{progresso}%</span>
                </div>
                <ProgressBar value={progresso} colorClass="bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              </div>
            )}

            <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
              {loadingD ? (
                <div className="p-4 flex flex-col gap-3">
                  {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-9" />)}
                </div>
              ) : daily.length === 0 ? (
                <div className="p-6 flex flex-col items-center justify-center text-center">
                  <CircleCheckBig className="text-muted mb-2" size={32} />
                  <p className="text-muted-foreground text-xs">Nenhuma task pendente hoje. Aproveite o dia!</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {daily.slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      onClick={() => toggleTask(task.id, task.concluido)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors",
                        task.concluido && "opacity-60 bg-muted/30"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                        task.concluido ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/30 bg-transparent"
                      )}>
                        {task.concluido && <Check size={12} strokeWidth={3} />}
                      </div>
                      <span className={cn(
                        "flex-1 text-[13px] truncate transition-all",
                        task.concluido ? "text-muted-foreground line-through" : "text-foreground font-medium"
                      )}>
                        {task.titulo}
                      </span>
                      <span className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded uppercase font-semibold tracking-wider border",
                        TIPO_COLORS[task.tipo]
                      )}>
                        {task.tipo}
                      </span>
                    </div>
                  ))}
                  {daily.length > 5 && (
                    <Link href="/dashboard/keep" className="block p-2 text-[11px] text-primary text-center hover:bg-accent/50 transition-colors">
                      + {daily.length - 5} tasks
                    </Link>
                  )}
                </div>
              )}

              <div className="p-2 border-t border-border bg-muted/10 flex gap-2">
                <input
                  className="flex-1 bg-background border border-input rounded-md px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  placeholder="Adicionar task rápida..."
                  value={newTask}
                  onChange={e => setNewTask(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && createTask()}
                />
                <Button
                  onClick={createTask}
                  disabled={addingTask || !newTask.trim()}
                  size="sm"
                  className="px-3"
                >
                  {addingTask ? <MoreHorizontal size={14} className="animate-pulse" /> : <Plus size={16} />}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            {/* Módulos */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-250 fill-mode-both">
              <div className="text-[11px] font-mono tracking-[0.1em] text-muted-foreground uppercase mb-3">Módulos</div>
              <div className="flex flex-col gap-2">
                {modules.map(m => (
                  <Link key={m.href} href={m.href} className="no-underline group">
                    <div className="p-3 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors flex items-center gap-3">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border", m.colorClass)}>
                        <div className="w-3 h-3 rounded-[2px] bg-current opacity-60" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors">{m.title}</div>
                        <div className="text-[11px] text-muted-foreground">{m.desc}</div>
                      </div>
                      {m.badge && (
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full border", m.colorClass)}>
                          {m.badge}
                        </span>
                      )}
                      <ChevronRight size={16} className="text-muted-foreground group-hover:text-foreground transition-colors ml-1" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Últimos usuários (master) */}
            {user?.isMaster && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-both">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-mono tracking-[0.1em] text-muted-foreground uppercase">Últimos usuários</span>
                  <Link href="/dashboard/usuarios" className="text-[11px] text-primary hover:underline">Ver todos</Link>
                </div>
                <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
                  {loadingS ? Array(3).fill(0).map((_, i) => (
                    <div key={i} className="p-3 flex items-center gap-3">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <div className="flex-1 flex flex-col gap-1.5">
                        <Skeleton className="w-[60%] h-3" />
                        <Skeleton className="w-[40%] h-2.5" />
                      </div>
                    </div>
                  )) : stats?.usuarios.ultimos.slice(0, 4).map((u) => {
                    const initials = u.nome.split(" ").map((n:string)=>n[0]).slice(0, 2).join("").toUpperCase();
                    return (
                      <div key={u.id} className="p-3 flex items-center gap-3 hover:bg-accent/50 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-foreground truncate">{u.nome}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{u.email}</div>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">
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
  );
}
