"use client";

import { useEffect, useState } from "react";
import { useToastStore } from "@/lib/toast";
import { documentsService, Documento, AprovacaoDocumento } from "@/lib/people/documents.service";
import { Modal, FormField, FormActions } from "@/components/data-ui";

/**
 * Aprovação ou rejeição de documento.
 *
 * Rejeitar exige motivo — é o que diz ao colaborador o que corrigir. A regra
 * vale no servidor; aqui evitamos a ida e volta.
 */

type Props = {
  aberto: boolean;
  documento: Documento | null;
  decisao: Extract<AprovacaoDocumento, "APROVADO" | "REJEITADO">;
  onFechar: () => void;
  onDecidido: () => void;
};

export default function DecidirDocumento({ aberto, documento, decisao, onFechar, onDecidido }: Props) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const rejeitando = decisao === "REJEITADO";

  useEffect(() => {
    if (!aberto) return;
    setMotivo("");
    setErro(null);
  }, [aberto]);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!documento) return;
    if (rejeitando && !motivo.trim()) {
      setErro("Explique o que precisa ser corrigido");
      return;
    }

    setSalvando(true);
    try {
      await documentsService.decidir(documento.id, decisao, motivo.trim() || undefined);
      useToastStore.getState().success(rejeitando ? "Documento rejeitado" : "Documento aprovado");
      onDecidido();
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
      titulo={rejeitando ? "Rejeitar documento" : "Aprovar documento"}
      subtitulo={documento?.titulo}
      onFechar={onFechar}
      largura={440}
    >
      <form onSubmit={confirmar} noValidate>
        <FormField
          label={rejeitando ? "Motivo da rejeição" : "Observação"}
          obrigatorio={rejeitando}
          erro={erro}
          dica={
            rejeitando
              ? "O colaborador verá este texto e poderá reenviar o documento corrigido"
              : "Opcional — fica registrado na linha do tempo"
          }
        >
          <textarea
            className="input-o" rows={3}
            value={motivo}
            onChange={e => { setMotivo(e.target.value); setErro(null); }}
            placeholder={rejeitando ? "Ex.: imagem ilegível, reenviar com melhor resolução" : "Opcional"}
          />
        </FormField>

        <FormActions>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button
            type="submit"
            className={`btn ${rejeitando ? "btn-danger" : "btn-primary"}`}
            disabled={salvando}
          >
            {salvando ? "Salvando..." : rejeitando ? "Confirmar rejeição" : "Aprovar"}
          </button>
        </FormActions>
      </form>
    </Modal>
  );
}
