"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useRef } from "react";
import CrudView, { CrudConfig, Badge, fmtDate, fmtMoney } from "../_components/crud";
import { api } from "@/lib/api";
import { FileText, X } from "lucide-react";

const COMB_OPTS = ["gasolina", "etanol", "diesel", "flex", "gnv"].map(v => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));
const fmtKmL = (v: any) => v != null ? `${Number(v).toLocaleString("pt-BR")} km/L` : "—";
const fmtCustoKm = (v: any) => v != null ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 3 }) : "—";

function Card({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card" style={{ padding: "14px 16px", borderLeft: `3px solid ${color}`, minWidth: 150 }}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function AnaliseConsumo() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { api.get("/frota/abastecimentos/analise/consumo").then(r => setD(r.data)).catch(() => {}); }, []);
  if (!d) return null;
  const t = d.totais || {};

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600, marginBottom: 8 }}>ANÁLISE DE CONSUMO</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <Card label="LITROS" value={`${(t.totalLitros || 0).toLocaleString("pt-BR")} L`} color="var(--accent-cyan)" />
        <Card label="GASTO TOTAL" value={fmtMoney(t.totalGasto)} color="var(--accent-green)" />
        <Card label="CONSUMO MÉDIO" value={fmtKmL(t.mediaKmL)} color="#8b5cf6" />
        <Card label="CUSTO/KM MÉDIO" value={fmtCustoKm(t.custoKmMedio)} color="var(--accent-amber)" />
        <Card label="DESVIOS" value={String((d.desvios || []).length)} color={(d.desvios || []).length ? "var(--accent-red)" : "var(--accent-green)"} />
      </div>

      {d.veiculos?.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: d.desvios?.length ? "1.3fr 1fr" : "1fr", gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 6 }}>CONSUMO POR VEÍCULO</div>
            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ overflowX: "auto", maxHeight: 240 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead><tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    {["Veículo", "Abast.", "Litros", "Gasto", "km/L", "Custo/km"].map((h, i) => <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "8px 12px", fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {d.veiculos.map((v: any) => (
                      <tr key={v.veiculoId} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "8px 12px", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{v.placa}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>{v.count}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>{(v.litros || 0).toLocaleString("pt-BR")}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>{fmtMoney(v.gasto)}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>{fmtKmL(v.mediaKmL)}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>{fmtCustoKm(v.custoKmMedio)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {d.desvios?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: "var(--accent-red)", fontFamily: "var(--font-mono)", marginBottom: 6 }}>⚠ DESVIOS DE CONSUMO</div>
              <div className="card" style={{ overflow: "hidden" }}>
                <div style={{ overflowX: "auto", maxHeight: 240 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead><tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      {["Data", "Veículo", "km/L", "Desvio"].map((h, i) => <th key={h} style={{ textAlign: i > 1 ? "right" : "left", padding: "8px 12px", fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {d.desvios.slice(0, 20).map((x: any) => (
                        <tr key={x.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <td style={{ padding: "8px 12px" }}>{fmtDate(x.data)}</td>
                          <td style={{ padding: "8px 12px", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{x.placa}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right" }}>{x.consumoKmL} <span style={{ color: "var(--text-muted)" }}>(méd {x.mediaKmL})</span></td>
                          <td style={{ padding: "8px 12px", textAlign: "right" }}><Badge color={x.desvioPct < 0 ? "var(--accent-red)" : "var(--accent-amber)"}>{x.desvioPct > 0 ? "+" : ""}{x.desvioPct}%</Badge></td>
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
        <button className="btn btn-ghost" onClick={() => setImportOpen(true)} style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <FileText size={14} /> Importar planilha
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
  filters: [{ key: "tipoCombustivel", label: "Combustível", options: COMB_OPTS }],
  columns: [
    { key: "data", label: "Data", render: r => fmtDate(r.data) },
    { key: "veiculo", label: "Veículo", render: r => <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{r.veiculo?.placa || "—"}</span> },
    { key: "motorista", label: "Motorista", render: r => r.motorista?.nome || "—" },
    { key: "kmAtual", label: "KM", align: "right", render: r => r.kmAtual != null ? r.kmAtual.toLocaleString("pt-BR") : "—" },
    { key: "litros", label: "Litros", align: "right", render: r => r.litros != null ? r.litros.toLocaleString("pt-BR") : "—" },
    { key: "valorTotal", label: "Total", align: "right", render: r => fmtMoney(r.valorTotal) },
    { key: "consumoKmL", label: "km/L", align: "right", render: r => r.consumoKmL != null ? r.consumoKmL.toLocaleString("pt-BR") : "—" },
    { key: "custoKm", label: "Custo/km", align: "right", render: r => fmtCustoKm(r.custoKm) },
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
