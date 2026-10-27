/** Confirmações do mesmo cadastro compartilham o lock da linha no PostgreSQL.
 * O callback deve usar apenas tx. Envio de mensagens deve ocorrer após o commit.
 * Não substitui a deduplicação de eventos ou unicidade entre cadastros distintos.
 */
export async function concluirCadastroAtomico<T>(
  prisma: any,
  cadastroId: string,
  provisionar: (tx: any, cadastro: any, respostas: { email: string; empresa: string }) => Promise<T>,
): Promise<{ status: "criado"; cadastro: any; conta: T } | { status: "ja_concluido" | "indisponivel" }> {
  return prisma.$transaction(async (tx: any) => {
    const claim = await tx.cadastroWhatsapp.updateMany({
      where: { id: cadastroId, status: { in: ["AGUARDANDO", "EM_CONVERSA"] },
        etapa: "CONFIRMACAO", expiraEm: { gt: new Date() } },
      data: { status: "EM_CONVERSA" },
    });
    const cadastro = await tx.cadastroWhatsapp.findUnique({ where: { id: cadastroId } });
    if (claim.count !== 1) return { status: cadastro?.status === "CONCLUIDO" ? "ja_concluido" : "indisponivel" };
    const respostas = JSON.parse(cadastro.respostas || "{}");
    if (!cadastro.nome || !cadastro.cpf || !respostas.email || !respostas.empresa) {
      throw new Error("Cadastro incompleto: revise os dados antes de confirmar.");
    }
    const conta = await provisionar(tx, cadastro, respostas);
    const final = await tx.cadastroWhatsapp.findUnique({ where: { id: cadastroId } });
    if (final?.status !== "CONCLUIDO" || !final.userId || !final.organizationId) {
      throw new Error("Provisionamento não concluiu o cadastro.");
    }
    return { status: "criado", cadastro, conta };
  }, { isolationLevel: "ReadCommitted", maxWait: 10000, timeout: 30000 });
}
