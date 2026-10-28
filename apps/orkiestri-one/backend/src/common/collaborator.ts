/**
 * Utilitários de colaborador compartilhados entre módulos.
 *
 * Contexto: até a Fase 1 do Orkiestri People, todo Collaborator tinha
 * obrigatoriamente um User, e o nome de exibição vinha sempre de `user.nome`.
 * O People Hub precisa representar funcionários sem acesso ao sistema, então o
 * vínculo passa a ser opcional e o colaborador ganha nome próprio.
 *
 * Ver docs/people/ADR-001-modelo-employee.md.
 */

/** Forma mínima aceita pelos helpers — evita acoplar ao tipo gerado do Prisma. */
export type CollaboratorLike = {
  nomeCompleto?: string | null;
  user?: { nome?: string | null } | null;
};

/**
 * Nome de exibição do colaborador.
 *
 * Precedência: nome próprio → nome do usuário vinculado → rótulo neutro.
 * O fallback existe para não quebrar telas com string vazia; um colaborador
 * sem nenhum dos dois é erro de cadastro, não estado normal.
 */
export function collaboratorDisplayName(collab: CollaboratorLike | null | undefined): string {
  if (!collab) return "—";
  const proprio = collab.nomeCompleto?.trim();
  if (proprio) return proprio;
  const doUsuario = collab.user?.nome?.trim();
  if (doUsuario) return doUsuario;
  return "Sem nome";
}

/**
 * Indica se o colaborador tem acesso ao sistema.
 *
 * Importa para relatórios de capacidade: quem não tem login nunca aponta horas,
 * então utilização 0% deve ser exibida como "sem acesso", não como ociosidade.
 */
export function hasSystemAccess(collab: { userId?: string | null } | null | undefined): boolean {
  return !!collab?.userId;
}

/** Ausência no formato mínimo necessário para o cálculo de dias. */
export type AbsenceLike = {
  dataInicio: Date | string;
  dataFim: Date | string;
  collaborator?: { id?: string | null } | null;
};

/**
 * Soma os dias úteis de ausência por colaborador dentro de uma janela.
 *
 * Chaveia pelo id do colaborador — não pelo userId. A ausência pertence ao
 * colaborador, e nem todo colaborador tem usuário: com userId nulo todos
 * cairiam na mesma chave e somariam os dias uns dos outros.
 *
 * Ausências que cruzam a borda da janela são recortadas, não descartadas.
 */
export function absenceDaysByCollaborator(
  absences: AbsenceLike[],
  windowStart: Date,
  windowEnd: Date,
): Map<string, number> {
  const porCollab = new Map<string, number>();

  for (const a of absences) {
    const collaboratorId = a.collaborator?.id;
    if (!collaboratorId) continue; // ausência órfã: ignorar em vez de agrupar em chave vazia

    const start = new Date(Math.max(+windowStart, +new Date(a.dataInicio)));
    const end = new Date(Math.min(+windowEnd, +new Date(a.dataFim)));

    const cur = new Date(start); cur.setHours(0, 0, 0, 0);
    const endDay = new Date(end); endDay.setHours(0, 0, 0, 0);

    let dias = 0;
    while (cur <= endDay) {
      const diaSemana = cur.getDay();
      if (diaSemana !== 0 && diaSemana !== 6) dias++;
      cur.setDate(cur.getDate() + 1);
    }

    porCollab.set(collaboratorId, (porCollab.get(collaboratorId) || 0) + dias);
  }

  return porCollab;
}
