import { BadRequestException } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

/**
 * Upload: o que confiar e o que nao confiar.
 *
 * DOIS dados do upload vem do atacante, e os dois eram usados como se fossem
 * verdade:
 *
 *   file.mimetype       e o header `Content-Type` da parte multipart. Quem
 *                       envia escolhe o valor. Filtrar por ele so barra o
 *                       usuario distraido.
 *   file.originalname   o nome do arquivo. A EXTENSAO saia daqui.
 *
 * O estrago vinha da combinacao com o diretorio publico: mandar
 * `Content-Type: image/png` com um arquivo chamado `x.html` passava no filtro e
 * era gravado como `<aleatorio>.html`. O nginx entao servia aquilo de
 * `/uploads/...` como `text/html`, na origem da aplicacao — XSS armazenado, com
 * acesso a sessao de quem abrisse.
 *
 * A defesa aqui tem duas camadas:
 *
 *   1. A extensao NUNCA vem do nome enviado. Vem da tabela abaixo, a partir do
 *      tipo aceito. `.html` nao esta na tabela, entao nao existe caminho que
 *      grave um `.html` — mesmo que o resto falhe.
 *
 *   2. O conteudo e conferido pelos primeiros bytes depois da gravacao. E o
 *      unico sinal que o atacante nao controla sem realmente enviar um arquivo
 *      daquele tipo.
 */

type TipoAceito = {
  /** Extensao que SERA usada no disco. Nunca a do nome enviado. */
  ext: string;
  /** Assinaturas possiveis nos primeiros bytes. Vazio = formato sem assinatura. */
  assinaturas: number[][];
};

/** `null` em `assinaturas` de texto: nao ha magic number, ver `conteudoConfere`. */
export const TIPOS_ACEITOS: Record<string, TipoAceito> = {
  "application/pdf":  { ext: ".pdf",  assinaturas: [[0x25, 0x50, 0x44, 0x46]] },                  // %PDF
  "image/png":        { ext: ".png",  assinaturas: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  "image/jpeg":       { ext: ".jpg",  assinaturas: [[0xff, 0xd8, 0xff]] },
  "image/gif":        { ext: ".gif",  assinaturas: [[0x47, 0x49, 0x46, 0x38]] },                  // GIF8
  "image/webp":       { ext: ".webp", assinaturas: [[0x52, 0x49, 0x46, 0x46]] },                  // RIFF
  "video/mp4":        { ext: ".mp4",  assinaturas: [] },                                          // ftyp fica no offset 4
  "text/plain":       { ext: ".txt",  assinaturas: [] },
  "text/csv":         { ext: ".csv",  assinaturas: [] },
  // OOXML e ZIP compartilham a assinatura PK — sao o mesmo container.
  "application/zip":  { ext: ".zip",  assinaturas: [[0x50, 0x4b, 0x03, 0x04]] },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                      { ext: ".xlsx", assinaturas: [[0x50, 0x4b, 0x03, 0x04]] },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
                      { ext: ".docx", assinaturas: [[0x50, 0x4b, 0x03, 0x04]] },
  // Office antigo: container OLE2.
  "application/msword":      { ext: ".doc", assinaturas: [[0xd0, 0xcf, 0x11, 0xe0]] },
  "application/vnd.ms-excel":{ ext: ".xls", assinaturas: [[0xd0, 0xcf, 0x11, 0xe0]] },
};

export const MIMES_ACEITOS = Object.keys(TIPOS_ACEITOS);

/**
 * `fileFilter` do multer. Barra o que nao esta na lista.
 *
 * Sozinho NAO e garantia — o mimetype vem do cliente. O que fecha a porta e a
 * extensao vir de `extensaoSegura`, nunca do nome enviado.
 */
export function filtroDeTipo(_req: any, file: any, cb: any) {
  if (MIMES_ACEITOS.includes(file.mimetype)) return cb(null, true);
  cb(new BadRequestException(`Tipo de arquivo não permitido: ${file.mimetype}`), false);
}

/**
 * Extensao a gravar no disco, derivada do tipo ACEITO.
 *
 * Nao recebe nem olha `originalname` de proposito: e dali que vinha o `.html`.
 */
export function extensaoSegura(mimetype: string): string {
  return TIPOS_ACEITOS[mimetype]?.ext ?? ".bin";
}

/** Nome de arquivo sem nada do que o usuario enviou. */
export function nomeDeArquivoSeguro(mimetype: string): string {
  const aleatorio = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${aleatorio}${extensaoSegura(mimetype)}`;
}

/**
 * Confere os primeiros bytes contra a assinatura do tipo declarado.
 *
 * Para formatos sem assinatura (texto, mp4) devolve `true`: nao ha o que
 * comparar. Isso e aceitavel porque a extensao ja foi forcada para `.txt` /
 * `.csv` / `.mp4`, e nenhuma delas e executada pelo navegador — um HTML
 * salvo como `.txt` e servido como texto, nao como pagina.
 */
export function conteudoConfere(buffer: Buffer, mimetype: string): boolean {
  const tipo = TIPOS_ACEITOS[mimetype];
  if (!tipo) return false;
  if (tipo.assinaturas.length === 0) return true;

  return tipo.assinaturas.some(assinatura =>
    assinatura.every((byte, i) => buffer[i] === byte),
  );
}

/**
 * Confere um arquivo JA GRAVADO e o APAGA se o conteudo nao corresponder.
 *
 * O `diskStorage` do multer grava antes de qualquer coisa poder olhar o
 * conteudo — o `fileFilter` so ve cabecalhos. Entao a conferencia real acontece
 * depois, e o arquivo reprovado sai do disco em vez de ficar la.
 */
export function validarArquivoGravado(caminho: string, mimetype: string): void {
  let descritor: number | undefined;
  try {
    descritor = fs.openSync(caminho, "r");
    const buffer = Buffer.alloc(16);
    fs.readSync(descritor, buffer, 0, 16, 0);
    fs.closeSync(descritor);
    descritor = undefined;

    if (!conteudoConfere(buffer, mimetype)) {
      fs.unlinkSync(caminho);
      throw new BadRequestException(
        "O conteúdo do arquivo não corresponde ao tipo informado.",
      );
    }
  } catch (e) {
    if (descritor !== undefined) { try { fs.closeSync(descritor); } catch {} }
    if (e instanceof BadRequestException) throw e;
    // Falha ao ler o proprio arquivo: nao deixa passar sem conferencia.
    try { fs.unlinkSync(caminho); } catch {}
    throw new BadRequestException("Não foi possível validar o arquivo enviado.");
  }
}

/** Bloco `storage` pronto, com nome e extensao seguros. */
export function nomeSeguroParaMulter(_req: any, file: any, cb: any) {
  cb(null, nomeDeArquivoSeguro(file.mimetype));
}

/** Impede que `..` no caminho escape do diretorio de uploads. */
export function caminhoDentroDe(base: string, ...partes: string[]): string {
  const alvo = path.resolve(base, ...partes);
  const raiz = path.resolve(base);
  if (alvo !== raiz && !alvo.startsWith(raiz + path.sep)) {
    throw new BadRequestException("Caminho de arquivo inválido.");
  }
  return alvo;
}
