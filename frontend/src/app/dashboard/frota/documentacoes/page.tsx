"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { FormModal, HistoricoDrawer, CrudConfig, Badge, fmtDate, fmtMoney, Option, Lookups, SourceKey } from "../_components/crud";
import { Plus, Pencil, Trash2, Eye, Search, Download, Filter, ChevronLeft, FileText, CheckCircle2, History, X } from "lucide-react";

const STATUS: Record<string, string> = { vigente: "var(--accent-green)", vencido: "var(--accent-red)", cancelado: "var(--text-muted)" };
const STATUS_OPTS = [
  { value: "vigente", label: "Vigente" }, { value: "vencido", label: "Vencido" }, { value: "cancelado", label: "Cancelado" },
];
const TIPO_OPTS = [
  { value: "licenciamento", label: "Licenciamento" }, { value: "seguro", label: "Seguro" }, { value: "antt", label: "ANTT" },
  { value: "tacografo", label: "Tacógrafo" }, { value: "crlv", label: "CRLV" }, { value: "laudo", label: "Laudos" },
  { value: "inspecao", label: "Inspeções" }, { value: "ipva", label: "IPVA" }, { value: "outro", label: "Outro" },
];
const tipoLabel = (t: string) => TIPO_OPTS.find(o => o.value === t)?.label || t;

const hasPerms = (user: any, ...perms: string[]) =>
  user?.isMaster || user?.permissions?.includes("*") || perms.some((p: string) => user?.permissions?.includes(p));

function getVencimentoGroup(d?: string | null) {
  if (!d) return "semData";
  const dias = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  if (dias < 0) return "vencido";
  if (dias <= 7) return "vence7";
  if (dias <= 15) return "vence15";
  if (dias <= 30) return "vence30";
  if (dias <= 60) return "vence60";
  if (dias <= 90) return "vence90";
  return "vigentes";
}

function vencColor(d?: string | null) {
  if (!d) return null;
  const dias = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  if (dias < 0) return "var(--accent-red)";
  if (dias <= 7) return "var(--accent-red)";
  if (dias <= 30) return "var(--accent-amber)";
  if (dias <= 90) return "#eab308";
  return null;
}

const config: CrudConfig = {
  endpoint: "/frota/documentos", tabela: "documentos_veiculo", singular: "documento", plural: "Documentações",
  defaults: { tipo: "licenciamento", status: "vigente" },
  detailHref: r => `/dashboard/frota/documentacoes/${r.id}`,
  filters: [
    { key: "tipo", label: "Tipo", options: TIPO_OPTS },
    { key: "status", label: "Status", options: STATUS_OPTS },
  ],
  columns: [
    { key: "veiculo", label: "Veículo", render: r => <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{r.veiculo?.placa || "—"}</span> },
    { key: "tipo", label: "Tipo", render: r => <Badge color="var(--accent-cyan)">{tipoLabel(r.tipo)}</Badge> },
    { key: "numero", label: "Número", render: r => r.numero || "—" },
    { key: "dataVencimento", label: "Vencimento", render: r => {
      const cor = vencColor(r.dataVencimento);
      return cor ? <Badge color={cor}>{fmtDate(r.dataVencimento)}</Badge> : fmtDate(r.dataVencimento);
    } },
    { key: "valor", label: "Valor", align: "right", render: r => fmtMoney(r.valor) },
    { key: "status", label: "Status", render: r => <Badge color={STATUS[r.status]}>{STATUS_OPTS.find(s => s.value === r.status)?.label || r.status}</Badge> },
  ],
  fields: [
    { key: "veiculoId", label: "Veículo", type: "select", source: "veiculos", required: true },
    { key: "tipo", label: "Tipo", type: "select", options: TIPO_OPTS },
    { key: "numero", label: "Número / Apólice" },
    { key: "descricao", label: "Descrição" },
    { key: "status", label: "Status", type: "select", options: STATUS_OPTS },
    { key: "dataEmissao", label: "Data de emissão", type: "date" },
    { key: "dataVencimento", label: "Data de vencimento", type: "date" },
    { key: "valor", label: "Valor (R$)", type: "number", step: 0.01 },
    { key: "observacoes", label: "Observações", type: "textarea" },
  ],
};

function ModernFilterCard({ label, value, colorClass, textClass, ringClass, active, onClick }: { label: string; value: number; colorClass: string; textClass: string; ringClass: string; active: boolean; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex-1 min-w-[100px] rounded-2xl border transition-all relative overflow-hidden group text-left p-3.5
        ${active ? `ring-2 ring-offset-2 dark:ring-offset-slate-950 border-transparent shadow-md ${ringClass}` : 'border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md'} 
        bg-white dark:bg-slate-950`}
    >
      <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full opacity-10 group-hover:opacity-20 transition-opacity blur-xl ${colorClass}`} />
      
      {active && <CheckCircle2 className={`absolute top-3 right-3 w-4 h-4 ${textClass} opacity-80`} />}

      <div className={`text-2xl font-black tracking-tight mb-0.5 ${active ? textClass : 'text-slate-900 dark:text-white'}`}>
        {value}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {label}
      </div>
    </button>
  );
}

const SOURCE_EP: Record<SourceKey, string> = {
  veiculos:     "/frota/veiculos",
  motoristas:   "/frota/motoristas",
  categorias:   "/frota/categorias",
  setores:      "/setores",
  users:        "/users",
  centrosCusto: "/orcamento/centros-custo",
};
function sourceLabel(key: SourceKey, row: any): string {
  if (key === "veiculos")     return `${row.placa || row.codigo}${row.modelo ? " — " + row.modelo : ""}${row.descricao ? " · " + String(row.descricao).slice(0, 30) : ""}`;
  if (key === "centrosCusto") return `${row.codigo ? row.codigo + " — " : ""}${row.nome}`;
  return row.nome || row.placa || row.id;
}

export default function DocumentacoesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [items, setItems] = useState<any[]>([]);
  const [dash, setDash] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [filterVals, setFilterVals] = useState<Record<string, string>>({});
  const [vencFilter, setVencFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [histId, setHistId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [lookups, setLookups] = useState<Lookups>({ veiculos: [], motoristas: [], categorias: [], setores: [], users: [], centrosCusto: [] });
  
  const canCreate = hasPerms(user, "frota:criar");
  const canEdit = hasPerms(user, "frota:editar");
  const canDelete = hasPerms(user, "frota:excluir");
  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  useEffect(() => {
    const used = new Set<SourceKey>();
    config.fields.forEach(f => f.source && used.add(f.source));
    used.forEach((key) => {
      api.get(SOURCE_EP[key], { params: { limit: 200 } })
        .then(r => {
          const rows = r.data?.items ?? r.data?.users ?? r.data ?? [];
          setLookups(prev => ({ ...prev, [key]: rows.map((row: any) => ({ value: row.id, label: sourceLabel(key, row) })) }));
        })
        .catch(() => {});
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(config.endpoint, { params: { q, limit: 1000, ...filterVals } });
      setItems(data.items || []);
    } catch { setItems([]); } finally { setLoading(false); }
  }, [q, filterVals]);

  const loadDash = useCallback(() => { api.get("/frota/documentos/vencimentos/dashboard").then(r => setDash(r.data)).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadDash(); }, [loadDash]);

  const onSaved = () => { setCreating(false); setEditing(null); load(); loadDash(); showMsg("Documento salvo!"); };
  const remove = async (m: any) => {
    if (!confirm("Excluir este documento? (exclusão lógica)")) return;
    try { await api.delete(`${config.endpoint}/${m.id}`); load(); loadDash(); showMsg("Documento excluído"); }
    catch { showMsg("Erro ao excluir"); }
  };

  const filteredItems = items.filter(m => {
    if (!vencFilter) return true;
    return getVencimentoGroup(m.dataVencimento) === vencFilter;
  });

  const exportCSV = () => {
    if (!filteredItems.length) return;
    const headers = config.columns.map(c => c.label).join(";");
    const rows = filteredItems.map(row => {
      return config.columns.map(c => {
        let val = row[c.key] != null ? String(row[c.key]) : "";
        if (c.key === "veiculo") val = row.veiculo?.placa || "";
        if (c.key === "tipo") val = tipoLabel(row.tipo);
        if (c.key === "dataVencimento") val = row.dataVencimento ? new Date(row.dataVencimento).toLocaleDateString("pt-BR") : "";
        if (c.key === "status") val = STATUS_OPTS.find(s => s.value === row.status)?.label || row.status;
        return `"${val.replace(/"/g, '""')}"`;
      }).join(";");
    });
    const csvContent = "\uFEFF" + [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio-documentacoes-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleVencFilter = (val: string) => {
    setVencFilter(prev => prev === val ? null : val);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Topbar>
        {msg && <span className={`text-xs font-mono ${msg.includes("Erro") ? "text-red-400" : "text-green-400"}`}>{msg}</span>}
      </Topbar>

      <main className="flex-1 overflow-y-auto page-content">
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 24px 60px" }}>
          
          {/* Back link */}
          <Link href="/dashboard/frota" className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white mb-4 transition-colors">
            <ChevronLeft size={14} /> Voltar para o Dashboard de Frota
          </Link>

          {/* Header Row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--accent-violet)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px -6px rgba(99,102,241,0.6)", flexShrink: 0 }}>
              <FileText size={22} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Documentações</h1>
              <p style={{ color: "var(--text-muted)", margin: "2px 0 0", fontSize: 13 }}>
                {filteredItems.length} documento(s) encontrado(s)
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => setShowFilters(s => !s)} className={`btn ${showFilters ? 'btn-violet' : 'btn-ghost'}`} style={{ fontSize: 12, gap: 6 }}>
                <Filter size={14} /> Filtros
              </button>
              <button onClick={exportCSV} className="btn btn-ghost" style={{ fontSize: 12, gap: 6 }}>
                <Download size={14} /> Exportar CSV
              </button>
              {canCreate && (
                <button className="btn btn-violet" onClick={() => setCreating(true)} style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Plus size={14} /> Novo documento
                </button>
              )}
            </div>
          </div>

          {/* Dashboard stats */}
          {dash && (
            <div className="mb-8">
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3 flex items-center justify-between">
                <span>Dashboard de Vencimentos</span>
                {vencFilter && (
                  <button onClick={() => setVencFilter(null)} className="flex items-center gap-1 text-red-500 hover:text-red-600 transition-colors">
                    <X size={12} /> Limpar filtro de vencimento
                  </button>
                )}
              </div>
              <div className="flex gap-3 flex-wrap">
                <ModernFilterCard label="Vencidos" value={dash.vencido} 
                  colorClass="bg-red-500" textClass="text-red-600 dark:text-red-400" ringClass="ring-red-500"
                  active={vencFilter === "vencido"} onClick={() => toggleVencFilter("vencido")} />
                <ModernFilterCard label="≤ 7 dias" value={dash.vence7} 
                  colorClass="bg-red-500" textClass="text-red-600 dark:text-red-400" ringClass="ring-red-500"
                  active={vencFilter === "vence7"} onClick={() => toggleVencFilter("vence7")} />
                <ModernFilterCard label="≤ 15 dias" value={dash.vence15} 
                  colorClass="bg-orange-500" textClass="text-orange-600 dark:text-orange-400" ringClass="ring-orange-500"
                  active={vencFilter === "vence15"} onClick={() => toggleVencFilter("vence15")} />
                <ModernFilterCard label="≤ 30 dias" value={dash.vence30} 
                  colorClass="bg-amber-500" textClass="text-amber-600 dark:text-amber-400" ringClass="ring-amber-500"
                  active={vencFilter === "vence30"} onClick={() => toggleVencFilter("vence30")} />
                <ModernFilterCard label="≤ 60 dias" value={dash.vence60} 
                  colorClass="bg-yellow-500" textClass="text-yellow-600 dark:text-yellow-400" ringClass="ring-yellow-500"
                  active={vencFilter === "vence60"} onClick={() => toggleVencFilter("vence60")} />
                <ModernFilterCard label="≤ 90 dias" value={dash.vence90} 
                  colorClass="bg-yellow-500" textClass="text-yellow-600 dark:text-yellow-400" ringClass="ring-yellow-500"
                  active={vencFilter === "vence90"} onClick={() => toggleVencFilter("vence90")} />
                <ModernFilterCard label="Vigentes" value={dash.vigentes} 
                  colorClass="bg-emerald-500" textClass="text-emerald-600 dark:text-emerald-400" ringClass="ring-emerald-500"
                  active={vencFilter === "vigentes"} onClick={() => toggleVencFilter("vigentes")} />
                <ModernFilterCard label="Sem data" value={dash.semData} 
                  colorClass="bg-slate-400" textClass="text-slate-600 dark:text-slate-400" ringClass="ring-slate-400"
                  active={vencFilter === "semData"} onClick={() => toggleVencFilter("semData")} />
              </div>
            </div>
          )}

          {/* Search + Filter Row */}
          <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-3 mb-5 flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[260px] relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input 
                className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-sm pl-9 pr-3 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all" 
                placeholder="Pesquisar por documento ou veículo..." 
                value={q} 
                onChange={e => setQ(e.target.value)} 
              />
            </div>
            {showFilters && (
              <>
                <select 
                  className="bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-sm px-3 py-2.5 min-w-[160px] focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all" 
                  value={filterVals["tipo"] || ""} 
                  onChange={e => setFilterVals(v => ({ ...v, tipo: e.target.value }))}
                >
                  <option value="">Tipo: todos</option>
                  {TIPO_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <select 
                  className="bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-sm px-3 py-2.5 min-w-[160px] focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all" 
                  value={filterVals["status"] || ""} 
                  onChange={e => setFilterVals(v => ({ ...v, status: e.target.value }))}
                >
                  <option value="">Status: todos</option>
                  {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </>
            )}
          </div>

          {/* Table Card */}
          <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr>
                    {config.columns.map((c) => (
                      <th key={c.key} className={`px-4 py-3.5 font-semibold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 ${c.align === 'right' ? 'text-right' : ''}`}>
                        {c.label}
                      </th>
                    ))}
                    <th className="w-1"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {loading && <tr><td colSpan={config.columns.length + 1} className="px-4 py-8 text-center text-slate-500">Carregando...</td></tr>}
                  {!loading && filteredItems.length === 0 && <tr><td colSpan={config.columns.length + 1} className="px-4 py-8 text-center text-slate-500">Nenhum documento encontrado.</td></tr>}
                  {!loading && filteredItems.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                      {config.columns.map(c => (
                        <td key={c.key} className={`px-4 py-3 ${c.align === 'right' ? 'text-right' : ''}`}>
                          {c.render ? c.render(row, lookups) : (row[c.key] ?? "—")}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          {config.detailHref && <button className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors" title="Detalhe" onClick={() => router.push(config.detailHref!(row))}><Eye size={16} /></button>}
                          <button className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors" title="Histórico" onClick={() => setHistId(row.id)}><History size={16} /></button>
                          {canEdit && <button className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors" title="Editar" onClick={() => setEditing(row)}><Pencil size={16} /></button>}
                          {canDelete && <button className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" title="Excluir" onClick={() => remove(row)}><Trash2 size={16} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {(creating || editing) && (
        <FormModal config={config} lookups={lookups} initial={editing}
          onSaved={onSaved} onClose={() => { setCreating(false); setEditing(null); }} />
      )}
      {histId && <HistoricoDrawer tabela={config.tabela} id={histId} onClose={() => setHistId(null)} />}
    </div>
  );
}
