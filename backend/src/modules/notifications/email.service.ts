import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
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
  private from: string;
  private appUrl: string;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>("RESEND_API_KEY", "");
    const fromName = this.config.get<string>("EMAIL_FROM_NAME", MARCA);
    const fromAddr = this.config.get<string>("EMAIL_FROM", "onboarding@resend.dev");
    this.from = `${fromName} <${fromAddr}>`;
    this.appUrl = this.config.get<string>("APP_URL", "http://localhost");
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn("RESEND_API_KEY não configurada — envio de e-mails desativado.");
    }
  }

  /** Indica se há provedor de e-mail configurado (RESEND_API_KEY presente). */
  isEnabled(): boolean {
    return this.resend !== null;
  }

  private async send(to: string, subject: string, html: string): Promise<boolean> {
    if (!to || !this.resend) {
      this.logger.warn(`Email não enviado para ${to || "(vazio)"} — serviço de e-mail indisponível.`);
      return false;
    }
    try {
      const res: any = await this.resend.emails.send({ from: this.from, to, subject, html });
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
    if (!to || !this.resend) {
      this.logger.warn(`Email com anexo não enviado para ${to || "(vazio)"} — serviço de e-mail indisponível.`);
      return false;
    }
    try {
      const res: any = await this.resend.emails.send({
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
