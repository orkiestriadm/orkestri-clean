"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import {
  PageBody, BackLink, DetailHeader, Panel, Field, FieldGrid, ErrorState, StatusBadge,
} from "@/components/data-ui";
import {
  feedbackDesempenhoService, DetalheFeedbackDesempenho, ROTULO_EVENTO, formatarDataHora,
} from "@/lib/people/feedback-desempenho.service";
import { AlertTriangle, CalendarClock, CalendarCheck, Pencil, Trash2, Check, X } from "lucide-react";
import EtapasFeedback, { TOM_STATUS } from "../../_components/EtapasFeedback";
import {
  AgendarReuniao, DecidirExclusao, EditarFeedback, RegistrarReuniao, SolicitarExclusao,
} from "../../_components/ModaisFeedback";

/**
 * Detalhe do feedback — as quatro etapas do RH em blocos, na ordem em que
 * acontecem, com a linha do tempo ao final.
 *
 * Os botões vêm de `acoes`, calculadas pelo backend a partir da etapa e do
 * papel de quem está vendo. A tela não decide o que pode: só mostra o que o
 * servidor já liberou, e o servidor confere de novo ao receber.
 */

type Modal = "editar" | "agendar" | "realizar" | "excluir" | "aprovar" | "reprovar" | null;

function Texto({ children }: { children: string | null | undefined }) {
  if (!children) return <span style={{ color: "var(--text-muted)" }}>—</span>;
  return <span style={{ display: "block", fontSize: 13, lineHeight: 1.65, whiteSpace: "pre-wrap", color: "var(--text-primary)" }}>{children}</span>;
}

function Aviso({ tom, children }: { tom: "amber" | "red" | "muted"; children: React.ReactNode }) {
  const cor = tom === "amber" ? "var(--accent-amber)" : tom === "red" ? "var(--accent-red)" : "var(--text-muted)";
  return (
    <div
      style={{
        display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 12, marginBottom: 16,
        background: `color-mix(in srgb, ${cor} 8%, transparent)`,
        border: `1px solid color-mix(in srgb, ${cor} 26%, transparent)`,
        fontSize: 12.5, lineHeight: 1.6, color: "var(--text-secondary)",
      }}
    >
      <AlertTriangle size={15} style={{ color: cor, flexShrink: 0, marginTop: 2 }} />
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

export default function DetalheFeedbackPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [f, setF] = useState<DetalheFeedbackDesempenho | null>(null);
  const [erro, setErro] = useState("");
  const [modal, setModal] = useState<Modal>(null);

  const carregar = useCallback(async () => {
    setErro("");
    try {
      setF((await feedbackDesempenhoService.obter(id)).data);
    } catch (e: any) {
      setErro(
        e?.response?.status === 404
          ? "Este feedback não existe, foi excluído ou não está no seu alcance."
          : e?.response?.data?.message || "Não foi possível carregar o feedback.",
      );
    }
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  const fechar = () => setModal(null);
  const concluir = () => { setModal(null); carregar(); };

  if (erro) {
    return (
      <>
        <Topbar />
        <PageBody>
          <BackLink href="/dashboard/people/avaliacao-desempenho" label="Avaliação de Desempenho" />
          <ErrorState detail={erro} onRetry={carregar} />
        </PageBody>
      </>
    );
  }

  if (!f) {
    return (
      <>
        <Topbar />
        <PageBody>
          <BackLink href="/dashboard/people/avaliacao-desempenho" label="Avaliação de Desempenho" />
          <div className="skeleton" style={{ height: 220, borderRadius: 14 }} />
        </PageBody>
      </>
    );
  }

  const pode = (a: string) => f.acoes.includes(a as any);
  const pendente = f.exclusao?.status === "PENDENTE";
  const reprovada = f.exclusao?.status === "REPROVADA";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href="/dashboard/people/avaliacao-desempenho" label="Avaliação de Desempenho" />

          <DetailHeader
            titulo={`Feedback — ${f.colaborador.nome}`}
            subtitulo={[f.colaborador.cargo, `Gestor: ${f.gestor.nome}`].filter(Boolean).join(" · ")}
            selo={<StatusBadge label={f.rotuloStatus} tone={TOM_STATUS[f.status]} />}
            meta={<span className="num">Registrado em {formatarDataHora(f.criadoEm)}</span>}
            actions={
              <>
                {pode("editar") && (
                  <button type="button" className="btn btn-ghost" onClick={() => setModal("editar")}>
                    <Pencil size={13} /> Editar
                  </button>
                )}
                {pode("solicitar_exclusao") && (
                  <button type="button" className="btn btn-ghost" onClick={() => setModal("excluir")}>
                    <Trash2 size={13} /> Pedir exclusão
                  </button>
                )}
              </>
            }
          />

          <EtapasFeedback status={f.status} />

          {pendente && (
            <Aviso tom="red">
              <strong style={{ color: "var(--text-primary)" }}>Exclusão aguardando o RH.</strong>{" "}
              Pedida em {formatarDataHora(f.exclusao!.solicitadaEm)}. Motivo: {f.exclusao!.motivo}
              <br />O feedback fica parado nesta etapa até a decisão.
              {pode("decidir_exclusao") && (
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button type="button" className="btn btn-danger" onClick={() => setModal("aprovar")}>
                    <Check size={13} /> Aprovar exclusão
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setModal("reprovar")}>
                    <X size={13} /> Reprovar
                  </button>
                </div>
              )}
            </Aviso>
          )}
          {reprovada && (
            <Aviso tom="muted">
              O RH reprovou o pedido de exclusão em {formatarDataHora(f.exclusao!.decididaEm)}.
              {f.exclusao!.parecer ? ` Parecer: ${f.exclusao!.parecer}` : ""}
            </Aviso>
          )}

          <div style={{ display: "grid", gap: 16 }}>
            <Panel title="1 · REGISTRO DO GESTOR">
              <div style={{ display: "grid", gap: 16 }}>
                <Field label="Pontos fortes" value={<Texto>{f.pontosFortes}</Texto>} />
                <Field label="Oportunidades de desenvolvimento" value={<Texto>{f.oportunidades}</Texto>} />
              </div>
            </Panel>

            <Panel
              title="2 · REUNIÃO DE FEEDBACK"
              actions={
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(pode("agendar_reuniao") || pode("reagendar_reuniao")) && (
                    <button type="button" className={`btn ${pode("agendar_reuniao") ? "btn-primary" : "btn-ghost"}`} onClick={() => setModal("agendar")}>
                      <CalendarClock size={13} /> {pode("agendar_reuniao") ? "Agendar reunião" : "Remarcar"}
                    </button>
                  )}
                  {pode("registrar_reuniao") && (
                    <button type="button" className="btn btn-primary" onClick={() => setModal("realizar")}>
                      <CalendarCheck size={13} /> Registrar reunião realizada
                    </button>
                  )}
                </div>
              }
            >
              {f.status === "REGISTRADO" ? (
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  Agende a conversa individual para apresentar o feedback, esclarecer dúvidas e alinhar expectativas e próximos passos.
                </p>
              ) : (
                <div style={{ display: "grid", gap: 16 }}>
                  <FieldGrid>
                    <Field label="Agendada para" value={formatarDataHora(f.reuniaoInicio)} />
                    <Field label="Local ou link" value={f.reuniaoLocal} />
                    <Field label="Realizada em" value={f.reuniaoRealizadaEm ? formatarDataHora(f.reuniaoRealizadaEm) : null} />
                  </FieldGrid>
                  {f.reuniaoRealizadaEm && (
                    <Field label="Expectativas e próximos passos" value={<Texto>{f.alinhamentos}</Texto>} />
                  )}
                </div>
              )}
            </Panel>

            <Panel title="3 · CIÊNCIA DO COLABORADOR">
              {f.cienciaEm ? (
                <div style={{ display: "grid", gap: 16 }}>
                  <Field label="Ciência registrada em" value={formatarDataHora(f.cienciaEm)} />
                  <Field label="Comentário do colaborador" value={f.comentarioColaborador ? <Texto>{f.comentarioColaborador}</Texto> : "Sem comentário"} />
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  {f.status === "AGUARDANDO_CIENCIA"
                    ? `${f.colaborador.nome} já pode ler o feedback no Meu RH e registrar ciência.`
                    : "Liberada depois que a reunião for registrada como realizada."}
                </p>
              )}
            </Panel>

            <Panel title="4 · ENCERRAMENTO">
              <p style={{ margin: 0, fontSize: 12.5, color: f.status === "ENCERRADO" ? "var(--text-secondary)" : "var(--text-muted)", lineHeight: 1.6 }}>
                {f.status === "ENCERRADO"
                  ? `Processo finalizado em ${formatarDataHora(f.cienciaEm)}, formalizando os alinhamentos entre ${f.gestor.nome} e ${f.colaborador.nome}.`
                  : "O processo é encerrado automaticamente quando o colaborador registra ciência."}
              </p>
            </Panel>

            <Panel title="LINHA DO TEMPO">
              <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
                {f.eventos.map(e => (
                  <li key={e.id} style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12, fontSize: 12.5 }}>
                    <span className="num" style={{ color: "var(--text-muted)" }}>{formatarDataHora(e.criadoEm)}</span>
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{ROTULO_EVENTO[e.tipo] ?? e.tipo}</strong>
                      {e.autorNome && <span style={{ color: "var(--text-muted)" }}> · {e.autorNome}</span>}
                      {e.detalhe && <div style={{ color: "var(--text-secondary)", marginTop: 2, whiteSpace: "pre-wrap" }}>{e.detalhe}</div>}
                    </span>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>
        </PageBody>
      </div>

      <EditarFeedback aberto={modal === "editar"} feedback={f} onFechar={fechar} onFeito={concluir} />
      <AgendarReuniao aberto={modal === "agendar"} feedback={f} onFechar={fechar} onFeito={concluir} />
      <RegistrarReuniao aberto={modal === "realizar"} feedback={f} onFechar={fechar} onFeito={concluir} />
      <SolicitarExclusao aberto={modal === "excluir"} feedback={f} onFechar={fechar} onFeito={concluir} />
      <DecidirExclusao
        aberto={modal === "aprovar" || modal === "reprovar"}
        aprovar={modal === "aprovar"}
        feedback={f}
        onFechar={fechar}
        onFeito={excluido => {
          setModal(null);
          if (excluido) router.push("/dashboard/people/avaliacao-desempenho");
          else carregar();
        }}
      />
    </div>
  );
}
