"use client";

import { useEffect, useState } from "react";
import { useToastStore } from "@/lib/toast";
import { employeesService, ColaboradorDetalhe } from "@/lib/people/employees.service";
import { Modal, FormField, FormActions } from "@/components/data-ui";
import { AlertTriangle } from "lucide-react";

/**
 * Exclusão do registro do colaborador.
 *
 * NÃO é desligamento, e a diferença é o ponto inteiro desta tela: quem saiu da
 * empresa deve ser DESLIGADO — mantém a ficha, entra no turnover, conserva
 * histórico e documentos por retenção legal. Excluir é para o cadastro criado
 * por engano, duplicado ou de teste.
 *
 * Confirmação por digitação do nome, e não um `confirm()` como no resto do
 * módulo: aqui o clique errado some com uma pessoa da lista, e o atrito é
 * proposital. A exclusão é lógica (ADR-004 §3) — nada é apagado do banco —,
 * mas ninguém encontra o registro pela interface depois.
 */

type Props = {
  aberto: boolean;
  colaborador: ColaboradorDetalhe;
  onFechar: () => void;
  onExcluido: () => void;
};

export default function ExcluirColaborador({ aberto, colaborador, onFechar, onExcluido }: Props) {
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  const nome = colaborador.nomeCompleto || colaborador.user?.nome || "";

  useEffect(() => {
    if (!aberto) return;
    setConfirmacao("");
    setErro("");
  }, [aberto]);

  // Comparação tolerante a espaço e caixa: a exigência é provar atenção, não
  // acertar a digitação exata de um nome com acento.
  const confere = confirmacao.trim().toLocaleLowerCase() === nome.trim().toLocaleLowerCase();

  async function excluir(e: React.FormEvent) {
    e.preventDefault();
    if (!confere) {
      setErro("Digite o nome exatamente como aparece acima.");
      return;
    }

    setExcluindo(true);
    try {
      await employeesService.excluir(colaborador.id);
      useToastStore.getState().success("Registro excluído", `${nome} saiu da lista de colaboradores.`);
      onExcluido();
      onFechar();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (msg) setErro(Array.isArray(msg) ? msg.join(". ") : msg);
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <Modal aberto={aberto} titulo="Excluir registro" subtitulo={nome} onFechar={onFechar} largura={520}>
      <form onSubmit={excluir} noValidate>
        <div
          style={{
            display: "flex", gap: 10, padding: "12px 14px", borderRadius: 12, marginBottom: 16,
            background: "color-mix(in srgb, var(--accent-red) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--accent-red) 24%, transparent)",
          }}
        >
          <AlertTriangle size={16} style={{ color: "var(--accent-red)", flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--text-primary)" }}>Isto não é um desligamento.</strong>{" "}
            Se a pessoa saiu da empresa, use <em>Mudar situação → Desligado</em>: a ficha
            continua acessível, entra no turnover e preserva documentos e histórico.
            <br /><br />
            A exclusão é para cadastro criado por engano ou duplicado. O registro
            some da lista, do organograma e dos indicadores.
          </div>
        </div>

        <FormField
          label={`Para confirmar, digite: ${nome}`}
          erro={erro}
          largura="total"
        >
          <input
            className="input-o"
            value={confirmacao}
            onChange={e => setConfirmacao(e.target.value)}
            placeholder={nome}
            autoComplete="off"
          />
        </FormField>

        <FormActions>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={excluindo}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={excluindo || !confere}
            style={confere ? { background: "var(--accent-red)", borderColor: "var(--accent-red)" } : undefined}
          >
            {excluindo ? "Excluindo..." : "Excluir registro"}
          </button>
        </FormActions>
      </form>
    </Modal>
  );
}
