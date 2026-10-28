/** Registro de execução, não de entrega. Falhas após início exigem revisão:
 * não repetir automaticamente uma operação que pode já ter gravado dados.
 */
export async function executarMensagemUmaVez(
  prisma: any,
  identidade: { instancia: string; conversa: string; mensagemId: string },
  executar: () => Promise<void>,
): Promise<"processado" | "duplicado" | "revisar"> {
  const { instancia, conversa, mensagemId } = identidade;
  const rows = await prisma.$queryRaw`
    INSERT INTO whatsapp_recibos (instancia, conversa, mensagem_id)
    VALUES (${instancia}, ${conversa}, ${mensagemId})
    ON CONFLICT DO NOTHING RETURNING mensagem_id
  `;
  if (!rows.length) {
    // Um processo interrompido pode deixar recibo aberto. Não executamos de
    // novo: encaminhamos para revisão sem arriscar duplicar a operação.
    await prisma.$executeRaw`
      UPDATE whatsapp_recibos SET estado = 'REVISAR', atualizado_em = CURRENT_TIMESTAMP
      WHERE instancia = ${instancia} AND conversa = ${conversa} AND mensagem_id = ${mensagemId}
        AND estado = 'PROCESSANDO' AND criado_em < CURRENT_TIMESTAMP - INTERVAL '10 minutes'
    `;
    return "duplicado";
  }
  try {
    await executar();
    await prisma.$executeRaw`
      UPDATE whatsapp_recibos SET estado = 'PROCESSADO', atualizado_em = CURRENT_TIMESTAMP
      WHERE instancia = ${instancia} AND conversa = ${conversa} AND mensagem_id = ${mensagemId}
    `;
    return "processado";
  } catch {
    await prisma.$executeRaw`
      UPDATE whatsapp_recibos SET estado = 'REVISAR', atualizado_em = CURRENT_TIMESTAMP
      WHERE instancia = ${instancia} AND conversa = ${conversa} AND mensagem_id = ${mensagemId}
    `;
    return "revisar";
  }
}
