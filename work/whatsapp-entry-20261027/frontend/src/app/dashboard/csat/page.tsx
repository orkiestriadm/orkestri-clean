"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { Star, SmilePlus, Users, BarChart2, MessageSquare, Send, TrendingUp, Download } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import { cn } from "@/lib/utils";

type Avaliacao = {
  id: string; numero: number; titulo: string; avaliacao: number;
  avaliacaoNota: string | null; status: string; atualizadoEm: string;
  atendente: { id: string; nome: string } | null;
  solicitante: { id: string; nome: string };
};

type PorAtendente = { nome: string; total: number; media: number; soma: number };

type Analytics = {
  total: number; media: number; csat: number;
  distribuicao: Record<string, number>;
  porAtendente: PorAtendente[];
  avaliacoes: Avaliacao[];
};

type Pendente = {
  id: string; numero: number; titulo: string; status: string;
  resolvidoEm: string | null; criadoEm: string;
  solicitante: { id: string; nome: string };
  atendente: { id: string; nome: string } | null;
};

function Stars({ value, onChange, size = 20 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => onChange?.(i)}
          onMouseEnter={() => onChange && setHover(i)}
          onMouseLeave={() => onChange && setHover(0)}
          className={cn("transition-colors", onChange ? "cursor-pointer" : "cursor-default")}
        >
          <Star
            size={size}
            className={cn(
              "transition-colors",
              (hover || value) >= i
                ? "text-amber-400 fill-amber-400"
                : "text-muted-foreground/30"
            )}
          />
        </button>
      ))}
    </div>
  );
}

function starLabel(v: number) {
  return ["","Péssimo","Ruim","Regular","Bom","Excelente"][v] || "";
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR");
}

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
}
function todayStr() { return new Date().toISOString().slice(0,10); }

// ── RatingModal ───────────────────────────────────────────────────────────────
function RatingModal({ chamado, onClose, onSaved }: { chamado: Pendente; onClose: () => void; onSaved: () => void }) {
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (nota < 1) { setErr("Selecione uma nota"); return; }
    setSaving(true);
    try {
      await api.post("/csat/" + chamado.id, { nota, comentario });
      onSaved();
    } catch {
      setErr("Erro ao salvar avaliação");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl">
        <div className="p-5 border-b border-border">
          <h2 className="font-semibold text-foreground">Avaliar Atendimento</h2>
          <p className="text-xs text-muted-foreground mt-0.5">#{chamado.numero} — {chamado.titulo}</p>
        </div>
        <div className="p-5 space-y-4">
          {chamado.atendente && (
            <p className="text-xs text-muted-foreground">Atendente: <span className="text-foreground font-medium">{chamado.atendente.nome}</span></p>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-2">Nota *</label>
            <div className="flex items-center gap-3">
              <Stars value={nota} onChange={setNota} size={28} />
              {nota > 0 && <span className="text-sm text-amber-400 font-medium">{starLabel(nota)}</span>}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Comentário (opcional)</label>
            <textarea rows={3} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:border-primary"
              value={comentario} onChange={e => setComentario(e.target.value)} placeholder="O que achou do atendimento?" />
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 p-5 pt-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-border text-muted-foreground hover:bg-accent">Cancelar</button>
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <Send size={13} /> {saving ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CsatScore gauge ───────────────────────────────────────────────────────────
function CsatGauge({ score }: { score: number }) {
  const color = score >= 75 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400";
  const bg    = score >= 75 ? "bg-emerald-400"   : score >= 50 ? "bg-amber-400"   : "bg-red-400";
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn("text-4xl font-black", color)}>{score}%</div>
      <div className="text-xs text-muted-foreground">CSAT Score</div>
      <div className="w-32 h-2 bg-border rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", bg)} style={{ width: `${score}%` }} />
      </div>
      <div className="text-[10px] text-muted-foreground">% de avaliações ≥ 4 estrelas</div>
    </div>
  );
}

// ── Distribuição ──────────────────────────────────────────────────────────────
function Distribuicao({ dist, total }: { dist: Record<string, number>; total: number }) {
  return (
    <div className="space-y-2">
      {[5,4,3,2,1].map(n => {
        const count = dist[n] || 0;
        const pct   = total > 0 ? (count / total) * 100 : 0;
        const color = n >= 4 ? "bg-emerald-400" : n === 3 ? "bg-amber-400" : "bg-red-400";
        return (
          <div key={n} className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 w-20 flex-shrink-0">
              {[1,2,3,4,5].map(i => (
                <Star key={i} size={10} className={i <= n ? "text-amber-400 fill-amber-400" : "text-muted-foreground/20"} />
              ))}
            </div>
            <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground w-12 text-right">{count} ({pct.toFixed(0)}%)</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type NpsData = { total: number; nps: number; promotores: number; neutros: number; detratores: number; promotoresPct: number; neutrosPct: number; detratorPct: number };
type TrendItem = { label: string; csat: number | null; media: number | null; nps: number | null; total: number };

function MiniBarChart({ data, height = 80 }: { data: TrendItem[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(e => setW(e[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const pL = 8; const pR = 8; const pT = 8; const pB = 20;
  const iW = Math.max(w - pL - pR, 1);
  const iH = height - pT - pB;
  const maxV = Math.max(...data.map(d => d.csat ?? 0), 1);
  const bW = Math.max(4, (iW / data.length) * 0.6);
  if (!w) return <div ref={ref} style={{ height }} />;
  return (
    <div ref={ref}>
      <svg width={w} height={height}>
        {data.map((d, i) => {
          const v = d.csat ?? 0;
          const bH = Math.max(2, (v / maxV) * iH);
          const x = pL + (i / data.length) * iW + (iW / data.length - bW) / 2;
          const y = pT + iH - bH;
          const color = v >= 75 ? "#34d399" : v >= 50 ? "#fbbf24" : v > 0 ? "#f87171" : "#334155";
          return (
            <g key={i}>
              <rect x={x} y={y} width={bW} height={bH} rx={2} fill={color} opacity={0.85} />
              <text x={x + bW/2} y={height - 4} textAnchor="middle" fontSize={8} fill="var(--muted-foreground)" fontFamily="monospace">{d.label}</text>
              {v > 0 && <text x={x + bW/2} y={y - 3} textAnchor="middle" fontSize={8} fill="var(--muted-foreground)" fontFamily="monospace">{v}%</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function CsatPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [nps,       setNps]       = useState<NpsData | null>(null);
  const [trend,     setTrend]     = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(monthStart);
  const [to,   setTo]   = useState(todayStr);
  const [activeTab, setActiveTab] = useState<"analytics"|"avaliacoes"|"pendentes">("analytics");
  const [rating, setRating] = useState<Pendente | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, pRes, npsRes, trendRes] = await Promise.all([
        api.get(`/csat?from=${from}&to=${to}`),
        api.get("/csat/pendentes?limit=50"),
        api.get(`/csat/nps?from=${from}&to=${to}`),
        api.get("/csat/trend?semanas=8"),
      ]);
      setAnalytics(aRes.data);
      setPendentes(pRes.data || []);
      setNps(npsRes.data);
      setTrend(trendRes.data || []);
    } catch {
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  function exportCsv() {
    window.open(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/csat/export?from=${from}&to=${to}`, "_blank");
  }

  useEffect(() => { load(); }, [load]);

  const tabs = [
    { key: "analytics",  label: "Dashboard",   icon: BarChart2 },
    { key: "avaliacoes", label: "Avaliações",   icon: Star },
    { key: "pendentes",  label: "Pendentes",    icon: MessageSquare },
  ] as const;

  return (
    <div className="flex flex-col h-full bg-background">
      <Topbar>
        {pendentes.length > 0 && (
          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs px-3 py-1.5 rounded-full font-medium">
            {pendentes.length} chamado{pendentes.length !== 1 ? "s" : ""} aguardando avaliação
          </span>
        )}
        <button onClick={exportCsv}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:bg-accent transition-colors">
          <Download size={12} /> Exportar CSV
        </button>
      </Topbar>
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">De</label>
          <input type="date" className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary"
            value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">Até</label>
          <input type="date" className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary"
            value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex border-b border-border">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={cn("flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors",
                activeTab === t.key
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50")}>
              <t.icon size={14} /> {t.label}
              {t.key === "pendentes" && pendentes.length > 0 && (
                <span className="bg-amber-400 text-black text-[10px] font-bold px-1.5 rounded-full">{pendentes.length}</span>
              )}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Carregando...</div>
        )}

        {!loading && analytics && (
          <>
            {/* ── Analytics Tab ── */}
            {activeTab === "analytics" && (
              <div className="p-6">
                {analytics.total === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                    <Star size={32} className="opacity-30" />
                    <p className="text-sm">Nenhuma avaliação no período</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Top stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* CSAT gauge */}
                      <div className="bg-accent/30 rounded-xl p-6 flex items-center justify-center border border-border">
                        <CsatGauge score={analytics.csat} />
                      </div>
                      {/* Média + total */}
                      <div className="bg-accent/30 rounded-xl p-6 border border-border flex flex-col justify-between">
                        <div>
                          <div className="text-4xl font-black text-amber-400">{analytics.media.toFixed(1)}</div>
                          <div className="text-xs text-muted-foreground mt-1">Nota média</div>
                          <div className="mt-3">
                            <Stars value={Math.round(analytics.media)} size={18} />
                          </div>
                        </div>
                        <div className="mt-4 text-xs text-muted-foreground">
                          Baseado em <span className="text-foreground font-medium">{analytics.total}</span> avaliação{analytics.total !== 1 ? "ões" : ""}
                        </div>
                      </div>
                      {/* Distribuição */}
                      <div className="bg-accent/30 rounded-xl p-6 border border-border">
                        <div className="text-xs font-medium text-muted-foreground mb-3">Distribuição</div>
                        <Distribuicao dist={analytics.distribuicao} total={analytics.total} />
                      </div>
                    </div>

                    {/* NPS + Tendência */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {nps && nps.total > 0 && (
                        <div className="rounded-xl border border-border bg-accent/20 p-5">
                          <div className="flex items-center gap-2 mb-4">
                            <TrendingUp size={14} className="text-primary" />
                            <span className="text-sm font-medium text-foreground">NPS (Net Promoter Score)</span>
                          </div>
                          <div className={cn("text-4xl font-black mb-1", nps.nps >= 50 ? "text-emerald-400" : nps.nps >= 0 ? "text-amber-400" : "text-red-400")}>
                            {nps.nps > 0 ? "+" : ""}{nps.nps}
                          </div>
                          <div className="text-xs text-muted-foreground mb-4">
                            {nps.nps >= 75 ? "Excelente" : nps.nps >= 50 ? "Ótimo" : nps.nps >= 0 ? "Bom" : "Precisa melhorar"}
                          </div>
                          <div className="space-y-2">
                            {[
                              { label: "Promotores (4-5★)", pct: nps.promotoresPct, count: nps.promotores, color: "bg-emerald-500" },
                              { label: "Neutros (3★)",      pct: nps.neutrosPct,    count: nps.neutros,    color: "bg-amber-500" },
                              { label: "Detratores (1-2★)", pct: nps.detratorPct,   count: nps.detratores, color: "bg-red-500" },
                            ].map(row => (
                              <div key={row.label}>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-muted-foreground">{row.label}</span>
                                  <span className="font-mono">{row.pct}% ({row.count})</span>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div className={cn("h-full rounded-full", row.color)} style={{ width: `${row.pct}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {trend.length > 0 && (
                        <div className="rounded-xl border border-border bg-accent/20 p-5">
                          <div className="text-sm font-medium text-foreground mb-1">Tendência de CSAT</div>
                          <div className="text-xs text-muted-foreground mb-4">% de avaliações ≥ 4★ por semana</div>
                          <MiniBarChart data={trend} height={100} />
                        </div>
                      )}
                    </div>

                    {/* Por atendente */}
                    {analytics.porAtendente.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Users size={14} className="text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">Por Atendente</span>
                        </div>
                        <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                          {analytics.porAtendente.map((a, i) => (
                            <div key={a.nome} className="flex items-center gap-4 px-4 py-3">
                              <span className="text-xs text-muted-foreground w-4">{i+1}</span>
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                                {a.nome.charAt(0)}
                              </div>
                              <span className="flex-1 text-sm text-foreground">{a.nome}</span>
                              <Stars value={Math.round(a.media)} size={13} />
                              <span className="text-sm font-bold text-amber-400 w-8 text-right">{a.media.toFixed(1)}</span>
                              <span className="text-xs text-muted-foreground w-16 text-right">{a.total} aval.</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Avaliações Tab ── */}
            {activeTab === "avaliacoes" && (
              <div className="divide-y divide-border">
                {analytics.avaliacoes.length === 0 && (
                  <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Nenhuma avaliação no período</div>
                )}
                {analytics.avaliacoes.map((av: Avaliacao) => (
                  <div key={av.id} className="flex items-start gap-4 px-5 py-4 hover:bg-accent/20">
                    <div className="flex-shrink-0 mt-0.5">
                      <Stars value={av.avaliacao} size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-primary">#{av.numero}</span>
                        <span className="text-sm font-medium text-foreground truncate">{av.titulo}</span>
                      </div>
                      {av.avaliacaoNota && (
                        <p className="text-xs text-muted-foreground mt-1 italic">"{av.avaliacaoNota}"</p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        {av.atendente && <span className="text-[10px] text-muted-foreground">Atendente: {av.atendente.nome}</span>}
                        <span className="text-[10px] text-muted-foreground">Por: {av.solicitante.nome}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className={cn("text-lg font-bold",
                        av.avaliacao >= 4 ? "text-emerald-400" : av.avaliacao === 3 ? "text-amber-400" : "text-red-400")}>
                        {av.avaliacao}★
                      </span>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(av.atualizadoEm)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Pendentes Tab ── */}
            {activeTab === "pendentes" && (
              <div className="divide-y divide-border">
                {pendentes.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                    <SmilePlus size={28} className="opacity-30" />
                    <p className="text-sm">Todos os chamados já foram avaliados</p>
                  </div>
                )}
                {pendentes.map(p => (
                  <div key={p.id} className="flex items-center gap-4 px-5 py-3 hover:bg-accent/20">
                    <span className="text-xs font-mono text-primary flex-shrink-0">#{p.numero}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{p.titulo}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {p.atendente ? `Atendente: ${p.atendente.nome} · ` : ""}
                        Resolvido em {fmtDate(p.resolvidoEm || p.criadoEm)}
                      </div>
                    </div>
                    <button onClick={() => setRating(p)}
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20">
                      <Star size={12} /> Avaliar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {rating && (
        <RatingModal
          chamado={rating}
          onClose={() => setRating(null)}
          onSaved={() => { setRating(null); load(); }}
        />
      )}
    </div>
    </div>
  );
}
