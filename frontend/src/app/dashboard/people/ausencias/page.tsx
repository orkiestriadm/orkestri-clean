"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import { api } from "@/lib/api";
import {
  absencesService, Ausencia, StatusAusencia, TipoAusencia, TIPOS_AUSENCIA,
} from "@/lib/people/absences.service";
import {
  PageBody, BackLink, PageHeader, Toolbar, SelectFilter, SearchInput,
  TableCard, EmptyState, LoadingRows, ErrorState, PermissionDenied,
  StatusBadge, BadgeTone, RowActions, RowAction, Modal, FormGrid, FormField, FormActions,
} from "@/components/data-ui";
import { CalendarX, Plus, Check, X, Ban } from "lucide-react";

/**
 * Ausências — férias, atestado, folga, licença.
 *
 * Estava em Cadastros, que é onde se administra o sistema. Ausência não é
 * cadastro: é operação diária de RH e de gestor, e o lugar dela é junto das
 * pessoas.
 *
 * A aprovação é do gestor direto (ou master) — o backend recusa qualquer outro,
 * e a tela não esconde o botão por isso: recusar com motivo claro ensina mais
 * do que uma ação que some sem explicação.
 */

const STATUS: Record<StatusAusencia, { label: string; tone: BadgeTone }> = {
  PENDENTE:  { label: "Pendente",  tone: "atencao" },
  APROVADA:  { label: "Aprovada",  tone: "ok" },
  REJEITADA: { label: "Rejeitada", tone: "critico" },
  CANCELADA: { label: "Cancelada", tone: "neutro" },
};

const ROTULO_TIPO = new Map(TIPOS_AUSENCIA.map(t => [t.value, t.label]));

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Dias corridos, inclusivo — mesma contagem que férias usa. */
const contarDias = (inicio: string, fim: string) =>
  Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 86_400_000) + 1;

function pode(user: any, ...perms: string[]): boolean {
  if (user?.isMaster) return true;
  const atuais: string[] = user?.permissions ?? [];
  return atuais.includes("*") || perms.some(p => atuais.includes(p));
}

const nomeDe = (a: Ausencia) =>
  a.collaborator?.nomeCompleto || a.collaborator?.user?.nome || "—";

export default function AusenciasPage() {
  const user = useAuthStore(s => s.user);
  const [itens, setItens] = useState<Ausencia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);

  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [tipo, setTipo] = useState("");
  const [criando, setCriando] = useState(false);
  const [rejeitando, setRejeitando] = useState<Ausencia | null>(null);

  const podeCriar = pode(user, "colaboradores:criar", "people.colaborador:criar");
  const podeDecidir = pode(user, "colaboradores:editar", "people.colaborador:editar");

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null); setSemPermissao(false);
    try {
      setItens(await absencesService.listar());
    } catch (e: any) {
      setItens([]);
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message || "Não foi possível carregar as ausências.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return itens.filter(a =>
      (!status || a.status === status) &&
      (!tipo || a.tipo === tipo) &&
      (!termo || nomeDe(a).toLowerCase().includes(termo)),
    );
  }, [itens, busca, status, tipo]);

  const pendentes = itens.filter(a => a.status === "PENDENTE").length;

  async function aprovar(a: Ausencia) {
    try {
      await absencesService.aprovar(a.id);
      useToastStore.getState().success("Ausência aprovada");
      carregar();
    } catch { /* interceptor mostra o motivo do backend */ }
  }

  async function cancelar(a: Ausencia) {
    if (!confirm(`Cancelar a ausência de ${nomeDe(a)}?`)) return;
    try {
      await absencesService.cancelar(a.id);
      useToastStore.getState().success("Ausência cancelada");
      carregar();
    } catch { /* interceptor */ }
  }

  const COLUNAS = ["Colaborador", "Tipo", "Período", "Dias", "Situação", ""];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href="/dashboard/people" label="Colaboradores" />

          <PageHeader
            icon={<CalendarX size={19} />}
            title="Ausências"
            subtitle={
              pendentes > 0
                ? `${pendentes} ${pendentes === 1 ? "solicitação aguardando" : "solicitações aguardando"} decisão`
                : "Férias, atestados, folgas e licenças"
            }
            actions={
              podeCriar && (
                <button type="button" className="btn btn-primary" onClick={() => setCriando(true)}>
                  <Plus size={14} /> Nova ausência
                </button>
              )
            }
          />

          {semPermissao ? (
            <PermissionDenied hint="Você não tem permissão para ver as ausências." />
          ) : (
            <>
              <Toolbar>
                <SearchInput value={busca} onChange={setBusca} placeholder="Nome do colaborador..." />
                <SelectFilter
                  value={status}
                  onChange={setStatus}
                  options={(Object.keys(STATUS) as StatusAusencia[]).map(s => ({ value: s, label: STATUS[s].label }))}
                  placeholder="Todas as situações"
                />
                <SelectFilter
                  value={tipo}
                  onChange={setTipo}
                  options={TIPOS_AUSENCIA.map(t => ({ value: t.value, label: t.label }))}
                  placeholder="Todos os tipos"
                />
              </Toolbar>

              <TableCard>
                <thead><tr>{COLUNAS.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
                <tbody>
                  {carregando ? (
                    <LoadingRows colSpan={COLUNAS.length} rows={5} />
                  ) : erro ? (
                    <ErrorState detail={erro} onRetry={carregar} colSpan={COLUNAS.length} />
                  ) : filtrados.length === 0 ? (
                    <EmptyState
                      colSpan={COLUNAS.length}
                      icon={<CalendarX size={20} />}
                      title={itens.length === 0 ? "Nenhuma ausência registrada" : "Nenhuma ausência com esses filtros"}
                      hint={itens.length === 0 && podeCriar ? "Registre férias, atestados e licenças da equipe." : undefined}
                    />
                  ) : (
                    filtrados.map(a => {
                      const s = STATUS[a.status] ?? STATUS.CANCELADA;
                      return (
                        <tr key={a.id}>
                          <td>
                            <Link
                              href={`/dashboard/people/${a.collaboratorId}`}
                              style={{ color: "var(--accent-violet)", textDecoration: "none", fontWeight: 600 }}
                            >
                              {nomeDe(a)}
                            </Link>
                            {a.motivoRejeicao && (
                              <div style={{ fontSize: 11, color: "var(--accent-red)", marginTop: 2 }}>
                                {a.motivoRejeicao}
                              </div>
                            )}
                          </td>
                          <td>
                            {ROTULO_TIPO.get(a.tipo) ?? a.tipo}
                            {/* Marca as férias que passaram pelo saldo do People. */}
                            {a.tipo === "ferias" && a.vacationPeriodId && (
                              <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>
                                debitada do período aquisitivo
                              </div>
                            )}
                          </td>
                          <td className="num">{fmtData(a.dataInicio)} a {fmtData(a.dataFim)}</td>
                          <td className="num">{contarDias(a.dataInicio, a.dataFim)}</td>
                          <td><StatusBadge label={s.label} tone={s.tone} /></td>
                          <td>
                            <RowActions>
                              {podeDecidir && a.status === "PENDENTE" && (
                                <>
                                  <RowAction tone="view" title="Aprovar" onClick={() => aprovar(a)}>
                                    <Check size={13} />
                                  </RowAction>
                                  <RowAction tone="danger" title="Rejeitar" onClick={() => setRejeitando(a)}>
                                    <X size={13} />
                                  </RowAction>
                                </>
                              )}
                              {podeDecidir && a.status === "APROVADA" && (
                                <RowAction tone="danger" title="Cancelar" onClick={() => cancelar(a)}>
                                  <Ban size={13} />
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
            </>
          )}
        </PageBody>
      </div>

      <NovaAusencia aberto={criando} onFechar={() => setCriando(false)} onCriada={carregar} />
      <RejeitarAusencia
        ausencia={rejeitando}
        onFechar={() => setRejeitando(null)}
        onRejeitada={carregar}
      />
    </div>
  );
}

function NovaAusencia({
  aberto, onFechar, onCriada,
}: { aberto: boolean; onFechar: () => void; onCriada: () => void }) {
  const [colaboradores, setColaboradores] = useState<{ id: string; nomeExibicao: string }[]>([]);
  const [collaboratorId, setCollaboratorId] = useState("");
  const [tipo, setTipo] = useState<TipoAusencia>("folga");
  const [dataInicio, setInicio] = useState("");
  const [dataFim, setFim] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setCollaboratorId(""); setTipo("folga"); setInicio(""); setFim(""); setDescricao(""); setErros({});
    api.get("/v1/people/employees", { params: { tamanho: 200, status: "ATIVO" }, silent: true })
      .then(r => setColaboradores(r.data?.data ?? []))
      .catch(() => setColaboradores([]));
  }, [aberto]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const novos: Record<string, string> = {};
    if (!collaboratorId) novos.collaboratorId = "Escolha o colaborador";
    if (!dataInicio) novos.dataInicio = "Informe o início";
    if (!dataFim) novos.dataFim = "Informe o fim";
    if (dataInicio && dataFim && new Date(dataFim) < new Date(dataInicio)) {
      novos.dataFim = "A data final é anterior à inicial";
    }
    setErros(novos);
    if (Object.keys(novos).length) return;

    setSalvando(true);
    try {
      await absencesService.criar({ collaboratorId, tipo, dataInicio, dataFim, descricao });
      useToastStore.getState().success("Ausência registrada", "Aguardando aprovação do gestor.");
      onCriada();
      onFechar();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (err?.response?.status === 400 && msg) {
        setErros({ dataFim: Array.isArray(msg) ? msg.join(". ") : msg });
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto={aberto} titulo="Nova ausência" onFechar={onFechar} largura={540}>
      <form onSubmit={salvar} noValidate>
        <FormGrid>
          <FormField label="Colaborador" obrigatorio erro={erros.collaboratorId} largura="total">
            <select
              className="input-o" value={collaboratorId}
              onChange={e => setCollaboratorId(e.target.value)}
            >
              <option value="">—</option>
              {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nomeExibicao}</option>)}
            </select>
          </FormField>

          <FormField
            label="Tipo"
            obrigatorio
            dica={tipo === "ferias" ? "Férias com saldo: use a aba Férias do perfil" : undefined}
          >
            <select className="input-o" value={tipo} onChange={e => setTipo(e.target.value as TipoAusencia)}>
              {TIPOS_AUSENCIA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </FormField>

          <FormField label="Início" obrigatorio erro={erros.dataInicio}>
            <input type="date" className="input-o" value={dataInicio} onChange={e => setInicio(e.target.value)} />
          </FormField>

          <FormField label="Fim" obrigatorio erro={erros.dataFim}>
            <input type="date" className="input-o" value={dataFim} onChange={e => setFim(e.target.value)} />
          </FormField>

          {/* Registrar férias por aqui não passa pelo saldo nem debita período
              aquisitivo — o caminho com controle é o perfil do colaborador. */}
          {tipo === "ferias" && (
            <p style={{ gridColumn: "1 / -1", fontSize: 11.5, color: "var(--accent-amber)", lineHeight: 1.5, margin: 0 }}>
              Férias registradas aqui não debitam o período aquisitivo. Para
              controlar saldo, use a aba Férias no perfil do colaborador.
            </p>
          )}

          <FormField label="Observação" largura="total">
            <textarea
              className="input-o" rows={2} maxLength={500}
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
            {salvando ? "Registrando..." : "Registrar"}
          </button>
        </FormActions>
      </form>
    </Modal>
  );
}

function RejeitarAusencia({
  ausencia, onFechar, onRejeitada,
}: { ausencia: Ausencia | null; onFechar: () => void; onRejeitada: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (ausencia) { setMotivo(""); setErro(""); } }, [ausencia]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!ausencia) return;
    if (!motivo.trim()) { setErro("Explique o motivo da recusa"); return; }

    setSalvando(true);
    try {
      await absencesService.rejeitar(ausencia.id, motivo.trim());
      useToastStore.getState().success("Ausência rejeitada");
      onRejeitada();
      onFechar();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (err?.response?.status === 400 && msg) setErro(Array.isArray(msg) ? msg.join(". ") : msg);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={!!ausencia}
      titulo="Rejeitar ausência"
      subtitulo={ausencia ? nomeDe(ausencia) : undefined}
      onFechar={onFechar}
      largura={460}
    >
      <form onSubmit={salvar} noValidate>
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6, marginTop: 0 }}>
          O motivo vai para quem solicitou. Recusar sem explicar só gera a mesma
          solicitação de novo.
        </p>

        <FormGrid>
          <FormField label="Motivo" obrigatorio erro={erro} largura="total">
            <textarea
              className="input-o" rows={3} maxLength={500} autoFocus
              value={motivo} onChange={e => setMotivo(e.target.value)}
            />
          </FormField>
        </FormGrid>

        <FormActions>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? "Rejeitando..." : "Rejeitar"}
          </button>
        </FormActions>
      </form>
    </Modal>
  );
}
