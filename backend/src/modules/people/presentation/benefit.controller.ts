import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { Permissions } from "../../auth/permissions.decorator";
import {
  BenefitService, CriarBeneficioDto, AtualizarBeneficioDto, ConcederDto, EncerrarDto,
} from "../application/benefit.service";
import { PEOPLE_PERMISSIONS } from "../people.permissions";

/**
 * Benefícios.
 *
 * O catálogo fica em /v1/people/beneficios; a concessão pendura no colaborador
 * em /v1/people/employees/:id/beneficios, porque é dado dele e passa pelo
 * escopo ABAC.
 */
@Controller("v1/people")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class BenefitController {
  constructor(private readonly service: BenefitService) {}

  /* ── Catálogo ─────────────────────────────────────────────────────────── */

  @Get("beneficios")
  @Permissions(PEOPLE_PERMISSIONS.beneficio.ver)
  listarCatalogo(@Req() req: any, @Query("incluirInativos") incluirInativos?: string) {
    return this.service.listarCatalogo(req.user, incluirInativos === "true");
  }

  @Post("beneficios")
  @Permissions(PEOPLE_PERMISSIONS.beneficio.gerenciar)
  criar(@Req() req: any, @Body() dto: CriarBeneficioDto) {
    return this.service.criarBeneficio(req.user, dto);
  }

  @Put("beneficios/:id")
  @Permissions(PEOPLE_PERMISSIONS.beneficio.gerenciar)
  atualizar(@Req() req: any, @Param("id") id: string, @Body() dto: AtualizarBeneficioDto) {
    return this.service.atualizarBeneficio(req.user, id, dto);
  }

  @Delete("beneficios/:id")
  @Permissions(PEOPLE_PERMISSIONS.beneficio.gerenciar)
  excluir(@Req() req: any, @Param("id") id: string) {
    return this.service.excluirBeneficio(req.user, id);
  }

  /* ── Concessões ───────────────────────────────────────────────────────── */

  @Get("employees/:collaboratorId/beneficios")
  @Permissions(PEOPLE_PERMISSIONS.beneficio.ver)
  listarDoColaborador(@Req() req: any, @Param("collaboratorId") collaboratorId: string) {
    return this.service.listarDoColaborador(req.user, collaboratorId);
  }

  @Post("employees/:collaboratorId/beneficios")
  @Permissions(PEOPLE_PERMISSIONS.beneficio.gerenciar)
  conceder(
    @Req() req: any,
    @Param("collaboratorId") collaboratorId: string,
    @Body() dto: ConcederDto,
  ) {
    return this.service.conceder(req.user, collaboratorId, dto);
  }

  @Put("beneficios/concessoes/:id/encerrar")
  @Permissions(PEOPLE_PERMISSIONS.beneficio.gerenciar)
  encerrar(@Req() req: any, @Param("id") id: string, @Body() dto: EncerrarDto) {
    return this.service.encerrar(req.user, id, dto);
  }
}
