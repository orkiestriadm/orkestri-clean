"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Headphones, Layers, Package, FileText, Clock, BookOpen,
  AlertTriangle, TrendingUp, Users, Star, CheckCircle,
  XCircle, Timer, RefreshCw, BarChart3, ShieldCheck
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
  icon: Icon, label, value, sub, color = "blue", alert = false, className
}: {
  icon: any; label: string; value: string | number; sub?: string;
  color?: "blue" | "green" | "yellow" | "red" | "purple" | "cyan";
  alert?: boolean;
  className?: string;
}) {
  // Mapeia para os tokens do design system — antes eram cores Tailwind cruas,
  // que não acompanhavam o tema nem a paleta da marca.
  const tokens: Record<string, string> = {
    blue:   "var(--accent-cyan)",
    green:  "var(--accent-green)",
    yellow: "var(--accent-amber)",
    red:    "var(--accent-red)",
    purple: "#8b5cf6",
    cyan:   "var(--accent-cyan)",
  };

  const c = alert ? "var(--accent-amber)" : tokens[color];

  // Mesma marcação do InsightCard da IA Operacional: card-premium p-4, rótulo
  // micro em mono à esquerda, tile 7x7 do ícone à direita, métrica, subtexto.
  return (
    <div className={cn("card-premium p-4 flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest">{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in srgb, ${c} 9%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 16%, transparent)` }}>
          <Icon size={13} style={{ color: c }} />
        </div>
      </div>
      <div className="metric text-[26px] truncate" style={{ color: c }}>{value}</div>
      {sub && <div className="text-[10px] text-[var(--text-muted)] truncate">{sub}</div>}
    </div>
  );
}

// Título de seção no mesmo formato da IA Operacional: rótulo micro em mono,
// sem tile de ícone (só o cabeçalho da página tem tile).
function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-1">
      <Icon size={13} className="text-[var(--text-muted)]" />
      <div className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-widest">{title}</div>
    </div>
  );
}

function AlertBadge({ count, label, color }: { count: number; label: string; color: string }) {
  if (count === 0) return null;
  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[12px]", color)}>
      <AlertTriangle size={13} />
      <span className="metric text-[13px]">{count}</span>
      <span className="text-[var(--text-secondary)]">{label}</span>
    </div>
  );
}

const TABS = ["Visão Geral", "Service Desk", "Projetos", "Ativos", "Contratos", "RH & Produtividade"];

export default function ExecutivoPage() {
  const [stats, setStats] = useState<ExecStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(30);
  const [activeTab, setActiveTab] = useState("Visão Geral");

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

  // Mesmo formato de ações no Topbar da IA Operacional: horário do último
  // carregamento + botão discreto de atualizar, sobre tokens do design system.
  const topbarActions = (
    <>
      {lastUpdate && (
        <span className="text-[11px] text-[var(--text-muted)] font-mono">
          {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
      <button
        onClick={() => setAutoRefresh(a => !a)}
        title={autoRefresh ? "Desligar atualização automática" : "Ligar atualização automática"}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] transition-colors",
          autoRefresh
            ? "border-[var(--accent-violet)]/30 bg-[var(--accent-violet-dim)] text-[var(--accent-violet)]"
            : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
        )}
      >
        <span className={cn("w-1.5 h-1.5 rounded-full", autoRefresh ? "bg-[var(--accent-violet)] animate-pulse" : "bg-[var(--text-faint)]")} />
        {autoRefresh ? `Auto ${countdown}s` : "Auto off"}
      </button>
      <button
        onClick={() => { load(true); setCountdown(30); }}
        disabled={refreshing}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
      >
        <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
        Atualizar
      </button>
    </>
  );

  // Cabeçalho comum às telas de nível dashboard (Visão Geral, IA Operacional,
  // Relatórios): tile do ícone + título em display + subtítulo em mono.
  const header = (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--accent-violet-dim)] border border-[var(--accent-violet)]/25">
        <TrendingUp size={17} className="text-[var(--accent-violet)]" />
      </div>
      <div>
        <h1 className="font-display text-[22px] font-bold text-[var(--text-primary)] tracking-tight">Executivo</h1>
        <p className="text-[12px] text-[var(--text-muted)] font-mono">Indicadores consolidados de operação, contratos e produtividade</p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-[var(--bg-primary)]">
        <Topbar>{topbarActions}</Topbar>
        <div className="flex-1 overflow-y-auto page-content">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8 space-y-6 pb-20">
            {header}
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-2 border-[var(--accent-violet)] border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      <Topbar>{topbarActions}</Topbar>
      <div className="flex-1 overflow-y-auto page-content">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8 space-y-6 pb-20">
          {header}
          <div className="card-premium p-10 text-center">
            <AlertTriangle size={22} className="mx-auto mb-3 text-[var(--accent-amber)]" />
            <div className="text-[14px] font-semibold text-[var(--text-primary)]">Erro ao carregar dados</div>
            <p className="text-[12px] text-[var(--text-muted)] mt-1">Tente atualizar a página.</p>
          </div>
        </div>
      </div>
    </div>
  );

  const { chamados, projetos, ativos, contratos, horas, conhecimento } = stats;
  const hasAlerts = chamados.urgentes > 0 || chamados.slaViolados > 0
    || contratos.vencendo > 0 || contratos.vencidos > 0
    || ativos.garantiaRisco > 0 || ativos.garantiaVencida > 0;

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      <Topbar>{topbarActions}</Topbar>

      <div className="flex-1 overflow-y-auto page-content">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8 space-y-6 pb-20 animate-fade-in">

        {header}

        {/* Abas no corpo da página, como em Relatórios — antes viviam dentro do
            Topbar, o que deslocava o cabeçalho e não existia em nenhuma outra tela. */}
        <div className="tab-bar overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className="tab-btn whitespace-nowrap" data-active={activeTab === t}>
              {t}
            </button>
          ))}
        </div>

        {/* Alerts globais - always visible when there are alerts to draw executive attention */}
        {/* Painel de atenção. Era um gradiente amarelo com blur decorativo —
            nenhuma outra tela do dashboard faz isso; agora é card-premium com o
            mesmo título micro em mono das seções da IA Operacional. */}
        {hasAlerts && (
          <div className="card-premium p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={13} className="text-[var(--accent-amber)]" />
              <div className="text-[11px] font-mono text-[var(--accent-amber)] uppercase tracking-widest">Atenção necessária</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <AlertBadge count={chamados.urgentes}      label="chamados urgentes"  color="border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 text-[var(--accent-red)]" />
              <AlertBadge count={chamados.slaViolados}   label="SLAs violados"      color="border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 text-[var(--accent-red)]" />
              <AlertBadge count={contratos.vencendo}     label="contratos vencendo" color="border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/10 text-[var(--accent-amber)]" />
              <AlertBadge count={contratos.vencidos}     label="contratos vencidos" color="border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 text-[var(--accent-red)]" />
              <AlertBadge count={ativos.garantiaRisco}   label="garantias a vencer" color="border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/10 text-[var(--accent-amber)]" />
              <AlertBadge count={ativos.garantiaVencida} label="garantias vencidas" color="border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 text-[var(--accent-red)]" />
            </div>
          </div>
        )}

        {/* --- ABA VISÃO GERAL --- */}
        {activeTab === "Visão Geral" && (
          <div className="space-y-6 animate-in slide-in-from-left-4 fade-in duration-300">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={Headphones}   label="Service Desk: Em andamento" value={fmt(chamados.emAtendimento)} sub={`${fmt(chamados.abertos)} abertos total`} color="blue" />
              <KpiCard icon={TrendingUp}   label="SLA Compliance"             value={`${chamados.slaCompliancePct}%`} sub={chamados.slaCompliancePct >= 90 ? "Dentro da meta" : "Abaixo da meta"} color={chamados.slaCompliancePct >= 90 ? "green" : chamados.slaCompliancePct >= 70 ? "yellow" : "red"} />
              <KpiCard icon={Layers}       label="Projetos em Andamento"      value={fmt(projetos.ativos)} sub={`${fmt(projetos.concluidosMes)} concluídos no mês`} color="purple" />
              <KpiCard icon={FileText}     label="Valor em Contratos"         value={fmtBrl(contratos.valorTotal)} sub={`${fmt(contratos.vigentes)} contratos vigentes`} color="cyan" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card-premium p-5 flex flex-col gap-4">
                 <div className="flex items-center gap-3">
                   <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--accent-amber) 9%, transparent)", border: "1px solid color-mix(in srgb, var(--accent-amber) 16%, transparent)", color: "var(--accent-amber)" }}>
                     <Star size={20} fill="currentColor" />
                   </div>
                   <div>
                     <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest">Satisfação do Cliente (CSAT)</div>
                     <div className="flex items-baseline gap-2 mt-1">
                       <span className="metric text-[26px] text-[var(--text-primary)]">{chamados.csatMedia}</span>
                       <span className="text-sm font-bold text-muted-foreground/60">/ 5.0</span>
                       <span className="text-xs font-semibold text-muted-foreground ml-2 px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                         {fmt(chamados.csatTotal)} avaliações
                       </span>
                     </div>
                   </div>
                 </div>
              </div>
              <div className="card-premium p-5 flex flex-col gap-4">
                 <div className="flex items-center gap-3">
                   <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--accent-cyan) 9%, transparent)", border: "1px solid color-mix(in srgb, var(--accent-cyan) 16%, transparent)", color: "var(--accent-cyan)" }}>
                     <Clock size={20} strokeWidth={2.5} />
                   </div>
                   <div>
                     <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest">Horas Apontadas (Mês)</div>
                     <div className="flex items-baseline gap-2 mt-1">
                       <span className="metric text-[26px] text-[var(--text-primary)]">{fmtHoras(horas.totalMinutos)}</span>
                       <span className="text-xs font-semibold text-muted-foreground ml-2 px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                         {fmt(horas.totalRegistros)} registros
                       </span>
                     </div>
                   </div>
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* --- ABA SERVICE DESK --- */}
        {activeTab === "Service Desk" && (
          <div className="space-y-6 animate-in slide-in-from-left-4 fade-in duration-300">
            <SectionHeader icon={Headphones} title="Desempenho de Chamados" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard icon={Headphones}   label="Abertos"         value={fmt(chamados.abertos)}         sub="em atendimento ou aguardando" color="blue" />
              <KpiCard icon={AlertTriangle} label="Urgentes"       value={fmt(chamados.urgentes)}        sub="prioridade urgente"           color="red"    alert={chamados.urgentes > 0} />
              <KpiCard icon={CheckCircle}  label="Resolvidos/mês"  value={fmt(chamados.resolvidosMes)}   sub="mês atual"                   color="green" />
              <KpiCard icon={XCircle}      label="SLA Violados"    value={fmt(chamados.slaViolados)}     sub="fora do prazo"               color="red"    alert={chamados.slaViolados > 0} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card-premium p-5 flex flex-col justify-center">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest">SLA Compliance Global</span>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "color-mix(in srgb, var(--accent-green) 9%, transparent)", border: "1px solid color-mix(in srgb, var(--accent-green) 16%, transparent)", color: "var(--accent-green)" }}>
                    <ShieldCheck size={13} />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="flex items-end gap-3">
                    <div className="metric text-[26px] text-[var(--text-primary)]">{chamados.slaCompliancePct}%</div>
                    <div className="text-[10px] text-[var(--text-muted)] pb-1">resolvidos no prazo</div>
                  </div>
                  {/* Barra em cor sólida de token — o gradiente de duas paradas
                      não existia em nenhuma outra tela. */}
                  <div className="mt-4 h-1.5 rounded-full bg-[var(--bg-hover)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${chamados.slaCompliancePct}%`,
                        background: chamados.slaCompliancePct >= 90 ? "var(--accent-green)"
                          : chamados.slaCompliancePct >= 70 ? "var(--accent-amber)" : "var(--accent-red)",
                      }}
                    />
                  </div>
                </div>
              </div>

              {chamados.csatTotal > 0 && (
                <div className="relative overflow-hidden rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-black/40 backdrop-blur-xl p-5 flex flex-col justify-center shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="relative z-10 flex items-center justify-between">
                    <span className="text-[12px] text-muted-foreground font-bold tracking-wider uppercase">CSAT Médio</span>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--accent-amber) 9%, transparent)", border: "1px solid color-mix(in srgb, var(--accent-amber) 16%, transparent)", color: "var(--accent-amber)" }}>
                      <Star size={18} fill="currentColor" />
                    </div>
                  </div>
                  <div className="relative z-10 mt-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black tracking-tight text-foreground">{chamados.csatMedia}</span>
                      <span className="text-lg font-bold text-muted-foreground/60">/ 5</span>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-muted-foreground inline-flex px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 backdrop-blur-sm">
                      Baseado em {fmt(chamados.csatTotal)} avaliações
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- ABA PROJETOS --- */}
        {activeTab === "Projetos" && (
          <div className="space-y-6 animate-in slide-in-from-left-4 fade-in duration-300">
            <SectionHeader icon={Layers} title="Indicadores de Projetos" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard icon={Layers}       label="Projetos Ativos" value={fmt(projetos.ativos)}       sub="planejamento ou andamento" color="purple" />
              <KpiCard icon={CheckCircle}  label="Concl. no mês"   value={fmt(projetos.concluidosMes)} sub="mês atual" color="green" />
            </div>
          </div>
        )}

        {/* --- ABA ATIVOS --- */}
        {activeTab === "Ativos" && (
          <div className="space-y-6 animate-in slide-in-from-left-4 fade-in duration-300">
            <SectionHeader icon={Package} title="Gestão de Ativos" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard icon={Package}      label="Total de Ativos" value={fmt(ativos.total)}           sub="cadastrados no sistema" color="cyan" />
              <KpiCard icon={Timer}        label="Em Manutenção"   value={fmt(ativos.emManutencao)}     sub="reparo ou revisão" color="yellow" />
              <KpiCard icon={AlertTriangle} label="Garantia a vencer" value={fmt(ativos.garantiaRisco)} sub="vence em 30 dias" color="yellow" alert={ativos.garantiaRisco > 0} />
              <KpiCard icon={XCircle}      label="Garantia vencida" value={fmt(ativos.garantiaVencida)} sub="requer atenção" color="red"    alert={ativos.garantiaVencida > 0} />
            </div>
          </div>
        )}

        {/* --- ABA CONTRATOS --- */}
        {activeTab === "Contratos" && (
          <div className="space-y-6 animate-in slide-in-from-left-4 fade-in duration-300">
            <SectionHeader icon={FileText} title="Gestão de Contratos" />
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <KpiCard icon={FileText}     label="Total"          value={fmt(contratos.total)}           color="blue" />
              <KpiCard icon={CheckCircle}  label="Vigentes"       value={fmt(contratos.vigentes)}        color="green" />
              <KpiCard icon={Timer}        label="Vencendo"       value={fmt(contratos.vencendo)}        sub="em até 30 dias" color="yellow" alert={contratos.vencendo > 0} />
              <KpiCard icon={XCircle}      label="Vencidos"       value={fmt(contratos.vencidos)}        sub="fora da vigência" color="red"    alert={contratos.vencidos > 0} />
              <KpiCard icon={TrendingUp}   label="Valor Total"    value={fmtBrl(contratos.valorTotal)}   sub="dos contratos vigentes" color="purple" />
            </div>
          </div>
        )}

        {/* --- ABA RH & PRODUTIVIDADE --- */}
        {activeTab === "RH & Produtividade" && (
          <div className="space-y-8 animate-in slide-in-from-left-4 fade-in duration-300">
            <div>
              <SectionHeader icon={Clock} title="Apontamento de Horas" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard icon={Clock}  label="Total horas (mês)" value={fmtHoras(horas.totalMinutos)} color="blue" />
                <KpiCard icon={Users}  label="Apontamentos"      value={fmt(horas.totalRegistros)} sub="registros de ponto/atividades" color="blue" />
              </div>
            </div>
            <div>
              <SectionHeader icon={BookOpen} title="Base de Conhecimento" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard icon={BookOpen}  label="Artigos"        value={fmt(conhecimento.artigos)}       sub="publicados no sistema" color="green" />
                <KpiCard icon={TrendingUp} label="Visualizações"  value={fmt(conhecimento.visualizacoes)} sub="engajamento com os artigos" color="green" />
              </div>
            </div>
          </div>
        )}

        </div>
      </div>
    </div>
  );
}
