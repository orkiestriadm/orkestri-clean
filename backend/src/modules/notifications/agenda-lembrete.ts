/**
 * Regras de quando avisar um compromisso da agenda. Sem Prisma e sem Nest, para
 * testar a conta de horário sem subir nada.
 */

/** Regra usada quando a organização não tem nenhuma linha em `alert_configs`. */
export const LEMBRETE_PADRAO = {
  id: "d15",
  minutos: 15,
  ativo: true,
  emoji: "⏰",
  titulo: "Lembrete — 15 minutos",
  mensagem: "Seu compromisso começa em 15 minutos:\n\n📅 *{evento}*\n🕐 {horario}\n\n🔗 {url}",
};

/** Tolerância da janela: o agendador roda a cada 30 s. */
export const JANELA_MINUTOS = 2.5;

/** Hora local (America/Sao_Paulo) do aviso de compromisso de dia inteiro. */
export const HORA_AVISO_DIA_INTEIRO = 8;

// Brasil sem horário de verão desde 2019: o deslocamento é fixo.
const OFFSET_SP_HORAS = 3;

/**
 * Regras de uma organização. Quem tem linhas em `alert_configs` usa só as
 * ativas — inclusive nenhuma, se o administrador desligou todas. Quem não tem
 * linha nenhuma usa o padrão de 15 minutos.
 */
export function regrasDaOrganizacao<T extends { organizationId: string; ativo: boolean }>(
  todas: T[],
  organizationId: string,
): Array<T | typeof LEMBRETE_PADRAO> {
  const daOrg = todas.filter(c => c.organizationId === organizationId);
  if (!daOrg.length) return [LEMBRETE_PADRAO];
  return daOrg.filter(c => c.ativo);
}

/**
 * Momento do aviso de um compromisso de dia inteiro: 08:00 de São Paulo no dia
 * do compromisso. O dia vem de dois formatos: o do Outlook grava meia-noite UTC
 * ("2026-09-20T00:00Z"), e avisar "na hora" disso seria às 21h da véspera; o
 * criado aqui grava a meia-noite local (03:00 UTC). Nos dois casos o dia é o
 * mesmo — o que muda é de onde lê-lo.
 */
export function momentoAvisoDiaInteiro(inicio: Date): Date {
  const meiaNoiteUtc = inicio.getUTCHours() === 0 && inicio.getUTCMinutes() === 0;
  const base = meiaNoiteUtc ? inicio : new Date(inicio.getTime() - OFFSET_SP_HORAS * 3600_000);
  return new Date(Date.UTC(
    base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(),
    HORA_AVISO_DIA_INTEIRO + OFFSET_SP_HORAS, 0, 0,
  ));
}

/** Está na hora do aviso de dia inteiro? (janela de alguns minutos após as 08:00) */
export function horaDoAvisoDiaInteiro(inicio: Date, agora: Date): boolean {
  const alvo = momentoAvisoDiaInteiro(inicio).getTime();
  const t = agora.getTime();
  return t >= alvo && t < alvo + JANELA_MINUTOS * 2 * 60_000;
}

/** Só manda WhatsApp para número confirmado pelo código — número digitado errado não recebe. */
export function recebeWhatsApp(profile?: { whatsapp?: string | null; whatsappVerificado?: boolean | null } | null): boolean {
  return !!profile?.whatsapp && profile.whatsappVerificado === true;
}
