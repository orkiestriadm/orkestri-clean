"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import { PageBody, BackLink, PageHeader, TableCard, ErrorState, PermissionDenied } from "@/components/data-ui";
import { BarChart3, FileSpreadsheet, FileText, FileDown } from "lucide-react";
import { estrategicoService } from "@/lib/estrategico/estrategico.service";
import type { TipoRelatorio, TabelaRelatorio } from "@/lib/estrategico/types";
import { BASE, pode, dinheiro, Aviso, Nota, mensagemErro } from "../_components/comuns";
import { Cartao } from "../_components/graficos";

/** Relatórios: a prévia na tela é a mesma tabela que sai no PDF, Excel e CSV. */
export default function RelatoriosPage() {
  const user = useAuthStore(s => s.user);
  const toast = useToastStore();
  const params = useSearchParams();
  const [tipos, setTipos] = useState<TipoRelatorio[] | null>(null);
  const [tipo, setTipo] = useState<string>(params.get("tipo") ?? "executivo");
  const [tabela, setTabela] = useState<TabelaRelatorio | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [exportando, setExportando] = useState<string | null>(null);
  const exporta = pode(user, "estrategico.relatorio:exportar");

  useEffect(() => {
    estrategicoService.tiposRelatorio().then(setTipos).catch((e: any) => {
      if (e?.response?.status === 403) setSemPermissao(true); else setErro(mensagemErro(e, "Falha ao carregar."));
    });
  }, []);

  useEffect(() => {
    setCarregando(true);
    setErro(null);
    estrategicoService.relatorio(tipo)
      .then(setTabela)
      .catch(e => setErro(mensagemErro(e, "Falha ao gerar o relatório.")))
      .finally(() => setCarregando(false));
  }, [tipo]);

  async function exportar(formato: "excel" | "csv" | "pdf") {
    setExportando(formato);
    try { await estrategicoService.exportarRelatorio(tipo, formato); }
    catch (e) { toast.error("Falha na exportação", mensagemErro(e, "")); }
    finally { setExportando(null); }
  }

  const celula = (v: string | number | null, col: number) =>
    v == null || v === "" ? "—" : typeof v === "number" && tabela?.moeda.includes(col) ? dinheiro(v) : String(v);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href={BASE} label="Painel estratégico" />
          <PageHeader icon={<BarChart3 size={19} />} title="Relatórios estratégicos" subtitle="Gerados a partir dos dados atuais — PDF, Excel e CSV" />
          {semPermissao ? <PermissionDenied /> : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, marginBottom: 16 }}>
                {(tipos ?? []).map(t => (
                  <button key={t.id} type="button" onClick={() => setTipo(t.id)} className="panel"
                    style={{ textAlign: "left", padding: 12, cursor: "pointer", border: tipo === t.id ? "1px solid var(--accent-violet)" : undefined, background: tipo === t.id ? "color-mix(in srgb, var(--accent-violet) 8%, var(--bg-card))" : undefined }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{t.titulo}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 3, lineHeight: 1.4 }}>{t.descricao}</div>
                  </button>
                ))}
              </div>

              {erro ? <ErrorState detail={erro} /> : (
                <Cartao
                  titulo={tabela?.titulo ?? "Relatório"}
                  acoes={exporta ? (
                    <span style={{ display: "flex", gap: 6 }}>
                      <button type="button" className="btn btn-ghost" style={{ padding: "4px 10px" }} onClick={() => exportar("pdf")} disabled={!!exportando}><FileText size={13} /> {exportando === "pdf" ? "…" : "PDF"}</button>
                      <button type="button" className="btn btn-ghost" style={{ padding: "4px 10px" }} onClick={() => exportar("excel")} disabled={!!exportando}><FileSpreadsheet size={13} /> {exportando === "excel" ? "…" : "Excel"}</button>
                      <button type="button" className="btn btn-ghost" style={{ padding: "4px 10px" }} onClick={() => exportar("csv")} disabled={!!exportando}><FileDown size={13} /> {exportando === "csv" ? "…" : "CSV"}</button>
                    </span>
                  ) : undefined}
                >
                  {carregando || !tabela ? <div className="skeleton" style={{ height: 200, borderRadius: 10 }} /> : (
                    <>
                      {tabela.avisos.map((a, i) => <Aviso key={i} tom="info">{a}</Aviso>)}
                      <Nota>{tabela.linhas.length} linha(s){tabela.linhas.length > 300 ? " — a prévia mostra as 300 primeiras; a exportação traz todas" : ""}.</Nota>
                      <div style={{ marginTop: 8 }}>
                        <TableCard>
                          <thead><tr>{tabela.colunas.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
                          <tbody>
                            {tabela.linhas.slice(0, 300).map((l, r) => (
                              <tr key={r}>{l.map((v, c) => <td key={c} className={typeof v === "number" ? "num" : undefined} style={{ fontSize: 12, maxWidth: 360 }}>{celula(v, c)}</td>)}</tr>
                            ))}
                            {tabela.totais && <tr>{tabela.totais.map((v, c) => <td key={c} className="num" style={{ fontSize: 12, fontWeight: 700 }}>{v === "" ? "" : celula(v, c)}</td>)}</tr>}
                          </tbody>
                        </TableCard>
                      </div>
                    </>
                  )}
                </Cartao>
              )}
            </>
          )}
        </PageBody>
      </div>
    </div>
  );
}
