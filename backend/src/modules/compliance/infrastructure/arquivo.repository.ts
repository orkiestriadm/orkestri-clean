import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Acesso a dados dos anexos e do histórico da obrigação.
 *
 * `arquivoRef` NUNCA sai em listagem: o caminho físico não pertence à resposta
 * JSON. Só a consulta de download o traz, e o serviço o descarta antes de
 * responder.
 */

const CAMPOS_LISTA = {
  id: true,
  obrigacaoId: true,
  versaoId: true,
  titulo: true,
  nomeOriginal: true,
  mime: true,
  tamanho: true,
  versao: true,
  observacoes: true,
  criadoEm: true,
  criadoPorId: true,
} as const;

@Injectable()
export class ArquivoRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get db(): any {
    return this.prisma as any;
  }

  async listar(organizationId: string, obrigacaoId: string) {
    return this.db.complianceArquivo.findMany({
      where: { organizationId, obrigacaoId, deletedAt: null },
      select: CAMPOS_LISTA,
      orderBy: [{ versao: "desc" }, { criadoEm: "desc" }],
    });
  }

  /** Só id e ref — para o serviço saber se o arquivo sumiu do armazenamento. */
  async refsDaObrigacao(organizationId: string, obrigacaoId: string) {
    return this.db.complianceArquivo.findMany({
      where: { organizationId, obrigacaoId, deletedAt: null },
      select: { id: true, arquivoRef: true },
    });
  }

  /** Inclui `arquivoRef` — só para o download, nunca para resposta JSON. */
  async obterParaDownload(organizationId: string, id: string) {
    return this.db.complianceArquivo.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: {
        id: true, obrigacaoId: true, titulo: true, arquivoRef: true,
        nomeOriginal: true, mime: true,
      },
    });
  }

  async criar(dados: any) {
    return this.db.complianceArquivo.create({ data: dados, select: CAMPOS_LISTA });
  }

  async obter(organizationId: string, id: string) {
    return this.db.complianceArquivo.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: { ...CAMPOS_LISTA, arquivoRef: true },
    });
  }

  async excluirLogicamente(id: string) {
    return this.db.complianceArquivo.update({
      where: { id }, data: { deletedAt: new Date() },
    });
  }

  /** Próxima versão do anexo com o mesmo título — o "v2" do mesmo documento. */
  async proximaVersaoDoTitulo(obrigacaoId: string, titulo: string): Promise<number> {
    const ultimo = await this.db.complianceArquivo.findFirst({
      where: { obrigacaoId, titulo, deletedAt: null },
      orderBy: { versao: "desc" },
      select: { versao: true },
    });
    return (ultimo?.versao ?? 0) + 1;
  }
}

@Injectable()
export class HistoricoRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get db(): any {
    return this.prisma as any;
  }

  /**
   * Registra um evento no histórico da obrigação.
   *
   * Nunca derruba a operação que a originou — mas TAMBÉM nunca falha em
   * silêncio: o `catch` vazio foi o que deixou a trilha do People vazia por
   * semanas sem ninguém perceber.
   */
  async registrar(dados: {
    organizationId: string;
    obrigacaoId: string;
    userId?: string | null;
    acao: string;
    campo?: string | null;
    valorAnterior?: string | null;
    valorNovo?: string | null;
    descricao?: string | null;
    ip?: string | null;
    origem?: string;
  }) {
    return this.db.complianceHistorico.create({
      data: {
        organizationId: dados.organizationId,
        obrigacaoId: dados.obrigacaoId,
        userId: dados.userId ?? null,
        acao: dados.acao,
        campo: dados.campo ?? null,
        valorAnterior: dados.valorAnterior ?? null,
        valorNovo: dados.valorNovo ?? null,
        descricao: dados.descricao ?? null,
        ip: dados.ip ?? null,
        origem: dados.origem ?? "web",
      },
    });
  }

  async registrarVarios(eventos: any[]) {
    if (eventos.length === 0) return;
    return this.db.complianceHistorico.createMany({ data: eventos });
  }

  async listar(organizationId: string, obrigacaoId: string, limite = 200) {
    return this.db.complianceHistorico.findMany({
      where: { organizationId, obrigacaoId },
      orderBy: { criadoEm: "desc" },
      take: limite,
      include: { user: { select: { id: true, nome: true, avatar: true } } },
    });
  }
}

@Injectable()
export class EnvioRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get db(): any {
    return this.prisma as any;
  }

  /**
   * Grava o envio se — e só se — a chave ainda não existir.
   *
   * A idempotência é imposta pelo índice único, não por um SELECT antes do
   * INSERT: duas varreduras concorrentes (o cron e um disparo manual) passariam
   * pelo SELECT juntas e enviariam duas vezes. Aqui a segunda colide com o
   * índice e devolve `false`.
   */
  async registrarSeInedito(dados: {
    organizationId: string;
    obrigacaoId: string;
    regraId?: string | null;
    marco: string;
    canal: string;
    destino: string;
    chave: string;
    status?: string;
    erro?: string | null;
  }): Promise<boolean> {
    try {
      await this.db.complianceNotificacaoEnvio.create({
        data: {
          organizationId: dados.organizationId,
          obrigacaoId: dados.obrigacaoId,
          regraId: dados.regraId ?? null,
          marco: dados.marco,
          canal: dados.canal,
          destino: dados.destino,
          chave: dados.chave,
          status: dados.status ?? "enviado",
          erro: dados.erro ?? null,
        },
      });
      return true;
    } catch (erro: any) {
      // P2002 = violação de unique. É o caminho esperado quando o marco já foi
      // enviado; qualquer outro erro sobe.
      if (erro?.code === "P2002") return false;
      throw erro;
    }
  }

  async marcarFalha(chave: string, erro: string) {
    await this.db.complianceNotificacaoEnvio.updateMany({
      where: { chave }, data: { status: "falhou", erro: erro.slice(0, 2000) },
    });
  }

  async listar(organizationId: string, obrigacaoId?: string, limite = 200) {
    return this.db.complianceNotificacaoEnvio.findMany({
      where: { organizationId, ...(obrigacaoId ? { obrigacaoId } : {}) },
      orderBy: { enviadoEm: "desc" },
      take: limite,
      include: obrigacaoId
        ? undefined
        : { obrigacao: { select: { id: true, codigo: true, nome: true } } },
    });
  }
}
