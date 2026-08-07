import {
  Controller, Get, Post, Delete, Body, Param, Req, Res, UseGuards,
  UseInterceptors, UploadedFile,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { Response } from "express";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { Permissions } from "../../auth/permissions.decorator";
import { COMPLIANCE_PERMISSIONS } from "../compliance.permissions";
import { ArquivoService, TAMANHO_MAXIMO_BYTES } from "../application/arquivo.service";

@Controller("v1/compliance")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class ArquivoController {
  constructor(private readonly service: ArquivoService) {}

  private ip(req: any): string | undefined {
    return req.ip ?? req.headers?.["x-forwarded-for"] ?? undefined;
  }

  @Get("obrigacoes/:obrigacaoId/anexos")
  @Permissions(COMPLIANCE_PERMISSIONS.anexo.ver)
  listar(@Req() req: any, @Param("obrigacaoId") obrigacaoId: string) {
    return this.service.listar(req.user, obrigacaoId);
  }

  @Post("obrigacoes/:obrigacaoId/anexos")
  @Permissions(COMPLIANCE_PERMISSIONS.anexo.enviar)
  @UseInterceptors(FileInterceptor("arquivo", {
    storage: memoryStorage(),
    limits: { fileSize: TAMANHO_MAXIMO_BYTES },
  }))
  enviar(
    @Req() req: any,
    @Param("obrigacaoId") obrigacaoId: string,
    @Body() dados: { titulo?: string; observacoes?: string; versaoId?: string },
    @UploadedFile() arquivo: any,
  ) {
    return this.service.enviar(req.user, obrigacaoId, dados, arquivo, this.ip(req));
  }

  /**
   * Download autenticado.
   *
   * Estes arquivos ficam fora do diretório público justamente para que todo
   * acesso passe por aqui, com escopo de organização, permissão e trilha.
   */
  @Get("anexos/:id/download")
  @Permissions(COMPLIANCE_PERMISSIONS.anexo.ver)
  async baixar(@Req() req: any, @Param("id") id: string, @Res() res: Response) {
    const { stream, nomeOriginal, mime } = await this.service.paraDownload(req.user, id);

    res.setHeader("Content-Type", mime);
    // `attachment` e não `inline`: o navegador não renderiza o arquivo no
    // contexto da aplicação, o que fecha a porta para HTML/SVG malicioso.
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(nomeOriginal)}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");

    stream.pipe(res);
  }

  @Delete("anexos/:id")
  @Permissions(COMPLIANCE_PERMISSIONS.anexo.excluir)
  excluir(@Req() req: any, @Param("id") id: string) {
    return this.service.excluir(req.user, id, this.ip(req));
  }
}
