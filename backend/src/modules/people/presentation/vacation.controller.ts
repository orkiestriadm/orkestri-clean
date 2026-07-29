import { Controller, Get, Post, Body, Param, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { Permissions } from "../../auth/permissions.decorator";
import { VacationService, SolicitarFeriasDto } from "../application/vacation.service";
import { PEOPLE_PERMISSIONS } from "../people.permissions";

/**
 * Férias — saldo e solicitação.
 *
 * Aprovar, rejeitar e cancelar continuam em /api/ausencias: o fluxo é genérico
 * e serve atestado e licença também. Aqui fica só o que é específico de férias.
 */
@Controller("v1/people")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class VacationController {
  constructor(private readonly service: VacationService) {}

  // Estática antes das paramétricas.
  @Get("ferias/passivo")
  @Permissions(PEOPLE_PERMISSIONS.relatorio.ver)
  passivo(@Req() req: any) {
    return this.service.passivo(req.user);
  }

  @Get("employees/:collaboratorId/ferias")
  @Permissions(PEOPLE_PERMISSIONS.ferias.ver)
  situacao(@Req() req: any, @Param("collaboratorId") collaboratorId: string) {
    return this.service.situacao(req.user, collaboratorId);
  }

  @Post("employees/:collaboratorId/ferias")
  @Permissions(PEOPLE_PERMISSIONS.ferias.solicitar)
  solicitar(
    @Req() req: any,
    @Param("collaboratorId") collaboratorId: string,
    @Body() dto: SolicitarFeriasDto,
  ) {
    return this.service.solicitar(req.user, collaboratorId, dto);
  }
}
