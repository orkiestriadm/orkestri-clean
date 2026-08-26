"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { api } from "@/lib/api";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, PieChart, Pie, Legend,
} from "recharts";
import {
  Wallet, TrendingUp, Users, Receipt, RefreshCw, CreditCard, Crown,
} from "lucide-react";

// ── Tipos ───────────────────────────────────────────────────────────────────
type Pagamento = { data: string; valor: number; plano: string; planoNome: string; org: string };
type Metrics = {
  snapshot: { mrr: number; assinantesAtivos: number };
  pagamentos: Pagamento[];
  novosClientes: { mes: string; qtd: number }[];
  hoje: string;
  geradoEm: string;
};

// ── Helpers ─────────────────────────────────────────────────────────────────
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brl = (n: number) => BRL.format(n || 0);
const brlCompact = (n: number) =>
  n >= 1000 ? `R$ ${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : brl(n);
const ddmm = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};
const mesLabel = (iso: string) => {
  const M = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [y, m] = iso.split("-");
  return `${M[Number(m) - 1]}/${y.slice(2)}`;
};
const addDays = (iso: string, delta: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};
const round2 = (n: number) => Math.round(n * 100) / 100;

// Paleta 100% em tokens do sistema.
const PLANO_COR: Record<string, string> = {
  enterprise: "var(--accent-violet)",
  business_plus: "var(--accent-cyan)",
  business_cloud: "var(--accent-amber)",
  desconhecido: "var(--text-muted)",
};
const corPlano = (p: string) => PLANO_COR[p] || "var(--text-muted)";

const CARD: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 14,
  padding: 20,
};
const TOOLTIP = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-medium)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--text-primary)",
};

function Kpi({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <div style={CARD}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 12, fontWeight: 600 }}>
        <span style={{ color: accent || "var(--accent-violet)" }}>{icon}</span>
        {label}
      </div>
      <div className="metric" style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", marginTop: 8, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

const PERIODOS = [
  { d: 30, label: "30 dias" },
  { d: 60, label: "60 dias" },
  { d: 90, label: "90 dias" },
] as const;

function FiltroPeriodo({ periodo, onChange }: { periodo: number; onChange: (d: 30 | 60 | 90) => void }) {
  return (
    <div style={{ display: "flex", gap: 4, background: "var(--bg-primary)", padding: 3, borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
      {PERIODOS.map((p) => (
        <button
          key={p.d}
          onClick={() => onChange(p.d)}
          style={{
            padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 600, transition: "all .12s",
            background: periodo === p.d ? "var(--accent-violet)" : "transparent",
            color: periodo === p.d ? "#fff" : "var(--text-muted)",
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ── Painel ──────────────────────────────────────────────────────────────────
export default function BillingDashboardPanel() {
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<30 | 60 | 90>(90);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await api.get<Metrics>("/billing/metrics");
      setData(res.data);
    } catch (e: any) {
      setErro(e?.response?.status === 403 ? "Acesso restrito a super-admins." : "Falha ao carregar métricas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Agregação por período — o filtro dirige a dashboard inteira, sem refetch.
  const view = useMemo(() => {
    if (!data) return null;
    const cutoff = addDays(data.hoje, -periodo);
    const filtrados = data.pagamentos.filter((p) => p.data >= cutoff);

    const receita = round2(filtrados.reduce((s, p) => s + p.valor, 0));
    const count = filtrados.length;
    const ticket = count ? round2(receita / count) : 0;

    // Série diária acumulada dentro do período
    const porDia = new Map<string, number>();
    for (const p of filtrados) porDia.set(p.data, (porDia.get(p.data) || 0) + p.valor);
    const serie: { data: string; acumulado: number }[] = [];
    let acc = 0;
    for (let i = periodo; i >= 0; i--) {
      const key = addDays(data.hoje, -i);
      acc += porDia.get(key) || 0;
      serie.push({ data: key, acumulado: round2(acc) });
    }

    // Receita por plano
    const pm = new Map<string, { nome: string; valor: number; n: number }>();
    for (const p of filtrados) {
      const c = pm.get(p.plano) || { nome: p.planoNome, valor: 0, n: 0 };
      c.valor += p.valor; c.n += 1;
      pm.set(p.plano, c);
    }
    const porPlano = Array.from(pm.entries())
      .map(([plano, v]) => ({ plano, nome: v.nome, valor: round2(v.valor), pagamentos: v.n }))
      .sort((a, b) => b.valor - a.valor);

    // Top organizações por receita
    const om = new Map<string, number>();
    for (const p of filtrados) om.set(p.org, (om.get(p.org) || 0) + p.valor);
    const topOrgs = Array.from(om.entries())
      .map(([org, valor]) => ({ org, valor: round2(valor) }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);

    return { receita, count, ticket, serie, porPlano, topOrgs };
  }, [data, periodo]);

  if (loading && !data) {
    return <div style={{ color: "var(--text-muted)", fontSize: 14, padding: 40, textAlign: "center" }}>Carregando métricas…</div>;
  }
  if (erro) {
    return <div style={{ ...CARD, borderColor: "var(--accent-red)", color: "var(--accent-red)" }}>{erro}</div>;
  }
  if (!data || !view) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ── Barra do filtro (dirige toda a dashboard) ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Período</span>
          <FiltroPeriodo periodo={periodo} onChange={setPeriodo} />
        </div>
        <button
          onClick={carregar}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "7px 13px",
            borderRadius: 10, border: "1px solid var(--border-medium)", background: "var(--bg-card)",
            color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          <RefreshCw size={14} style={loading ? { animation: "spin 1s linear infinite" } : undefined} />
          Atualizar
        </button>
      </div>

      {/* ── Faixa de destaque: RECEITA TOTAL (do período) ── */}
      <div style={{
        ...CARD,
        padding: 28,
        background: "linear-gradient(135deg, var(--bg-card) 0%, var(--accent-violet-dim) 100%)",
        borderColor: "color-mix(in srgb, var(--accent-violet) 35%, transparent)",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--accent-violet)", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
            <Wallet size={16} /> Receita total
            <span style={{ fontWeight: 600, textTransform: "none", letterSpacing: 0, color: "var(--text-muted)", fontSize: 12 }}>
              · últimos {periodo} dias
            </span>
          </div>
          <div className="metric" style={{ fontSize: 46, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.05, marginTop: 6 }}>
            {brl(view.receita)}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            {view.count} pagamentos aprovados · {data.snapshot.assinantesAtivos} assinaturas ativas
          </div>
        </div>
        <div style={{ minWidth: 200, height: 88, flex: "1 1 200px", maxWidth: 420 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={view.serie} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="gradSpark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-violet)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--accent-violet)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="acumulado" stroke="var(--accent-violet)" strokeWidth={2} fill="url(#gradSpark)" />
              <Tooltip contentStyle={TOOLTIP} labelFormatter={(l: any) => ddmm(String(l))} formatter={(v: any) => [brl(Number(v)), "Acumulado"]} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <Kpi icon={<TrendingUp size={15} />} label="MRR (recorrente/mês)" value={brl(data.snapshot.mrr)} sub="Recorrência atual" accent="var(--accent-cyan)" />
        <Kpi icon={<Users size={15} />} label="Assinantes ativos" value={String(data.snapshot.assinantesAtivos)} sub="Contas pagantes (atual)" />
        <Kpi icon={<Receipt size={15} />} label="Ticket médio" value={brl(view.ticket)} sub={`No período (${periodo}d)`} accent="var(--accent-amber)" />
        <Kpi icon={<CreditCard size={15} />} label="Pagamentos" value={String(view.count)} sub={`Aprovados em ${periodo}d`} />
      </div>

      {/* ── Receita acumulada ── */}
      <div style={CARD}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
          <TrendingUp size={15} style={{ color: "var(--accent-violet)" }} /> Receita acumulada
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>· últimos {periodo} dias</span>
        </div>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={view.serie} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="gradAcum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-violet)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--accent-violet)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="data" tickFormatter={ddmm} tick={{ fontSize: 10, fill: "var(--text-muted)" }} minTickGap={28} />
              <YAxis tickFormatter={brlCompact} tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={52} />
              <Tooltip contentStyle={TOOLTIP} labelFormatter={(l: any) => ddmm(String(l))} formatter={(v: any) => [brl(Number(v)), "Acumulado"]} />
              <Area type="monotone" dataKey="acumulado" stroke="var(--accent-violet)" strokeWidth={2.5} fill="url(#gradAcum)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── por plano (donut) + top orgs (barras) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        <div style={CARD}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
            <Wallet size={15} style={{ color: "var(--accent-violet)" }} /> Receita por plano
          </div>
          {view.porPlano.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13, padding: 40, textAlign: "center" }}>Sem pagamentos no período.</div>
          ) : (
            <>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={view.porPlano} dataKey="valor" nameKey="nome" innerRadius={56} outerRadius={82} paddingAngle={2} stroke="none">
                      {view.porPlano.map((d) => <Cell key={d.plano} fill={corPlano(d.plano)} />)}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP} formatter={(v: any, n: any) => [brl(Number(v)), n]} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {view.porPlano.map((p) => (
                  <div key={p.plano} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--text-secondary)" }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: corPlano(p.plano) }} />
                      {p.nome}
                      <span style={{ color: "var(--text-muted)" }}>· {p.pagamentos} pag.</span>
                    </span>
                    <span className="metric" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{brl(p.valor)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={CARD}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
            <Crown size={15} style={{ color: "var(--accent-violet)" }} /> Top organizações por receita
          </div>
          {view.topOrgs.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13, padding: 40, textAlign: "center" }}>Sem pagamentos no período.</div>
          ) : (
            <div style={{ height: Math.max(220, view.topOrgs.length * 34) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={view.topOrgs} layout="vertical" margin={{ left: 8, right: 56, top: 4, bottom: 4 }}>
                  <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={brlCompact} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <YAxis type="category" dataKey="org" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} width={150} />
                  <Tooltip contentStyle={TOOLTIP} cursor={{ fill: "var(--bg-hover)" }} formatter={(v: any) => [brl(Number(v)), "Receita"]} />
                  <Bar dataKey="valor" fill="var(--accent-violet)" radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Novos assinantes por mês (histórico, independe do filtro) ── */}
      <div style={CARD}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
          <Users size={15} style={{ color: "var(--accent-cyan)" }} /> Novos assinantes por mês
        </div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.novosClientes} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tickFormatter={mesLabel} tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={30} />
              <Tooltip contentStyle={TOOLTIP} labelFormatter={(l: any) => mesLabel(String(l))} formatter={(v: any) => [`${v}`, "Novos"]} cursor={{ fill: "var(--bg-hover)" }} />
              <Bar dataKey="qtd" fill="var(--accent-cyan)" radius={[5, 5, 0, 0]} maxBarSize={64} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ textAlign: "center", fontSize: 11, color: "var(--text-muted)" }}>
        Atualizado em {new Date(data.geradoEm).toLocaleString("pt-BR")}
      </div>
    </div>
  );
}
