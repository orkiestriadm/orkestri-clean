import { Injectable, Logger, InternalServerErrorException } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

/**
 * Armazenamento dos documentos dos assuntos estratégicos.
 *
 * Mesmo desenho do Compliance: FORA de `UPLOAD_DIR`, com o arquivo saindo só
 * pelo endpoint autenticado de download. Petição, parecer e estudo econômico
 * de pleito são o tipo de documento que não pode ter URL pública.
 *
 * Layout: {raiz}/{organizationId}/{casoId}/{documentoId}.{ext}
 *
 * O diretório PRECISA ser volume nomeado (`estrategico_docs_data`) e existir na
 * imagem com dono `app` — ver o Dockerfile. Sem o volume, todo anexo some no
 * próximo deploy; sem o `chown`, o upload falha com erro de permissão.
 */
@Injectable()
export class DocumentoStorageService {
  private readonly logger = new Logger(DocumentoStorageService.name);
  private readonly raiz: string;

  constructor() {
    this.raiz = process.env.ESTRATEGICO_DOCS_DIR || "/app/secure/estrategico-docs";
  }

  private resolverSeguro(ref: string): string {
    const absoluto = path.resolve(this.raiz, ref);
    const raiz = path.resolve(this.raiz);
    if (absoluto !== raiz && !absoluto.startsWith(raiz + path.sep)) {
      this.logger.error(`Referência de arquivo fora da raiz segura: ${ref}`);
      throw new InternalServerErrorException("Referência de arquivo inválida");
    }
    return absoluto;
  }

  async gravar(organizationId: string, casoId: string, nomeArquivo: string, conteudo: Buffer): Promise<string> {
    const ref = path.posix.join(organizationId, casoId, nomeArquivo);
    const destino = this.resolverSeguro(ref);
    await fs.promises.mkdir(path.dirname(destino), { recursive: true });
    await fs.promises.writeFile(destino, conteudo, { mode: 0o600 });
    return ref;
  }

  existe(ref: string): boolean {
    try {
      return fs.existsSync(this.resolverSeguro(ref));
    } catch {
      return false;
    }
  }

  abrirLeitura(ref: string): fs.ReadStream {
    return fs.createReadStream(this.resolverSeguro(ref));
  }
}
