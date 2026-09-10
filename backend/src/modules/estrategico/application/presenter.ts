import { calcularFarol, farolEfetivo, ParametrosFarol, ROTULO_FAROL, Farol } from "../domain/farol.entity";
import {
  etapaDe, naturezaDe, estaAtivo, diasEntre, faixaAging, scoreRisco, classificacaoGeral,
  CAMPO_VALOR_IDS, PIPELINE_OPORTUNIDADE, ROTULO_PRIORIDADE,
} from "../domain/caso.entity";

export type ContextoApresentacao = {
  hoje: Date;
  parametros: ParametrosFarol;
  verFinanceiro: boolean;
};

const num = (v: any) => (v == null ? null : Number(v));
const pessoa = (u: any) => (u ? { id: u.id, nome: u.nome, avatar: u.avatar ?? null } : null);
const item = (c: any) => (c ? { id: c.id, nome: c.nome, cor: c.cor ?? null, natureza: c.natureza ?? null } : null);
const plural = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;

export const ORDEM_FAROL: Record<string, number> = { vermelho: 0, amarelo: 1, azul: 2, verde: 3, cinza: 4 };

/** Os nove valores com nome — `CAMPO_VALOR_IDS` é string[], e o spread perderia as chaves no tipo. */
type Valores = {
  valorPretendido: number | null; valorSolicitado: number | null; valorEmAnalise: number | null;
  valorReconhecido: number | null; valorAlcancado: number | null; valorRecebido: number | null;
  valorReequilibrio: number | null; valorEmRisco: number | null; valorPotencial: number | null;
};

/**
 * O caso como a tela e o relatório o enxergam.
 *
 * O farol é recalculado aqui, com a data de hoje, e não lido da coluna: a
 * coluna é o que a automação gravou na última passada (e serve à trilha), mas
 * um prazo que venceu à meia-noite precisa aparecer vencido às 8h, rodando ou
 * não a automação.
 *
 * Sem `financeiro:ver`, os valores saem nulos e `financeiroVisivel` falso — a
 * tela diz "restrito" em vez de "sem valor", que seriam coisas diferentes.
 */
export function apresentarCaso(c: any, ctx: ContextoApresentacao) {
  const { hoje } = ctx;

  const dependencias = (c.dependencias ?? []).filter((d: any) => !d.resolvidaEm).map((d: any) => ({
    id: d.id,
    catalogoId: d.catalogoId ?? null,
    nome: d.catalogo?.nome ?? d.organizacao ?? "Terceiro",
    natureza: d.catalogo?.natureza ?? (d.organizacao ? "externa" : null),
    organizacao: d.organizacao ?? null,
    contato: d.contato ?? null,
    descricao: d.descricao ?? null,
    desde: d.desde ?? null,
    dias: d.desde ? diasEntre(d.desde, hoje) : null,
    respostaEsperadaEm: d.respostaEsperadaEm ?? null,
    ultimoFollowUpEm: d.ultimoFollowUpEm ?? null,
    proximoFollowUpEm: d.proximoFollowUpEm ?? null,
  }));

  const tarefasVencidas = c._count?.tarefas ?? 0;
  const resultado = calcularFarol({
    ...c,
    valorEmRisco: num(c.valorEmRisco),
    dependencias: dependencias.map((d: any) => ({ nome: d.nome, desde: d.desde })),
    tarefasVencidas,
  }, ctx.parametros, hoje);

  const ativo = estaAtivo(c.etapa);
  const etapa = etapaDe(c.etapa);
  const diasParado = c.ultimaMovimentacaoEm ? diasEntre(c.ultimaMovimentacaoEm, hoje) : null;
  const diasProximaAcao = c.proximaAcaoPrazo ? diasEntre(hoje, c.proximaAcaoPrazo) : null;
  const temAcao = !!c.proximaAcao?.trim();
  const acaoVencida = ativo && temAcao && diasProximaAcao != null && diasProximaAcao < 0;
  const prazoFinalVencido = ativo && !!c.prazoFinal && diasEntre(hoje, c.prazoFinal) < 0;

  const valores = {} as Valores;
  for (const k of CAMPO_VALOR_IDS) (valores as Record<string, number | null>)[k] = ctx.verFinanceiro ? num(c[k]) : null;
  const valorPrincipal = ctx.verFinanceiro
    ? Math.max(0, ...["valorPretendido", "valorReequilibrio", "valorPotencial", "valorReconhecido", "valorAlcancado", "valorEmRisco"]
      .map(k => Math.abs(valores[k] ?? 0)))
    : null;

  const dependenciaTexto = dependencias.length
    ? dependencias.map((d: any) => (d.dias != null ? `Aguardando ${d.nome} há ${plural(d.dias)}` : `Aguardando ${d.nome}`)).join(" · ")
    : null;

  const farol: Farol = farolEfetivo(resultado.farol, c.farolManual);
  const riscoScore = scoreRisco(c.probabilidade, c.impacto);

  return {
    id: c.id,
    codigo: c.codigo,
    titulo: c.titulo,
    descricao: c.descricao ?? null,
    tipo: c.tipo,
    etapa: c.etapa,
    etapaRotulo: etapa?.rotulo ?? c.etapa,
    natureza: naturezaDe(c.etapa),
    aguardaTerceiro: !!etapa?.aguardaTerceiro,
    ativo,
    estagioOportunidade: c.estagioOportunidade ?? null,
    estagioRotulo: PIPELINE_OPORTUNIDADE.find(e => e.id === c.estagioOportunidade)?.rotulo ?? null,
    prioridade: c.prioridade,
    prioridadeRotulo: ROTULO_PRIORIDADE[c.prioridade] ?? c.prioridade,
    statusTexto: dependenciaTexto ? `${etapa?.rotulo ?? c.etapa} · ${dependenciaTexto}` : (etapa?.rotulo ?? c.etapa),

    grupo: item(c.grupo),
    objetivo: item(c.objetivo),
    esfera: item(c.esfera),
    areaExecutiva: item(c.areaExecutiva),
    areaOperacional: item(c.areaOperacional),
    areasApoio: (c.apoios ?? []).map((a: any) => item(a.area)).filter(Boolean),
    responsavelExecutivo: pessoa(c.responsavelExecutivo),
    responsavelOperacional: pessoa(c.responsavelOperacional),

    proximaAcao: c.proximaAcao ?? null,
    proximaAcaoResponsavel: pessoa(c.proximaAcaoResponsavel),
    proximaAcaoResponsavelNome: c.proximaAcaoResponsavelNome ?? null,
    proximaAcaoPrazo: c.proximaAcaoPrazo ?? null,
    proximaAcaoPrioridade: c.proximaAcaoPrioridade ?? null,
    prazoFinal: c.prazoFinal ?? null,
    ultimaMovimentacaoEm: c.ultimaMovimentacaoEm ?? null,

    diasParado,
    faixaAging: faixaAging(diasParado),
    diasProximaAcao,
    semProximaAcao: ativo && !temAcao,
    acaoVencida,
    prazoFinalVencido,
    vencido: acaoVencida || prazoFinalVencido,

    dependencias,
    dependenciaTexto,
    tarefasVencidas,

    financeiroVisivel: ctx.verFinanceiro,
    classificacaoFinanceira: ctx.verFinanceiro ? c.classificacaoFinanceira ?? null : null,
    moeda: c.moeda,
    ...valores,
    valoresReferenciaEm: ctx.verFinanceiro ? c.valoresReferenciaEm ?? null : null,
    valorPrincipal,
    temValor: ctx.verFinanceiro ? CAMPO_VALOR_IDS.some(k => valores[k] != null) : null,

    probabilidade: c.probabilidade ?? null,
    impacto: c.impacto ?? null,
    riscoFinanceiro: c.riscoFinanceiro ?? null,
    riscoJuridico: c.riscoJuridico ?? null,
    riscoRegulatorio: c.riscoRegulatorio ?? null,
    riscoOperacional: c.riscoOperacional ?? null,
    riscoPrazo: c.riscoPrazo ?? null,
    planoMitigacao: c.planoMitigacao ?? null,
    riscoScore,
    riscoNivel: classificacaoGeral(c),

    farol,
    farolRotulo: ROTULO_FAROL[farol],
    farolCalculado: resultado.farol,
    farolMotivos: resultado.motivos,
    farolManual: c.farolManual ?? null,
    farolJustificativa: c.farolJustificativa ?? null,
    farolDivergente: !!c.farolManual && c.farolManual !== resultado.farol,

    statusOriginal: c.statusOriginal ?? null,
    importado: !!c.importacaoChave,
    revisarImportacao: !!c.revisarImportacao,
    encerradoEm: c.encerradoEm ?? null,
    criadoEm: c.criadoEm,
    atualizadoEm: c.atualizadoEm,
  };
}

export type CasoApresentado = ReturnType<typeof apresentarCaso>;

export function ordenarPorGravidade(a: CasoApresentado, b: CasoApresentado): number {
  const f = (ORDEM_FAROL[a.farol] ?? 9) - (ORDEM_FAROL[b.farol] ?? 9);
  if (f) return f;
  const pa = a.diasProximaAcao ?? Number.MAX_SAFE_INTEGER;
  const pb = b.diasProximaAcao ?? Number.MAX_SAFE_INTEGER;
  if (pa !== pb) return pa - pb;
  return a.codigo.localeCompare(b.codigo);
}
