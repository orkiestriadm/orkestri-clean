import { EmailService } from "./email.service";

/**
 * Os e-mails do feedback de desempenho, lidos como o colaborador os leria.
 *
 * Regra do projeto: mensagem nova se confere pelo TEXTO que sai, não pela
 * chamada. E o que o gestor digita não pode virar HTML no e-mail de outra
 * pessoa.
 */
function servico() {
  const valores: Record<string, string> = {
    APP_URL: "https://hub.exemplo.com.br",
    RESEND_API_KEY: "", SMTP_HOST: "",
    EMAIL_FROM: "hub@exemplo.com.br", EMAIL_FROM_NAME: "Hub",
  };
  const config = { get: (k: string, padrao?: any) => (k in valores ? valores[k] : padrao) } as any;
  const svc = new EmailService(config);
  const enviados: { to: string; assunto: string; html: string }[] = [];
  (svc as any).send = async (to: string, assunto: string, html: string) => {
    enviados.push({ to, assunto, html });
    return true;
  };
  return { svc, enviados };
}

describe("e-mails do feedback de desempenho", () => {
  it("reunião agendada traz data, local e o gestor", async () => {
    const { svc, enviados } = servico();
    await svc.sendFeedbackReuniaoAgendada("ana@x.com", "Ana", "Carlos", "25/09/2026, 10:00", "Sala da TI", false);
    const [m] = enviados;
    expect(m.to).toBe("ana@x.com");
    expect(m.assunto).toMatch(/reunião de feedback marcada/i);
    expect(m.html).toContain("25/09/2026, 10:00");
    expect(m.html).toContain("Sala da TI");
    expect(m.html).toContain("Carlos");
  });

  it("remarcação diz que foi remarcada; sem local, avisa que é a combinar", async () => {
    const { svc, enviados } = servico();
    await svc.sendFeedbackReuniaoAgendada("ana@x.com", "Ana", "Carlos", "26/09/2026, 14:00", null, true);
    expect(enviados[0].assunto).toMatch(/remarcada/i);
    expect(enviados[0].html).toContain("a combinar com o gestor");
  });

  it("o que o gestor digita não vira HTML", async () => {
    const { svc, enviados } = servico();
    await svc.sendFeedbackReuniaoAgendada("ana@x.com", "Ana", "Carlos", "x", "<script>alert(1)</script>", false);
    expect(enviados[0].html).not.toContain("<script>");
    expect(enviados[0].html).toContain("&lt;script&gt;");
  });

  it("feedback disponível traz o passo a passo até a ciência e o link do Meu RH", async () => {
    const { svc, enviados } = servico();
    await svc.sendFeedbackDisponivel("ana@x.com", "Ana", "Carlos");
    const { assunto, html } = enviados[0];
    expect(assunto).toMatch(/você recebeu um feedback/i);
    expect(html).toContain("People › Meu RH");
    expect(html).toContain("aba <strong>Feedback</strong>");
    expect(html).toContain("Registrar ciência");
    expect(html).toContain("https://hub.exemplo.com.br/dashboard/meu-rh?aba=feedback");
    // Os cinco passos, na ordem.
    const ordem = ["Acesse", "Meu RH", "aba <strong>Feedback", "Leia o feedback", "Registrar ciência"]
      .map(t => html.indexOf(t));
    expect(ordem.every((p, i) => p > -1 && (i === 0 || p > ordem[i - 1]))).toBe(true);
  });
});
