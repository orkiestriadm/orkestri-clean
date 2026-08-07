import { Injectable, Logger, InternalServerErrorException } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

/**
 * Armazenamento dos anexos das obrigações.
 *
 * DELIBERADAMENTE FORA DE `UPLOAD_DIR`. Aquele diretório é publicado por
 * `useStaticAssets` no main.ts e proxiado pelo nginx: quem tiver a URL baixa o
 * arquivo, sem login e sem checagem de organização. Contrato, licença ambiental
 * e AVCB não podem ficar num diretório público.
 *
 * Aqui o arquivo só sai pelo endpoint de download, que valida escopo e permissão.
 *
 * Layout: {raiz}/{organizationId}/{obrigacaoId}/{arquivoId}.{ext}
 * Começar pela organização deixa o isolamento visível no disco e torna trivial
 * um backup por cliente.
 *
 * O diretório PRECISA ser volume nomeado no compose. Anexo em camada de
 * container se perde a cada deploy — foi o que aconteceu com os documentos do
 * People em agosto de 2026.
 */
@Injectable()
export class ArquivoStorageService {
  private readonly logger = new Logger(ArquivoStorageService.name);
  private readonly raiz: string;

  constructor() {
    this.raiz = process.env.COMPLIANCE_DOCS_DIR || "/app/secure/compliance-docs";
  }

  /** Caminho relativo guardado no banco — nunca absoluto, nunca URL. */
  refDe(organizationId: string, obrigacaoId: string, nomeArquivo: string): string {
    return path.posix.join(organizationId, obrigacaoId, nomeArquivo);
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
    organizationId: string, obrigacaoId: string, nomeArquivo: string, conteudo: Buffer,
  ): Promise<string> {
    const ref = this.refDe(organizationId, obrigacaoId, nomeArquivo);
    const destino = this.resolverSeguro(ref);
    await fs.promises.mkdir(path.dirname(destino), { recursive: true });
    // 0600: legível apenas pelo processo. Não há motivo para outros usuários do
    // container lerem um contrato.
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
   * O registro usa exclusão lógica (retenção legal), mas o arquivo pode sair.
   * Falha aqui é registrada, não propagada: o registro já foi marcado.
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
