"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import {
  PageBody, BackLink, PageHeader, ErrorState, PermissionDenied, SelectFilter,
  Toolbar, useCountUp,
} from "@/components/data-ui";
import {
  BarChart2, FileSpreadsheet, FileText, Download, RotateCw, Filter,
} from "lucide-react";
import { complianceService, ConsultaObrigacoes } from "@/lib/compliance/compliance.service";
import type { Filtros } from "@/lib/compliance/types";
import { pode, dinheiro, Aviso } from "../_components/comuns";
import { BarrasComparativas, BarraEmpilhada, ColunasPorMes, Cartao } from "../_components/graficos";

/**
 * Relatórios de conformidade.
 *
 * Dois defeitos que esta tela tinha e que a reescrita corrige:
 *
 *  1. NÃO TINHA FILTRO. Só sabia responder "a carteira inteira", e a pergunta
 *     que se faz num relatório quase nunca é essa — é "o ano que vem", "esta
 *     categoria", "esta unidade".
 *
 *  2. O BOTÃO DE EXPORTAR APARECIA PARA QUEM NÃO PODIA USAR. A tela liberava
 *     com `relatorio:exportar`, o endpoint exige `obrigacao:exportar`: quem
 *     tinha só a primeira clicava e levava 403 sem entender.
 *
 * Agora o filtro vale para os gráficos E para o arquivo, então o que se baixa
 * é exatamente o que está na tela — que era outra forma silenciosa de errar.
 */

type Agregados = {
  total: number;
  porCategoria: { categoriaId: string; nome: string; cor: string; total: number }[];
  porStatus: { valor: string; total: number }[];
  porCriticidade: { valor: string; total: number }[];
  porUnidade: { valor: string; total: number }[];
  porEmpresa: { valor: string; total: number }[];
  porDepartamento: { valor: string; total: number }[];
  vencimentos: { mes: string; total: number; criticas: number }[];
  custos: { totalLicencas: number; totalRenovacoes: number; comCusto: number };
  periodo: { de: string; ate: string };
  geradoEm: string;
};

const ROTULO_STATUS: Record<string, string> = {
  ativa: "Ativa", em_renovacao: "Em renovação", suspensa: "Suspensa",
  vencida: "Vencida", cancelada: "Cancelada", arquivada: "Arquivada",
};

export default function RelatoriosPage() {
  const user = useAuthStore(s => s.user);
  const [dados, setDados] = useState<Agregados | null>(null);
  const [filtros, setFiltros] = useState<Filtros | null>(null);
  const [consulta, setConsulta] = useState<ConsultaObrigacoes>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [baixando, setBaixando] = useState<string | null>(null);

  /**
   * O botão só aparece se a pessoa puder de fato chamar o endpoint.
   * Mostrar e depois negar é pior que não mostrar.
   */
  const podeExportar = pode(user, "compliance.obrigacao:exportar");

  const carregar = useCallback(async (c: ConsultaObrigacoes) => {
    setCarregando(true);
    setErro(null);
    try {
      setDados(await complianceService.relatorios(c) as Agregados);
    } catch (e: any) {
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message ?? "Falha ao carregar os relatórios.");
    } finally { setCarregando(false); }
  }, []);

  useEffect(() => { carregar(consulta); }, [consulta, carregar]);
  useEffect(() => { complianceService.filtros().then(setFiltros).catch(() => {}); }, []);

  async function exportar(formato: "excel" | "pdf" | "csv") {
    setBaixando(formato);
    try {
      const { truncado } = await complianceService.exportar(formato, consulta);
      if (truncado) {
        useToastStore.getState().warning(
          "Exportação parcial",
          "O arquivo traz as primeiras 10.000 linhas. Refine o filtro para levar o restante.",
        );
      } else {
        useToastStore.getState().success("Arquivo gerado", "O download começou.");
      }
    } catch { /* interceptor */ } finally { setBaixando(null); }
  }

  const aplicar = (m: Partial<ConsultaObrigacoes>) => setConsulta(c => ({ ...c, ...m }));
  const limpar = () => setConsulta({});

  const temFiltro = useMemo(
    () => Object.values(consulta).some(v => v !== undefined && v !== "" && v !== false),
    [consulta],
  );

  const periodos = useMemo(() => {
    const hoje = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const emMeses = (m: number) => { const d = new Date(hoje); d.setMonth(d.getMonth() + m); return d; };
    return [
      { rotulo: "Próximos 3 meses", de: iso(hoje), ate: iso(emMeses(3)) },
      { rotulo: "Próximos 6 meses", de: iso(hoje), ate: iso(emMeses(6)) },
      { rotulo: "Próximos 12 meses", de: iso(hoje), ate: iso(emMeses(12)) },
      { rotulo: "Este ano", de: `${hoje.getFullYear()}-01-01`, ate: `${hoje.getFullYear()}-12-31` },
      { rotulo: "Ano que vem", de: `${hoje.getFullYear() + 1}-01-01`, ate: `${hoje.getFullYear() + 1}-12-31` },
    ];
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href="/dashboard/compliance" label="Compliance" />

          <PageHeader
            icon={<BarChart2 size={19} />}
            title="Relatórios"
            subtitle="Recorte a carteira e leve o resultado para Excel, PDF ou CSV"
            actions={
              podeExportar ? (
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
              ) : undefined
            }
          />

          {semPermissao ? (
            <PermissionDenied hint="Você não tem permissão para ver os relatórios de conformidade." />
          ) : erro ? (
            <ErrorState detail={erro} onRetry={() => carregar(consulta)} />
          ) : (
            <>
              <Toolbar>
                <SelectFilter
                  value={consulta.categoriaId ?? ""}
                  onChange={v => aplicar({ categoriaId: v })}
                  placeholder="Todas as categorias"
                  options={(filtros?.categorias ?? []).map(c => ({ value: c.id, label: c.nome }))}
                />
                <SelectFilter
                  value={consulta.unidade ?? ""}
                  onChange={v => aplicar({ unidade: v })}
                  placeholder="Todas as unidades"
                  options={(filtros?.unidades ?? []).map(u => ({ value: u, label: u }))}
                />
                <SelectFilter
                  value={consulta.de && consulta.ate ? `${consulta.de}|${consulta.ate}` : ""}
                  onChange={v => {
                    if (!v) return aplicar({ de: undefined, ate: undefined });
                    const [de, ate] = v.split("|");
                    aplicar({ de, ate });
                  }}
                  placeholder="Período do vencimento"
                  options={periodos.map(p => ({ value: `${p.de}|${p.ate}`, label: p.rotulo }))}
                />
                {temFiltro && (
                  <button type="button" className="btn btn-ghost" onClick={limpar} title="Voltar à carteira inteira">
                    <RotateCw size={13} /> Limpar
                  </button>
                )}
              </Toolbar>

              {carregando ? (
                <>
                  <div className="skeleton" style={{ height: 92, borderRadius: 14, marginBottom: 16 }} />
                  <div className="skeleton" style={{ height: 220, borderRadius: 14, marginBottom: 16 }} />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: 16 }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="skeleton" style={{ height: 200, borderRadius: 14 }} />
                    ))}
                  </div>
                </>
              ) : !dados ? null : dados.total === 0 ? (
                <Aviso tom="info">
                  Nenhuma obrigação casa com este recorte.{" "}
                  {temFiltro
                    ? <>Tente <button type="button" onClick={limpar} className="btn btn-ghost" style={{ padding: "2px 8px", fontSize: 11.5 }}>limpar o filtro</button>.</>
                    : "A carteira está vazia — cadastre a primeira obrigação."}
                </Aviso>
              ) : (
                <>
                  <Resumo dados={dados} temFiltro={temFiltro} podeExportar={podeExportar} />

                  <Cartao
                    titulo="Vencimentos por mês"
                    dica="Clique num mês para abrir a carteira filtrada por ele."
                  >
                    <ColunasPorMes dados={dados.vencimentos} />
                  </Cartao>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: 16 }}>
                    <Cartao titulo="Por categoria">
                      <BarrasComparativas
                        itens={dados.porCategoria.map(c => ({
                          rotulo: c.nome, valor: c.total, cor: c.cor,
                          href: `/dashboard/compliance/obrigacoes?categoriaId=${c.categoriaId}`,
                        }))}
                      />
                    </Cartao>

                    <Cartao titulo="Criticidade" dica="Proporção da carteira recortada.">
                      <BarraEmpilhada
                        fatias={[
                          { rotulo: "Crítica", valor: achar(dados.porCriticidade, "critica"), cor: "var(--accent-red)" },
                          { rotulo: "Alta", valor: achar(dados.porCriticidade, "alta"), cor: "var(--accent-amber)" },
                          { rotulo: "Média", valor: achar(dados.porCriticidade, "media"), cor: "var(--accent-violet)" },
                          { rotulo: "Baixa", valor: achar(dados.porCriticidade, "baixa"), cor: "var(--text-muted)" },
                        ]}
                      />
                    </Cartao>

                    <Cartao titulo="Por unidade" dica="As doze com mais obrigações.">
                      <BarrasComparativas
                        itens={dados.porUnidade.slice(0, 12).map(u => ({
                          rotulo: u.valor, valor: u.total, cor: "var(--accent-cyan)",
                          href: u.valor === "—" ? undefined
                            : `/dashboard/compliance/obrigacoes?unidade=${encodeURIComponent(u.valor)}`,
                        }))}
                        vazio="Nenhuma obrigação tem unidade informada."
                      />
                    </Cartao>

                    <Cartao titulo="Por status">
                      <BarrasComparativas
                        itens={dados.porStatus.map(s => ({
                          rotulo: ROTULO_STATUS[s.valor] ?? s.valor, valor: s.total,
                          cor: s.valor === "vencida" ? "var(--accent-red)"
                            : s.valor === "em_renovacao" ? "var(--accent-amber)"
                            : "var(--accent-green)",
                        }))}
                      />
                    </Cartao>

                    <Cartao titulo="Por departamento">
                      <BarrasComparativas
                        itens={dados.porDepartamento.slice(0, 12).map(o => ({ rotulo: o.valor, valor: o.total }))}
                        vazio="Nenhuma obrigação tem departamento informado."
                      />
                    </Cartao>

                    <Cartao titulo="Por empresa">
                      <BarrasComparativas
                        itens={dados.porEmpresa.slice(0, 12).map(e => ({
                          rotulo: e.valor, valor: e.total, cor: "var(--accent-green)",
                        }))}
                        vazio="Nenhuma obrigação tem empresa informada."
                      />
                    </Cartao>
                  </div>

                  <Cartao
                    titulo="Custos"
                    dica="Somados pela data de emissão, não pela validade."
                  >
                    {dados.custos.comCusto === 0 ? (
                      <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>
                        Nenhuma obrigação deste recorte tem valor informado.
                      </p>
                    ) : (
                      <div style={{ display: "flex", gap: 34, flexWrap: "wrap" }}>
                        <div>
                          <div className="mono-cap" style={{ fontSize: 10, color: "var(--text-muted)" }}>Licenças</div>
                          <div className="metric" style={{ fontSize: 22 }}>{dinheiro(dados.custos.totalLicencas)}</div>
                        </div>
                        <div>
                          <div className="mono-cap" style={{ fontSize: 10, color: "var(--text-muted)" }}>Renovações</div>
                          <div className="metric" style={{ fontSize: 22 }}>{dinheiro(dados.custos.totalRenovacoes)}</div>
                        </div>
                        <div>
                          <div className="mono-cap" style={{ fontSize: 10, color: "var(--text-muted)" }}>Com valor informado</div>
                          <div className="metric" style={{ fontSize: 22 }}>{dados.custos.comCusto}</div>
                        </div>
                      </div>
                    )}
                  </Cartao>

                  <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right", marginTop: 4 }}>
                    Gerado em {new Date(dados.geradoEm).toLocaleString("pt-BR")}
                  </p>
                </>
              )}
            </>
          )}
        </PageBody>
      </div>
    </div>
  );
}

function achar(lista: { valor: string; total: number }[], chave: string): number {
  return lista.find(x => x.valor === chave)?.total ?? 0;
}

/**
 * Resumo do recorte.
 *
 * Diz, em uma linha, quantas obrigações o relatório está descrevendo — sem
 * isso não dá para saber se um gráfico com poucas barras é a carteira pequena
 * ou um filtro apertado demais.
 */
function Resumo({
  dados, temFiltro, podeExportar,
}: { dados: Agregados; temFiltro: boolean; podeExportar: boolean }) {
  const total = useCountUp(dados.total);
  const de = new Date(dados.periodo.de).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
  const ate = new Date(dados.periodo.ate).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        padding: "14px 18px", borderRadius: 14, marginBottom: 18,
        border: "1px solid color-mix(in srgb, var(--accent-violet) 20%, transparent)",
        background: "color-mix(in srgb, var(--accent-violet) 6%, transparent)",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Filter size={16} color="var(--accent-violet)" />
        <span>
          <span className="metric" style={{ fontSize: 22 }}>{total.toLocaleString("pt-BR")}</span>
          <span style={{ fontSize: 13, marginLeft: 7 }}>
            {dados.total === 1 ? "obrigação" : "obrigações"} {temFiltro ? "neste recorte" : "na carteira"}
          </span>
        </span>
      </span>
      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        vencimentos de {de} a {ate}
      </span>
      {podeExportar && (
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--text-secondary)" }}>
          A exportação leva <strong>exatamente este recorte</strong>.
        </span>
      )}
    </div>
  );
}
