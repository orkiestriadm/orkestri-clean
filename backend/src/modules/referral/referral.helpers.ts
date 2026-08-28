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
 */
export async function registrarIndicacao(prisma: any, codigoRaw: string, indicadoUserId: string): Promise<boolean> {
  try {
    const alvo = norm(codigoRaw);
    if (!alvo) return false;
    const jaTem = await prisma.referral.findUnique({ where: { indicadoUserId } });
    if (jaTem) return false; // 1 indicação por indicado
    const users = await prisma.user.findMany({ where: { ativo: true }, select: { id: true } });
    const indicador = users.find((u: any) => norm(codigoIndicacao(u.id)) === alvo);
    if (!indicador || indicador.id === indicadoUserId) return false; // inválido ou autoindicação
    await prisma.referral.create({
      data: {
        codigoUsado: codigoIndicacao(indicador.id),
        indicadorUserId: indicador.id,
        indicadoUserId,
        status: "PENDENTE",
      },
    });
    return true;
  } catch {
    return false;
  }
}
