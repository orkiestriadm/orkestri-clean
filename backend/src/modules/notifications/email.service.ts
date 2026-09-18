import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import * as nodemailer from "nodemailer";
import * as fs from "fs";
import { MARCA } from "../../common/marca";

/**
 * A marca vem de `common/marca` (que lê do ambiente) e não mais de uma
 * constante local.
 *
 * Antes cada arquivo declarava a sua, e os e-mails escreviam o nome em oito
 * lugares diferentes — quem recebia via uma marca no e-mail e outra no sistema.
 * Agora, além de não divergir entre arquivos, ela acompanha o ambiente: no
 * servidor white-label o e-mail sai com a marca do cliente sem precisar editar
 * código, que era a origem da divergência que o deploy apagava.
 */

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private smtp: nodemailer.Transporter | null = null;
  private from: string;
  private appUrl: string;

  // Tema do e-mail, por marca (via ambiente). Defaults = o visual atual da
  // produção (Orkiestri), então onde ninguém seta nada NADA muda. O servidor
  // white-label seta EMAIL_ACCENT/EMAIL_HEADER_BG/EMAIL_LOGO_PATH e ganha o
  // layout com a marca do cliente — sem tocar no e-mail da produção.
  private accent: string;
  private headerBg: string;
  private logoBuffer: Buffer | null = null; // logo embutido inline (CID) quando há EMAIL_LOGO_PATH

  /**
   * Dois provedores, e a escolha é do ambiente.
   *
   * SMTP tem precedência sobre o Resend quando `SMTP_HOST` está definido. A
   * ordem importa: produção usa Resend e não define SMTP_HOST, então continua
   * exatamente como estava — a mudança é inerte onde ninguém a configurou.
   *
   * Por que os dois em vez de trocar: o Resend exige verificar o domínio por
   * DNS para poder enviar como ele. Um ambiente que precisa sair de um endereço
   * corporativo cujo DNS não controlamos só consegue isso autenticando na
   * própria caixa, que é o que SMTP faz.
   */
  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>("RESEND_API_KEY", "");
    const smtpHost = this.config.get<string>("SMTP_HOST", "");
    // Vazio (não só ausente) também cai na MARCA: o compose base define a chave
    // como "" quando o ambiente não a seta, e "" não dispararia o default do
    // ConfigService. Sem este `|| MARCA`, o remetente sairia sem nome.
    const fromName = this.config.get<string>("EMAIL_FROM_NAME", "").trim() || MARCA;
    const fromAddr = this.config.get<string>("EMAIL_FROM", "onboarding@resend.dev");
    this.from = `${fromName} <${fromAddr}>`;
    this.appUrl = this.config.get<string>("APP_URL", "http://localhost");

    // Tema por marca. Os defaults reproduzem o e-mail atual da produção.
    this.accent = this.config.get<string>("EMAIL_ACCENT", "").trim() || "#f97316";
    this.headerBg = this.config.get<string>("EMAIL_HEADER_BG", "").trim() || "#0f1116";
    const logoPath = this.config.get<string>("EMAIL_LOGO_PATH", "").trim();
    if (logoPath) {
      try {
        this.logoBuffer = fs.readFileSync(logoPath);
        this.logger.log(`Logo do e-mail carregado de ${logoPath} (${this.logoBuffer.length} bytes) — layout com marca ativo.`);
      } catch (e: any) {
        // Sem derrubar nada: sem logo, o layout cai no cabeçalho de texto.
        this.logger.error(`EMAIL_LOGO_PATH definido mas não li o arquivo (${logoPath}): ${e.message}. Seguindo sem logo.`);
      }
    }

    if (smtpHost) {
      const porta = Number(this.config.get<string>("SMTP_PORT", "587")) || 587;
      const usuario = this.config.get<string>("SMTP_USER", "");
      const senha = this.config.get<string>("SMTP_PASS", "");

      // `secure` significa TLS desde o primeiro byte (porta 465). Na 587 o
      // caminho é STARTTLS: a conexão abre em claro e sobe para TLS. Deduzir
      // pela porta evita o erro clássico de marcar secure na 587 e ver o
      // servidor derrubar a conexão sem explicação.
      const explicito = this.config.get<string>("SMTP_SECURE", "");
      const secure = explicito ? explicito === "true" : porta === 465;

      this.smtp = nodemailer.createTransport({
        host: smtpHost,
        port: porta,
        secure,
        auth: usuario ? { user: usuario, pass: senha } : undefined,
        // SEM pool: cada envio abre uma conexão nova. O pool guardava um socket
        // entre envios, mas o M365 Direct Send derruba conexões ociosas — e no
        // envio seguinte o nodemailer reusava o socket morto e ficava PENDURADO
        // para sempre (a request nunca voltava). Uma conexão nova ao MX responde
        // em ~1-2s (EHLO/STARTTLS/MAIL/RCPT, medido), então o custo é irrelevante
        // no volume transacional deste ambiente e a entrega fica confiável na
        // primeira tentativa.
        pool: false,
        // Força IPv4. O MX do M365 publica AAAA (IPv6), o container NÃO roteia
        // IPv6 ("Network is unreachable"), e o Node v24 (DNS verbatim) às vezes
        // tenta o IPv6 primeiro — dava "Connection timeout" intermitente (quando
        // calhava IPv4, ia; IPv6, travava). Com family:4 sempre resolve por A.
        family: 4,
        // Tetos de segurança: mesmo assim, uma conexão que trava não pode
        // pendurar a request para sempre.
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
      } as any);

      this.logger.log(`E-mail por SMTP: ${smtpHost}:${porta} (secure=${secure}), remetente ${this.from}`);

      // Verifica no boot: credencial errada ou SMTP AUTH desabilitado aparecem
      // AQUI, no log da subida, e não três semanas depois num aviso que não
      // chegou. Não derruba a aplicação — e-mail quebrado não justifica deixar
      // o sistema inteiro fora do ar.
      //
      // Fora dos testes: `verify` abre conexão de verdade, e no CI isso vira
      // espera por um host inexistente e processo pendurado depois da suíte.
      if (process.env.NODE_ENV !== "test") {
        this.smtp.verify()
          .then(() => this.logger.log("SMTP autenticado com sucesso."))
          .catch((e: any) => this.logger.error(`SMTP NÃO autenticou: ${e.message}`));
      }
    } else if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn(
        "Sem RESEND_API_KEY e sem SMTP_HOST — envio de e-mails desativado.",
      );
    }

    // Trava de marca (white-label). Um ambiente que declara qual domínio o
    // remetente PRECISA ter — `EMAIL_FROM_DOMINIO_ESPERADO` — se recusa a enviar
    // quando o `EMAIL_FROM` não é daquele domínio, DESLIGANDO os provedores.
    //
    // É o que impede o servidor de um cliente de vazar a identidade de outra
    // marca se o `.env` um dia perder o override e o remetente cair num default
    // (o compose base ainda traz `onboarding@resend.dev`). Preferimos NÃO enviar
    // a enviar como quem não somos — para o cliente, um e-mail com a marca errada
    // é pior do que e-mail nenhum.
    //
    // Opt-in: quem não define a variável (ex.: produção) não muda em nada.
    const domEsperado = this.config.get<string>("EMAIL_FROM_DOMINIO_ESPERADO", "").trim().toLowerCase();
    if (domEsperado) {
      const domDoFrom = (fromAddr.split("@")[1] || "").trim().toLowerCase();
      if (domDoFrom !== domEsperado) {
        this.logger.error(
          `E-mail DESABILITADO: remetente "${fromAddr}" não é do domínio exigido ` +
          `"${domEsperado}" (EMAIL_FROM_DOMINIO_ESPERADO). Recuso enviar para não ` +
          `vazar a marca de outro. Ajuste EMAIL_FROM no ambiente.`,
        );
        this.resend = null;
        this.smtp = null;
      } else {
        this.logger.log(`Trava de marca ativa: remetente confinado a @${domEsperado}.`);
      }
    }
  }

  /** Indica se há provedor de e-mail configurado (SMTP ou Resend). */
  isEnabled(): boolean {
    return this.smtp !== null || this.resend !== null;
  }

  // Anexo inline do logo (CID "brand-logo"). Só entra quando há logo carregado E
  // o HTML realmente referencia o cid (o layout com marca) — assim um e-mail de
  // conteúdo cru (worker) não carrega um anexo solto. Só o caminho SMTP: o
  // ambiente com logo usa SMTP; produção (Resend) não tem logo.
  private logoAnexo(html: string): Array<{ filename: string; content: Buffer; cid: string }> {
    return this.logoBuffer && html.includes("cid:brand-logo")
      ? [{ filename: "logo.png", content: this.logoBuffer, cid: "brand-logo" }]
      : [];
  }

  private async send(to: string, subject: string, html: string): Promise<boolean> {
    if (!to || !this.isEnabled()) {
      this.logger.warn(`Email não enviado para ${to || "(vazio)"} — serviço de e-mail indisponível.`);
      return false;
    }

    if (this.smtp) {
      try {
        await this.smtp.sendMail({ from: this.from, to, subject, html, attachments: this.logoAnexo(html) });
        this.logger.log(`Email enviado por SMTP para ${to}: ${subject}`);
        return true;
      } catch (e: any) {
        this.logger.error(`Erro ao enviar email por SMTP para ${to}: ${e.message}`);
        return false;
      }
    }

    try {
      const res: any = await this.resend!.emails.send({ from: this.from, to, subject, html });
      if (res?.error) {
        this.logger.error(`Resend recusou e-mail para ${to}: ${JSON.stringify(res.error)}`);
        return false;
      }
      this.logger.log(`Email enviado para ${to}: ${subject}`);
      return true;
    } catch (e: any) {
      this.logger.error(`Erro ao enviar email para ${to}: ${e.message}`);
      return false;
    }
  }

  /**
   * Envio genérico, usado pelo worker de notificações.
   *
   * Os demais métodos públicos são específicos por evento (reset de senha,
   * conta aprovada...). O worker entrega conteúdo já montado pelo despachante e
   * precisava de uma porta pública sem template próprio — antes disso, a única
   * saída seria tornar `send` público, o que abriria envio livre para o resto
   * do sistema e desfaria a padronização dos e-mails transacionais.
   */
  async enviarNotificacao(to: string, assunto: string, corpoHtml: string): Promise<boolean> {
    return this.send(to, assunto, corpoHtml);
  }

  async sendWithAttachment(to: string, subject: string, html: string, filename: string, contentBase64: string): Promise<boolean> {
    if (!to || !this.isEnabled()) {
      this.logger.warn(`Email com anexo não enviado para ${to || "(vazio)"} — serviço de e-mail indisponível.`);
      return false;
    }

    // Mesma precedência do `send`: SMTP quando definido (o servidor white-label
    // usa Direct Send do M365, sem Resend), Resend caso contrário. Antes este
    // método era Resend-only e devolvia false em qualquer ambiente SMTP — o
    // anexo do resumo do Orçamento não saía onde o e-mail era por SMTP.
    if (this.smtp) {
      try {
        const corpo = this.layout(html);
        await this.smtp.sendMail({
          from: this.from,
          to,
          subject,
          html: corpo,
          attachments: [
            ...this.logoAnexo(corpo),
            { filename, content: contentBase64, encoding: "base64" },
          ],
        });
        this.logger.log(`Email com anexo ${filename} enviado por SMTP para ${to}: ${subject}`);
        return true;
      } catch (e: any) {
        this.logger.error(`Erro ao enviar email com anexo por SMTP para ${to}: ${e.message}`);
        return false;
      }
    }

    try {
      const res: any = await this.resend!.emails.send({
        from: this.from,
        to,
        subject,
        html: this.layout(html),
        attachments: [
          {
            filename,
            content: contentBase64,
          },
        ],
      });
      if (res?.error) {
        this.logger.error(`Resend recusou e-mail para ${to}: ${JSON.stringify(res.error)}`);
        return false;
      }
      this.logger.log(`Email com anexo ${filename} enviado para ${to}: ${subject}`);
      return true;
    } catch (e: any) {
      this.logger.error(`Erro ao enviar email com anexo para ${to}: ${e.message}`);
      return false;
    }
  }

  // ── Templates base ─────────────────────────────────────────────────────────

  /**
   * Moldura dos e-mails transacionais.
   *
   * A paleta acompanha o produto: fundo grafite e acento laranja (#f97316), o
   * mesmo do login. Antes era um gradiente roxo/índigo que não existe em lugar
   * nenhum da interface — quem recebia o e-mail e depois abria o sistema via
   * duas marcas diferentes.
   *
   * Cor vem em `style` inline além do `<style>`: Gmail e Outlook descartam
   * folhas de estilo em parte dos clientes, e sem o inline o botão de ação
   * chegaria sem cor nenhuma — que é o único elemento clicável da mensagem.
   */
  private layout(conteudo: string): string {
    // Com logo de marca carregado (servidor white-label), usa o layout com a
    // marca do cliente. Sem logo (ex.: produção), mantém o layout clássico
    // ABAIXO, byte a byte como estava — produção não muda.
    if (this.logoBuffer) return this.layoutMarca(conteudo);
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  body{margin:0;padding:0;background:#eef0f4;font-family:'Segoe UI',Arial,sans-serif;color:#12141a}
  .wrap{max-width:580px;margin:32px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 14px rgba(8,9,12,.10)}
  .header{background:#0f1116;padding:30px 32px;text-align:center;border-bottom:3px solid #f97316}
  .header h1{color:#fff;font-size:22px;font-weight:800;margin:0;letter-spacing:-0.5px}
  .header span{color:#fb923c;font-size:13px;font-weight:400}
  .body{padding:32px}
  .body p{margin:0 0 16px;font-size:14px;line-height:1.65;color:#374151}
  .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;margin-bottom:16px}
  .info-box{background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px 20px;margin:16px 0}
  .info-row{display:flex;gap:8px;margin-bottom:8px;font-size:13px}
  .info-row:last-child{margin-bottom:0}
  .info-label{color:#6b7280;min-width:110px;flex-shrink:0}
  .info-value{color:#12141a;font-weight:600;word-break:break-all}
  .btn{display:inline-block;background:#f97316;color:#fff;text-decoration:none;padding:13px 28px;border-radius:10px;font-weight:700;font-size:14px;margin:8px 0}
  .footer{background:#fafafa;padding:20px 32px;text-align:center;font-size:11px;color:#9ca3af;border-top:1px solid #ececf1}
  .divider{border:none;border-top:1px solid #ececf1;margin:24px 0}
</style>
</head>
<body style="margin:0;padding:0;background:#eef0f4;">
<div class="wrap">
  <div class="header" style="background:#0f1116;border-bottom:3px solid #f97316;">
    <h1 style="color:#fff;">${MARCA}</h1>
    <span style="color:#fb923c;">Sistema de Gestão</span>
  </div>
  <div class="body">${conteudo}</div>
  <div class="footer">
    Você está recebendo este email pois possui uma conta no ${MARCA}.<br>
    © ${new Date().getFullYear()} ${MARCA} — Todos os direitos reservados.
  </div>
</div>
</body>
</html>`;
  }

  /** Cor de acento do e-mail (por marca). Para quem monta botão inline no corpo. */
  get accentColor(): string {
    return this.accent;
  }

  /** URL base do app (para links dentro do corpo). */
  get appBaseUrl(): string {
    return this.appUrl;
  }

  /**
   * Botão de ação já com o acento inline (não depende do `<style>`, que o
   * Outlook desktop descarta). Para conteúdos que precisam de um CTA no corpo.
   */
  botaoHtml(url: string, label: string): string {
    return `<div style="text-align:center;margin:24px 0 6px"><a href="${url}" class="btn" style="display:inline-block;background:${this.accent};color:#fff;text-decoration:none;padding:12px 28px;border-radius:9px;font-weight:700;font-size:14px">${label}</a></div>`;
  }

  /**
   * Layout com a marca do cliente (white-label): cabeçalho grafite com o logo
   * numa plaquinha branca e borda de acento, corpo claro, cards neutros e botão
   * na cor de acento. O logo entra via `cid:brand-logo` (anexo inline). Todo o
   * acento e o fundo do cabeçalho vêm do ambiente (EMAIL_ACCENT/EMAIL_HEADER_BG).
   */
  private layoutMarca(conteudo: string): string {
    const a = this.accent;
    const head = this.headerBg;
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  body{margin:0;padding:0;background:#d9dce3;font-family:'Segoe UI',Arial,sans-serif;color:#12141a}
  .wrap{max-width:600px;margin:28px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 3px 18px rgba(8,9,12,.12)}
  .header{background:${head};padding:26px 34px;text-align:center;border-bottom:4px solid ${a}}
  .plate{display:inline-block;background:#fff;border-radius:10px;padding:13px 22px;line-height:0}
  .plate img{height:34px;display:block}
  .body{padding:32px 34px}
  .body p{margin:0 0 15px;font-size:14.5px;line-height:1.62;color:#374151}
  .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;margin-bottom:16px}
  .info-box{background:#fafbfc;border:1px solid #e6e8ee;border-radius:10px;padding:16px 18px;margin:18px 0}
  .info-row{display:flex;gap:8px;margin-bottom:7px;font-size:13px}
  .info-row:last-child{margin-bottom:0}
  .info-label{color:#6b7280;min-width:110px;flex-shrink:0}
  .info-value{color:#12141a;font-weight:600;word-break:break-all}
  .btn{display:inline-block;background:${a};color:#fff;text-decoration:none;padding:12px 28px;border-radius:9px;font-weight:700;font-size:14px;margin:8px 0}
  .footer{background:#fafafa;padding:18px 34px;text-align:center;font-size:11px;color:#9ca3af;border-top:1px solid #e6e8ee}
  .divider{border:none;border-top:1px solid #e6e8ee;margin:24px 0}
</style>
</head>
<body style="margin:0;padding:0;background:#d9dce3;">
<div class="wrap">
  <div class="header" style="background:${head};border-bottom:4px solid ${a};text-align:center;">
    <span class="plate" style="display:inline-block;background:#fff;border-radius:10px;padding:13px 22px;line-height:0;">
      <img src="cid:brand-logo" alt="${MARCA}" height="34" style="height:34px;display:block;">
    </span>
  </div>
  <div class="body" style="padding:32px 34px;">${conteudo}</div>
  <div class="footer">
    Você está recebendo este email pois possui acesso ao ${MARCA}.<br>
    © ${new Date().getFullYear()} ${MARCA} — Todos os direitos reservados.
  </div>
</div>
</body>
</html>`;
  }

  // ── Auth ───────────────────────────────────────────────────────────────────

  async sendPasswordResetLink(toEmail: string, nome: string, resetUrl: string): Promise<void> {
    await this.send(
      toEmail,
      `Redefinição de senha — ${MARCA}`,
      this.layout(`
        <p>Olá, <strong>${nome}</strong>!</p>
        <p>Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha:</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${resetUrl}" class="btn">Redefinir minha senha</a>
        </div>
        <div class="info-box" style="font-size:12px;color:#6b7280;">
          ⏱️ Este link expira em <strong>30 minutos</strong>.<br><br>
          Se você não solicitou a redefinição de senha, ignore este email — sua conta continua segura.
        </div>
        <hr class="divider">
        <p style="font-size:11px;color:#9ca3af;">Se o botão não funcionar, copie e cole este link no navegador:<br>
        <span style="color:#c2410c;word-break:break-all;">${resetUrl}</span></p>
      `)
    );
  }

  async sendPasswordResetRequest(toEmail: string, nomeUsuario: string, nomeAdmin: string, adminEmail: string): Promise<void> {
    await this.send(
      adminEmail,
      `Solicitação de reset de senha — ${nomeUsuario}`,
      this.layout(`
        <p>Olá, <strong>${nomeAdmin}</strong>!</p>
        <p>O usuário abaixo solicitou a redefinição de senha:</p>
        <div class="info-box">
          <div class="info-row"><span class="info-label">Nome:</span><span class="info-value">${nomeUsuario}</span></div>
          <div class="info-row"><span class="info-label">E-mail:</span><span class="info-value">${toEmail}</span></div>
        </div>
        <p>Acesse o painel para redefinir a senha manualmente ou autorizar o reset.</p>
        <a href="${this.appUrl}/dashboard/configuracoes" class="btn">Acessar Painel</a>
      `)
    );
  }

  /**
   * Avisa o administrador de que chegou uma solicitação de acesso pela landing
   * page. Diferente de `sendPasswordResetRequest`, traz os dados de cadastro e
   * os produtos do Orkiestri One que o interessado quer testar — o admin decide
   * a aprovação a partir daqui, sem precisar caçar a informação em outro canal.
   */
  async sendAccessRequestToAdmin(
    adminEmail: string,
    nomeAdmin: string,
    req: {
      nome: string; email: string; empresa?: string; whatsapp?: string;
      cargo?: string; departamento?: string; motivacao?: string; produtos?: string[];
    },
  ): Promise<boolean> {
    const linha = (label: string, valor?: string) =>
      valor ? `<div class="info-row"><span class="info-label">${label}:</span><span class="info-value">${valor}</span></div>` : "";
    const produtos = Array.isArray(req.produtos) && req.produtos.length
      ? req.produtos.map((p) => `<span class="badge" style="background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;margin:2px 4px 2px 0">${p}</span>`).join("")
      : `<span style="color:#9ca3af;font-size:13px">Nenhum produto indicado.</span>`;
    return this.send(
      adminEmail,
      `Nova solicitação de demonstração — ${req.nome}`,
      this.layout(`
        <p>Olá, <strong>${nomeAdmin}</strong>!</p>
        <p>Uma nova solicitação de <strong>acesso de demonstração</strong> chegou pela landing page. Revise os dados e aprove o acesso no painel.</p>
        <div class="info-box">
          ${linha("Nome", req.nome)}
          ${linha("E-mail", req.email)}
          ${linha("Empresa", req.empresa)}
          ${linha("Cargo", req.cargo)}
          ${linha("Departamento", req.departamento)}
          ${linha("WhatsApp", req.whatsapp)}
        </div>
        <p style="margin:20px 0 8px;font-size:13px;font-weight:600;color:#374151">Produtos que deseja testar:</p>
        <div style="margin-bottom:8px">${produtos}</div>
        ${req.motivacao ? `<hr class="divider"><p style="font-size:13px;color:#374151"><strong>Mensagem:</strong><br>${req.motivacao.replace(/\n/g, "<br>")}</p>` : ""}
        <div style="text-align:center;margin:24px 0 4px">
          <a href="${this.appUrl}/dashboard/cadastros" class="btn">Revisar e aprovar</a>
        </div>
      `),
    );
  }

  /**
   * Mensagem de ajuda ("Fale Conosco") enviada por um usuário logado. Assunto
   * fixo HELP para o admin filtrar. O texto é escapado (vem do usuário).
   */
  async sendHelpToAdmin(adminEmail: string, adminNome: string, deEmail: string, deNome: string, mensagem: string): Promise<boolean> {
    const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return this.send(
      adminEmail,
      "HELP",
      this.layout(`
        <p>Olá, <strong>${esc(adminNome)}</strong>!</p>
        <p>Um usuário pediu ajuda pelo botão de suporte:</p>
        <div class="info-box">
          <div class="info-row"><span class="info-label">De:</span><span class="info-value">${esc(deNome) || "(sem nome)"}</span></div>
          <div class="info-row"><span class="info-label">E-mail:</span><span class="info-value">${esc(deEmail)}</span></div>
        </div>
        <hr class="divider">
        <p style="white-space:pre-line;font-size:14px;color:#374151;line-height:1.6">${esc(mensagem).replace(/\n/g, "<br>")}</p>
      `),
    );
  }

  async sendAccountApproved(toEmail: string, nome: string, senhaTemp: string): Promise<void> {
    await this.send(
      toEmail,
      `Sua conta foi aprovada — ${MARCA}`,
      this.layout(`
        <p>Olá, <strong>${nome}</strong>! 🎉</p>
        <p>Sua solicitação de acesso foi <strong style="color:#059669">aprovada</strong>. Você já pode entrar no sistema.</p>
        <div class="info-box">
          <div class="info-row"><span class="info-label">E-mail:</span><span class="info-value">${toEmail}</span></div>
          <div class="info-row"><span class="info-label">Senha temporária:</span><span class="info-value">${senhaTemp}</span></div>
        </div>
        <p style="font-size:13px;color:#6b7280">⚠️ Por segurança, troque a senha no primeiro acesso.</p>
        <a href="${this.appUrl}/login" class="btn">Acessar o Sistema</a>
      `)
    );
  }

  async sendAccountRejected(toEmail: string, nome: string, motivo?: string): Promise<void> {
    await this.send(
      toEmail,
      `Solicitação de acesso — ${MARCA}`,
      this.layout(`
        <p>Olá, <strong>${nome}</strong>.</p>
        <p>Infelizmente sua solicitação de acesso ao ${MARCA} não foi aprovada neste momento.</p>
        ${motivo ? `<div class="info-box"><p style="margin:0;font-size:13px"><strong>Motivo:</strong> ${motivo}</p></div>` : ""}
        <p>Em caso de dúvidas, entre em contato com o administrador do sistema.</p>
      `)
    );
  }

  async sendUserInvite(toEmail: string, nome: string, senhaTemp: string, orgNome: string, papel = "Usuário"): Promise<boolean> {
    return this.send(
      toEmail,
      `Você foi convidado para o ${MARCA} — ${orgNome}`,
      this.layout(`
        <p>Olá, <strong>${nome}</strong>!</p>
        <p>Você foi adicionado à organização <strong>${orgNome}</strong> no ${MARCA} como <strong>${papel}</strong>.</p>
        <div class="info-box">
          <div class="info-row"><span class="info-label">E-mail:</span><span class="info-value">${toEmail}</span></div>
          <div class="info-row"><span class="info-label">Senha temporária:</span><span class="info-value">${senhaTemp}</span></div>
          <div class="info-row"><span class="info-label">Organização:</span><span class="info-value">${orgNome}</span></div>
          <div class="info-row"><span class="info-label">Perfil:</span><span class="info-value">${papel}</span></div>
        </div>
        <p style="font-size:13px;color:#6b7280">⚠️ Troque a senha no primeiro acesso.</p>
        <a href="${this.appUrl}/login" class="btn">Acessar o Sistema</a>
      `)
    );
  }

  // ── Chamados ───────────────────────────────────────────────────────────────

  private prioridadeBadge(prioridade: string): string {
    const cores: Record<string, string> = {
      critica: "background:#fee2e2;color:#991b1b",
      alta:    "background:#ffedd5;color:#9a3412",
      media:   "background:#fef9c3;color:#854d0e",
      baixa:   "background:#f0fdf4;color:#166534",
    };
    const estilo = cores[prioridade?.toLowerCase()] || "background:#f3f4f6;color:#374151";
    return `<span class="badge" style="${estilo}">${prioridade?.toUpperCase() || "MÉDIA"}</span>`;
  }

  async sendChamadoAberto(toEmail: string, nomeSolicitante: string, numeroChamado: number, titulo: string, prioridade: string, slaHoras?: number): Promise<void> {
    await this.send(
      toEmail,
      `Chamado #${numeroChamado} aberto — ${titulo}`,
      this.layout(`
        <p>Olá, <strong>${nomeSolicitante}</strong>!</p>
        <p>Seu chamado foi registrado com sucesso.</p>
        ${this.prioridadeBadge(prioridade)}
        <div class="info-box">
          <div class="info-row"><span class="info-label">Número:</span><span class="info-value">#${numeroChamado}</span></div>
          <div class="info-row"><span class="info-label">Título:</span><span class="info-value">${titulo}</span></div>
          <div class="info-row"><span class="info-label">Prioridade:</span><span class="info-value">${prioridade}</span></div>
          ${slaHoras ? `<div class="info-row"><span class="info-label">Prazo SLA:</span><span class="info-value">${slaHoras}h</span></div>` : ""}
        </div>
        <p style="font-size:13px;color:#6b7280">Você será notificado quando houver atualizações.</p>
        <a href="${this.appUrl}/dashboard/chamados" class="btn">Ver Chamado</a>
      `)
    );
  }

  async sendChamadoAtribuido(toEmail: string, nomeAtendente: string, numeroChamado: number, titulo: string, prioridade: string, nomeSolicitante: string): Promise<void> {
    await this.send(
      toEmail,
      `Chamado #${numeroChamado} atribuído a você`,
      this.layout(`
        <p>Olá, <strong>${nomeAtendente}</strong>!</p>
        <p>Um chamado foi atribuído a você para atendimento.</p>
        ${this.prioridadeBadge(prioridade)}
        <div class="info-box">
          <div class="info-row"><span class="info-label">Número:</span><span class="info-value">#${numeroChamado}</span></div>
          <div class="info-row"><span class="info-label">Título:</span><span class="info-value">${titulo}</span></div>
          <div class="info-row"><span class="info-label">Solicitante:</span><span class="info-value">${nomeSolicitante}</span></div>
          <div class="info-row"><span class="info-label">Prioridade:</span><span class="info-value">${prioridade}</span></div>
        </div>
        <a href="${this.appUrl}/dashboard/chamados" class="btn">Abrir Chamado</a>
      `)
    );
  }

  async sendChamadoResolvido(toEmail: string, nomeSolicitante: string, numeroChamado: number, titulo: string): Promise<void> {
    await this.send(
      toEmail,
      `Chamado #${numeroChamado} resolvido`,
      this.layout(`
        <p>Olá, <strong>${nomeSolicitante}</strong>!</p>
        <p>Seu chamado foi <strong style="color:#059669">resolvido</strong>. ✅</p>
        <div class="info-box">
          <div class="info-row"><span class="info-label">Número:</span><span class="info-value">#${numeroChamado}</span></div>
          <div class="info-row"><span class="info-label">Título:</span><span class="info-value">${titulo}</span></div>
        </div>
        <p style="font-size:13px;color:#6b7280">Caso o problema persista, abra um novo chamado.</p>
        <a href="${this.appUrl}/dashboard/chamados" class="btn">Ver Chamados</a>
      `)
    );
  }

  async sendChamadoStatus(toEmail: string, nomeSolicitante: string, numeroChamado: number, titulo: string, novoStatus: string): Promise<void> {
    const statusLabel: Record<string, string> = {
      EM_ATENDIMENTO: "Em Atendimento",
      AGUARDANDO_CLIENTE: "Aguardando Cliente",
      AGUARDANDO_TERCEIRO: "Aguardando Terceiro",
      PENDENTE: "Pendente",
      CANCELADO: "Cancelado",
    };
    const label = statusLabel[novoStatus] || novoStatus;
    await this.send(
      toEmail,
      `Chamado #${numeroChamado} — Status atualizado`,
      this.layout(`
        <p>Olá, <strong>${nomeSolicitante}</strong>!</p>
        <p>O status do seu chamado foi atualizado:</p>
        <div class="info-box">
          <div class="info-row"><span class="info-label">Número:</span><span class="info-value">#${numeroChamado}</span></div>
          <div class="info-row"><span class="info-label">Título:</span><span class="info-value">${titulo}</span></div>
          <div class="info-row"><span class="info-label">Novo status:</span><span class="info-value">${label}</span></div>
        </div>
        <a href="${this.appUrl}/dashboard/chamados" class="btn">Ver Chamado</a>
      `)
    );
  }

  async sendChamadoComentario(toEmail: string, nomeDestinatario: string, numeroChamado: number, titulo: string, nomeAutor: string, comentario: string): Promise<void> {
    await this.send(
      toEmail,
      `Novo comentário no chamado #${numeroChamado}`,
      this.layout(`
        <p>Olá, <strong>${nomeDestinatario}</strong>!</p>
        <p><strong>${nomeAutor}</strong> adicionou um comentário no chamado:</p>
        <div class="info-box">
          <div class="info-row"><span class="info-label">Chamado:</span><span class="info-value">#${numeroChamado} — ${titulo}</span></div>
          <hr class="divider" style="margin:12px 0">
          <p style="margin:0;font-size:13px;color:#374151;font-style:italic">"${comentario.slice(0, 300)}${comentario.length > 300 ? "..." : ""}"</p>
        </div>
        <a href="${this.appUrl}/dashboard/chamados" class="btn">Responder</a>
      `)
    );
  }

  async sendNewIpAlert(to: string, ip: string, quando: string): Promise<boolean> {
    return this.send(
      to,
      `Novo acesso detectado na sua conta ${MARCA}`,
      this.layout(
        `<h2 style="font-size:20px;font-weight:700;color:#1f2937;margin:0 0 16px;">Novo acesso à sua conta</h2>
        <p style="font-size:15px;color:#374151;">Detectamos um login na sua conta a partir de um IP não reconhecido.</p>
        <div class="info-box">
          <div class="info-row"><span class="info-label">IP:</span><span class="info-value">${ip}</span></div>
          <div class="info-row"><span class="info-label">Quando:</span><span class="info-value">${quando}</span></div>
        </div>
        <p style="font-size:14px;color:#6b7280;">Se foi você, pode ignorar este e-mail. Caso contrário, troque sua senha imediatamente.</p>
        <a href="${this.appUrl}/dashboard/configuracoes" class="btn">Trocar senha agora</a>`
      )
    );
  }

  // ── People › Feedback de desempenho ───────────────────────────────────────
  //
  // Texto sem o nome do produto escrito à mão: a marca vem do ambiente
  // (`MARCA`), e o link, de `APP_URL` — no Hub, os dois são da Triunfo.
  // O que o gestor digita (local da reunião) e os nomes passam por `esc`:
  // "<" num campo de texto não pode virar HTML no e-mail de outra pessoa.

  private esc(texto: string | null | undefined): string {
    return String(texto ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /** Reunião de feedback marcada (ou remarcada): data, horário e local. */
  async sendFeedbackReuniaoAgendada(
    toEmail: string, nome: string, gestorNome: string, quando: string, local: string | null, remarcada: boolean,
  ): Promise<boolean> {
    const titulo = remarcada ? "Sua reunião de feedback foi remarcada" : "Você tem uma reunião de feedback marcada";
    return this.send(
      toEmail,
      `${titulo} — ${MARCA}`,
      this.layout(`
        <p>Olá, <strong>${this.esc(nome)}</strong>!</p>
        <p><strong>${this.esc(gestorNome)}</strong> ${remarcada ? "remarcou" : "marcou"} uma conversa individual de feedback com você.</p>
        <div class="info-box">
          <div class="info-row"><span class="info-label">Data e horário:</span><span class="info-value">${this.esc(quando)}</span></div>
          <div class="info-row"><span class="info-label">Local:</span><span class="info-value">${local ? this.esc(local) : "a combinar com o gestor"}</span></div>
          <div class="info-row"><span class="info-label">Com:</span><span class="info-value">${this.esc(gestorNome)}</span></div>
        </div>
        <p>Na conversa, o gestor apresenta o feedback, esclarece dúvidas e alinha com você as expectativas e os próximos passos.</p>
        <p style="font-size:13px;color:#6b7280">O compromisso já está na sua agenda no ${this.esc(MARCA)}. Depois da reunião você recebe outro e-mail para ler o feedback e registrar a sua ciência.</p>
      `),
    );
  }

  /**
   * Feedback liberado para ciência — com o passo a passo.
   *
   * Sai quando o gestor registra a reunião como realizada, e não quando ele
   * escreve o feedback: antes da conversa o texto não aparece para o
   * colaborador, e um e-mail pedindo para "concluir o processo" o levaria a
   * uma tela vazia.
   */
  async sendFeedbackDisponivel(toEmail: string, nome: string, gestorNome: string): Promise<boolean> {
    const link = `${this.appUrl}/dashboard/meu-rh?aba=feedback`;
    const passo = (n: number, texto: string) => `
      <tr>
        <td style="vertical-align:top;padding:6px 12px 6px 0;width:28px">
          <span style="display:inline-block;width:24px;height:24px;line-height:24px;border-radius:12px;background:${this.accent};color:#fff;font-size:12px;font-weight:700;text-align:center">${n}</span>
        </td>
        <td style="vertical-align:top;padding:8px 0;font-size:14px;color:#374151;line-height:1.5">${texto}</td>
      </tr>`;
    return this.send(
      toEmail,
      `Você recebeu um feedback — ${MARCA}`,
      this.layout(`
        <p>Olá, <strong>${this.esc(nome)}</strong>!</p>
        <p>Você recebeu um feedback de <strong>${this.esc(gestorNome)}</strong>, apresentado na reunião de vocês. Agora falta só a sua parte para concluir o processo:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px">
          ${passo(1, `Acesse o <strong>${this.esc(MARCA)}</strong> com o seu usuário e senha.`)}
          ${passo(2, `No menu, abra <strong>People › Meu RH</strong>.`)}
          ${passo(3, `Clique na aba <strong>Feedback</strong>.`)}
          ${passo(4, `Leia o feedback: pontos fortes, oportunidades de desenvolvimento e os próximos passos combinados.`)}
          ${passo(5, `Clique em <strong>Registrar ciência</strong>. Se quiser, deixe um comentário — ele fica registrado junto, sem alterar o texto do gestor.`)}
        </table>
        <div style="text-align:center;margin:24px 0;">
          <a href="${link}" class="btn">Abrir meu feedback</a>
        </div>
        <div class="info-box" style="font-size:12px;color:#6b7280;">
          Registrar ciência confirma que você leu o feedback e participou da conversa. Não significa concordar com tudo — use o comentário para registrar a sua visão.
        </div>
        <p style="font-size:11px;color:#9ca3af;">Se o botão não funcionar, copie e cole este endereço no navegador:<br>
        <span style="word-break:break-all;">${link}</span></p>
      `),
    );
  }

  /** Email genérico para automações — assunto e corpo definidos pelo usuário */
  async sendGeneric(toEmail: string, nome: string, assunto: string, mensagem: string): Promise<boolean> {
    return this.send(
      toEmail,
      assunto,
      this.layout(`
        <p>Olá${nome ? `, <strong>${nome}</strong>` : ""}!</p>
        <div style="white-space:pre-line;font-size:14px;color:#374151;line-height:1.6">${mensagem.replace(/\n/g, "<br>")}</div>
        <p style="font-size:12px;color:#9ca3af;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:12px">
          Este e-mail foi enviado automaticamente pelo ${MARCA}.
        </p>
      `)
    );
  }
}
