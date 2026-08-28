import { createHash } from "crypto";

// Código de indicação do usuário — DERIVADO do id (não há tabela de códigos).
// Salt próprio para não colidir com o código de vínculo do WhatsApp.
export function codigoIndicacao(userId: string): string {
  const secret = process.env.WHATSAPP_INBOUND_SECRET || process.env.JWT_SECRET || "orkiestri";
  return "ORK-" + createHash("sha256").update(userId + "|indicacao|" + secret).digest("hex").slice(0, 6).toUpperCase();
}

const norm = (c: string) => (c || "").trim().toUpperCase().replace(/^ORK-?/, "");

/**
 * Registra a indicação do indicado (best-effort — nunca quebra o cadastro).
 * Resolve o código -> indicador, valida autoindicação e 1-por-indicado.
 * Retorna o NOME do indicador em caso de sucesso (para a msg de ativação), ou null.
 */
export async function registrarIndicacao(prisma: any, codigoRaw: string, indicadoUserId: string): Promise<string | null> {
  try {
    const alvo = norm(codigoRaw);
    if (!alvo) return null;
    const jaTem = await prisma.referral.findUnique({ where: { indicadoUserId } });
    if (jaTem) return null; // 1 indicação por indicado
    const users = await prisma.user.findMany({ where: { ativo: true }, select: { id: true, nome: true } });
    const indicador = users.find((u: any) => norm(codigoIndicacao(u.id)) === alvo);
    if (!indicador || indicador.id === indicadoUserId) return null; // inválido ou autoindicação
    await prisma.referral.create({
      data: {
        codigoUsado: codigoIndicacao(indicador.id),
        indicadorUserId: indicador.id,
        indicadoUserId,
        status: "PENDENTE",
      },
    });
    return indicador.nome || "seu contato";
  } catch {
    return null;
  }
}

// Mensagem de ativação enviada ao INDICADO no WhatsApp — confirma o vínculo e já
// convida a pessoa a indicar (o pitch de "ganhe R$5 por indicação").
export function montarMensagemAtivacao(indicadorNome: string, meuCodigo: string): string {
  return (
    "🎉 *Bem-vindo(a) ao Orkiestri!*\n\n" +
    `Você entrou pela indicação de *${indicadorNome}* — quando você efetivar sua assinatura, ele(a) ganha uma comissão. 🙌\n\n` +
    `E você também pode ganhar! O seu código de indicação é *${meuCodigo}*.\n\n` +
    "💰 A cada pessoa que assinar usando o seu código, você recebe *R$ 5,00*. Indicou 200? São *R$ 1.000*.\n\n" +
    "Pegue o seu código no seu *Perfil* e compartilhe. Chame gente para o Orkiestri! 🚀"
  );
}
