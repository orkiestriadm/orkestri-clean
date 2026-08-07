"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal, FormGrid, FormField, FormActions } from "@/components/data-ui";
import { useToastStore } from "@/lib/toast";
import { complianceService } from "@/lib/compliance/compliance.service";
import type { Obrigacao } from "@/lib/compliance/types";
import { data, Aviso } from "./comuns";

/**
 * Renovação.
 *
 * Renovar CONGELA a vigência atual numa versão e abre a próxima — nunca
 * substitui. A licença que valia em 2022 continua sendo o documento daquele
 * ano, e é dela que o auditor precisa.
 *
 * A nova validade é PROPOSTA a partir da periodicidade cadastrada, em vez de
 * exigida: obrigar a digitar o que o sistema sabe calcular é convite a erro.
 */
export default function RenovarModal({
  obrigacao, onFechar, onSalvo,
}: {
  obrigacao: Obrigacao | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [emissao, setEmissao] = useState("");
  const [validade, setValidade] = useState("");
  const [numero, setNumero] = useState("");
  const [prazoMinimo, setPrazoMinimo] = useState("");
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!obrigacao) return;
    const hoje = new Date().toISOString().slice(0, 10);
    setEmissao(hoje);
    setValidade("");
    setNumero(obrigacao.numeroDocumento ?? "");
    setPrazoMinimo(String(obrigacao.prazoMinimoDias ?? 0));
    setValor("");
    setObservacao("");
    setErro(null);
  }, [obrigacao]);

  /** Sugestão da próxima validade — mesma conta do backend, em meses. */
  const sugerida = useMemo(() => {
    if (!obrigacao?.validadeMeses || !emissao) return "";
    const base = new Date(`${emissao}T00:00:00`);
    const dia = base.getDate();
    const alvo = new Date(base.getTime());
    alvo.setMonth(alvo.getMonth() + obrigacao.validadeMeses);
    // 31/01 + 1 mês transbordaria para março; um prazo administrativo termina
    // no último dia do mês pretendido.
    if (alvo.getDate() !== dia) alvo.setDate(0);
    return alvo.toISOString().slice(0, 10);
  }, [obrigacao?.validadeMeses, emissao]);

  const validadeEfetiva = validade || sugerida;

  async function salvar() {
    if (!obrigacao) return;
    if (!emissao) { setErro("Informe a data de emissão do novo documento."); return; }
    if (!validadeEfetiva) {
      setErro("Informe a nova validade — esta obrigação não tem periodicidade cadastrada para calcular.");
      return;
    }
    if (validadeEfetiva <= emissao) {
      setErro("A validade precisa ser posterior à emissão.");
      return;
    }

    setSalvando(true);
    try {
      await complianceService.renovar(obrigacao.id, {
        dataEmissao: emissao,
        dataValidade: validadeEfetiva,
        numeroDocumento: numero.trim() || undefined,
        prazoMinimoDias: prazoMinimo === "" ? undefined : Number(prazoMinimo),
        valor: valor === "" ? undefined : Number(valor),
        observacao: observacao.trim() || undefined,
      });
      useToastStore.getState().success(
        `Renovada para a versão ${obrigacao.versaoAtual + 1}`,
        "A vigência anterior foi congelada e continua disponível no histórico.",
      );
      onSalvo();
      onFechar();
    } catch { /* interceptor */ } finally {
      setSalvando(false);
    }
  }

  if (!obrigacao) return null;

  return (
    <Modal
      aberto={!!obrigacao}
      titulo={`Renovar ${obrigacao.codigo}`}
      subtitulo={obrigacao.nome}
      onFechar={onFechar}
      largura={620}
    >
      <div className="panel__body">
        <Aviso tom="info">
          A vigência atual (validade {data(obrigacao.dataValidade)}) será congelada como
          <strong> versão {obrigacao.versaoAtual}</strong> e continuará consultável. O protocolo
          registrado, se houver, é limpo — ele valia para a vigência que termina agora.
        </Aviso>

        {erro && <Aviso tom="critico">{erro}</Aviso>}

        <FormGrid>
          <FormField label="Nova data de emissão" obrigatorio>
            <input type="date" className="input-o" value={emissao} onChange={e => { setEmissao(e.target.value); setErro(null); }} />
          </FormField>

          <FormField
            label="Nova data de validade"
            obrigatorio={!sugerida}
            dica={sugerida && !validade
              ? `Em branco, usa ${new Date(`${sugerida}T00:00:00`).toLocaleDateString("pt-BR")} (periodicidade de ${obrigacao.validadeMeses} meses).`
              : undefined}
          >
            <input type="date" className="input-o" value={validade || sugerida} onChange={e => { setValidade(e.target.value); setErro(null); }} />
          </FormField>

          <FormField label="Número do novo documento">
            <input className="input-o" value={numero} onChange={e => setNumero(e.target.value)} />
          </FormField>

          <FormField label="Prazo mínimo do órgão (dias)"
            dica="Se o órgão mudou a exigência, ajuste aqui.">
            <input type="number" min={0} className="input-o" value={prazoMinimo} onChange={e => setPrazoMinimo(e.target.value)} />
          </FormField>

          <FormField label="Valor pago na renovação (R$)">
            <input type="number" step="0.01" min={0} className="input-o" value={valor} onChange={e => setValor(e.target.value)} />
          </FormField>

          <FormField label="Observação" largura="total">
            <textarea className="input-o" rows={3} value={observacao} onChange={e => setObservacao(e.target.value)} />
          </FormField>
        </FormGrid>
      </div>

      <FormActions>
        <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvando}>
          {salvando ? "Renovando…" : "Renovar"}
        </button>
      </FormActions>
    </Modal>
  );
}
