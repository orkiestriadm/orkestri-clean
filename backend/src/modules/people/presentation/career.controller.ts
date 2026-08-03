import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Req, UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { Permissions } from "../../auth/permissions.decorator";
import {
  CareerService, TrilhaDto, DegrauDto, RequisitoDto, ReordenarDto, DefinirTrilhaDto, PromoverDto,
} from "../application/career.service";
import { PEOPLE_PERMISSIONS } from "../people.permissions";

/**
 * Plano de carreira.
 *
 * Ler é amplo (`carreira:ver`) e desenhar é restrito (`carreira:gerenciar`):
 * um plano que a pessoa não pode consultar não muda comportamento nenhum.
 */
@Controller("v1/people")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class CareerController {
  constructor(private readonly service: CareerService) {}

  /* ── Trilhas ────────────────────────────────────────────────────────────── */

  @Get("carreira/trilhas")
  @Permissions(PEOPLE_PERMISSIONS.carreira.ver)
  listar(@Req() req: any, @Query("incluirInativas") incluirInativas?: string) {
    return this.service.listarTrilhas(req.user, incluirInativas === "true");
  }

  @Post("carreira/trilhas")
  @Permissions(PEOPLE_PERMISSIONS.carreira.gerenciar)
  criar(@Req() req: any, @Body() dto: TrilhaDto) {
    return this.service.criarTrilha(req.user, dto);
  }

  @Put("carreira/trilhas/:id")
  @Permissions(PEOPLE_PERMISSIONS.carreira.gerenciar)
  atualizar(@Req() req: any, @Param("id") id: string, @Body() dto: TrilhaDto) {
    return this.service.atualizarTrilha(req.user, id, dto);
  }

  @Delete("carreira/trilhas/:id")
  @Permissions(PEOPLE_PERMISSIONS.carreira.gerenciar)
  excluir(@Req() req: any, @Param("id") id: string) {
    return this.service.excluirTrilha(req.user, id);
  }

  /* ── Degraus ────────────────────────────────────────────────────────────── */

  @Post("carreira/trilhas/:id/degraus")
  @Permissions(PEOPLE_PERMISSIONS.carreira.gerenciar)
  adicionarDegrau(@Req() req: any, @Param("id") id: string, @Body() dto: DegrauDto) {
    return this.service.adicionarDegrau(req.user, id, dto);
  }

  // Antes da paramétrica de degrau para a rota estática não ser capturada.
  @Patch("carreira/trilhas/:id/ordem")
  @Permissions(PEOPLE_PERMISSIONS.carreira.gerenciar)
  reordenar(@Req() req: any, @Param("id") id: string, @Body() dto: ReordenarDto) {
    return this.service.reordenarDegraus(req.user, id, dto);
  }

  @Put("carreira/degraus/:id")
  @Permissions(PEOPLE_PERMISSIONS.carreira.gerenciar)
  atualizarDegrau(@Req() req: any, @Param("id") id: string, @Body() dto: DegrauDto) {
    return this.service.atualizarDegrau(req.user, id, dto);
  }

  @Delete("carreira/degraus/:id")
  @Permissions(PEOPLE_PERMISSIONS.carreira.gerenciar)
  removerDegrau(@Req() req: any, @Param("id") id: string) {
    return this.service.removerDegrau(req.user, id);
  }

  /* ── Requisitos ─────────────────────────────────────────────────────────── */

  @Post("carreira/degraus/:id/requisitos")
  @Permissions(PEOPLE_PERMISSIONS.carreira.gerenciar)
  adicionarRequisito(@Req() req: any, @Param("id") id: string, @Body() dto: RequisitoDto) {
    return this.service.adicionarRequisito(req.user, id, dto);
  }

  @Delete("carreira/requisitos/:id")
  @Permissions(PEOPLE_PERMISSIONS.carreira.gerenciar)
  removerRequisito(@Req() req: any, @Param("id") id: string) {
    return this.service.removerRequisito(req.user, id);
  }

  /* ── Carreira do colaborador ────────────────────────────────────────────── */

  @Get("employees/:collaboratorId/carreira")
  @Permissions(PEOPLE_PERMISSIONS.carreira.ver)
  situacao(@Req() req: any, @Param("collaboratorId") collaboratorId: string) {
    return this.service.situacao(req.user, collaboratorId);
  }

  /**
   * Promover exige as DUAS permissões, com semântica E.
   *
   * Desenhar a trilha e mexer no cadastro de alguém são decisões diferentes:
   * quem monta o plano de carreira não necessariamente tem alçada para mover a
   * pessoa de cargo — e essa mudança arrasta faixa salarial e organograma.
   */
  @Post("employees/:collaboratorId/carreira/promover")
  @Permissions(PEOPLE_PERMISSIONS.carreira.gerenciar, PEOPLE_PERMISSIONS.colaborador.editar)
  promover(
    @Req() req: any,
    @Param("collaboratorId") collaboratorId: string,
    @Body() dto: PromoverDto,
  ) {
    return this.service.promover(req.user, collaboratorId, dto);
  }

  /**
   * Atribuir trilha é decisão de gestão de carreira, não leitura: fica sob
   * `gerenciar` mesmo sendo uma edição no cadastro do colaborador.
   */
  @Put("employees/:collaboratorId/carreira")
  @Permissions(PEOPLE_PERMISSIONS.carreira.gerenciar)
  definirTrilha(
    @Req() req: any,
    @Param("collaboratorId") collaboratorId: string,
    @Body() dto: DefinirTrilhaDto,
  ) {
    return this.service.definirTrilhaDoColaborador(req.user, collaboratorId, dto);
  }
}
