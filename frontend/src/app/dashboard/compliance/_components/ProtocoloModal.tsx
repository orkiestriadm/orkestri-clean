"use client";

import { useEffect, useState } from "react";
import { Modal, FormGrid, FormField, FormActions } from "@/components/data-ui";
import { useToastStore } from "@/lib/toast";
import { complianceService } from "@/lib/compliance/compliance.service";
import type { Obrigacao } from "@/lib/compliance/types";
import { data, Aviso } from "./comuns";

/**
 * Registro do protocolo de renovação.
 *
 * É a regra que a planilha do cliente tinha e a especificação não previa: com
 * renovação automática ligada e protocolo TEMPESTIVO, a obrigação continua
 * regular depois da validade, até a decisão do órgão.
 *
 * A tela avisa, ANTES de salvar, quando o protocolo não vai prorrogar — porque
 * o caso perigoso é o silencioso: registrar o protocolo, achar que resolveu, e
 * o painel continuar acusando vencimento sem que ninguém entenda por quê.
 */
export default function ProtocoloModal({
  obrigacao, onFechar, onSalvo,
}: {
  obrigacao: Obrigacao | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [numero, setNumero] = useState("");
  const [quando, setQuando] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!obrigacao) return;
    setNumero(obrigacao.protocoloNumero ?? "");
    setQuando(obrigacao.protocoloEm?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
    setObservacao(obrigacao.protocoloObservacao ?? "");
  }, [obrigacao]);

  if (!obrigacao) return null;

  const limite = obrigacao.prazoFatalEm ?? obrigacao.dataValidade;
  const tempestivo = !limite || !quando ? true : quando <= limite.slice(0, 10);

  const impedimento = !obrigacao.renovacaoAutomatica
    ? "Esta obrigação não está marcada como de renovação automática. O protocolo será registrado e aparecerá no histórico, mas NÃO prorroga a validade."
    : !tempestivo
      ? `A data informada é posterior ao prazo fatal (${data(obrigacao.prazoFatalEm)}). Um protocolo intempestivo não prorroga a validade automaticamente — o órgão não é obrigado a aceitá-lo.`
      : null;

  async function salvar() {
    if (!numero.trim()) {
      useToastStore.getState().warning("Informe o número do protocolo");
      return;
    }
    setSalvando(true);
    try {
      const r = await complianceService.protocolar(obrigacao!.id, {
        protocoloNumero: numero.trim(),
        protocoloEm: quando,
        observacao: observacao.trim() || undefined,
      });
      if (r.aviso) useToastStore.getState().warning("Protocolo registrado", r.aviso);
      else useToastStore.getState().success("Protocolo registrado", "A validade está prorrogada até a decisão do órgão.");
      onSalvo();
      onFechar();
    } catch { /* interceptor */ } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={!!obrigacao}
      titulo={`Protocolo de renovação — ${obrigacao.codigo}`}
      subtitulo={obrigacao.nome}
      onFechar={onFechar}
      largura={620}
    >
      <div className="panel__body">
        {impedimento
          ? <Aviso tom="atencao">{impedimento}</Aviso>
          : (
            <Aviso tom="info">
              Com o protocolo dentro do prazo fatal ({data(obrigacao.prazoFatalEm)}), a validade fica
              prorrogada até a decisão do órgão e a obrigação para de ser cobrada pelos alertas.
            </Aviso>
          )}

        <FormGrid>
          <FormField label="Número do protocolo" obrigatorio largura="total">
            <input className="input-o" value={numero} onChange={e => setNumero(e.target.value)} />
          </FormField>

          <FormField label="Data do protocolo" obrigatorio>
            <input type="date" className="input-o" value={quando} onChange={e => setQuando(e.target.value)} />
          </FormField>

          <FormField label="Prazo fatal" dica="Calculado pelo sistema; não editável aqui.">
            <input className="input-o" value={data(obrigacao.prazoFatalEm)} disabled readOnly />
          </FormField>

          <FormField label="Observação" largura="total">
            <textarea className="input-o" rows={3} value={observacao} onChange={e => setObservacao(e.target.value)} />
          </FormField>
        </FormGrid>
      </div>

      <FormActions>
        <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvando}>
          {salvando ? "Registrando…" : "Registrar protocolo"}
        </button>
      </FormActions>
    </Modal>
  );
}
