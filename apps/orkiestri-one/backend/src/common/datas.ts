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

/**
 * O mesmo dia do calendário, à meia-noite LOCAL — base de toda conta de prazo.
 *
 * O `dataBR` acima resolveu a EXIBIÇÃO da data; a ARITMÉTICA continuou errada.
 * Quatro lugares (checklist, férias, documento, certificação) implementavam
 * cada um o seu `inicioDoDia` com `setHours(0,0,0,0)`. Sobre uma coluna DATE,
 * que chega como meia-noite UTC, isso recua um dia num processo em UTC-3 — e
 * todo prazo saía um dia adiantado: item que vence hoje aparecia atrasado
 * desde ontem, certificação válida até hoje contava como vencida.
 *
 * A distinção é pelo horário: o Prisma devolve coluna DATE sempre em meia-noite
 * UTC exata, então esse valor tem o dia certo nos componentes UTC. Qualquer
 * outro horário é um instante de verdade — `new Date()`, um `criadoEm` — e aí
 * o dia certo é o local.
 *
 * A ambiguidade real é de 1 ms por dia: um instante que caia exatamente em
 * meia-noite UTC é lido como coluna DATE. Nenhuma decisão do sistema depende
 * dessa precisão, e o custo de errar é o mesmo um dia que já existia.
 */
export function diaLocal(valor: Date | string): Date {
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return d;

  const veioDeColunaDate =
    d.getUTCHours() === 0 && d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;

  return veioDeColunaDate
    ? new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Diferença em dias inteiros de calendário. Negativo quando `ate` já passou. */
export function diasDeCalendario(de: Date | string, ate: Date | string): number {
  return Math.round((diaLocal(ate).getTime() - diaLocal(de).getTime()) / 86_400_000);
}

/** dd/mm/aaaa a partir dos componentes UTC, sem conversão de fuso. */
export function dataBR(valor: Date | string | null | undefined): string {
  if (!valor) return "";

  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return "";

  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${d.getUTCFullYear()}`;
}
