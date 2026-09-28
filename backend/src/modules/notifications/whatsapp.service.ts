import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { MARCA } from "../../common/marca";

/**
 * A marca vem de `common/marca`, que lê do ambiente.
 *
 * Este arquivo declarava a própria constante `const MARCA = "Orkiestri"` — o
 * template usava `${MARCA}` e parecia certo, mas era a constante LOCAL. Toda
 * mensagem de WhatsApp saía com a marca do produto: em homologação, o cliente
 * recebia no celular dele um código de recuperação assinado "Orkiestri".
 *
 * Descoberto num teste de envio real, não na leitura do código — a linha do
 * template parecia correta em qualquer revisão.
 */

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

  /**
   * Prepara a instância para parear — NUNCA apaga a que existe.
   *
   * Antes, "Criar instância" começava com `DELETE /instance/delete`. Em
   * homologação isso derrubou a conexão duas vezes (11/09/2026 com o aparelho
   * pareado, e 14/09): um clique a mais apagava a sessão boa, e a conexão
   * aberta passava a falhar ao gravar numa instância que não existia mais.
   *
   *  · já conectada → não mexe;
   *  · existe mas não conectada (QR vencido, limite de QR atingido) → logout,
   *    que zera a sessão e o contador de QR sem apagar o registro;
   *  · não existe → cria.
   */
  async createInstance(instanceName: string = this.defaultInstance) {
    try {
      const atual = await this.getStatus(instanceName);
      if (atual.connected) return { instanceName, jaConectada: true, status: atual.status };
      if (atual.status !== "not_found" && atual.status !== "error") {
        await fetch(`${this.apiUrl}/instance/logout/${instanceName}`, { method: "DELETE", headers: this.headers }).catch(() => {});
        this.logger.log(`Instância reiniciada (logout) [${instanceName}] estado anterior: ${atual.status}`);
        return { instanceName, reiniciada: true, status: atual.status };
      }
      const data = await this.callApi("POST", "/instance/create", {
        // Token explícito por instância. Sem ele, o Evolution v1.8.2 gera um
        // token padrão que COLIDE com a chave global (AUTHENTICATION_API_KEY) e
        // faz TODO create falhar com "Token already exists" — nenhuma instância
        // nova conecta. Um UUID único evita a colisão. Este token não é usado
        // nas demais chamadas: elas autenticam pela apikey global.
        instanceName, token: require("crypto").randomUUID(),
        qrcode: true, integration: "WHATSAPP-BAILEYS", alwaysOnline: true,
      });
      this.logger.log("Instance created [" + instanceName + "]: " + JSON.stringify(data).slice(0, 200));
      return data;
    } catch (e) {
      this.logger.error("createInstance error: " + e.message);
      return { error: e.message };
    }
  }

  /**
   * Liga o webhook de ENTRADA da instância no Evolution: manda os eventos de
   * mensagem recebida (MESSAGES_UPSERT) para a nossa URL. É o que permite
   * "responder no WhatsApp -> cria evento na agenda". A URL deve conter o
   * ?secret=... que o endpoint /whatsapp/inbound valida.
   */
  async setInboundWebhook(url: string, instanceName: string = this.defaultInstance) {
    try {
      // Evolution v2: webhook aninhado com flags em camelCase (webhookByEvents/
      // webhookBase64). enabled/url/events mantêm o mesmo nome.
      const body = { webhook: { url, enabled: true, webhookByEvents: false, webhookBase64: false, events: ["MESSAGES_UPSERT"] } };
      const data = await this.callApi("POST", `/webhook/set/${instanceName}`, body);
      this.logger.log(`setInboundWebhook [${instanceName}] -> ${JSON.stringify(data).slice(0, 200)}`);
      return data;
    } catch (e) {
      this.logger.error("setInboundWebhook error: " + e.message);
      return { error: e.message };
    }
  }

  /**
   * Reinicia (reconecta) uma instância SEM logout — mantém a sessão (file store),
   * não pede QR. É o conserto do "Waiting for this message"/sessão instável.
   * Evolution v1.8.2: PUT /instance/restart/{instance}.
   */
  async restartInstance(instanceName: string) {
    try {
      const r = await fetch(`${this.apiUrl}/instance/restart/${instanceName}`, { method: "PUT", headers: this.headers });
      this.logger.log(`restartInstance [${instanceName}] status=${r.status}`);
      return { instance: instanceName, ok: r.ok, status: r.status };
    } catch (e: any) {
      this.logger.error(`restartInstance error [${instanceName}]: ${e.message}`);
      return { instance: instanceName, ok: false, error: e.message };
    }
  }

  /** Reinicia todas as instâncias do Evolution (o "reiniciar o bot" do super admin). */
  async restartAllInstances() {
    try {
      const d = await this.callApi("GET", "/instance/fetchInstances");
      const arr = Array.isArray(d) ? d : [d];
      const nomes = arr.map((i: any) => i?.instance?.instanceName || i?.instanceName || i?.name).filter(Boolean);
      const restarted: any[] = [];
      for (const n of nomes) restarted.push(await this.restartInstance(n));
      return { total: nomes.length, restarted };
    } catch (e: any) {
      this.logger.error(`restartAllInstances error: ${e.message}`);
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
        body: JSON.stringify({ number, text: message, delay: 1200 }),
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

  /**
   * Resolve a instância WhatsApp de uma organização (ou a default se não houver).
   *
   * Só o NOME importa aqui. A flag `conectado` é cache, e cache envelhece: em
   * produção ela ficou `false` enquanto a instância estava `open`, e o
   * resultado foi cair na default `orkestri` — que não existe — e derrubar
   * silenciosamente todo envio da organização, inclusive o OTP de recuperação
   * de senha. Quem decide se dá para enviar é `getStatus`, que pergunta ao
   * Evolution na hora do envio; consultar o cache antes só acrescenta um jeito
   * de errar.
   */
  /**
   * Envia para um JID CRU (ex.: "<lid>@lid" ou "<phone>@s.whatsapp.net") sem
   * reformatar como telefone. Necessário para responder a quem escreve via
   * @lid — o `sendMessage` força prefixo 55 e strippa não-dígitos, o que
   * transformaria o LID num telefone inexistente.
   */
  async sendToJid(jid: string, message: string, instanceName: string = this.defaultInstance): Promise<boolean> {
    try {
      const res = await fetch(`${this.apiUrl}/message/sendText/${instanceName}`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ number: jid, text: message, delay: 1200 }),
      });
      const raw = await res.text();
      this.logger.log(`WA sendToJid [${instanceName}][${res.status}] -> ${jid}: ${raw.slice(0, 160)}`);
      try { const d = JSON.parse(raw); return !!(d?.key?.id || d?.id || res.ok); } catch { return res.ok; }
    } catch (e) {
      this.logger.error("sendToJid error: " + e.message);
      return false;
    }
  }

  /**
   * Envia um DOCUMENTO (ex.: PDF) lido do disco, como anexo. Evolution v2:
   * POST /message/sendMedia com {number, mediatype:"document", media:<base64>}.
   * `to` pode ser telefone (formatado com 55) ou um jid cru. Best-effort.
   */
  async sendDocumentFile(to: string, filePath: string, fileName: string, caption: string, instanceName: string = this.defaultInstance): Promise<boolean> {
    try {
      const digits = (to || "").replace(/\D/g, "");
      // Telefone → garante o 55; se não parecer telefone (ex.: veio um @lid), manda cru.
      const number = digits.length >= 8 ? (digits.startsWith("55") ? digits : "55" + digits) : to;
      const media = require("fs").readFileSync(filePath).toString("base64");
      const res = await fetch(`${this.apiUrl}/message/sendMedia/${instanceName}`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ number, mediatype: "document", mimetype: "application/pdf", media, fileName, caption }),
      });
      const raw = await res.text();
      this.logger.log(`WA sendDocument [${instanceName}][${res.status}] ${fileName} -> ${number}: ${raw.slice(0, 120)}`);
      return res.ok;
    } catch (e: any) {
      this.logger.error("sendDocumentFile error: " + e.message);
      return false;
    }
  }

  async resolveInstance(orgId?: string): Promise<string> {
    if (this.prisma && orgId) {
      try {
        const cfg = await (this.prisma as any).orgWhatsappConfig.findUnique({ where: { organizationId: orgId } });
        if (cfg?.instanceName) return cfg.instanceName;
      } catch {}
    }
    return this.defaultInstance;
  }

  async sendMessageForOrg(orgId: string, phone: string, message: string): Promise<boolean> {
    const instanceName = await this.resolveInstance(orgId);
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
  //
  // Padrão destas mensagens (revisado 28/09/2026):
  //  - a PRIMEIRA linha diz o que aconteceu. Na lista de conversas do WhatsApp
  //    só o começo aparece; abrir com a marca obrigava a pessoa a entrar na
  //    conversa para descobrir do que se tratava.
  //  - a marca vai no rodapé, em itálico: identifica sem ocupar a prévia.
  //  - prazo em HORA ABSOLUTA. "Faltam 45 min" mente assim que a mensagem
  //    espera 20 minutos na tela; "vence às 15:40" continua verdade.
  //  - o link aponta para O chamado, não para a lista.

  /** Rodapé com a marca — sempre a última linha. */
  private get assinatura(): string {
    return `\n\n_${MARCA}_`;
  }

  /**
   * Prioridade como a tela de Chamados mostra — sem acento, "CRITICA" lia-se
   * como o verbo criticar. O fallback capitaliza em vez de devolver o valor
   * cru: a base tem `urgente`, que não está no mapa de nenhuma tela, e sem
   * isto a mensagem sairia com "*Prioridade:* urgente" em minúscula.
   */
  private prioridadeLabel(p: string): string {
    const mapa: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta", critica: "Crítica" };
    return mapa[p] ?? (p ? p.charAt(0).toUpperCase() + p.slice(1) : "—");
  }

  /** Hora do prazo; inclui a data só quando não é hoje. */
  private horaLimite(d: Date): string {
    const tz = "America/Sao_Paulo";
    const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: tz });
    const dia = d.toLocaleDateString("pt-BR", { timeZone: tz });
    const hora = d.toLocaleTimeString("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
    return dia === hoje ? `às ${hora}` : `em ${dia} às ${hora}`;
  }

  private linkChamado(appUrl: string, chamadoId: string): string {
    return `${appUrl}/dashboard/chamados/${chamadoId}`;
  }

  /** Duração em pt-BR; omite os minutos quando são zero ("26h", não "26h 0min"). */
  private duracao(mins: number): string {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}min`;
  }

  async sendTest(phone: string, instanceName?: string): Promise<boolean> {
    const msg = `✅ *WhatsApp configurado*\n\nEstá tudo certo — os lembretes da sua agenda chegam por aqui.${this.assinatura}`;
    return this.sendMessage(phone, msg, instanceName);
  }

  async sendEventAlert(phone: string, eventName: string, minutosRestantes: number, appUrl: string, instanceName?: string): Promise<boolean> {
    const quando = minutosRestantes <= 0
      ? "Começando agora"
      : `Começa em ${minutosRestantes} minuto${minutosRestantes > 1 ? "s" : ""}`;
    const msg = `⏰ *${quando}*\n\n${eventName}\n\nAbrir agenda: ${appUrl}/dashboard/agenda${this.assinatura}`;
    return this.sendMessage(phone, msg, instanceName);
  }

  async sendChamadoAberto(phone: string, numero: number, chamadoId: string, titulo: string, prioridade: string, slaHoras: number | null, appUrl: string, instanceName?: string): Promise<boolean> {
    const slaText = slaHoras ? `\n*Prazo de resposta:* até ${slaHoras}h` : "";
    const msg = `🎫 *Chamado #${numero} registrado*\n\n${titulo}\n*Prioridade:* ${this.prioridadeLabel(prioridade)}${slaText}\n\nAcompanhar: ${this.linkChamado(appUrl, chamadoId)}${this.assinatura}`;
    return this.sendMessage(phone, msg, instanceName);
  }

  async sendChamadoAtribuido(phone: string, numero: number, chamadoId: string, titulo: string, prioridade: string, deadline: Date | null, appUrl: string, instanceName?: string): Promise<boolean> {
    const prazoText = deadline ? `\n*Prazo:* vence ${this.horaLimite(deadline)}` : "";
    const msg = `👤 *Chamado #${numero} é seu agora*\n\n${titulo}\n*Prioridade:* ${this.prioridadeLabel(prioridade)}${prazoText}\n\nAbrir: ${this.linkChamado(appUrl, chamadoId)}${this.assinatura}`;
    return this.sendMessage(phone, msg, instanceName);
  }

  async sendChamadoStatus(phone: string, numero: number, chamadoId: string, titulo: string, status: string, appUrl: string, instanceName?: string): Promise<boolean> {
    const labels: Record<string, string> = { em_atendimento: "Em atendimento", aguardando: "Aguardando sua resposta", resolvido: "Resolvido", fechado: "Fechado" };
    const msg = `🔄 *Chamado #${numero} — ${labels[status] || status}*\n\n${titulo}\n\nAcompanhar: ${this.linkChamado(appUrl, chamadoId)}${this.assinatura}`;
    return this.sendMessage(phone, msg, instanceName);
  }

  async sendChamadoResolvido(phone: string, numero: number, chamadoId: string, titulo: string, appUrl: string, instanceName?: string): Promise<boolean> {
    // Não prometemos a avaliação aqui: o link abre o chamado, não a tela de
    // nota. Pedir algo que a mensagem não entrega é pior que não pedir.
    const msg = `✅ *Chamado #${numero} resolvido*\n\n${titulo}\n\nVer o atendimento: ${this.linkChamado(appUrl, chamadoId)}${this.assinatura}`;
    return this.sendMessage(phone, msg, instanceName);
  }

  async sendSlaRisco(phone: string, numero: number, chamadoId: string, titulo: string, restanteMins: number, appUrl: string, instanceName?: string): Promise<boolean> {
    const tempo = this.duracao(restanteMins);
    const vence = this.horaLimite(new Date(Date.now() + restanteMins * 60000));
    const msg = `⏱️ *SLA vence ${vence}* — faltam ${tempo}\n\nChamado #${numero}\n${titulo}\n\nAbrir: ${this.linkChamado(appUrl, chamadoId)}${this.assinatura}`;
    return this.sendMessage(phone, msg, instanceName);
  }

  /** OTP pela instância da organização do usuário — ver `sendOtpForOrg`. */
  async sendOtpForOrg(orgId: string | undefined, phone: string, code: string): Promise<boolean> {
    return this.sendOtp(phone, code, await this.resolveInstance(orgId));
  }

  async sendOtp(phone: string, code: string, instanceName?: string): Promise<boolean> {
    const msg = `*${MARCA}*\n\nSeu código de recuperação de senha é:\n\n*${code}*\n\nEsse código expira em 5 minutos.\nNão compartilhe com ninguém.`;
    return this.sendMessage(phone, msg, instanceName);
  }

  /** Código de verificação do acesso de teste (não é recuperação de senha). */
  async sendTrialOtp(phone: string, code: string, instanceName?: string): Promise<boolean> {
    const msg = `*${MARCA}*\n\nSeu código para liberar o acesso de teste é:\n\n*${code}*\n\nDigite-o na tela para começar. Expira em 10 minutos.`;
    return this.sendMessage(phone, msg, instanceName);
  }

  async sendAccountApproved(phone: string, nome: string, email: string, senha: string, appUrl: string, instanceName?: string): Promise<boolean> {
    const msg = `Olá, *${nome}*!\n\nSeu cadastro no *${MARCA}* foi concluído com sucesso.\n\nAcesse com suas credenciais:\n*E-mail:* ${email}\n*Senha temporária:* ${senha}\n\nAcesse: ${appUrl}/login\n\nVocê deverá alterar sua senha no primeiro acesso.`;
    return this.sendMessage(phone, msg, instanceName);
  }

  /**
   * Boas-vindas do acesso de teste (trial). Mensagem única, independente do
   * módulo escolhido — traz as credenciais e enquadra os 7 dias + o contato de
   * conversão no vencimento.
   */
  async sendTrialWelcome(phone: string, email: string, senha: string, appUrl: string, dias: number, instanceName?: string): Promise<boolean> {
    const msg = `*Bem-vindo à ${MARCA}!* 🎉\n\nSeu acesso de teste está liberado por *${dias} dias*.\n\n🔑 *Login:* ${email}\n🔒 *Senha:* ${senha}\n👉 Entrar: ${appUrl}/login\n_(troque a senha no primeiro acesso)_\n\nAproveite para explorar. Quando os ${dias} dias acabarem, a gente fala com você por aqui mesmo para liberar seu acesso completo. Bom teste! 🚀`;
    return this.sendMessage(phone, msg, instanceName);
  }

  async sendAccountRejected(phone: string, nome: string, instanceName?: string): Promise<boolean> {
    const msg = `Olá, *${nome}*!\n\nInfelizmente, seu pedido de acesso ao *${MARCA}* foi recusado.\n\nPara mais informações, entre em contato com o administrador do sistema.`;
    return this.sendMessage(phone, msg, instanceName);
  }

  async sendSlaViolado(phone: string, numero: number, chamadoId: string, titulo: string, atrasadoMins: number, appUrl: string, instanceName?: string): Promise<boolean> {
    const tempo = this.duracao(atrasadoMins);
    const venceu = this.horaLimite(new Date(Date.now() - atrasadoMins * 60000));
    const msg = `🚨 *SLA venceu ${venceu}* — ${tempo} de atraso\n\nChamado #${numero}\n${titulo}\n\nAbrir: ${this.linkChamado(appUrl, chamadoId)}${this.assinatura}`;
    return this.sendMessage(phone, msg, instanceName);
  }
}
