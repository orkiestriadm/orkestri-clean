import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Req, UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { Permissions } from "../../auth/permissions.decorator";
import {
  ChecklistService, ModeloDto, ItemModeloDto, ReordenarItensDto,
  AbrirChecklistDto, MarcarItemDto,
} from "../application/checklist.service";
import { PEOPLE_PERMISSIONS } from "../people.permissions";

/**
 * Checklist de admissão e desligamento.
 *
 * VER é amplo — a pessoa precisa saber o que falta dela, e o gestor o que falta
 * do time. GERENCIAR (desenhar modelo, abrir e marcar) fica com quem conduz o
 * processo.
 */
@Controller("v1/people")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class ChecklistController {
  constructor(private readonly service: ChecklistService) {}

  /* ── Painel e modelos ───────────────────────────────────────────────────── */

  // Estáticas antes das paramétricas.
  @Get("checklists/painel")
  @Permissions(PEOPLE_PERMISSIONS.checklist.ver)
  painel(@Req() req: any) {
    return this.service.painel(req.user);
  }

  @Get("checklists/modelos")
  @Permissions(PEOPLE_PERMISSIONS.checklist.ver)
  listarModelos(@Req() req: any, @Query("incluirInativos") incluirInativos?: string) {
    return this.service.listarModelos(req.user, incluirInativos === "true");
  }

  @Post("checklists/modelos")
  @Permissions(PEOPLE_PERMISSIONS.checklist.gerenciar)
  criarModelo(@Req() req: any, @Body() dto: ModeloDto) {
    return this.service.criarModelo(req.user, dto);
  }

  @Put("checklists/modelos/:id")
  @Permissions(PEOPLE_PERMISSIONS.checklist.gerenciar)
  atualizarModelo(@Req() req: any, @Param("id") id: string, @Body() dto: ModeloDto) {
    return this.service.atualizarModelo(req.user, id, dto);
  }

  @Delete("checklists/modelos/:id")
  @Permissions(PEOPLE_PERMISSIONS.checklist.gerenciar)
  excluirModelo(@Req() req: any, @Param("id") id: string) {
    return this.service.excluirModelo(req.user, id);
  }

  @Post("checklists/modelos/:id/itens")
  @Permissions(PEOPLE_PERMISSIONS.checklist.gerenciar)
  adicionarItem(@Req() req: any, @Param("id") id: string, @Body() dto: ItemModeloDto) {
    return this.service.adicionarItemModelo(req.user, id, dto);
  }

  @Patch("checklists/modelos/:id/ordem")
  @Permissions(PEOPLE_PERMISSIONS.checklist.gerenciar)
  reordenar(@Req() req: any, @Param("id") id: string, @Body() dto: ReordenarItensDto) {
    return this.service.reordenarItensModelo(req.user, id, dto);
  }

  @Delete("checklists/modelos/itens/:id")
  @Permissions(PEOPLE_PERMISSIONS.checklist.gerenciar)
  removerItem(@Req() req: any, @Param("id") id: string) {
    return this.service.removerItemModelo(req.user, id);
  }

  /* ── Checklist do colaborador ───────────────────────────────────────────── */

  @Get("employees/:collaboratorId/checklists")
  @Permissions(PEOPLE_PERMISSIONS.checklist.ver)
  doColaborador(@Req() req: any, @Param("collaboratorId") collaboratorId: string) {
    return this.service.doColaborador(req.user, collaboratorId);
  }

  @Post("employees/:collaboratorId/checklists")
  @Permissions(PEOPLE_PERMISSIONS.checklist.gerenciar)
  abrir(
    @Req() req: any,
    @Param("collaboratorId") collaboratorId: string,
    @Body() dto: AbrirChecklistDto,
  ) {
    return this.service.abrir(req.user, collaboratorId, dto);
  }

  @Patch("checklists/itens/:id")
  @Permissions(PEOPLE_PERMISSIONS.checklist.gerenciar)
  marcarItem(@Req() req: any, @Param("id") id: string, @Body() dto: MarcarItemDto) {
    return this.service.marcarItem(req.user, id, dto);
  }

  @Delete("checklists/:id")
  @Permissions(PEOPLE_PERMISSIONS.checklist.gerenciar)
  excluirChecklist(@Req() req: any, @Param("id") id: string) {
    return this.service.excluirChecklist(req.user, id);
  }
}
