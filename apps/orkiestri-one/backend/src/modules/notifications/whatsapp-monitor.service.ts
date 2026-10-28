import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { WhatsAppService } from "./whatsapp.service";
import { EmailService } from "./email.service";
import * as crypto from "crypto";
import { resolverInstancia } from "./resolver-instancia";

/**
 * Vigia a conexão do WhatsApp e avisa quando ela cai.
 *
 * Motivação medida: em 04/08/2026 a instância foi desconectada de propósito
 * durante uma manutenção e **o sistema não reagiu de forma alguma** — nenhum
 * alerta, nenhum registro, nenhum aviso ao master. `sendMessage()` verificava o
 * status, escrevia um `warn` no log e devolvia `false`; todos os chamadores
 * usavam `.catch(() => {})`. Na prática, o celular ficar sem bateria numa
 * sexta-feira silenciava as notificações até alguém reparar na segunda.
 *
 * O aviso é feito por SISTEMA e E-MAIL de propósito: avisar pelo WhatsApp que o
 * WhatsApp caiu não funcionaria.
 */

/** Silêncio entre avisos da mesma organização, para não virar spam de queda. */
const REAVISO_MS = 6 * 3600000;

@Injectable()
export class WhatsAppMonitor {
  private readonly logger = new Logger(WhatsAppMonitor.name);
  /** Último estado conhecido por organização — a transição é o que importa. */
  private ultimoEstado = new Map<string, boolean>();
  private ultimoAviso = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private wa: WhatsAppService,
    private email: EmailService,
  ) {}
  private get db() { return this.prisma as any; }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async verificar() {
    try {
      const orgs = await this.db.organization.findMany({
        where: { statusOperacional: { not: "suspensa" } },
        select: { id: true, nome: true },
      }).catch(() => []);

      for (const org of orgs) {
        const instancia = await resolverInstancia(this.wa, org.id);
        if (!instancia) continue;

        const status = await this.wa.getStatus(instancia).catch(() => ({ connected: false, status: "error" }));
        const conectado = !!status?.connected;
        const anterior = this.ultimoEstado.get(org.id);
        this.ultimoEstado.set(org.id, conectado);

        // Espelha o estado no cadastro, para a tela mostrar sem consultar a
        // Evolution a cada abertura.
        await this.db.orgWhatsappConfig.updateMany({
          where: { organizationId: org.id },
          data: { conectado, ...(conectado ? { ultimaConexao: new Date() } : {}) },
        }).catch(() => {});

        // Só a TRANSIÇÃO conectado → caído gera aviso. Sem isso, uma instância
        // que nunca foi pareada dispararia alerta a cada 5 minutos para sempre.
        if (anterior === undefined) continue;
        if (anterior === conectado) continue;

        if (!conectado) await this.avisarQueda(org, instancia, status?.status);
        else this.logger.log(`WhatsApp reconectado [${instancia}] org=${org.id}`);
      }
    } catch (e: any) {
      this.logger.error("Monitor WhatsApp erro: " + e.message);
    }
  }

  private async avisarQueda(org: any, instancia: string, estado?: string) {
    const ultimo = this.ultimoAviso.get(org.id) || 0;
    if (Date.now() - ultimo < REAVISO_MS) return;
    this.ultimoAviso.set(org.id, Date.now());

    const titulo = "⚠️ WhatsApp desconectado";
    const mensagem =
      `A instância "${instancia}" perdeu a conexão (estado: ${estado || "desconhecido"}). ` +
      `As notificações por WhatsApp ficam na fila e serão entregues quando a conexão voltar. ` +
      `Reconecte em Configurações → WhatsApp.`;

    const masters = await this.db.user.findMany({
      where: { organizationId: org.id, ativo: true, userRoles: { some: { role: { isMaster: true } } } },
      select: { id: true, email: true },
    }).catch(() => []);

    for (const m of masters) {
      await this.db.notification.create({
        data: {
          userId: m.id, tipo: "whatsapp_desconectado", titulo, mensagem,
          referenciaTipo: "org_whatsapp_config", referenciaId: org.id,
        },
      }).catch(() => {});

      // O e-mail vai DIRETO, sem passar pela outbox: a outbox depende do worker
      // e do canal, e este aviso precisa sair justamente quando um canal está
      // quebrado. Colocá-lo na mesma fila que ele denuncia seria circular.
      if (m.email) {
        await this.email.enviarNotificacao(
          m.email, `[${org.nome}] WhatsApp desconectado`,
          `<p><strong>${titulo}</strong></p><p>${mensagem}</p>`,
        ).catch(() => {});
      }
    }

    // Registrado na trilha para constar no histórico junto com os envios.
    await this.db.notificacaoEnvio.create({
      data: {
        id: crypto.randomUUID(), organizationId: org.id, userId: null,
        canal: "sistema", destino: "masters", modulo: "core",
        tipo: "whatsapp_desconectado", severidade: "critico",
        titulo, mensagem, status: "enviada", enviadoEm: new Date(),
        chave: `wa-down::${org.id}::${new Date().toISOString().slice(0, 13)}`,
      },
    }).catch(() => {});

    this.logger.warn(`WhatsApp CAIU [${instancia}] org=${org.id} — ${masters.length} master(s) avisado(s)`);
  }
}
