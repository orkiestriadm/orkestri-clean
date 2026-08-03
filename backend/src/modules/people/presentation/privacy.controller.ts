import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { Permissions } from "../../auth/permissions.decorator";
import { PrivacyService, AnonimizarDto, ElegiveisQuery } from "../application/privacy.service";
import { PEOPLE_PERMISSIONS } from "../people.permissions";

/**
 * Privacidade — eliminação do dado pessoal de ex-colaborador (LGPD).
 *
 * Permissão própria (`people.privacidade:gerenciar`) e não a de excluir
 * colaborador: são ações diferentes. Excluir tira das telas e volta atrás;
 * esta apaga o que identifica a pessoa e não tem volta. Reaproveitar a
 * permissão daria o poder irreversível a quem só recebeu o reversível.
 *
 * Controller fino: a regra de quem pode e de quando está no serviço.
 */
@Controller("v1/people/privacidade")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class PrivacyController {
  constructor(private readonly service: PrivacyService) {}

  @Get("elegiveis")
  @Permissions(PEOPLE_PERMISSIONS.privacidade.gerenciar)
  elegiveis(@Req() req: any, @Query() query: ElegiveisQuery) {
    return this.service.elegiveis(req.user, query.anosGuarda);
  }

  @Get(":collaboratorId/previa")
  @Permissions(PEOPLE_PERMISSIONS.privacidade.gerenciar)
  previa(
    @Req() req: any,
    @Param("collaboratorId") collaboratorId: string,
    @Query() query: ElegiveisQuery,
  ) {
    return this.service.previa(req.user, collaboratorId, query.anosGuarda);
  }

  @Post(":collaboratorId/anonimizar")
  @Permissions(PEOPLE_PERMISSIONS.privacidade.gerenciar)
  anonimizar(
    @Req() req: any,
    @Param("collaboratorId") collaboratorId: string,
    @Body() dto: AnonimizarDto,
  ) {
    return this.service.anonimizar(req.user, collaboratorId, dto);
  }
}
