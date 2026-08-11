"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { FormModal, HistoricoDrawer, CrudConfig, Badge, fmtDate, fmtMoney, Lookups, SourceKey } from "../_components/crud";
import {
  PageBody, BackLink, PageHeader, StatGrid, StatCard,
  Toolbar, SearchInput, TableCard, RowActions, RowAction, EmptyState, LoadingRows,
} from "../_components/ui";
import { Plus, Pencil, Trash2, Eye, Search, Download, ChevronLeft, Wrench, History, Paperclip, CheckCircle2, Activity, Package, X, Filter } from "lucide-react";
import { useToastStore } from "@/lib/toast";

const STATUS: Record<string, string> = {
  aberta: "var(--accent-cyan)", em_andamento: "var(--accent-amber)", aguardando_pecas: "#f97316",
  finalizada: "var(--accent-green)", cancelada: "var(--text-muted)",
};
const STATUS_OPTS = [
  { value: "aberta", label: "Aberta" }, { value: "em_andamento", label: "Em andamento" },
  { value: "aguardando_pecas", label: "Aguardando peças" }, { value: "finalizada", label: "Finalizada" },
  { value: "cancelada", label: "Cancelada" },
];
const TIPO_OPTS = [
  { value: "preventiva", label: "Preventiva" }, { value: "corretiva", label: "Corretiva" }, { value: "emergencial", label: "Emergencial" },
];
const TIPO_COLOR: Record<string, string> = { preventiva: "var(--accent-cyan)", corretiva: "var(--accent-amber)", emergencial: "var(--accent-red)" };

const downloadAnexos = async (id: string) => {
  try {
    const { data } = await api.get(`/frota/manutencoes/${id}/anexos`);
    if (data && data.length > 0) {
      data.forEach((anexo: any) => {
        // `anexo.url` vem da API já como rota autenticada
        // (`/api/frota/manutencoes/.../download`). O caminho `/uploads/...`
        // que existia aqui como reserva servia o arquivo SEM sessão e não
        // existe mais — sem URL da API, não há de onde baixar.
        if (!anexo.url) return;
        let url: string = anexo.url;
        if (url.startsWith("/")) {
          const base = api.defaults.baseURL || "";
          url = base.replace(/\/api\/?$/, "") + url;
        }
        const a = document.createElement("a");
        a.href = url;
        a.download = anexo.nomeOriginal || anexo.nomeArquivo;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
    } else {
      useToastStore.getState().warning("Sem anexos", "Nenhum anexo encontrado para esta manutenção.");
    }
  } catch (e) {
    console.error("Erro ao baixar anexos:", e);
    useToastStore.getState().error("Erro", "Erro ao tentar baixar os anexos.");
  }
};

const config: CrudConfig = {
  endpoint: "/frota/manutencoes", tabela: "manutencoes_veiculo", singular: "ordem de serviço", plural: "Manutenções (OS)",
  defaults: { tipo: "corretiva", status: "aberta", imobiliza: true },
  detailHref: r => `/dashboard/frota/manutencoes/${r.id}`,
  filters: [
    { key: "status", label: "Status", options: STATUS_OPTS },
    { key: "tipo", label: "Tipo", options: TIPO_OPTS },
  ],
  columns: [
    { key: "numeroOs", label: "OS", render: r => <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{r.numeroOs || "—"}</span> },
    { key: "anexos", label: "Anexos", align: "center", render: r => (
      <div className="flex justify-center">
        {r._count?.anexos > 0 ? (
          <button onClick={(e) => { e.stopPropagation(); downloadAnexos(r.id); }} className="hover:opacity-80 transition-opacity outline-none" title="Baixar anexos">
            <Badge color="var(--accent-cyan)"><Download size={12} className="mr-1"/> {r._count.anexos}</Badge>
          </button>
        ) : (
          <span style={{ color: "var(--text-faint)" }} title="Sem anexos">—</span>
        )}
      </div>
    ) },
    { key: "veiculo", label: "Veículo", render: r => r.veiculo?.placa || "—" },
    { key: "tipo", label: "Tipo", render: r => <Badge color={TIPO_COLOR[r.tipo]}>{TIPO_OPTS.find(t => t.value === r.tipo)?.label || r.tipo}</Badge> },
    { key: "solicitante", label: "Solicitante", render: r => r.solicitante?.nome || "—" },
    { key: "dataAbertura", label: "Abertura", render: r => fmtDate(r.dataAbertura) },
    { key: "custo", label: "Custo total", align: "right", render: r => fmtMoney(r.custo) },
    { key: "status", label: "Status", render: r => <Badge color={STATUS[r.status]}>{STATUS_OPTS.find(s => s.value === r.status)?.label || r.status}</Badge> },
  ],
  fields: [
    { key: "numeroOs", label: "Número OS (auto se vazio)", placeholder: "OS-00001" },
    { key: "veiculoId", label: "Veículo", type: "select", source: "veiculos", required: true },
    { key: "tipo", label: "Tipo", type: "select", options: TIPO_OPTS },
    { key: "status", label: "Status", type: "select", options: STATUS_OPTS },
    { key: "solicitanteId", label: "Solicitante", type: "select", source: "users" },
    { key: "oficina", label: "Oficina" },
    { key: "fornecedor", label: "Fornecedor" },
    { key: "dataAbertura", label: "Data de abertura", type: "date" },
    { key: "previsaoLiberacao", label: "Previsão de liberação", type: "date" },
    { key: "dataFechamento", label: "Data de fechamento", type: "date" },
    { key: "localizacao", label: "Localização do veículo", placeholder: "Oficina, base, pátio..." },
    // O que separa "Parado" (vermelho) de "Operando com Avaria" (amarelo) no
    // Farol da Frota. Marcado por padrão = comportamento anterior.
    { key: "imobiliza", label: "Veículo imobilizado (não pode operar)", type: "checkbox" },
    { key: "km", label: "KM", type: "number" },
    { key: "custoPecas", label: "Custo peças (R$)", type: "number", step: 0.01 },
    { key: "custoServicos", label: "Custo serviços (R$)", type: "number", step: 0.01 },
    { key: "custoTerceiros", label: "Custo terceiros (R$)", type: "number", step: 0.01 },
    { key: "descricao", label: "Descrição", full: true },
    { key: "observacoes", label: "Observações", type: "textarea" },
  ],
};

const hasPerms = (user: any, ...perms: string[]) =>
  user?.isMaster || user?.permissions?.includes("*") || perms.some((p: string) => user?.permissions?.includes(p));

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

export default function ManutencoesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [activeFilterStatus, setActiveFilterStatus] = useState("");
  const [activeFilterTipo, setActiveFilterTipo] = useState("");
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
      const { data } = await api.get(config.endpoint, { params: { limit: 1000 } });
      setItems(data.items || []);
    } catch { setItems([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Chegando do Farol da Frota com ?os=<id>, abre a OS clicada já em edição.
  // Lê de `window.location` em vez de useSearchParams para não exigir um
  // limite de Suspense em volta da página inteira.
  useEffect(() => {
    if (!items.length || !canEdit) return;
    const alvo = new URLSearchParams(window.location.search).get("os");
    if (!alvo) return;
    const achado = items.find((m: any) => m.id === alvo);
    if (achado) setEditing(achado);
    // Some com o parâmetro: sem isso o modal reabriria a cada recarga da lista.
    window.history.replaceState({}, "", window.location.pathname);
  }, [items, canEdit]);

  const onSaved = () => { setCreating(false); setEditing(null); load(); showMsg("Registro salvo!"); };
  const remove = async (m: any) => {
    if (!confirm("Excluir este registro? (exclusão lógica)")) return;
    try { await api.delete(`${config.endpoint}/${m.id}`); load(); showMsg("Registro excluído"); }
    catch { showMsg("Erro ao excluir"); }
  };

  const filteredItems = items.filter(m => {
    if (q) {
      const s = `${m.numeroOs} ${m.veiculo?.placa} ${m.solicitante?.nome}`.toLowerCase();
      if (!s.includes(q.toLowerCase())) return false;
    }
    if (activeFilterStatus && m.status !== activeFilterStatus) return false;
    if (activeFilterTipo && m.tipo !== activeFilterTipo) return false;
    return true;
  });

  const counts = {
    aberta: items.filter(m => m.status === "aberta").length,
    em_andamento: items.filter(m => m.status === "em_andamento").length,
    aguardando_pecas: items.filter(m => m.status === "aguardando_pecas").length,
    finalizada: items.filter(m => m.status === "finalizada").length,
    cancelada: items.filter(m => m.status === "cancelada").length,
    preventiva: items.filter(m => m.tipo === "preventiva").length,
    corretiva: items.filter(m => m.tipo === "corretiva").length,
    emergencial: items.filter(m => m.tipo === "emergencial").length,
  };

  const exportCSV = () => {
    if (!filteredItems.length) return;
    const headers = config.columns.map(c => c.label).join(";");
    const rows = filteredItems.map(row => {
      return config.columns.map(c => {
        let val = row[c.key] != null ? String(row[c.key]) : "";
        if (c.key === "veiculo") val = row.veiculo?.placa || "";
        if (c.key === "tipo") val = TIPO_OPTS.find(t => t.value === row.tipo)?.label || row.tipo;
        if (c.key === "solicitante") val = row.solicitante?.nome || "";
        if (c.key === "dataAbertura") val = row.dataAbertura ? new Date(row.dataAbertura).toLocaleDateString("pt-BR") : "";
        if (c.key === "status") val = STATUS_OPTS.find(s => s.value === row.status)?.label || row.status;
        return `"${val.replace(/"/g, '""')}"`;
      }).join(";");
    });
    const csvContent = "\uFEFF" + [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio-manutencoes-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            icon={<Wrench size={22} />}
            title={config.plural}
            subtitle={<><span className="num">{filteredItems.length}</span> de <span className="num">{items.length}</span> ordem(ns) de serviço</>}
            actions={<>
              <button onClick={exportCSV} className="btn btn-ghost" style={{ fontSize: 12, gap: 6 }}>
                <Download size={14} /> Exportar CSV
              </button>
              {canCreate && (
                <button className="btn btn-violet" onClick={() => setCreating(true)} style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Plus size={14} /> Novo registro
                </button>
              )}
            </>}
          />

          <StatGrid>
            {[
              { key: "preventiva", label: "Preventiva", color: "var(--accent-cyan)" },
              { key: "corretiva", label: "Corretiva", color: "var(--accent-amber)" },
              { key: "emergencial", label: "Emergencial", color: "var(--accent-red)", critical: true },
            ].map((f, i) => (
              <StatCard
                key={f.key}
                index={i}
                label={f.label}
                value={counts[f.key as keyof typeof counts] || 0}
                color={f.color}
                total={items.length}
                critical={f.critical}
                active={activeFilterTipo === f.key}
                onClick={() => setActiveFilterTipo(activeFilterTipo === f.key ? "" : f.key)}
              />
            ))}
          </StatGrid>

          <Toolbar>
            <SearchInput value={q} onChange={setQ} placeholder="Pesquisar por ordem de serviço ou veículo..." />
            {(q || activeFilterStatus || activeFilterTipo) && (
              <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => { setQ(""); setActiveFilterStatus(""); setActiveFilterTipo(""); }}>
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
                  icon={<Wrench size={20} />}
                  title="Nenhuma ordem de serviço encontrada"
                  hint={q || activeFilterTipo || activeFilterStatus ? "Ajuste a busca ou remova os filtros ativos." : "Abra a primeira OS para começar."}
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
