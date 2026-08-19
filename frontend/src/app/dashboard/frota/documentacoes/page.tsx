"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { FormModal, HistoricoDrawer, CrudConfig, Badge, fmtDate, fmtMoney, Option, Lookups, SourceKey } from "../_components/crud";
import {
  PageBody, BackLink, PageHeader, StatGrid, StatCard,
  Toolbar, SearchInput, SelectFilter, TableCard, RowActions, RowAction, EmptyState, LoadingRows,
} from "../_components/ui";
import { Plus, Pencil, Trash2, Eye, Search, Download, Filter, ChevronLeft, FileText, CheckCircle2, History, X } from "lucide-react";
import CadastrarCrlv from "./_components/CadastrarCrlv";

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



const SOURCE_EP: Record<SourceKey, string> = {
  veiculos:     "/frota/veiculos",
  motoristas:   "/frota/motoristas",
  categorias:   "/frota/categorias",
  setores:      "/setores",
  users:        "/users/picklist",

};
function sourceLabel(key: SourceKey, row: any): string {
  if (key === "veiculos")     return `${row.placa || row.codigo}${row.modelo ? " — " + row.modelo : ""}${row.descricao ? " · " + String(row.descricao).slice(0, 30) : ""}`;
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
  const [lookups, setLookups] = useState<Lookups>({ veiculos: [], motoristas: [], categorias: [], setores: [], users: [] });
  
  const canCreate = hasPerms(user, "frota:criar");
  const canEdit = hasPerms(user, "frota:editar");
  const canDelete = hasPerms(user, "frota:excluir");
  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  useEffect(() => {
    const used = new Set<SourceKey>();
    config.fields.forEach(f => f.source && used.add(f.source));
    used.forEach((key) => {
      api.get(SOURCE_EP[key], { params: { limit: 200 }, silent: true })
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

  const counts = {
    vencido: items.filter(m => getVencimentoGroup(m.dataVencimento) === "vencido").length,
    vence7: items.filter(m => getVencimentoGroup(m.dataVencimento) === "vence7").length,
    vence15: items.filter(m => getVencimentoGroup(m.dataVencimento) === "vence15").length,
    vence30: items.filter(m => getVencimentoGroup(m.dataVencimento) === "vence30").length,
    vence60: items.filter(m => getVencimentoGroup(m.dataVencimento) === "vence60").length,
    vence90: items.filter(m => getVencimentoGroup(m.dataVencimento) === "vence90").length,
    vigentes: items.filter(m => getVencimentoGroup(m.dataVencimento) === "vigentes").length,
    semData: items.filter(m => getVencimentoGroup(m.dataVencimento) === "semData").length,
  };

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
        <PageBody>
          <BackLink href="/dashboard/frota" label="Voltar para o Dashboard de Frota" />

          <PageHeader
            icon={<FileText size={22} />}
            title="Documentações"
            subtitle={<><span className="num">{filteredItems.length}</span> de <span className="num">{items.length}</span> documento(s)</>}
            actions={<>
              <button onClick={exportCSV} className="btn btn-ghost" style={{ fontSize: 12, gap: 6 }}>
                <Download size={14} /> Exportar CSV
              </button>
              {canCreate && (
                <>
                  {/* O CRLV entra pelo caminho proprio -- o PDF e o ponto de
                      partida. O formulario manual segue existindo para seguro,
                      ANTT e o que nao vem de PDF. */}
                  <CadastrarCrlv aoSalvar={load} />
                  <button className="btn btn-ghost" onClick={() => setCreating(true)} style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Plus size={14} /> Novo documento
                  </button>
                </>
              )}
            </>}
          />

          <StatGrid min={144}>
            {[
              { key: "vencido", label: "Vencidos", color: "var(--accent-red)", critical: true },
              { key: "vence7", label: "≤ 7 dias", color: "#ef4444" },
              { key: "vence15", label: "≤ 15 dias", color: "#f97316" },
              { key: "vence30", label: "≤ 30 dias", color: "var(--accent-amber)" },
              { key: "vence60", label: "≤ 60 dias", color: "#ca8a04" },
              { key: "vence90", label: "≤ 90 dias", color: "#a16207" },
              { key: "vigentes", label: "Vigentes", color: "var(--accent-green)" },
              { key: "semData", label: "Sem data", color: "var(--text-muted)" },
            ].map((f, i) => (
              <StatCard
                key={f.key}
                index={i}
                label={f.label}
                value={counts[f.key as keyof typeof counts] || 0}
                color={f.color}
                total={items.length}
                critical={f.critical}
                active={vencFilter === f.key}
                onClick={() => setVencFilter(vencFilter === f.key ? null : f.key)}
              />
            ))}
          </StatGrid>

          <Toolbar>
            <SearchInput value={q} onChange={setQ} placeholder="Pesquisar por documento ou veículo..." />
            <SelectFilter
              value={filterVals["tipo"] || ""}
              onChange={v => setFilterVals(prev => ({ ...prev, tipo: v }))}
              options={TIPO_OPTS}
              placeholder="Tipo: todos"
            />
            <SelectFilter
              value={filterVals["status"] || ""}
              onChange={v => setFilterVals(prev => ({ ...prev, status: v }))}
              options={STATUS_OPTS}
              placeholder="Status: todos"
            />
            {(q || Object.keys(filterVals).length > 0 || vencFilter) && (
              <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => { setQ(""); setFilterVals({}); setVencFilter(null); }}>
                Limpar filtros
              </button>
            )}
          </Toolbar>

          <TableCard>
            <thead>
              <tr>
                {config.columns.map(c => (
                  <th key={c.key} style={c.align === "right" ? { textAlign: "right" } : undefined}>{c.label}</th>
                ))}
                <th style={{ textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody className="stagger">
              {loading && <LoadingRows colSpan={config.columns.length + 1} />}
              {!loading && filteredItems.length === 0 && (
                <EmptyState
                  colSpan={config.columns.length + 1}
                  icon={<FileText size={20} />}
                  title="Nenhum documento encontrado"
                  hint={q || vencFilter || Object.keys(filterVals).length ? "Ajuste a busca ou remova os filtros ativos." : "Cadastre CRLV, seguro, IPVA ou licenciamento para acompanhar os vencimentos."}
                />
              )}
              {!loading && filteredItems.map(row => (
                <tr key={row.id}>
                  {config.columns.map(c => (
                    <td key={c.key} style={c.align === "right" ? { textAlign: "right" } : undefined} className={c.align === "right" ? "num" : undefined}>
                      {c.render ? c.render(row, lookups) : (row[c.key] ?? "—")}
                    </td>
                  ))}
                  <td style={{ textAlign: "right" }}>
                    <RowActions>
                      {config.detailHref && <RowAction tone="view" title="Detalhe" onClick={() => router.push(config.detailHref!(row))}><Eye size={15} /></RowAction>}
                      <RowAction tone="hist" title="Histórico" onClick={() => setHistId(row.id)}><History size={15} /></RowAction>
                      {canEdit && <RowAction tone="edit" title="Editar" onClick={() => setEditing(row)}><Pencil size={15} /></RowAction>}
                      {canDelete && <RowAction tone="danger" title="Excluir" onClick={() => remove(row)}><Trash2 size={15} /></RowAction>}
                    </RowActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        </PageBody>
      </main>

      {(creating || editing) && (
        <FormModal config={config} lookups={lookups} initial={editing}
          onSaved={onSaved} onClose={() => { setCreating(false); setEditing(null); }} />
      )}
      {histId && <HistoricoDrawer tabela={config.tabela} id={histId} onClose={() => setHistId(null)} />}
    </div>
  );
}
