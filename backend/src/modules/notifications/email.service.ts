import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend;
  private from: string;
  private appUrl: string;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>("RESEND_API_KEY", "");
    const fromName = this.config.get<string>("EMAIL_FROM_NAME", "Orkestri");
    const fromAddr = this.config.get<string>("EMAIL_FROM", "onboarding@resend.dev");
    this.from = `${fromName} <${fromAddr}>`;
    this.appUrl = this.config.get<string>("APP_URL", "http://localhost");
    this.resend = new Resend(apiKey);
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!to) return;
    try {
      await this.resend.emails.send({ from: this.from, to, subject, html });
      this.logger.log(`Email enviado para ${to}: ${subject}`);
    } catch (e: any) {
      this.logger.error(`Erro ao enviar email para ${to}: ${e.message}`);
    }
  }

  // ── Templates base ─────────────────────────────────────────────────────────

  private layout(conteudo: string): string {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  body{margin:0;padding:0;background:#f4f4f8;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e}
  .wrap{max-width:580px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#1e1b4b,#4c1d95);padding:28px 32px;text-align:center}
  .header h1{color:#fff;font-size:22px;font-weight:800;margin:0;letter-spacing:-0.5px}
  .header span{color:#a78bfa;font-size:13px;font-weight:400}
  .body{padding:32px}
  .body p{margin:0 0 16px;font-size:14px;line-height:1.65;color:#374151}
  .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;margin-bottom:16px}
  .info-box{background:#f9f7ff;border:1px solid #ede9fe;border-radius:8px;padding:16px 20px;margin:16px 0}
  .info-row{display:flex;gap:8px;margin-bottom:8px;font-size:13px}
  .info-row:last-child{margin-bottom:0}
  .info-label{color:#6b7280;min-width:110px;flex-shrink:0}
  .info-value{color:#1e1b4b;font-weight:600;word-break:break-all}
  .btn{display:inline-block;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:700;font-size:14px;margin:8px 0}
  .footer{background:#f9f7ff;padding:20px 32px;text-align:center;font-size:11px;color:#9ca3af;border-top:1px solid #ede9fe}
  .divider{border:none;border-top:1px solid #ede9fe;margin:24px 0}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>Orkestri</h1>
    <span>Sistema de Gestão</span>
  </div>
  <div class="body">${conteudo}</div>
  <div class="footer">
    Você está recebendo este email pois possui uma conta no Orkestri.<br>
    © ${new Date().getFullYear()} Orkestri — Todos os direitos reservados.
  </div>
</div>
</body>
</html>`;
  }

  // ── Auth ───────────────────────────────────────────────────────────────────

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
      "Sua conta foi aprovada — Orkestri",
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
      "Solicitação de acesso — Orkestri",
      this.layout(`
        <p>Olá, <strong>${nome}</strong>.</p>
        <p>Infelizmente sua solicitação de acesso ao Orkestri não foi aprovada neste momento.</p>
        ${motivo ? `<div class="info-box"><p style="margin:0;font-size:13px"><strong>Motivo:</strong> ${motivo}</p></div>` : ""}
        <p>Em caso de dúvidas, entre em contato com o administrador do sistema.</p>
      `)
    );
  }

  async sendUserInvite(toEmail: string, nome: string, senhaTemp: string, orgNome: string): Promise<void> {
    await this.send(
      toEmail,
      `Você foi convidado para o Orkestri — ${orgNome}`,
      this.layout(`
        <p>Olá, <strong>${nome}</strong>!</p>
        <p>Você foi adicionado à organização <strong>${orgNome}</strong> no Orkestri.</p>
        <div class="info-box">
          <div class="info-row"><span class="info-label">E-mail:</span><span class="info-value">${toEmail}</span></div>
          <div class="info-row"><span class="info-label">Senha temporária:</span><span class="info-value">${senhaTemp}</span></div>
          <div class="info-row"><span class="info-label">Organização:</span><span class="info-value">${orgNome}</span></div>
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
}
