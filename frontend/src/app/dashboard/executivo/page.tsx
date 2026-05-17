"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Headphones, Layers, Package, FileText, Clock, BookOpen,
  AlertTriangle, TrendingUp, Users, Star, CheckCircle,
  XCircle, Timer, RefreshCw,
} from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import { cn } from "@/lib/utils";

interface ExecStats {
  chamados: {
    abertos: number; urgentes: number; hoje: number; emAtendimento: number;
    resolvidosMes: number; slaViolados: number; slaCompliancePct: number;
    csatMedia: number; csatTotal: number;
  };
  projetos: { ativos: number; concluidosMes: number };
  ativos: { total: number; emManutencao: number; garantiaRisco: number; garantiaVencida: number };
  contratos: { total: number; vigentes: number; vencendo: number; vencidos: number; valorTotal: number };
  horas: { totalMinutos: number; totalRegistros: number };
  conhecimento: { artigos: number; visualizacoes: number };
}

function fmt(n: number) { return n.toLocaleString("pt-BR"); }
function fmtBrl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function fmtHoras(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${m > 0 ? ` ${m}m` : ""}`;
}

function KpiCard({
  icon: Icon, label, value, sub, color = "blue", alert = false,
}: {
  icon: any; label: string; value: string | number; sub?: string;
  color?: "blue" | "green" | "yellow" | "red" | "purple" | "cyan";
  alert?: boolean;
}) {
  const colors = {
    blue:   "bg-blue-500/10 text-blue-400 border-blue-500/20",
    green:  "bg-green-500/10 text-green-400 border-green-500/20",
    yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    red:    "bg-red-500/10 text-red-400 border-red-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    cyan:   "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  };
  return (
    <div className={cn(
      "rounded-xl border p-4 flex flex-col gap-3 transition-all",
      alert ? "border-yellow-500/40 bg-yellow-500/5" : "border-border bg-card"
    )}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground font-mono tracking-[0.08em] uppercase">{label}</span>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border", colors[color])}>
          <Icon size={14} />
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, color }: { icon: any; title: string; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className={cn("w-6 h-6 rounded flex items-center justify-center", color)}>
        <Icon size={13} />
      </div>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </div>
  );
}

function AlertBadge({ count, label, color }: { count: number; label: string; color: string }) {
  if (count === 0) return null;
  return (
    <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border text-xs", color)}>
      <AlertTriangle size={13} />
      <span className="font-medium">{count}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

export default function ExecutivoPage() {
  const [stats, setStats] = useState<ExecStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(30);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const { data } = await api.get<ExecStats>("/stats/executivo");
      setStats(data);
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    setCountdown(30);
    const interval = setInterval(() => load(true), 30000);
    const tick = setInterval(() => setCountdown(c => (c <= 1 ? 30 : c - 1)), 1000);
    return () => { clearInterval(interval); clearInterval(tick); };
  }, [autoRefresh]);

  const topbarActions = (
    <>
      {lastUpdate && (
        <span className="text-[11px] text-muted-foreground font-mono">
          {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
      <button
        onClick={() => setAutoRefresh(a => !a)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors",
          autoRefresh
            ? "bg-primary/10 border-primary/30 text-primary"
            : "border-border text-muted-foreground hover:bg-accent"
        )}
      >
        <div className={cn("w-1.5 h-1.5 rounded-full", autoRefresh ? "bg-primary animate-pulse" : "bg-muted-foreground")} />
        {autoRefresh ? `Auto ${countdown}s` : "Auto off"}
      </button>
      <button
        onClick={() => { load(true); setCountdown(30); }}
        disabled={refreshing}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
      >
        <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
        Atualizar
      </button>
    </>
  );

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <Topbar>{topbarActions}</Topbar>
        <div className="flex items-center justify-center flex-1">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!stats) return (
    <div className="flex flex-col h-full bg-background">
      <Topbar>{topbarActions}</Topbar>
      <div className="p-6 text-muted-foreground">Erro ao carregar dados.</div>
    </div>
  );

  const { chamados, projetos, ativos, contratos, horas, conhecimento } = stats;
  const hasAlerts = chamados.urgentes > 0 || chamados.slaViolados > 0
    || contratos.vencendo > 0 || contratos.vencidos > 0
    || ativos.garantiaRisco > 0 || ativos.garantiaVencida > 0;

  return (
    <div className="flex flex-col h-full bg-background">
      <Topbar>{topbarActions}</Topbar>
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1400px] mx-auto w-full">

      {/* Alerts */}
      {hasAlerts && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-yellow-400" />
            <span className="text-sm font-semibold text-yellow-400">Atenção necessária</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <AlertBadge count={chamados.urgentes}     label="chamados urgentes"      color="border-red-500/30 bg-red-500/10 text-red-400" />
            <AlertBadge count={chamados.slaViolados}  label="SLAs violados"          color="border-red-500/30 bg-red-500/10 text-red-400" />
            <AlertBadge count={contratos.vencendo}    label="contratos vencendo"     color="border-yellow-500/30 bg-yellow-500/10 text-yellow-400" />
            <AlertBadge count={contratos.vencidos}    label="contratos vencidos"     color="border-red-500/30 bg-red-500/10 text-red-400" />
            <AlertBadge count={ativos.garantiaRisco}  label="garantias a vencer"     color="border-yellow-500/30 bg-yellow-500/10 text-yellow-400" />
            <AlertBadge count={ativos.garantiaVencida} label="garantias vencidas"    color="border-red-500/30 bg-red-500/10 text-red-400" />
          </div>
        </div>
      )}

      {/* Chamados */}
      <div>
        <SectionHeader icon={Headphones} title="Chamados" color="bg-blue-500/10 text-blue-400" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard icon={Headphones}   label="Abertos"         value={fmt(chamados.abertos)}         sub="em atendimento ou aguardando" color="blue" />
          <KpiCard icon={AlertTriangle} label="Urgentes"       value={fmt(chamados.urgentes)}        sub="prioridade urgente"           color="red"    alert={chamados.urgentes > 0} />
          <KpiCard icon={CheckCircle}  label="Resolvidos/mês"  value={fmt(chamados.resolvidosMes)}   sub="mês atual"                   color="green" />
          <KpiCard icon={XCircle}      label="SLA Violados"    value={fmt(chamados.slaViolados)}     sub="fora do prazo"               color="red"    alert={chamados.slaViolados > 0} />
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground font-mono tracking-[0.08em] uppercase">SLA Compliance</span>
              <div className="w-8 h-8 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 flex items-center justify-center">
                <TrendingUp size={14} />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{chamados.slaCompliancePct}%</div>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", chamados.slaCompliancePct >= 90 ? "bg-green-500" : chamados.slaCompliancePct >= 70 ? "bg-yellow-500" : "bg-red-500")}
                  style={{ width: `${chamados.slaCompliancePct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* CSAT inline */}
        {chamados.csatTotal > 0 && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3 col-span-2 sm:col-span-2">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <Star size={16} />
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground font-mono tracking-[0.08em] uppercase">CSAT Médio</div>
                <div className="flex items-end gap-2 mt-0.5">
                  <span className="text-2xl font-bold text-foreground">{chamados.csatMedia}</span>
                  <span className="text-sm text-muted-foreground mb-0.5">/ 5</span>
                  <span className="text-xs text-muted-foreground mb-0.5">({fmt(chamados.csatTotal)} aval.)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Projetos */}
        <div>
          <SectionHeader icon={Layers} title="Projetos" color="bg-purple-500/10 text-purple-400" />
          <div className="grid grid-cols-2 gap-3">
            <KpiCard icon={Layers}       label="Ativos"         value={fmt(projetos.ativos)}       color="purple" />
            <KpiCard icon={CheckCircle}  label="Concl./mês"     value={fmt(projetos.concluidosMes)} color="green" />
          </div>
        </div>

        {/* Ativos */}
        <div>
          <SectionHeader icon={Package} title="Ativos" color="bg-cyan-500/10 text-cyan-400" />
          <div className="grid grid-cols-2 gap-3">
            <KpiCard icon={Package}      label="Total Ativos"   value={fmt(ativos.total)}           color="cyan" />
            <KpiCard icon={Timer}        label="Manutenção"     value={fmt(ativos.emManutencao)}     color="yellow" />
            <KpiCard icon={AlertTriangle} label="Gar. a vencer" value={fmt(ativos.garantiaRisco)}   color="yellow" alert={ativos.garantiaRisco > 0} />
            <KpiCard icon={XCircle}      label="Gar. vencida"   value={fmt(ativos.garantiaVencida)} color="red"    alert={ativos.garantiaVencida > 0} />
          </div>
        </div>

        {/* Horas + Conhecimento */}
        <div className="space-y-6">
          <div>
            <SectionHeader icon={Clock} title="Horas (mês)" color="bg-blue-500/10 text-blue-400" />
            <div className="grid grid-cols-2 gap-3">
              <KpiCard icon={Clock}  label="Total horas"   value={fmtHoras(horas.totalMinutos)}      color="blue" />
              <KpiCard icon={Users}  label="Apontamentos"  value={fmt(horas.totalRegistros)}          color="blue" />
            </div>
          </div>
          <div>
            <SectionHeader icon={BookOpen} title="Conhecimento" color="bg-green-500/10 text-green-400" />
            <div className="grid grid-cols-2 gap-3">
              <KpiCard icon={BookOpen}  label="Artigos"        value={fmt(conhecimento.artigos)}       color="green" />
              <KpiCard icon={TrendingUp} label="Visualizações"  value={fmt(conhecimento.visualizacoes)} color="green" />
            </div>
          </div>
        </div>
      </div>

      {/* Contratos */}
      <div>
        <SectionHeader icon={FileText} title="Contratos" color="bg-blue-500/10 text-blue-400" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard icon={FileText}     label="Total"          value={fmt(contratos.total)}           color="blue" />
          <KpiCard icon={CheckCircle}  label="Vigentes"       value={fmt(contratos.vigentes)}        color="green" />
          <KpiCard icon={Timer}        label="Vencendo"       value={fmt(contratos.vencendo)}        color="yellow" alert={contratos.vencendo > 0} />
          <KpiCard icon={XCircle}      label="Vencidos"       value={fmt(contratos.vencidos)}        color="red"    alert={contratos.vencidos > 0} />
          <KpiCard icon={TrendingUp}   label="Valor Total"    value={fmtBrl(contratos.valorTotal)}   color="purple" />
        </div>
      </div>
      </div>
    </div>
  );
}
