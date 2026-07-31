import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

/** Acesso a dados de períodos aquisitivos. Único ponto que fala Prisma. */

const CAMPOS = {
  id: true, collaboratorId: true, inicio: true, fim: true,
  limiteConcessivo: true, diasDireito: true, diasGozados: true,
  status: true, observacoes: true,
} as const;

@Injectable()
export class VacationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get db(): any {
    return this.prisma as any;
  }

  /**
   * Ativos com data de admissao, de todas as organizacoes.
   *
   * Usado pela varredura diaria: os periodos so nasciam quando alguem abria a
   * aba de ferias do colaborador, entao o painel de passivo e o indicador
   * liam zero para quem nunca foi visitado — justamente quem o RH esqueceu.
   */
  colaboradoresParaSincronizar() {
    return this.db.collaborator.findMany({
      where: { excluidoEm: null, status: "ATIVO", dataAdmissao: { not: null } },
      select: { id: true, organizationId: true, dataAdmissao: true },
    });
  }

  async listarPeriodos(collaboratorId: string, organizationId: string) {
    return this.db.collaboratorVacationPeriod.findMany({
      where: { collaboratorId, organizationId },
      select: CAMPOS,
      orderBy: { inicio: "asc" },
    });
  }

  async obterPeriodo(id: string, organizationId: string) {
    return this.db.collaboratorVacationPeriod.findFirst({
      where: { id, organizationId },
      select: CAMPOS,
    });
  }

  /**
   * Cria os períodos que ainda não existem e atualiza status dos existentes.
   *
   * `skipDuplicates` com a única (collaboratorId, inicio) torna a chamada
   * idempotente: sincronizar duas vezes não duplica nem apaga ajuste manual
   * de `diasDireito`.
   */
  async sincronizar(
    organizationId: string,
    collaboratorId: string,
    periodos: { inicio: Date; fim: Date; limiteConcessivo: Date; diasDireito: number }[],
  ) {
    if (periodos.length === 0) return { count: 0 };
    return this.db.collaboratorVacationPeriod.createMany({
      data: periodos.map(p => ({ ...p, organizationId, collaboratorId })),
      skipDuplicates: true,
    });
  }

  async atualizarStatus(id: string, status: string, diasGozados: number) {
    return this.db.collaboratorVacationPeriod.update({
      where: { id },
      data: { status, diasGozados },
      select: CAMPOS,
    });
  }

  /**
   * Dias já comprometidos por período.
   *
   * Conta PENDENTE junto com APROVADA de propósito: sem isso o colaborador
   * poderia abrir várias solicitações simultâneas que somadas estouram o saldo,
   * e o estouro só apareceria na hora de aprovar.
   */
  async diasComprometidosPorPeriodo(collaboratorId: string): Promise<Map<string, number>> {
    const linhas = await this.db.ausencia.findMany({
      where: {
        collaboratorId,
        tipo: "ferias",
        status: { in: ["PENDENTE", "APROVADA"] },
        vacationPeriodId: { not: null },
      },
      select: { vacationPeriodId: true, dataInicio: true, dataFim: true },
    });

    const porPeriodo = new Map<string, number>();
    for (const l of linhas) {
      const dias = Math.round(
        (new Date(l.dataFim).setHours(0, 0, 0, 0) - new Date(l.dataInicio).setHours(0, 0, 0, 0)) / 86_400_000,
      ) + 1;
      porPeriodo.set(l.vacationPeriodId, (porPeriodo.get(l.vacationPeriodId) ?? 0) + dias);
    }
    return porPeriodo;
  }

  /** Ausências que ocupam a agenda do colaborador — base da checagem de conflito. */
  async ausenciasAtivas(collaboratorId: string) {
    return this.db.ausencia.findMany({
      where: { collaboratorId, status: { in: ["PENDENTE", "APROVADA"] } },
      select: { id: true, dataInicio: true, dataFim: true, tipo: true },
    });
  }

  async criarSolicitacaoFerias(dados: Record<string, any>) {
    return this.db.ausencia.create({
      data: dados,
      select: {
        id: true, tipo: true, dataInicio: true, dataFim: true,
        status: true, vacationPeriodId: true, descricao: true,
      },
    });
  }

  /** Períodos vencendo na organização — alimenta o painel de passivo. */
  async periodosVencendoAte(organizationId: string, limite: Date, collaboratorIds?: string[]) {
    return this.db.collaboratorVacationPeriod.findMany({
      where: {
        organizationId,
        // VENCIDO precisa entrar: filtrar só ADQUIRIDO fazia a tela de passivo
        // esconder exatamente o que ela existe para mostrar — período que já
        // passou do prazo concessivo e virou pagamento em dobro.
        // EM_AQUISICAO fica fora (ainda não é direito) e GOZADO também (não
        // tem saldo).
        status: { in: ["ADQUIRIDO", "VENCIDO"] },
        limiteConcessivo: { lte: limite },
        ...(collaboratorIds ? { collaboratorId: { in: collaboratorIds } } : {}),
      },
      select: {
        ...CAMPOS,
        collaborator: {
          select: { id: true, nomeCompleto: true, user: { select: { nome: true } } },
        },
      },
      orderBy: { limiteConcessivo: "asc" },
    });
  }

  async dataAdmissao(collaboratorId: string, organizationId: string) {
    const c = await this.db.collaborator.findFirst({
      where: { id: collaboratorId, organizationId, excluidoEm: null },
      select: { id: true, dataAdmissao: true, status: true },
    });
    return c;
  }
}
