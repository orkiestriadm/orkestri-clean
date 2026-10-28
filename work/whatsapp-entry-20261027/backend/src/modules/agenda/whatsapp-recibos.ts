import { execucaoWhats, ExecucaoWhats, protegerMensagem } from "./whatsapp-execucao";

export async function executarComRecibo(prisma: any, identidade: { instancia: string; conversa: string; mensagemId: string }, executar: () => Promise<void>) {
  const s: ExecucaoWhats = { prisma, ...identidade };
  try {
    await execucaoWhats.run(s, executar);
    if (s.userId && s.organizationId && s.contexto) {
      await prisma.$executeRaw`
        INSERT INTO whatsapp_atividade(instancia,mensagem_id,user_id,organization_id,contexto,tipo,acao_util)
        VALUES (${s.instancia},${s.mensagemId},${s.userId},${s.organizationId},${s.contexto},${s.tipo || 'MENSAGEM'},${s.util || null})
        ON CONFLICT DO NOTHING
      `;
    }
  } finally { s.encerrada = true; }
}

/** Registro de execução, não de entrega. Falhas após início exigem revisão:
 * não repetir automaticamente uma operação que pode já ter gravado dados.
 */
export async function executarMensagemUmaVez(
  prisma: any,
  identidade: { instancia: string; conversa: string; mensagemId: string },
  executar: () => Promise<void>,
  payload?: any,
): Promise<"processado" | "duplicado" | "revisar"> {
  const { instancia, conversa, mensagemId } = identidade;
  const protegido = payload ? protegerMensagem(payload) : null;
  const rows = await prisma.$queryRaw`
    INSERT INTO whatsapp_recibos (instancia, conversa, mensagem_id,payload_protegido,efeitos_iniciados)
    VALUES (${instancia}, ${conversa}, ${mensagemId},${protegido},false)
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
    await executarComRecibo(prisma, identidade, executar);
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
