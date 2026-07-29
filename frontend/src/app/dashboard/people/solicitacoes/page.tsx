"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Topbar from "@/components/layout/Topbar";
import { useToastStore } from "@/lib/toast";
import {
  requestsService, Solicitacao, StatusSolicitacao, TipoSolicitacao, TIPOS_SOLICITACAO,
} from "@/lib/people/requests.service";
import {
  PageBody, BackLink, PageHeader, TableCard, EmptyState, LoadingRows,
  ErrorState, PermissionDenied, StatusBadge, BadgeTone, RowActions, RowAction,
  Modal, FormGrid, FormField, FormActions,
} from "@/components/data-ui";
import { Inbox, Plus, Ban, ArrowRight } from "lucide-react";

/**
 * Solicitações ao RH — autosserviço do colaborador.
 *
 * Roda sobre o motor de workflow que já existe: aprovação por setor,
 * delegação, escalonamento e histórico vêm de graça. A decisão acontece em
 * Aprovações, onde o gestor já trabalha — trazer uma segunda fila para cá
 * dividiria a atenção de quem aprova.
 */

const STATUS: Record<StatusSolicitacao, { label: string; tone: BadgeTone }> = {
  PENDENTE:  { label: "Em análise", tone: "atencao" },
  APROVADA:  { label: "Aprovada",   tone: "ok" },
  REJEITADA: { label: "Rejeitada",  tone: "critico" },
  CANCELADA: { label: "Cancelada",  tone: "neutro" },
};

const ROTULO_TIPO = new Map(TIPOS_SOLICITACAO.map(t => [t.value, t.label]));

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export default function SolicitacoesPage() {
  const [itens, setItens] = useState<Solicitacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null); setSemPermissao(false);
    try {
      setItens(await requestsService.listar());
    } catch (e: any) {
      setItens([]);
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message || "Não foi possível carregar as solicitações.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function cancelar(s: Solicitacao) {
    if (!confirm(`Cancelar a solicitação "${s.titulo}"?`)) return;
    try {
      await requestsService.cancelar(s.id);
      useToastStore.getState().success("Solicitação cancelada");
      carregar();
    } catch { /* interceptor */ }
  }

  const COLUNAS = ["Solicitação", "Tipo", "Aberta em", "Situação", ""];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href="/dashboard/people" label="Colaboradores" />

          <PageHeader
            icon={<Inbox size={19} />}
            title="Solicitações ao RH"
            subtitle="Alteração de dados, pedido de documento e outros assuntos"
            actions={
              <button type="button" className="btn btn-primary" onClick={() => setCriando(true)}>
                <Plus size={14} /> Nova solicitação
              </button>
            }
          />

          {semPermissao ? (
            <PermissionDenied hint="Você não tem permissão para ver solicitações." />
          ) : (
            <>
              <TableCard>
                <thead><tr>{COLUNAS.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
                <tbody>
                  {carregando ? (
                    <LoadingRows colSpan={COLUNAS.length} rows={4} />
                  ) : erro ? (
                    <ErrorState detail={erro} onRetry={carregar} colSpan={COLUNAS.length} />
                  ) : itens.length === 0 ? (
                    <EmptyState
                      colSpan={COLUNAS.length}
                      icon={<Inbox size={20} />}
                      title="Nenhuma solicitação aberta"
                      hint="Peça alteração de cadastro, documentos ou qualquer assunto ao RH."
                    />
                  ) : (
                    itens.map(s => {
                      const st = STATUS[s.status] ?? STATUS.CANCELADA;
                      const p = s.payload as any;
                      return (
                        <tr key={s.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{s.titulo}</div>
                            {/* De/para lado a lado: é o que o RH precisa ver. */}
                            {p?.campo && (
                              <div
                                style={{
                                  display: "flex", alignItems: "center", gap: 6,
                                  fontSize: 11, color: "var(--text-muted)", marginTop: 3,
                                }}
                              >
                                <span>{p.campo}:</span>
                                <span style={{ textDecoration: "line-through" }}>{p.valorAtual || "vazio"}</span>
                                <ArrowRight size={10} />
                                <span style={{ color: "var(--text-secondary)" }}>{p.valorNovo || "vazio"}</span>
                              </div>
                            )}
                            {s.motivoRejeicao && (
                              <div style={{ fontSize: 11, color: "var(--accent-red)", marginTop: 3 }}>
                                {s.motivoRejeicao}
                              </div>
                            )}
                          </td>
                          <td>{ROTULO_TIPO.get(s.tipo as TipoSolicitacao) ?? s.tipo}</td>
                          <td className="num">{fmtData(s.criadoEm)}</td>
                          <td><StatusBadge label={st.label} tone={st.tone} /></td>
                          <td>
                            {s.status === "PENDENTE" && (
                              <RowActions>
                                <RowAction tone="danger" title="Cancelar" onClick={() => cancelar(s)}>
                                  <Ban size={13} />
                                </RowAction>
                              </RowActions>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </TableCard>

              <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 12 }}>
                A decisão acontece em <strong>Aprovações</strong>, junto das demais
                solicitações — quem aprova não precisa acompanhar duas filas.
              </p>
            </>
          )}
        </PageBody>
      </div>

      <NovaSolicitacao aberto={criando} onFechar={() => setCriando(false)} onCriada={carregar} />
    </div>
  );
}

function NovaSolicitacao({
  aberto, onFechar, onCriada,
}: { aberto: boolean; onFechar: () => void; onCriada: () => void }) {
  const [tipo, setTipo] = useState<TipoSolicitacao>("people.alteracao_cadastral");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [campo, setCampo] = useState("");
  const [valorAtual, setValorAtual] = useState("");
  const [valorNovo, setValorNovo] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setTipo("people.alteracao_cadastral");
    setTitulo(""); setDescricao(""); setCampo(""); setValorAtual(""); setValorNovo("");
    setErros({});
  }, [aberto]);

  const escolhido = TIPOS_SOLICITACAO.find(t => t.value === tipo);
  const ehCadastral = tipo === "people.alteracao_cadastral";

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const novos: Record<string, string> = {};
    if (!titulo.trim()) novos.titulo = "Descreva a solicitação em uma linha";
    if (ehCadastral && !campo.trim()) novos.campo = "Informe qual dado deve mudar";
    setErros(novos);
    if (Object.keys(novos).length) return;

    setSalvando(true);
    try {
      await requestsService.criar({ tipo, titulo, descricao, campo, valorAtual, valorNovo });
      useToastStore.getState().success(
        "Solicitação enviada",
        "Você será avisado quando houver decisão.",
      );
      onCriada();
      onFechar();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (err?.response?.status === 400 && msg) {
        setErros({ titulo: Array.isArray(msg) ? msg.join(". ") : msg });
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto={aberto} titulo="Nova solicitação ao RH" onFechar={onFechar} largura={540}>
      <form onSubmit={salvar} noValidate>
        <FormGrid>
          <FormField label="Tipo" obrigatorio dica={escolhido?.dica} largura="total">
            <select
              className="input-o" value={tipo}
              onChange={e => setTipo(e.target.value as TipoSolicitacao)}
            >
              {TIPOS_SOLICITACAO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </FormField>

          <FormField label="Assunto" obrigatorio erro={erros.titulo} largura="total">
            <input
              className="input-o" maxLength={160} value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder={ehCadastral ? "Ex.: Atualização de endereço" : "Ex.: Declaração de vínculo"}
            />
          </FormField>

          {ehCadastral && (
            <>
              <FormField label="Qual dado" obrigatorio erro={erros.campo} largura="total">
                <input
                  className="input-o" maxLength={60} value={campo}
                  onChange={e => setCampo(e.target.value)}
                  placeholder="Ex.: Endereço, Telefone, Conta bancária"
                />
              </FormField>

              <FormField label="Valor atual">
                <input
                  className="input-o" maxLength={160} value={valorAtual}
                  onChange={e => setValorAtual(e.target.value)}
                />
              </FormField>

              <FormField label="Novo valor">
                <input
                  className="input-o" maxLength={160} value={valorNovo}
                  onChange={e => setValorNovo(e.target.value)}
                />
              </FormField>
            </>
          )}

          <FormField label="Detalhes" largura="total">
            <textarea
              className="input-o" rows={3} maxLength={1000}
              value={descricao} onChange={e => setDescricao(e.target.value)}
              placeholder="Opcional"
            />
          </FormField>
        </FormGrid>

        <FormActions>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? "Enviando..." : "Enviar solicitação"}
          </button>
        </FormActions>
      </form>
    </Modal>
  );
}
