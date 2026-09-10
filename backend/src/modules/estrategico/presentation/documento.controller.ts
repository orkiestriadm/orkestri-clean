import {
  Controller, Get, Post, Delete, Body, Param, Req, Res, UseGuards, UseInterceptors, UploadedFile,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { Response } from "express";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { Permissions } from "../../auth/permissions.decorator";
import { ESTRATEGICO_PERMISSIONS as P } from "../estrategico.permissions";
import { DocumentoService, TAMANHO_MAXIMO_BYTES } from "../application/documento.service";
import { ipDe } from "../application/contexto";
import { DocumentoDto } from "../application/dto/estrategico.dto";

@Controller("v1/estrategico")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class DocumentoController {
  constructor(private readonly service: DocumentoService) {}

  @Get("casos/:id/documentos")
  @Permissions(P.documento.ver)
  listar(@Req() req: any, @Param("id") id: string) {
    return this.service.listar(req.user, id);
  }

  @Post("casos/:id/documentos")
  @Permissions(P.documento.enviar)
  @UseInterceptors(FileInterceptor("arquivo", { storage: memoryStorage(), limits: { fileSize: TAMANHO_MAXIMO_BYTES } }))
  enviar(@Req() req: any, @Param("id") id: string, @Body() dados: DocumentoDto, @UploadedFile() arquivo: any) {
    return this.service.enviar(req.user, id, dados, arquivo, ipDe(req));
  }

  /** Download autenticado — o arquivo nunca tem URL pública. */
  @Get("documentos/:id/download")
  @Permissions(P.documento.ver)
  async baixar(@Req() req: any, @Param("id") id: string, @Res() res: Response) {
    const { stream, nomeOriginal, mime } = await this.service.paraDownload(req.user, id, ipDe(req));
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(nomeOriginal)}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");
    stream.pipe(res);
  }

  @Delete("documentos/:id")
  @Permissions(P.documento.excluir)
  excluir(@Req() req: any, @Param("id") id: string) {
    return this.service.excluir(req.user, id, ipDe(req));
  }
}
