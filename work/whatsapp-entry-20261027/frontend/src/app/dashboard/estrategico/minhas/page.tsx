"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { useToastStore } from "@/lib/toast";
import { PageBody, BackLink, PageHeader, ErrorState, PermissionDenied } from "@/components/data-ui";
import { UserCheck, CheckCircle2 } from "lucide-react";
import { estrategicoService } from "@/lib/estrategico/estrategico.service";
import type { MinhasAcoes } from "@/lib/estrategico/types";
import { BASE, data, FarolPonto, prazoEmPalavras, Nota, mensagemErro, ProximaAcaoCelula, LINK_DISCRETO } from "../_components/comuns";
import { Cartao } from "../_components/graficos";

/**
 * Minhas ações — a tela de execução.
 *
 * Pensada para o celular (plano, princípio 10): o responsável abre, vê o que
 * vence primeiro e conclui a tarefa ali mesmo, sem passar pelo painel.
 */
export default function MinhasAcoesPage() {
  const toast = useToastStore();
  const [dados, setDados] = useState<MinhasAcoes | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try { setDados(await estrategicoService.minhas()); }
    catch (e: any) {
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(mensagemErro(e, "Falha ao carregar suas ações."));
    }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function concluir(id: string) {
    try { await estrategicoService.atualizarTarefa(id, { status: "concluida" }); toast.success("Tarefa concluída"); carregar(); }
    catch (e) { toast.error("Não foi possível concluir", mensagemErro(e, "")); }
  }

  const pendentes = (dados?.acoes.length ?? 0) + (dados?.tarefas.length ?? 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href={BASE} label="Painel estratégico" />
          <PageHeader icon={<UserCheck size={19} />} title="Minhas ações" subtitle={dados ? `${pendentes} pendência(s) sob sua responsabilidade` : "O que depende de você nos assuntos estratégicos"} />
          {semPermissao ? <PermissionDenied /> : erro ? <ErrorState detail={erro} onRetry={carregar} /> : !dados ? (
            <div className="skeleton" style={{ height: 200, borderRadius: 14 }} />
          ) : (
            <>
              <Cartao titulo={`Próximas ações (${dados.acoes.length})`} dica="Assuntos em que você é o responsável pela próxima ação.">
                {dados.acoes.length === 0 ? <Nota>Nenhuma próxima ação atribuída a você.</Nota> : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                    {dados.acoes.map(c => (
                      <li key={c.id} className="panel" style={{ padding: 12, borderLeft: `3px solid ${c.acaoVencida ? "var(--accent-red)" : "var(--border-subtle)"}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <FarolPonto farol={c.farol} />
                          <Link href={`${BASE}/assuntos/${c.id}`} style={{ ...LINK_DISCRETO, fontWeight: 600, fontSize: 13 }}>
                            <span className="num" style={{ color: "var(--text-muted)", fontWeight: 400 }}>{c.codigo}</span> {c.titulo}
                          </Link>
                        </div>
                        <ProximaAcaoCelula c={c} />
                      </li>
                    ))}
                  </ul>
                )}
              </Cartao>

              <Cartao titulo={`Tarefas (${dados.tarefas.length})`}>
                {dados.tarefas.length === 0 ? <Nota>Nenhuma tarefa aberta para você.</Nota> : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                    {dados.tarefas.map(t => (
                      <li key={t.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                        <button type="button" className="btn-icon" title="Concluir" aria-label={`Concluir ${t.titulo}`} onClick={() => concluir(t.id)} style={{ minWidth: 34, minHeight: 34 }}>
                          <CheckCircle2 size={16} />
                        </button>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{t.titulo}</div>
                          <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
                            {t.caso && <Link href={`${BASE}/assuntos/${t.caso.id}`} style={{ color: "inherit" }}>{t.caso.codigo} · {t.caso.titulo}</Link>}
                          </div>
                          <div className="num" style={{ fontSize: 11.5, color: t.vencida ? "var(--accent-red)" : "var(--text-muted)", fontWeight: t.vencida ? 700 : 400 }}>
                            {t.prazo ? `${data(t.prazo)} · ${prazoEmPalavras(t.diasPrazo)}` : "sem prazo"}{t.origem === "automacao" ? " · cobrança automática" : ""}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Cartao>

              <Cartao titulo={`Assuntos que você responde (${dados.responsavelDe.length})`} dica="Você é responsável executivo ou operacional.">
                {dados.responsavelDe.length === 0 ? <Nota>Nenhum.</Nota> : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                    {dados.responsavelDe.map(c => (
                      <li key={c.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span style={{ paddingTop: 4 }}><FarolPonto farol={c.farol} tamanho={9} /></span>
                        <div style={{ minWidth: 0 }}>
                          <Link href={`${BASE}/assuntos/${c.id}`} style={{ ...LINK_DISCRETO, fontSize: 12.5, fontWeight: 600 }}>{c.codigo} · {c.titulo}</Link>
                          <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{c.statusTexto}{c.farolMotivos[0] ? ` · ${c.farolMotivos[0].texto}` : ""}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Cartao>
            </>
          )}
        </PageBody>
      </div>
    </div>
  );
}
