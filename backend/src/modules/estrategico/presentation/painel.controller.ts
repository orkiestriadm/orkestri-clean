import { Controller, Get, Param, Query, Req, Res, StreamableFile, UseGuards } from "@nestjs/common";
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

  /*
   * Prévias em `/analises` e NÃO em `/relatorios`: o nginx dos dois ambientes
   * limita a 5 req/min (burst 3) qualquer URL que contenha "relatorio",
   * "export", "csv" ou "download" (`location ~* /api/.*\/(export|csv|relatorio|download)`).
   * A tela de Relatórios dispara duas chamadas só para abrir; clicar em três
   * tipos seguidos já dava 429. A prévia é JSON leve e fica fora do limite;
   * a EXPORTAÇÃO do arquivo continua sob ele, que é onde ele faz sentido.
   * Encontrado no teste de ponta a ponta de 10/09/2026.
   */
  @Get("analises")
  @Permissions(P.relatorio.ver)
  tipos(@Req() req: any) {
    return this.relatorios.tipos(req.user);
  }

  @Get("analises/:tipo")
  @Permissions(P.relatorio.ver)
  dados(@Req() req: any, @Param("tipo") tipo: string) {
    return this.relatorios.gerar(req.user, tipo);
  }

  /**
   * `StreamableFile` e não `return res.send(...)`: com `passthrough`, o Nest
   * serializa o valor devolvido — e devolver o próprio `Response` gerava
   * "Converting circular structure to JSON" no log a cada exportação, depois
   * de o arquivo já ter saído.
   */
  @Get("relatorios/:tipo/exportar")
  @Permissions(P.relatorio.exportar)
  async exportar(
    @Req() req: any,
    @Param("tipo") tipo: string,
    @Query("formato") formato = "excel",
    @Res({ passthrough: true }) res: Response,
  ) {
    const arquivo = await this.relatorios.exportar(req.user, tipo, formato);
    res.setHeader("Cache-Control", "private, no-store");
    return new StreamableFile(arquivo.conteudo, {
      type: arquivo.mime,
      disposition: `attachment; filename="${arquivo.nome}"`,
      length: arquivo.conteudo.length,
    });
  }
}
