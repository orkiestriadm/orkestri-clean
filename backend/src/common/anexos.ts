import { NotFoundException } from "@nestjs/common";
import type { Response } from "express";
import * as fs from "fs";
import * as path from "path";

/**
 * Diretório raiz dos anexos em disco. Os arquivos NÃO são servidos como estáticos —
 * o acesso passa sempre por um endpoint autenticado do módulo dono do anexo, que
 * valida JWT, organização e permissão antes de chamar `enviarAnexo`.
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR || "/app/uploads";

// Só estes tipos vão inline no browser (usados em <img>/preview de PDF). Qualquer
// outra coisa desce como download — evita HTML/SVG hospedado virar XSS same-origin.
const MIMES_INLINE = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf",
]);

/** Remove aspas/quebras que corromperiam o header Content-Disposition. */
function sanitizeNome(nome: string): string {
  return path.basename(nome).replace(/["\\\r\n]/g, "_");
}

/**
 * Faz stream de um anexo já autorizado pelo chamador.
 *
 * @param subdir  segmentos de diretório sob UPLOAD_DIR (ex.: ["motoristas", id])
 * @param nomeArquivo  nome do arquivo em disco (vindo do banco)
 */
export function enviarAnexo(
  res: Response,
  subdir: string[],
  nomeArquivo: string,
  nomeOriginal?: string | null,
  mime?: string | null,
): void {
  const base = path.resolve(UPLOAD_DIR);
  // basename em cada segmento neutraliza "..", barras e caminhos absolutos
  const alvo = path.resolve(
    base,
    ...subdir.map(s => path.basename(String(s || ""))),
    path.basename(String(nomeArquivo || "")),
  );
  if (!alvo.startsWith(base + path.sep)) throw new NotFoundException("Arquivo não encontrado");
  if (!fs.existsSync(alvo) || !fs.statSync(alvo).isFile()) throw new NotFoundException("Arquivo não encontrado");

  const inline = !!mime && MIMES_INLINE.has(mime);
  const nome = sanitizeNome(nomeOriginal || nomeArquivo);

  res.setHeader("Content-Type", inline ? (mime as string) : "application/octet-stream");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader(
    "Content-Disposition",
    `${inline ? "inline" : "attachment"}; filename="${nome}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
  );
  fs.createReadStream(alvo).pipe(res);
}

/** Remove o arquivo do disco, ignorando ausência. */
export function removerAnexo(subdir: string[], nomeArquivo: string): void {
  const base = path.resolve(UPLOAD_DIR);
  const alvo = path.resolve(
    base,
    ...subdir.map(s => path.basename(String(s || ""))),
    path.basename(String(nomeArquivo || "")),
  );
  if (!alvo.startsWith(base + path.sep)) return;
  try { fs.unlinkSync(alvo); } catch { /* já removido */ }
}
