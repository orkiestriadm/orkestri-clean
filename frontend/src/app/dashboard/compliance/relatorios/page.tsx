"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import {
  PageBody, BackLink, PageHeader, Panel, ErrorState, PermissionDenied,
} from "@/components/data-ui";
import { BarChart2, Download, FileSpreadsheet, FileText } from "lucide-react";
import { complianceService } from "@/lib/compliance/compliance.service";
import { pode, dinheiro, BarraProporcao, Aviso } from "../_components/comuns";

type Agregados = {
  porCategoria: { categoriaId: string; nome: string; cor: string; total: number }[];
  porStatus: { valor: string; total: number }[];
  porUnidade: { valor: string; total: number }[];
  porEmpresa: { valor: string; total: number }[];
  vencimentos: { mes: string; total: number; criticas: number }[];
  custos: { totalLicencas: number; totalRenovacoes: number };
  geradoEm: string;
};

/**
 * Relatórios.
 *
 * A exportação em Excel traz a carteira COMPLETA, com as mesmas colunas da
 * planilha de origem mais as que ela não tinha — situação derivada, prorrogação
 * e código do registro. Quem receber o arquivo precisa conseguir usá-lo no
 * lugar da planilha antiga sem sentir falta de nada.
 */
export default function RelatoriosPage() {
  const user = useAuthStore(s => s.user);
  const [dados, setDados] = useState<Agregados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [baixando, setBaixando] = useState<string | null>(null);

  const podeExportar = pode(user, "compliance.relatorio:exportar")
    || pode(user, "compliance.obrigacao:exportar");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try { setDados(await complianceService.relatorios()); }
    catch (e: any) {
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message ?? "Falha ao carregar os relatórios.");
    } finally { setCarregando(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function exportar(formato: "excel" | "pdf" | "csv") {
    setBaixando(formato);
    try {
      const { truncado } = await complianceService.exportar(formato);
      if (truncado) {
        useToastStore.getState().warning(
          "Exportação parcial",
          "O arquivo traz as primeiras 10.000 linhas. Filtre a carteira para exportar o restante.",
        );
      } else {
        useToastStore.getState().success("Exportação concluída");
      }
    } catch { /* interceptor */ } finally { setBaixando(null); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href="/dashboard/compliance" label="Compliance" />

          <PageHeader
            icon={<BarChart2 size={19} />}
            title="Relatórios"
            subtitle="Visão consolidada da carteira e exportação para Excel, PDF e CSV"
            actions={
              podeExportar && (
                <>
                  <button type="button" className="btn btn-ghost" onClick={() => exportar("excel")} disabled={!!baixando}>
                    <FileSpreadsheet size={14} /> {baixando === "excel" ? "Gerando…" : "Excel"}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => exportar("pdf")} disabled={!!baixando}>
                    <FileText size={14} /> {baixando === "pdf" ? "Gerando…" : "PDF"}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => exportar("csv")} disabled={!!baixando}>
                    <Download size={14} /> CSV
                  </button>
                </>
              )
            }
          />

          {semPermissao ? (
            <PermissionDenied hint="Você não tem permissão para ver os relatórios de conformidade." />
          ) : erro ? (
            <ErrorState detail={erro} onRetry={carregar} />
          ) : carregando || !dados ? (
            <div className="skeleton" style={{ height: 300, borderRadius: 14 }} />
          ) : (
            <>
              <Aviso tom="info">
                O <strong>Excel</strong> traz a carteira completa, com todas as colunas. O{" "}
                <strong>PDF</strong> é o resumo para imprimir e levar a uma reunião — traz as colunas
                que cabem na página, e diz isso no rodapé.
              </Aviso>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
                <Panel title="Obrigações por categoria">
                  <BarraProporcao
                    itens={dados.porCategoria.map(c => ({
                      rotulo: c.nome, valor: c.total, cor: c.cor,
                      href: `/dashboard/compliance/obrigacoes?categoriaId=${c.categoriaId}`,
                    }))}
                  />
                </Panel>

                <Panel title="Por status">
                  <BarraProporcao itens={dados.porStatus.map(s => ({ rotulo: s.valor, valor: s.total }))} />
                </Panel>

                <Panel title="Por unidade">
                  <BarraProporcao
                    itens={dados.porUnidade.slice(0, 12).map(u => ({
                      rotulo: u.valor, valor: u.total, cor: "var(--accent-cyan)",
                    }))}
                  />
                </Panel>

                <Panel title="Por empresa">
                  <BarraProporcao
                    itens={dados.porEmpresa.slice(0, 12).map(e => ({
                      rotulo: e.valor, valor: e.total, cor: "var(--accent-green)",
                    }))}
                  />
                </Panel>
              </div>

              <Panel title="Custos">
                <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                  <div>
                    <div className="mono-cap" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Licenças</div>
                    <div className="metric" style={{ fontSize: 22 }}>{dinheiro(dados.custos.totalLicencas)}</div>
                  </div>
                  <div>
                    <div className="mono-cap" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Renovações</div>
                    <div className="metric" style={{ fontSize: 22 }}>{dinheiro(dados.custos.totalRenovacoes)}</div>
                  </div>
                </div>
              </Panel>

              <Panel title="Vencimentos por mês">
                <BarraProporcao
                  itens={dados.vencimentos.map(v => ({
                    rotulo: `${v.mes.split("-")[1]}/${v.mes.split("-")[0]}`,
                    valor: v.total,
                    cor: v.criticas > 0 ? "var(--accent-amber)" : "var(--accent-violet)",
                  }))}
                />
              </Panel>
            </>
          )}
        </PageBody>
      </div>
    </div>
  );
}
