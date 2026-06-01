"use client";
import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import Topbar from "@/components/layout/Topbar";
import { cn } from "@/lib/utils";
import {
  Brain, RefreshCw, TrendingUp, TrendingDown, Minus,
  AlertTriangle, CheckCircle, Lightbulb, Activity, Shield,
  Zap, Package, FileText, Clock, ChevronRight,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface ExecStats {
  chamados: { abertos: number; urgentes: number; resolvidosMes: number; slaViolados: number; slaCompliancePct: number; csatMedia: number; csatTotal: number };
  projetos: { ativos: number; concluidosMes: number };
  ativos: { total: number; emManutencao: number; garantiaRisco: number; garantiaVencida: number };
  contratos: { total: number; vigentes: number; vencendo: number; vencidos: number };
  horas: { totalMinutos: number; totalRegistros: number };
  conhecimento: { artigos: number; visualizacoes: number };
}
interface DashStats {
  chamadosPorDia?: { data: string; total: number }[];
}
interface AprovStats {
  minhasPendentes: number; aguardandoMinhaAprovacao: number; aprovadas: number; rejeitadas: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function movingAvg(data: number[], window: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < window - 1) return null;
    const slice = data.slice(i - window + 1, i + 1);
    return Math.round((slice.reduce((a, b) => a + b, 0) / window) * 10) / 10;
  });
}

function stdDev(data: number[]): number {
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  return Math.sqrt(data.reduce((sum, v) => sum + (v - mean) ** 2, 0) / data.length);
}

function computeScore(exec: ExecStats): number {
  const slaScore = exec.chamados.slaCompliancePct;
  const csatScore = exec.chamados.csatTotal > 0 ? (exec.chamados.csatMedia / 5) * 100 : 75;
  const projScore = exec.projetos.ativos > 0
    ? Math.min(100, (exec.projetos.concluidosMes / exec.projetos.ativos) * 100)
    : 100;
  return Math.round(slaScore * 0.4 + csatScore * 0.3 + projScore * 0.3);
}

// ── Circular Score ───────────────────────────────────────────────────────────

function CircularScore({ score }: { score: number }) {
  const r = 68;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  const label = score >= 80 ? "Excelente" : score >= 60 ? "Regular" : "Crítico";

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="10" />
        <circle cx="80" cy="80" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 80 80)" style={{ transition: "stroke-dasharray 1s ease" }} />
        <text x="80" y="72" textAnchor="middle" fill="var(--text-primary)"
          fontSize="28" fontWeight="700" fontFamily="var(--font-display)">{score}</text>
        <text x="80" y="92" textAnchor="middle" fill="var(--text-muted)" fontSize="11" fontFamily="var(--font-mono)">/ 100</text>
        <text x="80" y="110" textAnchor="middle" fill={color} fontSize="11" fontWeight="600" fontFamily="var(--font-body)">{label}</text>
      </svg>
      <div className="text-center">
        <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono">Score Operacional</div>
        <div className="text-[10px] text-[var(--text-faint)] font-mono mt-0.5">Calculado em tempo real</div>
      </div>
    </div>
  );
}

// ── Sparkline + Trend Chart ──────────────────────────────────────────────────

function TrendChart({ data }: { data: { data: string; total: number }[] }) {
  const values = data.map(d => d.total);
  const avg7 = movingAvg(values, 7);
  const mean = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const sd = stdDev(values);
  const anomalyThreshold = mean + sd * 1.5;

  const W = 520; const H = 140; const PAD = 16;
  const maxV = Math.max(...values, 1);
  const minV = Math.min(...values, 0);
  const range = maxV - minV || 1;

  const xOf = (i: number) => PAD + (i / (values.length - 1 || 1)) * (W - PAD * 2);
  const yOf = (v: number) => H - PAD - ((v - minV) / range) * (H - PAD * 2);

  const linePath = values.map((v, i) => `${i === 0 ? "M" : "L"} ${xOf(i)} ${yOf(v)}`).join(" ");
  const avgPoints = avg7.map((v, i) => (v !== null ? `${i === avg7.findIndex(x => x !== null) ? "M" : "L"} ${xOf(i)} ${yOf(v)}` : null)).filter(Boolean);

  const lastValues = values.slice(-7);
  const prevValues = values.slice(-14, -7);
  const lastAvg = lastValues.length ? lastValues.reduce((a, b) => a + b, 0) / lastValues.length : 0;
  const prevAvg = prevValues.length ? prevValues.reduce((a, b) => a + b, 0) / prevValues.length : lastAvg;
  const trendPct = prevAvg > 0 ? Math.round(((lastAvg - prevAvg) / prevAvg) * 100) : 0;
  const TrendIcon = trendPct > 5 ? TrendingUp : trendPct < -5 ? TrendingDown : Minus;
  const trendColor = trendPct > 5 ? "text-red-400" : trendPct < -5 ? "text-emerald-400" : "text-[var(--text-muted)]";

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-widest">Chamados — últimos {values.length} dias</div>
        <div className={cn("flex items-center gap-1 text-[12px] font-bold", trendColor)}>
          <TrendIcon size={13} />
          {trendPct > 0 ? "+" : ""}{trendPct}% vs semana anterior
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg width={W} height={H} style={{ minWidth: "100%" }} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(t => (
            <line key={t} x1={PAD} y1={PAD + t * (H - PAD * 2)} x2={W - PAD} y2={PAD + t * (H - PAD * 2)}
              stroke="var(--border-subtle)" strokeWidth="1" />
          ))}
          {/* Area fill */}
          <defs>
            <linearGradient id="iaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={`${linePath} L ${xOf(values.length - 1)} ${H - PAD} L ${xOf(0)} ${H - PAD} Z`}
            fill="url(#iaGrad)" />
          {/* Main line */}
          <path d={linePath} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {/* 7-day avg dashed */}
          <path d={avgPoints.join(" ")} fill="none" stroke="#f59e0b" strokeWidth="1.5"
            strokeDasharray="4 3" strokeLinecap="round" />
          {/* Anomaly dots */}
          {values.map((v, i) => v > anomalyThreshold ? (
            <circle key={i} cx={xOf(i)} cy={yOf(v)} r={4} fill="#ef4444" stroke="var(--bg-card)" strokeWidth="2" />
          ) : null)}
          {/* Regular dots */}
          {values.map((v, i) => v <= anomalyThreshold ? (
            <circle key={i} cx={xOf(i)} cy={yOf(v)} r={2.5} fill="#8b5cf6" opacity={0.6} />
          ) : null)}
          {/* X labels — every 2 */}
          {data.filter((_, i) => i % 2 === 0).map((d, ii) => {
            const i = ii * 2;
            return (
              <text key={d.data} x={xOf(i)} y={H} fill="var(--text-faint)" fontSize={9}
                textAnchor="middle" fontFamily="var(--font-mono)">{d.data.slice(5).replace("-", "/")}</text>
            );
          })}
        </svg>
      </div>
      <div className="flex items-center gap-4 mt-2 text-[10px] text-[var(--text-muted)] font-mono">
        <span className="flex items-center gap-1"><span className="w-6 border-t-2 border-violet-500 inline-block" /> Volume diário</span>
        <span className="flex items-center gap-1"><span className="w-6 border-t-[1.5px] border-dashed border-amber-400 inline-block" /> Média 7 dias</span>
        {values.some(v => v > anomalyThreshold) && (
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Anomalia</span>
        )}
      </div>
    </div>
  );
}

// ── Risk Matrix ──────────────────────────────────────────────────────────────

type RiskItem = { label: string; quadrant: "critical" | "high" | "medium" | "low" };

function buildRiskItems(exec: ExecStats): RiskItem[] {
  const items: RiskItem[] = [];
  if (exec.chamados.slaViolados > 0)
    items.push({ label: `${exec.chamados.slaViolados} SLA${exec.chamados.slaViolados > 1 ? "s" : ""} violado${exec.chamados.slaViolados > 1 ? "s" : ""}`, quadrant: "critical" });
  if (exec.chamados.urgentes > 3)
    items.push({ label: `${exec.chamados.urgentes} chamados urgentes`, quadrant: "critical" });
  else if (exec.chamados.urgentes > 0)
    items.push({ label: `${exec.chamados.urgentes} chamado${exec.chamados.urgentes > 1 ? "s" : ""} urgente${exec.chamados.urgentes > 1 ? "s" : ""}`, quadrant: "medium" });
  if (exec.ativos.garantiaVencida > 0)
    items.push({ label: `${exec.ativos.garantiaVencida} garantia${exec.ativos.garantiaVencida > 1 ? "s" : ""} vencida${exec.ativos.garantiaVencida > 1 ? "s" : ""}`, quadrant: "high" });
  if (exec.contratos.vencendo > 0)
    items.push({ label: `${exec.contratos.vencendo} contrato${exec.contratos.vencendo > 1 ? "s" : ""} vencendo`, quadrant: "medium" });
  if (exec.ativos.garantiaRisco > 0)
    items.push({ label: `${exec.ativos.garantiaRisco} garantia${exec.ativos.garantiaRisco > 1 ? "s" : ""} a vencer`, quadrant: "low" });
  if (exec.chamados.slaCompliancePct < 60)
    items.push({ label: `SLA compliance crítico (${exec.chamados.slaCompliancePct}%)`, quadrant: "critical" });
  else if (exec.chamados.slaCompliancePct < 80)
    items.push({ label: `SLA compliance baixo (${exec.chamados.slaCompliancePct}%)`, quadrant: "high" });
  return items;
}

const QUADRANT_CFG = {
  critical: { label: "CRÍTICO",  bg: "bg-red-500/12",    border: "border-red-500/25",    dot: "bg-red-500",    title: "bg-red-500/20 text-red-400",    axis: "Alta Prob. / Alto Impacto" },
  high:     { label: "ALTO",     bg: "bg-orange-500/12", border: "border-orange-500/25", dot: "bg-orange-400", title: "bg-orange-500/20 text-orange-400", axis: "Baixa Prob. / Alto Impacto" },
  medium:   { label: "MÉDIO",    bg: "bg-amber-500/10",  border: "border-amber-500/20",  dot: "bg-amber-400",  title: "bg-amber-500/15 text-amber-400",  axis: "Alta Prob. / Baixo Impacto" },
  low:      { label: "BAIXO",    bg: "bg-emerald-500/8", border: "border-emerald-500/20",dot: "bg-emerald-400",title: "bg-emerald-500/12 text-emerald-400", axis: "Baixa Prob. / Baixo Impacto" },
};

function RiskMatrix({ items }: { items: RiskItem[] }) {
  const quadrants = (["critical", "high", "medium", "low"] as const);
  return (
    <div>
      <div className="text-[10px] font-mono text-[var(--text-muted)] mb-2 flex items-center justify-between">
        <span className="uppercase tracking-widest">Matriz de Risco</span>
        <span className="flex items-center gap-3">
          <span className="opacity-60">↑ Impacto</span>
          <span className="opacity-60">→ Probabilidade</span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {quadrants.map(q => {
          const cfg = QUADRANT_CFG[q];
          const qItems = items.filter(i => i.quadrant === q);
          return (
            <div key={q} className={cn("rounded-xl border p-3 min-h-[100px]", cfg.bg, cfg.border)}>
              <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold mb-2", cfg.title)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                {cfg.label}
              </div>
              <div className="text-[9px] text-[var(--text-faint)] font-mono mb-2">{cfg.axis}</div>
              {qItems.length === 0 ? (
                <div className="text-[11px] text-[var(--text-faint)] flex items-center gap-1.5">
                  <CheckCircle size={11} className="text-emerald-400/60" /> Sem riscos
                </div>
              ) : (
                <div className="space-y-1">
                  {qItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px] text-[var(--text-secondary)]">
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0 mt-1", cfg.dot)} />
                      {item.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Recommendations ──────────────────────────────────────────────────────────

type Rec = { icon: any; text: string; priority: "high" | "medium" | "low"; href: string };

function buildRecommendations(exec: ExecStats, aprov: AprovStats): Rec[] {
  const recs: Rec[] = [];
  if (exec.chamados.slaCompliancePct < 80)
    recs.push({ icon: Activity, text: "Revisar capacidade da equipe de suporte", priority: "high", href: "/dashboard/capacity" });
  if (exec.chamados.urgentes > 3)
    recs.push({ icon: Zap, text: `Priorizar chamados urgentes — risco de SLA (${exec.chamados.urgentes} abertos)`, priority: "high", href: "/dashboard/chamados" });
  if (exec.ativos.garantiaVencida > 0)
    recs.push({ icon: Package, text: `Renovar garantias de ${exec.ativos.garantiaVencida} ativo${exec.ativos.garantiaVencida > 1 ? "s" : ""} crítico${exec.ativos.garantiaVencida > 1 ? "s" : ""}`, priority: "high", href: "/dashboard/ativos" });
  if (exec.contratos.vencendo > 0)
    recs.push({ icon: FileText, text: `Analisar ${exec.contratos.vencendo} contrato${exec.contratos.vencendo > 1 ? "s" : ""} próximo${exec.contratos.vencendo > 1 ? "s" : ""} do vencimento`, priority: "medium", href: "/dashboard/contratos" });
  if (aprov.aguardandoMinhaAprovacao > 5)
    recs.push({ icon: Clock, text: `Gargalo detectado no fluxo de aprovações (${aprov.aguardandoMinhaAprovacao} pendentes)`, priority: "medium", href: "/dashboard/aprovacoes" });
  if (exec.projetos.ativos > 5)
    recs.push({ icon: TrendingUp, text: `Alta carga em projetos (${exec.projetos.ativos} ativos) — avaliar capacidade`, priority: "medium", href: "/dashboard/projetos" });
  if (recs.length === 0)
    recs.push({ icon: CheckCircle, text: "Todos os indicadores operacionais estão dentro dos parâmetros ideais.", priority: "low", href: "" });
  return recs;
}

const REC_CFG = {
  high:   { border: "border-red-500/25",    bg: "bg-red-500/8",    dot: "bg-red-500",    text: "text-red-400" },
  medium: { border: "border-amber-500/20",  bg: "bg-amber-500/8",  dot: "bg-amber-400",  text: "text-amber-400" },
  low:    { border: "border-emerald-500/20",bg: "bg-emerald-500/8",dot: "bg-emerald-400",text: "text-emerald-400" },
};

// ── Anomaly Detection ────────────────────────────────────────────────────────

function AnomalyPanel({ data, exec }: { data: { data: string; total: number }[]; exec: ExecStats }) {
  const values = data.map(d => d.total);
  const mean = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const sd = stdDev(values);
  const threshold = mean + sd * 1.5;

  const anomalies = data.filter(d => d.total > threshold);
  const currentWeek = values.slice(-7);
  const prevWeek = values.slice(-14, -7);
  const cwTotal = currentWeek.reduce((a, b) => a + b, 0);
  const pwTotal = prevWeek.reduce((a, b) => a + b, 0);
  const weekDiff = pwTotal > 0 ? Math.round(((cwTotal - pwTotal) / pwTotal) * 100) : 0;

  const slaOk = exec.chamados.slaCompliancePct >= 80;
  const slaDeviation = Math.abs(exec.chamados.slaCompliancePct - 90);

  return (
    <div className="space-y-3">
      {/* Week comparison */}
      <div className={cn("rounded-xl border p-3", weekDiff > 20 ? "bg-red-500/8 border-red-500/25" : weekDiff > 0 ? "bg-amber-500/8 border-amber-500/20" : "bg-emerald-500/8 border-emerald-500/20")}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wide">Chamados: semana atual vs anterior</span>
          <span className={cn("text-[12px] font-bold font-mono", weekDiff > 10 ? "text-red-400" : weekDiff < -10 ? "text-emerald-400" : "text-amber-400")}>
            {weekDiff > 0 ? "+" : ""}{weekDiff}%
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-[var(--text-muted)]">Esta semana: <strong className="text-[var(--text-primary)]">{cwTotal}</strong></span>
          <span className="text-[var(--text-faint)]">/</span>
          <span className="text-[var(--text-muted)]">Anterior: <strong className="text-[var(--text-primary)]">{pwTotal}</strong></span>
        </div>
      </div>

      {/* SLA deviation */}
      <div className={cn("rounded-xl border p-3", slaOk ? "bg-emerald-500/8 border-emerald-500/20" : "bg-red-500/8 border-red-500/25")}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wide">Desvio de SLA Compliance</span>
          <span className={cn("text-[12px] font-bold font-mono", slaOk ? "text-emerald-400" : "text-red-400")}>
            {slaOk ? "Normal" : `−${slaDeviation}pp`}
          </span>
        </div>
        <div className="text-[11px] text-[var(--text-muted)]">
          Meta: <strong className="text-[var(--text-primary)]">90%</strong> — Atual: <strong className={slaOk ? "text-emerald-400" : "text-red-400"}>{exec.chamados.slaCompliancePct}%</strong>
        </div>
      </div>

      {/* Anomaly spikes */}
      {anomalies.length > 0 ? (
        <div className="rounded-xl border border-red-500/25 bg-red-500/8 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle size={12} className="text-red-400" />
            <span className="text-[10px] font-mono text-red-400 uppercase tracking-wide">{anomalies.length} pico{anomalies.length > 1 ? "s" : ""} anômalo{anomalies.length > 1 ? "s" : ""} detectado{anomalies.length > 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-1">
            {anomalies.slice(0, 3).map(a => (
              <div key={a.data} className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--text-muted)] font-mono">{a.data.slice(5).replace("-", "/")}</span>
                <span className="text-red-400 font-bold">{a.total} chamados</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
            <CheckCircle size={12} />
            Sem picos anômalos no período
          </div>
        </div>
      )}
    </div>
  );
}

// ── KPI Table ────────────────────────────────────────────────────────────────

function MetricTableRow({ label, value, status, href }: { label: string; value: string; status: "ok" | "warn" | "crit"; href?: string }) {
  const cfg = { ok: "text-emerald-400", warn: "text-amber-400", crit: "text-red-400" };
  const dot = { ok: "bg-emerald-400", warn: "bg-amber-400", crit: "bg-red-400" };
  const content = (
    <div className="flex items-center justify-between py-2 px-4 hover:bg-[var(--bg-hover)] transition-colors group">
      <div className="flex items-center gap-2.5">
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dot[status])} />
        <span className="text-[12px] text-[var(--text-secondary)]">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn("text-[13px] font-bold font-mono", cfg[status])}>{value}</span>
        {href && <ChevronRight size={11} className="text-[var(--text-faint)] opacity-0 group-hover:opacity-100 transition-opacity" />}
      </div>
    </div>
  );
  return href ? <a href={href} className="block no-underline">{content}</a> : content;
}

// ── Quick Insight Card ───────────────────────────────────────────────────────

function InsightCard({ icon: Icon, label, value, color, sub }: { icon: any; label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="card-premium p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest">{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}18`, border: `1px solid ${color}28` }}>
          <Icon size={13} style={{ color }} />
        </div>
      </div>
      <div className="font-display text-[26px] font-bold leading-none" style={{ color }}>{value}</div>
      {sub && <div className="text-[10px] text-[var(--text-muted)]">{sub}</div>}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function IAPage() {
  const [exec, setExec]   = useState<ExecStats | null>(null);
  const [dash, setDash]   = useState<DashStats | null>(null);
  const [aprov, setAprov] = useState<AprovStats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  async function load(silent = false) {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [r1, r2, r3] = await Promise.allSettled([
        api.get<ExecStats>("/stats/executivo"),
        api.get<DashStats>("/stats/dashboard"),
        api.get<AprovStats>("/workflows/requests/stats"),
      ]);
      if (r1.status === "fulfilled") setExec(r1.value.data);
      if (r2.status === "fulfilled") setDash(r2.value.data);
      if (r3.status === "fulfilled") setAprov(r3.value.data);
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  const score     = useMemo(() => exec ? computeScore(exec) : 0, [exec]);
  const riskItems = useMemo(() => exec ? buildRiskItems(exec) : [], [exec]);
  const recs      = useMemo(() => exec && aprov ? buildRecommendations(exec, aprov) : [], [exec, aprov]);
  const chartData = useMemo(() => dash?.chamadosPorDia?.slice(-14) ?? [], [dash]);

  const scoreColor = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

  if (loading) return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      <Topbar />
      <div className="flex items-center justify-center flex-1">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-[12px] text-[var(--text-muted)] font-mono">Computando inteligência operacional...</span>
        </div>
      </div>
    </div>
  );

  if (!exec || !aprov) return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      <Topbar />
      <div className="p-8 text-[var(--text-muted)] text-[13px]">Erro ao carregar dados. Tente novamente.</div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      <Topbar>
        {lastUpdate && (
          <span className="text-[11px] text-[var(--text-muted)] font-mono">
            {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <button onClick={() => load(true)} disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50">
          <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          Atualizar
        </button>
      </Topbar>

      <div className="flex-1 overflow-y-auto page-content">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8 space-y-6 pb-20">

          {/* ── Header ── */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-violet-500/12 border border-violet-500/25">
              <Brain size={17} className="text-violet-400" />
            </div>
            <div>
              <h1 className="font-display text-[22px] font-bold text-[var(--text-primary)] tracking-tight">IA Operacional</h1>
              <p className="text-[12px] text-[var(--text-muted)] font-mono">Inteligência derivada de dados reais — análise em tempo real</p>
            </div>
          </div>

          {/* ── Row 1: Score + Quick Insights ── */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="card-premium p-6 flex items-center justify-center lg:col-span-1">
              <CircularScore score={score} />
            </div>
            <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4 content-start">
              <InsightCard
                icon={Shield} label="SLA Compliance"
                value={`${exec.chamados.slaCompliancePct}%`}
                color={exec.chamados.slaCompliancePct >= 90 ? "#10b981" : exec.chamados.slaCompliancePct >= 70 ? "#f59e0b" : "#ef4444"}
                sub={exec.chamados.slaViolados > 0 ? `${exec.chamados.slaViolados} violados` : "Dentro do alvo"}
              />
              <InsightCard
                icon={Activity} label="CSAT Médio"
                value={exec.chamados.csatTotal > 0 ? `${exec.chamados.csatMedia}★` : "—"}
                color={exec.chamados.csatMedia >= 4 ? "#10b981" : exec.chamados.csatMedia >= 3 ? "#f59e0b" : "#ef4444"}
                sub={exec.chamados.csatTotal > 0 ? `${exec.chamados.csatTotal} avaliações` : "Sem avaliações"}
              />
              <InsightCard
                icon={Lightbulb} label="Recomendações Ativas"
                value={String(recs.filter(r => r.priority !== "low" || recs.length === 1).length)}
                color={recs.some(r => r.priority === "high") ? "#ef4444" : recs.some(r => r.priority === "medium") ? "#f59e0b" : "#10b981"}
                sub={recs.some(r => r.priority === "high") ? "Ação imediata necessária" : "Monitoramento recomendado"}
              />
            </div>
          </div>

          {/* ── Row 2: Risk Matrix + Recommendations ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card-premium p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg bg-red-500/12 border border-red-500/20 flex items-center justify-center">
                  <AlertTriangle size={12} className="text-red-400" />
                </div>
                <h2 className="text-[13px] font-bold text-[var(--text-primary)]">Matriz de Risco</h2>
              </div>
              <RiskMatrix items={riskItems} />
            </div>

            <div className="card-premium p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg bg-amber-500/12 border border-amber-500/20 flex items-center justify-center">
                  <Lightbulb size={12} className="text-amber-400" />
                </div>
                <h2 className="text-[13px] font-bold text-[var(--text-primary)]">Recomendações Inteligentes</h2>
              </div>
              <div className="space-y-2">
                {recs.map((rec, i) => {
                  const cfg = REC_CFG[rec.priority];
                  const Icon = rec.icon;
                  const content = (
                    <div className={cn("flex items-start gap-3 p-3 rounded-xl border", cfg.bg, cfg.border)}>
                      <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", cfg.dot)} />
                      <Icon size={13} className={cn("shrink-0 mt-0.5", cfg.text)} />
                      <span className={cn("text-[12px] font-medium leading-snug flex-1", cfg.text)}>{rec.text}</span>
                      {rec.href && <ChevronRight size={11} className={cn("shrink-0 mt-0.5", cfg.text)} />}
                    </div>
                  );
                  return rec.href
                    ? <a key={i} href={rec.href} className="block no-underline hover:opacity-90 transition-opacity">{content}</a>
                    : <div key={i}>{content}</div>;
                })}
              </div>
            </div>
          </div>

          {/* ── Row 3: Trend Chart + Anomaly Detection ── */}
          {chartData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="card-premium p-5 lg:col-span-2">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-lg bg-violet-500/12 border border-violet-500/20 flex items-center justify-center">
                    <TrendingUp size={12} className="text-violet-400" />
                  </div>
                  <h2 className="text-[13px] font-bold text-[var(--text-primary)]">Análise de Tendência</h2>
                </div>
                <TrendChart data={chartData} />
              </div>

              <div className="card-premium p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-lg bg-orange-500/12 border border-orange-500/20 flex items-center justify-center">
                    <Zap size={12} className="text-orange-400" />
                  </div>
                  <h2 className="text-[13px] font-bold text-[var(--text-primary)]">Detecção de Anomalias</h2>
                </div>
                <AnomalyPanel data={chartData} exec={exec} />
              </div>
            </div>
          )}

          {/* ── Row 4: Detailed KPI Table ── */}
          <div className="card-premium overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-500/12 border border-blue-500/20 flex items-center justify-center">
                <Activity size={12} className="text-blue-400" />
              </div>
              <h2 className="text-[13px] font-bold text-[var(--text-primary)]">KPIs Operacionais Detalhados</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 divide-[var(--border-subtle)]">
              {/* Chamados */}
              <div className="border-r border-[var(--border-subtle)]">
                <div className="px-4 py-2.5 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
                  Chamados
                </div>
                <MetricTableRow label="Abertos"          value={String(exec.chamados.abertos)}        status={exec.chamados.abertos > 20 ? "warn" : "ok"} href="/dashboard/chamados" />
                <MetricTableRow label="Urgentes"         value={String(exec.chamados.urgentes)}       status={exec.chamados.urgentes > 0 ? "crit" : "ok"} href="/dashboard/chamados" />
                <MetricTableRow label="SLA Violados"     value={String(exec.chamados.slaViolados)}    status={exec.chamados.slaViolados > 0 ? "crit" : "ok"} href="/dashboard/chamados" />
                <MetricTableRow label="SLA Compliance"   value={`${exec.chamados.slaCompliancePct}%`} status={exec.chamados.slaCompliancePct >= 90 ? "ok" : exec.chamados.slaCompliancePct >= 70 ? "warn" : "crit"} />
                <MetricTableRow label="CSAT"             value={exec.chamados.csatTotal > 0 ? `${exec.chamados.csatMedia}/5` : "—"} status={exec.chamados.csatMedia >= 4 ? "ok" : exec.chamados.csatMedia >= 3 ? "warn" : "crit"} />
                <MetricTableRow label="Resolvidos/mês"   value={String(exec.chamados.resolvidosMes)}  status="ok" />
              </div>
              {/* Projetos + Ativos */}
              <div className="border-r border-[var(--border-subtle)]">
                <div className="px-4 py-2.5 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
                  Projetos & Ativos
                </div>
                <MetricTableRow label="Projetos ativos"    value={String(exec.projetos.ativos)}          status={exec.projetos.ativos > 8 ? "warn" : "ok"} href="/dashboard/projetos" />
                <MetricTableRow label="Concl. no mês"      value={String(exec.projetos.concluidosMes)}   status="ok" />
                <MetricTableRow label="Total ativos"       value={String(exec.ativos.total)}             status="ok" href="/dashboard/ativos" />
                <MetricTableRow label="Em manutenção"      value={String(exec.ativos.emManutencao)}      status={exec.ativos.emManutencao > 0 ? "warn" : "ok"} />
                <MetricTableRow label="Garantia vencida"   value={String(exec.ativos.garantiaVencida)}   status={exec.ativos.garantiaVencida > 0 ? "crit" : "ok"} href="/dashboard/ativos" />
                <MetricTableRow label="Garantia a vencer"  value={String(exec.ativos.garantiaRisco)}     status={exec.ativos.garantiaRisco > 0 ? "warn" : "ok"} />
              </div>
              {/* Contratos + Aprovações */}
              <div>
                <div className="px-4 py-2.5 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
                  Contratos & Aprovações
                </div>
                <MetricTableRow label="Contratos vigentes"  value={String(exec.contratos.vigentes)}              status="ok" href="/dashboard/contratos" />
                <MetricTableRow label="Contratos vencendo"  value={String(exec.contratos.vencendo)}              status={exec.contratos.vencendo > 0 ? "warn" : "ok"} href="/dashboard/contratos" />
                <MetricTableRow label="Contratos vencidos"  value={String(exec.contratos.vencidos)}              status={exec.contratos.vencidos > 0 ? "crit" : "ok"} />
                <MetricTableRow label="Aprov. pendentes"    value={String(aprov.aguardandoMinhaAprovacao)}       status={aprov.aguardandoMinhaAprovacao > 5 ? "warn" : aprov.aguardandoMinhaAprovacao > 0 ? "warn" : "ok"} href="/dashboard/aprovacoes" />
                <MetricTableRow label="Aprovadas"           value={String(aprov.aprovadas)}                      status="ok" />
                <MetricTableRow label="Rejeitadas"          value={String(aprov.rejeitadas)}                     status={aprov.rejeitadas > 0 ? "warn" : "ok"} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
