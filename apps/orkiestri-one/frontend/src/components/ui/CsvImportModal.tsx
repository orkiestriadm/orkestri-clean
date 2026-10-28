"use client";
import { useState, useRef } from "react";
import { api } from "@/lib/api";

type ImportType = "clientes" | "faturas";

interface CsvImportModalProps {
  type: ImportType;
  onClose: () => void;
  onDone: () => void;
}

const CONFIG = {
  clientes: {
    title: "Importar Clientes",
    endpoint: "/clientes/importar",
    rowKey: "criados",
    columns: ["nome*", "empresa", "email", "telefone", "cnpj", "cidade", "estado", "segmento", "origem", "statusLead"],
    template: "nome,empresa,email,telefone,cnpj,cidade,estado,segmento,origem,statusLead\nAcme Corp,Acme LTDA,contato@acme.com,(11) 99999-0000,12.345.678/0001-00,São Paulo,SP,Tecnologia,Indicação,ativo",
    templateFile: "template_clientes.csv",
  },
  faturas: {
    title: "Importar Faturas",
    endpoint: "/faturas/importar",
    rowKey: "criadas",
    columns: ["clienteNome*", "valor*", "dataVencimento*", "descricao", "dataEmissao", "status", "observacoes"],
    template: "clienteNome,valor,dataVencimento,descricao,dataEmissao,status,observacoes\nAcme Corp,1500,2026-06-20,Mensalidade Junho,2026-06-01,pendente,",
    templateFile: "template_faturas.csv",
  },
};

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
  return { headers, rows };
}

function downloadTemplate(template: string, filename: string) {
  const blob = new Blob([template], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function CsvImportModal({ type, onClose, onDone }: CsvImportModalProps) {
  const cfg = CONFIG[type];
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ total: number; criados?: number; criadas?: number; erros: { linha: number; erro: string }[] } | null>(null);
  const [fileError, setFileError] = useState("");

  function handleFile(file: File) {
    setFileError("");
    if (!file.name.endsWith(".csv")) { setFileError("Selecione um arquivo .csv"); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (!parsed.headers.length) { setFileError("Arquivo vazio ou inválido"); return; }
      setHeaders(parsed.headers);
      setRows(parsed.rows.filter(r => Object.values(r).some(v => v.trim())));
      setStep("preview");
    };
    reader.readAsText(file, "utf-8");
  }

  async function handleImport() {
    setImporting(true);
    try {
      const res = await api.post(cfg.endpoint, { rows });
      setResult(res.data);
      setStep("result");
      if ((res.data.criados || res.data.criadas || 0) > 0) onDone();
    } catch (e: any) {
      setFileError(e?.response?.data?.message || "Erro ao importar");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border-default)",
        borderRadius: 14, width: "100%", maxWidth: 640, maxHeight: "85vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{cfg.title}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              {step === "upload" ? "Selecione um arquivo CSV" : step === "preview" ? `${rows.length} linhas encontradas` : "Importação concluída"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {step === "upload" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Template download */}
              <div style={{ background: "var(--bg-hover)", borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Colunas esperadas</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {cfg.columns.map(col => (
                    <span key={col} style={{
                      fontSize: 11, padding: "2px 8px", borderRadius: 4,
                      background: col.endsWith("*") ? "rgba(139,92,246,0.15)" : "var(--bg-card)",
                      color: col.endsWith("*") ? "var(--accent-violet)" : "var(--text-secondary)",
                      border: "1px solid var(--border-subtle)",
                    }}>
                      {col}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
                  Colunas com * são obrigatórias
                </div>
                <button
                  onClick={() => downloadTemplate(cfg.template, cfg.templateFile)}
                  style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border-default)", background: "none", cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Baixar template CSV
                </button>
              </div>

              {/* Drop zone */}
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                style={{
                  border: "2px dashed var(--border-default)", borderRadius: 10, padding: 32,
                  textAlign: "center", cursor: "pointer", transition: "border-color 0.15s",
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ margin: "0 auto 8px" }}>
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Clique ou arraste o arquivo aqui</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Apenas arquivos .csv</div>
              </div>

              {fileError && (
                <div style={{ fontSize: 12, color: "var(--accent-red, #f87171)", padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 6, border: "1px solid rgba(248,113,113,0.2)" }}>
                  {fileError}
                </div>
              )}

              <input ref={inputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          )}

          {step === "preview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Verifique os dados antes de importar. As linhas serão criadas no sistema.
              </div>
              <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-hover)" }}>
                      <th style={{ padding: "6px 10px", textAlign: "left", color: "var(--text-muted)", fontWeight: 500, whiteSpace: "nowrap" }}>#</th>
                      {headers.map(h => (
                        <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: "var(--text-muted)", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((row, i) => (
                      <tr key={i} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "5px 10px", color: "var(--text-muted)" }}>{i + 1}</td>
                        {headers.map(h => (
                          <td key={h} style={{ padding: "5px 10px", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {row[h] || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 50 && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
                  Mostrando 50 de {rows.length} linhas
                </div>
              )}
            </div>
          )}

          {step === "result" && result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                {[
                  { label: "Total", value: result.total, color: "var(--text-primary)" },
                  { label: "Importados", value: result.criados ?? result.criadas ?? 0, color: "#34d399" },
                  { label: "Erros", value: result.erros.length, color: result.erros.length > 0 ? "#f87171" : "var(--text-muted)" },
                ].map(s => (
                  <div key={s.label} style={{ background: "var(--bg-hover)", borderRadius: 8, padding: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {result.erros.length > 0 && (
                <div style={{ border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "8px 12px", background: "rgba(248,113,113,0.08)", fontSize: 11, fontWeight: 600, color: "#f87171" }}>
                    Linhas com erro ({result.erros.length})
                  </div>
                  <div style={{ maxHeight: 160, overflowY: "auto" }}>
                    {result.erros.map((e, i) => (
                      <div key={i} style={{ padding: "6px 12px", borderTop: "1px solid var(--border-subtle)", fontSize: 11, display: "flex", gap: 8 }}>
                        <span style={{ color: "var(--text-muted)", minWidth: 50 }}>Linha {e.linha}</span>
                        <span style={{ color: "#f87171" }}>{e.erro}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {step === "upload" && (
            <button className="btn" style={{ fontSize: 13 }} onClick={onClose}>Cancelar</button>
          )}
          {step === "preview" && (
            <>
              <button className="btn" style={{ fontSize: 13 }} onClick={() => setStep("upload")}>Voltar</button>
              <button
                className="btn btn-violet"
                style={{ fontSize: 13, minWidth: 120 }}
                onClick={handleImport}
                disabled={importing || rows.length === 0}
              >
                {importing ? "Importando..." : `Importar ${rows.length} registros`}
              </button>
            </>
          )}
          {step === "result" && (
            <button className="btn btn-violet" style={{ fontSize: 13 }} onClick={onClose}>Concluir</button>
          )}
        </div>
      </div>
    </div>
  );
}
