import {
  Controller, Get, Post, Patch, Delete, Body, Param, Req, Res,
  UseGuards, UseInterceptors, UploadedFile,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { Response } from "express";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { Permissions } from "../../auth/permissions.decorator";
import { DocumentService } from "../application/document.service";
import { PEOPLE_PERMISSIONS } from "../people.permissions";
import { EnviarDocumentoDto, DecidirDocumentoDto } from "../application/dto/document.dto";
import { TAMANHO_MAXIMO_BYTES } from "../domain/document.entity";

/**
 * Documentos do colaborador.
 *
 * `memoryStorage` e não `diskStorage`: com disco, o multer grava o arquivo
 * ANTES de qualquer validação — um upload sem permissão ou de tipo recusado já
 * teria tocado o disco, e num diretório que o multer escolhe, não o nosso
 * serviço de armazenamento. Em memória o serviço decide se e onde grava.
 * O teto de 15 MB torna isso seguro.
 *
 * Controller fino: nem uma regra de acesso mora aqui (BACKEND.md §14).
 */
@Controller("v1/people")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class DocumentController {
  constructor(private readonly service: DocumentService) {}

  // Rota estática antes das paramétricas: o Nest casa por ordem de declaração,
  // e deixar `:id` na frente transformaria "conformidade" num id.
  @Get("documents/conformidade")
  @Permissions(PEOPLE_PERMISSIONS.relatorio.ver)
  conformidade(@Req() req: any) {
    return this.service.conformidade(req.user);
  }

  @Get("employees/:collaboratorId/documents")
  @Permissions(PEOPLE_PERMISSIONS.documento.ver)
  listar(@Req() req: any, @Param("collaboratorId") collaboratorId: string) {
    return this.service.listar(req.user, collaboratorId);
  }

  @Post("employees/:collaboratorId/documents")
  @Permissions(PEOPLE_PERMISSIONS.documento.enviar)
  @UseInterceptors(FileInterceptor("arquivo", {
    storage: memoryStorage(),
    limits: { fileSize: TAMANHO_MAXIMO_BYTES },
  }))
  enviar(
    @Req() req: any,
    @Param("collaboratorId") collaboratorId: string,
    @Body() dto: EnviarDocumentoDto,
    @UploadedFile() arquivo: any,
  ) {
    return this.service.enviar(req.user, collaboratorId, dto, arquivo);
  }

  /**
   * Download autenticado.
   *
   * Substitui o acesso direto por URL: estes arquivos ficam fora do diretório
   * público justamente para que todo acesso passe por aqui, com escopo,
   * permissão, sigilo por categoria e auditoria.
   */
  @Get("documents/:id/download")
  @Permissions(PEOPLE_PERMISSIONS.documento.ver)
  async baixar(@Req() req: any, @Param("id") id: string, @Res() res: Response) {
    const { stream, nomeArquivo, mimeType } = await this.service.prepararDownload(req.user, id);

    res.setHeader("Content-Type", mimeType);
    // `attachment` e não `inline`: o navegador não renderiza o arquivo no
    // contexto da aplicação, o que fecha a porta para HTML/SVG malicioso.
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(nomeArquivo)}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");

    stream.pipe(res);
  }

  @Patch("documents/:id/decisao")
  @Permissions(PEOPLE_PERMISSIONS.documento.aprovar)
  decidir(@Req() req: any, @Param("id") id: string, @Body() dto: DecidirDocumentoDto) {
    return this.service.decidir(req.user, id, dto);
  }

  @Delete("documents/:id")
  @Permissions(PEOPLE_PERMISSIONS.documento.excluir)
  excluir(@Req() req: any, @Param("id") id: string) {
    return this.service.excluir(req.user, id);
  }
}
