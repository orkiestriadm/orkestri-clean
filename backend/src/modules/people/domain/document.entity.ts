/**
 * Regras de negócio dos documentos do colaborador.
 *
 * Camada de domínio: funções puras, sem Prisma, HTTP ou sistema de arquivos.
 */

import { diasDeCalendario } from "../../../common/datas";

export const DOCUMENT_CATEGORY = {
  IDENTIDADE: "identidade",
  CONTRATO: "contrato",
  CERTIFICADO: "certificado",
  MEDICO: "medico",
  FORMACAO: "formacao",
  OUTRO: "outro",
} as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORY)[keyof typeof DOCUMENT_CATEGORY];
export const DOCUMENT_CATEGORY_VALUES = Object.values(DOCUMENT_CATEGORY) as DocumentCategory[];

export const DOCUMENT_APPROVAL = {
  PENDENTE: "PENDENTE",
  APROVADO: "APROVADO",
  REJEITADO: "REJEITADO",
  ARQUIVADO: "ARQUIVADO",
} as const;

export type DocumentApproval = (typeof DOCUMENT_APPROVAL)[keyof typeof DOCUMENT_APPROVAL];
export const DOCUMENT_APPROVAL_VALUES = Object.values(DOCUMENT_APPROVAL) as DocumentApproval[];

/**
 * Categorias que exigem sigilo reforçado.
 *
 * Documento médico revela condição de saúde — dado sensível sob a LGPD. Gestor
 * enxerga que existe, mas não abre: só RH e o próprio colaborador.
 * Ver PEOPLE_PERMISSIONS.md §19 e §21.
 */
const CATEGORIAS_SENSIVEIS: readonly string[] = [DOCUMENT_CATEGORY.MEDICO];

export function isCategoriaSensivel(categoria: string): boolean {
  return CATEGORIAS_SENSIVEIS.includes(categoria);
}

/**
 * Transições de aprovação.
 *
 * ARQUIVADO é terminal: documento arquivado não volta ao fluxo — envia-se um
 * novo. REJEITADO permite reenvio via novo upload, não por mudança de estado.
 */
const TRANSICOES: Readonly<Record<DocumentApproval, readonly DocumentApproval[]>> = Object.freeze({
  PENDENTE:  ["APROVADO", "REJEITADO", "ARQUIVADO"],
  APROVADO:  ["ARQUIVADO"],
  REJEITADO: ["ARQUIVADO"],
  ARQUIVADO: [],
});

export function canApprovalTransitionTo(de: DocumentApproval, para: DocumentApproval): boolean {
  if (de === para) return true;
  return TRANSICOES[de]?.includes(para) ?? false;
}

export function allowedApprovalTransitions(de: DocumentApproval): readonly DocumentApproval[] {
  return TRANSICOES[de] ?? [];
}

/** Rejeição sem motivo deixa o colaborador sem saber o que corrigir. */
export function exigeMotivo(para: DocumentApproval): boolean {
  return para === DOCUMENT_APPROVAL.REJEITADO;
}

export type SituacaoValidade = "sem_validade" | "vigente" | "vence_em_breve" | "vencido";

/** Janela padrão de alerta de vencimento (PEOPLE_ANALYTICS_SPECIFICATION.md §7). */
export const DIAS_ALERTA_VENCIMENTO = 30;

/**
 * Classifica a validade de um documento.
 *
 * Compara por dia, não por instante: um documento que vence hoje está vigente
 * até o fim do dia, e não "vencido" porque já passou do meio-dia.
 */
export function situacaoValidade(
  dataValidade: Date | string | null | undefined,
  hoje: Date = new Date(),
  diasAlerta: number = DIAS_ALERTA_VENCIMENTO,
): SituacaoValidade {
  if (!dataValidade) return "sem_validade";

  const validade = new Date(dataValidade);
  if (Number.isNaN(validade.getTime())) return "sem_validade";

  // `dataValidade` vem de coluna DATE (meia-noite UTC); recortar o dia com
  // `setHours(0,0,0,0)` a recuava um dia em UTC-3, e documento válido até hoje
  // aparecia vencido. Ver a nota em common/datas.ts.
  const diffDias = diasDeCalendario(hoje, validade);

  if (diffDias < 0) return "vencido";
  if (diffDias <= diasAlerta) return "vence_em_breve";
  return "vigente";
}

/**
 * Taxa de conformidade documental.
 *
 * Fórmula de PEOPLE_ANALYTICS_SPECIFICATION.md §7:
 * aprovados / exigidos × 100. Sem exigências, conformidade é 100% — não zero,
 * que sugeriria problema onde não há.
 */
export function taxaConformidade(aprovados: number, exigidos: number): number {
  if (exigidos <= 0) return 100;
  return Math.round((aprovados / exigidos) * 100);
}

/**
 * Tipos de arquivo aceitos.
 *
 * Lista de permissão, não de bloqueio: bloquear extensões perigosas é jogo de
 * gato e rato. Sem SVG — pode carregar script e é servido como imagem.
 */
const MIMES_ACEITOS: readonly string[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const TAMANHO_MAXIMO_BYTES = 15 * 1024 * 1024; // 15 MB

export function isMimeAceito(mime: string | undefined | null): boolean {
  return !!mime && MIMES_ACEITOS.includes(mime);
}

export function mimesAceitos(): readonly string[] {
  return MIMES_ACEITOS;
}

/**
 * Nome de arquivo seguro para gravar em disco.
 *
 * O nome enviado pelo cliente nunca vira caminho: `../../etc/passwd` ou nome com
 * separador escapariam do diretório da organização. Guardamos o nome original
 * só como metadado, para exibir e para o download.
 */
export function nomeSeguroDeArquivo(nomeOriginal: string, id: string): string {
  const extensao = (nomeOriginal.match(/\.([A-Za-z0-9]{1,8})$/)?.[1] ?? "bin").toLowerCase();
  return `${id}.${extensao}`;
}
