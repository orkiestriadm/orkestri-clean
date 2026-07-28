"use client";

import { useState } from "react";
import { useToastStore } from "@/lib/toast";
import { useDocuments } from "@/hooks/useDocuments";
import {
  documentsService, Documento, SituacaoValidade, AprovacaoDocumento,
} from "@/lib/people/documents.service";
import {
  Panel, TableCard, EmptyState, LoadingRows, ErrorState, PermissionDenied,
  StatusBadge, BadgeTone, RowActions, RowAction,
} from "@/components/data-ui";
import {
  Plus, Download, Check, X, Trash2, Lock, FileText,
} from "lucide-react";
import EnviarDocumento from "./EnviarDocumento";
import DecidirDocumento from "./DecidirDocumento";

/**
 * Documentos do colaborador.
 *
 * Duas informações distintas convivem em cada linha e não podem ser confundidas:
 * a situação de APROVAÇÃO (o RH conferiu?) e a de VALIDADE (ainda vale?).
 * Um documento aprovado pode estar vencido.
 */

const CATEGORIA_LABEL: Record<string, string> = {
  identidade: "Identidade", contrato: "Contrato", certificado: "Certificado",
  medico: "Médico", formacao: "Formação", outro: "Outro",
};

const APROVACAO: Record<AprovacaoDocumento, { label: string; tone: BadgeTone }> = {
  PENDENTE:  { label: "Pendente",  tone: "atencao" },
  APROVADO:  { label: "Aprovado",  tone: "ok" },
  REJEITADO: { label: "Rejeitado", tone: "critico" },
  ARQUIVADO: { label: "Arquivado", tone: "neutro" },
};

const VALIDADE: Record<SituacaoValidade, { label: string; tone: BadgeTone } | null> = {
  sem_validade:   null,
  vigente:        null,
  vence_em_breve: { label: "Vence em breve", tone: "atencao" },
  vencido:        { label: "Vencido",        tone: "critico" },
};

const fmtData = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

type Props = {
  collaboratorId: string;
  podeEnviar: boolean;
  podeAprovar: boolean;
  podeExcluir: boolean;
};

export default function AbaDocumentos({ collaboratorId, podeEnviar, podeAprovar, podeExcluir }: Props) {
  const { documentos, carregando, erro, semPermissao, recarregar } = useDocuments(collaboratorId);
  const [enviando, setEnviando] = useState(false);
  const [decisao, setDecisao] = useState<{ doc: Documento; tipo: "APROVADO" | "REJEITADO" } | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);

  async function baixar(doc: Documento) {
    setBaixando(doc.id);
    try {
      await documentsService.baixar(doc);
    } catch {
      // O interceptor do axios já avisa 403 e 5xx; aqui cobrimos o resto.
      useToastStore.getState().error("Download falhou", "Não foi possível baixar o arquivo.");
    } finally {
      setBaixando(null);
    }
  }

  async function excluir(doc: Documento) {
    if (!confirm(`Remover "${doc.titulo}"? O arquivo será apagado.`)) return;
    try {
      await documentsService.excluir(doc.id);
      useToastStore.getState().success("Documento removido");
      recarregar();
    } catch { /* interceptor já avisou */ }
  }

  if (semPermissao) {
    return <PermissionDenied hint="Você não tem permissão para ver os documentos deste colaborador." />;
  }

  const COLUNAS = ["Documento", "Categoria", "Emissão", "Validade", "Situação", ""];

  return (
    <>
      <Panel
        title={`DOCUMENTOS (${documentos.length})`}
        actions={
          podeEnviar && (
            <button type="button" className="btn btn-ghost" onClick={() => setEnviando(true)}>
              <Plus size={13} /> Enviar
            </button>
          )
        }
      >
        <TableCard>
          <thead>
            <tr>{COLUNAS.map((c, i) => <th key={i}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {carregando ? (
              <LoadingRows colSpan={COLUNAS.length} rows={3} />
            ) : erro ? (
              <ErrorState detail={erro} onRetry={recarregar} colSpan={COLUNAS.length} />
            ) : documentos.length === 0 ? (
              <EmptyState
                colSpan={COLUNAS.length}
                icon={<FileText size={20} />}
                title="Nenhum documento enviado"
                hint={podeEnviar ? "Envie identidade, contrato e certificados para completar a ficha." : undefined}
              />
            ) : (
              documentos.map(doc => {
                const aprovacao = APROVACAO[doc.aprovacao];
                const validade = VALIDADE[doc.situacaoValidade];
                return (
                  <tr key={doc.id}>
                    <td>
                      <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                        {doc.restrito && (
                          <Lock size={11} style={{ color: "var(--accent-amber)" }} aria-label="Restrito" />
                        )}
                        {doc.titulo}
                      </div>
                      {doc.motivoRejeicao && (
                        <div style={{ fontSize: 11, color: "var(--accent-red)", marginTop: 2 }}>
                          {doc.motivoRejeicao}
                        </div>
                      )}
                    </td>
                    <td>{CATEGORIA_LABEL[doc.categoria] ?? doc.categoria}</td>
                    <td className="num">{fmtData(doc.dataEmissao)}</td>
                    <td className="num">
                      {fmtData(doc.dataValidade)}
                      {validade && (
                        <div style={{ marginTop: 3 }}>
                          <StatusBadge label={validade.label} tone={validade.tone} />
                        </div>
                      )}
                    </td>
                    <td><StatusBadge label={aprovacao.label} tone={aprovacao.tone} /></td>
                    <td>
                      <RowActions>
                        {doc.podeBaixar ? (
                          <RowAction
                            tone="view"
                            title={baixando === doc.id ? "Baixando..." : "Baixar"}
                            onClick={() => baixar(doc)}
                          >
                            <Download size={13} />
                          </RowAction>
                        ) : (
                          // Restrito: a linha existe para o gestor saber que a
                          // pendência foi resolvida, sem abrir o conteúdo.
                          <span
                            title="Documento restrito ao RH e ao próprio colaborador"
                            style={{ display: "inline-flex", padding: 6, color: "var(--text-faint)" }}
                          >
                            <Lock size={13} />
                          </span>
                        )}

                        {podeAprovar && doc.aprovacao === "PENDENTE" && (
                          <>
                            <RowAction tone="view" title="Aprovar" onClick={() => setDecisao({ doc, tipo: "APROVADO" })}>
                              <Check size={13} />
                            </RowAction>
                            <RowAction tone="danger" title="Rejeitar" onClick={() => setDecisao({ doc, tipo: "REJEITADO" })}>
                              <X size={13} />
                            </RowAction>
                          </>
                        )}

                        {podeExcluir && (
                          <RowAction tone="danger" title="Remover" onClick={() => excluir(doc)}>
                            <Trash2 size={13} />
                          </RowAction>
                        )}
                      </RowActions>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </TableCard>
      </Panel>

      <EnviarDocumento
        aberto={enviando}
        collaboratorId={collaboratorId}
        onFechar={() => setEnviando(false)}
        onEnviado={recarregar}
      />
      <DecidirDocumento
        aberto={!!decisao}
        documento={decisao?.doc ?? null}
        decisao={decisao?.tipo ?? "APROVADO"}
        onFechar={() => setDecisao(null)}
        onDecidido={recarregar}
      />
    </>
  );
}
