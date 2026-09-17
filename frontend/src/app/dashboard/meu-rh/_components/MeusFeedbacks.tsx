"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel, StatusBadge, ErrorState, Modal, FormField, FormActions } from "@/components/data-ui";
import { useToastStore } from "@/lib/toast";
import {
  feedbackDesempenhoService, MeuFeedbackDesempenho, formatarDataHora,
} from "@/lib/people/feedback-desempenho.service";
import { TOM_STATUS } from "../../people/avaliacao-desempenho/_components/EtapasFeedback";
import { MessagesSquare, CalendarClock } from "lucide-react";
import Vazio from "./Vazio";

/**
 * Meus feedbacks — a etapa 3 do fluxo do RH, pela ótica de quem recebe.
 *
 * Antes da reunião aparece só o agendamento: o texto é liberado depois da
 * conversa, como o RH descreve. Depois dela, a pessoa lê tudo e registra
 * ciência, com comentário se quiser.
 */

function Bloco({ titulo, texto }: { titulo: string; texto: string | null }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <span className="mono-cap" style={{ fontSize: 10.5, color: "var(--text-muted)", letterSpacing: "0.08em" }}>{titulo}</span>
      <span style={{ fontSize: 13, lineHeight: 1.65, whiteSpace: "pre-wrap", color: "var(--text-primary)" }}>{texto || "—"}</span>
    </div>
  );
}

export default function MeusFeedbacks() {
  const [itens, setItens] = useState<MeuFeedbackDesempenho[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [dandoCiencia, setDandoCiencia] = useState<MeuFeedbackDesempenho | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try {
      setItens((await feedbackDesempenhoService.meus()).data ?? []);
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? "Não foi possível carregar os seus feedbacks.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (erro) return <ErrorState detail={erro} onRetry={carregar} />;
  if (carregando) return <Panel><div className="skeleton" style={{ height: 90, borderRadius: 12 }} /></Panel>;

  if (itens.length === 0) {
    return (
      <Panel>
        <Vazio
          icon={<MessagesSquare size={28} />}
          titulo="Nenhum feedback por enquanto"
          dica="Quando seu gestor agendar uma reunião de feedback com você, ela aparece aqui."
        />
      </Panel>
    );
  }

  return (
    <>
      <div style={{ display: "grid", gap: 14 }}>
        {itens.map(f => (
          <Panel
            key={f.id}
            title={`FEEDBACK DE ${f.gestor.nome.toUpperCase()}`}
            actions={<StatusBadge label={f.rotuloStatus} tone={TOM_STATUS[f.status]} />}
          >
            {f.status === "REUNIAO_AGENDADA" ? (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                <CalendarClock size={16} style={{ color: "var(--accent-cyan)", flexShrink: 0, marginTop: 2 }} />
                <span>
                  Reunião marcada para <strong className="num" style={{ color: "var(--text-primary)" }}>{formatarDataHora(f.reuniaoInicio)}</strong>
                  {f.reuniaoLocal ? ` · ${f.reuniaoLocal}` : ""}.
                  <br />O feedback fica disponível para leitura depois da conversa.
                </span>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                <span className="num" style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  Reunião realizada em {formatarDataHora(f.reuniaoRealizadaEm)}
                </span>
                <Bloco titulo="PONTOS FORTES" texto={f.pontosFortes} />
                <Bloco titulo="OPORTUNIDADES DE DESENVOLVIMENTO" texto={f.oportunidades} />
                <Bloco titulo="EXPECTATIVAS E PRÓXIMOS PASSOS" texto={f.alinhamentos} />

                {f.cienciaEm ? (
                  <div
                    style={{
                      padding: "11px 13px", borderRadius: 12, fontSize: 12.5, lineHeight: 1.6,
                      background: "color-mix(in srgb, var(--accent-green) 8%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--accent-green) 25%, transparent)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Ciência registrada em <span className="num">{formatarDataHora(f.cienciaEm)}</span>. Processo encerrado.
                    {f.comentarioColaborador && (
                      <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
                        <strong style={{ color: "var(--text-primary)" }}>Seu comentário:</strong> {f.comentarioColaborador}
                      </div>
                    )}
                  </div>
                ) : f.podeDarCiencia ? (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button type="button" className="btn btn-primary" onClick={() => setDandoCiencia(f)}>
                      Registrar ciência
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </Panel>
        ))}
      </div>

      <RegistrarCiencia
        feedback={dandoCiencia}
        onFechar={() => setDandoCiencia(null)}
        onFeito={() => { setDandoCiencia(null); carregar(); }}
      />
    </>
  );
}

function RegistrarCiencia({ feedback, onFechar, onFeito }: {
  feedback: MeuFeedbackDesempenho | null; onFechar: () => void; onFeito: () => void;
}) {
  const [comentario, setComentario] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (feedback) { setComentario(""); setErro(""); } }, [feedback]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!feedback) return;
    setSalvando(true); setErro("");
    try {
      await feedbackDesempenhoService.registrarCiencia(feedback.id, comentario.trim() || undefined);
      useToastStore.getState().success("Ciência registrada");
      onFeito();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setErro(Array.isArray(msg) ? msg.join(". ") : msg || "Não foi possível registrar a ciência.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={!!feedback} onFechar={onFechar} largura={540}
      titulo="Registrar ciência"
      subtitulo="Ciência confirma que você leu o feedback e participou da conversa. Não significa concordar com tudo — use o comentário se quiser registrar a sua visão."
    >
      <form onSubmit={salvar} noValidate>
        <FormField label="Comentário" dica="Opcional." erro={erro}>
          <textarea
            className="input-o" rows={4} maxLength={4000} value={comentario}
            onChange={e => setComentario(e.target.value)}
          />
        </FormField>
        <FormActions>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? "Registrando..." : "Confirmar ciência"}
          </button>
        </FormActions>
      </form>
    </Modal>
  );
}
