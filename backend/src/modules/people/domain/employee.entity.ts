/**
 * Regras de negócio do colaborador.
 *
 * Camada de domínio: não conhece Prisma, HTTP nem NestJS. Tudo aqui é função
 * pura sobre dados simples, para que a regra possa ser testada e reutilizada
 * sem subir a aplicação. Ver BACKEND.md §5.
 */

export const EMPLOYEE_STATUS = {
  ATIVO: "ATIVO",
  INATIVO: "INATIVO",
  AFASTADO: "AFASTADO",
  DESLIGADO: "DESLIGADO",
  SUSPENSO: "SUSPENSO",
} as const;

export type EmployeeStatus = (typeof EMPLOYEE_STATUS)[keyof typeof EMPLOYEE_STATUS];

export const EMPLOYEE_STATUS_VALUES = Object.values(EMPLOYEE_STATUS) as EmployeeStatus[];

/**
 * Transições permitidas.
 *
 * DESLIGADO é terminal: readmissão é uma admissão nova, com novo vínculo e
 * nova matrícula — não uma volta de status. Tratar como transição apagaria a
 * fronteira entre dois contratos distintos no histórico.
 */
const TRANSICOES: Readonly<Record<EmployeeStatus, readonly EmployeeStatus[]>> = Object.freeze({
  ATIVO:     ["INATIVO", "AFASTADO", "SUSPENSO", "DESLIGADO"],
  INATIVO:   ["ATIVO", "DESLIGADO"],
  AFASTADO:  ["ATIVO", "DESLIGADO"],
  SUSPENSO:  ["ATIVO", "DESLIGADO"],
  DESLIGADO: [],
});

export function isEmployeeStatus(valor: unknown): valor is EmployeeStatus {
  return typeof valor === "string" && valor in EMPLOYEE_STATUS;
}

export function canTransitionTo(de: EmployeeStatus, para: EmployeeStatus): boolean {
  if (de === para) return true; // idempotente: reaplicar o mesmo status não é erro
  return TRANSICOES[de]?.includes(para) ?? false;
}

export function allowedTransitionsFrom(de: EmployeeStatus): readonly EmployeeStatus[] {
  return TRANSICOES[de] ?? [];
}

/** `ativo: boolean` legado, derivado do status canônico. */
export function isAtivo(status: EmployeeStatus): boolean {
  return status === EMPLOYEE_STATUS.ATIVO;
}

/** Um colaborador desligado não entra em cálculo de capacidade nem em alocação. */
export function contaParaCapacidade(status: EmployeeStatus): boolean {
  return status === EMPLOYEE_STATUS.ATIVO;
}

/**
 * O colaborador precisa de identidade exibível.
 *
 * Sem usuário vinculado, o nome próprio é obrigatório — senão não há como
 * apresentá-lo em lista, relatório ou notificação.
 */
export function temIdentidadeValida(dados: {
  userId?: string | null;
  nomeCompleto?: string | null;
}): boolean {
  return !!dados.userId || !!dados.nomeCompleto?.trim();
}

/** Desligamento exige data; sem ela o histórico e os relatórios ficam ambíguos. */
export function exigeDataDesligamento(status: EmployeeStatus): boolean {
  return status === EMPLOYEE_STATUS.DESLIGADO;
}

/**
 * Indica se atribuir `novoGestorId` deixaria a hierarquia em estado cíclico.
 *
 * Um ciclo trava a resolução de escopo do gestor (PeopleScopeService), que
 * caminha a árvore — sem esta checagem, a travessia não teria fim.
 *
 * Também devolve `true` quando o ciclo JÁ existe no ramo de destino, ainda que
 * a atribuição em si não o crie. É deliberado: pendurar mais gente num ramo
 * corrompido agrava o problema, e recusar força a correção do dado. A mensagem
 * de erro ao usuário cobre as duas situações.
 */
export function ficariaComCicloDeGestao(
  colaboradorId: string,
  novoGestorId: string | null | undefined,
  gestorDe: ReadonlyMap<string, string | null>,
): boolean {
  if (!novoGestorId) return false;
  if (novoGestorId === colaboradorId) return true;

  const visitados = new Set<string>([colaboradorId]);
  let atual: string | null | undefined = novoGestorId;

  while (atual) {
    if (visitados.has(atual)) return true;
    visitados.add(atual);
    atual = gestorDe.get(atual) ?? null;
  }
  return false;
}
