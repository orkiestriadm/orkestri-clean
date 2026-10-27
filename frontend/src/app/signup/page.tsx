import { redirect } from "next/navigation";

/**
 * Cadastro com cobrança de plano por organização — SAIU DO AR.
 *
 * Esta página vendia "Business Cloud" (R$ 99,90) e "Business Plus" (R$ 199,90)
 * e mandava a pessoa para um checkout do Mercado Pago. O produto não vende mais
 * isso: hoje a entrada é o teste gratuito de 7 dias e a mensalidade é de
 * R$ 11,90 por conta, com todos os módulos (ver `modules/assinatura` no
 * backend).
 *
 * O endpoint que ela chamava (`POST /api/billing/public/signup`) responde 410.
 * Em vez de deixar a tela montar um checkout que não existe mais, manda para a
 * porta da frente.
 */
export default function SignupPage() {
  redirect("/");
}
