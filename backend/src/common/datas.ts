/**
 * Formatação de data para texto legível.
 *
 * Coluna DATE não tem fuso — 29 de julho é 29 de julho —, mas o Prisma a
 * devolve como `Date` em meia-noite UTC. Formatar isso com
 * `toLocaleDateString("pt-BR")` num processo em America/Sao_Paulo (UTC-3)
 * recua um dia: vigência de salário, admissão e período de férias apareciam
 * todos com a data anterior à informada.
 *
 * A saída deste módulo alimenta descrição de histórico, mensagem de erro e
 * exportação — texto que o usuário compara com o que digitou.
 */

/** dd/mm/aaaa a partir dos componentes UTC, sem conversão de fuso. */
export function dataBR(valor: Date | string | null | undefined): string {
  if (!valor) return "";

  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return "";

  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${d.getUTCFullYear()}`;
}
