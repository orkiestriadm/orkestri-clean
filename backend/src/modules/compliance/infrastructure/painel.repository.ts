import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Consultas agregadas do painel e do calendário.
 *
 * Separado do repositório de obrigações porque a natureza é outra: aqui são
 * contagens e recortes, sempre com `groupBy` ou `count`, e nunca se traz a
 * carteira inteira para contar em memória — com 36 licenças daria certo, com
 * 3.600 derrubaria a página.
 */

const VIVAS = { deletedAt: null, status: { notIn: ["cancelada", "arquivada"] } } as const;

/** Recorte que os relatórios aceitam. */
export type FiltroRelatorio = {
  de?: Date;
  ate?: Date;
  categoriaId?: string;
  unidade?: string;
};

@Injectable()
export class PainelRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get db(): any {
    return this.prisma as any;
  }

  private emDias(hoje: Date, dias: number): Date {
    const d = new Date(hoje.getTime());
    d.setDate(d.getDate() + dias);
    return d;
  }

  /**
   * Os cartões do topo.
   *
   * Uma consulta por cartão, todas em paralelo. A alternativa — um `groupBy`
   * pela situação — não existe: a situação é derivada de três colunas e da
   * prorrogação, e o Postgres não agruparia por ela sem uma expressão que o
   * Prisma não expõe.
   */
  async cartoes(organizationId: string, hoje: Date) {
    const base = { organizationId, ...VIVAS };
    const naoProrrogada = { prorrogacaoVigente: false };

    const [
      total, ativas, vencidas, prorrogadas, venceHoje, vence7, vence30, vence90,
      renovacaoDevida, prazoFatalVencido, emRenovacao, semValidade,
    ] = await Promise.all([
      this.db.complianceObrigacao.count({ where: { organizationId, deletedAt: null } }),
      this.db.complianceObrigacao.count({ where: { ...base, status: "ativa" } }),
      this.db.complianceObrigacao.count({
        where: { ...base, ...naoProrrogada, dataValidade: { lt: hoje } },
      }),
      this.db.complianceObrigacao.count({
        where: {
          ...base, prorrogacaoVigente: true,
          OR: [{ dataValidade: { lt: hoje } }, { prazoFatalEm: { lt: hoje } }],
        },
      }),
      this.db.complianceObrigacao.count({
        where: { ...base, dataValidade: { gte: hoje, lte: this.emDias(hoje, 0) } },
      }),
      this.db.complianceObrigacao.count({
        where: { ...base, dataValidade: { gte: hoje, lte: this.emDias(hoje, 7) } },
      }),
      this.db.complianceObrigacao.count({
        where: { ...base, dataValidade: { gte: hoje, lte: this.emDias(hoje, 30) } },
      }),
      this.db.complianceObrigacao.count({
        where: { ...base, dataValidade: { gte: hoje, lte: this.emDias(hoje, 90) } },
      }),
      this.db.complianceObrigacao.count({
        where: {
          ...base, ...naoProrrogada,
          dataValidade: { gte: hoje },
          OR: [{ prazoFatalEm: null }, { prazoFatalEm: { gte: hoje } }],
          prazoInternoEm: { lt: hoje },
        },
      }),
      this.db.complianceObrigacao.count({
        where: {
          ...base, ...naoProrrogada,
          dataValidade: { gte: hoje }, prazoFatalEm: { lt: hoje },
        },
      }),
      this.db.complianceObrigacao.count({ where: { ...base, status: "em_renovacao" } }),
      this.db.complianceObrigacao.count({ where: { ...base, dataValidade: null } }),
    ]);

    return {
      total, ativas, vencidas, prorrogadas,
      venceHoje, vence7, vence30, vence90,
      renovacaoDevida, prazoFatalVencido, emRenovacao, semValidade,
    };
  }

  /**
   * Recorte opcional dos relatórios.
   *
   * Sem ele, o relatório só sabia responder "a carteira inteira" — e a
   * pergunta que se faz num relatório quase nunca é essa; é "o ano passado",
   * "esta categoria", "esta unidade".
   */
  private recorte(f?: FiltroRelatorio): any {
    if (!f) return {};
    const w: any = {};
    if (f.categoriaId) w.categoriaId = f.categoriaId;
    if (f.unidade) w.unidade = f.unidade;
    if (f.de || f.ate) {
      w.dataValidade = {};
      if (f.de) w.dataValidade.gte = f.de;
      if (f.ate) w.dataValidade.lte = f.ate;
    }
    return w;
  }

  /** Contagem por categoria, já com nome e cor para o gráfico. */
  async porCategoria(organizationId: string, f?: FiltroRelatorio) {
    const grupos = await this.db.complianceObrigacao.groupBy({
      by: ["categoriaId"],
      where: { organizationId, ...VIVAS, ...this.recorte(f) },
      _count: { _all: true },
    });

    const categorias = await this.db.complianceCategoria.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, nome: true, cor: true, icone: true },
    });
    const mapa = new Map(categorias.map((c: any) => [c.id, c]));

    return grupos
      .map((g: any) => ({
        categoriaId: g.categoriaId,
        nome: (mapa.get(g.categoriaId) as any)?.nome ?? "Sem categoria",
        cor: (mapa.get(g.categoriaId) as any)?.cor ?? "#64748b",
        icone: (mapa.get(g.categoriaId) as any)?.icone ?? "shield-check",
        total: g._count._all,
      }))
      .sort((a: any, b: any) => b.total - a.total);
  }

  /** Agrupamento genérico por uma coluna de texto — status, criticidade, unidade… */
  async porColuna(organizationId: string, coluna: string, f?: FiltroRelatorio) {
    const grupos = await this.db.complianceObrigacao.groupBy({
      by: [coluna],
      where: { organizationId, ...VIVAS, ...this.recorte(f) },
      _count: { _all: true },
    });
    return grupos
      .map((g: any) => ({ valor: g[coluna] ?? "—", total: g._count._all }))
      .sort((a: any, b: any) => b.total - a.total);
  }

  /**
   * Vencimentos mês a mês, para o gráfico de linha do tempo e o mapa de calor.
   *
   * `groupBy` do Prisma não agrupa por mês; a alternativa seria SQL cru, mas a
   * janela é de 24 meses e o recorte já filtra pela faixa de datas — o volume
   * que chega é o das obrigações que realmente vencem no período.
   */
  async vencimentosPorMes(organizationId: string, de: Date, ate: Date, f?: FiltroRelatorio) {
    const linhas = await this.db.complianceObrigacao.findMany({
      where: {
        organizationId, ...VIVAS,
        ...this.recorte({ categoriaId: f?.categoriaId, unidade: f?.unidade }),
        dataValidade: { gte: de, lte: ate },
      },
      select: { dataValidade: true, criticidade: true, categoriaId: true },
    });

    const mapa = new Map<string, { mes: string; total: number; criticas: number }>();
    for (const l of linhas) {
      const d = new Date(l.dataValidade);
      const mes = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const atual = mapa.get(mes) ?? { mes, total: 0, criticas: 0 };
      atual.total += 1;
      if (l.criticidade === "critica" || l.criticidade === "alta") atual.criticas += 1;
      mapa.set(mes, atual);
    }
    return [...mapa.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  }

  /** Obrigações por responsável — quem está com quantas na mão. */
  async porResponsavel(organizationId: string) {
    const linhas = await this.db.complianceResponsavel.findMany({
      where: {
        organizationId,
        papel: { in: ["principal", "gestor"] },
        obrigacao: VIVAS,
      },
      select: {
        userId: true, nome: true, email: true,
        user: { select: { id: true, nome: true, avatar: true } },
      },
    });

    const mapa = new Map<string, { id: string | null; nome: string; total: number }>();
    for (const l of linhas) {
      const chave = l.userId ?? l.email ?? l.nome ?? "sem_responsavel";
      const nome = l.user?.nome ?? l.nome ?? l.email ?? "Sem responsável";
      const atual = mapa.get(chave) ?? { id: l.userId ?? null, nome, total: 0 };
      atual.total += 1;
      mapa.set(chave, atual);
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total).slice(0, 20);
  }

  /**
   * Eventos do calendário numa faixa.
   *
   * Cada obrigação rende até três eventos — validade, prazo fatal e prazo
   * interno —, e é por isso que o calendário do módulo mostra o que a planilha
   * não mostrava: a data em que é preciso COMEÇAR, não só a data em que acaba.
   */
  async eventosCalendario(organizationId: string, de: Date, ate: Date) {
    return this.db.complianceObrigacao.findMany({
      where: {
        organizationId, ...VIVAS,
        OR: [
          { dataValidade: { gte: de, lte: ate } },
          { prazoFatalEm: { gte: de, lte: ate } },
          { prazoInternoEm: { gte: de, lte: ate } },
        ],
      },
      select: {
        id: true, codigo: true, nome: true, sigla: true, criticidade: true, status: true,
        dataValidade: true, prazoFatalEm: true, prazoInternoEm: true,
        prorrogacaoVigente: true, renovacaoAutomatica: true, protocoloEm: true,
        unidade: true,
        categoria: { select: { id: true, nome: true, cor: true } },
      },
      orderBy: { dataValidade: "asc" },
    });
  }

  /**
   * As obrigações de um usuário — o painel pessoal.
   *
   * "Minhas" é ser responsável nomeado, em qualquer papel. Incluir as da equipe
   * inteira faria o painel pessoal repetir o executivo, e a pergunta que ele
   * responde é outra: o que EU preciso fazer.
   */
  async minhasObrigacoes(organizationId: string, userId: string, limite = 200) {
    return this.db.complianceObrigacao.findMany({
      where: {
        organizationId, ...VIVAS,
        responsaveis: { some: { userId } },
      },
      include: {
        categoria: { select: { id: true, nome: true, cor: true, icone: true } },
        orgao: { select: { id: true, nome: true, sigla: true } },
        responsaveis: {
          select: {
            id: true, papel: true, nome: true, email: true, telefone: true, notificar: true,
            user: { select: { id: true, nome: true, email: true, avatar: true } },
          },
        },
        tags: { select: { tag: { select: { id: true, nome: true, cor: true } } } },
        favoritos: { where: { userId }, select: { id: true } },
      },
      orderBy: [{ prazoInternoEm: "asc" }, { dataValidade: "asc" }],
      take: limite,
    });
  }

  /** Custos: soma de licença e renovação, por categoria e no total. */
  async custos(organizationId: string, de?: Date, ate?: Date, f?: FiltroRelatorio) {
    // A faixa de datas aqui é sobre a EMISSÃO (quando se pagou), não sobre a
    // validade — por isso o recorte entra sem as datas, que vêm à parte.
    const where: any = {
      organizationId, ...VIVAS,
      ...this.recorte({ categoriaId: f?.categoriaId, unidade: f?.unidade }),
    };
    if (de || ate) {
      where.dataEmissao = {};
      if (de) where.dataEmissao.gte = de;
      if (ate) where.dataEmissao.lte = ate;
    }

    const [agregado, porCategoria] = await Promise.all([
      this.db.complianceObrigacao.aggregate({
        where, _sum: { valorLicenca: true, valorRenovacao: true }, _count: { _all: true },
      }),
      this.db.complianceObrigacao.groupBy({
        by: ["categoriaId"], where, _sum: { valorLicenca: true, valorRenovacao: true },
      }),
    ]);

    return { agregado, porCategoria };
  }

  /**
   * A fila de ação: o que exige alguém agora.
   *
   * Ordenada pelo prazo interno, que é a data em que é preciso começar. Ordenar
   * pela validade colocaria no topo a licença que vence em 20 dias e cuja
   * janela de protocolo fechou há dois meses — depois da que ainda dá tempo.
   */
  async filaDeAcao(organizationId: string, hoje: Date, limite = 25) {
    return this.db.complianceObrigacao.findMany({
      where: {
        organizationId, ...VIVAS,
        prorrogacaoVigente: false,
        OR: [
          { dataValidade: { lt: hoje } },
          { prazoFatalEm: { lt: hoje } },
          { prazoInternoEm: { lt: hoje } },
        ],
      },
      select: {
        id: true, codigo: true, nome: true, sigla: true, numeroDocumento: true,
        criticidade: true, status: true, unidade: true,
        dataValidade: true, prazoFatalEm: true, prazoInternoEm: true,
        prorrogacaoVigente: true, renovacaoAutomatica: true, protocoloEm: true,
        categoria: { select: { id: true, nome: true, cor: true } },
        responsaveis: {
          where: { papel: "principal" },
          select: { nome: true, email: true, user: { select: { nome: true } } },
          take: 1,
        },
      },
      orderBy: [{ prazoInternoEm: "asc" }, { dataValidade: "asc" }],
      take: limite,
    });
  }
}
