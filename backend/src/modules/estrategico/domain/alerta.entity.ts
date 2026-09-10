/**
 * Régua de alertas do Strategy — regras puras.
 *
 * Mesmas três garantias do motor do Compliance:
 *
 *  1. NÃO PERDE MARCO. Devolve o limiar mais recentemente cruzado, não o que
 *     casa exatamente com hoje: automação que ficou dois dias parada (deploy)
 *     ainda avisa o "faltam 7 dias" ao voltar, no dia 5.
 *  2. NÃO REPETE. A chave junta caso/tarefa + prazo + marco + destinatário. Se
 *     o prazo muda, o ciclo recomeça — é outro compromisso.
 *  3. NÃO INVENTA DESTINATÁRIO. Só quem está nomeado; sem ninguém, não avisa.
 */

/**
 * Marco vigente para um prazo.
 *
 * `antecedencias` = [15, 7, 3, 0]. Com 5 dias restantes, o marco é "7"; no dia
 * do vencimento, "0"; depois, "vencido". Acima da maior antecedência, nenhum.
 */
export function marcoPrazo(diasRestantes: number, antecedencias: number[]): string | null {
  if (diasRestantes < 0) return "vencido";
  const cruzados = [...antecedencias].filter(a => a >= 0 && diasRestantes <= a).sort((a, b) => a - b);
  return cruzados.length ? String(cruzados[0]) : null;
}

/**
 * Degrau de escalonamento de um assunto crítico vencido.
 *
 *   1 → responsável pela próxima ação
 *   2 → + responsável operacional
 *   3 → + responsável executivo + gestores configurados
 *
 * Com `diasEscalonamento` = 5: vencido há 5 dias é degrau 1, 10 é 2, 15+ é 3.
 */
export function degrauEscalonamento(diasAtraso: number, diasEscalonamento: number): 0 | 1 | 2 | 3 {
  if (diasEscalonamento <= 0 || diasAtraso < diasEscalonamento) return 0;
  return Math.min(3, Math.floor(diasAtraso / diasEscalonamento)) as 1 | 2 | 3;
}

/** Faixa de aging cruzada (30/60/90 por padrão). */
export function marcoAging(diasParado: number, limites: number[] = [30, 60, 90]): number | null {
  const cruzados = limites.filter(l => diasParado >= l).sort((a, b) => b - a);
  return cruzados.length ? cruzados[0] : null;
}

/**
 * Ciclo de follow-up de uma dependência externa.
 *
 * Aguardando há 32 dias com ciclo de 30 → ciclo 1; há 61 → ciclo 2. Cada ciclo
 * gera UMA tarefa de cobrança; a chave impede a segunda.
 */
export function cicloFollowUp(diasAguardando: number, diasFollowUp: number): number {
  if (diasFollowUp <= 0 || diasAguardando < diasFollowUp) return 0;
  return Math.floor(diasAguardando / diasFollowUp);
}

const iso = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString().slice(0, 10) : "sem-data";

export const chaves = {
  acao: (casoId: string, prazo: Date | string, marco: string, userId: string) =>
    `acao:${casoId}:${iso(prazo)}:${marco}:${userId}`,
  tarefa: (tarefaId: string, prazo: Date | string, marco: string, userId: string) =>
    `tarefa:${tarefaId}:${iso(prazo)}:${marco}:${userId}`,
  aging: (casoId: string, ultimaMov: Date | string, marco: number, userId: string) =>
    `aging:${casoId}:${iso(ultimaMov)}:${marco}:${userId}`,
  escalonamento: (casoId: string, prazo: Date | string, degrau: number, userId: string) =>
    `escala:${casoId}:${iso(prazo)}:${degrau}:${userId}`,
  followUp: (dependenciaId: string, ciclo: number) => `followup:${dependenciaId}:${ciclo}`,
};

export function textoMarco(marco: string): string {
  if (marco === "vencido") return "venceu";
  if (marco === "0") return "vence hoje";
  return `vence em até ${marco} dias`;
}
