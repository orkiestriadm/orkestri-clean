/**
 * Rotas isentas da proteção CSRF (padrão double-submit cookie).
 *
 * Esta lista vivia dentro do `bootstrap()` em `main.ts`, onde nenhum teste a
 * alcançava. Ela saiu de lá por um motivo concreto: o webhook do Mercado Pago
 * foi escrito, testado por unidade e conferido no roteador do Nest — e mesmo
 * assim levava **403 do CSRF antes de chegar ao handler**, porque o caminho
 * novo não estava aqui. Máquina nenhuma tem cookie CSRF para mandar.
 *
 * Regra para entrar nesta lista: a rota é chamada por um SISTEMA EXTERNO (não
 * por um navegador com sessão), e ela tem a sua própria prova de autenticidade.
 * Isenção sem prova própria é furo, não conveniência.
 */
export const CSRF_EXEMPT_PATHS: string[] = [
  // ── Autenticação: acontecem ANTES de existir sessão (e cookie CSRF útil) ──
  "/api/auth/login",
  "/api/auth/solicitar-acesso",
  "/api/auth/esqueci-senha",
  "/api/auth/trial/iniciar",
  "/api/auth/trial/confirmar",
  "/api/auth/enviar-otp",
  "/api/auth/verificar-otp",
  "/api/auth/redefinir-senha",
  "/api/auth/tenant-info",
  "/api/auth/organizations",
  // Primeiro acesso: a troca de senha acontece ANTES de existir sessao, e
  // portanto antes de haver cookie CSRF util. Quem protege e a senha
  // provisoria + o codigo do e-mail, com teto de tentativas no controller.
  "/api/auth/primeiro-acesso/confirmar",
  "/api/auth/primeiro-acesso/reenviar",

  "/health",

  // ── Webhooks: POST de máquina, sem navegador no meio ──────────────────────

  /**
   * Mercado Pago — mensalidade. Prova de autenticidade própria: HMAC do
   * cabeçalho `x-signature`, conferido em `AssinaturaWebhookController`, que
   * devolve 403 quando não bate.
   */
  "/api/assinatura/webhook/mp",

  /**
   * Webhook antigo do billing por organização. A rota responde 410 e aponta o
   * endereço novo; continua isenta só para dar ESSA resposta a quem ainda a
   * chame, em vez de um 403 de CSRF que não explica nada.
   */
  "/api/billing/webhook/mp",

  // Webhook do Microsoft Graph: chamado pela Microsoft, sem cookie CSRF. A
  // autenticidade vem do clientState verificado no controller.
  "/api/integracoes/microsoft/webhook",

  // Webhook de ENTRADA do WhatsApp (Evolution): POST de máquina, sem cookie
  // CSRF. A autenticidade vem do ?secret= validado no controller.
  "/api/whatsapp/inbound",

  // Cadastro público antigo (responde 410).
  "/api/billing/public/signup",
];

/** Esta rota está isenta? Comparação exata, como o middleware faz. */
export function isentoDeCsrf(path: string): boolean {
  return CSRF_EXEMPT_PATHS.includes(path);
}
