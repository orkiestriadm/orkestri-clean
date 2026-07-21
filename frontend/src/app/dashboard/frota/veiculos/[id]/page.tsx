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
  ArrowLeft, Clock, Package as DiscIcon, CalendarDays, Wrench, Users, DollarSign, Plus, X, RefreshCw,
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

const TL_STYLE: Record<string, { color: string; bg: string; icon: any }> = {
  cadastro:      { color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-50 border-cyan-200 dark:bg-cyan-500/10 dark:border-cyan-500/20", icon: Clock },
  pneu:          { color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/20", icon: DiscIcon },
  revisao:       { color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-50 border-cyan-200 dark:bg-cyan-500/10 dark:border-cyan-500/20", icon: CalendarDays },
  manutencao:    { color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20", icon: Wrench },
  abastecimento: { color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20", icon: DollarSign },
  documento:     { color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-50 border-cyan-200 dark:bg-cyan-500/10 dark:border-cyan-500/20", icon: CalendarDays },
  condutor:      { color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/20", icon: Users },
  auditoria:     { color: "text-slate-500 dark:text-slate-400", bg: "bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700", icon: Clock },
};

// ── Tabela genérica ─────────────────────────────────────────────────────────────
function MiniTable({ cols, rows, empty }: { cols: { h: string; r: (x: any) => React.ReactNode; align?: string }[]; rows: any[]; empty: string }) {
  return (
    <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
              {cols.map(c => (
                <th key={c.h} className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider" style={{ textAlign: (c.align as any) || "left" }}>
                  {c.h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {rows.length === 0 && (
              <tr>
                <td colSpan={cols.length} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 font-medium text-sm">
                  {empty}
                </td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr key={row.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                {cols.map(c => (
                  <td key={c.h} className="px-6 py-4 font-medium text-slate-600 dark:text-slate-300" style={{ textAlign: (c.align as any) || "left" }}>
                    {c.r(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Componentes de Formulário Modernos ──────────────────────────────────────────
const InputField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-[11px] font-medium text-slate-500 mb-1.5 block uppercase tracking-wider">{label}</label>
    {children}
  </div>
);

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

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 transition-all" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Designar Condutor</h3>
          <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" onClick={onClose}><X size={18} /></button>
        </div>
        
        <div className="p-6 flex flex-col gap-5">
          {err && <div className="text-xs font-medium text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-xl">{err}</div>}
          
          <InputField label="Condutor *">
            <select className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all" value={d.motoristaId || ""} onChange={e => set("motoristaId", e.target.value)}>
              <option value="">—</option>
              {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </InputField>
          
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Início">
              <input className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all" type="date" value={d.dataInicio || ""} onChange={e => set("dataInicio", e.target.value)} />
            </InputField>
            <InputField label="Fim">
              <input className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all" type="date" value={d.dataFim || ""} onChange={e => set("dataFim", e.target.value || null)} />
            </InputField>
            <InputField label="KM Inicial">
              <input className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all" type="number" value={d.kmInicial ?? ""} onChange={e => set("kmInicial", e.target.value === "" ? null : Number(e.target.value))} />
            </InputField>
            <InputField label="KM Final">
              <input className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all" type="number" value={d.kmFinal ?? ""} onChange={e => set("kmFinal", e.target.value === "" ? null : Number(e.target.value))} />
            </InputField>
          </div>
          
          <InputField label="Motivo">
            <input className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all" value={d.motivo || ""} onChange={e => set("motivo", e.target.value)} placeholder="Ex: rota comercial, substituição..." />
          </InputField>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3 rounded-b-2xl">
          <button className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors" onClick={onClose}>Cancelar</button>
          <button className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 dark:shadow-none transition-all disabled:opacity-70 disabled:cursor-not-allowed" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Atualizar KM ──────────────────────────────────────────────────────────
function KmModal({ veiculoId, kmAtual, ultimoAbastKm, onSaved, onClose }: { veiculoId: string; kmAtual?: number | null; ultimoAbastKm?: number | null; onSaved: () => void; onClose: () => void }) {
  const [km, setKm] = useState<number | "">(ultimoAbastKm ?? kmAtual ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const fmt = (n?: number | null) => n != null ? n.toLocaleString("pt-BR") : "—";

  const puxar = () => {
    setErr(""); setMsg("");
    if (ultimoAbastKm != null) { setKm(ultimoAbastKm); setMsg(`Puxado do abastecimento: ${fmt(ultimoAbastKm)} km`); }
    else setErr("Nenhum abastecimento com KM registrado para este veiculo.");
  };
  const salvar = async () => {
    if (km === "" || isNaN(Number(km))) { setErr("Informe um KM valido"); return; }
    setSaving(true); setErr("");
    try { await api.post(`/frota/veiculos/${veiculoId}/atualizar-km`, { km: Math.trunc(Number(km)) }); onSaved(); }
    catch (e: any) { setErr(e?.response?.data?.message || "Erro ao atualizar"); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 transition-all" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Atualizar KM Atual</h3>
          <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" onClick={onClose}><X size={18} /></button>
        </div>
        
        <div className="p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Hodômetro atual</span>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{fmt(kmAtual)} km</span>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-800 mx-4"></div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Últ. Abastecimento</span>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{fmt(ultimoAbastKm)} km</span>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-500 mb-1.5 block uppercase tracking-wider">Novo KM Atual</label>
            <div className="flex gap-2">
              <input className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all" type="number" value={km} onChange={e => setKm(e.target.value === "" ? "" : Number(e.target.value))} autoFocus />
              <button className="px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5" onClick={puxar}>
                <RefreshCw size={12} /> Puxar
              </button>
            </div>
          </div>
          
          {msg && <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-xl">{msg}</div>}
          {err && <div className="text-xs font-medium text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-xl">{err}</div>}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3 rounded-b-2xl">
          <button className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors" onClick={onClose}>Cancelar</button>
          <button className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 dark:shadow-none transition-all disabled:opacity-70 disabled:cursor-not-allowed" onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar KM"}</button>
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
  const [kmOpen, setKmOpen] = useState(false);
  const canCreate = hasPerms(user, "frota:criar");
  const canEdit = hasPerms(user, "frota:editar");

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

  if (loading) return <div className="flex flex-col h-full bg-[var(--bg-primary)]"><Topbar /><main className="flex-1 p-6 text-slate-500 text-sm flex items-center justify-center font-medium animate-pulse">Carregando informações...</main></div>;
  if (!v) return <div className="flex flex-col h-full bg-[var(--bg-primary)]"><Topbar /><main className="flex-1 p-6 text-slate-500 text-sm flex items-center justify-center font-medium">Veículo não encontrado.</main></div>;

  const st = STATUS[v.status] || { label: v.status, color: "var(--text-muted)" };
  // Maior KM lançado nos abastecimentos deste veículo (para o modal "Atualizar KM")
  const ultimoAbastKm: number | null = (v.abastecimentos || []).reduce(
    (mx: number | null, a: any) => (a.kmAtual != null && (mx == null || a.kmAtual > mx) ? a.kmAtual : mx), null);

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
    ["Marca", v.marca], ["Modelo", v.modelo], ["Descrição", v.descricao], ["Ano", [v.anoFabricacao, v.anoModelo].filter(Boolean).join("/")],
    ["Cor", v.cor], ["Tipo", v.tipo], ["Combustível", v.combustivel],
    ["Categoria", v.categoria?.nome], ["Centro de custo", v.centroCusto?.nome], ["Unidade", v.unidade],
    ["Setor", v.setor?.nome], ["Responsável", v.responsavel?.nome], ["Motorista padrão", v.motorista?.nome],
    ["Capacidade tanque", v.capacidadeTanque ? `${v.capacidadeTanque} L` : null],
    ["Hodômetro", `${num(v.kmAtual)} km`],
    ["Aquisição", fmtDate(v.dataAquisicao)], ["Valor", fmtMoney(v.valorAquisicao)],
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[var(--bg-primary)] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Topbar>
        {canEdit && (
          <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl shadow-sm transition-all" onClick={() => setKmOpen(true)}>
            <RefreshCw size={14} className="text-slate-400" /> Atualizar KM
          </button>
        )}
        {canCreate && tab === "condutores" && (
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm shadow-indigo-200 dark:shadow-none transition-all ml-3" onClick={() => setCondutorOpen(true)}>
            <Plus size={14} /> Designar condutor
          </button>
        )}
      </Topbar>

      <main className="flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto w-full">
        <button className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 shadow-sm" onClick={() => router.push("/dashboard/frota/veiculos")}>
          <ArrowLeft size={16} /> Voltar
        </button>

        {/* Header - Veículo */}
        <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 lg:p-8 mb-8 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: st.color }} />
          
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h2 className="text-2xl lg:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase">{v.placa}</h2>
            <Badge color={st.color}>{st.label}</Badge>
            {v.categoria && <Badge color={v.categoria.cor}>{v.categoria.nome}</Badge>}
          </div>
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-8">
            {v.codigo} · {[v.marca, v.modelo].filter(Boolean).join(" ")}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-y-6 gap-x-4">
            {INFO.filter(([, val]) => val).map(([k, val]) => (
              <div key={k} className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{k}</span>
                <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-slate-200 dark:border-slate-800">
          {TABS.map(t => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${active ? "text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 border-transparent hover:border-slate-300 dark:hover:border-slate-700"}`}>
                <Icon size={16} /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Conteúdo das abas */}
        {tab === "timeline" && (
          <div className="relative pl-6 lg:pl-10 pb-8">
            {timeline.length === 0 && <div className="text-slate-500 text-sm font-medium">Nenhum evento registrado.</div>}
            {timeline.map((e, i) => {
              const s = TL_STYLE[e.tipo] || TL_STYLE.auditoria;
              const Icon = s.icon;
              return (
                <div key={i} className="flex gap-6 pb-8 relative group">
                  {i < timeline.length - 1 && <div className="absolute left-[19px] top-10 bottom-0 w-px bg-slate-200 dark:bg-slate-800 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-800 transition-colors" />}
                  
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 border shadow-sm ${s.bg}`}>
                    <Icon size={18} className={s.color} />
                  </div>
                  
                  <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex-1 transition-all group-hover:shadow-md group-hover:border-indigo-200 dark:group-hover:border-indigo-800/50">
                    <div className="flex justify-between items-baseline gap-4 mb-1">
                      <span className="text-[15px] font-bold text-slate-800 dark:text-slate-200">{e.titulo}</span>
                      <span className="text-xs font-medium text-slate-500 whitespace-nowrap">{fmtDate(e.data)}</span>
                    </div>
                    {e.descricao && <div className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed">{e.descricao}</div>}
                    {e.valor != null && <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-3">{fmtMoney(e.valor)}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "pneus" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {tree?.posicoes?.length > 0 && (
              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6">
                <div className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-6">Esquema de Posição dos Pneus</div>
                <PneuTree posicoes={tree.posicoes} pneus={tree.pneus || []} />
              </div>
            )}
            <div>
              <div className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-4 pl-1">Listagem de Pneus</div>
              <MiniTable empty="Nenhum pneu registrado." rows={v.pneus || []} cols={[
                { h: "Nº Fogo / Código", r: (p) => p.numeroFogo || p.codigo || "—" },
                { h: "Marca/Medida", r: (p) => [p.marca, p.medida].filter(Boolean).join(" · ") || "—" },
                { h: "Posição", r: (p) => p.posicao || "—" },
                { h: "Instalação", r: (p) => fmtDate(p.dataInstalacao) },
                { h: "KM inst.", align: "right", r: (p) => num(p.kmInstalacao) },
                { h: "Status", align: "center", r: (p) => <Badge>{p.status}</Badge> },
              ]} />
            </div>
          </div>
        )}

        {tab === "revisoes" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <MiniTable empty="Nenhuma revisão registrada." rows={v.revisoes || []} cols={[
              { h: "Tipo", r: (x) => x.tipo || "—" },
              { h: "Prevista", r: (x) => fmtDate(x.dataPrevista) },
              { h: "Realizada", r: (x) => fmtDate(x.dataRealizada) },
              { h: "Custo", align: "right", r: (x) => fmtMoney(x.custo) },
              { h: "Status", align: "center", r: (x) => <Badge>{x.status}</Badge> },
            ]} />
          </div>
        )}

        {tab === "manutencoes" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <MiniTable empty="Nenhuma manutenção registrada." rows={v.manutencoes || []} cols={[
              { h: "Tipo", r: (x) => x.tipo || "—" },
              { h: "Descrição", r: (x) => x.descricao || "—" },
              { h: "Data", r: (x) => fmtDate(x.data || x.dataAgendada) },
              { h: "Custo", align: "right", r: (x) => fmtMoney(x.custo) },
              { h: "Status", align: "center", r: (x) => <Badge>{x.status}</Badge> },
            ]} />
          </div>
        )}

        {tab === "condutores" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <MiniTable empty="Nenhum condutor registrado." rows={v.condutores || []} cols={[
              { h: "Condutor", r: (x) => <span className="font-semibold text-slate-800 dark:text-slate-200">{x.motorista?.nome || "—"}</span> },
              { h: "Início", r: (x) => fmtDate(x.dataInicio) },
              { h: "Fim", r: (x) => fmtDate(x.dataFim) },
              { h: "KM", align: "right", r: (x) => `${num(x.kmInicial)} → ${num(x.kmFinal)}` },
              { h: "Motivo", r: (x) => <span className="text-slate-500">{x.motivo || "—"}</span> },
            ]} />
          </div>
        )}

        {tab === "custos" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200/50 dark:border-amber-900/50 rounded-2xl p-6 mb-8 inline-block shadow-sm">
              <div className="text-[10px] font-bold text-amber-600/70 dark:text-amber-500/70 tracking-widest uppercase mb-1">Custo Total Acumulado</div>
              <div className="text-3xl font-black text-amber-600 dark:text-amber-500 tracking-tight">{fmtMoney(custoTotal)}</div>
            </div>
            
            <div className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-4 pl-1">Histórico de Custos</div>
            <MiniTable empty="Nenhum custo registrado." rows={custos} cols={[
              { h: "Data", r: (x) => fmtDate(x.data) },
              { h: "Tipo", r: (x) => <Badge color="var(--accent-amber)">{x.tipo}</Badge> },
              { h: "Descrição", r: (x) => <span className="font-medium text-slate-700 dark:text-slate-300">{x.descricao || "—"}</span> },
              { h: "Valor", align: "right", r: (x) => <span className="font-bold text-slate-800 dark:text-slate-200">{fmtMoney(x.valor)}</span> },
            ]} />
          </div>
        )}
      </main>

      {condutorOpen && <CondutorModal veiculoId={v.id} kmAtual={v.kmAtual} onSaved={() => { setCondutorOpen(false); load(); }} onClose={() => setCondutorOpen(false)} />}
      {kmOpen && <KmModal veiculoId={v.id} kmAtual={v.kmAtual} ultimoAbastKm={ultimoAbastKm} onSaved={() => { setKmOpen(false); load(); }} onClose={() => setKmOpen(false)} />}
    </div>
  );
}
