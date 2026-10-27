import { createHmac, timingSafeEqual } from "crypto";

// Token do link de pagamento.
//
// A pessoa com o acesso vencido NÃO consegue entrar no sistema — o login barra
// antes de emitir sessão. Então a página de pagamento não pode exigir login, e
// o link que vai no WhatsApp precisa se identificar sozinho.
//
// O token é `<userId em base64url>.<assinatura>`: carrega quem é (resolução
// direta, sem varrer a tabela de usuários a cada acesso) e prova que foi este
// servidor que emitiu. Não é segredo eterno nem credencial de sessão: só abre a
// tela de pagamento daquela conta.

function segredo(): string {
  return process.env.WHATSAPP_INBOUND_SECRET || process.env.JWT_SECRET || "orkiestri";
}

function assinar(userId: string): string {
  return createHmac("sha256", segredo()).update(userId + "|checkout").digest("hex").slice(0, 32);
}

function iguais(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function tokenCheckout(userId: string): string {
  return `${Buffer.from(userId, "utf8").toString("base64url")}.${assinar(userId)}`;
}

/** Devolve o userId quando o token é nosso; null em qualquer outro caso. */
export function lerTokenCheckout(token: string | undefined | null): string | null {
  const partes = (token || "").split(".");
  if (partes.length !== 2) return null;
  const [b64, assinatura] = partes;
  let userId: string;
  try {
    userId = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!userId) return null;
  return iguais(assinar(userId), assinatura) ? userId : null;
}

/** O endereço que vai na mensagem do WhatsApp e no e-mail. */
export function urlCheckout(appUrl: string, userId: string): string {
  return `${appUrl.replace(/\/+$/, "")}/assinatura/${tokenCheckout(userId)}`;
}
