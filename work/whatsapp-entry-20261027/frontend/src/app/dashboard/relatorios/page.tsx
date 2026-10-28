"use client";
import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Headphones, BarChart2, Clock, Star, TrendingUp, TrendingDown,
  CheckCircle, XCircle, AlertTriangle, RefreshCw, Layers, Users,
  Printer, BarChart3, GitCompare,
} from "lucide-react";
import Topbar from "@/components/layout/Topbar";

// ── SVG chart primitives ──────────────────────────────────────────────────────

function useSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(e => setW(e[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

interface LineSeries { key: string; label: string; color: string; }

function MultiLineChart({
  data, series, height = 160, nullLabel = "—",
}: {
  data: any[]; series: LineSeries[]; height?: number; nullLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const w = useSize(ref);
  const padL = 32; const padR = 8; const padT = 10; const padB = 28;
  const innerW = Math.max(w - padL - padR, 1);
  const innerH = height - padT - padB;

  const allVals = data.flatMap(d => series.map(s => d[s.key]).filter((v): v is number => v !== null && v !== undefined));
  const maxV = allVals.length ? Math.max(...allVals) : 1;
  const minV = 0;
  const range = maxV - minV || 1;

  function xOf(i: number) { return padL + (i / Math.max(data.length - 1, 1)) * innerW; }
  function yOf(v: number) { return padT + (1 - (v - minV) / range) * innerH; }

  if (!w || !data.length) return <div ref={ref} style={{ height }} />;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg width={w} height={height} style={{ overflow: "visible" }}>
        {/* grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const y = padT + t * innerH;
          const val = Math.round(maxV * (1 - t));
          return (
            <g key={t}>
              <line x1={padL} x2={padL + innerW} y1={y} y2={y} stroke="var(--border)" strokeDasharray="3 3" opacity={0.4} />
              <text x={padL - 4} y={y + 4} textAnchor="end" fontSize={9} fill="var(--muted-foreground)" fontFamily="var(--font-mono)">{val}</text>
            </g>
          );
        })}

        {/* areas + lines */}
        {series.map(s => {
          const points = data.map((d, i) => {
            const v = d[s.key];
            return v !== null && v !== undefined ? [xOf(i), yOf(v)] : null;
          });
          const validPoints = points.filter((p): p is [number, number] => p !== null);
          if (!validPoints.length) return null;

          const pathD = validPoints.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
          const areaD = `${pathD} L ${validPoints[validPoints.length-1][0]} ${padT + innerH} L ${validPoints[0][0]} ${padT + innerH} Z`;

          return (
            <g key={s.key}>
              <path d={areaD} fill={s.color} opacity={0.08} />
              <path d={pathD} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {validPoints.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={3} fill={s.color} stroke="var(--background)" strokeWidth={1.5} />
              ))}
            </g>
          );
        })}

        {/* x labels */}
        {data.map((d, i) => {
          if (data.length > 12 && i % 2 !== 0) return null;
          return (
            <text key={i} x={xOf(i)} y={height - 4} textAnchor="middle" fontSize={9} fill="var(--muted-foreground)" fontFamily="var(--font-mono)">
              {d.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function BarChartSvg({
  data, labelKey, valueKey, color = "#6366f1", height = 140,
}: {
  data: any[]; labelKey: string; valueKey: string; color?: string; height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const w = useSize(ref);
  const padL = 28; const padR = 8; const padT = 10; const padB = 28;
  const innerW = Math.max(w - padL - padR, 1);
  const innerH = height - padT - padB;

  const maxV = Math.max(...data.map(d => Number(d[valueKey])), 1);
  const barW = Math.max(4, (innerW / data.length) * 0.6);

  if (!w || !data.length) return <div ref={ref} style={{ height }} />;

  return (
    <div ref={ref}>
      <svg width={w} height={height}>
        {[0, 0.5, 1].map(t => {
          const y = padT + t * innerH;
          return <line key={t} x1={padL} x2={padL + innerW} y1={y} y2={y} stroke="var(--border)" strokeDasharray="3 3" opacity={0.4} />;
        })}
        {data.map((d, i) => {
          const v = Number(d[valueKey]);
          const barH = Math.max(2, (v / maxV) * innerH);
          const x = padL + (i / data.length) * innerW + (innerW / data.length - barW) / 2;
          const y = padT + innerH - barH;
          const label = String(d[labelKey]);
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} rx={3} fill={color} opacity={0.85} />
              <text x={x + barW / 2} y={padT + innerH + 14} textAnchor="middle" fontSize={9} fill="var(--muted-foreground)" fontFamily="var(--font-mono)">
                {label.length > 6 ? label.slice(0, 6) : label}
              </text>
              {v > 0 && <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={9} fill="var(--muted-foreground)" fontFamily="var(--font-mono)">{v}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DonutChart({ data, total }: { data: { label: string; value: number; color: string }[]; total: number }) {
  if (!total) return <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">Sem dados</div>;
  let offset = 0;
  const r = 40; const circ = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4">
      <svg width="100" height="100" viewBox="0 0 100 100" className="flex-shrink-0">
        <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="14" />
        {data.filter(d => d.value > 0).map((d, i) => {
          const pct = d.value / total;
          const dash = pct * circ;
          const el = (
            <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={d.color} strokeWidth="14"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-(offset * circ)}
              style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }} />
          );
          offset += pct;
          return el;
        })}
        <text x="50" y="54" textAnchor="middle" style={{ fontSize: 13, fontWeight: 700, fill: "hsl(var(--foreground))", fontFamily: "monospace" }}>{total}</text>
      </svg>
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
            <span className="text-xs text-muted-foreground truncate flex-1">{d.label}</span>
            <span className="text-xs font-mono text-muted-foreground">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Primitives ────────────────────────────────────────────────────────────────

function Legend({ series }: { series: LineSeries[] }) {
  return (
    <div className="flex flex-wrap gap-3 mb-3">
      {series.map(s => (
        <div key={s.key} className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 rounded-full" style={{ background: s.color }} />
          <span className="text-xs text-muted-foreground">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function KpiMini({ label, value, delta, color = "text-foreground" }: { label: string; value: string | number; delta?: string; color?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{label}</span>
      <span className={cn("text-2xl font-bold", color)}>{value}</span>
      {delta && <span className="text-xs text-muted-foreground">{delta}</span>}
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "chamados",    label: "Chamados",    icon: Headphones },
  { id: "sla",         label: "SLA & CSAT",  icon: Star },
  { id: "horas",       label: "Horas",       icon: Clock },
  { id: "projetos",    label: "Projetos",    icon: Layers },
  { id: "atendentes",  label: "Atendentes",  icon: Users },
  { id: "categorias",  label: "Categorias",  icon: BarChart3 },
  { id: "comparativo", label: "Comparativo", icon: GitCompare },
];

const SEMANAS_OPTIONS = ["4", "8", "12"];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RelatoriosPage() {
  const [tab, setTab]             = useState("chamados");
  const [semanas, setSemanas]     = useState("8");
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [chamadosTrend, setChamadosTrend]   = useState<any[]>([]);
  const [slaTrend, setSlaTrend]             = useState<any[]>([]);
  const [csatTrend, setCsatTrend]           = useState<any[]>([]);
  const [horasTrend, setHorasTrend]         = useState<any[]>([]);
  const [categoria, setCategoria]           = useState<any>(null);
  const [visaoGeral, setVisaoGeral]         = useState<any>(null);
  const [produtividade, setProdutividade]   = useState<any>(null);
  const [slaAtendentes, setSlaAtendentes]   = useState<any[]>([]);
  const [categoriasBrk, setCategoriasBrk]  = useState<any[]>([]);
  const [comparativo, setComparativo]       = useState<any>(null);
  const [p1Start, setP1Start]               = useState(() => { const d = new Date(); d.setDate(d.getDate()-30); return d.toISOString().slice(0,10); });
  const [p1End, setP1End]                   = useState(() => new Date().toISOString().slice(0,10));
  const [p2Start, setP2Start]               = useState(() => { const d = new Date(); d.setDate(d.getDate()-60); return d.toISOString().slice(0,10); });
  const [p2End, setP2End]                   = useState(() => { const d = new Date(); d.setDate(d.getDate()-30); return d.toISOString().slice(0,10); });

  async function load(silent = false) {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      const [r1, r2, r3, r4, r5, r6, r7, r8, r9] = await Promise.all([
        api.get(`/relatorios/chamados-trend?semanas=${semanas}`),
        api.get(`/relatorios/sla-trend?semanas=${semanas}`),
        api.get(`/relatorios/csat-trend?semanas=${semanas}`),
        api.get(`/relatorios/horas-trend?semanas=${semanas}`),
        api.get("/relatorios/chamados-categoria"),
        api.get("/relatorios/visao-geral"),
        api.get("/relatorios/produtividade"),
        api.get("/sla/atendentes"),
        api.get(`/relatorios/chamados-categorias?semanas=${semanas}`),
      ]);
      setChamadosTrend(r1.data);
      setSlaTrend(r2.data);
      setCsatTrend(r3.data);
      setHorasTrend(r4.data);
      setCategoria(r5.data);
      setVisaoGeral(r6.data);
      setProdutividade(r7.data);
      setSlaAtendentes(r8.data);
      setCategoriasBrk(Array.isArray(r9.data) ? r9.data : []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, [semanas]);

  // Derived KPIs from last week vs previous week
  function delta(arr: any[], key: string) {
    if (arr.length < 2) return null;
    const last = arr[arr.length - 1][key];
    const prev = arr[arr.length - 2][key];
    if (last === null || prev === null) return null;
    const diff = last - prev;
    return diff > 0 ? `+${diff}` : `${diff}`;
  }

  const totalAbertosTrend = chamadosTrend.reduce((s, d) => s + (d.abertos || 0), 0);
  const totalFechadosTrend = chamadosTrend.reduce((s, d) => s + (d.fechados || 0), 0);
  const totalHorasTrend = horasTrend.reduce((s, d) => s + (d.horas || 0), 0);
  const avgCsat = (() => {
    const valid = csatTrend.filter(d => d.csat !== null);
    return valid.length ? Math.round(valid.reduce((s, d) => s + d.csat, 0) / valid.length) : null;
  })();
  const lastSla = slaTrend.length ? slaTrend[slaTrend.length - 1].compliance : null;

  const topbarActions = (
    <>
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 border border-border">
        {SEMANAS_OPTIONS.map(s => (
          <button
            key={s}
            onClick={() => setSemanas(s)}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-all",
              semanas === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {s}sem
          </button>
        ))}
      </div>
      <button
        onClick={() => load(true)}
        disabled={refreshing}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
      >
        <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
        Atualizar
      </button>
      <button
        onClick={() => window.print()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent transition-colors"
      >
        <Printer size={12} />
        Imprimir PDF
      </button>
    </>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <Topbar>{topbarActions}</Topbar>
      <div className="flex-1 overflow-y-auto p-6 space-y-5 max-w-[1400px] mx-auto w-full">

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── CHAMADOS ── */}
          {tab === "chamados" && (
            <div className="space-y-4">
              {/* KPI row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-border bg-card p-4">
                  <KpiMini label="Abertos (período)" value={totalAbertosTrend} delta={`última semana: ${chamadosTrend[chamadosTrend.length-1]?.abertos ?? "—"}`} />
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <KpiMini label="Fechados (período)" value={totalFechadosTrend} color="text-green-400" delta={`última semana: ${chamadosTrend[chamadosTrend.length-1]?.fechados ?? "—"}`} />
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <KpiMini label="SLA Atual" value={lastSla !== null ? `${lastSla}%` : "—"} color={lastSla !== null ? (lastSla >= 90 ? "text-green-400" : lastSla >= 70 ? "text-yellow-400" : "text-red-400") : "text-muted-foreground"} delta="semana mais recente" />
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <KpiMini label="CSAT Médio" value={avgCsat !== null ? `${avgCsat}%` : "—"} color="text-yellow-400" delta="média do período" />
                </div>
              </div>

              {/* Trend: abertos vs fechados */}
              <Card title="Chamados abertos vs fechados" sub={`Últimas ${semanas} semanas`}>
                <Legend series={[
                  { key: "abertos", label: "Abertos", color: "#6366f1" },
                  { key: "fechados", label: "Fechados", color: "#22c55e" },
                  { key: "urgentes", label: "Urgentes", color: "#ef4444" },
                ]} />
                <MultiLineChart
                  data={chamadosTrend}
                  series={[
                    { key: "abertos", label: "Abertos", color: "#6366f1" },
                    { key: "fechados", label: "Fechados", color: "#22c55e" },
                    { key: "urgentes", label: "Urgentes", color: "#ef4444" },
                  ]}
                  height={180}
                />
              </Card>

              {/* Categoria */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card title="Por categoria" sub="Mês atual">
                  {(categoria?.porCategoria || []).length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-8">Sem dados</div>
                  ) : (
                    <div className="space-y-2">
                      {(categoria?.porCategoria || []).slice(0, 8).map((c: any, i: number) => {
                        const max = categoria.porCategoria[0]?.total || 1;
                        const colors = ["#6366f1","#22c55e","#f59e0b","#ef4444","#06b6d4","#f472b6","#84cc16","#a78bfa"];
                        return (
                          <div key={i}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted-foreground">{c.categoria}</span>
                              <span className="font-mono text-muted-foreground">{c.total}</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${(c.total / max) * 100}%`, background: colors[i % colors.length] }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>

                <Card title="Por atendente" sub="Mês atual">
                  {(categoria?.porAtendente || []).length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-8">Sem dados</div>
                  ) : (
                    <div className="space-y-2">
                      {(categoria?.porAtendente || []).slice(0, 8).map((a: any, i: number) => {
                        const max = categoria.porAtendente[0]?.total || 1;
                        return (
                          <div key={i}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted-foreground">{a.nome}</span>
                              <span className="font-mono text-muted-foreground">{a.total}</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary/70 rounded-full" style={{ width: `${(a.total / max) * 100}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}

          {/* ── SLA & CSAT ── */}
          {tab === "sla" && (
            <div className="space-y-4">
              <Card title="SLA Compliance (%)" sub={`Últimas ${semanas} semanas — meta: 90%`}>
                <MultiLineChart
                  data={slaTrend.map(d => ({ ...d, meta: 90 }))}
                  series={[
                    { key: "compliance", label: "SLA %", color: "#22c55e" },
                    { key: "meta",       label: "Meta 90%", color: "#6366f1" },
                  ]}
                  height={180}
                />
                <Legend series={[
                  { key: "compliance", label: "SLA Compliance", color: "#22c55e" },
                  { key: "meta", label: "Meta 90%", color: "#6366f1" },
                ]} />
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card title="SLA violados por semana" sub="Chamados fora do prazo">
                  <BarChartSvg data={slaTrend} labelKey="label" valueKey="violados" color="#ef4444" />
                </Card>

                <Card title="CSAT Score (%)" sub={`% de avaliações ≥ 4 estrelas · últimas ${semanas} semanas`}>
                  <MultiLineChart
                    data={csatTrend}
                    series={[{ key: "csat", label: "CSAT %", color: "#f59e0b" }]}
                    height={160}
                  />
                </Card>
              </div>

              <Card title="Média de avaliação por semana" sub="Escala 1–5">
                <MultiLineChart
                  data={csatTrend}
                  series={[{ key: "media", label: "Média", color: "#f59e0b" }]}
                  height={160}
                />
              </Card>
            </div>
          )}

          {/* ── HORAS ── */}
          {tab === "horas" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-border bg-card p-4">
                  <KpiMini label="Total horas (período)" value={`${totalHorasTrend.toFixed(1)}h`} color="text-blue-400" />
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <KpiMini label="Registros (período)" value={horasTrend.reduce((s, d) => s + (d.registros || 0), 0)} delta="apontamentos totais" />
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <KpiMini label="Média semanal" value={horasTrend.length ? `${(totalHorasTrend / horasTrend.length).toFixed(1)}h` : "—"} color="text-cyan-400" delta="por semana" />
                </div>
              </div>

              <Card title="Horas apontadas por semana" sub={`Últimas ${semanas} semanas`}>
                <BarChartSvg data={horasTrend} labelKey="label" valueKey="horas" color="#6366f1" height={180} />
              </Card>

              <Card title="Tendência de apontamentos" sub="Horas e número de registros">
                <Legend series={[
                  { key: "horas",     label: "Horas", color: "#6366f1" },
                  { key: "registros", label: "Registros", color: "#06b6d4" },
                ]} />
                <MultiLineChart
                  data={horasTrend}
                  series={[
                    { key: "horas",     label: "Horas",     color: "#6366f1" },
                    { key: "registros", label: "Registros", color: "#06b6d4" },
                  ]}
                  height={160}
                />
              </Card>
            </div>
          )}

          {/* ── PROJETOS ── */}
          {tab === "projetos" && visaoGeral && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-border bg-card p-4">
                  <KpiMini label="Total tasks" value={visaoGeral.resumo.totalTasks} delta={`${visaoGeral.resumo.progresso}% concluídas`} />
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <KpiMini label="Concluídas" value={visaoGeral.resumo.tasksConcluidas} color="text-green-400" />
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <KpiMini label="Vencidas" value={visaoGeral.resumo.tasksVencidas} color="text-red-400" />
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <KpiMini label="Projetos ativos" value={visaoGeral.resumo.projetosAtivos} color="text-purple-400" delta={`de ${visaoGeral.resumo.totalProjetos} total`} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card title="Tasks concluídas por dia" sub="Últimos 14 dias">
                  <BarChartSvg data={visaoGeral.tasksPorDia || []} labelKey="dia" valueKey="total" color="#22c55e" />
                </Card>

                <Card title="Tasks por status">
                  <DonutChart
                    total={visaoGeral.resumo.totalTasks}
                    data={(visaoGeral.tasksPorStatus || []).map((s: any) => ({
                      label: { A_FAZER: "A Fazer", EM_ANDAMENTO: "Em Andamento", REVISAO: "Revisão", BLOQUEADA: "Bloqueada", CONCLUIDA: "Concluída" }[s.status as string] || s.status,
                      value: s.total,
                      color: { A_FAZER: "#6b7280", EM_ANDAMENTO: "#06b6d4", REVISAO: "#f59e0b", BLOQUEADA: "#ef4444", CONCLUIDA: "#22c55e" }[s.status as string] || "#6366f1",
                    }))}
                  />
                </Card>
              </div>

              <Card title="Tasks por membro" sub="Responsáveis ativos">
                {(visaoGeral.tasksPorMembro || []).length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-8">Nenhum responsável atribuído</div>
                ) : (
                  <div className="space-y-2">
                    {(visaoGeral.tasksPorMembro || []).slice(0, 8).map((m: any, i: number) => {
                      const max = visaoGeral.tasksPorMembro[0]?.total || 1;
                      const colors = ["#6366f1","#22c55e","#f59e0b","#ef4444","#06b6d4","#f472b6","#84cc16","#a78bfa"];
                      return (
                        <div key={i}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">{m.nome}</span>
                            <span className="font-mono text-muted-foreground">{m.total}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(m.total / max) * 100}%`, background: colors[i % colors.length] }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {produtividade && (
                <Card title="Minha produtividade" sub="Últimos 30 dias">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="text-xs text-muted-foreground font-medium">Tasks diárias</div>
                      <div className="flex items-end gap-2">
                        <span className="text-3xl font-bold text-foreground">{produtividade.dailyProgresso}%</span>
                        <span className="text-xs text-muted-foreground mb-1">{produtividade.dailyConcluidas}/{produtividade.dailyTasks}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full transition-all duration-700" style={{ width: `${produtividade.dailyProgresso}%` }} />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="text-xs text-muted-foreground font-medium">Tasks de projeto</div>
                      <div className="flex items-end gap-2">
                        <span className="text-3xl font-bold text-foreground">{produtividade.taxaConclusao}%</span>
                        <span className="text-xs text-muted-foreground mb-1">{produtividade.tasksDone}/{produtividade.tasksAssignee}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${produtividade.taxaConclusao}%` }} />
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}
          {/* ── ATENDENTES ── */}
          {tab === "atendentes" && (
            <div className="space-y-4">
              <Card title="SLA por Atendente" sub="Últimos 30 dias — chamados atribuídos">
                {slaAtendentes.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">Sem dados no período</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          {["Atendente","Total","Resolvidos","Resolução SLA","Resposta SLA","Violações abertas","Tempo médio"].map(h => (
                            <th key={h} className="text-left py-2 px-3 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {slaAtendentes.map((a: any) => {
                          const resColor = a.resolucaoPct === null ? "text-muted-foreground" : a.resolucaoPct >= 90 ? "text-green-400" : a.resolucaoPct >= 70 ? "text-yellow-400" : "text-red-400";
                          const respColor = a.respostaPct === null ? "text-muted-foreground" : a.respostaPct >= 90 ? "text-green-400" : a.respostaPct >= 70 ? "text-yellow-400" : "text-red-400";
                          const tempo = a.tempoMedioResolucaoMin ? (a.tempoMedioResolucaoMin >= 60 ? `${Math.floor(a.tempoMedioResolucaoMin/60)}h${a.tempoMedioResolucaoMin%60>0?` ${a.tempoMedioResolucaoMin%60}m`:""}` : `${a.tempoMedioResolucaoMin}m`) : "—";
                          return (
                            <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                              <td className="py-2.5 px-3 font-medium text-foreground">{a.nome}</td>
                              <td className="py-2.5 px-3 font-mono">{a.total}</td>
                              <td className="py-2.5 px-3 font-mono">{a.resolvidos}</td>
                              <td className="py-2.5 px-3">
                                {a.resolucaoPct !== null ? (
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-[40px]">
                                      <div className={cn("h-full rounded-full", a.resolucaoPct >= 90 ? "bg-green-500" : a.resolucaoPct >= 70 ? "bg-yellow-500" : "bg-red-500")} style={{ width: `${a.resolucaoPct}%` }} />
                                    </div>
                                    <span className={cn("font-mono", resColor)}>{a.resolucaoPct}%</span>
                                  </div>
                                ) : <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="py-2.5 px-3">
                                {a.respostaPct !== null ? (
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-[40px]">
                                      <div className={cn("h-full rounded-full", a.respostaPct >= 90 ? "bg-green-500" : a.respostaPct >= 70 ? "bg-yellow-500" : "bg-red-500")} style={{ width: `${a.respostaPct}%` }} />
                                    </div>
                                    <span className={cn("font-mono", respColor)}>{a.respostaPct}%</span>
                                  </div>
                                ) : <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="py-2.5 px-3">
                                {a.violacoesAbertas > 0 ? (
                                  <span className="font-mono text-red-400 font-semibold">{a.violacoesAbertas}</span>
                                ) : <span className="text-muted-foreground font-mono">0</span>}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-muted-foreground">{tempo}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ── CATEGORIAS ── */}
          {tab === "categorias" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-border bg-card p-4">
                  <KpiMini label="Categorias ativas" value={categoriasBrk.length} />
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <KpiMini label="Total chamados" value={categoriasBrk.reduce((s, c) => s + c.total, 0)} color="text-primary" />
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <KpiMini label="Total resolvidos" value={categoriasBrk.reduce((s, c) => s + c.resolvidos, 0)} color="text-green-400" />
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <KpiMini
                    label="Taxa geral"
                    value={(() => {
                      const t = categoriasBrk.reduce((s, c) => s + c.total, 0);
                      const r = categoriasBrk.reduce((s, c) => s + c.resolvidos, 0);
                      return t > 0 ? `${Math.round(r / t * 100)}%` : "—";
                    })()}
                    color="text-cyan-400"
                    delta="resolução"
                  />
                </div>
              </div>

              <Card title="Chamados por categoria" sub={`Últimas ${semanas} semanas`}>
                {categoriasBrk.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-8">Sem dados no período</div>
                ) : (
                  <BarChartSvg data={categoriasBrk} labelKey="categoria" valueKey="total" color="#6366f1" height={200} />
                )}
              </Card>

              <Card title="Detalhamento por categoria" sub="Volume, resolvidos e taxa de resolução">
                {categoriasBrk.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-8">Sem dados no período</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          {["Categoria","Total","Resolvidos","Taxa de Resolução"].map(h => (
                            <th key={h} className="text-left py-2 px-3 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {categoriasBrk.map((c: any, i: number) => {
                          const colors = ["#6366f1","#22c55e","#f59e0b","#ef4444","#06b6d4","#f472b6","#84cc16","#a78bfa"];
                          const color = colors[i % colors.length];
                          const pct = c.pctResolvidos;
                          return (
                            <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                                  <span className="font-medium text-foreground">{c.categoria}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 font-mono">{c.total}</td>
                              <td className="py-2.5 px-3 font-mono text-green-400">{c.resolvidos}</td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-[60px]">
                                    <div
                                      className="h-full rounded-full"
                                      style={{ width: `${pct}%`, background: pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444" }}
                                    />
                                  </div>
                                  <span className={cn("font-mono", pct >= 80 ? "text-green-400" : pct >= 50 ? "text-yellow-400" : "text-red-400")}>{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ── COMPARATIVO ── */}
          {tab === "comparativo" && (
            <div className="space-y-4">
              {/* Period selectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    Período 1
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 block">Início</label>
                      <input
                        type="date"
                        value={p1Start}
                        onChange={e => setP1Start(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 block">Fim</label>
                      <input
                        type="date"
                        value={p1End}
                        onChange={e => setP1End(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-cyan-400" />
                    Período 2
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 block">Início</label>
                      <input
                        type="date"
                        value={p2Start}
                        onChange={e => setP2Start(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 block">Fim</label>
                      <input
                        type="date"
                        value={p2End}
                        onChange={e => setP2End(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={async () => {
                    setRefreshing(true);
                    try {
                      const r = await api.get(`/relatorios/chamados-comparativo?p1Start=${p1Start}&p1End=${p1End}&p2Start=${p2Start}&p2End=${p2End}`);
                      setComparativo(r.data);
                    } finally { setRefreshing(false); }
                  }}
                  disabled={refreshing}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <GitCompare size={14} />
                  Comparar períodos
                </button>
              </div>

              {comparativo && (() => {
                const p1 = comparativo.periodo1;
                const p2 = comparativo.periodo2;
                const fmt = (n: number, suffix = "") => `${n}${suffix}`;
                const diff = (v1: number, v2: number, lower = false) => {
                  if (v2 === 0) return null;
                  const pct = Math.round((v1 - v2) / v2 * 100);
                  const up = lower ? pct < 0 : pct > 0;
                  return { pct, label: pct > 0 ? `+${pct}%` : `${pct}%`, color: up ? "text-green-400" : pct === 0 ? "text-muted-foreground" : "text-red-400" };
                };

                const metrics = [
                  { label: "Total chamados", v1: p1.total, v2: p2.total, lower: false },
                  { label: "Resolvidos", v1: p1.resolvidos, v2: p2.resolvidos, lower: false },
                  { label: "Taxa resolução", v1: p1.resolucaoPct, v2: p2.resolucaoPct, suffix: "%", lower: false },
                  { label: "Urgentes", v1: p1.urgentes, v2: p2.urgentes, lower: true },
                  { label: "SLA violados", v1: p1.slaViolados, v2: p2.slaViolados, lower: true },
                  { label: "CSAT médio", v1: p1.csatMedia, v2: p2.csatMedia, suffix: "★", lower: false },
                  { label: "CSAT avaliações", v1: p1.csatTotal, v2: p2.csatTotal, lower: false },
                ];

                return (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                      <div className="grid grid-cols-3 border-b border-border text-xs font-medium text-muted-foreground">
                        <div className="px-4 py-3">Métrica</div>
                        <div className="px-4 py-3 text-center border-l border-border">
                          <span className="flex items-center justify-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                            {new Date(p1.inicio).toLocaleDateString("pt-BR", { day:"2-digit", month:"short" })} → {new Date(p1.fim).toLocaleDateString("pt-BR", { day:"2-digit", month:"short" })}
                          </span>
                        </div>
                        <div className="px-4 py-3 text-center border-l border-border">
                          <span className="flex items-center justify-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-cyan-400" />
                            {new Date(p2.inicio).toLocaleDateString("pt-BR", { day:"2-digit", month:"short" })} → {new Date(p2.fim).toLocaleDateString("pt-BR", { day:"2-digit", month:"short" })}
                          </span>
                        </div>
                      </div>
                      {metrics.map((m, i) => {
                        const d = diff(m.v1, m.v2, m.lower);
                        return (
                          <div key={i} className="grid grid-cols-3 border-b border-border/50 hover:bg-muted/20 transition-colors">
                            <div className="px-4 py-3 text-xs text-muted-foreground font-medium">{m.label}</div>
                            <div className="px-4 py-3 text-center border-l border-border/50">
                              <span className="text-sm font-bold text-foreground font-mono">{fmt(m.v1, m.suffix || "")}</span>
                              {d && <span className={cn("ml-2 text-[10px] font-mono", d.color)}>{d.label}</span>}
                            </div>
                            <div className="px-4 py-3 text-center border-l border-border/50">
                              <span className="text-sm font-mono text-muted-foreground">{fmt(m.v2, m.suffix || "")}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Visual comparison bars */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        { label: "Chamados abertos", v1: p1.total, v2: p2.total, color1: "#6366f1", color2: "#06b6d4" },
                        { label: "Resolvidos", v1: p1.resolvidos, v2: p2.resolvidos, color1: "#22c55e", color2: "#84cc16" },
                        { label: "Taxa resolução (%)", v1: p1.resolucaoPct, v2: p2.resolucaoPct, color1: "#f59e0b", color2: "#f472b6" },
                      ].map((item, i) => {
                        const max = Math.max(item.v1, item.v2, 1);
                        return (
                          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
                            <div className="text-xs font-medium text-muted-foreground">{item.label}</div>
                            <div className="space-y-2">
                              <div>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: item.color1 }} />P1</span>
                                  <span className="font-mono font-bold text-foreground">{item.v1}</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(item.v1/max)*100}%`, background: item.color1 }} />
                                </div>
                              </div>
                              <div>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: item.color2 }} />P2</span>
                                  <span className="font-mono text-muted-foreground">{item.v2}</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(item.v2/max)*100}%`, background: item.color2 }} />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {!comparativo && (
                <div className="rounded-xl border border-border bg-card p-12 text-center">
                  <GitCompare size={32} className="mx-auto text-muted-foreground mb-3 opacity-40" />
                  <p className="text-sm text-muted-foreground">Selecione dois períodos e clique em <strong>Comparar períodos</strong></p>
                </div>
              )}
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
