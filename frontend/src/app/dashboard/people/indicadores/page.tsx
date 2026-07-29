"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import {
  reportsService, VisaoGeral, PainelDesenvolvimento, PainelBeneficios, Fatia,
} from "@/lib/people/reports.service";
import {
  PageBody, BackLink, PageHeader, Panel, SelectFilter,
  ErrorState, PermissionDenied, StatusBadge,
} from "@/components/data-ui";
import { BarChart3, Download, Users, TrendingUp, AlertTriangle } from "lucide-react";

/**
 * Indicadores de pessoas.
 *
 * Todo número respeita o escopo do usuário. Quando o escopo não é
 * organizacional, a tela diz isso em vez de deixar o gestor achar que está
 * lendo a empresa inteira — um headcount lido no recorte errado vira decisão
 * de contratação errada.
 */

const JANELAS = [
  { value: "3",  label: "Últimos 3 meses" },
  { value: "6",  label: "Últimos 6 meses" },
  { value: "12", label: "Últimos 12 meses" },
  { value: "24", label: "Últimos 24 meses" },
];

const ROTULO_STATUS: Record<string, string> = {
  ATIVO: "Ativos", AFASTADO: "Afastados", SUSPENSO: "Suspensos",
  INATIVO: "Inativos", DESLIGADO: "Desligados",
};

const ROTULO_APROVACAO: Record<string, string> = {
  PENDENTE: "Pendentes", APROVADO: "Aprovados",
  REJEITADO: "Rejeitados", ARQUIVADO: "Arquivados",
};

const ROTULO_TREINAMENTO: Record<string, string> = {
  PLANEJADO: "Planejados", EM_ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluídos", CANCELADO: "Cancelados",
};

const fmtMoeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function pode(user: any, perm: string): boolean {
  if (user?.isMaster) return true;
  const perms: string[] = user?.permissions ?? [];
  return perms.includes("*") || perms.includes(perm);
}

export default function IndicadoresPage() {
  const user = useAuthStore(s => s.user);
  const [meses, setMeses] = useState("12");
  const [geral, setGeral] = useState<VisaoGeral | null>(null);
  const [desenvolvimento, setDesenvolvimento] = useState<PainelDesenvolvimento | null>(null);
  const [beneficios, setBeneficios] = useState<PainelBeneficios | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [baixando, setBaixando] = useState(false);

  // Exportar exige as duas: tirar dado da plataforma é decisão diferente de
  // olhar o painel. O backend cobra ambas com semântica E.
  const podeExportar =
    pode(user, "people.relatorio:exportar") && pode(user, "people.colaborador:exportar");

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null); setSemPermissao(false);
    try {
      setGeral((await reportsService.visaoGeral(Number(meses))).data);
    } catch (e: any) {
      setGeral(null);
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message || "Não foi possível carregar os indicadores.");
      setCarregando(false);
      return;
    }

    // Os dois painéis abaixo dependem de permissões separadas e são `silent`:
    // quem não pode vê-los simplesmente não os recebe, sem alarme.
    const [d, b] = await Promise.all([
      reportsService.desenvolvimento().then(r => r.data).catch(() => null),
      reportsService.beneficios().then(r => r.data).catch(() => null),
    ]);
    setDesenvolvimento(d);
    setBeneficios(b);
    setCarregando(false);
  }, [meses]);

  useEffect(() => { carregar(); }, [carregar]);

  async function exportar() {
    setBaixando(true);
    try {
      await reportsService.exportarQuadro();
      useToastStore.getState().success("Exportação concluída", "O arquivo foi baixado.");
    } catch {
      useToastStore.getState().error("Exportação falhou", "Não foi possível gerar o arquivo.");
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href="/dashboard/people" label="Colaboradores" />

          <PageHeader
            icon={<BarChart3 size={19} />}
            title="Indicadores de pessoas"
            subtitle="Quadro, movimentação, documentos e desenvolvimento"
            actions={
              podeExportar && (
                <button type="button" className="btn btn-ghost" onClick={exportar} disabled={baixando}>
                  <Download size={14} /> {baixando ? "Gerando..." : "Exportar quadro"}
                </button>
              )
            }
          />

          {semPermissao ? (
            <PermissionDenied hint="Você não tem permissão para ver os indicadores de pessoas." />
          ) : erro ? (
            <ErrorState detail={erro} onRetry={carregar} />
          ) : (
            <>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
                <SelectFilter
                  value={meses}
                  onChange={setMeses}
                  options={JANELAS}
                  placeholder="Janela"
                />
                {geral && !geral.escopoOrganizacional && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--accent-amber)" }}>
                    <AlertTriangle size={13} />
                    Números da sua equipe, não da organização inteira
                  </span>
                )}
              </div>

              {carregando || !geral ? (
                <Esqueleto />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <Numeros geral={geral} />

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
                    <Panel title="POR SETOR">
                      <Barras fatias={geral.distribuicoes.porSetor} />
                    </Panel>
                    <Panel title="POR CARGO">
                      <Barras fatias={geral.distribuicoes.porCargo} />
                    </Panel>
                    <Panel title="POR VÍNCULO">
                      <Barras fatias={geral.distribuicoes.porVinculo} />
                    </Panel>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
                    <Panel title="DOCUMENTOS">
                      <Contagens
                        itens={geral.documentos.porAprovacao.map(d => ({
                          rotulo: ROTULO_APROVACAO[d.aprovacao] ?? d.aprovacao,
                          total: d.total,
                        }))}
                      />
                      {geral.documentos.vencendoEm30Dias > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <StatusBadge
                            label={`${geral.documentos.vencendoEm30Dias} vencendo em 30 dias`}
                            tone="atencao"
                          />
                        </div>
                      )}
                    </Panel>

                    <Panel title="FÉRIAS">
                      <Contagens
                        itens={[
                          { rotulo: "Saldo total (dias)", total: geral.ferias.saldoTotalDias },
                          { rotulo: "Passivo vencido (dias)", total: geral.ferias.passivoVencidoDias },
                        ]}
                      />
                      {geral.ferias.passivoVencidoDias > 0 && (
                        <p style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5, marginTop: 10, marginBottom: 0 }}>
                          Dias vencidos são devidos em dobro. Veja quem está na fila
                          no passivo de férias.
                        </p>
                      )}
                    </Panel>

                    {desenvolvimento && (
                      <Panel title="DESENVOLVIMENTO">
                        <Contagens
                          itens={desenvolvimento.treinamentos.map(t => ({
                            rotulo: ROTULO_TREINAMENTO[t.status] ?? t.status,
                            total: t.total,
                          }))}
                        />
                        {desenvolvimento.certificacoesVencendo > 0 && (
                          <div style={{ marginTop: 12 }}>
                            <StatusBadge
                              label={`${desenvolvimento.certificacoesVencendo} certificação(ões) vencendo`}
                              tone="atencao"
                            />
                          </div>
                        )}
                        {desenvolvimento.desempenhoPorCiclo.length > 0 && (
                          <div style={{ marginTop: 14 }}>
                            <div className="mono-cap" style={{ color: "var(--text-muted)", marginBottom: 6 }}>
                              Média de desempenho
                            </div>
                            {desenvolvimento.desempenhoPorCiclo.slice(0, 4).map(c => (
                              <div
                                key={c.ciclo}
                                style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0" }}
                              >
                                <span>{c.ciclo}</span>
                                <span>
                                  <span className="metric" style={{ fontWeight: 600 }}>
                                    {c.media ?? "—"}
                                  </span>
                                  <span style={{ color: "var(--text-muted)" }}> ({c.avaliacoes})</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </Panel>
                    )}

                    {beneficios && beneficios.porBeneficio.length > 0 && (
                      <Panel title="BENEFÍCIOS">
                        <div style={{ marginBottom: 12 }}>
                          <div className="mono-cap" style={{ color: "var(--text-muted)", marginBottom: 4 }}>
                            Custo mensal
                          </div>
                          <span className="metric" style={{ fontSize: 20, fontWeight: 600 }}>
                            {fmtMoeda(beneficios.custoMensalTotal)}
                          </span>
                          {/* Separador explícito: só a margem deixava o valor
                              colado na contagem quando o texto era copiado ou
                              lido por leitor de tela. */}
                          <span style={{ fontSize: 11.5, color: "var(--text-muted)", marginLeft: 8 }}>
                            {" · "}
                            {beneficios.pessoasCobertas}{" "}
                            {beneficios.pessoasCobertas === 1 ? "pessoa coberta" : "pessoas cobertas"}
                          </span>
                        </div>
                        {beneficios.porBeneficio.map(b => (
                          <div
                            key={b.nome}
                            style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0" }}
                          >
                            <span>{b.nome}</span>
                            <span>
                              <span className="metric">{fmtMoeda(b.custo)}</span>
                              <span style={{ color: "var(--text-muted)" }}> · {b.pessoas}</span>
                            </span>
                          </div>
                        ))}
                      </Panel>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </PageBody>
      </div>
    </div>
  );
}

function Numeros({ geral }: { geral: VisaoGeral }) {
  const { quadro, movimentacao } = geral;
  const anos = Math.floor(quadro.tempoMedioCasaMeses / 12);
  const meses = Math.round(quadro.tempoMedioCasaMeses % 12);

  const cartoes = [
    { rotulo: "Colaboradores ativos", valor: String(quadro.ativos), nota: `${quadro.total} no total`, icone: <Users size={14} /> },
    {
      rotulo: "Tempo médio de casa",
      valor: anos > 0 ? `${anos}a ${meses}m` : `${meses}m`,
      nota: "considerando ativos",
    },
    {
      rotulo: "Turnover",
      valor: `${movimentacao.turnoverPercentual}%`,
      nota:
        `${movimentacao.admissoes} ${movimentacao.admissoes === 1 ? "entrada" : "entradas"} · ` +
        `${movimentacao.desligamentos} ${movimentacao.desligamentos === 1 ? "saída" : "saídas"}`,
      icone: <TrendingUp size={14} />,
    },
    {
      rotulo: "Saldo do período",
      valor: movimentacao.saldo > 0 ? `+${movimentacao.saldo}` : String(movimentacao.saldo),
      nota: `partiu de ${movimentacao.efetivoInicial}`,
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
      {cartoes.map(c => (
        <div
          key={c.rotulo}
          style={{
            padding: "14px 16px", borderRadius: 14,
            background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)",
          }}
        >
          <div
            className="mono-cap"
            style={{ color: "var(--text-muted)", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}
          >
            {c.icone} {c.rotulo}
          </div>
          <div className="metric" style={{ fontSize: 24, fontWeight: 600 }}>{c.valor}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{c.nota}</div>
        </div>
      ))}
    </div>
  );
}

function Barras({ fatias }: { fatias: Fatia[] }) {
  if (fatias.length === 0) {
    return <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>Sem dados.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {fatias.slice(0, 8).map(f => (
        <div key={f.rotulo}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {f.rotulo}
            </span>
            <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap", marginLeft: 8 }}>
              <span className="metric">{f.total}</span> · {f.percentual}%
            </span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: "var(--bg-hover)", overflow: "hidden" }}>
            <div style={{ width: `${f.percentual}%`, height: "100%", background: "var(--accent-violet)" }} />
          </div>
        </div>
      ))}
      {fatias.length > 8 && (
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          e mais {fatias.length - 8}
        </span>
      )}
    </div>
  );
}

function Contagens({ itens }: { itens: { rotulo: string; total: number }[] }) {
  if (itens.length === 0) {
    return <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>Sem dados.</p>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {itens.map(i => (
        <div key={i.rotulo} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
          <span>{i.rotulo}</span>
          <span className="metric" style={{ fontWeight: 600 }}>{i.total}</span>
        </div>
      ))}
    </div>
  );
}

function Esqueleto() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
        {[0, 1, 2, 3].map(i => (
          <span key={i} className="skeleton" style={{ height: 92, borderRadius: 14 }} />
        ))}
      </div>
      <span className="skeleton" style={{ height: 200, borderRadius: 16 }} />
    </div>
  );
}
