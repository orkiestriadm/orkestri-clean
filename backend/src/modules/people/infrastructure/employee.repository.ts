import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Acesso a dados de colaborador.
 *
 * Único ponto do módulo People que fala Prisma — a regra de negócio não conhece
 * o ORM (BACKEND.md §10). O `where` sempre chega pronto do PeopleScopeService;
 * este repositório não decide escopo.
 */

export type ListarColaboradoresParams = {
  where: Record<string, any>;
  busca?: string;
  status?: string;
  setorId?: string;
  positionId?: string;
  gestorId?: string;
  pagina: number;
  tamanho: number;
  ordenarPor: string;
  direcao: "asc" | "desc";
};

/** Campos devolvidos em listagem. Nunca `select: *` — dado pessoal é restrito. */
const CAMPOS_LISTA = {
  id: true,
  matricula: true,
  nomeCompleto: true,
  emailCorporativo: true,
  telefone: true,
  celular: true,
  fotoUrl: true,
  cargo: true,
  status: true,
  ativo: true,
  dataAdmissao: true,
  userId: true,
  user: { select: { id: true, nome: true, email: true, ativo: true } },
  setor: { select: { id: true, nome: true, cor: true } },
  position: { select: { id: true, titulo: true, nivel: true } },
  gestor: { select: { id: true, nomeCompleto: true, user: { select: { nome: true } } } },
} as const;

@Injectable()
export class EmployeeRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get db(): any {
    return this.prisma as any;
  }

  async listar(params: ListarColaboradoresParams) {
    const where = this.montarFiltros(params);
    const [total, itens] = await Promise.all([
      this.db.collaborator.count({ where }),
      this.db.collaborator.findMany({
        where,
        select: CAMPOS_LISTA,
        orderBy: { [params.ordenarPor]: params.direcao },
        skip: (params.pagina - 1) * params.tamanho,
        take: params.tamanho,
      }),
    ]);
    return { total, itens };
  }

  /** Perfil completo. Só chamar depois de o escopo autorizar o id. */
  async obter(id: string, where: Record<string, any>) {
    return this.db.collaborator.findFirst({
      where: { ...where, id },
      include: {
        user: { select: { id: true, nome: true, email: true, ativo: true, ultimoLogin: true } },
        setor: { select: { id: true, nome: true, cor: true } },
        position: { select: { id: true, titulo: true, nivel: true, codigo: true } },
        gestor: { select: { id: true, nomeCompleto: true, user: { select: { nome: true } } } },
        liderados: {
          where: { excluidoEm: null },
          select: {
            id: true, nomeCompleto: true, cargo: true,
            // `position` junto de `cargo`: depois da migração para o catálogo,
            // `cargo` (texto livre) fica nulo e a aba Equipe mostrava "—" no
            // cargo de todo mundo. Mesmo defeito que a distribuição por vínculo.
            position: { select: { titulo: true } },
            user: { select: { nome: true } },
          },
        },
        enderecos: true,
        contatos: true,
      },
    });
  }

  /** Versão enxuta para checagens internas — evita carregar o perfil inteiro. */
  async obterParaValidacao(id: string, organizationId: string) {
    return this.db.collaborator.findFirst({
      where: { id, organizationId, excluidoEm: null },
      select: {
        id: true, userId: true, nomeCompleto: true, status: true,
        setorId: true, positionId: true, gestorId: true, matricula: true,
      },
    });
  }

  async criar(dados: Record<string, any>) {
    return this.db.collaborator.create({ data: dados, select: CAMPOS_LISTA });
  }

  /**
   * Cria o colaborador e o evento de admissão atomicamente.
   *
   * Sem transação, uma falha entre os dois deixaria a timeline do colaborador
   * começando do nada — e a admissão é o evento que ancora todo o histórico
   * funcional.
   */
  async criarComHistorico(params: {
    colaborador: Record<string, any>;
    historico: Record<string, any>;
  }) {
    const [colaborador] = await this.prisma.$transaction([
      this.db.collaborator.create({ data: params.colaborador, select: CAMPOS_LISTA }),
      this.db.collaboratorHistory.create({ data: params.historico }),
    ]);
    return colaborador;
  }

  /** Atualização e eventos de histórico na mesma transação. */
  async atualizarComHistorico(params: {
    id: string;
    dados: Record<string, any>;
    historico: Record<string, any>[];
  }) {
    const [colaborador] = await this.prisma.$transaction([
      this.db.collaborator.update({
        where: { id: params.id },
        data: params.dados,
        select: CAMPOS_LISTA,
      }),
      ...params.historico.map((h) => this.db.collaboratorHistory.create({ data: h })),
    ]);
    return colaborador;
  }

  async atualizar(id: string, dados: Record<string, any>) {
    return this.db.collaborator.update({ where: { id }, data: dados, select: CAMPOS_LISTA });
  }

  /** Soft delete: registro funcional tem retenção legal (docs/people/ADR-004 §3). */
  async excluir(id: string, atorId: string | null) {
    return this.db.collaborator.update({
      where: { id },
      data: { excluidoEm: new Date(), atualizadoPorId: atorId, ativo: false },
      select: { id: true },
    });
  }

  /**
   * Nome legível dos IDs que aparecem na linha do tempo.
   *
   * A descrição do evento é lida por gente: sem isto ela saía como
   * "Cargo: 28e8cf35-e39e-… → fd26aad2-d5e1-…". Cada método devolve um mapa
   * id → rótulo, e lista vazia não consulta nada.
   */
  async nomesDeSetor(organizationId: string, ids: string[]): Promise<[string, string][]> {
    if (!ids.length) return [];
    const linhas = await this.db.setor.findMany({
      where: { id: { in: ids }, organizationId },
      select: { id: true, nome: true },
    });
    return linhas.map((s: any) => [s.id, s.nome]);
  }

  async titulosDeCargo(organizationId: string, ids: string[]): Promise<[string, string][]> {
    if (!ids.length) return [];
    const linhas = await this.db.position.findMany({
      where: { id: { in: ids }, organizationId },
      select: { id: true, titulo: true },
    });
    return linhas.map((p: any) => [p.id, p.titulo]);
  }

  async nomesDeColaborador(organizationId: string, ids: string[]): Promise<[string, string][]> {
    if (!ids.length) return [];
    const linhas = await this.db.collaborator.findMany({
      where: { id: { in: ids }, organizationId },
      select: { id: true, nomeCompleto: true, user: { select: { nome: true } } },
    });
    // `nomeCompleto` pode ser nulo em quem veio pelo cadastro antigo; aí o nome
    // do login é o melhor que existe.
    return linhas.map((c: any) => [c.id, c.nomeCompleto || c.user?.nome || c.id]);
  }

  async matriculaEmUso(organizationId: string, matricula: string, excetoId?: string) {
    const achado = await this.db.collaborator.findFirst({
      where: {
        organizationId,
        matricula,
        ...(excetoId ? { NOT: { id: excetoId } } : {}),
      },
      select: { id: true },
    });
    return !!achado;
  }

  async usuarioJaVinculado(userId: string) {
    const achado = await this.db.collaborator.findUnique({
      where: { userId },
      select: { id: true },
    });
    return !!achado;
  }

  async usuarioPertenceA(userId: string, organizationId: string) {
    const achado = await this.db.user.findFirst({
      where: { id: userId, organizationId },
      select: { id: true },
    });
    return !!achado;
  }

  /**
   * Mapa colaborador → gestor da organização inteira.
   *
   * Usado para detectar ciclo de gestão antes de gravar. Carrega dois campos de
   * todos os colaboradores: aceitável para milhares, revisar se passar disso.
   */
  async mapaDeGestores(organizationId: string): Promise<Map<string, string | null>> {
    const todos = await this.db.collaborator.findMany({
      where: { organizationId, excluidoEm: null },
      select: { id: true, gestorId: true },
    });
    return new Map(todos.map((c: any) => [c.id, c.gestorId]));
  }

  private montarFiltros(params: ListarColaboradoresParams) {
    const where: Record<string, any> = { ...params.where };

    if (params.status) where.status = params.status;
    if (params.setorId) where.setorId = params.setorId;
    if (params.positionId) where.positionId = params.positionId;
    if (params.gestorId) where.gestorId = params.gestorId;

    if (params.busca?.trim()) {
      const termo = params.busca.trim();
      where.OR = [
        { nomeCompleto: { contains: termo, mode: "insensitive" } },
        { matricula: { contains: termo, mode: "insensitive" } },
        { emailCorporativo: { contains: termo, mode: "insensitive" } },
        { cargo: { contains: termo, mode: "insensitive" } },
        { user: { nome: { contains: termo, mode: "insensitive" } } },
        { user: { email: { contains: termo, mode: "insensitive" } } },
      ];
    }

    return where;
  }
}
