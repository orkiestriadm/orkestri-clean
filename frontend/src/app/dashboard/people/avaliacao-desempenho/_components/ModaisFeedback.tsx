"use client";

import { useEffect, useState } from "react";
import { Modal, FormGrid, FormField, FormActions } from "@/components/data-ui";
import { useToastStore } from "@/lib/toast";
import {
  feedbackDesempenhoService, DetalheFeedbackDesempenho, isoParaLocal, localParaIso,
} from "@/lib/people/feedback-desempenho.service";

/**
 * Formulários do fluxo, um por ação do gestor e do RH.
 *
 * Todos repetem o mesmo contrato: abrem limpos (ou com o valor atual), mostram
 * a mensagem do backend quando ele recusa, e chamam `onFeito` só com sucesso.
 * A regra de etapa não é conferida aqui — o botão só aparece quando o backend
 * diz que a ação está disponível, e o backend confere de novo.
 */

function mensagemDeErro(err: any): string {
  const msg = err?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(". ");
  return msg || "Não foi possível concluir. Tente novamente.";
}

function Botoes({ salvando, rotulo, onCancelar, perigo }: {
  salvando: boolean; rotulo: string; onCancelar: () => void; perigo?: boolean;
}) {
  return (
    <FormActions>
      <button type="button" className="btn btn-ghost" onClick={onCancelar} disabled={salvando}>
        Cancelar
      </button>
      <button type="submit" className={`btn ${perigo ? "btn-danger" : "btn-primary"}`} disabled={salvando}>
        {salvando ? "Salvando..." : rotulo}
      </button>
    </FormActions>
  );
}

const areaTexto = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className="input-o" rows={5} maxLength={4000} {...props} />
);

/* ── 1. Registro ─────────────────────────────────────────────────────────── */

export function NovoFeedback({ aberto, onFechar, onCriado }: {
  aberto: boolean; onFechar: () => void; onCriado: (id: string) => void;
}) {
  const [opcoes, setOpcoes] = useState<{ id: string; nome: string; cargo: string | null }[]>([]);
  const [carregandoOpcoes, setCarregandoOpcoes] = useState(false);
  const [collaboratorId, setCollaboratorId] = useState("");
  const [pontosFortes, setPontosFortes] = useState("");
  const [oportunidades, setOportunidades] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setCollaboratorId(""); setPontosFortes(""); setOportunidades(""); setErro("");
    setCarregandoOpcoes(true);
    feedbackDesempenhoService.elegiveis()
      .then(r => setOpcoes(r.data ?? []))
      .catch(e => setErro(mensagemDeErro(e)))
      .finally(() => setCarregandoOpcoes(false));
  }, [aberto]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!collaboratorId) { setErro("Escolha o colaborador."); return; }
    if (!pontosFortes.trim() || !oportunidades.trim()) {
      setErro("Preencha pontos fortes e oportunidades de desenvolvimento."); return;
    }
    setSalvando(true); setErro("");
    try {
      const r = await feedbackDesempenhoService.criar({ collaboratorId, pontosFortes, oportunidades });
      useToastStore.getState().success("Feedback registrado");
      onCriado(r.data.id);
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto} onFechar={onFechar} largura={620}
      titulo="Registrar feedback"
      subtitulo="Etapa 1 de 4 — o colaborador só lê o texto depois da reunião."
    >
      <form onSubmit={salvar} noValidate>
        <FormGrid>
          <FormField
            label="Colaborador" obrigatorio largura="total"
            dica={!carregandoOpcoes && opcoes.length === 0
              ? "Ninguém disponível: o colaborador precisa estar na sua equipe e ter acesso ao sistema."
              : "Só aparece quem tem acesso ao sistema — é o colaborador quem registra a ciência."}
          >
            <select
              className="input-o" value={collaboratorId}
              onChange={e => setCollaboratorId(e.target.value)} disabled={carregandoOpcoes}
            >
              <option value="">{carregandoOpcoes ? "Carregando..." : "Selecione"}</option>
              {opcoes.map(o => (
                <option key={o.id} value={o.id}>{o.nome}{o.cargo ? ` — ${o.cargo}` : ""}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Pontos fortes" obrigatorio largura="total">
            {areaTexto({
              value: pontosFortes, onChange: e => setPontosFortes(e.target.value),
              placeholder: "O que o colaborador faz bem, com exemplos concretos.",
            })}
          </FormField>

          <FormField label="Oportunidades de desenvolvimento" obrigatorio largura="total" erro={erro}>
            {areaTexto({
              value: oportunidades, onChange: e => setOportunidades(e.target.value),
              placeholder: "O que pode melhorar — o comportamento observado, não o traço de personalidade.",
            })}
          </FormField>
        </FormGrid>
        <Botoes salvando={salvando} rotulo="Registrar" onCancelar={onFechar} />
      </form>
    </Modal>
  );
}

export function EditarFeedback({ aberto, feedback, onFechar, onFeito }: {
  aberto: boolean; feedback: DetalheFeedbackDesempenho; onFechar: () => void; onFeito: () => void;
}) {
  const [pontosFortes, setPontosFortes] = useState("");
  const [oportunidades, setOportunidades] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setPontosFortes(feedback.pontosFortes); setOportunidades(feedback.oportunidades); setErro("");
  }, [aberto, feedback]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true); setErro("");
    try {
      await feedbackDesempenhoService.editar(feedback.id, { pontosFortes, oportunidades });
      useToastStore.getState().success("Feedback atualizado");
      onFeito();
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto={aberto} onFechar={onFechar} largura={620} titulo="Editar registro"
      subtitulo="Só é possível editar antes de registrar a reunião.">
      <form onSubmit={salvar} noValidate>
        <FormGrid>
          <FormField label="Pontos fortes" obrigatorio largura="total">
            {areaTexto({ value: pontosFortes, onChange: e => setPontosFortes(e.target.value) })}
          </FormField>
          <FormField label="Oportunidades de desenvolvimento" obrigatorio largura="total" erro={erro}>
            {areaTexto({ value: oportunidades, onChange: e => setOportunidades(e.target.value) })}
          </FormField>
        </FormGrid>
        <Botoes salvando={salvando} rotulo="Salvar" onCancelar={onFechar} />
      </form>
    </Modal>
  );
}

/* ── 2. Reunião ──────────────────────────────────────────────────────────── */

export function AgendarReuniao({ aberto, feedback, onFechar, onFeito }: {
  aberto: boolean; feedback: DetalheFeedbackDesempenho; onFechar: () => void; onFeito: () => void;
}) {
  const remarcar = feedback.status === "REUNIAO_AGENDADA";
  const [inicio, setInicio] = useState("");
  const [local, setLocal] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setInicio(isoParaLocal(feedback.reuniaoInicio));
    setLocal(feedback.reuniaoLocal ?? "");
    setErro("");
  }, [aberto, feedback]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const iso = localParaIso(inicio);
    if (!iso) { setErro("Informe a data e o horário da reunião."); return; }
    setSalvando(true); setErro("");
    try {
      await feedbackDesempenhoService.agendar(feedback.id, { inicio: iso, local: local.trim() || undefined });
      useToastStore.getState().success(remarcar ? "Reunião remarcada" : "Reunião agendada");
      onFeito();
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto} onFechar={onFechar} largura={520}
      titulo={remarcar ? "Remarcar reunião" : "Agendar reunião de feedback"}
      subtitulo={`Conversa individual com ${feedback.colaborador.nome}. Entra na agenda de vocês dois.`}
    >
      <form onSubmit={salvar} noValidate>
        <FormGrid>
          <FormField label="Data e horário" obrigatorio erro={erro}>
            <input type="datetime-local" className="input-o" value={inicio} onChange={e => setInicio(e.target.value)} />
          </FormField>
          <FormField label="Local ou link" dica="Sala, endereço ou link da chamada.">
            <input className="input-o" maxLength={300} value={local} onChange={e => setLocal(e.target.value)} />
          </FormField>
        </FormGrid>
        <Botoes salvando={salvando} rotulo={remarcar ? "Remarcar" : "Agendar"} onCancelar={onFechar} />
      </form>
    </Modal>
  );
}

export function RegistrarReuniao({ aberto, feedback, onFechar, onFeito }: {
  aberto: boolean; feedback: DetalheFeedbackDesempenho; onFechar: () => void; onFeito: () => void;
}) {
  const [realizadaEm, setRealizadaEm] = useState("");
  const [alinhamentos, setAlinhamentos] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    // Sugere o horário agendado se ele já passou; senão, agora.
    const agendada = feedback.reuniaoInicio ? new Date(feedback.reuniaoInicio) : null;
    const sugestao = agendada && agendada.getTime() <= Date.now() ? feedback.reuniaoInicio : new Date().toISOString();
    setRealizadaEm(isoParaLocal(sugestao));
    setAlinhamentos("");
    setErro("");
  }, [aberto, feedback]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!alinhamentos.trim()) { setErro("Registre as expectativas e os próximos passos alinhados."); return; }
    setSalvando(true); setErro("");
    try {
      await feedbackDesempenhoService.registrarReuniao(feedback.id, {
        realizadaEm: localParaIso(realizadaEm), alinhamentos,
      });
      useToastStore.getState().success("Reunião registrada — o colaborador já pode dar ciência");
      onFeito();
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto} onFechar={onFechar} largura={620}
      titulo="Registrar reunião realizada"
      subtitulo={`Ao confirmar, ${feedback.colaborador.nome} passa a ler o feedback e é avisado para registrar ciência. O texto não poderá mais ser editado.`}
    >
      <form onSubmit={salvar} noValidate>
        <FormGrid>
          <FormField label="Quando aconteceu" obrigatorio>
            <input type="datetime-local" className="input-o" value={realizadaEm} onChange={e => setRealizadaEm(e.target.value)} />
          </FormField>
          <FormField label="Expectativas e próximos passos" obrigatorio largura="total" erro={erro}>
            {areaTexto({
              value: alinhamentos, onChange: e => setAlinhamentos(e.target.value),
              placeholder: "O que foi combinado na conversa: expectativas, próximos passos e prazos.",
            })}
          </FormField>
        </FormGrid>
        <Botoes salvando={salvando} rotulo="Registrar reunião" onCancelar={onFechar} />
      </form>
    </Modal>
  );
}

/* ── Exclusão ────────────────────────────────────────────────────────────── */

export function SolicitarExclusao({ aberto, feedback, onFechar, onFeito }: {
  aberto: boolean; feedback: DetalheFeedbackDesempenho; onFechar: () => void; onFeito: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (aberto) { setMotivo(""); setErro(""); } }, [aberto]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (motivo.trim().length < 3) { setErro("Explique o motivo para o RH."); return; }
    setSalvando(true); setErro("");
    try {
      const r = await feedbackDesempenhoService.solicitarExclusao(feedback.id, motivo);
      useToastStore.getState().success(
        r.aprovadoresNotificados > 0
          ? "Pedido enviado ao RH"
          : "Pedido registrado, mas ninguém do RH tem a permissão de aprovar — fale com o administrador",
      );
      onFeito();
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto} onFechar={onFechar} largura={520}
      titulo="Pedir exclusão ao RH"
      subtitulo="O feedback só é excluído se o RH aprovar. Até a decisão, ele fica parado na etapa atual."
    >
      <form onSubmit={salvar} noValidate>
        <FormField label="Motivo" obrigatorio erro={erro}>
          <textarea
            className="input-o" rows={4} maxLength={1000} value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Por que este feedback deve ser excluído?"
          />
        </FormField>
        <Botoes salvando={salvando} rotulo="Enviar ao RH" onCancelar={onFechar} perigo />
      </form>
    </Modal>
  );
}

export function DecidirExclusao({ aberto, feedback, aprovar, onFechar, onFeito }: {
  aberto: boolean; feedback: DetalheFeedbackDesempenho; aprovar: boolean;
  onFechar: () => void; onFeito: (excluido: boolean) => void;
}) {
  const [parecer, setParecer] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (aberto) { setParecer(""); setErro(""); } }, [aberto]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true); setErro("");
    try {
      await feedbackDesempenhoService.decidirExclusao(feedback.id, aprovar, parecer.trim() || undefined);
      useToastStore.getState().success(aprovar ? "Exclusão aprovada — feedback excluído" : "Exclusão reprovada — o gestor foi avisado");
      onFeito(aprovar);
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto} onFechar={onFechar} largura={520}
      titulo={aprovar ? "Aprovar exclusão" : "Reprovar exclusão"}
      subtitulo={aprovar
        ? `O feedback de ${feedback.colaborador.nome} sai das telas. A linha do tempo fica registrada.`
        : "O feedback continua ativo e o gestor recebe uma notificação."}
    >
      <form onSubmit={salvar} noValidate>
        <FormField label="Parecer" dica="Opcional — vai junto na notificação ao gestor." erro={erro}>
          <textarea className="input-o" rows={3} maxLength={1000} value={parecer} onChange={e => setParecer(e.target.value)} />
        </FormField>
        <Botoes salvando={salvando} rotulo={aprovar ? "Aprovar e excluir" : "Reprovar"} onCancelar={onFechar} perigo={aprovar} />
      </form>
    </Modal>
  );
}
