"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import { PageBody, BackLink, DetailHeader, ErrorState, PermissionDenied, StatusBadge } from "@/components/data-ui";
import { Play, RefreshCw, CheckCircle2, Download, XCircle, Gavel, ListTodo, Presentation, Trash2 } from "lucide-react";
import { estrategicoService } from "@/lib/estrategico/estrategico.service";
import type { Reuniao, Filtros } from "@/lib/estrategico/types";
import { BASE, pode, data, FarolPonto, Nota, mensagemErro, prazoEmPalavras, useEstreito } from "../../_components/comuns";
import { Cartao } from "../../_components/graficos";
import { DecisaoModal, TarefaModal } from "../../_components/AtividadeModais";

/**
 * Modo "Reunião Estratégica" (seção 25 do plano).
 *
 * Esquerda: a pauta, na ordem que o plano define, com o estado ATUAL de cada
 * assunto ao lado do motivo que o trouxe à pauta. Direita: o que a reunião
 * produziu — decisões e ações. Encerrar gera a ata e distribui as ações.
 */
export default function ReuniaoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const toast = useToastStore();
  const estreito = useEstreito(1024);
  const [r, setR] = useState<Reuniao | null>(null);
  const [filtros, setFiltros] = useState<Filtros | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [decisaoPara, setDecisaoPara] = useState<string | null | undefined>(undefined);
  const [tarefaPara, setTarefaPara] = useState<string | null | undefined>(undefined);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState(false);

  const conduz = pode(user, "estrategico.reuniao:conduzir");
  const aberta = r && (r.status === "planejada" || r.status === "em_andamento");

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const dados = await estrategicoService.reuniao(id);
      setR(dados);
      setNotas(Object.fromEntries(Object.entries(dados.anotacoes ?? {}).map(([k, v]) => [k, v.nota ?? ""])));
    } catch (e: any) {
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(mensagemErro(e, "Falha ao carregar a reunião."));
    }
  }, [id]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { estrategicoService.filtros().then(setFiltros).catch(() => {}); }, []);

  const casosDaPauta = useMemo(() => {
    const vistos = new Map<string, { id: string; codigo: string; titulo: string }>();
    for (const s of r?.pauta ?? []) for (const i of s.itens) if (!vistos.has(i.casoId)) vistos.set(i.casoId, { id: i.casoId, codigo: i.codigo, titulo: i.titulo });
    return [...vistos.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [r]);

  async function status(novo: "em_andamento" | "encerrada" | "cancelada") {
    if (novo === "encerrada" && !confirm("Encerrar a reunião? A pauta e a ata ficam congeladas e cada responsável recebe as ações.")) return;
    if (novo === "cancelada" && !confirm("Cancelar a reunião?")) return;
    setOcupado(true);
    try { setR(await estrategicoService.statusReuniao(id, novo)); toast.success(novo === "encerrada" ? "Reunião encerrada — ata gerada" : "Status atualizado"); }
    catch (e) { toast.error("Não foi possível atualizar", mensagemErro(e, "")); }
    finally { setOcupado(false); }
  }
  async function excluir() {
    if (!r) return;
    const mantidos = [
      r.decisoes.length ? `${r.decisoes.length} decisão(ões)` : null,
      r.tarefas.length ? `${r.tarefas.length} tarefa(s)` : null,
    ].filter(Boolean).join(" e ");
    const aviso = [
      `Excluir a reunião "${r.titulo}"?`,
      mantidos ? `${mantidos} já registrada(s) continuam nos assuntos.` : null,
      r.status === "encerrada"
        ? "A ata deixa de aparecer na lista; o painel passa a comparar com a reunião encerrada anterior."
        : "Os compromissos futuros desta reunião saem da agenda dos participantes.",
    ].filter(Boolean).join("\n\n");
    if (!confirm(aviso)) return;
    setOcupado(true);
    try {
      const res = await estrategicoService.excluirReuniao(id);
      toast.success("Reunião excluída", res.compromissosMantidos
        ? `${res.compromissosMantidos} compromisso(s) sincronizado(s) com calendário externo foram mantidos — remova pela agenda.`
        : res.compromissosRemovidos ? `${res.compromissosRemovidos} compromisso(s) removido(s) da agenda.` : undefined);
      router.push(`${BASE}/reunioes`);
    } catch (e) {
      toast.error("Não foi possível excluir", mensagemErro(e, ""));
      setOcupado(false);
    }
  }

  async function regerar() {
    setOcupado(true);
    try { setR(await estrategicoService.regerarPauta(id)); toast.success("Pauta atualizada com os dados de agora"); }
    catch (e) { toast.error("Não foi possível regerar", mensagemErro(e, "")); }
    finally { setOcupado(false); }
  }
  async function anotar(casoId: string, dados: { discutido?: boolean; nota?: string }) {
    if (!r || !aberta || !conduz) return;
    try {
      const salvo = await estrategicoService.anotar(id, casoId, dados);
      setR({ ...r, anotacoes: { ...r.anotacoes, [casoId]: salvo } });
    } catch (e) { toast.error("Anotação não salva", mensagemErro(e, "")); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href={`${BASE}/reunioes`} label="Reuniões" />
          {semPermissao ? <PermissionDenied /> : erro ? <ErrorState detail={erro} onRetry={carregar} /> : !r ? <div className="skeleton" style={{ height: 260, borderRadius: 14 }} /> : (
            <>
              <DetailHeader
                avatar={<Presentation size={18} />}
                titulo={r.titulo}
                selo={<StatusBadge label={{ planejada: "Planejada", em_andamento: "Em andamento", encerrada: "Encerrada", cancelada: "Cancelada" }[r.status]} tone={r.status === "encerrada" ? "ok" : r.status === "em_andamento" ? "atencao" : "info"} />}
                subtitulo={`${new Date(r.dataReuniao).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" })}${r.local ? ` · ${r.local}` : ""}`}
                meta={<span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Participantes: {r.participantes.map(p => p.nome).join(", ") || "—"} · Referência: alterações desde {data(r.referenciaDesde)}</span>}
                actions={conduz ? (
                  <>
                    {r.status === "planejada" && <button type="button" className="btn btn-primary" onClick={() => status("em_andamento")} disabled={ocupado}><Play size={14} /> Iniciar</button>}
                    {aberta && <button type="button" className="btn btn-ghost" onClick={regerar} disabled={ocupado} title="Recalcula a pauta com os dados de agora"><RefreshCw size={14} /> Regerar pauta</button>}
                    {aberta && <button type="button" className="btn btn-primary" onClick={() => status("encerrada")} disabled={ocupado}><CheckCircle2 size={14} /> Encerrar e gerar ata</button>}
                    {r.status === "encerrada" && <button type="button" className="btn btn-ghost" onClick={() => estrategicoService.baixarAta(id).catch(e => toast.error("Falha no download", mensagemErro(e, "")))}><Download size={14} /> Ata em PDF</button>}
                    {aberta && <button type="button" className="btn btn-ghost" onClick={() => status("cancelada")} disabled={ocupado} title="Cancelar reunião"><XCircle size={14} /></button>}
                    <button type="button" className="btn btn-ghost" onClick={excluir} disabled={ocupado} title="Excluir reunião" aria-label="Excluir reunião"><Trash2 size={14} /></button>
                  </>
                ) : r.status === "encerrada" ? <button type="button" className="btn btn-ghost" onClick={() => estrategicoService.baixarAta(id)}><Download size={14} /> Ata em PDF</button> : undefined}
              />

              <div style={{ display: "grid", gridTemplateColumns: estreito ? "1fr" : "minmax(0, 2fr) minmax(300px, 1fr)", gap: 16, alignItems: "start" }}>
                <div>
                  {r.pauta.map((s, idx) => (
                    <Cartao key={s.id} titulo={`${idx + 1}. ${s.titulo} (${s.itens.length})`}>
                      {s.itens.length === 0 ? <Nota>Nada neste tópico.</Nota> : (
                        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                          {s.itens.map(i => {
                            const atual = r.situacaoAtual[i.casoId];
                            const anot = r.anotacoes?.[i.casoId];
                            return (
                              <li key={`${s.id}-${i.casoId}-${i.tarefaId ?? ""}`} style={{ paddingBottom: 12, borderBottom: "1px solid var(--border-subtle)" }}>
                                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                                  <span style={{ paddingTop: 4 }}><FarolPonto farol={(atual?.farol ?? i.farol ?? "cinza") as any} /></span>
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <Link href={`${BASE}/assuntos/${i.casoId}`} target="_blank" style={{ color: "inherit", fontWeight: 600, fontSize: 13 }}>
                                      <span className="num" style={{ color: "var(--text-muted)", fontWeight: 400 }}>{i.codigo}</span> {i.titulo}
                                    </Link>
                                    <div style={{ fontSize: 12, color: "var(--accent-amber)", marginTop: 2 }}>{i.motivo}</div>
                                    {atual && (
                                      <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>
                                        Agora: {atual.statusTexto}
                                        {atual.proximaAcao ? ` · Próxima ação: ${atual.proximaAcao}${atual.proximaAcaoResponsavel ? ` (${atual.proximaAcaoResponsavel})` : ""}${atual.proximaAcaoPrazo ? ` até ${data(atual.proximaAcaoPrazo)}` : ""}` : " · sem próxima ação"}
                                      </div>
                                    )}
                                    {conduz && aberta ? (
                                      <>
                                        <textarea
                                          className="input-o" rows={1} placeholder="Anotação da reunião…" style={{ marginTop: 6, fontSize: 12 }}
                                          value={notas[i.casoId] ?? ""}
                                          onChange={e => setNotas(n => ({ ...n, [i.casoId]: e.target.value }))}
                                          onBlur={() => { if ((notas[i.casoId] ?? "") !== (anot?.nota ?? "")) anotar(i.casoId, { nota: notas[i.casoId] ?? "" }); }}
                                        />
                                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
                                          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
                                            <input type="checkbox" checked={!!anot?.discutido} onChange={e => anotar(i.casoId, { discutido: e.target.checked })} /> Discutido
                                          </label>
                                          <button type="button" className="btn btn-ghost" style={{ padding: "3px 10px", fontSize: 11.5 }} onClick={() => setDecisaoPara(i.casoId)}><Gavel size={12} /> Decisão</button>
                                          <button type="button" className="btn btn-ghost" style={{ padding: "3px 10px", fontSize: 11.5 }} onClick={() => setTarefaPara(i.casoId)}><ListTodo size={12} /> Tarefa</button>
                                        </div>
                                      </>
                                    ) : anot?.nota ? <div style={{ fontSize: 12, marginTop: 4 }}><strong>Nota:</strong> {anot.nota}{anot.discutido ? " ✓" : ""}</div> : null}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </Cartao>
                  ))}
                </div>

                <div style={{ position: estreito ? "static" : "sticky", top: 12 }}>
                  <Cartao titulo={`Decisões (${r.decisoes.length})`} acoes={conduz && aberta ? <button type="button" className="btn btn-ghost" style={{ padding: "3px 10px", fontSize: 11.5 }} onClick={() => setDecisaoPara(null)}><Gavel size={12} /> Registrar</button> : undefined}>
                    {r.decisoes.length === 0 ? <Nota>Nenhuma decisão registrada.</Nota> : (
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, lineHeight: 1.55 }}>
                        {r.decisoes.map(d => <li key={d.id} style={{ marginBottom: 6 }}>{d.caso && <strong>{d.caso.codigo}: </strong>}{d.descricao}</li>)}
                      </ul>
                    )}
                  </Cartao>
                  <Cartao titulo={`Ações definidas (${r.tarefas.length})`} acoes={conduz && aberta && casosDaPauta.length ? <button type="button" className="btn btn-ghost" style={{ padding: "3px 10px", fontSize: 11.5 }} onClick={() => setTarefaPara(null)}><ListTodo size={12} /> Nova</button> : undefined}>
                    {r.tarefas.length === 0 ? <Nota>Nenhuma ação registrada.</Nota> : (
                      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                        {r.tarefas.map(t => (
                          <li key={t.id} style={{ fontSize: 12.5 }}>
                            <strong>{t.titulo}</strong>
                            <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
                              {t.caso?.codigo} · {t.responsavel?.nome ?? "sem responsável"} · {t.prazo ? `${data(t.prazo)} (${prazoEmPalavras(t.diasPrazo)})` : "sem prazo"}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Cartao>
                  {r.status === "encerrada" && r.ata && (
                    <Cartao titulo="Ata">
                      <pre style={{ fontFamily: "inherit", fontSize: 12, whiteSpace: "pre-wrap", margin: 0, maxHeight: 520, overflowY: "auto" }}>{r.ata}</pre>
                    </Cartao>
                  )}
                </div>
              </div>

              <DecisaoModal
                aberto={decisaoPara !== undefined}
                casos={casosDaPauta}
                casoIdInicial={decisaoPara ?? undefined}
                onFechar={() => setDecisaoPara(undefined)}
                onSalvar={async dados => { await estrategicoService.decidir(id, dados); await carregar(); }}
              />
              <TarefaModal
                aberto={tarefaPara !== undefined}
                casoId={tarefaPara ?? undefined}
                casos={casosDaPauta}
                filtros={filtros}
                onFechar={() => setTarefaPara(undefined)}
                onSalvo={() => { setTarefaPara(undefined); carregar(); }}
                salvarNova={dados => estrategicoService.tarefaReuniao(id, dados)}
              />
            </>
          )}
        </PageBody>
      </div>
    </div>
  );
}
