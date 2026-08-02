import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Acesso a dados dos documentos de colaborador.
 *
 * Único ponto do submódulo que fala Prisma. O escopo vem pronto do
 * PeopleScopeService — aqui não se decide quem vê o quê.
 */

/** Nunca devolve `arquivo_ref` em listagem: o caminho físico não sai da API. */
const CAMPOS_LISTA = {
  id: true,
  collaboratorId: true,
  categoria: true,
  titulo: true,
  descricao: true,
  nomeArquivo: true,
  mimeType: true,
  tamanhoBytes: true,
  dataEmissao: true,
  dataValidade: true,
  aprovacao: true,
  aprovadoEm: true,
  motivoRejeicao: true,
  criadoEm: true,
} as const;

@Injectable()
export class DocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get db(): any {
    return this.prisma as any;
  }

  async listarDoColaborador(collaboratorId: string, organizationId: string) {
    return this.db.collaboratorDocument.findMany({
      where: { collaboratorId, organizationId, excluidoEm: null },
      select: CAMPOS_LISTA,
      orderBy: { criadoEm: "desc" },
    });
  }

  /**
   * Só `id` e `arquivoRef` dos documentos do colaborador.
   *
   * Consulta separada porque `CAMPOS_LISTA` deliberadamente NÃO traz
   * `arquivoRef`: o caminho no armazenamento não pode sair em resposta JSON.
   * O serviço usa isto apenas para decidir se o arquivo existe, e descarta a
   * referência antes de responder.
   */
  async refsDoColaborador(collaboratorId: string, organizationId: string) {
    return this.db.collaboratorDocument.findMany({
      where: { collaboratorId, organizationId, excluidoEm: null },
      select: { id: true, arquivoRef: true },
    });
  }

  /** Inclui `arquivoRef` — só para o download, nunca para resposta JSON. */
  async obterParaDownload(id: string, organizationId: string) {
    return this.db.collaboratorDocument.findFirst({
      where: { id, organizationId, excluidoEm: null },
      select: {
        id: true, collaboratorId: true, categoria: true, titulo: true,
        arquivoRef: true, nomeArquivo: true, mimeType: true, aprovacao: true,
      },
    });
  }

  async obter(id: string, organizationId: string) {
    return this.db.collaboratorDocument.findFirst({
      where: { id, organizationId, excluidoEm: null },
      select: CAMPOS_LISTA,
    });
  }

  async obterParaValidacao(id: string, organizationId: string) {
    return this.db.collaboratorDocument.findFirst({
      where: { id, organizationId, excluidoEm: null },
      select: { id: true, collaboratorId: true, categoria: true, aprovacao: true, titulo: true, arquivoRef: true },
    });
  }

  async criar(dados: Record<string, any>) {
    return this.db.collaboratorDocument.create({ data: dados, select: CAMPOS_LISTA });
  }

  /**
   * Cria o documento e sua linha de histórico atomicamente.
   *
   * Sem transação, uma falha entre os dois deixaria documento sem rastro na
   * timeline do colaborador — buraco silencioso na trilha, que é justamente o
   * que precisa ser confiável em dado restrito.
   */
  async criarComHistorico(params: {
    documento: Record<string, any>;
    historico: Record<string, any>;
  }) {
    const [documento] = await this.prisma.$transaction([
      this.db.collaboratorDocument.create({ data: params.documento, select: CAMPOS_LISTA }),
      this.db.collaboratorHistory.create({ data: params.historico }),
    ]);
    return documento;
  }

  /** Decisão de aprovação e histórico na mesma transação. */
  async atualizarComHistorico(params: {
    id: string;
    dados: Record<string, any>;
    historico: Record<string, any>;
  }) {
    const [documento] = await this.prisma.$transaction([
      this.db.collaboratorDocument.update({
        where: { id: params.id },
        data: params.dados,
        select: CAMPOS_LISTA,
      }),
      this.db.collaboratorHistory.create({ data: params.historico }),
    ]);
    return documento;
  }

  async atualizar(id: string, dados: Record<string, any>) {
    return this.db.collaboratorDocument.update({
      where: { id },
      data: dados,
      select: CAMPOS_LISTA,
    });
  }

  async excluir(id: string, atorId: string | null) {
    return this.db.collaboratorDocument.update({
      where: { id },
      data: { excluidoEm: new Date(), atualizadoPorId: atorId },
      select: { id: true },
    });
  }

  /**
   * Documentos vencendo dentro da janela, para o painel de conformidade.
   *
   * Só aprovados: documento pendente ou rejeitado já aparece como pendência
   * em outro indicador — contá-lo aqui também seria cobrar duas vezes.
   */
  /**
   * Só id, título e referência de arquivo — para conferir o que existe em disco.
   *
   * Sem `select` enxuto isto carregaria o cadastro inteiro de cada documento da
   * organização só para checar a presença de um arquivo.
   */
  async referenciasDeArquivo(organizationId: string, collaboratorIds?: string[]) {
    return this.db.collaboratorDocument.findMany({
      where: {
        organizationId,
        excluidoEm: null,
        ...(collaboratorIds ? { collaboratorId: { in: collaboratorIds } } : {}),
      },
      select: {
        id: true, titulo: true, categoria: true, arquivoRef: true, collaboratorId: true,
        collaborator: { select: { nomeCompleto: true, user: { select: { nome: true } } } },
      },
    });
  }

  async vencendoAte(organizationId: string, limite: Date, collaboratorIds?: string[]) {
    return this.db.collaboratorDocument.findMany({
      where: {
        organizationId,
        excluidoEm: null,
        aprovacao: "APROVADO",
        dataValidade: { not: null, lte: limite },
        ...(collaboratorIds ? { collaboratorId: { in: collaboratorIds } } : {}),
      },
      select: {
        id: true, titulo: true, categoria: true, dataValidade: true,
        collaborator: {
          select: { id: true, nomeCompleto: true, user: { select: { nome: true } } },
        },
      },
      orderBy: { dataValidade: "asc" },
    });
  }

  async contarPorAprovacao(organizationId: string, collaboratorIds?: string[]) {
    const linhas = await this.db.collaboratorDocument.groupBy({
      by: ["aprovacao"],
      where: {
        organizationId,
        excluidoEm: null,
        ...(collaboratorIds ? { collaboratorId: { in: collaboratorIds } } : {}),
      },
      _count: { _all: true },
    });
    return Object.fromEntries(
      linhas.map((l: any) => [l.aprovacao, l._count._all]),
    ) as Record<string, number>;
  }
}
