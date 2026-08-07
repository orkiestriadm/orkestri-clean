import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Acesso a dados do que se CONFIGURA no módulo: categorias e seus campos,
 * órgãos, tags, réguas de alerta, templates, escalonamentos e fluxos.
 *
 * Estão juntos porque compartilham a mesma natureza — cadastros pequenos, lidos
 * inteiros, alterados raramente — e separá-los em sete repositórios de dez
 * linhas cada não ajudaria ninguém a achar nada.
 */
@Injectable()
export class CatalogoRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get db(): any {
    return this.prisma as any;
  }

  /* ── Categorias ────────────────────────────────────────────────────────── */

  async listarCategorias(organizationId: string, incluirInativas = false) {
    return this.db.complianceCategoria.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(incluirInativas ? {} : { ativo: true }),
      },
      orderBy: [{ ordem: "asc" }, { nome: "asc" }],
      include: {
        campos: {
          where: { deletedAt: null },
          orderBy: { ordem: "asc" },
        },
        _count: { select: { obrigacoes: { where: { deletedAt: null } } } },
      },
    });
  }

  async obterCategoria(organizationId: string, id: string) {
    return this.db.complianceCategoria.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { campos: { where: { deletedAt: null }, orderBy: { ordem: "asc" } } },
    });
  }

  async criarCategoria(dados: any) {
    return this.db.complianceCategoria.create({ data: dados });
  }

  async atualizarCategoria(id: string, dados: any) {
    return this.db.complianceCategoria.update({ where: { id }, data: dados });
  }

  /**
   * Categoria com obrigação viva não é excluída.
   *
   * Excluir logicamente deixaria as obrigações apontando para uma categoria que
   * some das telas — os campos personalizados sumiriam do detalhe e o painel
   * mostraria uma fatia sem nome. Quem quiser tirar do caminho, desativa.
   */
  async contarObrigacoesDaCategoria(categoriaId: string): Promise<number> {
    return this.db.complianceObrigacao.count({ where: { categoriaId, deletedAt: null } });
  }

  async excluirCategoria(id: string) {
    return this.db.complianceCategoria.update({
      where: { id }, data: { deletedAt: new Date(), ativo: false },
    });
  }

  /* ── Campos personalizados ─────────────────────────────────────────────── */

  async listarCampos(organizationId: string, categoriaId: string) {
    return this.db.complianceCampoDefinicao.findMany({
      where: { organizationId, categoriaId, deletedAt: null },
      orderBy: { ordem: "asc" },
    });
  }

  async criarCampo(dados: any) {
    return this.db.complianceCampoDefinicao.create({ data: dados });
  }

  async atualizarCampo(id: string, dados: any) {
    return this.db.complianceCampoDefinicao.update({ where: { id }, data: dados });
  }

  async excluirCampo(id: string) {
    // Exclusão lógica: os valores já gravados continuam no banco. Apagar a
    // definição levaria junto o histórico do que foi preenchido, e há campo
    // (número de processo) que é a única identificação do documento.
    return this.db.complianceCampoDefinicao.update({
      where: { id }, data: { deletedAt: new Date(), ativo: false },
    });
  }

  async campoPorChave(categoriaId: string, chave: string) {
    return this.db.complianceCampoDefinicao.findFirst({
      where: { categoriaId, chave, deletedAt: null },
    });
  }

  /* ── Órgãos ────────────────────────────────────────────────────────────── */

  async listarOrgaos(organizationId: string) {
    return this.db.complianceOrgao.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { nome: "asc" },
      include: { _count: { select: { obrigacoes: { where: { deletedAt: null } } } } },
    });
  }

  async criarOrgao(dados: any) {
    return this.db.complianceOrgao.create({ data: dados });
  }

  async atualizarOrgao(id: string, dados: any) {
    return this.db.complianceOrgao.update({ where: { id }, data: dados });
  }

  async excluirOrgao(id: string) {
    return this.db.complianceOrgao.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /* ── Tags ──────────────────────────────────────────────────────────────── */

  async listarTags(organizationId: string) {
    return this.db.complianceTag.findMany({
      where: { organizationId },
      orderBy: { nome: "asc" },
      include: { _count: { select: { obrigacoes: true } } },
    });
  }

  /**
   * Resolve nomes de tag em ids, criando as que faltam.
   *
   * A tela envia nomes, não ids: o usuário digita "Urgente" no campo de tags e
   * espera que funcione, exista a tag ou não. Obrigar a cadastrar antes seria
   * uma ida e volta por etiqueta.
   */
  async garantirTags(organizationId: string, nomes: string[]): Promise<string[]> {
    const limpos = [...new Set(nomes.map(n => n.trim()).filter(Boolean))];
    if (limpos.length === 0) return [];

    const existentes = await this.db.complianceTag.findMany({
      where: { organizationId, nome: { in: limpos } },
      select: { id: true, nome: true },
    });
    const mapa = new Map<string, string>(existentes.map((t: any) => [t.nome, t.id]));

    for (const nome of limpos) {
      if (mapa.has(nome)) continue;
      const criada = await this.db.complianceTag.create({
        data: { organizationId, nome }, select: { id: true, nome: true },
      });
      mapa.set(criada.nome, criada.id);
    }
    return limpos.map(n => mapa.get(n)!).filter(Boolean);
  }

  async atualizarTag(id: string, dados: any) {
    return this.db.complianceTag.update({ where: { id }, data: dados });
  }

  async excluirTag(id: string) {
    return this.db.complianceTag.delete({ where: { id } });
  }

  /* ── Réguas de alerta ──────────────────────────────────────────────────── */

  async listarRegras(organizationId: string) {
    return this.db.complianceAlertaRegra.findMany({
      where: { organizationId },
      orderBy: [{ obrigacaoId: "asc" }, { categoriaId: "asc" }, { criadoEm: "asc" }],
      include: {
        categoria: { select: { id: true, nome: true } },
        obrigacao: { select: { id: true, codigo: true, nome: true } },
        template: { select: { id: true, nome: true, canal: true } },
      },
    });
  }

  /**
   * Réguas candidatas a uma obrigação, da mais específica para a mais genérica.
   *
   * A resolução (qual vence) fica no serviço; aqui só se traz o conjunto, numa
   * consulta só, porque isto roda para cada obrigação da varredura.
   */
  async regrasAplicaveis(organizationId: string, obrigacaoId: string, categoriaId: string) {
    return this.db.complianceAlertaRegra.findMany({
      where: {
        organizationId,
        ativo: true,
        OR: [
          { obrigacaoId },
          { categoriaId, obrigacaoId: null },
          { categoriaId: null, obrigacaoId: null },
        ],
      },
      include: { template: true },
    });
  }

  async criarRegra(dados: any) {
    return this.db.complianceAlertaRegra.create({ data: dados });
  }

  async atualizarRegra(id: string, dados: any) {
    return this.db.complianceAlertaRegra.update({ where: { id }, data: dados });
  }

  async excluirRegra(id: string) {
    return this.db.complianceAlertaRegra.delete({ where: { id } });
  }

  /* ── Templates ─────────────────────────────────────────────────────────── */

  async listarTemplates(organizationId: string) {
    return this.db.complianceTemplate.findMany({
      where: { organizationId }, orderBy: { nome: "asc" },
    });
  }

  async criarTemplate(dados: any) {
    return this.db.complianceTemplate.create({ data: dados });
  }

  async atualizarTemplate(id: string, dados: any) {
    return this.db.complianceTemplate.update({ where: { id }, data: dados });
  }

  async excluirTemplate(id: string) {
    return this.db.complianceTemplate.delete({ where: { id } });
  }

  /* ── Escalonamento ─────────────────────────────────────────────────────── */

  async listarEscalonamentos(organizationId: string, categoriaId?: string | null) {
    return this.db.complianceEscalonamento.findMany({
      where: {
        organizationId,
        ativo: true,
        ...(categoriaId !== undefined
          ? { OR: [{ categoriaId }, { categoriaId: null }] }
          : {}),
      },
      orderBy: [{ aposDias: "asc" }, { ordem: "asc" }],
      include: {
        categoria: { select: { id: true, nome: true } },
        user: { select: { id: true, nome: true, email: true } },
      },
    });
  }

  async criarEscalonamento(dados: any) {
    return this.db.complianceEscalonamento.create({ data: dados });
  }

  async atualizarEscalonamento(id: string, dados: any) {
    return this.db.complianceEscalonamento.update({ where: { id }, data: dados });
  }

  async excluirEscalonamento(id: string) {
    return this.db.complianceEscalonamento.delete({ where: { id } });
  }

  /* ── Fluxos ────────────────────────────────────────────────────────────── */

  async listarFluxos(organizationId: string) {
    return this.db.complianceFluxo.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { nome: "asc" },
      include: { etapas: { orderBy: { ordem: "asc" } } },
    });
  }

  async fluxoDaCategoria(organizationId: string, categoriaId: string) {
    return this.db.complianceFluxo.findFirst({
      where: { organizationId, categoriaId, ativo: true, deletedAt: null },
      include: { etapas: { orderBy: { ordem: "asc" } } },
    });
  }

  async criarFluxo(dados: any, etapas: any[]) {
    return this.db.complianceFluxo.create({
      data: { ...dados, etapas: { create: etapas } },
      include: { etapas: { orderBy: { ordem: "asc" } } },
    });
  }

  async substituirEtapas(organizationId: string, fluxoId: string, etapas: any[]) {
    await this.db.$transaction([
      this.db.complianceFluxoEtapa.deleteMany({ where: { fluxoId } }),
      ...(etapas.length
        ? [this.db.complianceFluxoEtapa.createMany({
            data: etapas.map(e => ({ ...e, organizationId, fluxoId })),
          })]
        : []),
    ]);
  }

  async atualizarFluxo(id: string, dados: any) {
    return this.db.complianceFluxo.update({
      where: { id }, data: dados,
      include: { etapas: { orderBy: { ordem: "asc" } } },
    });
  }

  async excluirFluxo(id: string) {
    return this.db.complianceFluxo.update({ where: { id }, data: { deletedAt: new Date(), ativo: false } });
  }

  async obterEtapa(organizationId: string, etapaId: string) {
    return this.db.complianceFluxoEtapa.findFirst({
      where: { id: etapaId, organizationId },
      include: { fluxo: { include: { etapas: { orderBy: { ordem: "asc" } } } } },
    });
  }

  async criarAprovacao(dados: any) {
    return this.db.complianceAprovacao.create({ data: dados });
  }

  async atualizarAprovacao(id: string, dados: any) {
    return this.db.complianceAprovacao.update({ where: { id }, data: dados });
  }

  async aprovacaoPendente(obrigacaoId: string, etapaId: string) {
    return this.db.complianceAprovacao.findFirst({
      where: { obrigacaoId, etapaId, decisao: "pendente" },
    });
  }

  async listarAprovacoesPendentes(organizationId: string) {
    return this.db.complianceAprovacao.findMany({
      where: { organizationId, decisao: "pendente" },
      orderBy: { criadoEm: "asc" },
      include: {
        etapa: { select: { id: true, nome: true, ordem: true, papelAprovador: true } },
        obrigacao: {
          select: {
            id: true, codigo: true, nome: true, dataValidade: true,
            categoria: { select: { nome: true, cor: true } },
          },
        },
      },
    });
  }
}
