import { createHmac, timingSafeEqual } from "crypto";

// Conferência da assinatura do webhook do Mercado Pago.
//
// Por que isso existe: o webhook de billing que já estava no repositório
// RECEBIA o `x-signature` e nunca o usava, e o `MP_WEBHOOK_SECRET` não era lido
// em lugar nenhum. Quem descobrisse a URL marcava mensalidade como paga.
//
// E conferir não é imprimir: assinatura inválida ABORTA o processamento. Uma
// checagem que não trava não é verificação.
//
// Como o MP assina (padrão dele):
//   header  x-signature: ts=<epoch_segundos>,v1=<hmac_hex>
//   header  x-request-id: <uuid>
//   manifest "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
//   v1 = HMAC-SHA256(manifest, MP_WEBHOOK_SECRET) em hex
//
// O `data.id` é o da QUERY STRING da notificação (`?data.id=...`), não o do
// corpo: é esse que o MP usou para montar o manifest.

/**
 * Idade máxima da notificação. O MP reenvia em minutos, então uma hora é folga
 * de sobra para retentativa e para relógio fora de hora — e ainda limita o
 * reaproveitamento de uma notificação antiga capturada.
 *
 * Não é a defesa principal: repetição de notificação VÁLIDA é inofensiva aqui,
 * porque aplicar pagamento é idempotente (`validadeConcedidaAte`).
 */
export const IDADE_MAXIMA_S = 60 * 60;

// `motivo` e `ts` aparecem nas duas pernas (uma delas sempre `undefined`) de
// propósito: este projeto compila sem `strictNullChecks`, e lá o estreitamento
// por `if (!r.valida)` não garante acesso ao campo da outra perna.
export type ResultadoAssinatura =
  | { valida: true; ts: number; motivo?: undefined }
  | { valida: false; motivo: string; ts?: undefined };

/** Lê `ts=...,v1=...` em qualquer ordem, tolerando espaços. */
export function lerXSignature(header: string | undefined | null): { ts: string; v1: string } | null {
  if (!header) return null;
  const partes = header.split(",");
  let ts: string | undefined;
  let v1: string | undefined;
  for (const p of partes) {
    const [chave, ...resto] = p.split("=");
    const valor = resto.join("=").trim();
    const k = chave.trim();
    if (k === "ts") ts = valor;
    else if (k === "v1") v1 = valor;
  }
  return ts && v1 ? { ts, v1 } : null;
}

function iguais(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // timingSafeEqual exige mesmo tamanho; tamanho diferente já é diferente.
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Confere a assinatura. `dataId` vem da query string da notificação.
 *
 * O MP documenta que ids alfanuméricos entram no manifest em minúsculas; ids
 * numéricos ficam como estão. `toLowerCase()` cobre os dois casos sem exceção.
 */
export function conferirAssinatura(p: {
  xSignature: string | undefined | null;
  xRequestId: string | undefined | null;
  dataId: string | undefined | null;
  secret: string | undefined | null;
  agora?: Date;
}): ResultadoAssinatura {
  if (!p.secret) return { valida: false, motivo: "MP_WEBHOOK_SECRET não configurado" };
  if (!p.dataId) return { valida: false, motivo: "notificação sem data.id na query" };

  const assinatura = lerXSignature(p.xSignature);
  if (!assinatura) return { valida: false, motivo: "x-signature ausente ou malformado" };

  const ts = Number(assinatura.ts);
  if (!Number.isFinite(ts)) return { valida: false, motivo: "ts inválido no x-signature" };

  const agoraS = Math.floor((p.agora?.getTime() ?? Date.now()) / 1000);
  if (Math.abs(agoraS - ts) > IDADE_MAXIMA_S) {
    return { valida: false, motivo: `notificação fora da janela (${agoraS - ts}s de diferença)` };
  }

  const manifest = `id:${String(p.dataId).toLowerCase()};request-id:${p.xRequestId || ""};ts:${assinatura.ts};`;
  const esperado = createHmac("sha256", p.secret).update(manifest).digest("hex");

  if (!iguais(esperado, assinatura.v1.toLowerCase())) {
    return { valida: false, motivo: "assinatura não confere" };
  }
  return { valida: true, ts };
}

export type TipoNotificacao = "payment" | "subscription_preapproval" | "subscription_authorized_payment";

/**
 * Que tipo de notificação é. O webhook antigo tratava só `payment` e
 * `subscription_preapproval` — e justamente ignorava
 * `subscription_authorized_payment`, que é o que chega a cada cobrança mensal
 * de uma assinatura de cartão. Sem ele, a renovação automática nunca liberava
 * o mês.
 */
export function tipoNotificacao(body: Record<string, unknown>): TipoNotificacao | null {
  const bruto = (body.type || body.topic || "") as string;
  switch (bruto) {
    case "payment":
      return "payment";
    case "subscription_preapproval":
    case "preapproval":
      return "subscription_preapproval";
    case "subscription_authorized_payment":
    case "authorized_payment":
      return "subscription_authorized_payment";
    default:
      return null;
  }
}
