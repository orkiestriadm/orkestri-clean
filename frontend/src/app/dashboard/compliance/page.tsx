"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import {
  PageBody, PageHeader, KpiCard, KpiGrid, TableCard, EmptyState, LoadingRows,
  ErrorState, PermissionDenied,
} from "@/components/data-ui";
import {
  ShieldCheck, AlertTriangle, CalendarClock, Clock, FileWarning,
  CheckCircle2, ListChecks, CalendarDays, Settings, BarChart2, Download,
} from "lucide-react";
import { complianceService } from "@/lib/compliance/compliance.service";
import type { Painel } from "@/lib/compliance/types";
import {
  pode, data, prazoEmPalavras, SeloSituacao, Identificacao, BarraProporcao,
  Secao, Aviso, dinheiro,
} from "./_components/comuns";

/**
 * Painel executivo do Compliance.
 *
 * A ordem dos cartões não é decorativa: os três primeiros são os que exigem
 * AÇÃO (vencida, prazo fatal estourado, renovação devida) e só depois vêm os
 * de contexto. A planilha que este módulo substitui ordenava por número de
 * item, e por isso a licença com o prazo estourado ficava na linha 6 sem que
 * nada a distinguisse das outras.
 */
export default function CompliancePainelPage() {
  const user = useAuthStore(s => s.user);
  const [painel, setPainel] = useState<Painel | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setPainel(await complianceService.painel());
    } catch (e: any) {
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message ?? "Falha ao carregar o painel.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const c = painel?.cartoes;
  const g = painel?.graficos;
  const precisaAcao = (c?.vencidas ?? 0) + (c?.prazoFatalVencido ?? 0) + (c?.renovacaoDevida ?? 0);

  const COLUNAS = ["Obrigação", "Situação", "Prazo interno", "Prazo fatal", "Validade", "Responsável"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <PageHeader
            icon={<ShieldCheck size={19} />}
            title="Compliance"
            subtitle="Licenças, certificados, laudos e contratos — prazos, renovações e alertas"
            actions={
              <>
                <Link href="/dashboard/compliance/obrigacoes" className="btn btn-ghost">
                  <ListChecks size={14} /> Obrigações
                </Link>
                <Link href="/dashboard/compliance/calendario" className="btn btn-ghost">
                  <CalendarDays size={14} /> Calendário
                </Link>
                <Link href="/dashboard/compliance/relatorios" className="btn btn-ghost">
                  <BarChart2 size={14} /> Relatórios
                </Link>
                {pode(user, "compliance.notificacao:configurar") && (
                  <Link href="/dashboard/compliance/alertas" className="btn btn-ghost">
                    <Settings size={14} /> Alertas
                  </Link>
                )}
              </>
            }
          />

          {semPermissao ? (
            <PermissionDenied hint="Você não tem permissão para ver o painel de conformidade." />
          ) : erro ? (
            <ErrorState detail={erro} onRetry={carregar} />
          ) : carregando ? (
            <div className="skeleton" style={{ height: 120, borderRadius: 14, marginBottom: 16 }} />
          ) : !painel ? null : (
            <>
              {precisaAcao > 0 && (
                <Aviso tom={c!.vencidas > 0 || c!.prazoFatalVencido > 0 ? "critico" : "atencao"}>
                  <strong>
                    {precisaAcao} {precisaAcao === 1 ? "obrigação exige" : "obrigações exigem"} ação.
                  </strong>{" "}
                  {c!.prazoFatalVencido > 0 && (
                    <>
                      {c!.prazoFatalVencido} {c!.prazoFatalVencido === 1 ? "passou" : "passaram"} do prazo
                      fatal para protocolar a renovação — a validade ainda está em pé, mas a janela que o
                      órgão exige já fechou.{" "}
                    </>
                  )}
                  <Link href="/dashboard/compliance/obrigacoes?situacao=vencida">Ver a fila de ação</Link>.
                </Aviso>
              )}

              {/* Ação primeiro, contexto depois. */}
              <KpiGrid min={170}>
                <KpiCard
                  index={0} label="Vencidas" valor={c!.vencidas} color="var(--accent-red)"
                  icon={<AlertTriangle size={16} />}
                  hint="Passaram da data de validade e não têm protocolo tempestivo."
                />
                <KpiCard
                  index={1} label="Prazo fatal vencido" valor={c!.prazoFatalVencido} color="var(--accent-red)"
                  icon={<FileWarning size={16} />}
                  hint="Ainda válidas, mas já não dá para protocolar dentro do prazo do órgão."
                />
                <KpiCard
                  index={2} label="Renovação devida" valor={c!.renovacaoDevida} color="var(--accent-amber)"
                  icon={<Clock size={16} />}
                  hint="Passaram do prazo interno de renovação."
                />
                <KpiCard
                  index={3} label="Vence em 30 dias" valor={c!.vence30} color="var(--accent-amber)"
                  icon={<CalendarClock size={16} />}
                />
                <KpiCard
                  index={4} label="Prorrogadas" valor={c!.prorrogadas} color="var(--accent-cyan)"
                  icon={<CheckCircle2 size={16} />}
                  hint="Vencidas no papel, regulares por protocolo tempestivo de renovação."
                />
                <KpiCard
                  index={5} label="Total no radar" valor={c!.total} color="var(--accent-violet)"
                  icon={<ShieldCheck size={16} />}
                />
              </KpiGrid>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 4 }}>
                <Secao titulo="Por categoria">
                  <BarraProporcao
                    itens={(g!.porCategoria).map(x => ({
                      rotulo: x.nome, valor: x.total, cor: x.cor,
                      href: `/dashboard/compliance/obrigacoes?categoriaId=${x.categoriaId}`,
                    }))}
                  />
                </Secao>

                <Secao titulo="Por unidade">
                  <BarraProporcao
                    itens={g!.porUnidade.slice(0, 10).map(x => ({
                      rotulo: x.valor, valor: x.total, cor: "var(--accent-cyan)",
                      href: x.valor === "—" ? undefined : `/dashboard/compliance/obrigacoes?unidade=${encodeURIComponent(x.valor)}`,
                    }))}
                  />
                </Secao>

                <Secao titulo="Por criticidade">
                  <BarraProporcao
                    itens={g!.porCriticidade.map(x => ({
                      rotulo: x.valor, valor: x.total,
                      cor: x.valor === "critica" ? "var(--accent-red)"
                        : x.valor === "alta" ? "var(--accent-amber)"
                        : "var(--accent-violet)",
                    }))}
                  />
                </Secao>

                <Secao titulo="Por responsável">
                  <BarraProporcao
                    itens={g!.porResponsavel.slice(0, 10).map(x => ({ rotulo: x.nome, valor: x.total }))}
                  />
                </Secao>
              </div>

              <Secao
                titulo="Vencimentos por mês"
                acoes={<span style={{ fontSize: 11, color: "var(--text-muted)" }}>próximos 24 meses</span>}
              >
                <LinhaDoTempo dados={g!.vencimentos} />
              </Secao>

              <Secao
                titulo="Fila de ação"
                acoes={
                  <Link href="/dashboard/compliance/obrigacoes" className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 11.5 }}>
                    Ver todas
                  </Link>
                }
              >
                <TableCard>
                  <thead><tr>{COLUNAS.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                  <tbody>
                    {painel.filaDeAcao.length === 0 ? (
                      <EmptyState
                        colSpan={COLUNAS.length}
                        icon={<CheckCircle2 size={20} />}
                        title="Nada exige ação agora"
                        hint="Nenhuma obrigação passou do prazo interno de renovação."
                      />
                    ) : (
                      painel.filaDeAcao.map(o => (
                        <tr key={o.id}>
                          <td><Identificacao o={o} /></td>
                          <td><SeloSituacao o={o} /></td>
                          <td className="num">
                            {data(o.prazoInternoEm)}
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              {prazoEmPalavras(o.diasParaPrazoInterno)}
                            </div>
                          </td>
                          <td className="num">{data(o.prazoFatalEm)}</td>
                          <td className="num">
                            {data(o.dataValidade)}
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              {prazoEmPalavras(o.diasParaValidade)}
                            </div>
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {o.responsaveis?.[0]?.user?.nome ?? o.responsaveis?.[0]?.nome ?? "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </TableCard>
              </Secao>

              {painel.custos.obrigacoesComCusto > 0 && (
                <Secao titulo="Custos">
                  <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginBottom: 14 }}>
                    <div>
                      <div className="mono-cap" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Licenças</div>
                      <div className="metric" style={{ fontSize: 20 }}>{dinheiro(painel.custos.totalLicencas)}</div>
                    </div>
                    <div>
                      <div className="mono-cap" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Renovações</div>
                      <div className="metric" style={{ fontSize: 20 }}>{dinheiro(painel.custos.totalRenovacoes)}</div>
                    </div>
                  </div>
                  <BarraProporcao
                    itens={painel.custos.porCategoria.map(x => ({
                      rotulo: x.nome, valor: Math.round(x.licenca + x.renovacao),
                    }))}
                  />
                </Secao>
              )}
            </>
          )}
        </PageBody>
      </div>
    </div>
  );
}

/**
 * Barras por mês.
 *
 * Sem biblioteca de gráfico: são doze a vinte e quatro barras e a leitura é
 * "em que mês concentra". Um pacote de charting aqui seria peso sem ganho.
 */
function LinhaDoTempo({ dados }: { dados: { mes: string; total: number; criticas: number }[] }) {
  if (dados.length === 0) {
    return <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Nenhum vencimento no período.</div>;
  }

  const teto = Math.max(...dados.map(d => d.total));
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-end", overflowX: "auto", paddingBottom: 6 }}>
      {dados.map(d => {
        const altura = Math.max(4, Math.round((d.total / teto) * 110));
        const passado = d.mes < mesAtual;
        const [ano, mes] = d.mes.split("-");
        return (
          <Link
            key={d.mes}
            href={`/dashboard/compliance/obrigacoes?de=${d.mes}-01&ate=${d.mes}-28`}
            title={`${d.total} ${d.total === 1 ? "vencimento" : "vencimentos"} em ${mes}/${ano}` +
              (d.criticas > 0 ? ` · ${d.criticas} de criticidade alta ou crítica` : "")}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 34, textDecoration: "none", color: "inherit" }}
          >
            <span className="metric" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{d.total}</span>
            <span
              style={{
                width: 20, height: altura, borderRadius: "4px 4px 0 0",
                // O passado fica esmaecido, mas não some: vencimento que já
                // passou e continua pendente é justamente o que interessa.
                background: passado
                  ? "color-mix(in srgb, var(--accent-red) 55%, transparent)"
                  : d.criticas > 0 ? "var(--accent-amber)" : "var(--accent-violet)",
                opacity: passado ? 0.75 : 1,
              }}
            />
            <span style={{ fontSize: 9.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              {mes}/{ano.slice(2)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
