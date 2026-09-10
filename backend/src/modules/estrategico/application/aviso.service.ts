import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { NotificacaoDispatcher } from "../../notifications/notificacao-dispatcher.service";

export type Aviso = {
  organizationId: string;
  userId: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  casoId?: string | null;
  tarefaId?: string | null;
  reuniaoId?: string | null;
  /** De-duplicação. Mesma chave, mesmo aviso: não sai de novo. */
  chave?: string;
  severidade?: "info" | "atencao" | "critico";
};

/**
 * Entrega de avisos do Strategy.
 *
 * O destinatário aqui é SEMPRE uma pessoa nomeada no próprio assunto — o
 * responsável pela ação, pela tarefa, o executivo. Por isso não passa pelo
 * filtro de preferência do despachante (que é negação por padrão e serve para
 * alertas de difusão), do mesmo modo que os Chamados: a regra de quem recebe
 * já foi aplicada antes.
 *
 * O sino é imediato. O e-mail só sai se a organização ligou `notificarEmail`
 * na configuração do módulo, e vai pela fila do despachante (vazão, silêncio
 * noturno, retentativa) — nunca direto.
 */
@Injectable()
export class AvisoService {
  private readonly logger = new Logger(AvisoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: NotificacaoDispatcher,
  ) {}

  private get db(): any {
    return this.prisma as any;
  }

  async avisar(a: Aviso, config?: { notificarEmail?: boolean }): Promise<boolean> {
    if (!a.userId) return false;

    if (a.chave) {
      try {
        await this.db.estrategicoAlertaEnvio.create({
          data: {
            organizationId: a.organizationId, casoId: a.casoId ?? null, tarefaId: a.tarefaId ?? null,
            chave: a.chave, tipo: a.tipo, destinatarioId: a.userId,
          },
        });
      } catch (e: any) {
        if (e?.code === "P2002") return false;
        throw e;
      }
    }

    const referencia = a.casoId
      ? { referenciaTipo: "estrategico_caso", referenciaId: a.casoId }
      : a.reuniaoId ? { referenciaTipo: "estrategico_reuniao", referenciaId: a.reuniaoId } : {};

    await this.db.notification.create({
      data: { userId: a.userId, tipo: a.tipo, modulo: "strategy", titulo: a.titulo, mensagem: a.mensagem, ...referencia },
    }).catch((e: any) => this.logger.warn(`Falha ao gravar notificação: ${e?.message}`));

    if (config?.notificarEmail) {
      const u = await this.db.user.findFirst({ where: { id: a.userId, ativo: true }, select: { email: true } });
      if (u?.email) {
        await this.dispatcher.enfileirarDireto({
          organizationId: a.organizationId, canal: "email", destino: u.email, modulo: "strategy",
          tipo: a.tipo, titulo: a.titulo, mensagem: a.mensagem,
          // O despachante fala "aviso"; aqui o nível intermediário se chama "atencao",
          // como o tom dos selos da tela.
          severidade: a.severidade === "atencao" ? "aviso" : a.severidade ?? "info",
          userId: a.userId, chave: a.chave,
        }).catch((e: any) => this.logger.warn(`Falha ao enfileirar e-mail: ${e?.message}`));
      }
    }
    return true;
  }
}
