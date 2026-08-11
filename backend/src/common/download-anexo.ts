import { NotFoundException, StreamableFile } from "@nestjs/common";
import type { Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { caminhoDentroDe } from "./arquivo-seguro";
import { organizacaoDe } from "./escopo-organizacao";

/**
 * Download de anexo por rota AUTENTICADA.
 *
 * Antes, os anexos moravam num diretório publicado estaticamente e o nginx
 * repassava `/uploads/` direto, sem sessão nenhuma: quem tivesse a URL baixava
 * o arquivo — e o caminho era previsível o bastante para ser descoberto, já que
 * a listagem de anexos entregava a URL exata.
 *
 * Encadeava com a falta de escopo: um usuário do tenant A listava os anexos de
 * um chamado do tenant B e depois baixava cada um SEM sequer estar logado.
 *
 * Aqui todo acesso passa por três filtros — sessão, permissão da rota (via
 * `@Permissions` no controller) e organização do registro dono.
 *
 * O módulo Compliance já fazia assim; isto é o mesmo padrão, disponível para
 * os anexos que ficaram no diretório público (chamados, contratos, frota).
 */

const RAIZ_UPLOADS = process.env.UPLOAD_DIR || "/app/uploads";

export type AnexoParaDownload = {
  /** Subdiretório dentro de uploads, ex.: `contratos/<id>` ou `<chamadoId>`. */
  subdir: string;
  /** Nome do arquivo em disco (o gerado, nunca o enviado pelo usuário). */
  nomeArquivo: string;
  /** Nome que o usuário verá ao salvar. */
  nomeOriginal?: string | null;
  mimeType?: string | null;
};

/**
 * Confirma que o registro dono do anexo é da organização de quem pede.
 *
 * Recebe o dono já carregado porque cada módulo sabe qual é o seu (chamado,
 * contrato, motorista...). O que não pode variar é a comparação.
 */
export function exigirDonoDaOrganizacao(req: any, dono: { organizationId?: string | null } | null) {
  const orgId = organizacaoDe(req);
  // 404 e não 403: para quem está fora, o anexo não existe. Um 403 confirmaria
  // que aquele id é válido em outro tenant.
  if (!dono || dono.organizationId !== orgId) throw new NotFoundException("Anexo não encontrado");
}

/**
 * Envia o arquivo com os cabeçalhos que impedem execução no contexto da
 * aplicação.
 *
 * `attachment` + `nosniff` juntos: sem o segundo, o navegador ignora o
 * Content-Type declarado e adivinha pelo conteúdo, voltando a tratar como
 * página o que declaramos como binário.
 */
export function responderComAnexo(res: Response, anexo: AnexoParaDownload): StreamableFile {
  const caminho = caminhoDentroDe(RAIZ_UPLOADS, anexo.subdir, anexo.nomeArquivo);
  if (!fs.existsSync(caminho)) throw new NotFoundException("Arquivo não encontrado");

  const nome = anexo.nomeOriginal || path.basename(caminho);

  res.setHeader("Content-Type", anexo.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(nome)}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");

  return new StreamableFile(fs.createReadStream(caminho));
}
