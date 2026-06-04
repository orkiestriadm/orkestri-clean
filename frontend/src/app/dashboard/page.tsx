"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import Topbar from "@/components/layout/Topbar";
import Link from "next/link";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  Headphones, FolderKanban, CheckSquare, Package, FileText,
  AlertTriangle, AlertCircle, ShieldAlert, Zap, Clock,
  TrendingUp, TrendingDown, Minus, ArrowRight, ArrowUpRight, ArrowDownRight,
  CheckCircle2, XCircle, Check, Plus, Loader2, ChevronRight,
  BarChart3, Users, Receipt, StickyNote, Calendar,
  Brain, Activity, CircleCheckBig, SmilePlus, Settings2, RefreshCw,
  LayoutDashboard, Building2, PiggyBank, Eye, EyeOff,
} from "lucide-react";

/* ═══════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════ */
type DashStats = {
  usuarios: { total: number; ativos: number; ultimos: { id: string; nome: string; email: string; criadoEm: string }[] };
  projetos: { total: number; ativos: number };
  tasks: { total: number; concluidas: number; hoje: number; progresso: number };
  eventos: { total: number; hoje: number };
  notas: { total: number };
  chamados?: { abertos: number; urgentes: number; slaRisco: number };
  contratos?: { vencendo30: number };
  csat?: { media: number };
  chamadosPorDia?: { data: string; total: number }[];
  ativRecentes?: { id: string; numero: number; titulo: string; status: string; prioridade: string; atualizadoEm: string; cliente?: { nome: string; empresa?: string } }[];
};
type ExecStats = {
  chamados: { abertos: number; urgentes: number; hoje: number; emAtendimento: number; resolvidosMes: number; slaViolados: number; slaCompliancePct: number; csatMedia: number; csatTotal: number };
  projetos: { ativos: number; concluidosMes: number };
  ativos: { total: number; emManutencao: number; garantiaRisco: number; garantiaVencida: number };
  contratos: { total: number; vigentes: number; vencendo: number; vencidos: number; valorTotal: number };
  horas: { totalMinutos: number; totalRegistros: number };
  conhecimento: { artigos: number; visualizacoes: number };
};
type AprovStats = { minhasPendentes: number; aguardandoMinhaAprovacao: number; aprovadas: number; rejeitadas: number };
type DailyTask = { id: string; titulo: string; concluido: boolean; tipo: string };

/* ═══════════════════════════════════════════════
   ALERT ENGINE — computed from real data
═══════════════════════════════════════════════ */
type AlertSeverity = "critical" | "high" | "medium" | "low" | "ok";
type Alert = { severity: AlertSeverity; label: string; href: string | null; icon: any };

function computeAlerts(exec: ExecStats | null, dash: DashStats | null, aprov: AprovStats | null): Alert[] {
  const alerts: Alert[] = [];
  if (exec?.chamados?.slaViolados > 0)
    alerts.push({ severity: "critical", label: `${exec.chamados.slaViolados} chamado${exec.chamados.slaViolados > 1 ? "s" : ""} com SLA violado`, href: "/dashboard/chamados", icon: ShieldAlert });
  if (exec?.chamados?.urgentes > 0)
    alerts.push({ severity: "high", label: `${exec.chamados.urgentes} chamado${exec.chamados.urgentes > 1 ? "s" : ""} urgente${exec.chamados.urgentes > 1 ? "s" : ""} em aberto`, href: "/dashboard/chamados", icon: Zap });
  if (aprov && aprov.aguardandoMinhaAprovacao > 0)
    alerts.push({ severity: "high", label: `${aprov.aguardandoMinhaAprovacao} item${aprov.aguardandoMinhaAprovacao > 1 ? "s" : ""} aguardando sua aprovação`, href: "/dashboard/aprovacoes", icon: Clock });
  if (exec?.ativos?.garantiaVencida > 0)
    alerts.push({ severity: "medium", label: `${exec.ativos.garantiaVencida} ativo${exec.ativos.garantiaVencida > 1 ? "s" : ""} com garantia vencida`, href: "/dashboard/ativos", icon: AlertCircle });
  if (exec?.contratos?.vencendo > 0)
    alerts.push({ severity: "medium", label: `${exec.contratos.vencendo} contrato${exec.contratos.vencendo > 1 ? "s" : ""} vencendo em 30 dias`, href: "/dashboard/contratos", icon: FileText });
  if (exec?.ativos?.garantiaRisco > 0)
    alerts.push({ severity: "low", label: `${exec.ativos.garantiaRisco} garantia${exec.ativos.garantiaRisco > 1 ? "s" : ""} vencendo em 30 dias`, href: "/dashboard/ativos", icon: Package });
  if (dash?.contratos?.vencendo30 && dash.contratos.vencendo30 > (exec?.contratos?.vencendo ?? 0))
    alerts.push({ severity: "low", label: `Contratos próximos do vencimento detectados`, href: "/dashboard/contratos", icon: FileText });
  if (alerts.length === 0)
    alerts.push({ severity: "ok", label: "Todos os indicadores operacionais estão normais", href: null, icon: CheckCircle2 });
  return alerts;
}

function systemStatus(alerts: Alert[]) {
  if (alerts.some(a => a.severity === "critical")) return "critical";
  if (alerts.some(a => a.severity === "high")) return "warning";
  if (alerts.some(a => a.severity === "medium")) return "attention";
  return "operational";
}

/* ═══════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════ */
const STATUS_LABEL: Record<string, string> = { aberto: "Aberto", em_atendimento: "Em atendimento", aguardando: "Aguardando", resolvido: "Resolvido", fechado: "Fechado", cancelado: "Cancelado" };
const STATUS_COLOR: Record<string, string> = { aberto: "text-[var(--accent-cyan)]", em_atendimento: "text-[var(--accent-amber)]", aguardando: "text-[var(--accent-violet)]", resolvido: "text-[var(--accent-green)]", fechado: "text-[var(--text-muted)]", cancelado: "text-[var(--accent-red)]" };
const PRIO_DOT: Record<string, string> = { baixa: "bg-[var(--border-strong)]", media: "bg-[var(--accent-cyan)]", alta: "bg-[var(--accent-amber)]", urgente: "bg-[var(--accent-red)]" };
const TIPO_COLORS: Record<string, string> = { TAREFA: "text-[var(--accent-violet)] bg-[var(--accent-violet-dim)] border-[var(--accent-violet)]/10", COMPROMISSO: "text-[var(--accent-amber)] bg-[var(--accent-amber)]/[0.04] border-[var(--accent-amber)]/10", HABITO: "text-[var(--accent-green)] bg-[var(--accent-green)]/[0.04] border-[var(--accent-green)]/10" };
const SEV_COLORS: Record<AlertSeverity, { dot: string; text: string; bg: string; border: string }> = {
  critical: { dot: "bg-[var(--accent-red)]",    text: "text-[var(--accent-red)]",    bg: "bg-[var(--accent-red)]/[0.04]",    border: "border-[var(--accent-red)]/10" },
  high:     { dot: "bg-orange-500",             text: "text-orange-500",             bg: "bg-orange-500/[0.04]",             border: "border-orange-500/10" },
  medium:   { dot: "bg-[var(--accent-amber)]",  text: "text-[var(--accent-amber)]",  bg: "bg-[var(--accent-amber)]/[0.04]",  border: "border-[var(--accent-amber)]/10" },
  low:      { dot: "bg-[var(--accent-cyan)]",   text: "text-[var(--accent-cyan)]",   bg: "bg-[var(--accent-cyan)]/[0.04]",   border: "border-[var(--accent-cyan)]/10" },
  ok:       { dot: "bg-[var(--accent-green)]",  text: "text-[var(--accent-green)]",  bg: "bg-[var(--accent-green)]/[0.04]",  border: "border-[var(--accent-green)]/10" },
};

function fmtMinutes(m: number) {
  if (!m) return "0h";
  const h = Math.floor(m / 60), min = m % 60;
  return min > 0 ? `${h}h ${min}m` : `${h}h`;
}
function Sk({ w = "100%", h = 16 }: { w?: string | number; h?: number }) {
  return <div className="skeleton rounded-md" style={{ width: w, height: h }} />;
}

/* ═══════════════════════════════════════════════
   STATUS BAR
═══════════════════════════════════════════════ */
function StatusBar({ status, alerts, lastUpdated, onRefresh, loading }: {
  status: string; alerts: Alert[]; lastUpdated: Date | null; onRefresh: () => void; loading: boolean;
}) {
  const cfg = {
    operational: { bg: "bg-emerald-500/8 border-emerald-500/15",  dot: "bg-emerald-400", text: "text-emerald-400", label: "OPERACIONAL" },
    attention:   { bg: "bg-amber-500/8 border-amber-500/15",      dot: "bg-amber-400",   text: "text-amber-400",  label: "ATENÇÃO NECESSÁRIA" },
    warning:     { bg: "bg-orange-500/8 border-orange-500/15",    dot: "bg-orange-400",  text: "text-orange-400", label: "ALERTAS ATIVOS" },
    critical:    { bg: "bg-red-500/8 border-red-500/15",          dot: "bg-red-500",     text: "text-red-400",    label: "ESTADO CRÍTICO" },
  }[status] ?? { bg: "bg-[var(--bg-secondary)]", dot: "bg-gray-400", text: "text-gray-400", label: "VERIFICANDO..." };

  const critCount = alerts.filter(a => a.severity === "critical" || a.severity === "high").length;

  return (
    <div className={cn("flex items-center justify-between px-5 py-2.5 rounded-xl border text-[11px] font-mono", cfg.bg)}>
      <div className="flex items-center gap-3">
        <span className={cn("w-2 h-2 rounded-full animate-pulse", cfg.dot)} />
        <span className={cn("font-bold tracking-widest", cfg.text)}>{cfg.label}</span>
        {critCount > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-red-400 font-bold">
            {critCount} alerta{critCount > 1 ? "s" : ""} crítico{critCount > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-[var(--text-muted)]">
        {lastUpdated && (
          <span>Atualizado às {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
        )}
        <button onClick={onRefresh} disabled={loading}
          className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors disabled:opacity-50">
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          <span>Atualizar</span>
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SECTOR WIDGET
═══════════════════════════════════════════════ */
function MetricRow({ label, value, color = "text-[var(--text-primary)]", href, badge }: {
  label: string; value: string | number; color?: string; href?: string; badge?: string;
}) {
  const content = (
    <div className={cn("flex items-center justify-between py-1.5 group", href && "cursor-pointer hover:bg-[var(--bg-hover)] -mx-3 px-3 rounded-lg transition-colors")}>
      <span className="text-[12px] text-[var(--text-muted)] font-medium">{label}</span>
      <div className="flex items-center gap-2">
        {badge && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-red-400 font-bold">{badge}</span>}
        <span className={cn("text-[15px] font-bold font-display", color)}>{value}</span>
      </div>
    </div>
  );
  return href ? <Link href={href} className="block no-underline">{content}</Link> : content;
}

function SectorWidget({ title, icon: Icon, accent, href, metrics, loading, footer }: {
  title: string; icon: any; accent: string; href: string;
  metrics: { label: string; value: string | number; color?: string; href?: string; badge?: string }[];
  loading?: boolean; footer?: React.ReactNode;
}) {
  return (
    <div className="card-premium p-5 flex flex-col gap-0 group hover:border-[var(--border-medium)] transition-all duration-300">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${accent}18`, border: `1px solid ${accent}25` }}>
            <Icon size={14} style={{ color: accent }} strokeWidth={2} />
          </div>
          <span className="text-[12px] font-bold text-[var(--text-primary)] tracking-wide uppercase">{title}</span>
        </div>
        <Link href={href} className="opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowRight size={14} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors" />
        </Link>
      </div>
      <div className="divide-y divide-[var(--border-subtle)]">
        {loading ? Array(4).fill(0).map((_, i) => (
          <div key={i} className="py-1.5"><Sk h={14} w={`${60 + i * 8}%`} /></div>
        )) : metrics.map(m => (
          <MetricRow key={m.label} {...m} />
        ))}
      </div>
      {footer && <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">{footer}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   AI INSIGHTS PANEL
═══════════════════════════════════════════════ */
function AIInsightsPanel({ alerts, loading }: { alerts: Alert[]; loading: boolean }) {
  return (
    <div className="card-premium flex flex-col">
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-3 border-b border-[var(--border-subtle)] shrink-0">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-violet-500/12 border border-violet-500/20">
          <Brain size={14} className="text-violet-400" />
        </div>
        <div>
          <div className="text-[12px] font-bold text-[var(--text-primary)] uppercase tracking-wide">IA Insights</div>
          <div className="text-[10px] text-[var(--text-muted)] font-mono">Análise operacional em tempo real</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-2">
        {loading ? Array(4).fill(0).map((_, i) => (
          <div key={i} className="rounded-lg p-3 border border-[var(--border-subtle)] space-y-1.5">
            <Sk h={12} w="80%" /><Sk h={10} w="50%" />
          </div>
        )) : alerts.map((alert, i) => {
          const cfg = SEV_COLORS[alert.severity];
          const Icon = alert.icon;
          const content = (
            <div className={cn("flex items-start gap-3 p-3 rounded-xl border transition-all", cfg.bg, cfg.border, alert.href && "hover:brightness-110 cursor-pointer")}>
              <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 animate-pulse", cfg.dot)} />
              <Icon size={13} className={cn("shrink-0 mt-0.5", cfg.text)} />
              <span className={cn("text-[12px] font-medium leading-snug", cfg.text)}>{alert.label}</span>
              {alert.href && <ArrowRight size={11} className={cn("shrink-0 mt-0.5 ml-auto", cfg.text)} />}
            </div>
          );
          return alert.href ? (
            <Link key={i} href={alert.href} className="block no-underline">{content}</Link>
          ) : <div key={i}>{content}</div>;
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   CHART TOOLTIP
═══════════════════════════════════════════════ */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-glass)] backdrop-blur-md text-[12px] shadow-premium-md">
      <div className="text-[var(--text-muted)] font-mono mb-1">{label}</div>
      <div className="text-[var(--text-primary)] font-semibold">{payload[0].value} chamados</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN — COMMAND CENTER
═══════════════════════════════════════════════ */
export default function CommandCenter() {
  const { user } = useAuthStore();
  const [dash, setDash]   = useState<DashStats | null>(null);
  const [exec, setExec]   = useState<ExecStats | null>(null);
  const [aprov, setAprov] = useState<AprovStats | null>(null);
  const [daily, setDaily] = useState<DailyTask[]>([]);
  const [loading, setLoading]   = useState(true);
  const [loadingD, setLoadingD] = useState(true);
  const [newTask, setNewTask]   = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Widget visibility persisted to localStorage
  const [hidden, setHidden] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("cc-hidden") || "{}"); } catch { return {}; }
  });
  const [showSettings, setShowSettings] = useState(false);
  const toggleWidget = (id: string) => {
    setHidden(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem("cc-hidden", JSON.stringify(next));
      return next;
    });
  };

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const hour = today.getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const firstName = user?.nome?.split(" ")[0] || "usuário";

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2, r3] = await Promise.allSettled([
        api.get("/stats/dashboard"),
        api.get("/stats/executivo"),
        api.get("/workflows/requests/stats"),
      ]);
      if (r1.status === "fulfilled") setDash(r1.value.data);
      if (r2.status === "fulfilled") setExec(r2.value.data);
      if (r3.status === "fulfilled") setAprov(r3.value.data);
      setLastUpdated(new Date());
    } catch {}
    finally { setLoading(false); }
  }, []);

  const loadDaily = useCallback(() => {
    setLoadingD(true);
    api.get("/keep/daily", { params: { data: todayStr } })
      .then(r => setDaily(r.data))
      .catch(() => {})
      .finally(() => setLoadingD(false));
  }, [todayStr]);

  useEffect(() => { loadAll(); loadDaily(); }, []);

  // Auto-refresh every 3 minutes
  useEffect(() => {
    const t = setInterval(loadAll, 3 * 60 * 1000);
    return () => clearInterval(t);
  }, [loadAll]);

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
      setNewTask(""); loadDaily();
    } catch {
      useToastStore.getState().error("Erro", "Não foi possível criar a task.");
    } finally { setAddingTask(false); }
  };

  const concluidas = daily.filter(t => t.concluido).length;
  const pendentes  = daily.filter(t => !t.concluido).length;
  const progresso  = daily.length > 0 ? Math.round((concluidas / daily.length) * 100) : 0;

  const chartData = dash?.chamadosPorDia?.map(d => ({
    name: d.data.slice(5).replace("-", "/"), value: d.total,
  })) ?? [];

  const alerts = computeAlerts(exec, dash, aprov);
  const sysStatus = loading ? "operational" : systemStatus(alerts);

  // SLA compliance color
  const slaColor = !exec ? "" : exec.chamados.slaCompliancePct >= 90 ? "text-emerald-500" : exec.chamados.slaCompliancePct >= 70 ? "text-amber-500" : "text-red-500";

  /* ── Widget config ── */
  const WIDGETS = [
    { id: "chamados",   label: "Setor: Chamados" },
    { id: "projetos",   label: "Setor: Projetos" },
    { id: "aprovacoes", label: "Setor: Aprovações" },
    { id: "ativos",     label: "Setor: Ativos" },
    { id: "insights",   label: "IA Insights" },
    { id: "chart",      label: "Gráfico de Chamados" },
    { id: "atividade",  label: "Atividade Recente" },
    { id: "tasks",      label: "Tasks de Hoje" },
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      <Topbar />

      <div className="flex-1 overflow-y-auto page-content">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 space-y-4 sm:space-y-6 pb-8 sm:pb-24">

          {/* ── Header ── */}
          <div className="flex items-end justify-between animate-fade-in">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <LayoutDashboard size={14} className="text-[var(--text-muted)]" />
                <span className="text-[11px] font-mono font-medium text-[var(--text-muted)] uppercase tracking-widest">Command Center</span>
              </div>
              <h2 className="font-display text-[26px] font-bold text-[var(--text-primary)] tracking-tight">
                {greeting}, {firstName}
              </h2>
              <p className="text-[13px] text-[var(--text-secondary)] mt-1 font-medium">
                {today.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <button onClick={() => setShowSettings(s => !s)}
              className={cn("flex items-center gap-2 px-3.5 py-2 rounded-xl border text-[12px] font-medium transition-all",
                showSettings ? "border-violet-500/40 bg-violet-500/10 text-violet-400" : "border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}>
              <Settings2 size={13} />
              Widgets
            </button>
          </div>

          {/* ── Widget settings panel ── */}
          {showSettings && (
            <div className="card-premium p-4 animate-fade-in">
              <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-3">Visibilidade dos Widgets</div>
              <div className="flex flex-wrap gap-2">
                {WIDGETS.map(w => (
                  <button key={w.id} onClick={() => toggleWidget(w.id)}
                    className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-all",
                      hidden[w.id] ? "border-[var(--border-subtle)] text-[var(--text-muted)] opacity-60" : "border-violet-500/30 bg-violet-500/8 text-violet-400"
                    )}>
                    {hidden[w.id] ? <EyeOff size={11} /> : <Eye size={11} />}
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Status Bar ── */}
          <StatusBar status={sysStatus} alerts={alerts} lastUpdated={lastUpdated} onRefresh={loadAll} loading={loading} />

          {/* ── 4 Sector Widgets ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

            {!hidden.chamados && (
              <SectorWidget
                title="Chamados" icon={Headphones} accent="#3b82f6" href="/dashboard/chamados"
                loading={loading}
                metrics={[
                  { label: "Abertos",        value: exec?.chamados.abertos       ?? dash?.chamados?.abertos     ?? 0, color: (exec?.chamados.abertos ?? 0) > 0 ? "text-blue-400" : "text-emerald-500" },
                  { label: "Em Atendimento", value: exec?.chamados.emAtendimento  ?? "—", color: "text-amber-400" },
                  { label: "Urgentes",       value: exec?.chamados.urgentes       ?? dash?.chamados?.urgentes    ?? 0, color: (exec?.chamados.urgentes ?? 0) > 0 ? "text-orange-400" : "text-emerald-500", badge: (exec?.chamados.urgentes ?? 0) > 0 ? "!" : undefined },
                  { label: "SLA Violados",   value: exec?.chamados.slaViolados    ?? "—", color: (exec?.chamados.slaViolados ?? 0) > 0 ? "text-red-400" : "text-emerald-500" },
                  { label: "Resolvidos/mês", value: exec?.chamados.resolvidosMes  ?? "—", color: "text-emerald-400" },
                  { label: "SLA Compliance", value: exec ? `${exec.chamados.slaCompliancePct}%` : "—", color: slaColor },
                ]}
                footer={exec && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[var(--text-muted)]">CSAT médio:</span>
                    <span className="text-[13px] font-bold text-amber-400">{exec.chamados.csatMedia > 0 ? `${exec.chamados.csatMedia}★` : "—"}</span>
                    {exec.chamados.csatTotal > 0 && <span className="text-[10px] text-[var(--text-muted)]">({exec.chamados.csatTotal} aval.)</span>}
                  </div>
                )}
              />
            )}

            {!hidden.projetos && (
              <SectorWidget
                title="Projetos" icon={FolderKanban} accent="#a78bfa" href="/dashboard/projetos"
                loading={loading}
                metrics={[
                  { label: "Projetos Ativos",  value: exec?.projetos.ativos       ?? dash?.projetos.ativos       ?? 0, color: "text-violet-400" },
                  { label: "Concl./mês",       value: exec?.projetos.concluidosMes ?? "—", color: "text-emerald-400" },
                  { label: "Tasks — Total",    value: dash?.tasks.total            ?? "—", color: "text-[var(--text-primary)]" },
                  { label: "Tasks — Concl.",   value: dash?.tasks.concluidas       ?? "—", color: "text-emerald-400" },
                  { label: "Progresso Geral",  value: dash ? `${dash.tasks.progresso}%` : "—", color: dash && dash.tasks.progresso >= 70 ? "text-emerald-400" : "text-amber-400" },
                  { label: "Eventos Hoje",     value: dash?.eventos.hoje           ?? "—", color: "text-blue-400" },
                ]}
              />
            )}

            {!hidden.aprovacoes && (
              <SectorWidget
                title="Aprovações" icon={CheckSquare} accent="#10b981" href="/dashboard/aprovacoes"
                loading={loading}
                metrics={[
                  { label: "Aguard. minha apr.", value: aprov?.aguardandoMinhaAprovacao ?? "—", color: (aprov?.aguardandoMinhaAprovacao ?? 0) > 0 ? "text-orange-400" : "text-emerald-500", badge: (aprov?.aguardandoMinhaAprovacao ?? 0) > 0 ? "AGIR" : undefined },
                  { label: "Minhas pendentes",   value: aprov?.minhasPendentes           ?? "—", color: "text-amber-400" },
                  { label: "Aprovadas",           value: aprov?.aprovadas                ?? "—", color: "text-emerald-400" },
                  { label: "Rejeitadas",          value: aprov?.rejeitadas               ?? "—", color: (aprov?.rejeitadas ?? 0) > 0 ? "text-red-400" : "text-[var(--text-muted)]" },
                  { label: "Conhecimento",        value: exec?.conhecimento.artigos       ?? "—", color: "text-blue-400" },
                  { label: "Views / artigos",     value: exec ? `${(exec.conhecimento.visualizacoes || 0).toLocaleString("pt-BR")}` : "—", color: "text-[var(--text-muted)]" },
                ]}
              />
            )}

            {!hidden.ativos && (
              <SectorWidget
                title="Ativos" icon={Package} accent="#06b6d4" href="/dashboard/ativos"
                loading={loading}
                metrics={[
                  { label: "Total de Ativos",    value: exec?.ativos.total          ?? "—", color: "text-cyan-400" },
                  { label: "Em Manutenção",      value: exec?.ativos.emManutencao    ?? "—", color: (exec?.ativos.emManutencao ?? 0) > 0 ? "text-amber-400" : "text-emerald-500" },
                  { label: "Garantia Vencida",   value: exec?.ativos.garantiaVencida ?? "—", color: (exec?.ativos.garantiaVencida ?? 0) > 0 ? "text-red-400" : "text-emerald-500" },
                  { label: "Garantia a Vencer",  value: exec?.ativos.garantiaRisco   ?? "—", color: (exec?.ativos.garantiaRisco ?? 0) > 0 ? "text-amber-400" : "text-emerald-500" },
                  { label: "Contratos Ativos",   value: exec?.contratos.total        ?? "—", color: "text-[var(--text-primary)]" },
                  { label: "Contratos Vencendo", value: exec?.contratos.vencendo     ?? dash?.contratos?.vencendo30 ?? "—", color: (exec?.contratos.vencendo ?? 0) > 0 ? "text-amber-400" : "text-emerald-500" },
                ]}
                footer={exec && exec.contratos.valorTotal > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[var(--text-muted)]">Valor contratos:</span>
                    <span className="text-[12px] font-bold text-cyan-400">
                      {exec.contratos.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
              />
            )}
          </div>

          {/* ── Middle row: AI Insights + Chart ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">

            {!hidden.insights && (
              <div className="xl:col-span-1">
                <AIInsightsPanel alerts={alerts} loading={loading} />
              </div>
            )}

            {!hidden.chart && (
              <div className={cn(hidden.insights ? "xl:col-span-3" : "xl:col-span-2")}>
                <div className="card-premium p-6 h-full">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-[14px] font-bold text-[var(--text-primary)]">Volume de Chamados</h3>
                      <p className="text-[12px] text-[var(--text-muted)] mt-0.5 font-mono">Novos chamados — últimos 14 dias</p>
                    </div>
                    <Link href="/dashboard/chamados" className="flex items-center gap-1 text-[12px] font-medium text-[var(--accent-violet)] hover:opacity-80 transition-opacity">
                      Ver todos <ChevronRight size={13} />
                    </Link>
                  </div>
                  {loading ? <Sk h={200} /> : chartData.length > 0 ? (
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="ccGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.22} />
                              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
                            axisLine={false} tickLine={false} interval={2} dy={10} />
                          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border-strong)", strokeWidth: 1, strokeDasharray: "4 4" }} />
                          <Area type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2.5}
                            fill="url(#ccGrad)" dot={{ r: 0 }}
                            activeDot={{ r: 5, fill: "#8b5cf6", stroke: "var(--bg-card)", strokeWidth: 2 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-[13px] text-[var(--text-muted)] border border-dashed border-[var(--border-medium)] rounded-xl">
                      Sem dados suficientes para gerar o gráfico
                    </div>
                  )}

                  {/* Horas summary */}
                  {exec && (
                    <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] flex items-center gap-6">
                      <div>
                        <div className="text-[10px] text-[var(--text-muted)] uppercase font-mono tracking-wide">Horas apontadas/mês</div>
                        <div className="text-[15px] font-bold text-[var(--text-primary)]">{fmtMinutes(exec.horas.totalMinutos)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[var(--text-muted)] uppercase font-mono tracking-wide">Registros</div>
                        <div className="text-[15px] font-bold text-[var(--text-primary)]">{exec.horas.totalRegistros}</div>
                      </div>
                      <Link href="/dashboard/apontamentos" className="ml-auto text-[12px] text-[var(--accent-violet)] hover:opacity-80 transition-opacity flex items-center gap-1">
                        Ver horas <ArrowRight size={12} />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Bottom row: Activity + Tasks ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-5 gap-4">

            {/* Activity Feed */}
            {!hidden.atividade && (
              <div className="xl:col-span-3 card-premium flex flex-col">
                <div className="flex items-center justify-between p-5 border-b border-[var(--border-subtle)] shrink-0">
                  <div className="flex items-center gap-2.5">
                    <Activity size={14} className="text-[var(--text-muted)]" />
                    <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Atividade Recente</h3>
                  </div>
                  <Link href="/dashboard/chamados" className="text-[12px] font-medium text-[var(--accent-violet)] hover:opacity-80 transition-opacity">
                    Ver todos
                  </Link>
                </div>
                {loading ? (
                  <div className="p-5 space-y-3">{Array(5).fill(0).map((_, i) => <Sk key={i} h={36} />)}</div>
                ) : !dash?.ativRecentes?.length ? (
                  <div className="flex-1 flex items-center justify-center text-[13px] text-[var(--text-muted)] p-8 text-center">
                    Nenhuma atividade recente.
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border-subtle)]">
                    {dash.ativRecentes.map(c => (
                      <Link key={c.id} href={`/dashboard/chamados/${c.id}`}
                        className="group flex items-start gap-4 p-4 hover:bg-[var(--bg-hover)] transition-colors block no-underline">
                        <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", PRIO_DOT[c.prioridade] ?? "bg-[var(--border-strong)]")} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--accent-violet)] transition-colors">
                            #{c.numero} {c.titulo}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
                            {c.cliente?.empresa || c.cliente?.nome || "Sem empresa"}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={cn("text-[10px] font-bold uppercase tracking-wider", STATUS_COLOR[c.status])}>{STATUS_LABEL[c.status]}</div>
                          <div className="text-[10px] text-[var(--text-faint)] font-mono mt-1">
                            {new Date(c.atualizadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tasks de hoje */}
            {!hidden.tasks && (
              <div className={cn("card-premium flex flex-col", hidden.atividade ? "xl:col-span-5" : "xl:col-span-2")}>
                <div className="flex items-center justify-between p-5 border-b border-[var(--border-subtle)] shrink-0">
                  <div className="flex items-center gap-2.5">
                    <CheckSquare size={14} className="text-[var(--text-muted)]" />
                    <div>
                      <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Tasks de Hoje</h3>
                      <p className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">
                        {today.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  </div>
                  <Link href="/dashboard/keep" className="text-[12px] font-medium text-[var(--accent-violet)] hover:opacity-80 transition-opacity">
                    Keep
                  </Link>
                </div>

                {daily.length > 0 && (
                  <div className="px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 shrink-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] text-[var(--text-muted)]">{concluidas}/{daily.length} concluídas</span>
                      <span className="text-[12px] font-bold text-violet-500">{progresso}%</span>
                    </div>
                    <div className="h-1.5 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-violet-500 transition-all duration-700" style={{ width: `${progresso}%` }} />
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto">
                  {loadingD ? (
                    <div className="p-5 space-y-3">{Array(4).fill(0).map((_, i) => <Sk key={i} h={40} />)}</div>
                  ) : daily.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center px-6">
                      <CircleCheckBig size={28} className="text-[var(--text-faint)] mb-3" />
                      <p className="text-[13px] font-medium text-[var(--text-primary)] mb-1">Agenda limpa</p>
                      <p className="text-[12px] text-[var(--text-muted)]">Adicione tarefas abaixo.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--border-subtle)]">
                      {daily.slice(0, 8).map(task => (
                        <div key={task.id} onClick={() => toggleTask(task.id, task.concluido)}
                          className={cn("group flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-[var(--bg-hover)] transition-all", task.concluido && "opacity-50")}>
                          <div className={cn("w-4 h-4 rounded-[5px] flex items-center justify-center shrink-0 border transition-all",
                            task.concluido ? "bg-violet-500 border-violet-500 text-white" : "border-[var(--border-strong)] group-hover:border-violet-500/50")}>
                            {task.concluido && <Check size={10} strokeWidth={3} />}
                          </div>
                          <span className={cn("flex-1 text-[12px] font-medium truncate",
                            task.concluido ? "text-[var(--text-muted)] line-through" : "text-[var(--text-primary)]")}>
                            {task.titulo}
                          </span>
                          <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full uppercase font-bold border shrink-0", TIPO_COLORS[task.tipo])}>
                            {task.tipo}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex gap-2 shrink-0">
                  <input className="input-o text-[12px]" placeholder="Nova tarefa rápida…"
                    value={newTask} onChange={e => setNewTask(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && createTask()} />
                  <button onClick={createTask} disabled={addingTask || !newTask.trim()} className="btn btn-primary px-3 shrink-0">
                    {addingTask ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Quick Access ── */}
          <div className="card-premium p-5">
            <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-4">Acesso Rápido</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { href: "/dashboard/executivo",  label: "Executivo",    icon: TrendingUp,  accent: "#10b981" },
                { href: "/dashboard/relatorios", label: "Relatórios",   icon: BarChart3,   accent: "#3b82f6" },
                { href: "/dashboard/agenda",     label: "Agenda",       icon: Calendar,    accent: "#f59e0b" },
                { href: "/dashboard/orcamento",  label: "Orçamento",    icon: PiggyBank,   accent: "#a78bfa" },
                { href: "/dashboard/clientes",   label: "Clientes",     icon: Building2,   accent: "#06b6d4" },
                { href: "/dashboard/workforce",  label: "Workforce",    icon: Users,       accent: "#ec4899" },
                { href: "/dashboard/contratos",  label: "Contratos",    icon: FileText,    accent: "#0ea5e9" },
                { href: "/dashboard/faturas",    label: "Faturas",      icon: Receipt,     accent: "#34d399" },
                { href: "/dashboard/gantt",      label: "Linha do Tempo", icon: Activity,  accent: "#f97316" },
                { href: "/dashboard/keep",       label: "Keep",         icon: StickyNote,  accent: "#8b5cf6" },
                { href: "/dashboard/conhecimento",label:"Conhecimento", icon: CheckCircle2,accent: "#22d3ee" },
                { href: "/dashboard/ativos",     label: "Ativos",       icon: Package,     accent: "#64748b" },
              ].map(m => {
                const Icon = m.icon;
                return (
                  <Link key={m.href} href={m.href}
                    className="group flex items-center gap-3 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-medium)] transition-all">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${m.accent}18`, border: `1px solid ${m.accent}22` }}>
                      <Icon size={13} style={{ color: m.accent }} />
                    </div>
                    <span className="text-[12px] font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors truncate">{m.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
