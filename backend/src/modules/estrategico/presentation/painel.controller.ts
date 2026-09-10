import { Controller, Get, Param, Query, Req, Res, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Response } from "express";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { Permissions } from "../../auth/permissions.decorator";
import { ESTRATEGICO_PERMISSIONS as P } from "../estrategico.permissions";
import { PainelService } from "../application/painel.service";
import { RelatorioService } from "../application/relatorio.service";

@Controller("v1/estrategico")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class PainelController {
  constructor(
    private readonly painel: PainelService,
    private readonly relatorios: RelatorioService,
  ) {}

  @Get("painel")
  @Permissions(P.relatorio.ver)
  obterPainel(
    @Req() req: any,
    @Query("grupoId") grupoId?: string,
    @Query("objetivoId") objetivoId?: string,
    @Query("esferaId") esferaId?: string,
    @Query("areaId") areaId?: string,
    @Query("tipo") tipo?: string,
  ) {
    return this.painel.painel(req.user, { grupoId, objetivoId, esferaId, areaId, tipo });
  }

  @Get("relatorios")
  @Permissions(P.relatorio.ver)
  tipos(@Req() req: any) {
    return this.relatorios.tipos(req.user);
  }

  @Get("relatorios/:tipo")
  @Permissions(P.relatorio.ver)
  dados(@Req() req: any, @Param("tipo") tipo: string) {
    return this.relatorios.gerar(req.user, tipo);
  }

  @Get("relatorios/:tipo/exportar")
  @Permissions(P.relatorio.exportar)
  async exportar(
    @Req() req: any,
    @Param("tipo") tipo: string,
    @Query("formato") formato = "excel",
    @Res({ passthrough: true }) res: Response,
  ) {
    const arquivo = await this.relatorios.exportar(req.user, tipo, formato);
    res.setHeader("Content-Type", arquivo.mime);
    res.setHeader("Content-Disposition", `attachment; filename="${arquivo.nome}"`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(arquivo.conteudo);
  }
}
