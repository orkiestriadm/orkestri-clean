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
   * RECONCILIA os períodos persistidos com os calculados.
   *
   * `skipDuplicates` com a única (collaboratorId, inicio) torna a inserção
   * idempotente: sincronizar duas vezes não duplica nem apaga ajuste manual
   * de `diasDireito`.
   *
   * Mas inserir não bastava, e isso custou caro. A chave de idempotência é a
   * DATA DE INÍCIO, então qualquer mudança no cálculo dos limites deixa de
   * casar com o que já estava gravado — e o `createMany` cria um conjunto
   * inteiro novo ao lado do antigo. Foi o que aconteceu ao corrigir o erro de
   * um dia por fuso: 60 períodos viraram 120, e o passivo de férias da
   * organização dobrou na tela.
   *
   * Por isso a poda: o que não está no cálculo atual sai. Uma sincronização
   * que só soma não é idempotente de verdade — é idempotente enquanto a regra
   * não muda, que é justamente quando ela precisa ser.
   */
  async sincronizar(
    organizationId: string,
    collaboratorId: string,
    periodos: { inicio: Date; fim: Date; limiteConcessivo: Date; diasDireito: number }[],
  ) {
    if (periodos.length === 0) return { count: 0 };

    const criados = await this.db.collaboratorVacationPeriod.createMany({
      data: periodos.map(p => ({ ...p, organizationId, collaboratorId })),
      skipDuplicates: true,
    });

    await this.podarPeriodosObsoletos(collaboratorId, periodos);
    return criados;
  }

  /**
   * Remove períodos que o cálculo atual não produz mais.
   *
   * ANTES DE APAGAR, REALOCA as ausências. Uma solicitação de férias aponta
   * para o período de onde os dias saem; apagar a linha sem levar o vínculo
   * junto faria os dias já gozados sumirem do saldo — a pessoa "ganharia"
   * férias que já tirou.
   *
   * O destino é o período calculado com MAIOR SOBREPOSIÇÃO de janela, e não o
   * que contém a data da ausência: férias tiradas em 2025 podem ser debitadas
   * de um período aquisitivo de 2022, e o que se preserva aqui é de qual
   * período elas saíram, não quando foram gozadas.
   *
   * Se nada sobrepuser, a linha FICA. Dado que não se sabe re-alocar não se
   * apaga — sobrar um período a mais é visível e corrigível; perder o registro
   * de férias gozadas, não.
   */
  private async podarPeriodosObsoletos(
    collaboratorId: string,
    calculados: { inicio: Date; fim: Date }[],
  ) {
    const persistidos = await this.db.collaboratorVacationPeriod.findMany({
      where: { collaboratorId },
      select: { id: true, inicio: true, fim: true },
    });

    const chave = (d: Date) => new Date(d).toISOString().slice(0, 10);
    const atuais = new Set(calculados.map(p => chave(p.inicio)));
    const obsoletos = persistidos.filter((p: any) => !atuais.has(chave(p.inicio)));
    if (obsoletos.length === 0) return;

    // Índice das linhas que ficam, por data de início.
    const porInicio = new Map<string, string>();
    for (const p of persistidos) {
      if (atuais.has(chave(p.inicio))) porInicio.set(chave(p.inicio), p.id);
    }

    for (const velho of obsoletos) {
      const destino = this.maiorSobreposicao(velho, calculados);
      const destinoId = destino ? porInicio.get(chave(destino.inicio)) : undefined;
      if (!destinoId) continue; // sem destino seguro: preserva a linha

      await this.db.ausencia.updateMany({
        where: { vacationPeriodId: velho.id },
        data: { vacationPeriodId: destinoId },
      });
      await this.db.collaboratorVacationPeriod.delete({ where: { id: velho.id } });
    }
  }

  private maiorSobreposicao(
    velho: { inicio: Date; fim: Date },
    calculados: { inicio: Date; fim: Date }[],
  ): { inicio: Date; fim: Date } | null {
    let melhor: { inicio: Date; fim: Date } | null = null;
    let maior = 0;

    for (const c of calculados) {
      const de = Math.max(new Date(velho.inicio).getTime(), new Date(c.inicio).getTime());
      const ate = Math.min(new Date(velho.fim).getTime(), new Date(c.fim).getTime());
      const dias = ate - de;
      if (dias > maior) { maior = dias; melhor = c; }
    }
    return melhor;
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

  /**
   * As solicitações de férias da pessoa, com o desfecho de cada uma.
   *
   * Inclui REJEITADA e CANCELADA de propósito: um pedido negado é a informação
   * mais importante da lista, e some se o filtro só trouxer o que está de pé.
   * Quem pediu precisa ver o motivo, não descobrir pela ausência da linha.
   */
  async solicitacoesDeFerias(collaboratorId: string) {
    return this.db.ausencia.findMany({
      where: { collaboratorId, tipo: "ferias" },
      select: {
        id: true, dataInicio: true, dataFim: true, status: true,
        descricao: true, motivoRejeicao: true, criadoEm: true,
      },
      orderBy: { dataInicio: "desc" },
      // A janela é curta porque a tela é sobre o que está em curso: o
      // histórico completo de férias é o quadro de períodos, logo acima.
      take: 12,
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
  /**
   * Dias comprometidos de VÁRIOS períodos numa consulta só.
   *
   * O painel de passivo lia `dias_gozados` da coluna materializada, que só é
   * reescrita na sincronização (07:00 ou subida da API). Entre aprovar umas
   * férias e a próxima varredura, o saldo mostrado ficava maior do que o real —
   * e saldo de férias errado vira provisão errada.
   *
   * Uma consulta para todos os períodos, não uma por colaborador: o painel
   * varre a organização inteira.
   */
  async diasComprometidosDeVarios(periodIds: string[]): Promise<Map<string, number>> {
    if (!periodIds.length) return new Map();

    const linhas = await this.db.ausencia.findMany({
      where: {
        tipo: "ferias",
        status: { in: ["PENDENTE", "APROVADA"] },
        vacationPeriodId: { in: periodIds },
      },
      select: { vacationPeriodId: true, dataInicio: true, dataFim: true },
    });

    const porPeriodo = new Map<string, number>();
    for (const l of linhas as any[]) {
      // Mesma contagem inclusiva usada em `diasComprometidosPorPeriodo`: de 1º a
      // 30 são 30 dias, não 29.
      const dias = Math.round(
        (new Date(l.dataFim).setHours(0, 0, 0, 0) - new Date(l.dataInicio).setHours(0, 0, 0, 0)) / 86_400_000,
      ) + 1;
      porPeriodo.set(l.vacationPeriodId, (porPeriodo.get(l.vacationPeriodId) ?? 0) + dias);
    }
    return porPeriodo;
  }

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
      // `dataDesligamento` entra aqui porque o cálculo de férias devidas avalia
      // o vencimento NA DATA DA SAÍDA, não em hoje.
      select: { id: true, dataAdmissao: true, dataDesligamento: true, status: true },
    });
    return c;
  }
}
