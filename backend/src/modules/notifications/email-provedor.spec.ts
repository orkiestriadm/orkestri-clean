import { ConfigService } from "@nestjs/config";
import { EmailService } from "./email.service";

/**
 * Qual provedor de e-mail cada ambiente usa.
 *
 * O risco desta mudança não é o SMTP não funcionar em homologação — isso
 * aparece no primeiro teste de envio. O risco é PRODUÇÃO mudar de
 * comportamento sem ninguém perceber: lá o e-mail sai por Resend, e quebrar
 * isso só se descobriria quando alguém não recebesse uma redefinição de senha.
 *
 * Por isso o teste central aqui é o de produção, não o de homologação.
 */

/** ConfigService de mentira: devolve só o que o ambiente teria definido. */
function configComo(vars: Record<string, string>): ConfigService {
  return {
    get: (chave: string, padrao?: string) => vars[chave] ?? padrao ?? "",
  } as unknown as ConfigService;
}

describe("escolha do provedor de e-mail", () => {
  it("produção continua no Resend — SMTP_HOST ausente não muda nada", () => {
    const service = new EmailService(configComo({
      RESEND_API_KEY: "re_chave_de_producao",
      EMAIL_FROM: "noreply@orkiestri.com",
      EMAIL_FROM_NAME: "Orkiestri",
    }));

    expect(service.isEnabled()).toBe(true);
    expect((service as any).smtp).toBeNull();
    expect((service as any).resend).not.toBeNull();
  });

  it("com SMTP_HOST definido, o SMTP tem precedência sobre o Resend", () => {
    const service = new EmailService(configComo({
      SMTP_HOST: "smtp.exemplo.com.br",
      SMTP_PORT: "587",
      SMTP_USER: "conta@exemplo.com.br",
      SMTP_PASS: "irrelevante-para-o-teste",
      RESEND_API_KEY: "re_chave_que_deve_ser_ignorada",
      EMAIL_FROM: "conta@exemplo.com.br",
    }));

    expect(service.isEnabled()).toBe(true);
    expect((service as any).smtp).not.toBeNull();
    expect((service as any).resend).toBeNull();
  });

  it("sem provedor nenhum, fica desabilitado em vez de estourar", () => {
    const service = new EmailService(configComo({}));
    expect(service.isEnabled()).toBe(false);
  });

  /**
   * Trava de marca (white-label). Um servidor de cliente que exige um domínio de
   * remetente NÃO pode enviar como outra marca se o EMAIL_FROM cair num default.
   * Preferimos não enviar a vazar a identidade errada.
   */
  describe("trava de marca por domínio do remetente", () => {
    it("recusa enviar quando EMAIL_FROM é de outro domínio — desliga os provedores", () => {
      const service = new EmailService(configComo({
        RESEND_API_KEY: "re_chave_valida",
        EMAIL_FROM: "onboarding@resend.dev",
        EMAIL_FROM_DOMINIO_ESPERADO: "triunfotransbrasiliana.com.br",
      }));

      expect(service.isEnabled()).toBe(false);
      expect((service as any).resend).toBeNull();
      expect((service as any).smtp).toBeNull();
    });

    it("envia normalmente quando o EMAIL_FROM é do domínio exigido", () => {
      const service = new EmailService(configComo({
        RESEND_API_KEY: "re_chave_valida",
        EMAIL_FROM: "suporte.ti@triunfotransbrasiliana.com.br",
        EMAIL_FROM_DOMINIO_ESPERADO: "triunfotransbrasiliana.com.br",
      }));

      expect(service.isEnabled()).toBe(true);
      expect((service as any).resend).not.toBeNull();
    });

    it("sem a trava (ex.: produção), o remetente Orkiestri passa como hoje", () => {
      const service = new EmailService(configComo({
        RESEND_API_KEY: "re_chave_de_producao",
        EMAIL_FROM: "noreply@orkiestri.com",
      }));

      expect(service.isEnabled()).toBe(true);
    });
  });

  /**
   * O erro clássico de SMTP: marcar `secure` na 587 faz o servidor derrubar a
   * conexão sem mensagem útil. A 587 é STARTTLS (abre em claro e sobe), a 465
   * é TLS desde o primeiro byte.
   */
  describe("TLS deduzido pela porta", () => {
    const secureDe = (vars: Record<string, string>) =>
      (new EmailService(configComo({ SMTP_HOST: "smtp.exemplo.com", ...vars })) as any)
        .smtp.options.secure;

    it("porta 587 usa STARTTLS (secure=false)", () => {
      expect(secureDe({ SMTP_PORT: "587" })).toBe(false);
    });

    it("porta 465 usa TLS direto (secure=true)", () => {
      expect(secureDe({ SMTP_PORT: "465" })).toBe(true);
    });

    it("SMTP_SECURE explícito vence a dedução", () => {
      expect(secureDe({ SMTP_PORT: "587", SMTP_SECURE: "true" })).toBe(true);
      expect(secureDe({ SMTP_PORT: "465", SMTP_SECURE: "false" })).toBe(false);
    });
  });
});
