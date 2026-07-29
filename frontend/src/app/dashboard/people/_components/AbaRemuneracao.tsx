"use client";

import { useCallback, useEffect, useState } from "react";
import { useToastStore } from "@/lib/toast";
import {
  salaryService, SituacaoSalarial, RegistroSalarial, MotivoSalario,
  MOTIVOS_SALARIO, PosicaoNaFaixa,
} from "@/lib/people/salary.service";
import {
  Panel, TableCard, EmptyState, LoadingRows, ErrorState, PermissionDenied,
  StatusBadge, BadgeTone, RowActions, RowAction, Modal, FormGrid, FormField, FormActions,
} from "@/components/data-ui";
import { Wallet, Plus, Trash2, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { formatarDataBR } from "@/lib/datas";

/**
 * Remuneração do colaborador.
 *
 * A tela responde três perguntas em ordem: quanto ganha hoje, onde isso cai na
 * faixa do cargo, e como chegou até aqui. A terceira é o que sustenta uma
 * conversa de mérito — sem histórico, "você já teve aumento" vira memória
 * contra memória.
 */

const ROTULO_MOTIVO = new Map(MOTIVOS_SALARIO.map(m => [m.value, m.label]));

const POSICAO: Record<PosicaoNaFaixa, { label: string; tone: BadgeTone } | null> = {
  sem_faixa: null,
  dentro:    { label: "Dentro da faixa", tone: "ok" },
  abaixo:    { label: "Abaixo da faixa", tone: "atencao" },
  acima:     { label: "Acima da faixa",  tone: "info" },
};

const moeda = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtData = (d: string) =>
  formatarDataBR(d);

type Props = {
  collaboratorId: string;
  podeGerenciar: boolean;
};

export default function AbaRemuneracao({ collaboratorId, podeGerenciar }: Props) {
  const [dados, setDados] = useState<SituacaoSalarial | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [registrando, setRegistrando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null); setSemPermissao(false);
    try {
      setDados((await salaryService.situacao(collaboratorId)).data);
    } catch (e: any) {
      setDados(null);
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message || "Não foi possível carregar a remuneração.");
    } finally {
      setCarregando(false);
    }
  }, [collaboratorId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function excluir(r: RegistroSalarial) {
    if (!confirm(
      `Remover o registro de ${moeda(r.valor)} com vigência em ${fmtData(r.vigenciaInicio)}?\n\n` +
      `A remoção fica registrada na linha do tempo.`,
    )) return;
    try {
      await salaryService.excluir(r.id);
      useToastStore.getState().success("Registro removido");
      carregar();
    } catch { /* interceptor */ }
  }

  if (semPermissao) {
    return (
      <PermissionDenied hint="Você não tem permissão para ver a remuneração deste colaborador." />
    );
  }

  const COLUNAS = ["Vigência", "Valor", "Variação", "Motivo", "Cargo na época", ""];
  const faixa = dados?.faixa;
  const posicao = faixa ? POSICAO[faixa.posicao] : null;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {!carregando && dados && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
            <div
              style={{
                padding: "14px 18px", borderRadius: 14, minWidth: 190,
                background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)",
              }}
            >
              <div className="mono-cap" style={{ color: "var(--text-muted)", marginBottom: 6 }}>
                Salário atual
              </div>
              <div className="metric" style={{ fontSize: 24, fontWeight: 600 }}>
                {moeda(dados.vigente?.valor ?? null)}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                {dados.vigente
                  ? `desde ${fmtData(dados.vigente.vigenciaInicio)}`
                  : "nenhum registro"}
              </div>
            </div>

            {faixa && faixa.posicao !== "sem_faixa" && (
              <div
                style={{
                  flex: 1, minWidth: 260, padding: "14px 18px", borderRadius: 14,
                  background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span className="mono-cap" style={{ color: "var(--text-muted)" }}>
                    Faixa de {faixa.titulo}
                  </span>
                  {posicao && <StatusBadge label={posicao.label} tone={posicao.tone} />}
                </div>

                {faixa.percentual !== null ? (
                  <>
                    <div style={{ height: 6, borderRadius: 3, background: "var(--bg-hover)", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${faixa.percentual}%`, height: "100%",
                          background: faixa.posicao === "dentro" ? "var(--accent-violet)" : "var(--accent-amber)",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>
                      <span className="num">{moeda(faixa.minimo)}</span>
                      <span className="metric">{faixa.percentual}% da faixa</span>
                      <span className="num">{moeda(faixa.maximo)}</span>
                    </div>
                  </>
                ) : (
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: 0 }}>
                    O cargo precisa de mínimo e máximo para posicionar o salário na faixa.
                  </p>
                )}
              </div>
            )}

            {/* Mérito parado é motivo de saída — vale um alerta explícito. */}
            {dados.semReajusteHa !== null && (
              <div
                style={{
                  flex: 1, minWidth: 240, display: "flex", gap: 10, alignItems: "flex-start",
                  padding: "13px 15px", borderRadius: 14,
                  background: "color-mix(in srgb, var(--accent-amber) 8%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--accent-amber) 24%, transparent)",
                }}
              >
                <AlertTriangle size={15} style={{ color: "var(--accent-amber)", flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 2 }}>
                    <span className="metric">{dados.semReajusteHa}</span> meses sem reajuste
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    Vale revisar antes que vire pedido de desligamento.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <Panel
          title={`HISTÓRICO SALARIAL (${dados?.historico.length ?? 0})`}
          actions={
            podeGerenciar && (
              <button type="button" className="btn btn-ghost" onClick={() => setRegistrando(true)}>
                <Plus size={13} /> Registrar mudança
              </button>
            )
          }
        >
          <TableCard>
            <thead><tr>{COLUNAS.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
            <tbody>
              {carregando ? (
                <LoadingRows colSpan={COLUNAS.length} rows={3} />
              ) : erro ? (
                <ErrorState detail={erro} onRetry={carregar} colSpan={COLUNAS.length} />
              ) : !dados?.historico.length ? (
                <EmptyState
                  colSpan={COLUNAS.length}
                  icon={<Wallet size={20} />}
                  title="Nenhum salário registrado"
                  hint={podeGerenciar ? "Comece pelo salário de admissão para o histórico fazer sentido." : undefined}
                />
              ) : (
                dados.historico.map(r => {
                  const futuro = new Date(r.vigenciaInicio) > new Date();
                  return (
                    <tr key={r.id} style={{ opacity: futuro ? 0.65 : 1 }}>
                      <td className="num">
                        {fmtData(r.vigenciaInicio)}
                        {/* Combinado e ainda não vigente: não conta no custo de hoje. */}
                        {futuro && (
                          <div style={{ marginTop: 3 }}>
                            <StatusBadge label="A partir de" tone="info" />
                          </div>
                        )}
                      </td>
                      <td className="num" style={{ fontWeight: 600 }}>{moeda(r.valor)}</td>
                      <td>
                        {r.variacaoPercentual === null ? (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5,
                              color: r.variacaoPercentual >= 0 ? "var(--accent-green, #16a34a)" : "var(--accent-red)",
                            }}
                          >
                            {r.variacaoPercentual >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            <span className="metric">
                              {r.variacaoPercentual > 0 ? "+" : ""}{r.variacaoPercentual}%
                            </span>
                          </span>
                        )}
                      </td>
                      <td>
                        {ROTULO_MOTIVO.get(r.motivo) ?? r.motivo}
                        {r.observacoes && (
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                            {r.observacoes}
                          </div>
                        )}
                      </td>
                      <td>{r.cargo || "—"}</td>
                      <td>
                        {podeGerenciar && (
                          <RowActions>
                            <RowAction tone="danger" title="Remover" onClick={() => excluir(r)}>
                              <Trash2 size={13} />
                            </RowAction>
                          </RowActions>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </TableCard>
        </Panel>
      </div>

      <RegistrarSalario
        aberto={registrando}
        collaboratorId={collaboratorId}
        atual={dados?.vigente?.valor ?? null}
        onFechar={() => setRegistrando(false)}
        onRegistrado={carregar}
      />
    </>
  );
}

function RegistrarSalario({
  aberto, collaboratorId, atual, onFechar, onRegistrado,
}: {
  aberto: boolean;
  collaboratorId: string;
  atual: number | null;
  onFechar: () => void;
  onRegistrado: () => void;
}) {
  const [valor, setValor] = useState("");
  const [vigencia, setVigencia] = useState("");
  const [motivo, setMotivo] = useState<MotivoSalario>("merito");
  const [observacoes, setObservacoes] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setValor("");
    setVigencia(new Date().toISOString().slice(0, 10));
    setMotivo(atual === null ? "admissao" : "merito");
    setObservacoes("");
    setErros({});
  }, [aberto, atual]);

  const numero = Number(valor);
  const variacao =
    atual !== null && Number.isFinite(numero) && numero > 0 && atual > 0
      ? Math.round(((numero - atual) / atual) * 1000) / 10
      : null;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const novos: Record<string, string> = {};
    if (!Number.isFinite(numero) || numero <= 0) novos.valor = "Informe um valor maior que zero";
    if (!vigencia) novos.vigencia = "Informe a data de vigência";
    // Espelha a regra do backend para o erro aparecer antes da viagem.
    if (atual !== null && numero > 0 && numero < atual && motivo !== "reducao") {
      novos.motivo = 'Valor menor que o atual exige o motivo "Redução"';
    }
    setErros(novos);
    if (Object.keys(novos).length) return;

    setSalvando(true);
    try {
      await salaryService.registrar(collaboratorId, {
        valor: numero, vigenciaInicio: vigencia, motivo, observacoes,
      });
      useToastStore.getState().success("Mudança salarial registrada");
      onRegistrado();
      onFechar();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (err?.response?.status === 400 && msg) {
        setErros({ valor: Array.isArray(msg) ? msg.join(". ") : msg });
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      titulo="Registrar mudança salarial"
      subtitulo={atual !== null ? `Atual: ${moeda(atual)}` : "Primeiro registro deste colaborador"}
      onFechar={onFechar}
      largura={540}
    >
      <form onSubmit={salvar} noValidate>
        <FormGrid>
          <FormField label="Novo valor" obrigatorio erro={erros.valor}>
            <input
              type="number" className="input-o" min={0} step="0.01" autoFocus
              value={valor} onChange={e => setValor(e.target.value)}
            />
          </FormField>

          <FormField
            label="Vigência a partir de"
            obrigatorio
            erro={erros.vigencia}
            dica="Data futura é permitida e não altera o salário de hoje"
          >
            <input
              type="date" className="input-o"
              value={vigencia} onChange={e => setVigencia(e.target.value)}
            />
          </FormField>

          <FormField label="Motivo" obrigatorio erro={erros.motivo} largura="total">
            <select
              className="input-o" value={motivo}
              onChange={e => setMotivo(e.target.value as MotivoSalario)}
            >
              {MOTIVOS_SALARIO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </FormField>

          {variacao !== null && (
            <div
              style={{
                gridColumn: "1 / -1", padding: "11px 13px", borderRadius: 10,
                background: "var(--bg-hover)", border: "1px solid var(--border-subtle)",
                fontSize: 12.5, color: "var(--text-secondary)",
              }}
            >
              Variação de{" "}
              <strong
                className="metric"
                style={{ color: variacao >= 0 ? "var(--accent-green, #16a34a)" : "var(--accent-red)" }}
              >
                {variacao > 0 ? "+" : ""}{variacao}%
              </strong>
              {" — de "}{moeda(atual)}{" para "}{moeda(numero)}.
            </div>
          )}

          <FormField label="Observações" largura="total">
            <textarea
              className="input-o" rows={2} maxLength={500}
              value={observacoes} onChange={e => setObservacoes(e.target.value)}
              placeholder="Contexto da decisão — opcional, mas ajuda na próxima revisão"
            />
          </FormField>
        </FormGrid>

        <FormActions>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? "Registrando..." : "Registrar"}
          </button>
        </FormActions>
      </form>
    </Modal>
  );
}
