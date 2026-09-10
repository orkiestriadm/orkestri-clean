/**
 * Vocabulário do Orkiestri Strategy.
 *
 * Regras puras, sem Prisma e sem Nest — testáveis isoladamente e usadas igual
 * pelo serviço, pela automação, pelo importador e pelos relatórios. A planilha
 * que o módulo substitui tinha o mesmo assunto descrito de três jeitos
 * ("Alteração de parâmetro", "Alteração parâmetros", "Alteração de parâmetros");
 * aqui cada conceito tem UMA definição.
 *
 * O que é CONFIGURAÇÃO da empresa (objetivos, esferas, áreas, dependências)
 * mora no catálogo do banco. O que é DEFINIÇÃO DO PROCESSO — as etapas do
 * workflow e o pipeline de oportunidades — mora aqui, porque o farol, a pauta
 * da reunião e os indicadores dependem da natureza de cada etapa.
 */

export type NaturezaEtapa = "oportunidade" | "ativa" | "suspensa" | "encerrada";

export const ETAPAS: readonly { id: string; rotulo: string; natureza: NaturezaEtapa; aguardaTerceiro?: boolean }[] = [
  { id: "ideia",              rotulo: "Ideia/Oportunidade",             natureza: "oportunidade" },
  { id: "em_analise",         rotulo: "Em análise",                     natureza: "ativa" },
  { id: "levantamento",       rotulo: "Levantamento de informações",    natureza: "ativa" },
  { id: "evidencias",         rotulo: "Produção de evidências",         natureza: "ativa" },
  { id: "quantificacao",      rotulo: "Quantificação econômica",        natureza: "ativa" },
  { id: "preparacao_pleito",  rotulo: "Preparação do pleito",           natureza: "ativa" },
  { id: "protocolado",        rotulo: "Protocolado",                    natureza: "ativa", aguardaTerceiro: true },
  { id: "negociacao_externa", rotulo: "Em negociação/análise externa",  natureza: "ativa", aguardaTerceiro: true },
  { id: "aguardando_decisao", rotulo: "Aguardando decisão",             natureza: "ativa", aguardaTerceiro: true },
  { id: "decisao_recebida",   rotulo: "Decisão recebida",               natureza: "ativa" },
  { id: "implementacao",      rotulo: "Implementação",                  natureza: "ativa" },
  { id: "concluido",          rotulo: "Concluído",                      natureza: "encerrada" },
  { id: "suspenso",           rotulo: "Suspenso",                       natureza: "suspensa" },
  { id: "cancelado",          rotulo: "Cancelado",                      natureza: "encerrada" },
];

export const ETAPA_IDS = ETAPAS.map(e => e.id);

export function etapaDe(id: string | null | undefined) {
  return ETAPAS.find(e => e.id === id) ?? null;
}

export function naturezaDe(etapa: string | null | undefined): NaturezaEtapa {
  return etapaDe(etapa)?.natureza ?? "ativa";
}

/** Em acompanhamento: nem suspenso, nem encerrado. */
export function estaAtivo(etapa: string | null | undefined): boolean {
  const n = naturezaDe(etapa);
  return n === "ativa" || n === "oportunidade";
}

export const PIPELINE_OPORTUNIDADE: readonly { id: string; rotulo: string }[] = [
  { id: "identificada",  rotulo: "Identificada" },
  { id: "em_estudo",     rotulo: "Em estudo" },
  { id: "evidencia",     rotulo: "Evidência" },
  { id: "quantificacao", rotulo: "Quantificação" },
  { id: "validacao",     rotulo: "Validação" },
  { id: "preparacao",    rotulo: "Preparação" },
  { id: "protocolada",   rotulo: "Protocolada" },
  { id: "em_negociacao", rotulo: "Em negociação" },
  { id: "reconhecida",   rotulo: "Reconhecida" },
  { id: "realizada",     rotulo: "Realizada" },
];

export const ESTAGIO_IDS = PIPELINE_OPORTUNIDADE.map(e => e.id);

/** Oportunidade "em estruturação" = antes de virar pleito formal (protocolo). */
export function oportunidadeEmEstruturacao(tipo: string, estagio: string | null | undefined, etapa?: string | null): boolean {
  if (etapa === "ideia") return true;
  if (tipo !== "oportunidade") return false;
  const i = ESTAGIO_IDS.indexOf(estagio ?? "identificada");
  return i < 0 || i < ESTAGIO_IDS.indexOf("protocolada");
}

export const TIPOS_CASO = ["assunto", "oportunidade"] as const;
export const PRIORIDADES = ["baixa", "media", "alta", "critica"] as const;
export const ROTULO_PRIORIDADE: Record<string, string> = {
  baixa: "Baixa", media: "Média", alta: "Alta", critica: "Crítica",
};

export const TIPOS_CATALOGO = ["grupo", "objetivo", "esfera", "area", "dependencia"] as const;
export type TipoCatalogo = (typeof TIPOS_CATALOGO)[number];

/**
 * Dependências que o próprio plano de informatização define (seção 7).
 * Semeadas uma vez por organização; a empresa edita, desativa ou acrescenta.
 */
export const DEPENDENCIAS_PADRAO: readonly { nome: string; natureza: "interna" | "externa" }[] = [
  { nome: "TBR",         natureza: "interna" },
  { nome: "ANTT",        natureza: "externa" },
  { nome: "Ministério",  natureza: "externa" },
  { nome: "Judiciário",  natureza: "externa" },
  { nome: "Arbitragem",  natureza: "externa" },
  { nome: "Banco",       natureza: "externa" },
  { nome: "Financeiro",  natureza: "interna" },
  { nome: "Jurídico",    natureza: "interna" },
  { nome: "Regulatório", natureza: "interna" },
  { nome: "Engenharia",  natureza: "interna" },
  { nome: "Operações",   natureza: "interna" },
  { nome: "Terceiro",    natureza: "externa" },
  { nome: "Outro",       natureza: "externa" },
];

export const TIPOS_EVENTO: readonly { id: string; rotulo: string }[] = [
  { id: "andamento",           rotulo: "Andamento" },
  { id: "protocolo",           rotulo: "Protocolo" },
  { id: "reuniao",             rotulo: "Reunião" },
  { id: "oficio",              rotulo: "Ofício" },
  { id: "decisao",             rotulo: "Decisão" },
  { id: "peticao",             rotulo: "Petição" },
  { id: "manifestacao",        rotulo: "Manifestação" },
  { id: "cobranca",            rotulo: "Cobrança" },
  { id: "documento",           rotulo: "Documento" },
  { id: "calculo",             rotulo: "Cálculo" },
  { id: "aprovacao",           rotulo: "Aprovação" },
  { id: "alteracao_status",    rotulo: "Alteração de status" },
  { id: "mudanca_responsavel", rotulo: "Mudança de responsável" },
];
export const TIPO_EVENTO_IDS = TIPOS_EVENTO.map(t => t.id);

export const STATUS_TAREFA = ["pendente", "em_andamento", "bloqueada", "concluida", "cancelada"] as const;
export const TAREFA_ABERTA = ["pendente", "em_andamento", "bloqueada"];

export const CATEGORIAS_DOCUMENTO: readonly { id: string; rotulo: string }[] = [
  { id: "contrato",         rotulo: "Contrato" },
  { id: "aditivo",          rotulo: "Aditivo" },
  { id: "oficio",           rotulo: "Ofício" },
  { id: "nota_tecnica",     rotulo: "Nota técnica" },
  { id: "parecer",          rotulo: "Parecer" },
  { id: "estudo_economico", rotulo: "Estudo econômico" },
  { id: "peticao",          rotulo: "Petição" },
  { id: "decisao",          rotulo: "Decisão" },
  { id: "planilha",         rotulo: "Planilha" },
  { id: "evidencia",        rotulo: "Evidência" },
  { id: "outro",            rotulo: "Outro" },
];
export const CATEGORIA_DOCUMENTO_IDS = CATEGORIAS_DOCUMENTO.map(c => c.id);

export const CLASSIFICACOES_FINANCEIRAS: readonly { id: string; rotulo: string }[] = [
  { id: "receita",       rotulo: "Receita" },
  { id: "reequilibrio",  rotulo: "Reequilíbrio" },
  { id: "reducao_perda", rotulo: "Redução de perda" },
  { id: "recuperacao",   rotulo: "Recuperação de valores" },
  { id: "investimento",  rotulo: "Investimento" },
  { id: "multa",         rotulo: "Multa" },
  { id: "condenacao",    rotulo: "Condenação" },
  { id: "despesa",       rotulo: "Despesa" },
  { id: "oportunidade",  rotulo: "Oportunidade" },
];
export const CLASSIFICACAO_IDS = CLASSIFICACOES_FINANCEIRAS.map(c => c.id);

/** Os nove valores do modelo econômico, na ordem do funil. */
export const CAMPOS_VALOR: readonly { campo: string; rotulo: string }[] = [
  { campo: "valorPretendido",   rotulo: "Pretendido" },
  { campo: "valorSolicitado",   rotulo: "Solicitado" },
  { campo: "valorEmAnalise",    rotulo: "Em análise" },
  { campo: "valorReconhecido",  rotulo: "Reconhecido" },
  { campo: "valorAlcancado",    rotulo: "Alcançado" },
  { campo: "valorRecebido",     rotulo: "Recebido" },
  { campo: "valorReequilibrio", rotulo: "Reequilíbrio" },
  { campo: "valorEmRisco",      rotulo: "Em risco" },
  { campo: "valorPotencial",    rotulo: "Potencial" },
];
export const CAMPO_VALOR_IDS = CAMPOS_VALOR.map(c => c.campo);

/* ── Risco ────────────────────────────────────────────────────────────────── */

export type NivelRisco = "baixo" | "moderado" | "alto" | "critico";

export const DIMENSOES_RISCO: readonly { campo: string; rotulo: string }[] = [
  { campo: "riscoFinanceiro",  rotulo: "Financeiro" },
  { campo: "riscoJuridico",    rotulo: "Jurídico" },
  { campo: "riscoRegulatorio", rotulo: "Regulatório" },
  { campo: "riscoOperacional", rotulo: "Operacional" },
  { campo: "riscoPrazo",       rotulo: "Prazo" },
];

/**
 * Matriz Probabilidade × Impacto (1..5 cada, score 1..25).
 *
 *   1–4 baixo · 5–9 moderado · 10–14 alto · 15–25 crítico
 *
 * Com 5×5 isso deixa "crítico" para as combinações em que as duas escalas
 * estão altas (3×5, 4×4, 5×3 em diante) — risco provável E grave.
 */
export function scoreRisco(probabilidade?: number | null, impacto?: number | null): number | null {
  if (!probabilidade || !impacto) return null;
  return probabilidade * impacto;
}

export function nivelRisco(score: number | null): NivelRisco | null {
  if (score == null) return null;
  if (score >= 15) return "critico";
  if (score >= 10) return "alto";
  if (score >= 5) return "moderado";
  return "baixo";
}

/** Nível de uma dimensão isolada (1..5). */
export function nivelDimensao(v?: number | null): NivelRisco | null {
  if (!v) return null;
  if (v >= 5) return "critico";
  if (v >= 4) return "alto";
  if (v >= 3) return "moderado";
  return "baixo";
}

/**
 * Classificação geral: o pior entre a matriz e as dimensões. Um risco jurídico
 * crítico não fica "moderado" só porque ninguém preencheu a probabilidade.
 */
export function classificacaoGeral(c: {
  probabilidade?: number | null; impacto?: number | null;
  riscoFinanceiro?: number | null; riscoJuridico?: number | null; riscoRegulatorio?: number | null;
  riscoOperacional?: number | null; riscoPrazo?: number | null;
}): NivelRisco | null {
  const ordem: NivelRisco[] = ["baixo", "moderado", "alto", "critico"];
  const candidatos = [
    nivelRisco(scoreRisco(c.probabilidade, c.impacto)),
    ...DIMENSOES_RISCO.map(d => nivelDimensao((c as any)[d.campo])),
  ].filter(Boolean) as NivelRisco[];
  if (!candidatos.length) return null;
  return candidatos.reduce((pior, n) => (ordem.indexOf(n) > ordem.indexOf(pior) ? n : pior));
}

/* ── Tempo ────────────────────────────────────────────────────────────────── */

/** Dia de calendário local de um valor DATE ou instante (ver common/datas). */
export function inicioDoDia(valor: Date | string): Date {
  const d = valor instanceof Date ? valor : new Date(valor);
  const coluna = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
  return coluna
    ? new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Dias de `de` até `ate`. Negativo quando `ate` já passou. */
export function diasEntre(de: Date | string, ate: Date | string): number {
  return Math.round((inicioDoDia(ate).getTime() - inicioDoDia(de).getTime()) / 86_400_000);
}

export type FaixaAging = "ate_30" | "31_60" | "61_90" | "acima_90" | "sem_registro";

export const FAIXAS_AGING: readonly { id: FaixaAging; rotulo: string }[] = [
  { id: "ate_30",       rotulo: "Até 30 dias" },
  { id: "31_60",        rotulo: "31 a 60 dias" },
  { id: "61_90",        rotulo: "61 a 90 dias" },
  { id: "acima_90",     rotulo: "Mais de 90 dias" },
  { id: "sem_registro", rotulo: "Sem andamento datado" },
];

export function faixaAging(diasParado: number | null): FaixaAging {
  if (diasParado == null) return "sem_registro";
  if (diasParado <= 30) return "ate_30";
  if (diasParado <= 60) return "31_60";
  if (diasParado <= 90) return "61_90";
  return "acima_90";
}

export function formatarCodigo(sequencial: number): string {
  return `EST-${String(sequencial).padStart(4, "0")}`;
}

/** Normalização para casar variações de digitação ("Alteração parâmetros" = "Alteração de parâmetro"). */
export function chaveNormalizada(texto: string): string {
  return String(texto ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(p => p && !["de", "da", "do", "das", "dos", "e"].includes(p))
    .map(p => (p.length > 3 && p.endsWith("s") ? p.slice(0, -1) : p))
    .join(" ")
    .trim();
}
