"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Topbar from "@/components/layout/Topbar";
import {
  privacyService, LinhaExpurgo, Elegiveis, PreviaAnonimizacao,
} from "@/lib/people/privacy.service";
import {
  PageBody, BackLink, PageHeader, Panel, TableCard, EmptyState, LoadingRows,
  ErrorState, PermissionDenied, StatusBadge, Modal, FormField, FormActions,
} from "@/components/data-ui";
import { useToastStore } from "@/lib/toast";
import { formatarDataBR } from "@/lib/datas";
import { ShieldCheck, AlertTriangle, Clock } from "lucide-react";

/**
 * Privacidade — eliminação do dado pessoal de ex-colaborador (LGPD art. 15/16).
 *
 * Até aqui o módulo tinha soft delete e mais nada, o que não é privacidade: o
 * CPF, o endereço e os documentos digitalizados de quem saiu há anos
 * continuavam inteiros no banco.
 *
 * A TELA NÃO TEM AÇÃO EM MASSA, de propósito. Selecionar quarenta linhas e
 * clicar uma vez seria mais rápido e é exatamente o que não se quer: cada
 * eliminação é irreversível, exige justificativa própria e vira registro de
 * auditoria individual. Rapidez aqui é risco, não conveniência.
 *
 * A lista de quem AINDA NÃO pode aparece junto, e não escondida: o RH precisa
 * conseguir responder "por que fulano ainda está aqui?" sem abrir chamado.
 */

export default function PrivacidadePage() {
  const [dados, setDados] = useState<Elegiveis | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [semPermissao, setSemPermissao] = useState(false);
  const [alvo, setAlvo] = useState<LinhaExpurgo | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    setSemPermissao(false);
    try {
      const r = await privacyService.elegiveis();
      setDados(r.data);
    } catch (e: any) {
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message ?? "Não foi possível carregar a lista.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (semPermissao) {
    return (
      <>
        <Topbar />
        <PageBody>
          <BackLink href="/dashboard/people" label="Voltar para Pessoas" />
          <PermissionDenied />
        </PageBody>
      </>
    );
  }

  return (
    <>
      <Topbar />
      <PageBody>
        <BackLink href="/dashboard/people" label="Voltar para Pessoas" />
        <PageHeader
          icon={<ShieldCheck size={22} />}
          title="Privacidade e retenção"
          subtitle={
            dados
              ? `Prazo de guarda de ${dados.anosGuarda} anos após o desligamento — a prescrição trabalhista.`
              : "Eliminação de dados pessoais de ex-colaboradores"
          }
        />

        {erro && <ErrorState detail={erro} onRetry={carregar} />}

        <Panel title="Como funciona">
          <p>
            Depois do prazo de guarda, o dado que <strong>identifica a pessoa</strong> deve
            ser eliminado: nome, contatos, endereço, data de nascimento e documentos
            digitalizados. O que <strong>fica</strong> é o registro do vínculo — datas,
            cargo, setor e histórico salarial —, porque ele prova tempo de serviço e
            responde a fiscalização.
          </p>
          <p className="muted" style={{ fontSize: 13 }}>
            Nada é apagado automaticamente. Uma ação trabalhista em curso obriga a guardar
            tudo, e o sistema não sabe que ela existe — por isso a decisão é sua, uma
            pessoa de cada vez, e fica registrada na auditoria.
          </p>
        </Panel>

        <TableCard>
          <table>
            <caption className="sr-only">Ex-colaboradores com prazo de guarda vencido</caption>
            <thead>
              <tr>
                <th>Pessoa</th>
                <th>Cargo</th>
                <th>Desligamento</th>
                <th>Prazo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {carregando && <LoadingRows colSpan={5} />}

              {!carregando && dados?.elegiveis.length === 0 && (
                <EmptyState
                  colSpan={5}
                  icon={<ShieldCheck size={20} />}
                  title="Nada a eliminar agora"
                  hint="Ninguém passou do prazo de guarda."
                />
              )}

              {!carregando && dados?.elegiveis.map(l => (
                <tr key={l.id}>
                  <td>
                    <strong>{l.nome}</strong>
                    {l.matricula && <div className="muted" style={{ fontSize: 12 }}>{l.matricula}</div>}
                  </td>
                  <td>{l.cargo ?? "—"}</td>
                  <td>{l.dataDesligamento ? formatarDataBR(l.dataDesligamento) : "—"}</td>
                  <td>
                    <StatusBadge
                      label={`vencido há ${Math.abs(l.diasParaLiberar ?? 0)} dias`}
                      tone="atencao"
                    />
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button type="button" className="btn-secondary" onClick={() => setAlvo(l)}>
                      Eliminar dados
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>

        {!carregando && dados && dados.aguardando.length > 0 && (
          <Panel title={`Ainda dentro do prazo (${dados.aguardando.length})`}>
            <ul style={{ display: "grid", gap: 8, listStyle: "none", padding: 0, margin: 0 }}>
              {dados.aguardando.map(l => (
                <li key={l.id} className="row-line">
                  <span style={{ minWidth: 0 }}>
                    <strong>{l.nome}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>{l.explicacao}</div>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }} className="muted">
                    <Clock size={14} />
                    {l.liberaEm ? formatarDataBR(l.liberaEm) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </PageBody>

      {alvo && (
        <ConfirmarEliminacao
          linha={alvo}
          onFechar={() => setAlvo(null)}
          onConcluiu={() => { setAlvo(null); carregar(); }}
        />
      )}
    </>
  );
}

/* ── Confirmação ─────────────────────────────────────────────────────────── */

/**
 * A prévia é obrigatória antes do botão.
 *
 * O texto exigido para liberar a ação é o NOME da pessoa. Não é cerimônia:
 * digitar o nome obriga a olhar de quem se trata, que é justamente o erro que
 * uma lista de cinquenta linhas convida a cometer.
 */
function ConfirmarEliminacao({
  linha, onFechar, onConcluiu,
}: {
  linha: LinhaExpurgo;
  onFechar: () => void;
  onConcluiu: () => void;
}) {
  const [previa, setPrevia] = useState<PreviaAnonimizacao | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    privacyService.previa(linha.id).then(r => setPrevia(r.data)).catch(() => setPrevia(null));
  }, [linha.id]);

  const nomeConfere = confirmacao.trim().toLowerCase() === linha.nome.trim().toLowerCase();
  const pode = nomeConfere && justificativa.trim().length > 0 && !enviando;

  async function eliminar() {
    setEnviando(true);
    try {
      await privacyService.anonimizar(linha.id, justificativa);
      useToastStore.getState().success("Dados pessoais eliminados");
      onConcluiu();
    } catch { /* o interceptor já mostrou o motivo do backend */ } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      aberto
      titulo="Eliminar dados pessoais"
      subtitulo={linha.nome}
      onFechar={onFechar}
      largura={620}
    >
      <div style={{ display: "grid", gap: 14 }}>
        <p style={{ display: "flex", gap: 8, color: "var(--accent-red)" }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>Esta ação não tem volta. Os dados não podem ser recuperados depois.</span>
        </p>

        {previa && (
          <>
            <div>
              <h4 style={{ marginBottom: 6 }}>Será eliminado</h4>
              <ul className="muted" style={{ fontSize: 13, paddingLeft: 18, margin: 0 }}>
                <li>{previa.seraEliminado.identificacao}</li>
                <li>{previa.seraEliminado.contato}</li>
                {previa.seraEliminado.documentos > 0 && (
                  <li>
                    {previa.seraEliminado.documentos} documento(s) — os arquivos saem do
                    armazenamento
                  </li>
                )}
                {previa.seraEliminado.enderecos > 0 && <li>{previa.seraEliminado.enderecos} endereço(s)</li>}
                {previa.seraEliminado.contatos > 0 && <li>{previa.seraEliminado.contatos} contato(s)</li>}
                {previa.seraEliminado.acessoAoSistema && <li>O vínculo com o login do sistema</li>}
              </ul>
            </div>

            <div>
              <h4 style={{ marginBottom: 6 }}>Será preservado</h4>
              <ul className="muted" style={{ fontSize: 13, paddingLeft: 18, margin: 0 }}>
                {previa.seraPreservado.map((x, i) => <li key={i}>{x}</li>)}
              </ul>
            </div>
          </>
        )}

        <FormField
          label="Justificativa"
          obrigatorio
          dica="Fica registrada na auditoria, junto com o seu usuário"
        >
          <input
            type="text"
            value={justificativa}
            maxLength={500}
            placeholder="Ex.: prazo de guarda vencido, sem litígio em curso"
            onChange={e => setJustificativa(e.target.value)}
          />
        </FormField>

        <FormField
          label={`Digite "${linha.nome}" para confirmar`}
          obrigatorio
          erro={confirmacao && !nomeConfere ? "O nome não confere." : null}
        >
          <input
            type="text"
            value={confirmacao}
            onChange={e => setConfirmacao(e.target.value)}
            autoComplete="off"
          />
        </FormField>

        <FormActions>
          <button type="button" className="btn-secondary" onClick={onFechar}>Cancelar</button>
          <button type="button" className="btn-danger" disabled={!pode} onClick={eliminar}>
            {enviando ? "Eliminando…" : "Eliminar definitivamente"}
          </button>
        </FormActions>
      </div>
    </Modal>
  );
}
