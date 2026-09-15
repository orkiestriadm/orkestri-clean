import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SubscriptionService } from "./webhooks/subscription.service";

const PROVIDER = "microsoft";

export type AcessoStatus = "nenhum" | "pendente" | "liberado" | "recusado" | "removido";
export type AcaoAdmin = "liberar" | "recusar" | "remover";

/**
 * Liberação da integração com o Outlook.
 *
 * O Space é de todos, mas conectar o Outlook passa por um administrador: o
 * usuário solicita dentro do Space, quem tem `integracoes:configurar` (ADM/SA)
 * libera no modal de usuários, e só então o botão de conectar aparece. A
 * autorização final na Microsoft continua sendo do próprio usuário — o fluxo
 * delegado não permite que outra pessoa entre na conta dele.
 */
@Injectable()
export class IntegrationAccessService {
  private readonly logger = new Logger(IntegrationAccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  private get db() { return this.prisma as any; }

  async getStatus(userId: string): Promise<AcessoStatus> {
    const row = await this.db.calendarIntegrationAccess.findUnique({
      where: { userId_provider: { userId, provider: PROVIDER } },
      select: { status: true },
    });
    return (row?.status as AcessoStatus) || "nenhum";
  }

  async isLiberado(userId: string): Promise<boolean> {
    return (await this.getStatus(userId)) === "liberado";
  }

  /** O usuário pede a integração. Pedir de novo enquanto pendente não reavisa ninguém. */
  async solicitar(user: { id: string; organizationId: string }): Promise<{ status: AcessoStatus }> {
    const atual = await this.getStatus(user.id);
    if (atual === "liberado" || atual === "pendente") return { status: atual };

    const agora = new Date();
    const row = await this.db.calendarIntegrationAccess.upsert({
      where: { userId_provider: { userId: user.id, provider: PROVIDER } },
      create: { organizationId: user.organizationId, userId: user.id, provider: PROVIDER, status: "pendente", solicitadoEm: agora },
      update: { status: "pendente", solicitadoEm: agora, decididoPorId: null, decididoEm: null },
    });

    const solicitante = await this.prisma.user.findUnique({ where: { id: user.id }, select: { nome: true } });
    await this.avisarAdmins(user.organizationId, user.id, solicitante?.nome || "Um usuário", row.id);
    return { status: "pendente" };
  }

  /** Todos os usuários ativos da organização, com a situação da integração de cada um. */
  async listarUsuarios(organizationId: string) {
    const users = await this.db.user.findMany({
      where: { organizationId, ativo: true },
      orderBy: { nome: "asc" },
      select: {
        id: true, nome: true, email: true,
        calendarIntegrationAccess: { where: { provider: PROVIDER }, select: { status: true, solicitadoEm: true, decididoEm: true } },
        calendarConnections: { where: { provider: PROVIDER }, select: { status: true, providerEmail: true, lastSyncAt: true } },
      },
    });
    return users.map((u: any) => {
      const acesso = u.calendarIntegrationAccess[0];
      const conn = u.calendarConnections[0];
      const conectado = !!conn && conn.status !== "disconnected";
      return {
        id: u.id,
        nome: u.nome,
        email: u.email,
        acesso: (acesso?.status as AcessoStatus) || "nenhum",
        solicitadoEm: acesso?.solicitadoEm || null,
        decididoEm: acesso?.decididoEm || null,
        conexao: conectado
          ? { status: String(conn.status).toUpperCase(), email: conn.providerEmail, lastSyncAt: conn.lastSyncAt }
          : null,
      };
    });
  }

  /** Decisão do administrador sobre um usuário da própria organização. */
  async decidir(organizationId: string, adminId: string, userId: string, acao: AcaoAdmin) {
    const alvo = await this.prisma.user.findFirst({ where: { id: userId, organizationId }, select: { id: true } });
    if (!alvo) throw new NotFoundException("Usuário não encontrado nesta organização.");

    const status: AcessoStatus = acao === "liberar" ? "liberado" : acao === "recusar" ? "recusado" : "removido";
    const agora = new Date();
    await this.db.calendarIntegrationAccess.upsert({
      where: { userId_provider: { userId, provider: PROVIDER } },
      create: { organizationId, userId, provider: PROVIDER, status, decididoPorId: adminId, decididoEm: agora },
      update: { status, decididoPorId: adminId, decididoEm: agora },
    });

    let eventsRemoved = 0;
    if (acao === "remover") eventsRemoved = (await this.desconectar(userId)).eventsRemoved;

    const aviso = {
      liberar: {
        tipo: "integracao_365_liberada",
        titulo: "Integração com o Outlook liberada",
        mensagem: "Abra a Agenda do Space e clique em Conectar Outlook para concluir.",
      },
      recusar: {
        tipo: "integracao_365_recusada",
        titulo: "Integração com o Outlook não liberada",
        mensagem: "Sua solicitação foi recusada por um administrador.",
      },
      remover: {
        tipo: "integracao_365_removida",
        titulo: "Integração com o Outlook removida",
        mensagem: "Um administrador removeu a integração. Os compromissos futuros do Outlook saíram da sua agenda.",
      },
    }[acao];
    await this.db.notification.create({
      data: { userId, modulo: "space", ...aviso, referenciaTipo: "integracao_365", referenciaId: userId },
    }).catch(() => {});

    this.logger.log(`Integração Outlook: ${acao} para ${userId} por ${adminId}${acao === "remover" ? ` (${eventsRemoved} eventos futuros removidos)` : ""}`);
    return { status, eventsRemoved };
  }

  /**
   * Desliga a conexão: cancela assinaturas, apaga tokens e remove os
   * compromissos FUTUROS vindos do Outlook. O passado fica — é histórico.
   */
  async desconectar(userId: string, purgeAll = false): Promise<{ eventsRemoved: number }> {
    const conn = await this.prisma.calendarConnection.findFirst({ where: { userId, provider: PROVIDER } });
    if (!conn) return { eventsRemoved: 0 };

    await this.subscriptions.deleteForConnection(conn.id);

    const where: any = { connectionId: conn.id, provider: PROVIDER };
    if (!purgeAll) where.inicio = { gte: new Date() };
    const del = await this.prisma.event.deleteMany({ where });

    await this.prisma.calendarConnection.update({
      where: { id: conn.id },
      data: {
        status: "disconnected",
        accessTokenEnc: null,
        refreshTokenEnc: null,
        tokenExpiresAt: null,
        deltaLink: null,
        lastError: null,
      },
    });
    return { eventsRemoved: del.count };
  }

  /**
   * Sino para quem pode liberar: master, administrador ou papel com
   * `integracoes:configurar`. Vai direto para o sino, sem passar pela
   * preferência de notificação — é um pedido que espera resposta, e a
   * preferência nega por padrão.
   */
  private async avisarAdmins(organizationId: string, solicitanteId: string, nome: string, accessId: string) {
    const admins = await this.db.user.findMany({
      where: {
        organizationId,
        ativo: true,
        id: { not: solicitanteId },
        userRoles: {
          some: {
            role: {
              OR: [
                { isMaster: true },
                { nome: "administrador" },
                { rolePermissions: { some: { permission: { recurso: "integracoes", acao: "configurar" } } } },
              ],
            },
          },
        },
      },
      select: { id: true },
    });
    if (!admins.length) {
      this.logger.warn(`Solicitação de integração Outlook sem administrador para avisar (org ${organizationId})`);
      return;
    }
    await this.db.notification.createMany({
      data: admins.map((a: { id: string }) => ({
        userId: a.id,
        modulo: "space",
        tipo: "integracao_365_solicitacao",
        titulo: "Solicitação de integração com o Outlook",
        mensagem: `${nome} pediu para integrar a agenda do Space com o Outlook.`,
        referenciaTipo: "integracao_365",
        referenciaId: accessId,
      })),
    });
  }
}
