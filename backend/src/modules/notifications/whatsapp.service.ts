import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly defaultInstance = "orkestri";
  private apiUrl: string;
  private apiKey: string;

  constructor(private config: ConfigService, private prisma?: PrismaService) {
    this.apiUrl = config.get("EVOLUTION_API_URL", "http://evolution:8080");
    this.apiKey = config.get("EVOLUTION_API_KEY", "orkestri_evolution_key");
    this.logger.log("Evolution URL: " + this.apiUrl);
  }

  private get headers() {
    return { "Content-Type": "application/json", "apikey": this.apiKey };
  }

  private async callApi(method: string, path: string, body?: any) {
    const res = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: this.headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    try { return await res.json(); } catch { return {}; }
  }

  // ── Instance management (per-tenant) ──────────────────────────────────────

  async createInstance(instanceName: string = this.defaultInstance) {
    try {
      try {
        await fetch(`${this.apiUrl}/instance/delete/${instanceName}`, { method: "DELETE", headers: this.headers });
        await new Promise(r => setTimeout(r, 2000));
      } catch {}
      const data = await this.callApi("POST", "/instance/create", {
        instanceName, qrcode: true, integration: "WHATSAPP-BAILEYS", alwaysOnline: true,
      });
      this.logger.log("Instance created [" + instanceName + "]: " + JSON.stringify(data).slice(0, 200));
      return data;
    } catch (e) {
      this.logger.error("createInstance error: " + e.message);
      return { error: e.message };
    }
  }

  async getQrCode(instanceName: string = this.defaultInstance) {
    for (let i = 0; i < 10; i++) {
      try {
        const data = await this.callApi("GET", `/instance/connect/${instanceName}`);
        this.logger.log("QR #" + i + " [" + instanceName + "]: " + JSON.stringify(data).slice(0, 150));
        if (data?.base64 || data?.qrcode?.base64 || data?.code) return data;
      } catch {}
      await new Promise(r => setTimeout(r, 2000));
    }
    return { error: "QR indisponivel" };
  }

  async getStatus(instanceName: string = this.defaultInstance) {
    try {
      const r1 = await fetch(`${this.apiUrl}/instance/connectionState/${instanceName}`, { headers: this.headers });
      if (r1.ok) {
        const d1 = await r1.json();
        const state = d1?.instance?.state || d1?.state || "";
        if (state) return { connected: state === "open", status: state };
      }
      const d2 = await this.callApi("GET", "/instance/fetchInstances");
      const inst = Array.isArray(d2)
        ? d2.find((i: any) => i?.instance?.instanceName === instanceName || i?.instanceName === instanceName)
        : (d2?.instance?.instanceName === instanceName ? d2 : null);
      if (!inst) return { connected: false, status: "not_found" };
      const state = inst?.instance?.state || inst?.state || "unknown";
      return { connected: ["open", "connected"].includes(state), status: state };
    } catch (e) {
      return { connected: false, status: "error", error: e.message };
    }
  }

  async disconnect(instanceName: string = this.defaultInstance) {
    try {
      await fetch(`${this.apiUrl}/instance/logout/${instanceName}`, { method: "DELETE", headers: this.headers });
    } catch {}
    return { ok: true };
  }

  // ── Messaging ─────────────────────────────────────────────────────────────

  async sendMessage(phone: string, message: string, instanceName: string = this.defaultInstance): Promise<boolean> {
    try {
      const status = await this.getStatus(instanceName);
      if (!status.connected) {
        this.logger.warn(`WA desconectado [${instanceName}] (${status.status}) - msg nao enviada para ${phone}`);
        return false;
      }
      const digits = phone.replace(/\D/g, "");
      const number = digits.startsWith("55") ? digits : "55" + digits;
      this.logger.log(`Enviando WA [${instanceName}] para: ${number}`);
      const res = await fetch(`${this.apiUrl}/message/sendText/${instanceName}`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ number, options: { delay: 1200, presence: "composing" }, textMessage: { text: message } }),
      });
      const raw = await res.text();
      this.logger.log(`WA send [${instanceName}][${res.status}]: ${raw.slice(0, 300)}`);
      try {
        const d = JSON.parse(raw);
        return !!(d?.key?.id || d?.id || res.ok);
      } catch { return res.ok; }
    } catch (e) {
      this.logger.error("sendMessage error: " + e.message);
      return false;
    }
  }

  async sendMessageForOrg(orgId: string, phone: string, message: string): Promise<boolean> {
    let instanceName = this.defaultInstance;
    if (this.prisma && orgId) {
      try {
        const cfg = await (this.prisma as any).orgWhatsappConfig.findUnique({ where: { organizationId: orgId } });
        if (cfg?.instanceName && cfg?.conectado) instanceName = cfg.instanceName;
      } catch {}
    }
    return this.sendMessage(phone, message, instanceName);
  }

  // ── Per-org instance management ───────────────────────────────────────────

  async getOrgInstance(orgId: string) {
    if (!this.prisma) return null;
    return (this.prisma as any).orgWhatsappConfig.findUnique({ where: { organizationId: orgId } });
  }

  async createOrgInstance(orgId: string, slug: string) {
    const instanceName = `orkestri-${slug}`;
    const result = await this.createInstance(instanceName);
    if (!result.error && this.prisma) {
      await (this.prisma as any).orgWhatsappConfig.upsert({
        where: { organizationId: orgId },
        create: { organizationId: orgId, instanceName, conectado: false },
        update: { instanceName, conectado: false },
      });
    }
    return { ...result, instanceName };
  }

  async getOrgQrCode(orgId: string) {
    const cfg = await this.getOrgInstance(orgId);
    const instanceName = cfg?.instanceName || `orkestri-${orgId}`;
    return this.getQrCode(instanceName);
  }

  async getOrgStatus(orgId: string) {
    const cfg = await this.getOrgInstance(orgId);
    if (!cfg) return { connected: false, status: "not_configured" };
    const status = await this.getStatus(cfg.instanceName);
    if (this.prisma) {
      await (this.prisma as any).orgWhatsappConfig.update({
        where: { organizationId: orgId },
        data: { conectado: status.connected, ...(status.connected ? { ultimaConexao: new Date() } : {}) },
      }).catch(() => {});
    }
    return status;
  }

  async disconnectOrg(orgId: string) {
    const cfg = await this.getOrgInstance(orgId);
    if (!cfg) return { ok: false, error: "not_configured" };
    const result = await this.disconnect(cfg.instanceName);
    if (this.prisma) {
      await (this.prisma as any).orgWhatsappConfig.update({
        where: { organizationId: orgId },
        data: { conectado: false },
      }).catch(() => {});
    }
    return result;
  }

  // ── Typed message helpers ──────────────────────────────────────────────────

  async sendTest(phone: string, instanceName?: string): Promise<boolean> {
    const msg = "*Orkestri* - Teste de conexao\n\nSeu WhatsApp esta configurado corretamente!\nVoce recebera alertas de eventos por aqui.";
    return this.sendMessage(phone, msg, instanceName);
  }

  async sendEventAlert(phone: string, eventName: string, minutosRestantes: number, appUrl: string, instanceName?: string): Promise<boolean> {
    const tempo = minutosRestantes <= 0 ? "agora" : `em ${minutosRestantes} minuto${minutosRestantes > 1 ? "s" : ""}`;
    const msg = `*Orkestri - Lembrete*\n\nVoce tem um evento *${tempo}*:\n\n- ${eventName}\n\nAcesse: ${appUrl}/dashboard/agenda`;
    return this.sendMessage(phone, msg, instanceName);
  }

  async sendChamadoAberto(phone: string, numero: number, titulo: string, prioridade: string, slaHoras: number | null, appUrl: string, instanceName?: string): Promise<boolean> {
    const slaText = slaHoras ? `\n*SLA:* Resposta em ate ${slaHoras}h` : "";
    const prio = { baixa: "Baixa", media: "Media", alta: "Alta", critica: "CRITICA" }[prioridade] ?? prioridade;
    const msg = `*Orkestri - Chamado #${numero} aberto*\n\nSeu chamado foi registrado com sucesso.\n*Assunto:* ${titulo}\n*Prioridade:* ${prio}${slaText}\n\nAcompanhe: ${appUrl}/dashboard/chamados`;
    return this.sendMessage(phone, msg, instanceName);
  }

  async sendChamadoAtribuido(phone: string, numero: number, titulo: string, prioridade: string, deadline: Date | null, appUrl: string, instanceName?: string): Promise<boolean> {
    const prio = { baixa: "Baixa", media: "Media", alta: "Alta", critica: "CRITICA" }[prioridade] ?? prioridade;
    const prazoText = deadline
      ? `\n*Prazo SLA:* ${deadline.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}`
      : "";
    const msg = `*Orkestri - Chamado #${numero} atribuido a voce*\n\n*Assunto:* ${titulo}\n*Prioridade:* ${prio}${prazoText}\n\nAcesse: ${appUrl}/dashboard/chamados`;
    return this.sendMessage(phone, msg, instanceName);
  }

  async sendChamadoStatus(phone: string, numero: number, titulo: string, status: string, appUrl: string, instanceName?: string): Promise<boolean> {
    const labels: Record<string, string> = { em_atendimento: "Em atendimento", aguardando: "Aguardando sua resposta", resolvido: "Resolvido", fechado: "Fechado" };
    const msg = `*Orkestri - Chamado #${numero} atualizado*\n\nNovo status: *${labels[status] || status}*\n*Assunto:* ${titulo}\n\nAcompanhe: ${appUrl}/dashboard/chamados`;
    return this.sendMessage(phone, msg, instanceName);
  }

  async sendChamadoResolvido(phone: string, numero: number, titulo: string, appUrl: string, instanceName?: string): Promise<boolean> {
    const msg = `*Orkestri - Chamado #${numero} resolvido*\n\nSeu chamado foi resolvido!\n*Assunto:* ${titulo}\n\nAvalie o atendimento de 1 a 5 acessando:\n${appUrl}/dashboard/chamados`;
    return this.sendMessage(phone, msg, instanceName);
  }

  async sendSlaRisco(phone: string, numero: number, titulo: string, restanteMins: number, appUrl: string, instanceName?: string): Promise<boolean> {
    const tempo = restanteMins >= 60 ? `${Math.floor(restanteMins / 60)}h ${restanteMins % 60}min` : `${restanteMins}min`;
    const msg = `*Orkestri - SLA em Risco*\n\nChamado *#${numero}* esta proximo do prazo!\n*${titulo}*\n*Restam:* ${tempo}\n\nAcesse agora: ${appUrl}/dashboard/chamados`;
    return this.sendMessage(phone, msg, instanceName);
  }

  async sendOtp(phone: string, code: string, instanceName?: string): Promise<boolean> {
    const msg = `*Orquestrador de Demandas*\n\nSeu código de recuperação de senha é:\n\n*${code}*\n\nEsse código expira em 5 minutos.\nNão compartilhe com ninguém.`;
    return this.sendMessage(phone, msg, instanceName);
  }

  async sendAccountApproved(phone: string, nome: string, email: string, appUrl: string, instanceName?: string): Promise<boolean> {
    const msg = `Olá, *${nome}*!\n\nSeu cadastro no *Orkestri* foi concluído com sucesso.\n\nAcesse com suas credenciais:\n*E-mail:* ${email}\n*Senha:* 123@mudar\n\nAcesse: ${appUrl}/login\n\nVocê será solicitado a alterar sua senha no primeiro acesso.`;
    return this.sendMessage(phone, msg, instanceName);
  }

  async sendAccountRejected(phone: string, nome: string, instanceName?: string): Promise<boolean> {
    const msg = `Olá, *${nome}*!\n\nInfelizmente, seu pedido de acesso ao *Orkestri* foi recusado.\n\nPara mais informações, entre em contato com o administrador do sistema.`;
    return this.sendMessage(phone, msg, instanceName);
  }

  async sendSlaViolado(phone: string, numero: number, titulo: string, atrasadoMins: number, appUrl: string, instanceName?: string): Promise<boolean> {
    const tempo = atrasadoMins >= 60 ? `${Math.floor(atrasadoMins / 60)}h ${atrasadoMins % 60}min` : `${atrasadoMins}min`;
    const msg = `*Orkestri - SLA VIOLADO*\n\nChamado *#${numero}* esta em atraso!\n*${titulo}*\n*Atraso:* ${tempo}\n\nAcesse: ${appUrl}/dashboard/chamados`;
    return this.sendMessage(phone, msg, instanceName);
  }
}
