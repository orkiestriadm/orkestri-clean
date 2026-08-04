"use client";

import { useEffect, useState } from "react";
import { useToastStore } from "@/lib/toast";
import { useTrainings, useReviews } from "@/hooks/usePeopleExtras";
import {
  developmentService, Curso, Participacao, Avaliacao,
  StatusTreinamento, SituacaoCertificacao,
} from "@/lib/people/development.service";
import {
  Panel, TableCard, EmptyState, LoadingRows, ErrorState, PermissionDenied,
  StatusBadge, BadgeTone, RowActions, RowAction, Modal, FormGrid, FormField, FormActions,
} from "@/components/data-ui";
import { Plus, GraduationCap, Award, CheckCircle2, Target, Lock, Users } from "lucide-react";
import Painel360 from "./Painel360";
import { formatarDataBR } from "@/lib/datas";

/**
 * Desenvolvimento: treinamentos e avaliações.
 *
 * Duas seções na mesma aba, com permissões diferentes. Quem cuida de
 * capacitação não necessariamente pode ler nota de desempenho, então cada
 * bloco some sozinho — a aba não vira tudo-ou-nada.
 */

const STATUS_TREINAMENTO: Record<StatusTreinamento, { label: string; tone: BadgeTone }> = {
  PLANEJADO:    { label: "Planejado",    tone: "neutro" },
  EM_ANDAMENTO: { label: "Em andamento", tone: "info" },
  CONCLUIDO:    { label: "Concluído",    tone: "ok" },
  CANCELADO:    { label: "Cancelado",    tone: "critico" },
};

const CERTIFICACAO: Record<SituacaoCertificacao, { label: string; tone: BadgeTone } | null> = {
  sem_validade:   null,
  vigente:        null,
  vence_em_breve: { label: "Vence em breve", tone: "atencao" },
  vencida:        { label: "Vencida",        tone: "critico" },
};

const fmtData = (d: string | null) =>
  d ? formatarDataBR(d) : "—";

type Props = {
  collaboratorId: string;
  podeGerenciarTreinamento: boolean;
  podeVerAvaliacao: boolean;
  podeGerenciarAvaliacao: boolean;
};

export default function AbaDesenvolvimento({
  collaboratorId, podeGerenciarTreinamento, podeVerAvaliacao, podeGerenciarAvaliacao,
}: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SecaoTreinamentos
        collaboratorId={collaboratorId}
        podeGerenciar={podeGerenciarTreinamento}
      />
      {podeVerAvaliacao && (
        <SecaoAvaliacoes
          collaboratorId={collaboratorId}
          podeGerenciar={podeGerenciarAvaliacao}
        />
      )}
    </div>
  );
}

/* ── Treinamentos ─────────────────────────────────────────────────────────── */

function SecaoTreinamentos({
  collaboratorId, podeGerenciar,
}: { collaboratorId: string; podeGerenciar: boolean }) {
  const { dados, carregando, erro, semPermissao, recarregar } = useTrainings(collaboratorId);
  const [registrando, setRegistrando] = useState(false);
  const [concluindo, setConcluindo] = useState<Participacao | null>(null);

  if (semPermissao) {
    return <PermissionDenied hint="Você não tem permissão para ver os treinamentos deste colaborador." />;
  }

  const COLUNAS = ["Curso", "Carga", "Início", "Conclusão", "Validade", "Situação", ""];

  return (
    <>
      <Panel
        title={`TREINAMENTOS (${dados.length})`}
        actions={
          podeGerenciar && (
            <button type="button" className="btn btn-ghost" onClick={() => setRegistrando(true)}>
              <Plus size={13} /> Registrar
            </button>
          )
        }
      >
        <TableCard>
          <thead>
            <tr>{COLUNAS.map((c, i) => <th key={i}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {carregando ? (
              <LoadingRows colSpan={COLUNAS.length} rows={3} />
            ) : erro ? (
              <ErrorState detail={erro} onRetry={recarregar} colSpan={COLUNAS.length} />
            ) : dados.length === 0 ? (
              <EmptyState
                colSpan={COLUNAS.length}
                icon={<GraduationCap size={20} />}
                title="Nenhum treinamento registrado"
                hint={podeGerenciar ? "Registre cursos, certificações e capacitações." : undefined}
              />
            ) : (
              dados.map(t => {
                const status = STATUS_TREINAMENTO[t.status];
                const cert = CERTIFICACAO[t.situacaoCertificacao];
                return (
                  <tr key={t.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{t.training.nome}</div>
                      {t.training.fornecedor && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                          {t.training.fornecedor}
                        </div>
                      )}
                    </td>
                    <td className="num">{t.training.cargaHoraria ? `${t.training.cargaHoraria}h` : "—"}</td>
                    <td className="num">{fmtData(t.inicio)}</td>
                    <td className="num">{fmtData(t.conclusao)}</td>
                    <td className="num">
                      {fmtData(t.validade)}
                      {cert && (
                        <div style={{ marginTop: 3 }}>
                          <StatusBadge label={cert.label} tone={cert.tone} />
                        </div>
                      )}
                    </td>
                    <td><StatusBadge label={status.label} tone={status.tone} /></td>
                    <td>
                      {/* Concluído e cancelado são finais: nada a fazer. */}
                      {podeGerenciar && (t.status === "PLANEJADO" || t.status === "EM_ANDAMENTO") && (
                        <RowActions>
                          <RowAction tone="view" title="Concluir" onClick={() => setConcluindo(t)}>
                            <CheckCircle2 size={13} />
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

      <RegistrarTreinamento
        aberto={registrando}
        collaboratorId={collaboratorId}
        onFechar={() => setRegistrando(false)}
        onRegistrado={recarregar}
      />
      <ConcluirTreinamento
        participacao={concluindo}
        onFechar={() => setConcluindo(null)}
        onConcluido={recarregar}
      />
    </>
  );
}

function RegistrarTreinamento({
  aberto, collaboratorId, onFechar, onRegistrado,
}: { aberto: boolean; collaboratorId: string; onFechar: () => void; onRegistrado: () => void }) {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [trainingId, setTrainingId] = useState("");
  const [status, setStatus] = useState<StatusTreinamento>("PLANEJADO");
  const [inicio, setInicio] = useState("");
  const [conclusao, setConclusao] = useState("");
  const [certificadoRef, setCertificadoRef] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setTrainingId(""); setStatus("PLANEJADO"); setInicio(""); setConclusao("");
    setCertificadoRef(""); setErros({});
    developmentService.cursos().then(r => setCursos(r.data ?? [])).catch(() => setCursos([]));
  }, [aberto]);

  const curso = cursos.find(c => c.id === trainingId);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const novos: Record<string, string> = {};
    if (!trainingId) novos.trainingId = "Escolha o curso";
    if (status === "CONCLUIDO" && !conclusao) novos.conclusao = "Informe a data de conclusão";
    setErros(novos);
    if (Object.keys(novos).length) return;

    setSalvando(true);
    try {
      await developmentService.registrar(collaboratorId, {
        trainingId, status, inicio, conclusao, certificadoRef,
      });
      useToastStore.getState().success("Treinamento registrado");
      onRegistrado();
      onFechar();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (err?.response?.status === 400 && msg) {
        setErros({ trainingId: Array.isArray(msg) ? msg.join(". ") : msg });
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto={aberto} titulo="Registrar treinamento" onFechar={onFechar} largura={540}>
      <form onSubmit={salvar} noValidate>
        <FormGrid>
          <FormField label="Curso" obrigatorio erro={erros.trainingId} largura="total">
            <select className="input-o" value={trainingId} onChange={e => setTrainingId(e.target.value)}>
              <option value="">—</option>
              {cursos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </FormField>

          <FormField label="Situação">
            <select
              className="input-o" value={status}
              onChange={e => setStatus(e.target.value as StatusTreinamento)}
            >
              <option value="PLANEJADO">Planejado</option>
              <option value="EM_ANDAMENTO">Em andamento</option>
              <option value="CONCLUIDO">Concluído</option>
            </select>
          </FormField>

          <FormField label="Início">
            <input type="date" className="input-o" value={inicio} onChange={e => setInicio(e.target.value)} />
          </FormField>

          {status === "CONCLUIDO" && (
            <>
              <FormField
                label="Conclusão"
                obrigatorio
                erro={erros.conclusao}
                dica={
                  curso?.validadeMeses
                    ? `Certificado válido por ${curso.validadeMeses} meses a partir daqui`
                    : undefined
                }
              >
                <input
                  type="date" className="input-o"
                  value={conclusao} onChange={e => setConclusao(e.target.value)}
                />
              </FormField>

              <FormField label="Referência do certificado">
                <input
                  className="input-o" maxLength={160}
                  value={certificadoRef} onChange={e => setCertificadoRef(e.target.value)}
                  placeholder="Número ou código"
                />
              </FormField>
            </>
          )}
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

function ConcluirTreinamento({
  participacao, onFechar, onConcluido,
}: { participacao: Participacao | null; onFechar: () => void; onConcluido: () => void }) {
  const [conclusao, setConclusao] = useState("");
  const [certificadoRef, setCertificadoRef] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!participacao) return;
    setConclusao(new Date().toISOString().slice(0, 10));
    setCertificadoRef(participacao.certificadoRef ?? "");
    setErro("");
  }, [participacao]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!participacao || !conclusao) { setErro("Informe a data de conclusão"); return; }

    setSalvando(true);
    try {
      await developmentService.atualizarParticipacao(participacao.id, {
        status: "CONCLUIDO", conclusao, certificadoRef,
      });
      useToastStore.getState().success("Treinamento concluído");
      onConcluido();
      onFechar();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (err?.response?.status === 400 && msg) setErro(Array.isArray(msg) ? msg.join(". ") : msg);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={!!participacao}
      titulo="Concluir treinamento"
      subtitulo={participacao?.training.nome}
      onFechar={onFechar}
      largura={430}
    >
      <form onSubmit={salvar} noValidate>
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6, marginTop: 0 }}>
          A validade do certificado é calculada a partir desta data e fica
          gravada. Concluído é registro final — não é possível reabrir.
        </p>

        <FormGrid>
          <FormField label="Conclusão" obrigatorio erro={erro} largura="total">
            <input type="date" className="input-o" value={conclusao} onChange={e => setConclusao(e.target.value)} />
          </FormField>
          <FormField label="Referência do certificado" largura="total">
            <input
              className="input-o" maxLength={160}
              value={certificadoRef} onChange={e => setCertificadoRef(e.target.value)}
            />
          </FormField>
        </FormGrid>

        <FormActions>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? "Concluindo..." : "Concluir"}
          </button>
        </FormActions>
      </form>
    </Modal>
  );
}

/* ── Avaliações ───────────────────────────────────────────────────────────── */

function SecaoAvaliacoes({
  collaboratorId, podeGerenciar,
}: { collaboratorId: string; podeGerenciar: boolean }) {
  const { dados, carregando, erro, semPermissao, recarregar } = useReviews(collaboratorId);
  const [editando, setEditando] = useState<Avaliacao | "nova" | null>(null);

  if (semPermissao) return null;

  return (
    <>
      <Panel
        title={`AVALIAÇÕES DE DESEMPENHO (${dados.length})`}
        actions={
          podeGerenciar && (
            <button type="button" className="btn btn-ghost" onClick={() => setEditando("nova")}>
              <Plus size={13} /> Nova avaliação
            </button>
          )
        }
      >
        {carregando ? (
          <div className="skeleton" style={{ height: 90, borderRadius: 12 }} />
        ) : erro ? (
          <p style={{ fontSize: 12.5, color: "var(--accent-red)", margin: 0 }}>{erro}</p>
        ) : dados.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>
            Nenhuma avaliação registrada.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {dados.map(a => (
              <CartaoAvaliacao
                key={a.id}
                avaliacao={a}
                collaboratorId={collaboratorId}
                podeGerenciar={podeGerenciar}
                onEditar={() => setEditando(a)}
                onMudou={recarregar}
              />
            ))}
          </div>
        )}
      </Panel>

      <FormAvaliacao
        alvo={editando}
        collaboratorId={collaboratorId}
        onFechar={() => setEditando(null)}
        onSalvo={recarregar}
      />
    </>
  );
}

function CartaoAvaliacao({
  avaliacao, collaboratorId, podeGerenciar, onEditar, onMudou,
}: {
  avaliacao: Avaliacao; collaboratorId: string; podeGerenciar: boolean;
  onEditar: () => void; onMudou: () => void;
}) {
  const finalizada = avaliacao.status === "FINALIZADA";
  const [ver360, setVer360] = useState(false);

  async function finalizar() {
    if (!confirm(
      `Finalizar a avaliação ${avaliacao.ciclo}? Depois disso ela não pode mais ser alterada.`,
    )) return;
    try {
      await developmentService.finalizarAvaliacao(avaliacao.id);
      useToastStore.getState().success("Avaliação finalizada");
      onMudou();
    } catch { /* interceptor */ }
  }

  return (
    <div
      style={{
        padding: "14px 16px", borderRadius: 12,
        background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Ciclo {avaliacao.ciclo}</span>
        <StatusBadge
          label={finalizada ? "Finalizada" : "Rascunho"}
          tone={finalizada ? "ok" : "atencao"}
        />
        {avaliacao.nota !== null && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5 }}>
            <Award size={13} style={{ color: "var(--accent-violet)" }} />
            <span className="metric" style={{ fontWeight: 600 }}>{avaliacao.nota}</span>
            <span style={{ color: "var(--text-muted)" }}>/ 5</span>
          </span>
        )}
        <span style={{ flex: 1 }} />
        {/* Disponível também na finalizada: depois de fechado o ciclo, o 360
            continua sendo o registro da conversa — só não recebe resposta nova. */}
        <button type="button" className="btn btn-ghost" onClick={() => setVer360(true)}>
          <Users size={12} /> 360
        </button>
        {podeGerenciar && !finalizada && (
          <>
            <button type="button" className="btn btn-ghost" onClick={onEditar}>Editar</button>
            <button type="button" className="btn btn-ghost" onClick={finalizar}>
              <Lock size={12} /> Finalizar
            </button>
          </>
        )}
      </div>

      {ver360 && (
        <Painel360
          reviewId={avaliacao.id}
          ciclo={avaliacao.ciclo}
          collaboratorId={collaboratorId}
          // Convidar e remover são escrita: seguem a permissão de gerenciar
          // avaliação, e não a de apenas ver.
          podeGerenciar={podeGerenciar && !finalizada}
          onFechar={() => setVer360(false)}
        />
      )}

      {avaliacao.avaliadorNome && (
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 8 }}>
          Avaliado por {avaliacao.avaliadorNome}
        </div>
      )}

      {avaliacao.metas.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Target size={12} style={{ color: "var(--text-muted)" }} />
            <span style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
              {avaliacao.metas.length} {avaliacao.metas.length === 1 ? "meta" : "metas"} ·{" "}
              <span className="metric">{avaliacao.progressoMetas}%</span> concluído
              <span style={{ color: "var(--text-muted)" }}> (ponderado pelo peso)</span>
            </span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: "var(--bg-hover)", overflow: "hidden" }}>
            <div
              style={{
                width: `${avaliacao.progressoMetas}%`, height: "100%",
                background: "var(--accent-violet)", transition: "width .3s",
              }}
            />
          </div>
        </div>
      )}

      {(avaliacao.pontosFortes || avaliacao.pontosMelhoria) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 12 }}>
          {avaliacao.pontosFortes && (
            <div>
              <div className="mono-cap" style={{ color: "var(--text-muted)", marginBottom: 3 }}>Pontos fortes</div>
              <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{avaliacao.pontosFortes}</div>
            </div>
          )}
          {avaliacao.pontosMelhoria && (
            <div>
              <div className="mono-cap" style={{ color: "var(--text-muted)", marginBottom: 3 }}>A desenvolver</div>
              <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{avaliacao.pontosMelhoria}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FormAvaliacao({
  alvo, collaboratorId, onFechar, onSalvo,
}: {
  alvo: Avaliacao | "nova" | null;
  collaboratorId: string;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const edicao = alvo && alvo !== "nova" ? alvo : null;
  const [ciclo, setCiclo] = useState("");
  const [nota, setNota] = useState("");
  const [pontosFortes, setPontosFortes] = useState("");
  const [pontosMelhoria, setPontosMelhoria] = useState("");
  const [comentarios, setComentarios] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!alvo) return;
    setCiclo(edicao?.ciclo ?? `${new Date().getFullYear()}.${new Date().getMonth() < 6 ? 1 : 2}`);
    setNota(edicao?.nota?.toString() ?? "");
    setPontosFortes(edicao?.pontosFortes ?? "");
    setPontosMelhoria(edicao?.pontosMelhoria ?? "");
    setComentarios(edicao?.comentarios ?? "");
    setErros({});
  }, [alvo, edicao]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}(\.[12])?$/.test(ciclo.trim())) {
      setErros({ ciclo: 'Use o formato "2026" ou "2026.1"' });
      return;
    }

    setSalvando(true);
    try {
      await developmentService.salvarAvaliacao(collaboratorId, {
        ciclo,
        nota: nota === "" ? null : Number(nota),
        pontosFortes, pontosMelhoria, comentarios,
      });
      useToastStore.getState().success("Avaliação salva");
      onSalvo();
      onFechar();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (err?.response?.status === 400 && msg) {
        setErros({ ciclo: Array.isArray(msg) ? msg.join(". ") : msg });
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={!!alvo}
      titulo={edicao ? `Avaliação ${edicao.ciclo}` : "Nova avaliação"}
      subtitulo="Salvar mantém em rascunho — finalizar é uma ação separada"
      onFechar={onFechar}
      largura={560}
    >
      <form onSubmit={salvar} noValidate>
        <FormGrid>
          <FormField label="Ciclo" obrigatorio erro={erros.ciclo} dica='Ex.: "2026.1"'>
            <input
              className="input-o" maxLength={10} value={ciclo}
              onChange={e => setCiclo(e.target.value)}
              // Ciclo é a chave da avaliação: mudá-lo em edição criaria outra.
              disabled={!!edicao}
            />
          </FormField>

          <FormField label="Nota" dica="0 a 5 — obrigatória para finalizar">
            <input
              type="number" className="input-o" min={0} max={5} step="0.1"
              value={nota} onChange={e => setNota(e.target.value)}
            />
          </FormField>

          <FormField label="Pontos fortes" largura="total">
            <textarea
              className="input-o" rows={3} maxLength={2000}
              value={pontosFortes} onChange={e => setPontosFortes(e.target.value)}
            />
          </FormField>

          <FormField label="A desenvolver" largura="total">
            <textarea
              className="input-o" rows={3} maxLength={2000}
              value={pontosMelhoria} onChange={e => setPontosMelhoria(e.target.value)}
            />
          </FormField>

          <FormField label="Comentários" largura="total">
            <textarea
              className="input-o" rows={2} maxLength={2000}
              value={comentarios} onChange={e => setComentarios(e.target.value)}
            />
          </FormField>
        </FormGrid>

        <FormActions>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar rascunho"}
          </button>
        </FormActions>
      </form>
    </Modal>
  );
}
