"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import {
  ChevronLeft, ChevronRight, Search, Filter, Upload, Download, Plus, Pencil, Trash2,
  X, ChevronUp, ChevronDown, ChevronsLeft, ChevronsRight,
  CheckCircle2, AlertCircle, Clock, Loader2, FileSpreadsheet,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Conta = {
  id: string;
  fornecedorNome: string; fornecedorCodigo?: string;
  numero: string; parcela?: string; tipo: string; natureza?: string;
  dataEmissao?: string; dataVencto?: string; dataVenctoReal?: string; dataPagamento?: string;
  valorOriginal?: number; valorVencidoNominal?: number; valorVencidoCorrigido?: number;
  valorAVencerNominal?: number; valorJuros?: number; valorPago?: number;
  portador?: string; diasAtraso?: number; historico?: string;
  classeValor?: string; observacao?: string; pedido?: string;
  ctaContab?: string; centroCusto?: string;
  status: string; criadoEm: string; importadoEm?: string;
};

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS = {
  pago:     { label: "Pago",     cor: "#16a34a", bg: "rgba(34,197,94,0.12)",  icon: CheckCircle2 },
  vencido:  { label: "Vencido",  cor: "#dc2626", bg: "rgba(239,68,68,0.12)",  icon: AlertCircle  },
  a_vencer: { label: "A Vencer", cor: "#d97706", bg: "rgba(245,158,11,0.12)", icon: Clock        },
};

const TIPOS = ["NF","FT","TX","ISS","INS","RC","COF","PIS","FER","FOL","RES","DM","LC","DP","CS","PD"];

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtD  = (iso?: string) => iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
const fmtR  = (v?: number | null) => v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
const fmtN  = (v?: number | null) => v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "";

// Dias de atraso SEMPRE calculados pela data real de vencimento (o campo importado
// "diasAtraso" da planilha do ERP e um snapshot e fica desatualizado).
const diasAtrasoCalc = (c: { status?: string; dataVenctoReal?: string; dataVencto?: string }): number => {
  if (c.status === "pago") return 0;
  const venc = c.dataVenctoReal || c.dataVencto;
  if (!venc) return 0;
  const vd = new Date(venc); vd.setHours(0, 0, 0, 0);
  const h = new Date(); h.setHours(0, 0, 0, 0);
  const d = Math.round((h.getTime() - vd.getTime()) / 86400000);
  return d > 0 ? d : 0;
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status as keyof typeof STATUS] || STATUS.a_vencer;
  const Icon = s.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, background: s.bg, color: s.cor, fontWeight: 700, fontSize: 11 }}>
      <Icon size={11} /> {s.label}
    </span>
  );
}

// ── XLSX parser (lazy-loaded) ─────────────────────────────────────────────────

async function parseXlsxFile(file: File): Promise<any[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });

  const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes("titulo")) || wb.SheetNames[0];
  if (!sheetName) throw new Error("Planilha sem abas");
  const ws = wb.Sheets[sheetName];

  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][];
  if (raw.length < 2) throw new Error("Planilha sem dados");

  // Encontrar linha com os cabeçalhos reais
  let hIdx = 0;
  for (let i = 0; i < Math.min(raw.length, 5); i++) {
    const row = raw[i] as any[];
    if (row.some((c: any) => String(c || "").toLowerCase().includes("fornecedor") || String(c || "").toLowerCase().includes("numero") || String(c || "").includes("Codigo"))) {
      hIdx = i; break;
    }
  }

  const headers: string[] = (raw[hIdx] as any[]).map((h: any) => String(h || "").replace(/[\r\n]+/g, " ").replace(/_x000D_/g, "").trim());
  const dataRows = raw.slice(hIdx + 1);

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

  const find = (patterns: string[]) => {
    const idx = headers.findIndex(h => patterns.some(p => norm(h).includes(norm(p))));
    return idx >= 0 ? idx : -1;
  };

  const iForneced   = find(["codigo-nome", "fornecedor"]);
  const iNumeroPRF  = find(["prf-numero", "numero", "parcela"]);
  const iTipo       = find(["tp", "tipo"]);
  const iNatureza   = find(["natureza"]);
  const iEmissao    = find(["emissao", "emissão"]);
  const iVencto     = find(["data de", "vencto"]);
  const iVencReal   = find(["vencto real", "real"]);
  const iValOrig    = find(["valor original", "original"]);
  const iVencNom    = find(["vencidos", "nominal"]);
  const iVencCorr   = find(["corrigido"]);
  const iAVencer    = find(["vencer"]);
  const iPortador   = find(["porta", "dor"]);
  const iJuros      = find(["juros", "permanencia", "permanência"]);
  const iDiasAtr    = find(["atraso"]);
  const iHistorico  = find(["historico", "histórico"]);
  const iClasse     = find(["classe"]);
  const iObs        = find(["observa"]);
  const iPedido     = find(["pedido"]);
  const iCta        = find(["cta", "contab"]);
  const iCusto      = find(["custo"]);

  const g = (row: any[], idx: number) => idx >= 0 ? row[idx] : null;
  const fmtDate = (v: any): string | null => {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString();
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  return dataRows
    .filter((row: any[]) => row && row.some((c: any) => c != null && String(c).trim() !== ""))
    .map((row: any[]) => ({
      fornecedorCodNome: g(row, iForneced),
      prfNumeroParcela:  g(row, iNumeroPRF),
      tipo:       g(row, iTipo),
      natureza:   g(row, iNatureza),
      dataEmissao:    fmtDate(g(row, iEmissao)),
      dataVencto:     fmtDate(g(row, iVencto)),
      dataVenctoReal: fmtDate(g(row, iVencReal)),
      valorOriginal:         g(row, iValOrig),
      valorVencidoNominal:   g(row, iVencNom),
      valorVencidoCorrigido: g(row, iVencCorr),
      valorAVencerNominal:   g(row, iAVencer),
      valorJuros:    g(row, iJuros),
      portador:      g(row, iPortador),
      diasAtraso:    g(row, iDiasAtr),
      historico:     g(row, iHistorico),
      classeValor:   g(row, iClasse),
      observacao:    g(row, iObs),
      pedido:        g(row, iPedido),
      ctaContab:     g(row, iCta),
      centroCusto:   g(row, iCusto),
    }));
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ContasAPagarPage() {
  const [rows, setRows]     = useState<Conta[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]   = useState(true);
  const [ordenar, setOrdenar]   = useState("dataVenctoReal");
  const [dir, setDir]           = useState<"asc"|"desc">("asc");

  const [q, setQ]               = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [tipoFiltro, setTipoFiltro]     = useState("");
  const [fornecedorFiltro, setFornecedorFiltro] = useState("");
  const [centroCustoFiltro, setCentroCustoFiltro] = useState("");
  const [inicio, setInicio]     = useState("");
  const [fim, setFim]           = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [editConta, setEditConta]       = useState<Partial<Conta> | null>(null);
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [saving, setSaving]             = useState(false);
  const [payConta, setPayConta]         = useState<Conta | null>(null);
  const [payValor, setPayValor]         = useState("");
  const [payData,  setPayData]          = useState("");
  const [paying,   setPaying]           = useState(false);
  const [showImport, setShowImport]     = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importing, setImporting]       = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/financeiro/contas-a-pagar", {
        params: { page, limit: 50, q: q || undefined, status: statusFiltro || undefined, tipo: tipoFiltro || undefined, fornecedor: fornecedorFiltro || undefined, centroCusto: centroCustoFiltro || undefined, inicio: inicio || undefined, fim: fim || undefined, ordenar, dir },
      });
      setRows(data.rows || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } finally { setLoading(false); }
  }, [page, q, statusFiltro, tipoFiltro, fornecedorFiltro, centroCustoFiltro, inicio, fim, ordenar, dir]);

  useEffect(() => { load(); }, [load]);

  const toggleSort = (col: string) => {
    if (ordenar === col) setDir(d => d === "asc" ? "desc" : "asc");
    else { setOrdenar(col); setDir("asc"); }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (ordenar !== col) return null;
    return dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const handleSave = async () => {
    if (!editConta) return;
    setSaving(true);
    try {
      if (editConta.id) await api.put(`/financeiro/contas-a-pagar/${editConta.id}`, editConta);
      else              await api.post("/financeiro/contas-a-pagar", editConta);
      setEditConta(null); load();
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    await api.delete(`/financeiro/contas-a-pagar/${deletingId}`);
    setDeletingId(null); load();
  };

  // Marcar como pago: abre popup de confirmacao de valor
  const openPagar = (r: Conta) => {
    setPayConta(r);
    setPayValor(String(r.valorOriginal ?? ""));
    setPayData(new Date().toISOString().slice(0, 10));
  };
  const confirmPagar = async () => {
    if (!payConta) return;
    setPaying(true);
    try {
      await api.put(`/financeiro/contas-a-pagar/${payConta.id}`, {
        dataPagamento: payData || new Date().toISOString().slice(0, 10),
        valorPago: Number(payValor) || payConta.valorOriginal || 0,
      });
      setPayConta(null); load();
    } finally { setPaying(false); }
  };
  // Desmarcar (estornar) pagamento
  const estornar = async (r: Conta) => {
    await api.put(`/financeiro/contas-a-pagar/${r.id}`, { dataPagamento: null, valorPago: null });
    load();
  };

  const handleExport = async () => {
    const { data } = await api.get("/financeiro/contas-a-pagar/exportar", {
      params: { q: q || undefined, status: statusFiltro || undefined, tipo: tipoFiltro || undefined, fornecedor: fornecedorFiltro || undefined, centroCusto: centroCustoFiltro || undefined, inicio: inicio || undefined, fim: fim || undefined },
    });
    const blob = new Blob(["﻿" + data.csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "contas_a_pagar.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(true); setImportResult(null);
    try {
      const parsed = await parseXlsxFile(file);
      const { data } = await api.post("/financeiro/contas-a-pagar/importar", { rows: parsed });
      setImportResult(data); load();
    } catch (err: any) {
      setImportResult({ erros: 1, errosDetalhe: [err.message || "Falha na importação"], inseridos: 0, atualizados: 0 });
    } finally { setImporting(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  return (
    <>
      <Topbar />
      <div className="page-content">
        <div style={{ maxWidth: 1600, margin: "0 auto", padding: "20px 24px 60px" }}>

          {/* Breadcrumb */}
          <Link href="/dashboard/financeiro" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 8 }}>
            <ChevronLeft size={14} /> Financeiro
          </Link>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px -6px rgba(99,102,241,.6)" }}>
              <FileSpreadsheet size={20} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Contas a Pagar</h1>
              <p style={{ color: "var(--text-muted)", margin: "2px 0 0", fontSize: 13 }}>
                {total.toLocaleString("pt-BR")} título{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => setShowFilters(s => !s)} className="btn btn-ghost" style={{ fontSize: 12, gap: 6 }}>
                <Filter size={14} /> Filtros
              </button>
              <button onClick={handleExport} className="btn btn-ghost" style={{ fontSize: 12, gap: 6 }}>
                <Download size={14} /> Exportar CSV
              </button>
              <button onClick={() => setShowImport(s => !s)} className="btn btn-ghost" style={{ fontSize: 12, gap: 6 }}>
                <Upload size={14} /> Importar Planilha
              </button>
              <button onClick={() => setEditConta({ tipo: "NF" })} className="btn btn-violet" style={{ fontSize: 12, gap: 6 }}>
                <Plus size={14} /> Novo Título
              </button>
            </div>
          </div>

          {/* Import panel */}
          {showImport && (
            <div className="card-premium" style={{ padding: "18px 20px", marginBottom: 16, borderLeft: "3px solid #6366f1" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <FileSpreadsheet size={20} color="#6366f1" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Importar planilha XLSX</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Selecione o arquivo exportado do ERP (aba "Titulos a pagar"). Registros existentes serão atualizados.</div>
                </div>
                <label className="btn btn-violet" style={{ fontSize: 12, cursor: "pointer", gap: 6 }}>
                  {importing ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Importando…</> : <><Upload size={14} /> Selecionar arquivo</>}
                  <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} style={{ display: "none" }} disabled={importing} />
                </label>
              </div>
              {importResult && (
                <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 10, background: importResult.erros > 0 ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)", border: `1px solid ${importResult.erros > 0 ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}` }}>
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13 }}>
                    <span style={{ color: "#16a34a" }}>✅ Inseridos: <b>{importResult.inseridos}</b></span>
                    <span style={{ color: "#3b82f6" }}>🔄 Atualizados: <b>{importResult.atualizados}</b></span>
                    <span style={{ color: importResult.erros > 0 ? "#dc2626" : "var(--text-muted)" }}>⚠️ Erros: <b>{importResult.erros}</b></span>
                  </div>
                  {importResult.errosDetalhe?.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 11, color: "#dc2626" }}>
                      {importResult.errosDetalhe.slice(0, 5).map((e: string, i: number) => <div key={i}>• {e}</div>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Filters + search */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Pesquisar fornecedor, número, histórico…"
                style={{ width: "100%", padding: "8px 10px 8px 32px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }} />
            </div>
            <select value={statusFiltro} onChange={e => { setStatusFiltro(e.target.value); setPage(1); }} style={selStyle}>
              <option value="">Todos os status</option>
              <option value="a_vencer">A Vencer</option>
              <option value="vencido">Vencidos</option>
              <option value="pago">Pago</option>
            </select>
            <select value={tipoFiltro} onChange={e => { setTipoFiltro(e.target.value); setPage(1); }} style={selStyle}>
              <option value="">Todos os tipos</option>
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {showFilters && (
            <div className="card-premium" style={{ padding: "14px 18px", marginBottom: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              <FilterInput label="Fornecedor"  value={fornecedorFiltro}  onChange={v => { setFornecedorFiltro(v); setPage(1); }} />
              <FilterInput label="C. Custo"    value={centroCustoFiltro} onChange={v => { setCentroCustoFiltro(v); setPage(1); }} />
              <FilterInput label="Venc. início" type="date" value={inicio} onChange={v => { setInicio(v); setPage(1); }} />
              <FilterInput label="Venc. fim"    type="date" value={fim}    onChange={v => { setFim(v); setPage(1); }} />
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button onClick={() => { setFornecedorFiltro(""); setCentroCustoFiltro(""); setInicio(""); setFim(""); setStatusFiltro(""); setTipoFiltro(""); setQ(""); setPage(1); }} className="btn btn-ghost" style={{ fontSize: 12, width: "100%" }}>Limpar filtros</button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="card-premium" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    {[
                      { col: null,             label: "Pago" },
                      { col: "fornecedorNome", label: "Fornecedor" },
                      { col: "numero",          label: "Número/Parc." },
                      { col: "tipo",            label: "Tp" },
                      { col: "dataVenctoReal",  label: "Vencimento" },
                      { col: "valorOriginal",   label: "Valor Original" },
                      { col: null,              label: "Dias Atraso" },
                      { col: null,              label: "Natureza" },
                      { col: null,              label: "C.Custo" },
                      { col: null,              label: "Status" },
                      { col: null,              label: "" },
                    ].map(({ col, label }, i) => (
                      <th key={i} onClick={col ? () => toggleSort(col) : undefined}
                        style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "var(--text-muted)", fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap", cursor: col ? "pointer" : "default", userSelect: "none", background: "var(--bg-secondary)" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                          {label} {col && <SortIcon col={col} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={11} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                      <Loader2 size={20} style={{ animation: "spin 1s linear infinite", display: "inline" }} />
                    </td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={11} style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
                      Nenhum título encontrado
                    </td></tr>
                  ) : rows.map((r) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--border-subtle)", background: r.status === "pago" ? "rgba(34,197,94,0.10)" : undefined, transition: "background 0.2s" }}>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={r.status === "pago"}
                          onChange={() => r.status === "pago" ? estornar(r) : openPagar(r)}
                          title={r.status === "pago" ? "Pago — clique para estornar" : "Marcar como pago"}
                          style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#16a34a" }}
                        />
                      </td>
                      <td style={{ padding: "10px 12px", maxWidth: 260 }}>
                        <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={r.fornecedorNome}>{r.fornecedorNome}</div>
                        {r.fornecedorCodigo && <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{r.fornecedorCodigo}</div>}
                      </td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>{r.numero}</span>
                        {r.parcela && <span style={{ color: "var(--text-muted)", fontSize: 11 }}>-{r.parcela}</span>}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ padding: "2px 7px", borderRadius: 6, background: "var(--bg-secondary)", fontSize: 11, fontWeight: 700 }}>{r.tipo}</span>
                      </td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: r.status === "vencido" ? "#dc2626" : "var(--text-primary)", fontWeight: r.status === "vencido" ? 700 : 400 }}>
                        {fmtD(r.dataVenctoReal || r.dataVencto)}
                        {diasAtrasoCalc(r) > 0 && (
                          <div style={{ fontSize: 10, color: "#dc2626" }}>há {diasAtrasoCalc(r)}d</div>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap", fontWeight: 600, textAlign: "right" }}>{fmtR(r.valorOriginal)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "center", color: diasAtrasoCalc(r) > 0 ? "#dc2626" : "var(--text-muted)" }}>
                        {diasAtrasoCalc(r) > 0 ? diasAtrasoCalc(r) : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--text-muted)", fontSize: 11 }}>{r.natureza || "—"}</td>
                      <td style={{ padding: "10px 12px", color: "var(--text-muted)", fontSize: 11 }}>{r.centroCusto || "—"}</td>
                      <td style={{ padding: "10px 12px" }}><StatusBadge status={r.status} /></td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                        <button onClick={() => setEditConta({ ...r })} className="btn btn-ghost" style={{ padding: "4px 7px", fontSize: 11, marginRight: 4 }}>
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => setDeletingId(r.id)} className="btn btn-ghost" style={{ padding: "4px 7px", fontSize: 11, color: "#dc2626" }}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Página {page} de {totalPages} · {total.toLocaleString("pt-BR")} registros
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setPage(1)} disabled={page === 1} className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 11 }}><ChevronsLeft size={13} /></button>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 11 }}><ChevronLeft size={13} /></button>
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    const pg = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                    return <button key={pg} onClick={() => setPage(pg)} className={`btn ${pg === page ? "btn-violet" : "btn-ghost"}`} style={{ padding: "4px 10px", fontSize: 11, minWidth: 32 }}>{pg}</button>;
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 11 }}><ChevronRight size={13} /></button>
                  <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 11 }}><ChevronsRight size={13} /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editConta !== null && (
        <EditModal conta={editConta} onChange={setEditConta} onSave={handleSave} onClose={() => setEditConta(null)} saving={saving} />
      )}

      {/* Delete confirm */}
      {deletingId && (
        <div onClick={() => setDeletingId(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
          <div onClick={e => e.stopPropagation()} className="card-premium" style={{ padding: 24, maxWidth: 380, width: "100%" }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 10px" }}>Remover título?</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 20px" }}>Esta ação não pode ser desfeita.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setDeletingId(null)} className="btn btn-ghost" style={{ fontSize: 13 }}>Cancelar</button>
              <button onClick={handleDelete} className="btn" style={{ fontSize: 13, background: "#dc2626", color: "#fff" }}>Remover</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de pagamento */}
      {payConta && (
        <div onClick={() => setPayConta(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} className="card-premium" style={{ padding: 24, maxWidth: 420, width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <CheckCircle2 size={20} color="#16a34a" />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Confirmar pagamento</h3>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 16px" }}>
              {payConta.fornecedorNome} · título {payConta.numero}{payConta.parcela ? `-${payConta.parcela}` : ""}
            </p>
            <div style={{ background: "var(--bg-secondary)", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Valor original</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>{fmtR(payConta.valorOriginal)}</div>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Valor pago (R$)</label>
                <input type="number" step="0.01" value={payValor} onChange={e => setPayValor(e.target.value)}
                  style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, fontWeight: 700 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Data do pagamento</label>
                <input type="date" value={payData} onChange={e => setPayData(e.target.value)}
                  style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setPayConta(null)} className="btn btn-ghost" style={{ fontSize: 13 }}>Cancelar</button>
              <button onClick={confirmPagar} disabled={paying} className="btn" style={{ fontSize: 13, background: "#16a34a", color: "#fff", minWidth: 150 }}>
                {paying ? "Confirmando…" : "Confirmar pagamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditModal({ conta, onChange, onSave, onClose, saving }: {
  conta: Partial<Conta>;
  onChange: (c: Partial<Conta>) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  const isNew = !conta.id;
  const set = (k: string, v: any) => onChange({ ...conta, [k]: v });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, overflowY: "auto", padding: "24px 16px" }}>
      <div onClick={e => e.stopPropagation()} className="card-premium" style={{ padding: 24, width: "100%", maxWidth: 740 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>{isNew ? "Novo Título" : "Editar Título"}</h2>
          <button onClick={onClose} className="btn btn-ghost" style={{ marginLeft: "auto", padding: 4 }}><X size={16} /></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <MField label="Fornecedor *" value={conta.fornecedorNome || ""} onChange={v => set("fornecedorNome", v)} />
          </div>
          <MField label="Código Fornecedor"  value={conta.fornecedorCodigo || ""} onChange={v => set("fornecedorCodigo", v)} />
          <MField label="Número *"           value={conta.numero || ""}           onChange={v => set("numero", v)} />
          <MField label="Parcela"            value={conta.parcela || ""}          onChange={v => set("parcela", v)} />
          <div>
            <label style={lblStyle}>Tipo</label>
            <select value={conta.tipo || "NF"} onChange={e => set("tipo", e.target.value)} style={{ ...inputStyle, width: "100%" }}>
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <MField label="Natureza"           value={conta.natureza || ""}    onChange={v => set("natureza", v)} />
          <MField label="Data Emissão"       value={fmtIso(conta.dataEmissao)}   onChange={v => set("dataEmissao", v)} type="date" />
          <MField label="Data Vencimento"    value={fmtIso(conta.dataVencto)}    onChange={v => set("dataVencto", v)} type="date" />
          <MField label="Vencimento Real"    value={fmtIso(conta.dataVenctoReal)} onChange={v => set("dataVenctoReal", v)} type="date" />
          <MField label="Data Pagamento"     value={fmtIso(conta.dataPagamento)} onChange={v => set("dataPagamento", v || null)} type="date" />
          <MField label="Valor Original"     value={conta.valorOriginal ?? ""}    onChange={v => set("valorOriginal", v)} type="number" />
          <MField label="Venc. Nominal"      value={conta.valorVencidoNominal ?? ""} onChange={v => set("valorVencidoNominal", v)} type="number" />
          <MField label="Venc. Corrigido"    value={conta.valorVencidoCorrigido ?? ""} onChange={v => set("valorVencidoCorrigido", v)} type="number" />
          <MField label="A Vencer Nominal"   value={conta.valorAVencerNominal ?? ""} onChange={v => set("valorAVencerNominal", v)} type="number" />
          <MField label="Juros/Permanência"  value={conta.valorJuros ?? ""}      onChange={v => set("valorJuros", v)} type="number" />
          <MField label="Valor Pago"         value={conta.valorPago ?? ""}       onChange={v => set("valorPago", v)} type="number" />
          <MField label="Portador"           value={conta.portador || ""}        onChange={v => set("portador", v)} />
          <MField label="Dias de Atraso"     value={conta.diasAtraso ?? ""}      onChange={v => set("diasAtraso", v)} type="number" />
          <MField label="Pedido"             value={conta.pedido || ""}          onChange={v => set("pedido", v)} />
          <MField label="CtA Contábil"       value={conta.ctaContab || ""}       onChange={v => set("ctaContab", v)} />
          <MField label="Centro de Custo"    value={conta.centroCusto || ""}     onChange={v => set("centroCusto", v)} />
          <MField label="Classe Valor"       value={conta.classeValor || ""}     onChange={v => set("classeValor", v)} />
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={lblStyle}>Histórico</label>
            <textarea value={conta.historico || ""} onChange={e => set("historico", e.target.value)} rows={2}
              style={{ ...inputStyle, width: "100%", resize: "vertical" }} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={lblStyle}>Observação</label>
            <textarea value={conta.observacao || ""} onChange={e => set("observacao", e.target.value)} rows={2}
              style={{ ...inputStyle, width: "100%", resize: "vertical" }} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ fontSize: 13 }}>Cancelar</button>
          <button onClick={onSave} disabled={saving} className="btn btn-violet" style={{ fontSize: 13, minWidth: 120 }}>
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function fmtIso(iso?: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toISOString().split("T")[0]; } catch { return ""; }
}

const inputStyle: React.CSSProperties = {
  padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border-subtle)",
  background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 12.5,
};
const lblStyle: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 };
const selStyle: React.CSSProperties = { ...inputStyle, minWidth: 140 };

function MField({ label, value, onChange, type = "text" }: { label: string; value: any; onChange: (v: any) => void; type?: string }) {
  return (
    <div>
      <label style={lblStyle}>{label}</label>
      <input value={value ?? ""} onChange={e => onChange(e.target.value)} type={type}
        style={{ ...inputStyle, width: "100%" }} />
    </div>
  );
}

function FilterInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label style={lblStyle}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        style={{ ...inputStyle, width: "100%" }} />
    </div>
  );
}

