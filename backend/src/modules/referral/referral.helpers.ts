import { createHash } from "crypto";
import { MARCA } from "../../common/marca";

/**
 * Prefixo do código de indicação, derivado da marca: "Orkiestri" → `ORK`,
 * "HUB Triunfo Transbrasiliana" → `HUB`.
 *
 * O prefixo é a única parte do código que o usuário LÊ como nome de produto, e
 * era a última amarra visível com a marca do Orkiestri num servidor
 * white-label. Na linha do Orkiestri ele continua `ORK` — nada muda lá.
 */
export const PREFIXO_INDICACAO =
  MARCA.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "REF";

/**
 * Prefixos aceitos na ENTRADA. `ORK` fica aqui para sempre.
 *
 * Trocar o prefixo NÃO invalida código nenhum — e é por causa desta lista.
 * O código de verdade são os 6 caracteres do hash, que dependem só do id do
 * usuário; o prefixo é descartado na comparação. Sem aceitar o `ORK` antigo,
 * porém, todo código já compartilhado por aí pararia de funcionar no dia da
 * troca, e ninguém ligaria uma coisa à outra.
 */
export const PREFIXOS_INDICACAO = Array.from(new Set([PREFIXO_INDICACAO, "ORK"]));

/** O código em si: 6 caracteres hexadecimais. */
const CODIGO_RE = /^[0-9A-F]{6}$/;

/** O texto parece um código de indicação? Usado para aceitar o código solto,
 *  sem a palavra INDICACAO na frente. */
export function pareceCodigoIndicacao(texto: string): boolean {
  return new RegExp(`^(?:${PREFIXOS_INDICACAO.join("|")})-?[a-z0-9]{4,10}$`, "i").test((texto || "").trim());
}

// Código de indicação do usuário — DERIVADO do id (não há tabela de códigos).
// Salt próprio para não colidir com o código de vínculo do WhatsApp.
export function codigoIndicacao(userId: string): string {
  // ⚠️ O `secret` entra no hash: mexer nele muda o código de TODO MUNDO, e aí
  // sim invalida o que já foi compartilhado. Não é lugar de marca.
  const secret = process.env.WHATSAPP_INBOUND_SECRET || process.env.JWT_SECRET || "orkiestri";
  return PREFIXO_INDICACAO + "-" + createHash("sha256").update(userId + "|indicacao|" + secret).digest("hex").slice(0, 6).toUpperCase();
}

const norm = (c: string) => {
  const bruto = (c || "").trim().toUpperCase().replace(/\s+/g, "");
  for (const p of PREFIXOS_INDICACAO) {
    const sem = bruto.replace(new RegExp(`^${p}-?`), "");
    // Só aceita a remoção se o que sobra É um código. Sem esta guarda, uma
    // marca cujas três primeiras letras fossem hexadecimais (ex.: "ABC")
    // comeria o começo de um código legítimo e ninguém acharia o motivo.
    if (sem !== bruto && CODIGO_RE.test(sem)) return sem;
  }
  return bruto;
};

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
    `🎉 *Bem-vindo(a) ao ${MARCA}!*\n\n` +
    `Você entrou pela indicação de *${indicadorNome}* — quando você efetivar sua assinatura, ele(a) ganha uma comissão. 🙌\n\n` +
    `E você também pode ganhar! O seu código de indicação é *${meuCodigo}*.\n\n` +
    "💰 A cada pessoa que assinar usando o seu código, você recebe *R$ 5,00*. Indicou 200? São *R$ 1.000*.\n\n" +
    `Pegue o seu código no seu *Perfil* e compartilhe. Chame gente para o ${MARCA}! 🚀`
  );
}
