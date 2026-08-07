import {
  Injectable, Logger, NotFoundException, BadRequestException, PayloadTooLargeException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { AuditService } from "../../audit/audit.module";
import { ArquivoRepository, HistoricoRepository } from "../infrastructure/arquivo.repository";
import { ObrigacaoRepository } from "../infrastructure/obrigacao.repository";
import { ArquivoStorageService } from "../infrastructure/arquivo-storage.service";

type Usuario = { id: string; organizationId: string };

/**
 * Tipos aceitos.
 *
 * Lista de permissão, não de bloqueio — barrar extensões perigosas é jogo de
 * gato e rato. Aqui entram PDF, Word, Excel, imagem e ZIP, que é o que a
 * especificação pede. Sem SVG: carrega script e é servido como imagem.
 */
const MIMES_ACEITOS: readonly string[] = [
  "application/pdf",
  "image/jpeg", "image/png", "image/webp", "image/tiff",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip", "application/x-zip-compressed",
];

/** 25 MB: licença digitalizada com anexos técnicos passa dos 15 MB do People. */
export const TAMANHO_MAXIMO_BYTES = 25 * 1024 * 1024;

@Injectable()
export class ArquivoService {
  private readonly logger = new Logger(ArquivoService.name);

  constructor(
    private readonly repo: ArquivoRepository,
    private readonly obrigacoes: ObrigacaoRepository,
    private readonly historico: HistoricoRepository,
    private readonly storage: ArquivoStorageService,
    private readonly audit: AuditService,
  ) {}

  static mimesAceitos(): readonly string[] {
    return MIMES_ACEITOS;
  }

  async listar(user: Usuario, obrigacaoId: string) {
    await this.exigirObrigacao(user, obrigacaoId);
    const [itens, refs] = await Promise.all([
      this.repo.listar(user.organizationId, obrigacaoId),
      this.repo.refsDaObrigacao(user.organizationId, obrigacaoId),
    ]);

    // A linha pode existir e o arquivo não — deploy sem volume nomeado já
    // apagou anexo antes. Melhor a tela dizer "arquivo indisponível" do que
    // oferecer um download que devolve 500.
    const disponiveis = new Map<string, boolean>(
      refs.map((r: any) => [r.id, this.storage.existe(r.arquivoRef)]),
    );
    return itens.map((a: any) => ({ ...a, arquivoDisponivel: disponiveis.get(a.id) ?? false }));
  }

  async enviar(
    user: Usuario,
    obrigacaoId: string,
    dados: { titulo?: string; observacoes?: string; versaoId?: string },
    arquivo: { originalname: string; mimetype: string; size: number; buffer: Buffer } | undefined,
    ip?: string,
  ) {
    const obrigacao = await this.exigirObrigacao(user, obrigacaoId);

    if (!arquivo) throw new BadRequestException("Nenhum arquivo enviado.");
    if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
      throw new PayloadTooLargeException(
        `Arquivo maior que o limite de ${Math.round(TAMANHO_MAXIMO_BYTES / 1024 / 1024)} MB.`,
      );
    }
    if (!MIMES_ACEITOS.includes(arquivo.mimetype)) {
      throw new BadRequestException(
        `Tipo de arquivo não aceito (${arquivo.mimetype}). Aceitos: PDF, Word, Excel, imagem e ZIP.`,
      );
    }

    const titulo = (dados.titulo || arquivo.originalname).slice(0, 160);
    const id = randomUUID();
    // O nome enviado pelo cliente nunca vira caminho — só metadado. `../` no
    // nome escaparia do diretório da organização.
    const extensao = (arquivo.originalname.match(/\.([A-Za-z0-9]{1,8})$/)?.[1] ?? "bin").toLowerCase();
    const nomeSeguro = `${id}.${extensao}`;

    const arquivoRef = await this.storage.gravar(
      user.organizationId, obrigacaoId, nomeSeguro, arquivo.buffer,
    );

    const versao = await this.repo.proximaVersaoDoTitulo(obrigacaoId, titulo);

    const criado = await this.repo.criar({
      id,
      organizationId: user.organizationId,
      obrigacaoId,
      versaoId: dados.versaoId ?? null,
      titulo,
      nomeOriginal: arquivo.originalname,
      arquivoRef,
      mime: arquivo.mimetype,
      tamanho: arquivo.size,
      versao,
      observacoes: dados.observacoes ?? null,
      criadoPorId: user.id,
    });

    await this.historico.registrar({
      organizationId: user.organizationId,
      obrigacaoId, userId: user.id, acao: "anexou",
      descricao: `Anexou "${titulo}" (versão ${versao}).`,
      ip: ip ?? null,
    });
    await this.audit.log({
      organizationId: user.organizationId, userId: user.id, modulo: "compliance",
      tabela: "compliance_arquivos", registroId: id, acao: "criar",
      descricao: `Anexo "${titulo}" em ${obrigacao.codigo}`, ip: ip ?? null,
    });

    return { ...criado, arquivoDisponivel: true };
  }

  /** Devolve o metadado e o fluxo de leitura — quem escreve na resposta é o controller. */
  async paraDownload(user: Usuario, id: string) {
    const arquivo = await this.repo.obterParaDownload(user.organizationId, id);
    if (!arquivo) throw new NotFoundException("Anexo não encontrado");

    if (!this.storage.existe(arquivo.arquivoRef)) {
      this.logger.error(
        `Anexo ${id} existe no banco mas não no armazenamento (${arquivo.arquivoRef}). ` +
        `Verifique se COMPLIANCE_DOCS_DIR é um volume nomeado no compose.`,
      );
      throw new NotFoundException("O arquivo não está mais disponível no armazenamento.");
    }

    return {
      stream: this.storage.abrirLeitura(arquivo.arquivoRef),
      nomeOriginal: arquivo.nomeOriginal,
      mime: arquivo.mime || "application/octet-stream",
    };
  }

  async excluir(user: Usuario, id: string, ip?: string) {
    const arquivo = await this.repo.obter(user.organizationId, id);
    if (!arquivo) throw new NotFoundException("Anexo não encontrado");

    await this.repo.excluirLogicamente(id);
    // O registro fica (retenção), o arquivo sai do disco.
    await this.storage.remover(arquivo.arquivoRef);

    await this.historico.registrar({
      organizationId: user.organizationId,
      obrigacaoId: arquivo.obrigacaoId, userId: user.id, acao: "removeu_anexo",
      descricao: `Removeu o anexo "${arquivo.titulo}".`,
      ip: ip ?? null,
    });
    await this.audit.log({
      organizationId: user.organizationId, userId: user.id, modulo: "compliance",
      tabela: "compliance_arquivos", registroId: id, acao: "excluir",
      descricao: `Anexo "${arquivo.titulo}" removido`, ip: ip ?? null,
    });

    return { success: true };
  }

  private async exigirObrigacao(user: Usuario, obrigacaoId: string) {
    const o = await this.obrigacoes.obterCru(user.organizationId, obrigacaoId);
    if (!o) throw new NotFoundException("Obrigação não encontrada");
    return o;
  }
}
