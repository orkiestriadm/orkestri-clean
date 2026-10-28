"use client";

import { useEffect, useState } from "react";
import { useToastStore } from "@/lib/toast";
import { vacationsService } from "@/lib/people/vacations.service";
import { Modal, FormGrid, FormField, FormActions } from "@/components/data-ui";
import { CalendarRange } from "lucide-react";

/**
 * Solicitação de férias.
 *
 * A validação daqui é só para dar retorno imediato enquanto a pessoa digita — a
 * decisão que vale é a do servidor, que também confere sobreposição com outras
 * ausências e escolhe de qual período aquisitivo debitar.
 */

/** Espelha MINIMO_DIAS_FRACIONAMENTO do domínio. */
const MINIMO_DIAS = 5;

/** Dias corridos, inclusivo nas duas pontas — férias remuneram fim de semana. */
function contarDias(inicio: string, fim: string): number | null {
  if (!inicio || !fim) return null;
  const a = new Date(`${inicio}T00:00:00`);
  const b = new Date(`${fim}T00:00:00`);
  if (isNaN(+a) || isNaN(+b) || b < a) return null;
  return Math.round((+b - +a) / 86_400_000) + 1;
}

const hojeISO = () => new Date().toISOString().slice(0, 10);

type Props = {
  aberto: boolean;
  collaboratorId: string;
  nome: string;
  saldoDisponivel: number;
  onFechar: () => void;
  onSolicitado: () => void;
};

export default function SolicitarFerias({
  aberto, collaboratorId, nome, saldoDisponivel, onFechar, onSolicitado,
}: Props) {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setDataInicio("");
    setDataFim("");
    setObservacao("");
    setErros({});
  }, [aberto]);

  const dias = contarDias(dataInicio, dataFim);

  function validar(): boolean {
    const novos: Record<string, string> = {};
    if (!dataInicio) novos.dataInicio = "Informe o início";
    if (!dataFim) novos.dataFim = "Informe o fim";

    if (dataInicio && dataFim) {
      if (dias === null) novos.dataFim = "A data final é anterior à inicial";
      else if (dias < MINIMO_DIAS) novos.dataFim = `Mínimo de ${MINIMO_DIAS} dias corridos`;
      // O saldo total pode não estar em um único período; quem decide é o
      // servidor. Aqui só barramos o que é impossível de qualquer forma.
      else if (dias > saldoDisponivel) {
        novos.dataFim = `${dias} dias solicitados, saldo total de ${saldoDisponivel}`;
      }
    }

    setErros(novos);
    return Object.keys(novos).length === 0;
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!validar()) return;

    setEnviando(true);
    try {
      await vacationsService.solicitar(collaboratorId, { dataInicio, dataFim, observacao });
      useToastStore.getState().success(
        "Férias solicitadas",
        "Aguardando aprovação — os dias já ficam reservados no saldo.",
      );
      onSolicitado();
      onFechar();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (err?.response?.status === 400 && msg) {
        // O 400 aqui é regra de negócio (sobreposição, período sem saldo), não
        // erro técnico: a mensagem do servidor é o que a pessoa precisa ler.
        const texto = Array.isArray(msg) ? msg.join(". ") : msg;
        setErros({ dataFim: texto });
        useToastStore.getState().error("Não foi possível solicitar", texto);
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      titulo="Solicitar férias"
      subtitulo={`${nome} · ${saldoDisponivel} dias de saldo`}
      onFechar={onFechar}
      largura={520}
    >
      <form onSubmit={enviar} noValidate>
        <FormGrid>
          <FormField label="Início" obrigatorio erro={erros.dataInicio}>
            <input
              type="date" className="input-o" min={hojeISO()}
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
            />
          </FormField>

          <FormField
            label="Fim"
            obrigatorio
            erro={erros.dataFim}
            dica={`Mínimo de ${MINIMO_DIAS} dias corridos`}
          >
            <input
              type="date" className="input-o" min={dataInicio || hojeISO()}
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
            />
          </FormField>

          {dias !== null && (
            <div
              style={{
                gridColumn: "1 / -1", display: "flex", gap: 9, alignItems: "center",
                padding: "11px 13px", borderRadius: 10,
                background: "var(--bg-hover)", border: "1px solid var(--border-subtle)",
              }}
            >
              <CalendarRange size={15} style={{ color: "var(--accent-violet)", flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                <strong className="metric">{dias}</strong> {dias === 1 ? "dia corrido" : "dias corridos"}
                {" — restariam "}
                <strong className="metric">{Math.max(0, saldoDisponivel - dias)}</strong> de saldo
              </span>
            </div>
          )}

          <FormField label="Observação" largura="total">
            <textarea
              className="input-o" rows={2} maxLength={500}
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              placeholder="Opcional"
            />
          </FormField>
        </FormGrid>

        <FormActions>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={enviando}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={enviando}>
            {enviando ? "Enviando..." : "Solicitar"}
          </button>
        </FormActions>
      </form>
    </Modal>
  );
}
