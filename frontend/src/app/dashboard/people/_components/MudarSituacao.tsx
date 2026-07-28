"use client";

import { useEffect, useState } from "react";
import { useToastStore } from "@/lib/toast";
import {
  employeesService, ColaboradorDetalhe, StatusColaborador,
} from "@/lib/people/employees.service";
import { Modal, FormField, FormActions } from "@/components/data-ui";

/**
 * Mudança de situação funcional.
 *
 * Endpoint próprio porque tem regra de transição, exige data no desligamento
 * e gera evento de domínio — não é edição de cadastro.
 *
 * As transições permitidas espelham employee.entity.ts. O backend é quem
 * decide; aqui só evitamos oferecer o que já se sabe que será recusado.
 */

const TRANSICOES: Record<StatusColaborador, StatusColaborador[]> = {
  ATIVO:     ["INATIVO", "AFASTADO", "SUSPENSO", "DESLIGADO"],
  INATIVO:   ["ATIVO", "DESLIGADO"],
  AFASTADO:  ["ATIVO", "DESLIGADO"],
  SUSPENSO:  ["ATIVO", "DESLIGADO"],
  DESLIGADO: [],
};

const ROTULO: Record<StatusColaborador, string> = {
  ATIVO: "Ativo", INATIVO: "Inativo", AFASTADO: "Afastado",
  SUSPENSO: "Suspenso", DESLIGADO: "Desligado",
};

type Props = {
  aberto: boolean;
  colaborador: ColaboradorDetalhe;
  onFechar: () => void;
  onMudou: () => void;
};

export default function MudarSituacao({ aberto, colaborador, onFechar, onMudou }: Props) {
  const atual = colaborador.status;
  const opcoes = TRANSICOES[atual] ?? [];

  const [status, setStatus] = useState<StatusColaborador | "">("");
  const [dataDesligamento, setDataDesligamento] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setStatus(""); setDataDesligamento(""); setMotivo(""); setErro(null);
  }, [aberto]);

  const desligando = status === "DESLIGADO";

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!status) { setErro("Escolha a nova situação"); return; }
    if (desligando && !dataDesligamento) { setErro("Informe a data de desligamento"); return; }

    setSalvando(true);
    try {
      await employeesService.mudarStatus(colaborador.id, {
        status,
        dataDesligamento: desligando ? dataDesligamento : undefined,
        motivo: motivo.trim() || undefined,
      });
      useToastStore.getState().success(`Situação alterada para ${ROTULO[status]}`);
      onMudou();
      onFechar();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (err?.response?.status === 400 && msg) {
        setErro(Array.isArray(msg) ? msg.join(". ") : msg);
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      titulo="Mudar situação"
      subtitulo={`${colaborador.nomeExibicao} · atualmente ${ROTULO[atual]}`}
      onFechar={onFechar}
      largura={460}
    >
      {opcoes.length === 0 ? (
        <>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
            Colaborador desligado é estado final. Uma readmissão é um vínculo
            novo, com nova matrícula — cadastre outro colaborador em vez de
            reativar este, para não apagar a fronteira entre os dois contratos
            no histórico.
          </p>
          <FormActions>
            <button type="button" className="btn btn-ghost" onClick={onFechar}>Fechar</button>
          </FormActions>
        </>
      ) : (
        <form onSubmit={confirmar} noValidate>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <FormField label="Nova situação" obrigatorio erro={erro && !status ? erro : null}>
              <select
                className="input-o"
                value={status}
                onChange={e => { setStatus(e.target.value as StatusColaborador); setErro(null); }}
              >
                <option value="">Selecione...</option>
                {opcoes.map(s => <option key={s} value={s}>{ROTULO[s]}</option>)}
              </select>
            </FormField>

            {desligando && (
              <FormField label="Data de desligamento" obrigatorio erro={erro && !dataDesligamento ? erro : null}>
                <input
                  type="date" className="input-o"
                  value={dataDesligamento}
                  onChange={e => { setDataDesligamento(e.target.value); setErro(null); }}
                />
              </FormField>
            )}

            <FormField label="Motivo" dica="Fica registrado na linha do tempo do colaborador">
              <textarea
                className="input-o" rows={3}
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Opcional"
              />
            </FormField>

            {erro && status && (dataDesligamento || !desligando) && (
              <span style={{ fontSize: 11.5, color: "var(--accent-red)" }} role="alert">{erro}</span>
            )}
          </div>

          <FormActions>
            <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>
              Cancelar
            </button>
            <button
              type="submit"
              className={`btn ${desligando ? "btn-danger" : "btn-primary"}`}
              disabled={salvando}
            >
              {salvando ? "Aplicando..." : desligando ? "Confirmar desligamento" : "Confirmar"}
            </button>
          </FormActions>
        </form>
      )}
    </Modal>
  );
}
