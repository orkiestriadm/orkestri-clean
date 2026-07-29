import { Controller, Get, Query, Req, Res, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Response } from "express";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { Permissions } from "../../auth/permissions.decorator";
import { ReportService } from "../application/report.service";
import { PEOPLE_PERMISSIONS } from "../people.permissions";

/** Painéis e exportação de pessoas. */
@Controller("v1/people/relatorios")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class ReportController {
  constructor(private readonly service: ReportService) {}

  @Get("visao-geral")
  @Permissions(PEOPLE_PERMISSIONS.relatorio.ver)
  visaoGeral(@Req() req: any, @Query("meses") meses?: string) {
    const janela = meses ? Number(meses) : undefined;
    return this.service.visaoGeral(req.user, Number.isFinite(janela!) ? janela : undefined);
  }

  @Get("desenvolvimento")
  @Permissions(PEOPLE_PERMISSIONS.relatorio.ver)
  desenvolvimento(@Req() req: any) {
    return this.service.desenvolvimentoGeral(req.user);
  }

  @Get("beneficios")
  @Permissions(PEOPLE_PERMISSIONS.relatorio.ver)
  beneficios(@Req() req: any) {
    return this.service.beneficiosGeral(req.user);
  }

  /**
   * Exportação do quadro.
   *
   * Exige `relatorio:exportar` E `colaborador:exportar`: o guard usa semântica
   * E, e tirar dado da plataforma é decisão diferente de olhar o painel — a
   * planilha sai do controle de acesso no instante em que é baixada.
   */
  @Get("colaboradores.csv")
  @Permissions(PEOPLE_PERMISSIONS.relatorio.exportar, PEOPLE_PERMISSIONS.colaborador.exportar)
  async exportar(@Req() req: any, @Res() res: Response) {
    const { nome, conteudo } = await this.service.exportarQuadro(req.user);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${nome}"`);
    // O arquivo tem nome e dados de pessoas: nenhum intermediário deve guardar.
    res.setHeader("Cache-Control", "no-store");
    res.send(conteudo);
  }
}
