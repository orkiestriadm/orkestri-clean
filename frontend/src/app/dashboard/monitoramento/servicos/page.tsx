"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import {
  Activity, CheckCircle2, AlertTriangle, Search, Server, Cpu, MemoryStick, HardDrive, RefreshCw,
  ChevronDown, ChevronUp, ChevronLeft,
} from "lucide-react";

type Metric = { chave: string; rotulo: string; valor: number; unidade?: string | null; coletadoEm?: string };
type Service = { id: string; nome: string; estado: "UP" | "DOWN" | "DESCONHECIDO"; ultimoValor?: string | null; ultimaTransicao?: string | null };
type DeepAsset = {
  id: string; nome: string; ip: string; categoria: string; tipo: string; localizacao?: string | null;
  ultimoStatus: string; services: Service[]; metrics: Metric[];
};
type Summary = { total: number; up: number; down: number; hosts: number };

// Cor por uso (gauge de hardware): verde < 70, âmbar < 90, vermelho >= 90
const barColor = (v: number) => (v >= 90 ? "#ef4444" : v >= 70 ? "#f59e0b" : "#22c55e");
const fmtUptime = (s?: number) => {
  if (!s || s <= 0) return "—";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
};

function Gauge({ icon: Icon, label, valor }: { icon: any; label: string; valor: number | null }) {
  const v = valor == null ? 0 : Math.max(0, Math.min(100, valor));
  const col = valor == null ? "var(--text-muted)" : barColor(v);
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)", marginBottom: 3, minWidth: 0 }}>
        <Icon size={12} style={{ flexShrink: 0 }} />
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }} title={label}>{label}</span>
        <span style={{ marginLeft: "auto", flexShrink: 0, fontWeight: 700, color: col }}>{valor == null ? "—" : `${v.toFixed(0)}%`}</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: "var(--surface-2, rgba(148,163,184,0.18))", overflow: "hidden" }}>
        <div style={{ width: `${v}%`, height: "100%", background: col, borderRadius: 4, transition: "width .4s" }} />
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
  const topDisk = disks[0];
  const svcDown = a.services.filter((s) => s.estado === "DOWN");
  const hasSvc = a.services.length > 0;

  return (
    <div style={{
      border: "1px solid var(--border-subtle)", borderRadius: 12, padding: 12, background: "var(--bg-card)",
      borderLeft: `3px solid ${svcDown.length ? "#ef4444" : "#22c55e"}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Server size={16} style={{ color: "var(--text-muted)" }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nome}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.ip} · {a.localizacao || a.categoria}</div>
        </div>
        {uptime != null && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>up {fmtUptime(uptime)}</span>}
      </div>

      {/* Serviços */}
      {hasSvc && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
          {a.services.map((s) => {
            const up = s.estado === "UP";
            return (
              <span key={s.id} title={s.estado} style={{
                display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600,
                padding: "3px 8px", borderRadius: 999,
                background: up ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                color: up ? "#16a34a" : "#dc2626",
              }}>
                {up ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}{s.nome}
              </span>
            );
          })}
        </div>
      )}

      {/* Hardware */}
      <div style={{ display: "flex", gap: 12 }}>
        <Gauge icon={Cpu} label="CPU" valor={cpu} />
        <Gauge icon={MemoryStick} label="RAM" valor={mem} />
        <Gauge icon={HardDrive} label={topDisk ? `Disco ${topDisk.rotulo}` : "Disco"} valor={topDisk?.valor ?? null} />
      </div>
      {disks.length > 1 && (
        <div style={{ marginTop: 6, fontSize: 10, color: "var(--text-muted)" }}>
          {disks.slice(1).map((d) => `${d.rotulo} ${d.valor.toFixed(0)}%`).join(" · ")}
        </div>
      )}

      {/* Histórico (CPU/RAM) sob demanda */}
      <button onClick={toggle} style={{
        marginTop: 10, display: "flex", alignItems: "center", gap: 4, background: "none", border: "none",
        color: "var(--text-muted)", fontSize: 11, cursor: "pointer", padding: 0,
      }}>
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
  );
}

export default function ServicosPage() {
  const [assets, setAssets] = useState<DeepAsset[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [soComProblema, setSoProblema] = useState(false);

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

  const filtered = useMemo(() => {
    let r = assets;
    if (soComProblema) r = r.filter((a) => a.services.some((s) => s.estado === "DOWN"));
    const term = q.trim().toLowerCase();
    if (term) r = r.filter((a) => `${a.nome} ${a.ip} ${a.localizacao || ""}`.toLowerCase().includes(term));
    return r;
  }, [assets, q, soComProblema]);

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

        {/* KPIs */}
        {summary && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "14px 0 18px" }}>
            <Kpi label="Servidores" valor={summary.hosts} />
            <Kpi label="Serviços no ar" valor={summary.up} cor="#16a34a" />
            <Kpi label="Serviços parados" valor={summary.down} cor={summary.down ? "#dc2626" : undefined} />
          </div>
        )}

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
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
            {assets.length === 0
              ? "Nenhum servidor com coleta profunda ainda. O worker descobre automaticamente os hosts do Zabbix no próximo ciclo."
              : "Nenhum servidor corresponde ao filtro."}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 12, alignItems: "start" }}>
            {filtered.map((a) => <ServerCard key={a.id} a={a} />)}
          </div>
        )}
        </div>
      </div>
    </>
  );
}

function Kpi({ label, valor, cor }: { label: string; valor: number; cor?: string }) {
  return (
    <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "12px 18px", background: "var(--bg-card)", minWidth: 130 }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: cor || "var(--text-primary)" }}>{valor}</div>
    </div>
  );
}
