"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import {
  PageBody, PageHeader, TableCard, ErrorState, PermissionDenied, KpiCard, SelectFilter, useCountUp,
} from "@/components/data-ui";
import {
  Target, ClipboardList, Presentation, BarChart2, Plus, ArrowRight, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { estrategicoService } from "@/lib/estrategico/estrategico.service";
import type { Painel, Filtros, CasoDetalhe } from "@/lib/estrategico/types";
import { COR_FAROL } from "@/lib/estrategico/types";
import {
  BASE, pode, data, dinheiro, dinheiroCurto, FarolPonto, SemAcao, prazoEmPalavras, Aviso, Nota, LINK_DISCRETO,
} from "./_components/comuns";
import {
  Cartao, MatrizRisco, FunilValores, ColunasMensais, PipelineResumo, AgingResumo, FarolResumo, DistribuicaoLider,
} from "./_components/graficos";
import CasoForm from "./_components/CasoForm";

/**
 * Painel executivo do Strategy.
 *
 * A ordem responde às perguntas da seção 24 do plano, na sequência em que a
 * Diretoria as faz: o que temos, o que importa, o que está parado, quem
 * precisa agir, quanto dinheiro está envolvido, o que pode virar dinheiro, o
 * que pode virar problema e o que mudou. Toda métrica é clicável e leva à
 * lista já filtrada — número que não abre a lista é número que ninguém confere.
 */

type Recorte = { id: string; rotulo: string; valor: number; cor: string; href: string; dica: string; urgente?: boolean };

function CartaoRecorte({ r, index }: { r: Recorte; index: number }) {
  const valor = useCountUp(r.valor);
  return (
    <Link
      href={r.href}
      className="stat-card"
      data-critical={r.urgente && r.valor > 0 ? "true" : "false"}
      title={r.dica}
      style={{ ["--sc" as any]: r.cor, animationDelay: `${index * 35}ms`, textDecoration: "none", color: "inherit" }}
    >
      <span className="stat-card__head"><span className="stat-card__dot" /><span className="mono-cap">{r.rotulo}</span></span>
      <span className="metric stat-card__value">{valor.toLocaleString("pt-BR")}</span>
      <span className="stat-card__foot"><span style={{ flex: 1 }} /><span className="stat-card__hint">ver lista</span></span>
    </Link>
  );
}

export default function EstrategicoPainelPage() {
  const user = useAuthStore(s => s.user);
  const [painel, setPainel] = useState<Painel | null>(null);
  const [filtros, setFiltros] = useState<Filtros | null>(null);
  const [recorte, setRecorte] = useState({ grupoId: "", objetivoId: "", esferaId: "", areaId: "" });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setPainel(await estrategicoService.painel(recorte));
    } catch (e: any) {
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message ?? "Falha ao carregar o painel.");
    } finally { setCarregando(false); }
  }, [recorte]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { estrategicoService.filtros().then(setFiltros).catch(() => {}); }, []);

  const k = painel?.kpis;
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...Object.fromEntries(Object.entries(recorte).filter(([, v]) => v)), ...extra });
    return `${BASE}/assuntos?${p.toString()}`;
  };

  const recortes: Recorte[] = useMemo(() => !k ? [] : [
    { id: "total", rotulo: "Assuntos", valor: k.total, cor: "var(--accent-violet)", href: qs({}), dica: "Toda a carteira, inclusive suspensos e encerrados." },
    { id: "andamento", rotulo: "Em andamento", valor: k.emAndamento, cor: "var(--accent-cyan)", href: qs({ recorte: "ativos" }), dica: "Nem suspensos, nem encerrados." },
    { id: "criticos", rotulo: "Críticos", valor: k.criticos, cor: COR_FAROL.vermelho, href: qs({ farol: "vermelho" }), dica: "Farol vermelho.", urgente: true },
    { id: "atencao", rotulo: "Em atenção", valor: k.emAtencao, cor: COR_FAROL.amarelo, href: qs({ farol: "amarelo" }), dica: "Farol amarelo." },
    { id: "sem_acao", rotulo: "Sem próxima ação", valor: k.semProximaAcao, cor: "var(--accent-amber)", href: qs({ recorte: "sem_acao" }), dica: "Assunto ativo sem ação, responsável e prazo definidos.", urgente: true },
    { id: "vencidos", rotulo: "Vencidos", valor: k.vencidos, cor: "var(--accent-red)", href: qs({ recorte: "vencidos" }), dica: "Próxima ação ou prazo final vencidos.", urgente: true },
    { id: "p30", rotulo: "Parados > 30 dias", valor: k.parados30, cor: "var(--accent-amber)", href: qs({ paradoDias: "31" }), dica: "Último andamento há mais de 30 dias." },
    { id: "p60", rotulo: "Parados > 60 dias", valor: k.parados60, cor: "var(--accent-amber)", href: qs({ paradoDias: "61" }), dica: "Último andamento há mais de 60 dias." },
    { id: "p90", rotulo: "Parados > 90 dias", valor: k.parados90, cor: "var(--accent-red)", href: qs({ paradoDias: "91" }), dica: "Último andamento há mais de 90 dias.", urgente: true },
    { id: "suspensos", rotulo: "Suspensos", valor: k.suspensos, cor: COR_FAROL.cinza, href: qs({ recorte: "suspensos" }), dica: "Etapa Suspenso." },
    { id: "oportunidades", rotulo: "Oportunidades", valor: k.oportunidades, cor: COR_FAROL.azul, href: `${BASE}/oportunidades`, dica: "Oportunidades ativas no pipeline." },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [k, recorte]);

  // "Sem objetivo/área/..." não tem filtro na lista — fica sem link.
  const fatias = (lista: { id: string; rotulo: string; valor: number }[], param: string) =>
    lista.map(b => ({ id: b.id, rotulo: b.rotulo, valor: b.valor, href: b.id !== "sem" ? qs({ [param]: b.id }) : undefined }));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <PageHeader
            icon={<Target size={19} />}
            title="Gestão Estratégica"
            subtitle="O que está acontecendo, o que está em risco, quanto vale, quem precisa agir e qual é o próximo passo"
            actions={
              <>
                <Link href={`${BASE}/assuntos`} className="btn btn-ghost"><ClipboardList size={14} /> Assuntos</Link>
                {pode(user, "estrategico.reuniao:ver") && <Link href={`${BASE}/reunioes`} className="btn btn-ghost"><Presentation size={14} /> Reuniões</Link>}
                <Link href={`${BASE}/relatorios`} className="btn btn-ghost"><BarChart2 size={14} /> Relatórios</Link>
                {pode(user, "estrategico.caso:criar") && (
                  <button type="button" className="btn btn-primary" onClick={() => setCriando(true)}><Plus size={14} /> Novo assunto</button>
                )}
              </>
            }
          />

          {filtros && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              <SelectFilter placeholder="Todos os grupos" value={recorte.grupoId} onChange={v => setRecorte(r => ({ ...r, grupoId: v }))} options={filtros.grupos.map(g => ({ value: g.id, label: g.nome }))} />
              <SelectFilter placeholder="Todos os objetivos" value={recorte.objetivoId} onChange={v => setRecorte(r => ({ ...r, objetivoId: v }))} options={filtros.objetivos.map(g => ({ value: g.id, label: g.nome }))} />
              <SelectFilter placeholder="Todas as esferas" value={recorte.esferaId} onChange={v => setRecorte(r => ({ ...r, esferaId: v }))} options={filtros.esferas.map(g => ({ value: g.id, label: g.nome }))} />
              <SelectFilter placeholder="Todas as áreas" value={recorte.areaId} onChange={v => setRecorte(r => ({ ...r, areaId: v }))} options={filtros.areas.map(g => ({ value: g.id, label: g.nome }))} />
            </div>
          )}

          {semPermissao ? (
            <PermissionDenied hint="O painel estratégico exige a permissão estrategico.relatorio:ver." />
          ) : erro ? (
            <ErrorState detail={erro} onRetry={carregar} />
          ) : carregando && !painel ? (
            <>
              <div className="skeleton" style={{ height: 64, borderRadius: 14, marginBottom: 16 }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 96, borderRadius: 14 }} />)}
              </div>
              <div className="skeleton" style={{ height: 300, borderRadius: 14 }} />
            </>
          ) : !painel ? null : painel.kpis.total === 0 ? (
            <Cartao titulo="Nenhum assunto ainda">
              <p style={{ fontSize: 13, margin: "0 0 12px" }}>
                A carteira está vazia. Comece importando a planilha de acompanhamento estratégico ou cadastrando o primeiro assunto.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {pode(user, "estrategico.admin:gerenciar") && <Link href={`${BASE}/configuracoes?aba=importacao`} className="btn btn-primary">Importar planilha</Link>}
                {pode(user, "estrategico.caso:criar") && <button type="button" className="btn btn-ghost" onClick={() => setCriando(true)}>Cadastrar assunto</button>}
              </div>
            </Cartao>
          ) : (
            <>
              <Veredito painel={painel} />

              {painel.kpis.revisar > 0 && (
                <Aviso tom="info">
                  <strong>{painel.kpis.revisar} {painel.kpis.revisar === 1 ? "assunto importado aguarda" : "assuntos importados aguardam"} validação.</strong>{" "}
                  A conversão da planilha preserva o texto original e marca o que não pôde ser lido com segurança.{" "}
                  <Link href={qs({ recorte: "revisar" })} style={{ color: "inherit", fontWeight: 600 }}>Revisar agora →</Link>
                </Aviso>
              )}

              <div className="stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
                {recortes.map((r, i) => <CartaoRecorte key={r.id} r={r} index={i} />)}
              </div>

              {/* Quanto dinheiro está envolvido? */}
              {painel.financeiroVisivel && painel.valores ? (
                <Cartao titulo="Quanto está envolvido" dica="Soma dos valores informados nos assuntos (cancelados fora).">
                  {painel.valores.casosComValor === 0 ? (
                    <Aviso>
                      <strong>Nenhum valor financeiro consolidado.</strong> As colunas de valor da planilha estavam vazias; os montantes citados
                      nos andamentos aparecem como sugestão na aba Financeiro de cada assunto, para confirmação.
                    </Aviso>
                  ) : (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
                        {[
                          ["valorPretendido", "Pretendido", "var(--accent-violet)"], ["valorReconhecido", "Reconhecido", "var(--accent-cyan)"],
                          ["valorAlcancado", "Alcançado", "var(--accent-green)"], ["valorRecebido", "Recebido", "var(--accent-green)"],
                          ["valorReequilibrio", "Reequilíbrio", "var(--accent-violet)"], ["valorEmRisco", "Em risco", "var(--accent-red)"],
                          ["valorPotencial", "Potencial", "var(--accent-cyan)"],
                        ].map(([campo, rotulo, cor], i) => (
                          <div key={campo} title={dinheiro(painel.valores![campo])}>
                            <KpiCard label={rotulo} valor={dinheiroCurto(painel.valores![campo])} color={cor} index={i} />
                          </div>
                        ))}
                      </div>
                      <FunilValores valores={painel.valores} campos={filtros?.camposValor ?? []} />
                      {painel.valores.casosSemValor > 0 && <Nota>{painel.valores.casosSemValor} assunto(s) ainda sem nenhum valor informado.</Nota>}
                    </>
                  )}
                </Cartao>
              ) : (
                <Nota>Valores financeiros restritos ao seu perfil.</Nota>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16 }}>
                {/* Quem precisa agir? */}
                <Cartao titulo="Quem precisa agir" dica="Agrupado pelo responsável da próxima ação; sem pessoa, pela área operacional.">
                  <TableCard>
                    <thead><tr><th>Responsável</th><th className="num">Assuntos</th><th className="num">Ações vencidas</th><th className="num">Sem ação</th><th className="num">Tarefas vencidas</th></tr></thead>
                    <tbody>
                      {painel.quemPrecisaAgir.slice(0, 12).map(l => (
                        <tr key={l.chave}>
                          <td style={{ fontSize: 12.5 }}>
                            {l.nome}
                            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{l.tipo === "area" ? " · área" : l.tipo === "externo" ? " · externo" : ""}</span>
                          </td>
                          <td className="num">{l.assuntos}</td>
                          <td className="num" style={{ color: l.acoesVencidas ? "var(--accent-red)" : undefined, fontWeight: l.acoesVencidas ? 700 : 400 }}>{l.acoesVencidas}</td>
                          <td className="num" style={{ color: l.semAcao ? "var(--accent-amber)" : undefined }}>{l.semAcao}</td>
                          <td className="num" style={{ color: l.tarefasVencidas ? "var(--accent-red)" : undefined }}>{l.tarefasVencidas}</td>
                        </tr>
                      ))}
                    </tbody>
                  </TableCard>
                  {painel.kpis.semResponsavel > 0 && <Nota>{painel.kpis.semResponsavel} assunto(s) ativo(s) sem nenhum responsável nomeado (só área).</Nota>}
                </Cartao>

                {/* O que importa? */}
                <Cartao titulo="O que importa" dica="Farol, depois risco, depois valor.">
                  <ListaResumo itens={painel.oQueImporta} mostrar="acao" />
                </Cartao>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16 }}>
                {/* O que está parado? */}
                <Cartao
                  titulo="O que está parado"
                  dica="Dias desde o último andamento datado."
                  acoes={<Link href={`${BASE}/relatorios?tipo=aging`} className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 11.5 }}>Aging <ArrowRight size={12} /></Link>}
                >
                  <AgingResumo faixas={painel.graficos.aging} />
                  <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
                    <ListaResumo itens={painel.oQueEstaParado.slice(0, 6)} mostrar="parado" />
                  </div>
                  {painel.semMovimentacao.length > 0 && <Nota>{painel.semMovimentacao.length} assunto(s) sem nenhum andamento datado — o aging não pode ser medido.</Nota>}
                </Cartao>

                {/* Status */}
                <Cartao titulo="Saúde da carteira" dica="Farol calculado (ou manual, quando justificado).">
                  <FarolResumo fatias={painel.graficos.porFarol.map(f => ({ ...f, href: qs({ farol: f.id }) }))} />
                  <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
                    <div className="mono-cap" style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 10 }}>Por etapa</div>
                    <DistribuicaoLider compacto itens={painel.graficos.porEtapa.map(e => ({ ...e, href: qs({ etapa: e.id }) }))} />
                  </div>
                </Cartao>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
                <Cartao titulo="Por objetivo"><DistribuicaoLider itens={fatias(painel.graficos.porObjetivo, "objetivoId")} /></Cartao>
                <Cartao titulo="Por esfera"><DistribuicaoLider itens={fatias(painel.graficos.porEsfera, "esferaId")} /></Cartao>
                <Cartao titulo="Por área operacional"><DistribuicaoLider itens={fatias(painel.graficos.porArea, "areaId")} /></Cartao>
                <Cartao titulo="Por dependência" dica="Assuntos ativos aguardando cada parte.">
                  <DistribuicaoLider itens={fatias(painel.graficos.porDependencia, "dependenciaId")} unidade="dependências ativas" textoVazio="Nenhuma dependência ativa." />
                </Cartao>
                <Cartao titulo="Por responsável"><DistribuicaoLider itens={fatias(painel.graficos.porResponsavel, "responsavelId")} unidade="assuntos ativos" /></Cartao>
                <Cartao titulo="Por grupo"><DistribuicaoLider itens={fatias(painel.graficos.porGrupo, "grupoId")} /></Cartao>
              </div>

              {painel.financeiroVisivel && (painel.graficos.valorPorAssunto?.length ?? 0) > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16 }}>
                  <Cartao titulo="Maiores valores por assunto">
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                      {painel.graficos.valorPorAssunto!.map(v => (
                        <li key={v.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5 }} title={dinheiro(v.valor)}>
                          <Link href={`${BASE}/assuntos/${v.id}`} style={LINK_DISCRETO}>{v.rotulo}</Link>
                          <span className="metric">{dinheiroCurto(v.valor)}</span>
                        </li>
                      ))}
                    </ul>
                  </Cartao>
                  <Cartao titulo="Valor por objetivo">
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                      {(painel.graficos.valorPorObjetivo ?? []).map(v => (
                        <li key={v.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }} title={dinheiro(v.valor)}>
                          <span>{v.rotulo}</span><span className="metric">{dinheiroCurto(v.valor)}</span>
                        </li>
                      ))}
                    </ul>
                  </Cartao>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16 }}>
                {/* O que pode virar dinheiro? */}
                <Cartao titulo="O que pode virar dinheiro" dica="Pipeline de oportunidades."
                  acoes={<Link href={`${BASE}/oportunidades`} className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 11.5 }}>Pipeline <ArrowRight size={12} /></Link>}>
                  <PipelineResumo etapas={painel.pipeline} mostrarValor={painel.financeiroVisivel} />
                </Cartao>
                {/* O que pode virar problema? */}
                <Cartao titulo="O que pode virar problema" dica="Assuntos ativos por probabilidade × impacto. Clique numa célula para ver quais.">
                  <MatrizRisco celulas={painel.matrizRisco} />
                  {painel.kpis.semAvaliacaoRisco > 0 && <Nota>{painel.kpis.semAvaliacaoRisco} assunto(s) ativo(s) ainda sem avaliação de risco.</Nota>}
                </Cartao>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16 }}>
                <Cartao titulo="Evolução mensal" dica="Andamentos e decisões registrados nos últimos 12 meses (inclui os convertidos da planilha).">
                  <ColunasMensais dados={painel.evolucaoMensal} series={[
                    { chave: "andamentos", rotulo: "Andamentos", cor: "var(--accent-violet)" },
                    { chave: "decisoes", rotulo: "Decisões", cor: "var(--accent-cyan)" },
                    { chave: "encerrados", rotulo: "Encerrados", cor: "var(--accent-green)" },
                  ]} />
                </Cartao>
                {/* O que mudou? */}
                <Cartao titulo="O que mudou" dica={painel.oQueMudou.referencia.tipo === "reuniao" ? "Desde a última Reunião Estratégica encerrada." : "Nos últimos 30 dias — ainda não há reunião encerrada."}>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 10px" }}>
                    {painel.oQueMudou.referencia.tipo === "reuniao"
                      ? <>Desde a reunião <strong>{painel.oQueMudou.referencia.titulo}</strong> ({data(painel.oQueMudou.referencia.data)})</>
                      : <>Desde {data(painel.oQueMudou.desde)}</>}
                    {" · "}{painel.oQueMudou.novos.length} novo(s) · {painel.oQueMudou.farolMudou} mudança(s) de farol
                  </p>
                  {painel.oQueMudou.casos.length === 0 ? (
                    <Nota>Nenhuma alteração no período.</Nota>
                  ) : (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                      {painel.oQueMudou.casos.slice(0, 8).map(g => (
                        <li key={g.caso.id}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                            <FarolPonto farol={g.caso.farol} tamanho={8} />
                            <Link href={`${BASE}/assuntos/${g.caso.id}`} style={{ ...LINK_DISCRETO, fontWeight: 600 }}>{g.caso.codigo} · {g.caso.titulo}</Link>
                            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{g.alteracoes} alteração(ões)</span>
                          </div>
                          <ul style={{ margin: "3px 0 0 16px", padding: 0, listStyle: "none", fontSize: 11.5, color: "var(--text-secondary)" }}>
                            {g.ultimas.slice(0, 2).map((u, i) => <li key={i}>{u.descricao ?? u.acao}{u.valorNovo ? ` → ${u.valorNovo}` : ""}</li>)}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  )}
                </Cartao>
              </div>

              <Nota>Atualizado em {new Date(painel.geradoEm).toLocaleString("pt-BR")}. Toda métrica é derivada dos assuntos cadastrados.</Nota>
            </>
          )}

          <CasoForm
            aberto={criando}
            filtros={filtros}
            onFechar={() => setCriando(false)}
            onSalvo={(c: CasoDetalhe) => { setCriando(false); window.location.href = `${BASE}/assuntos/${c.id}`; }}
          />
        </PageBody>
      </div>
    </div>
  );
}

function Veredito({ painel }: { painel: Painel }) {
  const k = painel.kpis;
  const partes: string[] = [];
  if (k.criticos) partes.push(`${k.criticos} ${k.criticos === 1 ? "assunto crítico" : "assuntos críticos"}`);
  if (k.vencidos) partes.push(`${k.vencidos} ${k.vencidos === 1 ? "vencido" : "vencidos"}`);
  if (k.semProximaAcao) partes.push(`${k.semProximaAcao} sem próxima ação`);
  if (k.parados90) partes.push(`${k.parados90} parado(s) há mais de 90 dias`);
  const critico = k.criticos + k.vencidos > 0;
  const cor = critico ? "var(--accent-red)" : partes.length ? "var(--accent-amber)" : "var(--accent-green)";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 14, marginBottom: 16,
      background: `color-mix(in srgb, ${cor} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${cor} 26%, transparent)`,
    }}>
      <span style={{ color: cor, display: "flex" }}>{partes.length ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}</span>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          {partes.length ? `${partes.join(", ")}.` : "Carteira sob controle: todos os assuntos ativos têm ação, prazo e movimentação recente."}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
          {k.total} assuntos na carteira · {k.emAndamento} em andamento · {k.oportunidades} oportunidades · {k.suspensos} suspensos
        </div>
      </div>
    </div>
  );
}

function ListaResumo({ itens, mostrar }: { itens: Painel["oQueImporta"]; mostrar: "acao" | "parado" }) {
  if (!itens.length) return <Nota>Nada a mostrar.</Nota>;
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
      {itens.map(c => (
        <li key={c.id} style={{ display: "grid", gridTemplateColumns: "12px 1fr auto", gap: 10, alignItems: "start" }}>
          <span style={{ paddingTop: 4 }}><FarolPonto farol={c.farol} tamanho={9} /></span>
          <span style={{ minWidth: 0 }}>
            <Link href={`${BASE}/assuntos/${c.id}`} style={{ ...LINK_DISCRETO, fontSize: 12.5, fontWeight: 600 }}>
              <span className="num" style={{ color: "var(--text-muted)", fontWeight: 400 }}>{c.codigo}</span> {c.titulo}
            </Link>
            <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>
              {mostrar === "acao"
                ? (c.proximaAcao ? `${c.proximaAcao}${c.proximaAcaoPrazo ? ` · ${prazoEmPalavras(c.diasProximaAcao)}` : ""}` : <SemAcao compacto />)
                : (c.motivo ?? c.statusTexto)}
            </div>
          </span>
          <span className="num" style={{ fontSize: 11.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            {mostrar === "parado" ? `${c.diasParado} dias` : c.responsavel ?? ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
