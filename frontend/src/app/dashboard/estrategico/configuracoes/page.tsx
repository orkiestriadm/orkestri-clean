"use client";
export const dynamic = "force-dynamic";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import {
  PageBody, BackLink, PageHeader, Tabs, TableCard, PermissionDenied, KpiCard, FormGrid, FormField, FormActions, StatusBadge,
} from "@/components/data-ui";
import { Settings2, Upload, CheckCircle2, Play, Plus } from "lucide-react";
import { estrategicoService } from "@/lib/estrategico/estrategico.service";
import type {
  Catalogo, Config, Filtros, PerfilEstrategico, PreviaImportacao, ResultadoImportacao, ResultadoAutomacao,
} from "@/lib/estrategico/types";
import { ROTULO_TIPO_CATALOGO } from "@/lib/estrategico/types";
import { BASE, pode, Aviso, Nota, mensagemErro, dataEvento } from "../_components/comuns";
import { Cartao } from "../_components/graficos";

type Aba = "importacao" | "catalogos" | "parametros" | "perfis" | "automacoes";

export default function ConfiguracoesPage() {
  const user = useAuthStore(s => s.user);
  const params = useSearchParams();
  const [aba, setAba] = useState<Aba>((params.get("aba") as Aba) ?? "importacao");
  const [filtros, setFiltros] = useState<Filtros | null>(null);
  useEffect(() => { estrategicoService.filtros().then(setFiltros).catch(() => {}); }, []);

  const admin = pode(user, "estrategico.admin:gerenciar");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href={BASE} label="Painel estratégico" />
          <PageHeader icon={<Settings2 size={19} />} title="Configurações do Strategy" subtitle="Importação da planilha, catálogos, parâmetros do farol, perfis de acesso e automações" />
          {!admin ? <PermissionDenied hint="Exige a permissão estrategico.admin:gerenciar." /> : (
            <>
              <Tabs
                tabs={[
                  { id: "importacao", label: "Importar planilha" },
                  { id: "catalogos", label: "Catálogos" },
                  { id: "parametros", label: "Parâmetros e alertas" },
                  { id: "perfis", label: "Perfis de acesso" },
                  { id: "automacoes", label: "Automações" },
                ]}
                active={aba}
                onChange={id => setAba(id as Aba)}
              />
              <div style={{ marginTop: 16 }}>
                {aba === "importacao" && <Importacao />}
                {aba === "catalogos" && <Catalogos />}
                {aba === "parametros" && <Parametros filtros={filtros} />}
                {aba === "perfis" && <Perfis />}
                {aba === "automacoes" && <Automacoes />}
              </div>
            </>
          )}
        </PageBody>
      </div>
    </div>
  );
}

/* ── Importação ─────────────────────────────────────────────────────────── */

const ROTULO_ETAPA: Record<string, string> = {
  ideia: "Ideia/Oportunidade", em_analise: "Em análise", levantamento: "Levantamento de informações", evidencias: "Produção de evidências",
  quantificacao: "Quantificação", preparacao_pleito: "Preparação do pleito", protocolado: "Protocolado",
  negociacao_externa: "Negociação/análise externa", aguardando_decisao: "Aguardando decisão", decisao_recebida: "Decisão recebida",
  implementacao: "Implementação", concluido: "Concluído", suspenso: "Suspenso", cancelado: "Cancelado",
};

function Importacao() {
  const toast = useToastStore();
  const input = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<PreviaImportacao | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [aberto, setAberto] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState<"previa" | "confirmar" | null>(null);

  async function gerarPrevia() {
    if (!arquivo) { toast.error("Selecione a planilha"); return; }
    setOcupado("previa"); setResultado(null);
    try { setPrevia(await estrategicoService.previaImportacao(arquivo)); }
    catch (e) { toast.error("Não foi possível ler a planilha", mensagemErro(e, "")); }
    finally { setOcupado(null); }
  }
  async function confirmar() {
    if (!arquivo || !previa) return;
    if (!confirm(`Importar ${previa.resumo.novos} assunto(s) novo(s)? Os já importados são ignorados.`)) return;
    setOcupado("confirmar");
    try { setResultado(await estrategicoService.confirmarImportacao(arquivo)); setPrevia(null); toast.success("Importação concluída"); }
    catch (e) { toast.error("A importação falhou — nada foi gravado", mensagemErro(e, "")); }
    finally { setOcupado(null); }
  }

  return (
    <>
      <Cartao titulo="Planilha de acompanhamento estratégico">
        <p style={{ fontSize: 12.5, margin: "0 0 12px", lineHeight: 1.55 }}>
          Envie o .xlsx no layout da planilha “Acompanhamento Estratégico” (cabeçalho com <em>Assunto, Objetivo, Principais Andamentos, Esfera, Status Atual, Área Responsável</em>).
          A prévia não grava nada. Na confirmação, cada linha vira um assunto; linhas só com o título viram <strong>grupo</strong>; andamentos com data clara no início da linha viram <strong>eventos da timeline</strong>;
          o texto original é preservado e tudo que não pôde ser lido com segurança fica marcado para revisão. O arquivo não fica guardado no servidor.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input ref={input} type="file" accept=".xlsx,.xlsm,.xls" className="input-o" style={{ maxWidth: 360 }} onChange={e => { setArquivo(e.target.files?.[0] ?? null); setPrevia(null); setResultado(null); }} />
          <button type="button" className="btn btn-primary" onClick={gerarPrevia} disabled={!arquivo || !!ocupado}><Upload size={14} /> {ocupado === "previa" ? "Lendo…" : "Pré-visualizar"}</button>
        </div>
      </Cartao>

      {resultado && (
        <Cartao titulo="Importação concluída">
          <p style={{ fontSize: 13, margin: "0 0 10px" }}>
            <CheckCircle2 size={15} style={{ verticalAlign: -3, color: "var(--accent-green)" }} /> {resultado.criados.length} assunto(s) criado(s), {resultado.eventos} andamento(s), {resultado.dependencias} dependência(s).
            {resultado.ignorados.length > 0 && ` ${resultado.ignorados.length} ignorado(s) por já existirem.`}
          </p>
          {resultado.catalogosCriados.length > 0 && <Nota>Catálogo criado: {resultado.catalogosCriados.join(" · ")}</Nota>}
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <Link href={`${BASE}/assuntos?recorte=revisar`} className="btn btn-primary">Revisar assuntos importados</Link>
            <Link href={BASE} className="btn btn-ghost">Ir para o painel</Link>
          </div>
        </Cartao>
      )}

      {previa && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
            <KpiCard label="Assuntos na planilha" valor={previa.resumo.casos} index={0} />
            <KpiCard label="Novos a importar" valor={previa.resumo.novos} color="var(--accent-green)" index={1} />
            <KpiCard label="Já importados" valor={previa.resumo.jaImportados} color="var(--text-muted)" index={2} />
            <KpiCard label="Andamentos → eventos" valor={previa.resumo.eventos} color="var(--accent-cyan)" index={3} />
            <KpiCard label="Trechos sem data" valor={previa.resumo.trechosSemData} color="var(--accent-amber)" index={4} hint="Ficam só no texto original" />
            <KpiCard label="Oportunidades" valor={previa.resumo.oportunidades} color="var(--accent-cyan)" index={5} />
          </div>
          <Cartao titulo={`Prévia — aba “${previa.aba}”, cabeçalho na linha ${previa.linhaCabecalho}`}
            acoes={<button type="button" className="btn btn-primary" onClick={confirmar} disabled={!previa.resumo.novos || !!ocupado}>{ocupado === "confirmar" ? "Importando…" : `Confirmar importação (${previa.resumo.novos})`}</button>}>
            {previa.avisos.map((a, i) => <Aviso key={i} tom="info">{a}</Aviso>)}
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 10px" }}>
              Grupos: {previa.grupos.join(" · ")}<br />
              Objetivos: {previa.catalogos.objetivo.map(o => o.nome).join(" · ")}<br />
              Esferas: {previa.catalogos.esfera.map(o => o.nome).join(" · ")} · Áreas: {previa.catalogos.area.map(o => o.nome).join(" · ")}<br />
              Dependências detectadas: {previa.catalogos.dependencia.join(" · ") || "—"}
            </p>
            <TableCard>
              <thead><tr><th>Linha</th><th>Assunto</th><th>Grupo</th><th>Etapa / dependência</th><th className="num">Eventos</th><th className="num">Revisar</th><th /></tr></thead>
              <tbody>
                {previa.casos.map(c => (
                  <Fragment key={c.linha}>
                    <tr style={{ cursor: "pointer", opacity: c.jaImportado ? 0.55 : 1 }} onClick={() => setAberto(aberto === c.linha ? null : c.linha)}>
                      <td className="num">{c.linha}</td>
                      <td style={{ fontSize: 12.5, fontWeight: 600, maxWidth: 300 }}>{c.titulo}{c.tipo === "oportunidade" && <span style={{ fontWeight: 400, color: "var(--accent-cyan)" }}> · oportunidade</span>}</td>
                      <td style={{ fontSize: 12 }}>{c.grupo ?? "—"}</td>
                      <td style={{ fontSize: 12 }}>{ROTULO_ETAPA[c.etapa] ?? c.etapa}{c.dependencia && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>aguardando {c.dependencia} · original: “{c.statusOriginal}”</div>}</td>
                      <td className="num">{c.eventos.length}</td>
                      <td className="num" style={{ color: "var(--accent-amber)" }}>{c.pendencias.length}</td>
                      <td>{c.jaImportado ? <StatusBadge label={`já é ${c.jaImportado.codigo}`} tone="neutro" /> : <StatusBadge label="novo" tone="ok" />}</td>
                    </tr>
                    {aberto === c.linha && (
                      <tr>
                        <td colSpan={7} style={{ background: "color-mix(in srgb, var(--text-muted) 6%, transparent)" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, fontSize: 12 }}>
                            <div>
                              <strong>Eventos da timeline</strong>
                              {c.eventos.length === 0 ? <Nota>Nenhuma data clara no início das linhas.</Nota> : (
                                <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>
                                  {c.eventos.map((e, i) => <li key={i}><span className="num">{dataEvento(e.data, e.precisao as any)}</span> · {e.tipo} · {e.titulo}{e.contexto ? <em style={{ color: "var(--text-muted)" }}> ({e.contexto})</em> : null}</li>)}
                                </ul>
                              )}
                            </div>
                            <div>
                              <strong>Para revisar</strong>
                              <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>{c.pendencias.map((p, i) => <li key={i}>{p}</li>)}</ul>
                              {c.trechosSemData.length > 0 && <><strong>Trechos sem data</strong><ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>{c.trechosSemData.map((t, i) => <li key={i}>{t}</li>)}</ul></>}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </TableCard>
          </Cartao>
        </>
      )}
    </>
  );
}

/* ── Catálogos ──────────────────────────────────────────────────────────── */

function Catalogos() {
  const toast = useToastStore();
  const [itens, setItens] = useState<Catalogo[] | null>(null);
  const [novos, setNovos] = useState<Record<string, string>>({});
  const carregar = useCallback(() => { estrategicoService.catalogos().then(setItens).catch(() => setItens([])); }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function salvar(c: Catalogo, dados: Partial<Catalogo>) {
    try { await estrategicoService.atualizarCatalogo(c.id, dados); carregar(); }
    catch (e) { toast.error("Não foi possível salvar", mensagemErro(e, "")); carregar(); }
  }
  async function criar(tipo: string) {
    const nome = (novos[tipo] ?? "").trim();
    if (!nome) return;
    try { await estrategicoService.criarCatalogo({ tipo, nome, natureza: tipo === "dependencia" ? "externa" : undefined }); setNovos(n => ({ ...n, [tipo]: "" })); carregar(); }
    catch (e) { toast.error("Não foi possível criar", mensagemErro(e, "")); }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
      {(["grupo", "objetivo", "esfera", "area", "dependencia"] as const).map(tipo => (
        <Cartao key={tipo} titulo={ROTULO_TIPO_CATALOGO[tipo]} dica={tipo === "dependencia" ? "Externa gera cobrança automática quando a espera passa do ciclo." : undefined}>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 10px", display: "flex", flexDirection: "column", gap: 6 }}>
            {(itens ?? []).filter(i => i.tipo === tipo).map(i => (
              <li key={i.id} style={{ display: "flex", gap: 6, alignItems: "center", opacity: i.ativo ? 1 : 0.55 }}>
                <input className="input-o" defaultValue={i.nome} style={{ flex: 1, padding: "5px 8px", fontSize: 12.5 }}
                  onBlur={e => { if (e.target.value.trim() && e.target.value.trim() !== i.nome) salvar(i, { nome: e.target.value.trim() }); }} />
                {tipo === "dependencia" && (
                  <select className="select-field" value={i.natureza ?? "externa"} onChange={e => salvar(i, { natureza: e.target.value })} style={{ fontSize: 12 }}>
                    <option value="externa">externa</option><option value="interna">interna</option>
                  </select>
                )}
                <span className="num" style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 44, textAlign: "right" }} title="Assuntos que usam">{i.emUso} uso</span>
                <label title={i.ativo ? "Desativar" : "Ativar"} style={{ display: "flex", alignItems: "center" }}>
                  <input type="checkbox" checked={i.ativo} onChange={e => salvar(i, { ativo: e.target.checked })} />
                </label>
              </li>
            ))}
            {itens && !itens.some(i => i.tipo === tipo) && <Nota>Vazio.</Nota>}
          </ul>
          <div style={{ display: "flex", gap: 6 }}>
            <input className="input-o" placeholder="Novo item" value={novos[tipo] ?? ""} onChange={e => setNovos(n => ({ ...n, [tipo]: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") criar(tipo); }} style={{ flex: 1, padding: "5px 8px", fontSize: 12.5 }} />
            <button type="button" className="btn btn-ghost" onClick={() => criar(tipo)}><Plus size={13} /></button>
          </div>
        </Cartao>
      ))}
    </div>
  );
}

/* ── Parâmetros ─────────────────────────────────────────────────────────── */

function Parametros({ filtros }: { filtros: Filtros | null }) {
  const toast = useToastStore();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [antecedencias, setAntecedencias] = useState("");
  const [limiar, setLimiar] = useState("");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    estrategicoService.config().then(c => {
      setCfg(c);
      setAntecedencias(c.antecedenciasAviso.join(", "));
      setLimiar(c.limiarValorRelevante == null ? "" : String(c.limiarValorRelevante));
    }).catch(() => {});
  }, []);
  if (!cfg) return <div className="skeleton" style={{ height: 240, borderRadius: 14 }} />;
  const set = (k: keyof Config, v: any) => setCfg({ ...cfg, [k]: v });

  async function salvar() {
    if (!cfg) return;
    const lista = antecedencias.split(/[,; ]+/).map(Number).filter(n => Number.isInteger(n) && n >= 0);
    setSalvando(true);
    try {
      const salvo = await estrategicoService.salvarConfig({
        diasAtencaoSemMovimento: Number(cfg.diasAtencaoSemMovimento), diasCriticoSemMovimento: Number(cfg.diasCriticoSemMovimento),
        diasAtrasoCritico: Number(cfg.diasAtrasoCritico), diasDependenciaAtencao: Number(cfg.diasDependenciaAtencao),
        diasFollowUp: Number(cfg.diasFollowUp), diasEscalonamento: Number(cfg.diasEscalonamento),
        antecedenciasAviso: lista, limiarValorRelevante: limiar.trim() ? Number(limiar.replace(/\./g, "").replace(",", ".")) : null,
        automacoesAtivas: cfg.automacoesAtivas, notificarEmail: cfg.notificarEmail, gestoresEscalonamento: cfg.gestoresEscalonamento,
      });
      setCfg(salvo);
      toast.success("Parâmetros salvos", "O farol e as automações passam a usar os novos valores.");
    } catch (e) { toast.error("Não foi possível salvar", mensagemErro(e, "")); }
    finally { setSalvando(false); }
  }

  const numero = (k: keyof Config, rotulo: string, dica: string) => (
    <FormField label={rotulo} dica={dica}>
      <input type="number" min={1} className="input-o num" value={cfg[k] as number} onChange={e => set(k, e.target.value)} />
    </FormField>
  );

  return (
    <Cartao titulo="Parâmetros do farol e das automações">
      <FormGrid min={220}>
        {numero("diasAtencaoSemMovimento", "Atenção sem movimentação (dias)", "Farol amarelo e primeiro aviso de aging")}
        {numero("diasCriticoSemMovimento", "Crítico sem movimentação (dias)", "Farol vermelho e último aviso de aging")}
        {numero("diasAtrasoCritico", "Atraso crítico da ação (dias)", "Ação vencida há mais que isso fica vermelha")}
        {numero("diasDependenciaAtencao", "Espera por dependência (dias)", "Aguardando terceiro além disso fica amarelo")}
        {numero("diasFollowUp", "Ciclo de cobrança (dias)", "Gera tarefa de follow-up a cada ciclo de espera externa")}
        {numero("diasEscalonamento", "Escalonamento (dias)", "Assunto crítico vencido sobe um degrau a cada ciclo")}
        <FormField label="Avisos antes do prazo (dias)" dica="Separados por vírgula — ex.: 15, 7, 3, 0">
          <input className="input-o" value={antecedencias} onChange={e => setAntecedencias(e.target.value)} />
        </FormField>
        <FormField label="Valor relevante em risco (R$)" dica="Com risco alto, acima disso o farol fica vermelho. Vazio = não usar.">
          <input className="input-o num" value={limiar} onChange={e => setLimiar(e.target.value)} placeholder="ex.: 10.000.000" />
        </FormField>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5 }}>
          <input type="checkbox" checked={cfg.automacoesAtivas} onChange={e => set("automacoesAtivas", e.target.checked)} /> Automações ativas (diariamente às 07:30)
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5 }}>
          <input type="checkbox" checked={cfg.notificarEmail} onChange={e => set("notificarEmail", e.target.checked)} /> Enviar também por e-mail (além do sino)
        </label>
        <FormField label="Gestores no último degrau do escalonamento" largura="total">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
            {(filtros?.usuarios ?? []).map(u => (
              <label key={u.id} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5 }}>
                <input type="checkbox" checked={cfg.gestoresEscalonamento.includes(u.id)}
                  onChange={e => set("gestoresEscalonamento", e.target.checked ? [...cfg.gestoresEscalonamento, u.id] : cfg.gestoresEscalonamento.filter(x => x !== u.id))} />
                {u.nome}
              </label>
            ))}
          </div>
        </FormField>
      </FormGrid>
      {cfg.notificarEmail && <Aviso>O e-mail sai pela fila de notificações da organização (silêncio noturno e limite de vazão). Confirme que o envio de e-mail está configurado neste ambiente.</Aviso>}
      <FormActions>
        <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar parâmetros"}</button>
      </FormActions>
    </Cartao>
  );
}

/* ── Perfis ─────────────────────────────────────────────────────────────── */

function Perfis() {
  const [dados, setDados] = useState<{ perfis: PerfilEstrategico[]; permissoes: { permissao: string; descricao: string }[] } | null>(null);
  useEffect(() => { estrategicoService.perfis().then(setDados).catch(() => {}); }, []);
  if (!dados) return <div className="skeleton" style={{ height: 200, borderRadius: 14 }} />;
  const descricao = (p: string) => dados.permissoes.find(x => x.permissao === p)?.descricao ?? p;
  return (
    <>
      <Aviso tom="info">
        <strong>O módulo é confidencial por padrão.</strong> Só o master e o papel Administrador enxergam de saída — nem Visualizador nem Auditor recebem
        estas permissões automaticamente. Para dar acesso, conceda o conjunto do perfil desejado em <strong>Administração › Cadastros</strong> (permissões do usuário ou do papel).
      </Aviso>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        {dados.perfis.map(p => (
          <Cartao key={p.id} titulo={p.nome}>
            <p style={{ fontSize: 12.5, margin: "0 0 8px" }}>{p.descricao}</p>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.6 }}>
              {p.permissoes.map(x => <li key={x} title={x}>{descricao(x)}</li>)}
            </ul>
          </Cartao>
        ))}
      </div>
    </>
  );
}

/* ── Automações ─────────────────────────────────────────────────────────── */

function Automacoes() {
  const toast = useToastStore();
  const [resultado, setResultado] = useState<ResultadoAutomacao | null>(null);
  const [rodando, setRodando] = useState(false);
  async function executar() {
    setRodando(true);
    try { setResultado(await estrategicoService.executarAutomacoes()); toast.success("Automações executadas"); }
    catch (e) { toast.error("Falha ao executar", mensagemErro(e, "")); }
    finally { setRodando(false); }
  }
  return (
    <Cartao titulo="Automações" acoes={<button type="button" className="btn btn-primary" onClick={executar} disabled={rodando}><Play size={13} /> {rodando ? "Executando…" : "Executar agora"}</button>}>
      <ul style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 12.5, lineHeight: 1.7 }}>
        <li>Recalcula e grava o farol de todos os assuntos (mudanças ficam no histórico).</li>
        <li>Avisa o responsável pela próxima ação a 15/7/3/0 dias e no vencimento.</li>
        <li>Escalona assunto crítico vencido: responsável → operacional → executivo e gestores.</li>
        <li>Avisa assuntos sem movimentação há 30/60/90 dias.</li>
        <li>Cria tarefa de cobrança quando a espera por uma dependência externa passa do ciclo.</li>
        <li>Avisa os prazos das tarefas.</li>
      </ul>
      <Nota>Roda sozinha todo dia às 07:30. Aviso sem pessoa nomeada não é enviado a “alguém” — entra na contagem “sem destinatário”.</Nota>
      {resultado && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 14 }}>
          <KpiCard label="Assuntos avaliados" valor={resultado.casos} index={0} />
          <KpiCard label="Faróis alterados" valor={resultado.farolAlterado} index={1} />
          <KpiCard label="Avisos enviados" valor={resultado.avisos} color="var(--accent-cyan)" index={2} />
          <KpiCard label="Escalonamentos" valor={resultado.escalonamentos} color="var(--accent-red)" index={3} />
          <KpiCard label="Cobranças criadas" valor={resultado.followUps} color="var(--accent-amber)" index={4} />
          <KpiCard label="Sem destinatário" valor={resultado.semDestinatario} color="var(--text-muted)" index={5} hint="Nomeie responsáveis para que os avisos cheguem" />
        </div>
      )}
    </Cartao>
  );
}
