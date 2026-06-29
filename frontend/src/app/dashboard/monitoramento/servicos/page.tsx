"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import {
  Activity, CheckCircle2, AlertTriangle, Search, Server, HardDrive, RefreshCw,
  ChevronDown, ChevronUp, ChevronLeft, Tag, Layers, Cpu, MemoryStick,
} from "lucide-react";

type Metric = { chave: string; rotulo: string; valor: number; unidade?: string | null; coletadoEm?: string };
type Service = { id: string; nome: string; estado: "UP" | "DOWN" | "DESCONHECIDO"; ultimoValor?: string | null; ultimaTransicao?: string | null };
type DeepAsset = {
  id: string; nome: string; ip: string; categoria: string; tipo: string; localizacao?: string | null;
  ultimoStatus: string; services: Service[]; metrics: Metric[]; sparkCpu?: number[];
};
type Summary = { total: number; up: number; down: number; hosts: number };

// Categorias de servidores (por nome do host). Ordem importa: OSA e Fadami antes de TBR.
type CatKey = "vias" | "osa" | "fadami" | "tbr" | "outros";
const CAT_TABS: { key: CatKey | "saga"; label: string }[] = [
  { key: "vias",   label: "Desempenho Vias" },
  { key: "osa",    label: "Desempenho OSA" },
  { key: "fadami", label: "Servers Fadami" },
  { key: "tbr",    label: "Servers TBR" },
  { key: "outros", label: "Outros" },
  { key: "saga",   label: "Versão SAGA" },
];
function categoria(nome: string): CatKey {
  const n = (nome || "").toLowerCase().trim();
  if (n === "zabbix server") return "outros";                 // único que fica em Outros
  if (/conectcar|greenpass|movemais|semparar|veloe/.test(n)) return "osa";
  if (/saga|fadami|fad|n[23]fotos/.test(n)) return "fadami";
  if (/tbr/.test(n)) return "tbr";
  return "vias";                                              // todo o resto é equipamento de via
}

// Cor por uso (gauge de hardware): verde < 70, âmbar < 90, vermelho >= 90
const barColor = (v: number) => (v >= 90 ? "#ef4444" : v >= 70 ? "#f59e0b" : "#22c55e");
const fmtUptime = (s?: number) => {
  if (!s || s <= 0) return "—";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
};


// Gauge radial (anel) estilo NOC — leitura instantânea de CPU/RAM.
function RadialGauge({ label, valor }: { label: string; valor: number | null }) {
  const v = valor == null ? 0 : Math.max(0, Math.min(100, valor));
  const col = valor == null ? "var(--text-muted)" : barColor(v);
  const r = 22, circ = 2 * Math.PI * r, fill = (v / 100) * circ;
  return (
    <svg viewBox="0 0 58 58" width="58" height="58" style={{ flexShrink: 0 }}>
      <circle cx="29" cy="29" r={r} fill="none" strokeWidth="6" style={{ stroke: "var(--border-subtle)" }} />
      {valor != null && (
        <circle cx="29" cy="29" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${fill.toFixed(1)} ${(circ - fill).toFixed(1)}`}
          transform="rotate(-90 29 29)" style={{ stroke: col, transition: "stroke-dasharray .5s" }} />
      )}
      <text x="29" y="28" textAnchor="middle" fontSize="14" fontWeight="700" fontFamily="var(--font-mono)" style={{ fill: "var(--text-primary)" }}>{valor == null ? "—" : v.toFixed(0)}</text>
      <text x="29" y="39" textAnchor="middle" fontSize="9" style={{ fill: "var(--text-muted)" }}>{label}</text>
    </svg>
  );
}

// Mini-sparkline de tendência (números 0-100). Preenchimento + linha.
function MiniSpark({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) {
    return <div style={{ height: 30, display: "flex", alignItems: "center", fontSize: 10, color: "var(--text-muted)" }}>coletando…</div>;
  }
  const w = 120, h = 30, pad = 2;
  const n = data.length, min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const x = (i: number) => pad + (i / (n - 1)) * (w - 2 * pad);
  const y = (v: number) => pad + (1 - (v - min) / range) * (h - 2 * pad);
  const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${x(0).toFixed(1)},${(h - pad)} ${pts} ${x(n - 1).toFixed(1)},${(h - pad)}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: "block" }}>
      <polygon points={area} fill={color} opacity={0.13} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Barra fina de disco (pode haver vários por servidor).
function DiskBar({ rotulo, valor }: { rotulo: string; valor: number }) {
  const col = barColor(valor);
  return (
    <div style={{ marginBottom: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginBottom: 2, gap: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><HardDrive size={10} /> {rotulo}</span>
        <span style={{ fontWeight: 700, color: col, flexShrink: 0 }}>{valor.toFixed(0)}%</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: "var(--surface-2, rgba(148,163,184,0.18))", overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, valor)}%`, height: "100%", background: col, borderRadius: 3, transition: "width .4s" }} />
      </div>
    </div>
  );
}

type Ponto = { ts: string; valor: number };
function Sparkline({ data, color, label }: { data: Ponto[]; color: string; label: string }) {
  if (!data || data.length < 2) {
    return <div style={{ flex: 1, fontSize: 11, color: "var(--text-muted)" }}>{label}: coletando histórico…</div>;
  }
  const w = 260, h = 38, pad = 2;
  const vals = data.map((d) => d.valor);
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  const n = data.length;
  const x = (i: number) => pad + (i / (n - 1)) * (w - 2 * pad);
  const y = (v: number) => pad + (1 - (v - min) / range) * (h - 2 * pad);
  const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.valor).toFixed(1)}`).join(" ");
  const area = `${x(0).toFixed(1)},${(h - pad).toFixed(1)} ${pts} ${x(n - 1).toFixed(1)},${(h - pad).toFixed(1)}`;
  const last = vals[n - 1];
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>
        <span>{label}</span><span style={{ fontWeight: 700, color }}>{last.toFixed(0)}%</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
        <polygon points={area} fill={color} opacity={0.12} />
        <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function ServerCard({ a }: { a: DeepAsset }) {
  const [open, setOpen] = useState(false);
  const [hist, setHist] = useState<{ cpu: Ponto[]; mem: Ponto[] } | null>(null);
  const [loadingH, setLoadingH] = useState(false);

  const toggle = useCallback(async () => {
    const next = !open;
    setOpen(next);
    if (next && !hist) {
      setLoadingH(true);
      try {
        const [c, m] = await Promise.all([
          api.get(`/monitoramento/assets/${a.id}/metric-history?chave=cpu&horas=24`),
          api.get(`/monitoramento/assets/${a.id}/metric-history?chave=mem&horas=24`),
        ]);
        setHist({ cpu: c.data?.serie || [], mem: m.data?.serie || [] });
      } catch {
        setHist({ cpu: [], mem: [] });
      } finally {
        setLoadingH(false);
      }
    }
  }, [open, hist, a.id]);

  const cpu = a.metrics.find((m) => m.chave === "cpu")?.valor ?? null;
  const mem = a.metrics.find((m) => m.chave === "mem")?.valor ?? null;
  const uptime = a.metrics.find((m) => m.chave === "uptime")?.valor;
  const disks = a.metrics.filter((m) => m.chave === "disk").sort((x, y) => y.valor - x.valor);
  const svcDown = a.services.filter((s) => s.estado === "DOWN");
  const svcUp = a.services.filter((s) => s.estado === "UP");
  const hasSvc = a.services.length > 0;
  const worst = Math.max(cpu ?? 0, mem ?? 0);
  const statusCol = svcDown.length ? "#ef4444" : worst >= 90 ? "#ef4444" : worst >= 70 ? "#f59e0b" : "#22c55e";

  return (
    <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 12, background: "var(--bg-card)", overflow: "hidden" }}>
      <div style={{ height: 4, background: statusCol }} />
      <div style={{ padding: "12px 13px" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: statusCol, flexShrink: 0, boxShadow: `0 0 0 3px ${statusCol}22` }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nome}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{a.ip}{(a.localizacao || a.categoria) ? ` · ${a.localizacao || a.categoria}` : ""}</div>
          </div>
          {uptime != null && <span style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>up {fmtUptime(uptime)}</span>}
        </div>

        {/* gauges + sparkline CPU */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <RadialGauge label="CPU" valor={cpu} />
            <RadialGauge label="RAM" valor={mem} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginBottom: 1 }}>
              <span>CPU · 90min</span>
              {cpu != null && <span style={{ fontWeight: 700, color: barColor(cpu) }}>{cpu.toFixed(0)}%</span>}
            </div>
            <MiniSpark data={a.sparkCpu || []} color={cpu != null ? barColor(cpu) : "#22c55e"} />
          </div>
        </div>

        {/* discos */}
        {disks.length > 0 && (
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: disks.length > 1 ? "1fr 1fr" : "1fr", gap: "0 14px" }}>
            {disks.slice(0, 4).map((d) => <DiskBar key={d.rotulo} rotulo={d.rotulo} valor={d.valor} />)}
          </div>
        )}

        {/* serviços (resumo) */}
        {hasSvc && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border-subtle)" }}>
            {svcDown.map((s) => (
              <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999, background: "rgba(239,68,68,0.12)", color: "#dc2626" }}>
                <AlertTriangle size={11} />{s.nome}
              </span>
            ))}
            {svcUp.length > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: svcDown.length ? "var(--text-muted)" : "#16a34a" }}>
                <CheckCircle2 size={12} />{svcUp.length} serviço{svcUp.length > 1 ? "s" : ""} no ar
              </span>
            )}
          </div>
        )}

        {/* histórico 24h sob demanda */}
        <button onClick={toggle} style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer", padding: 0 }}>
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Histórico 24h
        </button>
        {open && (
          <div style={{ marginTop: 8, display: "flex", gap: 14 }}>
            {loadingH ? (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>carregando…</span>
            ) : (
              <>
                <Sparkline data={hist?.cpu || []} color="#3b82f6" label="CPU" />
                <Sparkline data={hist?.mem || []} color="#8b5cf6" label="RAM" />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ServicosPage() {
  const [assets, setAssets] = useState<DeepAsset[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [soComProblema, setSoProblema] = useState(false);
  const [tab, setTab] = useState<CatKey | "saga">("vias");

  const load = useCallback(async () => {
    try {
      const [ov, sum] = await Promise.all([
        api.get("/monitoramento/deep/overview"),
        api.get("/monitoramento/services/summary").catch(() => ({ data: null })),
      ]);
      setAssets(ov.data?.assets || []);
      setSummary(sum.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000); // refresca a cada 30s
    return () => clearInterval(t);
  }, [load]);

  // Agrupa os assets por categoria.
  const porCat = useMemo(() => {
    const g: Record<CatKey, DeepAsset[]> = { vias: [], osa: [], fadami: [], tbr: [], outros: [] };
    for (const a of assets) g[categoria(a.nome)].push(a);
    return g;
  }, [assets]);

  // Assets da categoria ativa, depois do filtro de busca / só com problema.
  const catItems = tab === "saga" ? [] : porCat[tab];
  const visiveis = useMemo(() => {
    let r = catItems;
    if (soComProblema) r = r.filter((a) => a.services.some((s) => s.estado === "DOWN"));
    const term = q.trim().toLowerCase();
    if (term) r = r.filter((a) => `${a.nome} ${a.ip} ${a.localizacao || ""}`.toLowerCase().includes(term));
    return r;
  }, [catItems, q, soComProblema]);

  // KPIs da categoria ativa.
  const kpiProblema = catItems.filter((a) => a.services.some((s) => s.estado === "DOWN")).length;
  const mediaMetric = (chave: string) => {
    const vs = catItems.map((a) => a.metrics.find((m) => m.chave === chave)?.valor).filter((v): v is number => v != null);
    return vs.length ? Math.round(vs.reduce((s, v) => s + v, 0) / vs.length) : null;
  };
  const avgCpu = mediaMetric("cpu");
  const avgMem = mediaMetric("mem");

  return (
    <>
      <Topbar />
      <div className="page-content">
        <div style={{ maxWidth: 1600, margin: "0 auto", padding: "18px 22px 56px" }}>
        <Link href="/dashboard/monitoramento" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 6 }}>
          <ChevronLeft size={14} /> Voltar ao Monitoramento
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Activity size={22} style={{ color: "var(--accent-red)" }} />
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Serviços & Desempenho</h1>
        </div>
        <p style={{ color: "var(--text-muted)", marginTop: 0, fontSize: 13 }}>
          Estado dos serviços e uso de CPU/RAM/disco dos servidores — lido do Zabbix.
        </p>

        {/* Abas */}
        <div style={{ display: "flex", gap: 2, margin: "14px 0 6px", borderBottom: "1px solid var(--border-subtle)", flexWrap: "wrap", overflowX: "auto" }}>
          {CAT_TABS.map((t) => {
            const items = t.key === "saga" ? [] : porCat[t.key];
            const prob = t.key === "saga" ? 0 : items.filter((a) => a.services.some((s) => s.estado === "DOWN")).length;
            return (
              <TabBtn key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}
                icon={t.key === "saga" ? <Tag size={14} /> : <Activity size={14} />}
                label={t.label} badge={t.key === "saga" ? undefined : items.length} alert={prob > 0} />
            );
          })}
        </div>

        {tab === "saga" ? <SagaVersoes /> : (<>
        {/* KPIs da categoria */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "14px 0 18px" }}>
          <Kpi label="Servidores" valor={catItems.length} icon={<Server size={18} />} />
          <Kpi label="Com problema" valor={kpiProblema} cor={kpiProblema ? "#dc2626" : "#16a34a"} icon={<AlertTriangle size={18} />} />
          <Kpi label="CPU média" valorTxt={avgCpu == null ? "—" : `${avgCpu}%`} cor={avgCpu != null ? barColor(avgCpu) : undefined} icon={<Cpu size={18} />} />
          <Kpi label="RAM média" valorTxt={avgMem == null ? "—" : `${avgMem}%`} cor={avgMem != null ? barColor(avgMem) : undefined} icon={<MemoryStick size={18} />} />
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: 10, color: "var(--text-muted)" }} />
            <input
              value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar servidor, IP, praça…"
              style={{ width: "100%", padding: "9px 12px 9px 32px", borderRadius: 10, border: "1px solid var(--border-subtle)", background: "var(--bg-card)", color: "var(--text-primary)" }}
            />
          </div>
          <button onClick={() => setSoProblema((v) => !v)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, cursor: "pointer",
            border: "1px solid var(--border-subtle)", fontWeight: 600, fontSize: 13,
            background: soComProblema ? "rgba(239,68,68,0.12)" : "var(--bg-card)",
            color: soComProblema ? "#dc2626" : "var(--text-primary)",
          }}>
            <AlertTriangle size={14} /> Só com problema
          </button>
          <button onClick={load} title="Atualizar" style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border-subtle)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
            <RefreshCw size={14} />
          </button>
        </div>

        {loading ? (
          <p style={{ color: "var(--text-muted)" }}>Carregando…</p>
        ) : visiveis.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
            {assets.length === 0
              ? "Nenhum servidor com coleta profunda ainda. O worker descobre automaticamente os hosts do Zabbix no próximo ciclo."
              : catItems.length === 0
              ? "Nenhum servidor nesta categoria."
              : "Nenhum servidor corresponde ao filtro."}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 12, alignItems: "start" }}>
            {visiveis.map((a) => <ServerCard key={a.id} a={a} />)}
          </div>
        )}
        </>)}
        </div>
      </div>
    </>
  );
}

function Kpi({ label, valor, valorTxt, cor, icon }: { label: string; valor?: number; valorTxt?: string; cor?: string; icon?: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "12px 16px", background: "var(--bg-card)", display: "flex", alignItems: "center", gap: 12, flex: "1 1 150px", minWidth: 140 }}>
      {icon && (
        <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--bg-secondary, rgba(148,163,184,0.12))", display: "flex", alignItems: "center", justifyContent: "center", color: cor || "var(--text-muted)", flexShrink: 0 }}>{icon}</div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: cor || "var(--text-primary)", fontFamily: "var(--font-mono)", lineHeight: 1.1, whiteSpace: "nowrap" }}>{valorTxt ?? valor}</div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label, badge, alert }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number; alert?: boolean }) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", fontSize: 13, fontWeight: 700,
      background: "transparent", border: "none", cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap",
      color: active ? "var(--accent-red)" : "var(--text-muted)",
      borderBottom: active ? "2px solid var(--accent-red)" : "2px solid transparent",
    }}>
      {icon} {label}
      {badge != null && (
        <span style={{ fontSize: 11, fontWeight: 700, background: active ? "rgba(220,38,38,0.12)" : "var(--bg-secondary)", borderRadius: 999, padding: "1px 7px", color: active ? "var(--accent-red)" : "var(--text-muted)" }}>{badge}</span>
      )}
      {alert && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#dc2626", flexShrink: 0 }} title="Há servidor com problema" />}
    </button>
  );
}

type SagaRow = { host: string; praca: number; pista: string; versao: string | null; versaoPlc: string | null; sentido: string | null; cabine: string | null; operador: string | null; atualizado: string | null };

const cmpVer = (a: string, b: string) => {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; }
  return 0;
};

function SagaVersoes() {
  const [rows, setRows] = useState<SagaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try { const { data } = await api.get("/osa/saga-versoes"); setRows(data || []); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const versaoMax = useMemo(() => {
    const vs = rows.map((r) => r.versao).filter(Boolean) as string[];
    return vs.length ? vs.reduce((m, v) => (cmpVer(v, m) > 0 ? v : m)) : null;
  }, [rows]);

  const porPraca = useMemo(() => {
    const g: Record<number, SagaRow[]> = {};
    for (const r of rows) { (g[r.praca] = g[r.praca] || []).push(r); }
    return Object.entries(g).map(([p, items]) => ({ praca: Number(p), items })).sort((a, b) => a.praca - b.praca);
  }, [rows]);

  const desatualizadas = rows.filter((r) => r.versao && versaoMax && cmpVer(r.versao, versaoMax) < 0).length;

  if (loading) return <p style={{ color: "var(--text-muted)", marginTop: 16 }}>Carregando…</p>;
  if (!rows.length) return <p style={{ color: "var(--text-muted)", marginTop: 16 }}>Nenhuma pista com o item VersaoSaga no Zabbix.</p>;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <Kpi label="Pistas" valor={rows.length} />
        <Kpi label="Versão mais recente" valorTxt={versaoMax || "—"} cor="#16a34a" />
        <Kpi label="Desatualizadas" valor={desatualizadas} cor={desatualizadas ? "#dc2626" : "#16a34a"} />
      </div>

      {porPraca.map(({ praca, items }) => (
        <div key={praca} style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Layers size={15} style={{ color: "var(--accent-red)" }} />
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Praça PP{String(praca).padStart(2, "0")}</h3>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>· {items.length} pistas</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {items.map((r) => {
              const atrasada = !!(r.versao && versaoMax && cmpVer(r.versao, versaoMax) < 0);
              const cor = !r.versao ? "var(--text-muted)" : atrasada ? "#dc2626" : "#16a34a";
              return (
                <div key={r.host} style={{ border: "1px solid var(--border-subtle)", borderLeft: `3px solid ${cor}`, borderRadius: 12, padding: "14px 16px", background: "var(--bg-card)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>Pista {r.pista}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{r.sentido || ""}</div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase", marginTop: 8 }}>Versão SAGA</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 800, color: cor, lineHeight: 1.1 }}>{r.versao || "—"}</div>
                  {atrasada && <div style={{ fontSize: 10, color: "#dc2626", fontWeight: 700, marginTop: 2 }}>desatualizada</div>}
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
                    <span>PLC {r.versaoPlc || "—"} · cab {r.cabine || "—"}</span>
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.operador || ""}</span>
                    <span>{r.atualizado ? new Date(r.atualizado).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
