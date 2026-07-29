"use client";

import { useEffect, useState } from "react";
import { useToastStore } from "@/lib/toast";
import { positionsService, Cargo, DadosCargo } from "@/lib/people/positions.service";
import { Modal, FormGrid, FormField, FormActions } from "@/components/data-ui";

/** Cadastro e edição de cargo. */

const VAZIO: DadosCargo = { titulo: "", codigo: "", descricao: "", nivel: "" };

type Props = {
  aberto: boolean;
  /** Nulo cria; preenchido edita. */
  cargo: Cargo | null;
  onFechar: () => void;
  onSalvo: () => void;
};

export default function CargoForm({ aberto, cargo, onFechar, onSalvo }: Props) {
  const [dados, setDados] = useState<DadosCargo>(VAZIO);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setDados(
      cargo
        ? {
            titulo: cargo.titulo,
            codigo: cargo.codigo ?? "",
            descricao: cargo.descricao ?? "",
            nivel: cargo.nivel ?? "",
          }
        : VAZIO,
    );
    setErros({});
  }, [aberto, cargo]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!dados.titulo.trim()) {
      setErros({ titulo: "Informe o título do cargo" });
      return;
    }

    setSalvando(true);
    try {
      if (cargo) await positionsService.atualizar(cargo.id, dados);
      else await positionsService.criar(dados);
      useToastStore.getState().success(cargo ? "Cargo atualizado" : "Cargo criado");
      onSalvo();
      onFechar();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      // Título duplicado é o 400 esperado aqui — mostrar no campo, não só no toast.
      if (err?.response?.status === 400 && msg) {
        setErros({ titulo: Array.isArray(msg) ? msg.join(". ") : msg });
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      titulo={cargo ? "Editar cargo" : "Novo cargo"}
      onFechar={onFechar}
      largura={520}
    >
      <form onSubmit={salvar} noValidate>
        <FormGrid>
          <FormField label="Título" obrigatorio erro={erros.titulo} largura="total">
            <input
              className="input-o"
              value={dados.titulo}
              maxLength={120}
              onChange={e => setDados(d => ({ ...d, titulo: e.target.value }))}
              placeholder="Ex.: Analista de Sistemas"
            />
          </FormField>

          <FormField label="Código" dica="Referência interna, opcional">
            <input
              className="input-o"
              value={dados.codigo ?? ""}
              maxLength={40}
              onChange={e => setDados(d => ({ ...d, codigo: e.target.value }))}
            />
          </FormField>

          <FormField label="Nível">
            <input
              className="input-o"
              value={dados.nivel ?? ""}
              maxLength={60}
              onChange={e => setDados(d => ({ ...d, nivel: e.target.value }))}
              placeholder="Ex.: Pleno"
            />
          </FormField>

          <FormField label="Descrição" largura="total">
            <textarea
              className="input-o" rows={3} maxLength={500}
              value={dados.descricao ?? ""}
              onChange={e => setDados(d => ({ ...d, descricao: e.target.value }))}
              placeholder="Opcional"
            />
          </FormField>
        </FormGrid>

        <FormActions>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? "Salvando..." : cargo ? "Salvar" : "Criar cargo"}
          </button>
        </FormActions>
      </form>
    </Modal>
  );
}
