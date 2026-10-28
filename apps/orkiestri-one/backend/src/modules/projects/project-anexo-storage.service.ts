import { Injectable, Logger, InternalServerErrorException } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

/**
 * Armazenamento dos anexos de projeto.
 *
 * DELIBERADAMENTE FORA DE `UPLOAD_DIR`. Aquele diretório era publicado por
 * `useStaticAssets` e proxiado pelo nginx: quem tivesse a URL baixava o
 * arquivo, sem login e sem checagem de organização. Anexo de projeto carrega
 * proposta, valor e nome de cliente — não pode ficar em diretório público.
 *
 * Desde 11/08/2026 `UPLOAD_DIR` também deixou de ser público. A separação aqui
 * continua valendo: mantém estes arquivos fora do caminho de qualquer futura
 * republicação daquele diretório.
 *
 * Aqui o arquivo só sai pelo endpoint de download, que valida a organização.
 *
 * Layout: {raiz}/{organizationId}/{projectId}/{anexoId}.{ext}
 * Começar pela organização deixa o isolamento visível no disco e torna trivial
 * um backup por cliente.
 *
 * O diretório PRECISA ser volume nomeado no compose. Anexo em camada de
 * container se perde a cada deploy — foi o que aconteceu com os documentos do
 * People em agosto de 2026.
 */
@Injectable()
export class ProjectAnexoStorageService {
  private readonly logger = new Logger(ProjectAnexoStorageService.name);
  private readonly raiz: string;

  constructor() {
    this.raiz = process.env.PROJECT_DOCS_DIR || "/app/secure/project-docs";
  }

  /** Caminho relativo guardado no banco — nunca absoluto, nunca URL. */
  refDe(organizationId: string, projectId: string, nomeArquivo: string): string {
    return path.posix.join(organizationId, projectId, nomeArquivo);
  }

  /**
   * Resolve a referência para caminho absoluto, recusando escapes.
   *
   * Mesmo vindo do nosso banco, conferimos que o resultado está sob a raiz: se
   * um dia alguém gravar `../` ali, a leitura falha em vez de servir arquivo
   * de fora.
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
    organizationId: string, projectId: string, nomeArquivo: string, conteudo: Buffer,
  ): Promise<string> {
    const ref = this.refDe(organizationId, projectId, nomeArquivo);
    const destino = this.resolverSeguro(ref);
    await fs.promises.mkdir(path.dirname(destino), { recursive: true });
    // 0600: legível apenas pelo processo.
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
   * Falha aqui é registrada, não propagada: o registro já foi marcado como
   * excluído, e não vale derrubar a resposta por causa do disco.
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
