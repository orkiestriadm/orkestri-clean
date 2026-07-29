import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { randomUUID } from "crypto";
import { PrismaService } from "../../../prisma/prisma.service";
import { PeopleEventsPublisher } from "../domain/people-events.publisher";
import { situacaoCertificacao, diasEntre } from "../domain/development.entity";
import { DIAS_ALERTA_VENCIMENTO_FERIAS } from "../domain/vacation.entity";
import { collaboratorDisplayName } from "../../../common/collaborator";

/**
 * Notificações do People.
 *
 * Este é o primeiro assinante do PeopleEventsPublisher. Até aqui os eventos
 * eram emitidos para ninguém: a costura existia e nada acontecia, então nenhum
 * aviso de admissão, mudança de situação ou férias solicitada chegava a lugar
 * algum — apesar de "notificações disparadas" ser critério de aceite.
 *
 * Duas naturezas convivem:
 *
 *  - REATIVAS: disparam do evento, no instante do fato.
 *  - PERIÓDICAS: varrem por prazos vencendo. Um documento não emite evento no
 *    dia em que vence — quem percebe é uma varredura.
 *
 * Quem recebe: o GESTOR do colaborador, porque é quem decide e aprova. O
 * próprio colaborador recebe o que é sobre a decisão dele (documento revisado).
 * Notificar "o RH" exigiria resolver quem tem a permissão em tempo de execução,
 * e uma notificação para todo mundo vira ruído que ninguém lê.
 */
@Injectable()
export class PeopleNotificationsService implements OnModuleInit {
  private readonly logger = new Logger(PeopleNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: PeopleEventsPublisher,
  ) {}

  onModuleInit() {
    this.eventos.subscribe("employee.created", (p: any) =>
      this.avisarGestor(p.employeeId, "people_admissao", "Novo colaborador na sua equipe",
        (nome) => `${nome} foi admitido e está na sua equipe.`));

    this.eventos.subscribe("employee.status.changed", (p: any) =>
      this.avisarGestor(p.employeeId, "people_situacao", "Situação funcional alterada",
        (nome) => `A situação de ${nome} mudou para ${p.statusNovo ?? "outra"}.`));

    this.eventos.subscribe("employee.terminated", (p: any) =>
      this.avisarGestor(p.employeeId, "people_desligamento", "Colaborador desligado",
        (nome) => `${nome} foi desligado.`));

    this.eventos.subscribe("employee.document.uploaded", (p: any) =>
      this.avisarGestor(p.employeeId, "people_documento", "Documento aguardando aprovação",
        (nome) => `${nome} enviou um documento que aguarda conferência.`, p.documentId));

    // Este vai para o próprio colaborador: a decisão é sobre o documento dele.
    this.eventos.subscribe("employee.document.reviewed", (p: any) =>
      this.avisarColaborador(p.employeeId, "people_documento",
        p.para === "APROVADO" ? "Documento aprovado" : "Documento rejeitado",
        p.para === "APROVADO"
          ? "Seu documento foi conferido e aprovado."
          : "Seu documento foi rejeitado. Veja o motivo no seu perfil.",
        p.documentId));

    this.eventos.subscribe("vacation.requested", (p: any) =>
      this.avisarGestor(p.employeeId, "people_ferias", "Solicitação de férias",
        (nome) => `${nome} solicitou ${p.dias} dias de férias.`, p.ausenciaId));

    this.logger.log("Assinantes de notificação do People registrados");
  }

  /* ── Reativas ───────────────────────────────────────────────────────────── */

  private async avisarGestor(
    collaboratorId: string,
    tipo: string,
    titulo: string,
    montarMensagem: (nome: string) => string,
    referenciaId?: string,
  ) {
    try {
      const colaborador = await (this.prisma as any).collaborator.findUnique({
        where: { id: collaboratorId },
        select: {
          nomeCompleto: true,
          user: { select: { nome: true } },
          gestor: { select: { userId: true } },
        },
      });
      // Sem gestor, ou gestor sem login, não há para quem enviar. Não é erro:
      // é o topo do organograma, ou alguém que não acessa o sistema.
      if (!colaborador?.gestor?.userId) return;

      await this.criar(
        colaborador.gestor.userId, tipo, titulo,
        montarMensagem(collaboratorDisplayName(colaborador)), referenciaId,
      );
    } catch (erro) {
      this.logger.error(`Falha ao notificar gestor de ${collaboratorId}`, erro as Error);
    }
  }

  private async avisarColaborador(
    collaboratorId: string, tipo: string, titulo: string, mensagem: string, referenciaId?: string,
  ) {
    try {
      const colaborador = await (this.prisma as any).collaborator.findUnique({
        where: { id: collaboratorId },
        select: { userId: true },
      });
      if (!colaborador?.userId) return;
      await this.criar(colaborador.userId, tipo, titulo, mensagem, referenciaId);
    } catch (erro) {
      this.logger.error(`Falha ao notificar colaborador ${collaboratorId}`, erro as Error);
    }
  }

  private async criar(
    userId: string, tipo: string, titulo: string, mensagem: string, referenciaId?: string,
  ) {
    await (this.prisma as any).notification.create({
      data: {
        id: randomUUID(),
        userId, tipo, titulo, mensagem,
        referenciaTipo: "people",
        referenciaId: referenciaId ?? null,
      },
    });
  }

  /* ── Periódicas ─────────────────────────────────────────────────────────── */

  /**
   * Varredura diária de prazos.
   *
   * 07:00 e não meia-noite: notificação criada de madrugada some no meio das
   * outras antes de a pessoa abrir o sistema.
   *
   * A proteção contra repetição é consultar as notificações do próprio dia
   * antes de criar. Sem isso, o gestor receberia o mesmo aviso de documento
   * vencendo todos os dias durante 30 dias, e passaria a ignorar todos.
   */
  @Cron("0 7 * * *")
  async varrerPrazos() {
    this.logger.log("Varredura de prazos do People iniciada");
    try {
      await Promise.all([
        this.avisarDocumentosVencendo(),
        this.avisarCertificacoesVencendo(),
        this.avisarFeriasVencendo(),
      ]);
    } catch (erro) {
      this.logger.error("Varredura de prazos falhou", erro as Error);
    }
  }

  private limite(dias: number): Date {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return d;
  }

  private async jaAvisadoHoje(userId: string, tipo: string, referenciaId: string): Promise<boolean> {
    const inicioDoDia = new Date();
    inicioDoDia.setHours(0, 0, 0, 0);
    const achado = await (this.prisma as any).notification.findFirst({
      where: { userId, tipo, referenciaId, criadoEm: { gte: inicioDoDia } },
      select: { id: true },
    });
    return !!achado;
  }

  private async avisarDocumentosVencendo() {
    const docs = await (this.prisma as any).collaboratorDocument.findMany({
      where: {
        excluidoEm: null,
        dataValidade: { not: null, lte: this.limite(30) },
        collaborator: { excluidoEm: null, status: "ATIVO" },
      },
      select: {
        id: true, titulo: true, dataValidade: true,
        collaborator: {
          select: { nomeCompleto: true, user: { select: { nome: true } }, gestor: { select: { userId: true } } },
        },
      },
    });

    for (const d of docs) {
      const destino = d.collaborator?.gestor?.userId;
      if (!destino) continue;
      if (await this.jaAvisadoHoje(destino, "people_documento_vencendo", d.id)) continue;

      const dias = diasEntre(new Date(), d.dataValidade);
      await this.criar(
        destino, "people_documento_vencendo",
        dias < 0 ? "Documento vencido" : "Documento vencendo",
        `"${d.titulo}" de ${collaboratorDisplayName(d.collaborator)} ` +
        (dias < 0 ? `venceu há ${Math.abs(dias)} dias.` : `vence em ${dias} dias.`),
        d.id,
      );
    }
  }

  private async avisarCertificacoesVencendo() {
    const certs = await (this.prisma as any).collaboratorTraining.findMany({
      where: {
        status: "CONCLUIDO",
        validade: { not: null, lte: this.limite(60) },
        collaborator: { excluidoEm: null, status: "ATIVO" },
      },
      select: {
        id: true, validade: true,
        training: { select: { nome: true } },
        collaborator: {
          select: { nomeCompleto: true, user: { select: { nome: true } }, gestor: { select: { userId: true } } },
        },
      },
    });

    for (const c of certs) {
      const destino = c.collaborator?.gestor?.userId;
      if (!destino) continue;
      if (await this.jaAvisadoHoje(destino, "people_certificacao_vencendo", c.id)) continue;

      const dias = diasEntre(new Date(), c.validade);
      const situacao = situacaoCertificacao(c.validade);
      await this.criar(
        destino, "people_certificacao_vencendo",
        situacao === "vencida" ? "Certificação vencida" : "Certificação vencendo",
        `${c.training?.nome ?? "Certificação"} de ${collaboratorDisplayName(c.collaborator)} ` +
        (dias < 0 ? `venceu há ${Math.abs(dias)} dias.` : `vence em ${dias} dias.`),
        c.id,
      );
    }
  }

  /**
   * Férias perto do limite concessivo.
   *
   * É o aviso que mais vale dinheiro: passado o prazo, os dias são devidos em
   * dobro, e nesse ponto avisar não adianta mais.
   */
  private async avisarFeriasVencendo() {
    const periodos = await (this.prisma as any).collaboratorVacationPeriod.findMany({
      where: {
        limiteConcessivo: { lte: this.limite(DIAS_ALERTA_VENCIMENTO_FERIAS) },
        collaborator: { excluidoEm: null, status: "ATIVO" },
      },
      select: {
        id: true, limiteConcessivo: true, diasDireito: true, diasGozados: true,
        collaborator: {
          select: { nomeCompleto: true, user: { select: { nome: true } }, gestor: { select: { userId: true } } },
        },
      },
    });

    for (const p of periodos) {
      const saldo = Math.max(0, p.diasDireito - p.diasGozados);
      if (saldo === 0) continue; // gozado por inteiro não vence

      const destino = p.collaborator?.gestor?.userId;
      if (!destino) continue;
      if (await this.jaAvisadoHoje(destino, "people_ferias_vencendo", p.id)) continue;

      const dias = diasEntre(new Date(), p.limiteConcessivo);
      await this.criar(
        destino, "people_ferias_vencendo",
        dias < 0 ? "Férias vencidas — pagamento em dobro" : "Férias a vencer",
        `${collaboratorDisplayName(p.collaborator)} tem ${saldo} dias ` +
        (dias < 0
          ? `vencidos há ${Math.abs(dias)} dias. Esses dias são devidos em dobro.`
          : `que vencem em ${dias} dias.`),
        p.id,
      );
    }
  }
}
