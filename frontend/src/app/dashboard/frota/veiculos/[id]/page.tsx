"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Badge, fmtDate, fmtMoney } from "../../_components/crud";
import PneuTree from "../../_components/PneuTree";
import {
  ArrowLeft, Clock, Package as DiscIcon, CalendarDays, Wrench, Users, DollarSign, Plus, X,
} from "lucide-react";

const STATUS: Record<string, { label: string; color: string }> = {
  ativo:      { label: "Ativo", color: "var(--accent-green)" },
  manutencao: { label: "Em manutenção", color: "var(--accent-amber)" },
  inativo:    { label: "Inativo", color: "var(--text-muted)" },
  vendido:    { label: "Vendido", color: "var(--accent-red)" },
  sinistrado: { label: "Sinistrado", color: "var(--accent-red)" },
};
const num = (v: any) => v != null ? Number(v).toLocaleString("pt-BR") : "—";
const hasPerms = (user: any, ...perms: string[]) =>
  user?.isMaster || user?.permissions?.includes("*") || perms.some((p: string) => user?.permissions?.includes(p));

const TL_STYLE: Record<string, { color: string; icon: any }> = {
  cadastro:      { color: "var(--accent-cyan)",   icon: Clock },
  pneu:          { color: "var(--accent-violet, #8b5cf6)", icon: DiscIcon },
  revisao:       { color: "var(--accent-cyan)",   icon: CalendarDays },
  manutencao:    { color: "var(--accent-amber)",  icon: Wrench },
  abastecimento: { color: "var(--accent-green)",  icon: DollarSign },
  documento:     { color: "var(--accent-cyan)",   icon: CalendarDays },
  condutor:      { color: "var(--accent-violet, #8b5cf6)", icon: Users },
  auditoria:     { color: "var(--text-muted)",    icon: Clock },
};

// ── Tabela genérica ─────────────────────────────────────────────────────────────
function MiniTable({ cols, rows, empty }: { cols: { h: string; r: (x: any) => React.ReactNode; align?: string }[]; rows: any[]; empty: string }) {
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              {cols.map(c => <th key={c.h} style={{ textAlign: (c.align as any) || "left", padding: "10px 14px", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", whiteSpace: "nowrap" }}>{c.h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={cols.length} style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>{empty}</td></tr>}
            {rows.map((row, i) => (
              <tr key={row.id || i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                {cols.map(c => <td key={c.h} style={{ padding: "10px 14px", textAlign: (c.align as any) || "left", verticalAlign: "middle" }}>{c.r(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Modal: designar condutor ────────────────────────────────────────────────────
function CondutorModal({ veiculoId, kmAtual, onSaved, onClose }: { veiculoId: string; kmAtual?: number; onSaved: () => void; onClose: () => void }) {
  const [motoristas, setMotoristas] = useState<{ id: string; nome: string }[]>([]);
  const [d, setD] = useState<any>({ dataInicio: new Date().toISOString().slice(0, 10), kmInicial: kmAtual });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: any) => setD((p: any) => ({ ...p, [k]: v }));

  useEffect(() => { api.get("/frota/motoristas", { params: { limit: 200 } }).then(r => setMotoristas(r.data?.items || [])).catch(() => {}); }, []);

  const save = async () => {
    if (!d.motoristaId) { setErr("Selecione o condutor"); return; }
    setSaving(true); setErr("");
    try { await api.post("/frota/condutores", { ...d, veiculoId }); onSaved(); }
    catch (e: any) { setErr(e?.response?.data?.message || "Erro ao salvar"); setSaving(false); }
  };

  const L = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div><label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>{label}</label>{children}</div>
  );

  return (
    <div className="modal-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains("modal-overlay")) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 460, display: "flex", flexDirection: "column", gap: 14 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700 }}>Designar condutor</h3>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        {err && <div style={{ fontSize: 12, color: "var(--accent-red)" }}>{err}</div>}
        <L label="CONDUTOR *">
          <select className="input-o" value={d.motoristaId || ""} onChange={e => set("motoristaId", e.target.value)}>
            <option value="">—</option>
            {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </L>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <L label="INÍCIO"><input className="input-o" type="date" value={d.dataInicio || ""} onChange={e => set("dataInicio", e.target.value)} /></L>
          <L label="FIM"><input className="input-o" type="date" value={d.dataFim || ""} onChange={e => set("dataFim", e.target.value || null)} /></L>
          <L label="KM INICIAL"><input className="input-o" type="number" value={d.kmInicial ?? ""} onChange={e => set("kmInicial", e.target.value === "" ? null : Number(e.target.value))} /></L>
          <L label="KM FINAL"><input className="input-o" type="number" value={d.kmFinal ?? ""} onChange={e => set("kmFinal", e.target.value === "" ? null : Number(e.target.value))} /></L>
        </div>
        <L label="MOTIVO"><input className="input-o" value={d.motivo || ""} onChange={e => set("motivo", e.target.value)} placeholder="Ex: rota comercial, substituição..." /></L>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-violet" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Página de detalhe ────────────────────────────────────────────────────────────
const TABS = [
  { id: "timeline", label: "Linha do Tempo", icon: Clock },
  { id: "pneus", label: "Troca de Pneus", icon: DiscIcon },
  { id: "revisoes", label: "Revisões", icon: CalendarDays },
  { id: "manutencoes", label: "Manutenções", icon: Wrench },
  { id: "condutores", label: "Condutores", icon: Users },
  { id: "custos", label: "Custos", icon: DollarSign },
];

export default function VeiculoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [v, setV] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [tree, setTree] = useState<any>(null);
  const [tab, setTab] = useState("timeline");
  const [loading, setLoading] = useState(true);
  const [condutorOpen, setCondutorOpen] = useState(false);
  const canCreate = hasPerms(user, "frota:criar");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, t, tr] = await Promise.all([
        api.get(`/frota/veiculos/${id}`),
        api.get(`/frota/veiculos/${id}/timeline`).catch(() => ({ data: { eventos: [] } })),
        api.get(`/frota/veiculos/${id}/pneus-tree`).catch(() => ({ data: null })),
      ]);
      setV(d.data); setTimeline(t.data?.eventos || []); setTree(tr.data);
    } catch { setV(null); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex flex-col h-full"><Topbar /><main className="flex-1 p-6 text-[var(--text-muted)] text-sm">Carregando...</main></div>;
  if (!v) return <div className="flex flex-col h-full"><Topbar /><main className="flex-1 p-6 text-[var(--text-muted)] text-sm">Veículo não encontrado.</main></div>;

  const st = STATUS[v.status] || { label: v.status, color: "var(--text-muted)" };

  // Custos consolidados
  const custos: { data: any; tipo: string; descricao: string; valor: number }[] = [];
  for (const m of v.manutencoes || []) if (m.custo) custos.push({ data: m.data || m.dataAgendada || m.criadoEm, tipo: "Manutenção", descricao: m.descricao || m.tipo || "", valor: m.custo });
  for (const r of v.revisoes || []) if (r.custo) custos.push({ data: r.dataRealizada || r.dataPrevista || r.criadoEm, tipo: "Revisão", descricao: r.tipo || r.oficina || "", valor: r.custo });
  for (const a of v.abastecimentos || []) if (a.valorTotal) custos.push({ data: a.data, tipo: "Abastecimento", descricao: a.posto || "", valor: a.valorTotal });
  for (const dd of v.documentos || []) if (dd.valor) custos.push({ data: dd.dataEmissao || dd.criadoEm, tipo: `Doc. ${String(dd.tipo).toUpperCase()}`, descricao: dd.numero || "", valor: dd.valor });
  custos.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  const custoTotal = custos.reduce((s, c) => s + c.valor, 0);

  const INFO: [string, any][] = [
    ["Código", v.codigo], ["RENAVAM", v.renavam], ["Chassi", v.chassi],
    ["Marca", v.marca], ["Modelo", v.modelo], ["Ano", [v.anoFabricacao, v.anoModelo].filter(Boolean).join("/")],
    ["Cor", v.cor], ["Tipo", v.tipo], ["Combustível", v.combustivel],
    ["Categoria", v.categoria?.nome], ["Centro de custo", v.centroCusto?.nome], ["Unidade", v.unidade],
    ["Setor", v.setor?.nome], ["Responsável", v.responsavel?.nome], ["Motorista padrão", v.motorista?.nome],
    ["Capacidade tanque", v.capacidadeTanque ? `${v.capacidadeTanque} L` : null],
    ["Hodômetro", `${num(v.kmAtual)} km`],
    ["Aquisição", fmtDate(v.dataAquisicao)], ["Valor", fmtMoney(v.valorAquisicao)],
  ];

  return (
    <div className="flex flex-col h-full">
      <Topbar>
        {canCreate && tab === "condutores" && (
          <button className="btn btn-violet text-xs" onClick={() => setCondutorOpen(true)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Designar condutor
          </button>
        )}
      </Topbar>

      <main className="flex-1 overflow-y-auto p-6">
        <button className="btn btn-ghost text-xs" onClick={() => router.push("/dashboard/frota/veiculos")} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <ArrowLeft size={14} /> Voltar
        </button>

        {/* Header */}
        <div className="card" style={{ padding: "20px 24px", marginBottom: 18, borderLeft: `3px solid ${st.color}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-display)" }}>{v.placa}</h2>
            <Badge color={st.color}>{st.label}</Badge>
            {v.categoria && <Badge color={v.categoria.cor}>{v.categoria.nome}</Badge>}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 16 }}>
            {v.codigo} · {[v.marca, v.modelo].filter(Boolean).join(" ")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            {INFO.filter(([, val]) => val).map(([k, val]) => (
              <div key={k}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap", borderBottom: "1px solid var(--border-subtle)" }}>
          {TABS.map(t => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 13, fontWeight: active ? 700 : 500,
                  color: active ? "var(--text-primary)" : "var(--text-muted)", borderBottom: active ? "2px solid var(--accent-violet, #8b5cf6)" : "2px solid transparent", background: "none" }}>
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Conteúdo das abas */}
        {tab === "timeline" && (
          <div style={{ position: "relative", paddingLeft: 8 }}>
            {timeline.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Sem eventos.</div>}
            {timeline.map((e, i) => {
              const s = TL_STYLE[e.tipo] || TL_STYLE.auditoria;
              const Icon = s.icon;
              return (
                <div key={i} style={{ display: "flex", gap: 12, paddingBottom: 18, position: "relative" }}>
                  {i < timeline.length - 1 && <div style={{ position: "absolute", left: 13, top: 28, bottom: 0, width: 2, background: "var(--border-subtle)" }} />}
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: s.color + "20", border: `1px solid ${s.color}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 1 }}>
                    <Icon size={14} style={{ color: s.color }} />
                  </div>
                  <div className="card" style={{ flex: 1, padding: "10px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{e.titulo}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>{fmtDate(e.data)}</span>
                    </div>
                    {e.descricao && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{e.descricao}</div>}
                    {e.valor != null && <div style={{ fontSize: 12, color: "var(--accent-amber)", marginTop: 2, fontWeight: 600 }}>{fmtMoney(e.valor)}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "pneus" && (
          <>
            {tree?.posicoes?.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600, marginBottom: 8 }}>POSIÇÃO DOS PNEUS</div>
                <PneuTree posicoes={tree.posicoes} pneus={tree.pneus || []} />
              </div>
            )}
            <MiniTable empty="Nenhum pneu registrado." rows={v.pneus || []} cols={[
              { h: "Nº Fogo / Código", r: (p) => p.numeroFogo || p.codigo || "—" },
              { h: "Marca/Medida", r: (p) => [p.marca, p.medida].filter(Boolean).join(" · ") || "—" },
              { h: "Posição", r: (p) => p.posicao || "—" },
              { h: "Instalação", r: (p) => fmtDate(p.dataInstalacao) },
              { h: "KM inst.", align: "right", r: (p) => num(p.kmInstalacao) },
              { h: "Status", r: (p) => <Badge>{p.status}</Badge> },
            ]} />
          </>
        )}

        {tab === "revisoes" && (
          <MiniTable empty="Nenhuma revisão registrada." rows={v.revisoes || []} cols={[
            { h: "Tipo", r: (x) => x.tipo || "—" },
            { h: "Prevista", r: (x) => fmtDate(x.dataPrevista) },
            { h: "Realizada", r: (x) => fmtDate(x.dataRealizada) },
            { h: "Custo", align: "right", r: (x) => fmtMoney(x.custo) },
            { h: "Status", r: (x) => <Badge>{x.status}</Badge> },
          ]} />
        )}

        {tab === "manutencoes" && (
          <MiniTable empty="Nenhuma manutenção registrada." rows={v.manutencoes || []} cols={[
            { h: "Tipo", r: (x) => x.tipo || "—" },
            { h: "Descrição", r: (x) => x.descricao || "—" },
            { h: "Data", r: (x) => fmtDate(x.data || x.dataAgendada) },
            { h: "Custo", align: "right", r: (x) => fmtMoney(x.custo) },
            { h: "Status", r: (x) => <Badge>{x.status}</Badge> },
          ]} />
        )}

        {tab === "condutores" && (
          <MiniTable empty="Nenhum condutor registrado." rows={v.condutores || []} cols={[
            { h: "Condutor", r: (x) => x.motorista?.nome || "—" },
            { h: "Início", r: (x) => fmtDate(x.dataInicio) },
            { h: "Fim", r: (x) => fmtDate(x.dataFim) },
            { h: "KM", align: "right", r: (x) => `${num(x.kmInicial)} → ${num(x.kmFinal)}` },
            { h: "Motivo", r: (x) => x.motivo || "—" },
          ]} />
        )}

        {tab === "custos" && (
          <>
            <div className="card" style={{ padding: "14px 18px", marginBottom: 14, borderLeft: "3px solid var(--accent-amber)", display: "inline-block" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>CUSTO TOTAL ACUMULADO</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--accent-amber)" }}>{fmtMoney(custoTotal)}</div>
            </div>
            <MiniTable empty="Nenhum custo registrado." rows={custos} cols={[
              { h: "Data", r: (x) => fmtDate(x.data) },
              { h: "Tipo", r: (x) => <Badge color="var(--accent-amber)">{x.tipo}</Badge> },
              { h: "Descrição", r: (x) => x.descricao || "—" },
              { h: "Valor", align: "right", r: (x) => <span style={{ fontWeight: 600 }}>{fmtMoney(x.valor)}</span> },
            ]} />
          </>
        )}
      </main>

      {condutorOpen && <CondutorModal veiculoId={v.id} kmAtual={v.kmAtual} onSaved={() => { setCondutorOpen(false); load(); }} onClose={() => setCondutorOpen(false)} />}
    </div>
  );
}
