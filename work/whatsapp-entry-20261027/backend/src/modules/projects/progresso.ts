/**
 * Progresso e conclusão do projeto — regras puras, sem banco.
 *
 * Arquivo à parte para poderem ser testadas sem carregar o módulo inteiro (que
 * puxa notificação, e-mail e WhatsApp).
 */

// Progresso PONDERADO pelo estagio da tarefa (nao so concluidas), para a barra
// "andar" conforme o trabalho avanca. Canceladas saem da conta (nao travam 100%).
const PESO_STATUS: Record<string, number> = { A_FAZER: 0, EM_ANDAMENTO: 0.5, EM_REVISAO: 0.8, CONCLUIDA: 1 };

const ativasDe = (tasks: { status: string }[]) => tasks.filter(t => t.status !== "CANCELADA");

/**
 * Concluído = TODA tarefa ativa em Concluída, e pelo menos uma.
 *
 * Não se deriva do percentual: com 100 tarefas, 99 concluídas e uma em revisão,
 * o arredondamento já dá 100% — e o projeto sairia da fila com trabalho aberto.
 */
export function projetoConcluido(tasks: { status: string }[]): boolean {
  const ativas = ativasDe(tasks);
  return ativas.length > 0 && ativas.every(t => t.status === "CONCLUIDA");
}

export function calcPct(tasks: { status: string }[]): number {
  const ativas = ativasDe(tasks);
  if (!ativas.length) return 0;
  const soma = ativas.reduce((acc, t) => acc + (PESO_STATUS[t.status] ?? 0), 0);
  const pct = Math.round((soma / ativas.length) * 100);
  // 100% na barra é a promessa de "acabou": só aparece quando acabou de fato.
  return pct >= 100 && !projetoConcluido(tasks) ? 99 : pct;
}

/**
 * O que fazer com a fila do projeto depois de uma mudança nas tarefas.
 *
 * "concluir" leva para Projetos Concluídos; "reabrir" devolve à fila — escolha do
 * usuário em 11/09/2026: tarefa que sai de Concluída traz o projeto de volta.
 */
export function transicaoDeConclusao(concluido: boolean, concluidoEm: Date | null): "concluir" | "reabrir" | null {
  if (concluido && !concluidoEm) return "concluir";
  if (!concluido && concluidoEm) return "reabrir";
  return null;
}
