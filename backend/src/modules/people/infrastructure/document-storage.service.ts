import { Injectable, Logger, InternalServerErrorException } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

/**
 * Armazenamento dos documentos de colaborador.
 *
 * DELIBERADAMENTE FORA DE `UPLOAD_DIR`. Aquele diretório é publicado por
 * `useStaticAssets` em main.ts e proxiado pelo nginx: qualquer pessoa com a URL
 * baixa o arquivo, sem login e sem checagem de organização. Documento de
 * colaborador é dado restrito (PEOPLE_PERMISSIONS.md §21) e atestado médico é
 * dado sensível sob a LGPD — não pode ficar em diretório público.
 *
 * Aqui o arquivo só sai pelo endpoint de download, que valida escopo e permissão.
 *
 * Layout: {raiz}/{organizationId}/{collaboratorId}/{documentId}.{ext}
 * O caminho começa pela organização para que o isolamento seja visível no disco
 * (MULTITENANT.md §16) e um backup por cliente seja trivial.
 */
@Injectable()
export class DocumentStorageService {
  private readonly logger = new Logger(DocumentStorageService.name);
  private readonly raiz: string;

  constructor() {
    this.raiz = process.env.PEOPLE_DOCS_DIR || "/app/secure/people-docs";
  }

  /** Caminho relativo guardado no banco — nunca absoluto, nunca URL. */
  refDe(organizationId: string, collaboratorId: string, nomeArquivo: string): string {
    return path.posix.join(organizationId, collaboratorId, nomeArquivo);
  }

  /**
   * Resolve a referência para um caminho absoluto, recusando escapes.
   *
   * Mesmo com `arquivoRef` vindo do nosso banco, resolvemos e conferimos que o
   * resultado está sob a raiz: se um dia alguém gravar `../` ali, a leitura
   * falha em vez de servir arquivo de fora.
   */
  private resolverSeguro(arquivoRef: string): string {
    const absoluto = path.resolve(this.raiz, arquivoRef);
    const raizResolvida = path.resolve(this.raiz);
    if (absoluto !== raizResolvida && !absoluto.startsWith(raizResolvida + path.sep)) {
      this.logger.error(`Referência de arquivo fora da raiz segura: ${arquivoRef}`);
      throw new InternalServerErrorException("Referência de arquivo inválida");
    }
    return absoluto;
  }

  async gravar(
    organizationId: string,
    collaboratorId: string,
    nomeArquivo: string,
    conteudo: Buffer,
  ): Promise<string> {
    const ref = this.refDe(organizationId, collaboratorId, nomeArquivo);
    const destino = this.resolverSeguro(ref);
    await fs.promises.mkdir(path.dirname(destino), { recursive: true });
    // Modo 0600: legível apenas pelo processo. Não há motivo para o arquivo ser
    // legível por outros usuários do container.
    await fs.promises.writeFile(destino, conteudo, { mode: 0o600 });
    return ref;
  }

  existe(arquivoRef: string): boolean {
    try {
      return fs.existsSync(this.resolverSeguro(arquivoRef));
    } catch {
      return false;
    }
  }

  abrirLeitura(arquivoRef: string): fs.ReadStream {
    return fs.createReadStream(this.resolverSeguro(arquivoRef));
  }

  /**
   * Remove o arquivo físico.
   *
   * O registro usa exclusão lógica (retenção legal), mas o arquivo em si pode
   * sair — é o que a LGPD espera de um pedido de eliminação. Falha aqui é
   * registrada, não propagada: o registro já foi marcado como excluído.
   */
  async remover(arquivoRef: string): Promise<void> {
    try {
      await fs.promises.unlink(this.resolverSeguro(arquivoRef));
    } catch (erro: any) {
      if (erro?.code !== "ENOENT") {
        this.logger.warn(`Não foi possível remover ${arquivoRef}: ${erro?.message}`);
      }
    }
  }
}
