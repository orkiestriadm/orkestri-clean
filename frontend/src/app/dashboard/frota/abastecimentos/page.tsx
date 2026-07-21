"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useRef } from "react";
import CrudView, { CrudConfig, Badge, fmtDate, fmtMoney } from "../_components/crud";
import { api } from "@/lib/api";
import { FileText, X, Droplets, DollarSign, Activity, AlertTriangle, TrendingDown } from "lucide-react";

const COMB_OPTS = ["gasolina", "etanol", "diesel", "flex", "gnv"].map(v => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));
const fmtKmL = (v: any) => v != null ? `${Number(v).toLocaleString("pt-BR")} km/L` : "—";
const fmtCustoKm = (v: any) => v != null ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 3 }) : "—";

function ModernCard({ label, value, icon, colorClass, bgClass, textClass }: { label: string; value: string; icon: React.ReactNode; colorClass: string; bgClass: string; textClass: string }) {
  return (
    <div className={`flex-1 min-w-[180px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group`}>
      {/* Background glow effect */}
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity blur-2xl ${colorClass}`} />
      
      <div className="flex justify-between items-start mb-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </div>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bgClass} ${textClass}`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
        {value}
      </div>
    </div>
  );
}

function AnaliseConsumo() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { api.get("/frota/abastecimentos/analise/consumo").then(r => setD(r.data)).catch(() => {}); }, []);
  if (!d) return null;
  const t = d.totais || {};

  return (
    <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-slate-400" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Análise de Consumo</h2>
      </div>
      
      <div className="flex flex-wrap gap-4 mb-6">
        <ModernCard 
          label="Litros" 
          value={`${(t.totalLitros || 0).toLocaleString("pt-BR")} L`} 
          icon={<Droplets className="w-4 h-4" />}
          colorClass="bg-blue-500" bgClass="bg-blue-50 dark:bg-blue-900/20" textClass="text-blue-600 dark:text-blue-400"
        />
        <ModernCard 
          label="Gasto Total" 
          value={fmtMoney(t.totalGasto)} 
          icon={<DollarSign className="w-4 h-4" />}
          colorClass="bg-emerald-500" bgClass="bg-emerald-50 dark:bg-emerald-900/20" textClass="text-emerald-600 dark:text-emerald-400"
        />
        <ModernCard 
          label="Consumo Médio" 
          value={fmtKmL(t.mediaKmL)} 
          icon={<TrendingDown className="w-4 h-4" />}
          colorClass="bg-violet-500" bgClass="bg-violet-50 dark:bg-violet-900/20" textClass="text-violet-600 dark:text-violet-400"
        />
        <ModernCard 
          label="Custo/km Médio" 
          value={fmtCustoKm(t.custoKmMedio)} 
          icon={<Activity className="w-4 h-4" />}
          colorClass="bg-amber-500" bgClass="bg-amber-50 dark:bg-amber-900/20" textClass="text-amber-600 dark:text-amber-400"
        />
        <ModernCard 
          label="Desvios" 
          value={String((d.desvios || []).length)} 
          icon={<AlertTriangle className="w-4 h-4" />}
          colorClass={(d.desvios || []).length ? "bg-red-500" : "bg-emerald-500"} 
          bgClass={(d.desvios || []).length ? "bg-red-50 dark:bg-red-900/20" : "bg-emerald-50 dark:bg-emerald-900/20"} 
          textClass={(d.desvios || []).length ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}
        />
      </div>

      {d.veiculos?.length > 0 && (
        <div className={`grid grid-cols-1 ${d.desvios?.length ? "xl:grid-cols-12 gap-6" : ""}`}>
          <div className={`${d.desvios?.length ? "xl:col-span-7" : ""}`}>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Consumo por Veículo</h3>
            <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto max-h-[300px]">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10 backdrop-blur-sm">
                    <tr>
                      {["Veículo", "Abast.", "Litros", "Gasto", "km/L", "Custo/km"].map((h, i) => (
                        <th key={h} className={`px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 ${i > 0 ? "text-right" : ""}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {d.veiculos.map((v: any) => (
                      <tr key={v.veiculoId} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                            {v.placa}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{v.count}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">{(v.litros || 0).toLocaleString("pt-BR")}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 font-medium">{fmtMoney(v.gasto)}</td>
                        <td className="px-4 py-3 text-right text-violet-600 dark:text-violet-400 font-bold">{fmtKmL(v.mediaKmL)}</td>
                        <td className="px-4 py-3 text-right text-amber-600 dark:text-amber-400 font-medium">{fmtCustoKm(v.custoKmMedio)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {d.desvios?.length > 0 && (
            <div className="xl:col-span-5">
              <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-red-500 mb-3">
                <AlertTriangle className="w-3.5 h-3.5" /> Desvios de Consumo
              </h3>
              <div className="bg-white dark:bg-slate-950 rounded-xl border border-red-200 dark:border-red-900/30 shadow-sm overflow-hidden">
                <div className="overflow-x-auto max-h-[300px]">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-red-50/50 dark:bg-red-900/10 sticky top-0 z-10 backdrop-blur-sm">
                      <tr>
                        {["Data", "Veículo", "km/L", "Desvio"].map((h, i) => (
                          <th key={h} className={`px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 ${i > 1 ? "text-right" : ""}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {d.desvios.slice(0, 20).map((x: any) => (
                        <tr key={x.id} className="hover:bg-red-50/30 dark:hover:bg-red-900/20 transition-colors">
                          <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(x.data)}</td>
                          <td className="px-4 py-3">
                            <span className="font-mono font-bold text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                              {x.placa}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{x.consumoKmL}</span>
                            <span className="text-[10px] text-slate-400 ml-1 block sm:inline">(méd {x.mediaKmL})</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${x.desvioPct < 0 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                              {x.desvioPct > 0 ? "+" : ""}{x.desvioPct}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Importação de planilha de transações de cartão-combustível ──────────────────
function ImportModal({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState("");
  const n = (v: any) => v != null ? Number(v).toLocaleString("pt-BR") : "0";

  const upload = async (f: File, confirmar: boolean) => {
    const fd = new FormData(); fd.append("file", f); if (confirmar) fd.append("confirmar", "true");
    return api.post("/frota/abastecimentos/importar", fd);
  };
  const onPick = async (f: File) => {
    setFile(f); setErr(""); setResult(null); setPreview(null); setLoading(true);
    try { const r = await upload(f, false); setPreview(r.data); }
    catch (e: any) { setErr(e?.response?.data?.message || "Erro ao ler a planilha"); }
    finally { setLoading(false); }
  };
  const confirmar = async () => {
    if (!file) return; setCommitting(true); setErr("");
    try { const r = await upload(file, true); setResult(r.data.resumo); }
    catch (e: any) { setErr(e?.response?.data?.message || "Erro ao importar"); setCommitting(false); }
  };
  const rs = preview?.resumo;
  const Stat = ({ label, value, color }: { label: string; value: any; color: string }) => (
    <div className="card" style={{ padding: "10px 14px", borderLeft: `3px solid ${color}`, minWidth: 110 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{n(value)}</div>
      <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>{label}</div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains("modal-overlay")) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 680, display: "flex", flexDirection: "column", gap: 14, maxHeight: "88vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700 }}>Importar planilha de abastecimento</h3>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {!result && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
            Relatório de transações do cartão-combustível (.xlsx). Casa por placa; placas reais novas são cadastradas; ARLA e linhas sem placa são ignoradas; o KM só avança quando o valor é plausível.
          </div>
        )}

        {!result && (
          <div>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={e => e.target.files?.[0] && onPick(e.target.files[0])} />
            <button className="btn btn-ghost" onClick={() => inputRef.current?.click()} disabled={loading} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <FileText size={14} /> {loading ? "Lendo..." : (file ? file.name : "Escolher arquivo")}
            </button>
          </div>
        )}

        {err && <div style={{ fontSize: 12, color: "var(--accent-red)" }}>{err}</div>}

        {rs && !result && (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Stat label="A importar" value={rs.importar} color="var(--accent-green)" />
              <Stat label="Placas novas" value={rs.cadastrarEImportar} color="var(--accent-cyan)" />
              <Stat label="Duplicados" value={rs.duplicados} color="var(--accent-amber)" />
              <Stat label="Ignorados" value={rs.ignorados} color="var(--text-muted)" />
              <Stat label="Total" value={rs.totalLinhas} color="var(--accent-violet)" />
            </div>
            {rs.periodo && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Período: {fmtDate(rs.periodo.de)} a {fmtDate(rs.periodo.ate)}</div>}
            {rs.placasNovas?.length > 0 && <div style={{ fontSize: 11, color: "var(--text-secondary)" }}><b>Placas a cadastrar:</b> {rs.placasNovas.join(", ")}</div>}
            {rs.placasIgnoradas?.length > 0 && <div style={{ fontSize: 11, color: "var(--text-muted)" }}><b>Códigos ignorados:</b> {rs.placasIgnoradas.join(", ")}</div>}
            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ overflowX: "auto", maxHeight: 220 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead><tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    {["Placa", "Veículo", "Data", "KM", "Comb.", "Ação"].map(h => <th key={h} style={{ textAlign: "left", padding: "7px 10px", fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {(preview.amostra || []).map((a: any, i: number) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "6px 10px", fontFamily: "var(--font-mono)" }}>{a.placa || "—"}</td>
                        <td style={{ padding: "6px 10px" }}>{a.veiculo || "—"}</td>
                        <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>{a.data ? fmtDate(a.data) : "—"}</td>
                        <td style={{ padding: "6px 10px" }}>{a.km != null ? n(a.km) : "—"}</td>
                        <td style={{ padding: "6px 10px" }}>{a.comb || "—"}</td>
                        <td style={{ padding: "6px 10px" }}><Badge color={a.acao === "importar" ? "var(--accent-green)" : a.acao === "cadastrar" ? "var(--accent-cyan)" : a.acao === "duplicado" ? "var(--accent-amber)" : "var(--text-muted)"}>{a.acao}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Mostrando as primeiras {(preview.amostra || []).length} linhas.</div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              <button className="btn btn-violet" onClick={confirmar} disabled={committing || (rs.importar + rs.cadastrarEImportar) === 0}>
                {committing ? "Importando..." : `Confirmar importação (${n(rs.importar + rs.cadastrarEImportar)})`}
              </button>
            </div>
          </>
        )}

        {result && (
          <>
            <div style={{ padding: "14px 16px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)" }}>
              <b>Importação concluída!</b><br />
              {n(result.inseridos)} abastecimento(s) importado(s) · {n(result.veiculosCadastrados)} veículo(s) cadastrado(s) · {n(result.kmAtualizados)} hodômetro(s) atualizado(s).
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-violet" onClick={() => window.location.reload()}>Fechar e atualizar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AbastecimentoIntro() {
  const [importOpen, setImportOpen] = useState(false);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button 
          onClick={() => setImportOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-colors"
        >
          <FileText className="w-4 h-4" /> Importar planilha
        </button>
      </div>
      <AnaliseConsumo />
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
    </div>
  );
}

const config: CrudConfig = {
  endpoint: "/frota/abastecimentos", tabela: "abastecimentos", singular: "abastecimento", plural: "Abastecimentos",
  defaults: { tanqueCheio: true },
  searchPlaceholder: "Pesquisar por placa...",
  columns: [
    { key: "data", label: "Data", render: r => fmtDate(r.data) },
    { key: "veiculo", label: "Veículo", render: r => <span className="font-mono font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs">{r.veiculo?.placa || "—"}</span> },
    { key: "motorista", label: "Motorista", render: r => r.motorista?.nome || "—" },
    { key: "kmAtual", label: "KM", align: "right", render: r => r.kmAtual != null ? r.kmAtual.toLocaleString("pt-BR") : "—" },
    { key: "litros", label: "Litros", align: "right", render: r => r.litros != null ? <span className="font-medium text-slate-700 dark:text-slate-300">{r.litros.toLocaleString("pt-BR")}</span> : "—" },
    { key: "valorTotal", label: "Total", align: "right", render: r => <span className="text-emerald-600 dark:text-emerald-400 font-medium">{fmtMoney(r.valorTotal)}</span> },
    { key: "consumoKmL", label: "km/L", align: "right", render: r => r.consumoKmL != null ? <span className="text-violet-600 dark:text-violet-400 font-bold">{r.consumoKmL.toLocaleString("pt-BR")}</span> : "—" },
    { key: "custoKm", label: "Custo/km", align: "right", render: r => <span className="text-amber-600 dark:text-amber-400 font-medium">{fmtCustoKm(r.custoKm)}</span> },
  ],
  fields: [
    { key: "veiculoId", label: "Veículo", type: "select", source: "veiculos", required: true },
    { key: "motoristaId", label: "Motorista", type: "select", source: "motoristas" },
    { key: "data", label: "Data", type: "date" },
    { key: "kmAtual", label: "KM atual", type: "number" },
    { key: "litros", label: "Litros", type: "number", step: 0.01 },
    { key: "valorLitro", label: "Valor por litro (R$)", type: "number", step: 0.001 },
    { key: "valorTotal", label: "Valor total (R$) — auto se vazio", type: "number", step: 0.01 },
    { key: "tipoCombustivel", label: "Combustível", type: "select", options: COMB_OPTS },
    { key: "posto", label: "Posto" },
    { key: "tanqueCheio", label: "Tanque cheio", type: "checkbox", placeholder: "Encheu o tanque" },
    { key: "observacoes", label: "Observações", type: "textarea" },
  ],
};

export default function AbastecimentosPage() {
  return <CrudView config={config} intro={<AbastecimentoIntro />} />;
}
