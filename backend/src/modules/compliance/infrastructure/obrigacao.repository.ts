import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Acesso a dados das obrigações.
 *
 * Único ponto do módulo que fala Prisma. Toda consulta recebe `organizationId`
 * como primeiro argumento — não existe leitura sem escopo de organização.
 */

const INCLUDE_LISTA = {
  categoria: { select: { id: true, nome: true, cor: true, icone: true } },
  orgao: { select: { id: true, nome: true, sigla: true } },
  responsaveis: {
    select: {
      id: true, papel: true, nome: true, email: true, telefone: true, notificar: true,
      user: { select: { id: true, nome: true, email: true, avatar: true } },
    },
  },
  tags: { select: { tag: { select: { id: true, nome: true, cor: true } } } },
} as const;

const INCLUDE_DETALHE = {
  ...INCLUDE_LISTA,
  categoria: {
    select: {
      id: true, nome: true, cor: true, icone: true, folgaInternaDias: true,
      campos: {
        where: { ativo: true, deletedAt: null },
        orderBy: { ordem: "asc" as const },
        select: {
          id: true, chave: true, rotulo: true, tipo: true, opcoes: true,
          obrigatorio: true, ajuda: true, ordem: true,
        },
      },
    },
  },
  camposValores: {
    select: {
      campoId: true, valorTexto: true, valorNumero: true, valorData: true, valorBool: true,
    },
  },
  project: { select: { id: true, titulo: true } },
  supplier: { select: { id: true, nomeFantasia: true, razaoSocial: true } },
  etapa: { select: { id: true, nome: true, ordem: true, exigeAprovacao: true } },
} as const;

export type FiltrosObrigacao = {
  q?: string;
  categoriaId?: string;
  orgaoId?: string;
  status?: string;
  criticidade?: string;
  situacao?: string;
  unidade?: string;
  departamento?: string;
  empresa?: string;
  responsavelId?: string;
  tag?: string;
  supplierId?: string;
  venceEmDias?: number;
  de?: Date;
  ate?: Date;
  favoritosDoUsuario?: string;
};

/**
 * Traduz a situação DERIVADA para um WHERE do Prisma.
 *
 * As três datas e a prorrogação estão materializadas em coluna justamente para
 * esta tradução existir: sem ela, filtrar "vencidas" obrigaria a trazer a
 * carteira inteira para a memória, e a paginação deixaria de funcionar.
 *
 * ATENÇÃO — esta é a SEGUNDA implementação da mesma regra. A primeira é
 * `situacaoPrazo()` no domínio, que classifica uma obrigação já carregada.
 * Duas implementações da mesma regra divergem com o tempo, e a divergência
 * aqui seria invisível: o painel contaria uma coisa e a lista filtrada outra.
 * `obrigacao.repository.spec.ts` compara as duas numa matriz de casos e falha
 * se elas discordarem — é o que impede a divergência de nascer.
 *
 * Função pura e exportada exatamente para o teste conseguir alcançá-la.
 */
export function whereDaSituacao(situacao: string, hoje: Date): any {
  const prorrogada = { prorrogacaoVigente: true };
  const naoProrrogada = { prorrogacaoVigente: false };

  switch (situacao) {
    case "sem_validade":
      return { dataValidade: null };

    case "vencida":
      return { AND: [{ dataValidade: { lt: hoje } }, naoProrrogada] };

    case "prorrogada":
      // Só faz sentido chamar de prorrogada o que já passou de algum marco; uma
      // licença nova com protocolo antecipado continua simplesmente vigente.
      return {
        AND: [
          prorrogada,
          { OR: [
            { dataValidade: { lt: hoje } },
            { prazoFatalEm: { lt: hoje } },
            { prazoInternoEm: { lt: hoje } },
          ] },
        ],
      };

    case "prazo_fatal_vencido":
      return {
        AND: [
          naoProrrogada,
          { dataValidade: { gte: hoje } },
          { prazoFatalEm: { lt: hoje } },
        ],
      };

    case "renovacao_devida":
      return {
        AND: [
          naoProrrogada,
          { dataValidade: { gte: hoje } },
          { OR: [{ prazoFatalEm: null }, { prazoFatalEm: { gte: hoje } }] },
          { prazoInternoEm: { lt: hoje } },
        ],
      };

    case "vigente":
      return {
        AND: [
          { dataValidade: { gte: hoje } },
          { OR: [{ prazoFatalEm: null }, { prazoFatalEm: { gte: hoje } }] },
          { OR: [{ prazoInternoEm: null }, { prazoInternoEm: { gte: hoje } }] },
        ],
      };

    default:
      return {};
  }
}

@Injectable()
export class ObrigacaoRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get db(): any {
    return this.prisma as any;
  }

  montarWhere(organizationId: string, f: FiltrosObrigacao, hoje: Date = new Date()): any {
    const where: any = { organizationId, deletedAt: null };
    const and: any[] = [];

    if (f.categoriaId) where.categoriaId = f.categoriaId;
    if (f.orgaoId) where.orgaoId = f.orgaoId;
    if (f.status) where.status = f.status;
    if (f.criticidade) where.criticidade = f.criticidade;
    if (f.supplierId) where.supplierId = f.supplierId;
    if (f.unidade) where.unidade = { contains: f.unidade, mode: "insensitive" };
    if (f.departamento) where.departamento = { contains: f.departamento, mode: "insensitive" };
    if (f.empresa) where.empresa = { contains: f.empresa, mode: "insensitive" };

    if (f.q) {
      and.push({
        OR: [
          { nome: { contains: f.q, mode: "insensitive" } },
          { codigo: { contains: f.q, mode: "insensitive" } },
          { sigla: { contains: f.q, mode: "insensitive" } },
          { numeroDocumento: { contains: f.q, mode: "insensitive" } },
          { unidade: { contains: f.q, mode: "insensitive" } },
          { ativoIdentificador: { contains: f.q, mode: "insensitive" } },
          { descricao: { contains: f.q, mode: "insensitive" } },
          // O texto do campo personalizado entra na busca: "1035.8.2025" é
          // número de processo, e o usuário procura por ele sem saber que
          // aquilo é um campo da categoria.
          { camposValores: { some: { valorTexto: { contains: f.q, mode: "insensitive" } } } },
        ],
      });
    }

    if (f.responsavelId) {
      and.push({
        responsaveis: {
          some: { OR: [{ userId: f.responsavelId }, { collaboratorId: f.responsavelId }] },
        },
      });
    }

    if (f.tag) and.push({ tags: { some: { tag: { nome: f.tag } } } });

    if (f.favoritosDoUsuario) {
      and.push({ favoritos: { some: { userId: f.favoritosDoUsuario } } });
    }

    if (f.situacao) and.push(whereDaSituacao(f.situacao, hoje));

    // Janela "vence nos próximos N dias" — inclui o que já venceu, porque um
    // painel de vencimentos que esconde o vencido é um painel que mente.
    if (f.venceEmDias != null) {
      const limite = new Date(hoje.getTime());
      limite.setDate(limite.getDate() + f.venceEmDias);
      and.push({ dataValidade: { not: null, lte: limite } });
    }

    if (f.de || f.ate) {
      const faixa: any = {};
      if (f.de) faixa.gte = f.de;
      if (f.ate) faixa.lte = f.ate;
      and.push({ dataValidade: faixa });
    }

    if (and.length) where.AND = and;
    return where;
  }

  private ordenacao(ordenar?: string): any[] {
    switch (ordenar) {
      case "nome":         return [{ nome: "asc" }];
      case "codigo":       return [{ codigo: "asc" }];
      case "criadoEm":     return [{ criadoEm: "desc" }];
      case "criticidade":  return [{ criticidade: "desc" }, { dataValidade: "asc" }];
      case "validade":     return [{ dataValidade: "asc" }];
      default:
        // Padrão: o que exige ação primeiro. Nulos por último — obrigação sem
        // validade não é urgente, e o Postgres ordena NULL como o maior valor
        // em ASC, que é justamente o que queremos.
        return [{ prazoInternoEm: "asc" }, { dataValidade: "asc" }, { nome: "asc" }];
    }
  }

  async listar(
    organizationId: string,
    filtros: FiltrosObrigacao,
    opcoes: { pagina: number; limite: number; ordenar?: string; userId?: string },
    hoje: Date = new Date(),
  ) {
    const where = this.montarWhere(organizationId, filtros, hoje);
    const take = opcoes.limite;
    const skip = (opcoes.pagina - 1) * take;

    const [itens, total] = await Promise.all([
      this.db.complianceObrigacao.findMany({
        where,
        include: {
          ...INCLUDE_LISTA,
          // Só o favorito de quem está olhando — trazer os dos outros seria
          // vazar quem acompanha o quê.
          favoritos: opcoes.userId
            ? { where: { userId: opcoes.userId }, select: { id: true } }
            : false,
        },
        orderBy: this.ordenacao(opcoes.ordenar),
        take, skip,
      }),
      this.db.complianceObrigacao.count({ where }),
    ]);

    return { itens, total, pagina: opcoes.pagina, limite: take };
  }

  async obter(organizationId: string, id: string, userId?: string) {
    return this.db.complianceObrigacao.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        ...INCLUDE_DETALHE,
        favoritos: userId ? { where: { userId }, select: { id: true } } : false,
        versoes: { orderBy: { versao: "desc" }, take: 50 },
        aprovacoes: {
          orderBy: { criadoEm: "desc" },
          include: {
            etapa: { select: { id: true, nome: true, ordem: true } },
            aprovador: { select: { id: true, nome: true } },
          },
        },
      },
    });
  }

  /** Versão enxuta usada pelo motor de alertas e pelas exportações. */
  async obterCru(organizationId: string, id: string) {
    return this.db.complianceObrigacao.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
  }

  async criar(dados: any) {
    return this.db.complianceObrigacao.create({ data: dados, include: INCLUDE_LISTA });
  }

  async atualizar(id: string, dados: any) {
    return this.db.complianceObrigacao.update({ where: { id }, data: dados, include: INCLUDE_LISTA });
  }

  async excluirLogicamente(id: string, userId?: string | null) {
    return this.db.complianceObrigacao.update({
      where: { id },
      data: { deletedAt: new Date(), atualizadoPorId: userId ?? null },
    });
  }

  /**
   * Próximo número do código sequencial da organização.
   *
   * Conta os registros INCLUSIVE os excluídos logicamente: reaproveitar o
   * código de uma obrigação excluída faria dois documentos diferentes citarem
   * "OBR-0007" em e-mails para o mesmo órgão.
   */
  async proximoSequencial(organizationId: string): Promise<number> {
    const total = await this.db.complianceObrigacao.count({ where: { organizationId } });
    return total + 1;
  }

  async codigoExiste(organizationId: string, codigo: string): Promise<boolean> {
    const achado = await this.db.complianceObrigacao.findFirst({
      where: { organizationId, codigo }, select: { id: true },
    });
    return !!achado;
  }

  /* ── Responsáveis, tags e campos ───────────────────────────────────────── */

  /**
   * Usuários da organização por e-mail, para amarrar o responsável digitado à
   * mão à conta dele.
   *
   * Restrito à organização de propósito: e-mail igual em outro tenant é outra
   * pessoa, e vincular atravessaria o isolamento entre clientes.
   */
  async usuariosPorEmail(organizationId: string, emails: string[]) {
    if (!emails.length) return [];
    return this.db.user.findMany({
      where: {
        organizationId,
        ativo: true,
        email: { in: emails, mode: "insensitive" },
      },
      select: { id: true, email: true },
    });
  }

  async substituirResponsaveis(organizationId: string, obrigacaoId: string, lista: any[]) {
    await this.db.$transaction([
      this.db.complianceResponsavel.deleteMany({ where: { obrigacaoId } }),
      ...(lista.length
        ? [this.db.complianceResponsavel.createMany({
            data: lista.map(r => ({ ...r, organizationId, obrigacaoId })),
          })]
        : []),
    ]);
  }

  async substituirTags(organizationId: string, obrigacaoId: string, tagIds: string[]) {
    await this.db.$transaction([
      this.db.complianceObrigacaoTag.deleteMany({ where: { obrigacaoId } }),
      ...(tagIds.length
        ? [this.db.complianceObrigacaoTag.createMany({
            data: tagIds.map(tagId => ({ obrigacaoId, tagId })),
            skipDuplicates: true,
          })]
        : []),
    ]);
  }

  async gravarCampoValor(organizationId: string, obrigacaoId: string, campoId: string, colunas: any) {
    return this.db.complianceCampoValor.upsert({
      where: { obrigacaoId_campoId: { obrigacaoId, campoId } },
      create: { organizationId, obrigacaoId, campoId, ...colunas },
      update: colunas,
    });
  }

  async limparCamposDeOutraCategoria(obrigacaoId: string, categoriaId: string) {
    // Trocar a categoria de uma obrigação torna órfãos os valores dos campos da
    // categoria antiga. Mantê-los faria o detalhe exibir dado de um formulário
    // que não existe mais.
    await this.db.complianceCampoValor.deleteMany({
      where: { obrigacaoId, campo: { categoriaId: { not: categoriaId } } },
    });
  }

  /* ── Favoritos e comentários ───────────────────────────────────────────── */

  async alternarFavorito(organizationId: string, obrigacaoId: string, userId: string) {
    const existente = await this.db.complianceFavorito.findFirst({
      where: { obrigacaoId, userId }, select: { id: true },
    });
    if (existente) {
      await this.db.complianceFavorito.delete({ where: { id: existente.id } });
      return false;
    }
    await this.db.complianceFavorito.create({ data: { organizationId, obrigacaoId, userId } });
    return true;
  }

  async comentar(organizationId: string, obrigacaoId: string, userId: string, conteudo: string) {
    return this.db.complianceComentario.create({
      data: { organizationId, obrigacaoId, userId, conteudo },
      include: { user: { select: { id: true, nome: true, avatar: true } } },
    });
  }

  async listarComentarios(obrigacaoId: string) {
    return this.db.complianceComentario.findMany({
      where: { obrigacaoId, deletedAt: null },
      orderBy: { criadoEm: "desc" },
      include: { user: { select: { id: true, nome: true, avatar: true } } },
    });
  }

  /* ── Versões ───────────────────────────────────────────────────────────── */

  async criarVersao(dados: any) {
    return this.db.complianceVersao.create({ data: dados });
  }

  async encerrarVersaoCorrente(obrigacaoId: string, versao: number) {
    await this.db.complianceVersao.updateMany({
      where: { obrigacaoId, versao, encerradaEm: null },
      data: { encerradaEm: new Date() },
    });
  }

  async listarVersoes(organizationId: string, obrigacaoId: string) {
    return this.db.complianceVersao.findMany({
      where: { organizationId, obrigacaoId },
      orderBy: { versao: "desc" },
    });
  }

  /* ── Varredura de prazos ───────────────────────────────────────────────── */

  /**
   * Obrigações que o motor de alertas precisa examinar.
   *
   * `status` fora do radar (cancelada, arquivada) e sem validade ficam de fora:
   * não há prazo a cobrar, e incluí-las só gastaria o tempo da varredura.
   */
  async paraVarredura(limiteInferior: Date, limiteSuperior: Date) {
    return this.db.complianceObrigacao.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ["cancelada", "arquivada"] },
        dataValidade: { not: null },
        OR: [
          { dataValidade: { gte: limiteInferior, lte: limiteSuperior } },
          { prazoInternoEm: { gte: limiteInferior, lte: limiteSuperior } },
          { prazoFatalEm: { gte: limiteInferior, lte: limiteSuperior } },
        ],
      },
      include: {
        categoria: { select: { id: true, nome: true } },
        orgao: { select: { nome: true } },
        responsaveis: {
          where: { notificar: true },
          include: {
            user: {
              select: {
                id: true, nome: true, email: true, ativo: true,
                // O WhatsApp do usuário mora no perfil, não no User — e
                // `whatsappAlertas` é o opt-in dele, que o motor respeita.
                profile: { select: { whatsapp: true, whatsappAlertas: true } },
              },
            },
          },
        },
        camposValores: { include: { campo: { select: { chave: true, tipo: true } } } },
      },
    });
  }

  /**
   * Marca como vencida o que passou da validade sem prorrogação.
   *
   * O status declarado precisa acompanhar a realidade, senão a lista filtrada
   * por `status=ativa` continuaria mostrando licença vencida como ativa. A
   * situação derivada já estaria certa — mas o filtro de status, não.
   */
  async marcarVencidas(hoje: Date): Promise<number> {
    const r = await this.db.complianceObrigacao.updateMany({
      where: {
        deletedAt: null,
        status: { in: ["ativa", "em_renovacao"] },
        prorrogacaoVigente: false,
        dataValidade: { not: null, lt: hoje },
      },
      data: { status: "vencida" },
    });
    return r.count;
  }
}
