"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import {
  PageBody, BackLink, DetailHeader, Tabs, ErrorState, PermissionDenied, TableCard, EmptyState, StatusBadge,
  RowActions, RowAction,
} from "@/components/data-ui";
import {
  Pencil, Trash2, Flag, Plus, Download, Upload, CheckCircle2, AlertTriangle, History,
} from "lucide-react";
import { estrategicoService } from "@/lib/estrategico/estrategico.service";
import type {
  CasoDetalhe, Filtros, Evento, Tarefa, Comentario, Dependencia, Documento, ItemHistorico, ValorHistorico,
} from "@/lib/estrategico/types";
import { ROTULO_STATUS_TAREFA, ROTULO_FAROL, COR_FAROL, SIGNIFICADO_FAROL } from "@/lib/estrategico/types";
import {
  BASE, pode, data, dataEvento, dinheiro, dinheiroCurto, FarolPonto, SeloFarol, SeloRisco, SemAcao,
  prazoEmPalavras, paradoEmPalavras, Aviso, Nota, mensagemErro,
} from "../../_components/comuns";
import { Cartao, MatrizRisco } from "../../_components/graficos";
import CasoForm, { AbaForm } from "../../_components/CasoForm";
import { EventoModal, TarefaModal, FarolModal, DependenciaModal } from "../../_components/AtividadeModais";

type Aba = "timeline" | "tarefas" | "documentos" | "riscos" | "dependencias" | "financeiro" | "comentarios" | "historico" | "original";

const ROTULO_ORIGEM: Record<string, string> = { importacao: "planilha", sistema: "sistema", reuniao: "reunião", manual: "" };

/**
 * Tela do assunto estratégico (seção 23 do plano).
 *
 * O cabeçalho responde em segundos: em que pé está (farol + etapa +
 * dependência), qual o próximo passo e quanto vale. O resto — timeline,
 * tarefas, documentos, riscos — fica nas abas.
 */
export default function CasoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const toast = useToastStore();

  const [c, setC] = useState<CasoDetalhe | null>(null);
  const [filtros, setFiltros] = useState<Filtros | null>(null);
  const [aba, setAba] = useState<Aba>("timeline");
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);

  const [editar, setEditar] = useState<AbaForm | null>(null);
  const [farolAberto, setFarolAberto] = useState(false);

  const fin = pode(user, "estrategico.financeiro:ver");
  const podeEditar = !!c?.podeEditar;
  const podeRegistrar = podeEditar || pode(user, "estrategico.tarefa:executar");

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setC(await estrategicoService.obter(id));
    } catch (e: any) {
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(mensagemErro(e, "Falha ao carregar o assunto."));
    }
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { estrategicoService.filtros().then(setFiltros).catch(() => {}); }, []);

  async function excluir() {
    if (!c || !confirm(`Excluir ${c.codigo}? O histórico é preservado (exclusão lógica).`)) return;
    try {
      await estrategicoService.excluir(c.id);
      toast.success("Assunto excluído");
      router.push(`${BASE}/assuntos`);
    } catch (e) { toast.error("Não foi possível excluir", mensagemErro(e, "")); }
  }

  async function validarImportacao() {
    if (!c) return;
    try {
      setC(await estrategicoService.atualizar(c.id, { revisarImportacao: false }));
      toast.success("Importação validada");
    } catch (e) { toast.error("Não foi possível validar", mensagemErro(e, "")); }
  }

  const abas: { id: Aba; label: string }[] = [
    { id: "timeline", label: "Timeline" },
    { id: "tarefas", label: "Tarefas" },
    ...(pode(user, "estrategico.documento:ver") ? [{ id: "documentos" as Aba, label: "Documentos" }] : []),
    { id: "riscos", label: "Riscos" },
    { id: "dependencias", label: "Dependências" },
    ...(fin ? [{ id: "financeiro" as Aba, label: "Financeiro" }] : []),
    { id: "comentarios", label: "Comentários" },
    { id: "historico", label: "Histórico" },
    ...(c?.importado ? [{ id: "original" as Aba, label: "Dados originais" }] : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href={`${BASE}/assuntos`} label="Assuntos" />
          {semPermissao ? <PermissionDenied /> : erro ? <ErrorState detail={erro} onRetry={carregar} /> : !c ? (
            <>
              <div className="skeleton" style={{ height: 70, borderRadius: 14, marginBottom: 16 }} />
              <div className="skeleton" style={{ height: 180, borderRadius: 14 }} />
            </>
          ) : (
            <>
              <DetailHeader
                avatar={<FarolPonto farol={c.farol} tamanho={16} />}
                titulo={`${c.codigo} — ${c.titulo}`}
                selo={<SeloFarol farol={c.farol} manual={!!c.farolManual} />}
                subtitulo={c.statusTexto}
                meta={
                  <span style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 12, color: "var(--text-secondary)" }}>
                    <span>Prioridade: <strong>{c.prioridadeRotulo}</strong></span>
                    {c.tipo === "oportunidade" && <span>Oportunidade · {c.estagioRotulo ?? "Identificada"}</span>}
                    {c.objetivo && <span>Objetivo: {c.objetivo.nome}</span>}
                    {c.esfera && <span>Esfera: {c.esfera.nome}</span>}
                    {c.grupo && <span>Grupo: {c.grupo.nome}</span>}
                    <span>Última movimentação: {c.ultimaMovimentacaoEm ? `${data(c.ultimaMovimentacaoEm)} (${paradoEmPalavras(c.diasParado)})` : "sem andamento datado"}</span>
                  </span>
                }
                actions={
                  <>
                    {podeEditar && <button type="button" className="btn btn-ghost" onClick={() => setEditar("geral")}><Pencil size={14} /> Editar</button>}
                    {pode(user, "estrategico.caso:farol") && <button type="button" className="btn btn-ghost" onClick={() => setFarolAberto(true)}><Flag size={14} /> Farol</button>}
                    {pode(user, "estrategico.caso:excluir") && <button type="button" className="btn btn-ghost" onClick={excluir}><Trash2 size={14} /></button>}
                  </>
                }
              />

              {c.revisarImportacao && c.importacao && (
                <Aviso tom="info">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <div>
                      <strong>Importado da planilha — validar.</strong> {c.importacao.pendencias.length} ponto(s) para conferir
                      (aba {c.importacao.aba}, linha {c.importacao.linha}):
                      <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                        {c.importacao.pendencias.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>
                    {podeEditar && <button type="button" className="btn btn-ghost" onClick={validarImportacao}><CheckCircle2 size={14} /> Marcar como validado</button>}
                  </div>
                </Aviso>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 14 }}>
                {/* Farol */}
                <section className="panel" style={{ padding: 16, borderTop: `3px solid ${COR_FAROL[c.farol]}` }}>
                  <div className="mono-cap" style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 8 }}>Farol estratégico</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }} title={SIGNIFICADO_FAROL[c.farol]}>
                    <FarolPonto farol={c.farol} tamanho={14} />
                    <span style={{ fontSize: 18, fontWeight: 700 }}>{ROTULO_FAROL[c.farol]}</span>
                    {c.farolManual && <StatusBadge label="manual" tone="neutro" />}
                  </div>
                  {c.farolManual && (
                    <p style={{ fontSize: 12, margin: "0 0 6px", color: "var(--text-secondary)" }}>
                      Justificativa: {c.farolJustificativa}
                      {c.farolDivergente && <><br />Cálculo sugere: <strong>{ROTULO_FAROL[c.farolCalculado]}</strong></>}
                    </p>
                  )}
                  {c.farolMotivos.length ? (
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                      {c.farolMotivos.map(m => <li key={m.codigo + m.texto} style={{ color: m.nivel === "vermelho" ? "var(--accent-red)" : undefined }}>{m.texto}</li>)}
                    </ul>
                  ) : <Nota>{c.ativo ? "Nenhuma pendência identificada." : c.etapaRotulo}</Nota>}
                </section>

                {/* Próxima ação */}
                <section className="panel" style={{ padding: 16 }}>
                  <div className="mono-cap" style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 8 }}>Próxima ação</div>
                  {!c.ativo ? <Nota>Assunto {c.natureza === "suspensa" ? "suspenso" : "encerrado"}.</Nota> : c.semProximaAcao ? (
                    <div style={{ marginBottom: 10 }}><SemAcao /></div>
                  ) : (
                    <>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, lineHeight: 1.35 }}>{c.proximaAcao}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 10px", fontSize: 12 }}>
                        <span style={{ color: "var(--text-muted)" }}>Responsável</span>
                        <span>{c.proximaAcaoResponsavel?.nome ?? c.proximaAcaoResponsavelNome ?? <span style={{ color: "var(--accent-amber)" }}>não definido</span>}</span>
                        <span style={{ color: "var(--text-muted)" }}>Prazo</span>
                        <span className="num" style={{ color: c.acaoVencida ? "var(--accent-red)" : undefined, fontWeight: c.acaoVencida ? 700 : 400 }}>
                          {c.proximaAcaoPrazo ? `${data(c.proximaAcaoPrazo)} · ${prazoEmPalavras(c.diasProximaAcao)}` : "sem prazo"}
                        </span>
                        {c.proximaAcaoPrioridade && <><span style={{ color: "var(--text-muted)" }}>Prioridade</span><span>{filtros?.prioridades.find(p => p.id === c.proximaAcaoPrioridade)?.rotulo}</span></>}
                      </div>
                    </>
                  )}
                  {podeEditar && c.ativo && (
                    <button type="button" className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => setEditar("acao")}>
                      <Pencil size={13} /> {c.semProximaAcao ? "Definir próxima ação" : "Atualizar ação"}
                    </button>
                  )}
                </section>

                {/* Resumo financeiro */}
                <section className="panel" style={{ padding: 16 }}>
                  <div className="mono-cap" style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 8 }}>Resumo financeiro</div>
                  {!c.financeiroVisivel ? <Nota>Valores restritos ao seu perfil.</Nota> : !c.temValor ? (
                    <>
                      <Nota>Nenhum valor informado.</Nota>
                      {(c.importacao?.valoresCitados?.length ?? 0) > 0 && <Nota>{c.importacao!.valoresCitados.length} valor(es) citado(s) nos andamentos — veja a aba Financeiro.</Nota>}
                    </>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {([["valorPretendido", "Pretensão"], ["valorReconhecido", "Reconhecido"], ["valorAlcancado", "Alcançado"], ["valorEmRisco", "Em risco"]] as const).map(([k, r]) => (
                        <div key={k} title={dinheiro(c[k])}>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r}</div>
                          <div className="metric" style={{ fontSize: 16, color: k === "valorEmRisco" && c[k] ? "var(--accent-red)" : undefined }}>{dinheiroCurto(c[k])}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {pode(user, "estrategico.financeiro:editar") && podeEditar && (
                    <button type="button" className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => setEditar("financeiro")}><Pencil size={13} /> Valores</button>
                  )}
                </section>
              </div>

              {/* Responsabilidade */}
              <section className="panel" style={{ padding: "12px 16px", marginBottom: 16, display: "flex", flexWrap: "wrap", gap: "8px 28px", fontSize: 12.5 }}>
                <Resp rotulo="Executivo" area={c.areaExecutiva?.nome} pessoa={c.responsavelExecutivo?.nome} />
                <Resp rotulo="Operacional" area={c.areaOperacional?.nome} pessoa={c.responsavelOperacional?.nome} />
                <span><span style={{ color: "var(--text-muted)" }}>Apoio: </span>{c.areasApoio.length ? c.areasApoio.map(a => a.nome).join(", ") : "—"}</span>
                <span><span style={{ color: "var(--text-muted)" }}>Dependências: </span>{c.dependenciaTexto ?? "nenhuma ativa"}</span>
                {podeEditar && <button type="button" className="btn btn-ghost" style={{ padding: "2px 8px", fontSize: 11.5 }} onClick={() => setEditar("responsaveis")}><Pencil size={12} /> Responsáveis</button>}
              </section>

              <Tabs tabs={abas} active={aba} onChange={id => setAba(id as Aba)} />
              <div style={{ marginTop: 14 }}>
                {aba === "timeline" && <AbaTimeline caso={c} filtros={filtros} podeRegistrar={podeRegistrar} podeEditar={podeEditar} onMudou={carregar} />}
                {aba === "tarefas" && <AbaTarefas caso={c} filtros={filtros} podeRegistrar={podeRegistrar} podeEditar={podeEditar} userId={user?.id} onMudou={carregar} />}
                {aba === "documentos" && <AbaDocumentos caso={c} filtros={filtros} podeEnviar={podeRegistrar && pode(user, "estrategico.documento:enviar")} podeExcluir={pode(user, "estrategico.documento:excluir")} />}
                {aba === "riscos" && <AbaRiscos caso={c} filtros={filtros} podeEditar={podeEditar} onEditar={() => setEditar("risco")} />}
                {aba === "dependencias" && <AbaDependencias caso={c} filtros={filtros} podeEditar={podeEditar} onMudou={carregar} />}
                {aba === "financeiro" && <AbaFinanceiro caso={c} filtros={filtros} podeEditar={podeEditar && pode(user, "estrategico.financeiro:editar")} onEditar={() => setEditar("financeiro")} />}
                {aba === "comentarios" && <AbaComentarios caso={c} podeComentar={podeRegistrar} userId={user?.id} />}
                {aba === "historico" && <AbaHistorico caso={c} />}
                {aba === "original" && <AbaOriginal caso={c} />}
              </div>

              <CasoForm aberto={!!editar} caso={c} abaInicial={editar ?? "geral"} filtros={filtros} onFechar={() => setEditar(null)} onSalvo={r => { setEditar(null); setC(r); }} />
              <FarolModal aberto={farolAberto} caso={c} onFechar={() => setFarolAberto(false)} onSalvo={r => { setFarolAberto(false); setC(r); }} />
            </>
          )}
        </PageBody>
      </div>
    </div>
  );
}

function Resp({ rotulo, area, pessoa }: { rotulo: string; area?: string | null; pessoa?: string | null }) {
  return (
    <span>
      <span style={{ color: "var(--text-muted)" }}>{rotulo}: </span>
      {area || pessoa ? [area, pessoa].filter(Boolean).join(" · ") : <span style={{ color: "var(--accent-amber)" }}>não definido</span>}
    </span>
  );
}

/* ── Timeline ───────────────────────────────────────────────────────────── */

function AbaTimeline({ caso, filtros, podeRegistrar, podeEditar, onMudou }: { caso: CasoDetalhe; filtros: Filtros | null; podeRegistrar: boolean; podeEditar: boolean; onMudou: () => void }) {
  const toast = useToastStore();
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [modal, setModal] = useState<{ evento: Evento | null } | null>(null);
  const carregar = useCallback(() => { estrategicoService.eventos(caso.id).then(setEventos).catch(() => setEventos([])); }, [caso.id]);
  useEffect(() => { carregar(); }, [carregar]);

  async function excluir(e: Evento) {
    if (!confirm(`Excluir o andamento "${e.titulo}"?`)) return;
    try { await estrategicoService.excluirEvento(e.id); carregar(); onMudou(); } catch (err) { toast.error("Não foi possível excluir", mensagemErro(err, "")); }
  }

  const rotuloTipo = (t: string) => filtros?.tiposEvento.find(x => x.id === t)?.rotulo ?? t;

  return (
    <Cartao titulo="Timeline" acoes={podeRegistrar ? <button type="button" className="btn btn-primary" style={{ padding: "5px 12px" }} onClick={() => setModal({ evento: null })}><Plus size={13} /> Registrar andamento</button> : undefined}>
      {eventos == null ? <div className="skeleton" style={{ height: 120, borderRadius: 10 }} /> : eventos.length === 0 ? <Nota>Nenhum andamento registrado.</Nota> : (
        <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {eventos.map(e => (
            <li key={e.id} style={{ display: "grid", gridTemplateColumns: "92px 1fr auto", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
              <span className="num" style={{ fontSize: 12, color: "var(--text-secondary)" }}>{dataEvento(e.dataEvento, e.precisaoData)}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 2 }}>
                  <StatusBadge label={rotuloTipo(e.tipo)} tone={e.tipo === "decisao" ? "info" : e.tipo === "protocolo" ? "ok" : "neutro"} />
                  {ROTULO_ORIGEM[e.origem] && <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>via {ROTULO_ORIGEM[e.origem]}</span>}
                  {e.revisar && <span style={{ fontSize: 10.5, color: "var(--accent-amber)" }} title="Convertido automaticamente — conferir data e contexto"><AlertTriangle size={11} /> conferir</span>}
                </span>
                <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{e.titulo}</span>
                {e.descricao && e.descricao !== e.titulo && <span style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", whiteSpace: "pre-wrap", marginTop: 2 }}>{e.descricao}</span>}
                {e.decisao && <span style={{ display: "block", fontSize: 12, marginTop: 4 }}><strong>Decisão:</strong> {e.decisao}</span>}
                {e.proximoPasso && <span style={{ display: "block", fontSize: 12, marginTop: 2 }}><strong>Próximo passo:</strong> {e.proximoPasso}</span>}
              </span>
              {podeEditar && e.origem !== "sistema" && (
                <RowActions>
                  <RowAction tone="edit" title="Editar" onClick={() => setModal({ evento: e })}><Pencil size={13} /></RowAction>
                  <RowAction tone="danger" title="Excluir" onClick={() => excluir(e)}><Trash2 size={13} /></RowAction>
                </RowActions>
              )}
            </li>
          ))}
        </ol>
      )}
      <EventoModal aberto={!!modal} casoId={caso.id} evento={modal?.evento} filtros={filtros} onFechar={() => setModal(null)} onSalvo={() => { setModal(null); carregar(); onMudou(); }} />
    </Cartao>
  );
}

/* ── Tarefas ────────────────────────────────────────────────────────────── */

function AbaTarefas({ caso, filtros, podeRegistrar, podeEditar, userId, onMudou }: { caso: CasoDetalhe; filtros: Filtros | null; podeRegistrar: boolean; podeEditar: boolean; userId?: string; onMudou: () => void }) {
  const toast = useToastStore();
  const [tarefas, setTarefas] = useState<Tarefa[] | null>(null);
  const [modal, setModal] = useState<{ tarefa: Tarefa | null } | null>(null);
  const carregar = useCallback(() => { estrategicoService.tarefas(caso.id).then(setTarefas).catch(() => setTarefas([])); }, [caso.id]);
  useEffect(() => { carregar(); }, [carregar]);

  async function concluir(t: Tarefa) {
    try { await estrategicoService.atualizarTarefa(t.id, { status: "concluida" }); toast.success("Tarefa concluída"); carregar(); onMudou(); }
    catch (e) { toast.error("Não foi possível concluir", mensagemErro(e, "")); }
  }
  async function excluir(t: Tarefa) {
    if (!confirm(`Excluir a tarefa "${t.titulo}"?`)) return;
    try { await estrategicoService.excluirTarefa(t.id); carregar(); onMudou(); } catch (e) { toast.error("Não foi possível excluir", mensagemErro(e, "")); }
  }

  const COLS = ["Tarefa", "Responsável", "Prazo", "Status", ""];
  return (
    <Cartao titulo="Tarefas" acoes={podeRegistrar ? <button type="button" className="btn btn-primary" style={{ padding: "5px 12px" }} onClick={() => setModal({ tarefa: null })}><Plus size={13} /> Nova tarefa</button> : undefined}>
      <TableCard>
        <thead><tr>{COLS.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>
          {tarefas == null ? <tr><td colSpan={5}><div className="skeleton" style={{ height: 40 }} /></td></tr> : tarefas.length === 0 ? (
            <EmptyState colSpan={5} title="Nenhuma tarefa" hint="Quebre a próxima ação em tarefas com responsável e prazo." />
          ) : tarefas.map(t => {
            const minha = t.responsavelId === userId || t.criadoPorId === userId;
            return (
              <tr key={t.id} style={{ opacity: t.aberta ? 1 : 0.6 }}>
                <td style={{ minWidth: 220 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, textDecoration: t.status === "concluida" ? "line-through" : undefined }}>{t.titulo}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {t.origem === "automacao" ? "Gerada pela automação · " : t.origem === "reuniao" ? "Definida em reunião · " : ""}{ROTULO_STATUS_TAREFA[t.status]}{t.conclusao ? ` · ${t.conclusao}` : ""}
                  </div>
                </td>
                <td style={{ fontSize: 12 }}>{t.responsavel?.nome ?? <span style={{ color: "var(--accent-amber)" }}>sem responsável</span>}</td>
                <td className="num" style={{ fontSize: 12, color: t.vencida ? "var(--accent-red)" : undefined, fontWeight: t.vencida ? 700 : 400 }}>
                  {t.prazo ? data(t.prazo) : "—"}{t.aberta && t.prazo && <div style={{ fontSize: 10.5 }}>{prazoEmPalavras(t.diasPrazo)}</div>}
                </td>
                <td><StatusBadge label={ROTULO_STATUS_TAREFA[t.status]} tone={t.status === "concluida" ? "ok" : t.vencida ? "critico" : t.status === "bloqueada" ? "atencao" : "neutro"} /></td>
                <td>
                  <RowActions>
                    {t.aberta && (podeEditar || minha) && <RowAction tone="view" title="Concluir" onClick={() => concluir(t)}><CheckCircle2 size={13} /></RowAction>}
                    {(podeEditar || minha) && <RowAction tone="edit" title="Editar" onClick={() => setModal({ tarefa: t })}><Pencil size={13} /></RowAction>}
                    {podeEditar && <RowAction tone="danger" title="Excluir" onClick={() => excluir(t)}><Trash2 size={13} /></RowAction>}
                  </RowActions>
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableCard>
      <TarefaModal aberto={!!modal} casoId={caso.id} tarefa={modal?.tarefa} filtros={filtros} onFechar={() => setModal(null)} onSalvo={() => { setModal(null); carregar(); onMudou(); }} />
    </Cartao>
  );
}

/* ── Documentos ─────────────────────────────────────────────────────────── */

function AbaDocumentos({ caso, filtros, podeEnviar, podeExcluir }: { caso: CasoDetalhe; filtros: Filtros | null; podeEnviar: boolean; podeExcluir: boolean }) {
  const toast = useToastStore();
  const [docs, setDocs] = useState<Documento[] | null>(null);
  const [categoria, setCategoria] = useState("outro");
  const [titulo, setTitulo] = useState("");
  const [versaoDe, setVersaoDe] = useState("");
  const [enviando, setEnviando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const carregar = useCallback(() => { estrategicoService.documentos(caso.id).then(setDocs).catch(() => setDocs([])); }, [caso.id]);
  useEffect(() => { carregar(); }, [carregar]);

  async function enviar() {
    const f = arquivo.current?.files?.[0];
    if (!f) { toast.error("Selecione um arquivo"); return; }
    setEnviando(true);
    try {
      await estrategicoService.enviarDocumento(caso.id, f, { categoria, titulo: titulo || undefined, documentoOrigemId: versaoDe || undefined });
      toast.success("Documento anexado");
      setTitulo(""); setVersaoDe(""); if (arquivo.current) arquivo.current.value = "";
      carregar();
    } catch (e) { toast.error("Não foi possível anexar", mensagemErro(e, "")); }
    finally { setEnviando(false); }
  }
  async function excluir(d: Documento) {
    if (!confirm(`Excluir "${d.titulo}" (versão ${d.versao})?`)) return;
    try { await estrategicoService.excluirDocumento(d.id); carregar(); } catch (e) { toast.error("Não foi possível excluir", mensagemErro(e, "")); }
  }

  const grupos = new Map<string, Documento[]>();
  for (const d of docs ?? []) grupos.set(d.grupoId, [...(grupos.get(d.grupoId) ?? []), d].sort((a, b) => b.versao - a.versao));

  return (
    <Cartao titulo="Documentos e evidências">
      {podeEnviar && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end", marginBottom: 14 }}>
          <input ref={arquivo} type="file" className="input-o" style={{ maxWidth: 260 }} />
          <select className="select-field" value={categoria} onChange={e => setCategoria(e.target.value)}>
            {(filtros?.categoriasDocumento ?? []).map(c => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
          </select>
          <input className="input-o" style={{ maxWidth: 220 }} placeholder="Título (opcional)" value={titulo} onChange={e => setTitulo(e.target.value)} />
          {grupos.size > 0 && (
            <select className="select-field" value={versaoDe} onChange={e => setVersaoDe(e.target.value)}>
              <option value="">Documento novo</option>
              {[...grupos.values()].map(v => <option key={v[0].grupoId} value={v[0].grupoId}>Nova versão de: {v[0].titulo}</option>)}
            </select>
          )}
          <button type="button" className="btn btn-primary" onClick={enviar} disabled={enviando}><Upload size={13} /> {enviando ? "Enviando…" : "Anexar"}</button>
        </div>
      )}
      {docs == null ? <div className="skeleton" style={{ height: 60 }} /> : docs.length === 0 ? <Nota>Nenhum documento anexado. Contratos, ofícios, pareceres, estudos e petições ficam aqui — fora de qualquer pasta pública.</Nota> : (
        <TableCard>
          <thead><tr><th>Documento</th><th>Categoria</th><th>Versão</th><th>Enviado</th><th /></tr></thead>
          <tbody>
            {[...grupos.values()].map(versoes => versoes.map((d, i) => (
              <tr key={d.id} style={{ opacity: i === 0 ? 1 : 0.65 }}>
                <td style={{ fontSize: 12.5, paddingLeft: i ? 28 : undefined }}>{i === 0 ? <strong>{d.titulo}</strong> : d.titulo}<div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{d.nomeOriginal}</div></td>
                <td style={{ fontSize: 12 }}>{d.categoriaRotulo}</td>
                <td className="num">v{d.versao}{i === 0 && versoes.length > 1 ? " (atual)" : ""}</td>
                <td className="num" style={{ fontSize: 12 }}>{data(d.criadoEm)}{d.enviadoPor ? ` · ${d.enviadoPor}` : ""}</td>
                <td>
                  <RowActions>
                    <RowAction tone="view" title="Baixar" onClick={() => estrategicoService.baixarDocumento(d).catch(e => toast.error("Falha no download", mensagemErro(e, "")))}><Download size={13} /></RowAction>
                    {podeExcluir && <RowAction tone="danger" title="Excluir" onClick={() => excluir(d)}><Trash2 size={13} /></RowAction>}
                  </RowActions>
                </td>
              </tr>
            )))}
          </tbody>
        </TableCard>
      )}
    </Cartao>
  );
}

/* ── Riscos ─────────────────────────────────────────────────────────────── */

function AbaRiscos({ caso, filtros, podeEditar, onEditar }: { caso: CasoDetalhe; filtros: Filtros | null; podeEditar: boolean; onEditar: () => void }) {
  const celulas = caso.probabilidade && caso.impacto
    ? [{ probabilidade: caso.probabilidade, impacto: caso.impacto, quantidade: 1, casos: [{ id: caso.id, codigo: caso.codigo, titulo: caso.titulo }] }]
    : [];
  return (
    <Cartao titulo="Riscos" acoes={podeEditar ? <button type="button" className="btn btn-ghost" style={{ padding: "4px 10px" }} onClick={onEditar}><Pencil size={13} /> Avaliar</button> : undefined}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 12.5 }}>Classificação geral:</span> <SeloRisco nivel={caso.riscoNivel} />
            {caso.riscoScore != null && <span className="num" style={{ fontSize: 12, color: "var(--text-muted)" }}>score {caso.riscoScore}</span>}
          </div>
          <MatrizRisco celulas={celulas} destaque={{ probabilidade: caso.probabilidade, impacto: caso.impacto }} />
        </div>
        <div>
          {(filtros?.dimensoesRisco ?? []).map(d => {
            const v = (caso as any)[d.campo] as number | null;
            return (
              <div key={d.campo} style={{ display: "grid", gridTemplateColumns: "100px 1fr 24px", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12 }}>{d.rotulo}</span>
                <span style={{ height: 8, borderRadius: 4, background: "color-mix(in srgb, var(--text-muted) 14%, transparent)", overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${((v ?? 0) / 5) * 100}%`, background: (v ?? 0) >= 5 ? "var(--accent-red)" : (v ?? 0) >= 4 ? "var(--accent-amber)" : "var(--accent-cyan)" }} />
                </span>
                <span className="num" style={{ fontSize: 12 }}>{v ?? "—"}</span>
              </div>
            );
          })}
          <div style={{ marginTop: 12 }}>
            <div className="mono-cap" style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 4 }}>Plano de mitigação</div>
            <p style={{ fontSize: 12.5, whiteSpace: "pre-wrap", margin: 0 }}>{caso.planoMitigacao ?? "—"}</p>
          </div>
        </div>
      </div>
    </Cartao>
  );
}

/* ── Dependências ───────────────────────────────────────────────────────── */

function AbaDependencias({ caso, filtros, podeEditar, onMudou }: { caso: CasoDetalhe; filtros: Filtros | null; podeEditar: boolean; onMudou: () => void }) {
  const toast = useToastStore();
  const [lista, setLista] = useState<Dependencia[] | null>(null);
  const [modal, setModal] = useState<{ dep: Dependencia | null } | null>(null);
  const carregar = useCallback(() => { estrategicoService.dependencias(caso.id).then(setLista).catch(() => setLista([])); }, [caso.id]);
  useEffect(() => { carregar(); }, [carregar]);

  async function resolver(d: Dependencia, resolvida: boolean) {
    try { await estrategicoService.atualizarDependencia(d.id, { resolvida }); carregar(); onMudou(); } catch (e) { toast.error("Não foi possível atualizar", mensagemErro(e, "")); }
  }
  async function excluir(d: Dependencia) {
    if (!confirm("Excluir esta dependência? Use só para registro indevido — para encerrar, marque como resolvida.")) return;
    try { await estrategicoService.excluirDependencia(d.id); carregar(); onMudou(); } catch (e) { toast.error("Não foi possível excluir", mensagemErro(e, "")); }
  }

  return (
    <Cartao titulo="Dependências" acoes={podeEditar ? <button type="button" className="btn btn-primary" style={{ padding: "5px 12px" }} onClick={() => setModal({ dep: null })}><Plus size={13} /> Nova dependência</button> : undefined}>
      <TableCard>
        <thead><tr><th>Aguardando</th><th>Desde</th><th>Resposta esperada</th><th>Último follow-up</th><th>Situação</th><th /></tr></thead>
        <tbody>
          {lista == null ? <tr><td colSpan={6}><div className="skeleton" style={{ height: 40 }} /></td></tr> : lista.length === 0 ? (
            <EmptyState colSpan={6} title="Nenhuma dependência" hint="Registre de quem o assunto aguarda e desde quando." />
          ) : lista.map(d => (
            <tr key={d.id} style={{ opacity: d.resolvidaEm ? 0.6 : 1 }}>
              <td style={{ fontSize: 12.5 }}>
                <strong>{d.nome}</strong>{d.organizacao && d.catalogo ? ` · ${d.organizacao}` : ""}
                {d.catalogo?.natureza === "externa" && <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}> · externa</span>}
                {d.descricao && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.descricao}</div>}
              </td>
              <td className="num" style={{ fontSize: 12 }}>{d.desde ? <>{data(d.desde)}<div style={{ fontSize: 10.5, color: (d.dias ?? 0) > 30 ? "var(--accent-amber)" : "var(--text-muted)" }}>há {d.dias} dias</div></> : <span style={{ color: "var(--accent-amber)" }}>data desconhecida</span>}</td>
              <td className="num" style={{ fontSize: 12 }}>{data(d.respostaEsperadaEm)}</td>
              <td className="num" style={{ fontSize: 12 }}>{data(d.ultimoFollowUpEm)}</td>
              <td>{d.resolvidaEm ? <StatusBadge label={`Resolvida ${data(d.resolvidaEm)}`} tone="ok" /> : <StatusBadge label="Ativa" tone="atencao" />}</td>
              <td>
                {podeEditar && (
                  <RowActions>
                    <RowAction tone="view" title={d.resolvidaEm ? "Reabrir" : "Marcar como resolvida"} onClick={() => resolver(d, !d.resolvidaEm)}><CheckCircle2 size={13} /></RowAction>
                    <RowAction tone="edit" title="Editar" onClick={() => setModal({ dep: d })}><Pencil size={13} /></RowAction>
                    <RowAction tone="danger" title="Excluir" onClick={() => excluir(d)}><Trash2 size={13} /></RowAction>
                  </RowActions>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </TableCard>
      <Nota>Dependência externa aguardando além do ciclo configurado gera automaticamente uma tarefa de cobrança.</Nota>
      <DependenciaModal aberto={!!modal} casoId={caso.id} dependencia={modal?.dep} filtros={filtros} onFechar={() => setModal(null)} onSalvo={() => { setModal(null); carregar(); onMudou(); }} />
    </Cartao>
  );
}

/* ── Financeiro ─────────────────────────────────────────────────────────── */

function AbaFinanceiro({ caso, filtros, podeEditar, onEditar }: { caso: CasoDetalhe; filtros: Filtros | null; podeEditar: boolean; onEditar: () => void }) {
  const [historico, setHistorico] = useState<ValorHistorico[] | null>(null);
  useEffect(() => { estrategicoService.valores(caso.id).then(setHistorico).catch(() => setHistorico([])); }, [caso.id, caso.atualizadoEm]);
  const classificacao = filtros?.classificacoesFinanceiras.find(x => x.id === caso.classificacaoFinanceira)?.rotulo;
  return (
    <>
      <Cartao titulo="Valores" acoes={podeEditar ? <button type="button" className="btn btn-ghost" style={{ padding: "4px 10px" }} onClick={onEditar}><Pencil size={13} /> Editar valores</button> : undefined}>
        <p style={{ fontSize: 12, margin: "0 0 10px", color: "var(--text-secondary)" }}>
          Classificação: <strong>{classificacao ?? "—"}</strong> · Referência: {data(caso.valoresReferenciaEm)}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          {(filtros?.camposValor ?? []).map(v => (
            <div key={v.campo} title={dinheiro((caso as any)[v.campo])}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{v.rotulo}</div>
              <div className="metric" style={{ fontSize: 15 }}>{(caso as any)[v.campo] == null ? "—" : dinheiro((caso as any)[v.campo])}</div>
            </div>
          ))}
        </div>
      </Cartao>
      {(caso.importacao?.valoresCitados?.length ?? 0) > 0 && (
        <Cartao titulo="Valores citados nos andamentos (não consolidados)" dica="Lidos do texto da planilha. Confirme e informe no campo certo — o sistema não adivinha se é pretensão, alcançado ou em risco.">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.7 }}>
            {caso.importacao!.valoresCitados.map((v, i) => <li key={i}><strong className="metric">{dinheiro(v.valor)}</strong> — “{v.trecho}”</li>)}
          </ul>
        </Cartao>
      )}
      <Cartao titulo="Histórico financeiro" dica="Pretendido → Negociado → Reconhecido → Realizado">
        {historico == null ? <div className="skeleton" style={{ height: 40 }} /> : historico.length === 0 ? <Nota>Nenhuma alteração de valor registrada.</Nota> : (
          <TableCard>
            <thead><tr><th>Quando</th><th>Valor</th><th>De</th><th>Para</th><th>Motivo</th><th>Por</th></tr></thead>
            <tbody>
              {historico.map(h => (
                <tr key={h.id}>
                  <td className="num" style={{ fontSize: 12 }}>{data(h.referenciaEm ?? h.criadoEm)}</td>
                  <td style={{ fontSize: 12 }}>{h.rotulo}</td>
                  <td className="num" style={{ fontSize: 12 }}>{h.valorAnterior == null ? "—" : dinheiro(h.valorAnterior)}</td>
                  <td className="num" style={{ fontSize: 12, fontWeight: 600 }}>{h.valorNovo == null ? "—" : dinheiro(h.valorNovo)}</td>
                  <td style={{ fontSize: 12 }}>{h.observacao ?? "—"}</td>
                  <td style={{ fontSize: 12 }}>{h.usuario ?? (h.origem === "importacao" ? "importação" : "—")}</td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}
      </Cartao>
    </>
  );
}

/* ── Comentários ────────────────────────────────────────────────────────── */

function AbaComentarios({ caso, podeComentar, userId }: { caso: CasoDetalhe; podeComentar: boolean; userId?: string }) {
  const toast = useToastStore();
  const [lista, setLista] = useState<Comentario[] | null>(null);
  const [texto, setTexto] = useState("");
  const carregar = useCallback(() => { estrategicoService.comentarios(caso.id).then(setLista).catch(() => setLista([])); }, [caso.id]);
  useEffect(() => { carregar(); }, [carregar]);
  async function enviar() {
    if (!texto.trim()) return;
    try { await estrategicoService.comentar(caso.id, texto.trim()); setTexto(""); carregar(); } catch (e) { toast.error("Não foi possível comentar", mensagemErro(e, "")); }
  }
  return (
    <Cartao titulo="Comentários">
      {podeComentar && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <textarea className="input-o" rows={2} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escreva um comentário…" style={{ flex: 1 }} />
          <button type="button" className="btn btn-primary" onClick={enviar} disabled={!texto.trim()}>Comentar</button>
        </div>
      )}
      {lista == null ? <div className="skeleton" style={{ height: 40 }} /> : lista.length === 0 ? <Nota>Nenhum comentário.</Nota> : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {lista.map(cm => (
            <li key={cm.id} style={{ fontSize: 12.5 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <strong>{cm.user?.nome}</strong>
                <span className="num" style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(cm.criadoEm).toLocaleString("pt-BR")}</span>
                {cm.userId === userId && (
                  <button type="button" className="btn-icon" style={{ marginLeft: "auto" }} title="Excluir" onClick={async () => { await estrategicoService.excluirComentario(cm.id).catch(() => {}); carregar(); }}><Trash2 size={12} /></button>
                )}
              </div>
              <p style={{ margin: "2px 0 0", whiteSpace: "pre-wrap" }}>{cm.conteudo}</p>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}

/* ── Histórico (auditoria) ──────────────────────────────────────────────── */

function AbaHistorico({ caso }: { caso: CasoDetalhe }) {
  const [lista, setLista] = useState<ItemHistorico[] | null>(null);
  useEffect(() => { estrategicoService.historico(caso.id).then(setLista).catch(() => setLista([])); }, [caso.id, caso.atualizadoEm]);
  return (
    <Cartao titulo="Histórico de alterações" dica="Trilha campo a campo. Nunca é apagada — nem na exclusão lógica do assunto.">
      {lista == null ? <div className="skeleton" style={{ height: 60 }} /> : lista.length === 0 ? <Nota>Sem registros.</Nota> : (
        <TableCard>
          <thead><tr><th>Quando</th><th>Quem</th><th>O quê</th><th>De</th><th>Para</th></tr></thead>
          <tbody>
            {lista.map(h => (
              <tr key={h.id}>
                <td className="num" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>{new Date(h.criadoEm).toLocaleString("pt-BR")}</td>
                <td style={{ fontSize: 12 }}>{h.user?.nome ?? <span style={{ color: "var(--text-muted)" }}>{h.origem === "importacao" ? "importação" : "sistema"}</span>}</td>
                <td style={{ fontSize: 12, maxWidth: 360 }}><History size={11} style={{ verticalAlign: -1, marginRight: 4, color: "var(--text-muted)" }} />{h.descricao ?? h.acao}</td>
                <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{h.valorAnterior ?? ""}</td>
                <td style={{ fontSize: 12 }}>{h.valorNovo ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </Cartao>
  );
}

/* ── Dados originais da planilha ────────────────────────────────────────── */

function AbaOriginal({ caso }: { caso: CasoDetalhe }) {
  const imp = caso.importacao;
  return (
    <Cartao titulo="Dados originais da planilha" dica="Preservados exatamente como estavam — a conversão nunca apaga o texto de origem.">
      {imp && <Nota>Arquivo “{imp.arquivo}”, aba {imp.aba}, linha {imp.linha}{imp.grupo ? `, grupo “${imp.grupo}”` : ""} · importado em {new Date(imp.importadoEm).toLocaleString("pt-BR")}</Nota>}
      <div style={{ marginTop: 12 }}>
        <div className="mono-cap" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Status atual (original)</div>
        <p style={{ fontSize: 13, margin: "4px 0 14px" }}>{caso.statusOriginal ?? "—"}</p>
        <div className="mono-cap" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Principais andamentos (original)</div>
        <pre style={{ fontFamily: "inherit", fontSize: 12.5, whiteSpace: "pre-wrap", margin: "4px 0 14px", padding: 12, borderRadius: 10, background: "color-mix(in srgb, var(--text-muted) 8%, transparent)" }}>
          {caso.andamentosOriginais ?? "—"}
        </pre>
        {imp && imp.trechosSemData.length > 0 && (
          <>
            <div className="mono-cap" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Trechos sem data clara (não viraram andamento)</div>
            <ul style={{ fontSize: 12.5, margin: "4px 0 14px", paddingLeft: 18 }}>{imp.trechosSemData.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </>
        )}
        {imp && (
          <>
            <div className="mono-cap" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Células originais</div>
            <TableCard>
              <tbody>
                {Object.entries(imp.celulasOriginais).filter(([k]) => k !== "andamentos").map(([k, v]) => (
                  <tr key={k}><td style={{ fontSize: 12, color: "var(--text-muted)", width: 180 }}>{k}</td><td style={{ fontSize: 12 }}>{v == null ? "—" : String(v)}</td></tr>
                ))}
              </tbody>
            </TableCard>
          </>
        )}
      </div>
    </Cartao>
  );
}
