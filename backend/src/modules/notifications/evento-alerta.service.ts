import { Injectable, Logger } from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { WhatsAppService } from "./whatsapp.service";
import { CalendarWritebackService } from "../integracoes/calendar/calendar-writeback.service";
import { antesDeEfeito, acaoUtil } from "../agenda/whatsapp-execucao";
import { horarioCompromisso, novaDataCompromisso } from "./evento-alerta-datas";

type Dono = { id: string; organizationId: string };
const ABERTOS = ["MENU", "AGUARDANDO_DATA"];

@Injectable()
export class EventoAlertaService {
  private logger = new Logger(EventoAlertaService.name);
  constructor(
    private prisma: PrismaService,
    private wa: WhatsAppService,
    private writeback: CalendarWritebackService,
  ) {}

  /** Claim durável: uma configuração por horário, mesmo após reiniciar a API. */
  async prepararEnvio(
    evento: any,
    minutos: number,
    instancia: string,
  ): Promise<string | null> {
    return this.prisma.$transaction(async (tx) => {
      const codigo = "E-" + randomBytes(6).toString("hex").toUpperCase();
      const expira = new Date(new Date(evento.inicio).getTime() + 24 * 3600000);
      await tx.$executeRaw`
        INSERT INTO whatsapp_evento_alertas(event_id,inicio,user_id,organization_id,instancia,codigo,expira_em)
        VALUES (${evento.id},${evento.inicio},${evento.userId},${evento.organizationId},${instancia},${codigo},${expira})
        ON CONFLICT(event_id,inicio) DO NOTHING
      `;
      const rows: any[] = await tx.$queryRaw`
        SELECT * FROM whatsapp_evento_alertas WHERE event_id=${evento.id} AND inicio=${evento.inicio} FOR UPDATE
      `;
      const row = rows[0];
      if (
        !row ||
        row.user_id !== evento.userId ||
        row.organization_id !== evento.organizationId ||
        ["CONFIRMADO", "ADIADO", "EXPIRADO"].includes(row.estado)
      )
        return null;
      const atual = await tx.event.findFirst({
        where: {
          id: evento.id,
          userId: evento.userId,
          organizationId: evento.organizationId,
          inicio: evento.inicio,
          externalCancelled: false,
          confirmado: true,
        },
      });
      if (
        !atual ||
        Object.prototype.hasOwnProperty.call(row.envios, String(minutos))
      )
        return null;
      await tx.$executeRaw`
        UPDATE whatsapp_evento_alertas SET envios=envios || jsonb_build_object(${String(minutos)}::text,'RESERVADO'::text),
          estado=CASE WHEN ${minutos} = 0 AND estado='PENDENTE' THEN 'MENU' ELSE estado END,
          instancia=${instancia}, atualizado_em=CURRENT_TIMESTAMP WHERE event_id=${evento.id} AND inicio=${evento.inicio}
      `;
      return row.codigo;
    });
  }

  async registrarEnvio(
    evento: any,
    minutos: number,
    ok: boolean,
  ): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE whatsapp_evento_alertas SET envios=envios || jsonb_build_object(${String(minutos)}::text,${ok ? "ENVIADO" : "FALHOU"}::text),
        estado=CASE WHEN ${minutos}=0 AND ${!ok} AND estado='MENU' THEN 'PENDENTE' ELSE estado END,
        atualizado_em=CURRENT_TIMESTAMP WHERE event_id=${evento.id} AND inicio=${evento.inicio}
    `;
  }

  mensagemAgora(evento: any, codigo: string): string {
    return `Seu compromisso *${evento.titulo}* está acontecendo agora.\n\n*1* — Confirmar participação e encerrar os avisos deste compromisso.\n*2* — Adiar e informar uma nova data e horário.\n\nResponda *1* ou *2*. Se houver mais de um aviso, use *1 ${codigo}* ou *2 ${codigo}*.\nHorários de Brasília.`;
  }

  async tratar(
    user: Dono,
    texto: string,
    conversa: string,
    instancia: string,
    permissoes: () => Promise<string[]>,
  ): Promise<boolean> {
    const t = texto.trim();
    const escolha = t.match(/^([12])(?:\s+(E-[A-F0-9]{12}))?[.!?]?$/i);
    const navegar = /^(menu|ajuda|come[cç]ar|pessoal|empresa|0)$/i.test(t);
    const cancelar = /^(cancelar|sair|parar)$/i.test(t);
    const resultado = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${user.id + ":" + instancia},0))`;
        const rows: any[] = await tx.$queryRaw`
        SELECT a.*, e.titulo FROM whatsapp_evento_alertas a JOIN events e ON e.id=a.event_id
        WHERE a.user_id=${user.id} AND a.organization_id=${user.organizationId} AND a.instancia=${instancia}
          AND a.expira_em>CURRENT_TIMESTAMP AND a.inicio=e.inicio AND e.user_id=${user.id}
          AND e.organization_id=${user.organizationId} AND e.external_cancelled=false
          AND a.estado IN ('MENU','AGUARDANDO_DATA','SUSPENSO')
        ORDER BY a.inicio, a.codigo FOR UPDATE OF a
      `;
        if (navegar) {
          await tx.$executeRaw`UPDATE whatsapp_evento_alertas SET estado='SUSPENSO', atualizado_em=CURRENT_TIMESTAMP
          WHERE user_id=${user.id} AND organization_id=${user.organizationId} AND instancia=${instancia} AND estado IN ('MENU','AGUARDANDO_DATA')`;
          return null;
        }
        const aguardando = rows.find((row) => row.estado === "AGUARDANDO_DATA");
        if (!escolha && !aguardando) {
          if (rows.some((row) => row.estado === "MENU"))
            await tx.$executeRaw`
          UPDATE whatsapp_evento_alertas SET estado='SUSPENSO', atualizado_em=CURRENT_TIMESTAMP
          WHERE user_id=${user.id} AND organization_id=${user.organizationId} AND instancia=${instancia} AND estado='MENU'
        `;
          return null;
        }
        const ativos = rows.filter((row) => ABERTOS.includes(row.estado));
        const row = escolha?.[2]
          ? rows.find((row) => row.codigo === escolha[2].toUpperCase())
          : escolha
            ? ativos.length === 1
              ? ativos[0]
              : null
            : aguardando;
        if (escolha && !row) {
          if (!ativos.length && !escolha[2]) return null;
          return {
            msg:
              ativos.length > 1
                ? `Há mais de um compromisso aguardando resposta. Informe a opção e o código:\n\n${ativos.map((a) => `*${a.titulo}* — ${horarioCompromisso(a.inicio)}\n*1 ${a.codigo}* confirmar | *2 ${a.codigo}* adiar`).join("\n\n")}`
                : "Este aviso não está mais disponível. Consulte seus compromissos na agenda.",
          };
        }
        if (!row) return null;
        if (escolha && !escolha[2]) {
          const outros: any[] = await tx.$queryRaw`
            SELECT EXISTS(SELECT 1 FROM whatsapp_inicio WHERE user_id=${user.id} AND instancia=${instancia}
              AND conversa=${conversa} AND expira_em>CURRENT_TIMESTAMP)
              OR EXISTS(SELECT 1 FROM whatsapp_previas WHERE user_id=${user.id} AND instancia=${instancia}
              AND conversa=${conversa} AND expira_em>CURRENT_TIMESTAMP) AS aberto
          `;
          if (outros[0]?.aberto) return { msg: `Você também tem um registro em andamento nesta conversa. Para responder ao aviso de *${row.titulo}*, envie *1 ${row.codigo}* para confirmar ou *2 ${row.codigo}* para adiar. Nenhum registro foi alterado.` };
        }
        if (cancelar) {
          await tx.$executeRaw`UPDATE whatsapp_evento_alertas SET estado='MENU' WHERE event_id=${row.event_id} AND inicio=${row.inicio}`;
          return {
            msg: `Tudo bem, mantive *${row.titulo}* no horário atual. Responda *1 ${row.codigo}* para confirmar ou *2 ${row.codigo}* para adiar.`,
          };
        }
        const permissions = await permissoes();
        if (
          !permissions.includes("*") &&
          !permissions.includes("agenda:editar")
        )
          return {
            msg: "Sua conta não tem permissão para alterar este compromisso. Consulte o administrador da sua organização.",
          };
        const evento = await tx.event.findFirst({
          where: {
            id: row.event_id,
            userId: user.id,
            organizationId: user.organizationId,
            inicio: row.inicio,
            externalCancelled: false,
          },
        });
        if (!evento)
          return {
            msg: "Este compromisso foi alterado ou removido. Consulte sua agenda antes de continuar.",
          };
        if (escolha?.[1] === "1") {
          await antesDeEfeito();
          await tx.$executeRaw`UPDATE whatsapp_evento_alertas SET estado='CONFIRMADO', atualizado_em=CURRENT_TIMESTAMP WHERE event_id=${row.event_id} AND inicio=${row.inicio}`;
          return {
            msg: `Participação confirmada em *${evento.titulo}*. Não vou enviar mais avisos deste compromisso nesse horário.`,
            util: "COMPROMISSO_CONFIRMADO",
          };
        }
        if (escolha?.[1] === "2") {
          await tx.$executeRaw`UPDATE whatsapp_evento_alertas SET estado='MENU' WHERE user_id=${user.id} AND organization_id=${user.organizationId} AND instancia=${instancia} AND estado='AGUARDANDO_DATA'`;
          await tx.$executeRaw`UPDATE whatsapp_evento_alertas SET estado='AGUARDANDO_DATA', atualizado_em=CURRENT_TIMESTAMP WHERE event_id=${row.event_id} AND inicio=${row.inicio}`;
          return {
            msg: `Para quando você quer adiar *${evento.titulo}*?\n\nEnvie a *nova data e horário*, por exemplo: *amanhã às 14h*. Também aceito o formato *DD/MM/AAAA HH:MM*. Uso o horário de Brasília e mantenho a duração do compromisso.${evento.recorrencia ? "\n\nEste compromisso se repete: a alteração muda a data inicial da série." : ""}\n\nPara manter o horário atual, envie *cancelar*.`,
          };
        }
        const inicio = novaDataCompromisso(t);
        if (!inicio)
          return {
            msg: "Preciso de uma data válida no futuro e do horário. Envie *amanhã às 14h* ou use *DD/MM/AAAA HH:MM* (Brasília). Para desistir, envie *cancelar*.",
          };
        if (evento.recorrenciaFim && inicio > evento.recorrenciaFim)
          return {
            msg: "Essa data fica depois do fim da repetição. Informe uma data dentro do período da série ou ajuste a repetição na agenda.",
          };
        const fim = evento.fim
          ? new Date(
              inicio.getTime() +
                Math.max(0, evento.fim.getTime() - evento.inicio.getTime()),
            )
          : null;
        await antesDeEfeito();
        const editado = await tx.event.updateMany({
          where: {
            id: evento.id,
            userId: user.id,
            organizationId: user.organizationId,
            inicio: row.inicio,
            atualizadoEm: evento.atualizadoEm,
            externalCancelled: false,
          },
          data: { inicio, fim, diaTodo: false },
        });
        if (!editado.count)
          return {
            msg: "O compromisso mudou enquanto conversávamos. Confira a agenda e tente novamente.",
          };
        await tx.$executeRaw`UPDATE whatsapp_evento_alertas SET estado='ADIADO', atualizado_em=CURRENT_TIMESTAMP WHERE event_id=${row.event_id} AND inicio=${row.inicio}`;
        return {
          msg: `Combinado! *${evento.titulo}* foi adiado para *${horarioCompromisso(inicio)}* (Brasília). Os próximos lembretes seguirão o novo horário.`,
          eventoId: evento.id,
          util: "COMPROMISSO_ADIADO",
        };
      },
      { timeout: 15000 },
    );
    if (!resultado) return false;
    if (resultado.util) acaoUtil(resultado.util);
    if (resultado.eventoId)
      await this.writeback
        .onEventUpdated(resultado.eventoId)
        .catch(() =>
          this.logger.warn("Sincronização externa de adiamento pendente"),
        );
    await this.wa.sendToJid(conversa, resultado.msg, instancia);
    return true;
  }
}
