import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { Permissions } from "../../auth/permissions.decorator";
import {
  DevelopmentService, CriarCursoDto, AtualizarCursoDto, RegistrarTreinamentoDto,
  AtualizarTreinamentoDto, SalvarAvaliacaoDto, CriarMetaDto, AtualizarMetaDto,
} from "../application/development.service";
import { PEOPLE_PERMISSIONS } from "../people.permissions";

/**
 * Treinamentos, certificações e avaliação de desempenho.
 *
 * Treinamento e avaliação convivem no mesmo controller mas nunca na mesma
 * permissão: nota de desempenho é dado de carreira, e quem cuida de
 * capacitação não necessariamente pode lê-la.
 */
@Controller("v1/people")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class DevelopmentController {
  constructor(private readonly service: DevelopmentService) {}

  /* ── Catálogo de cursos ───────────────────────────────────────────────── */

  // Estática antes da paramétrica: `:id` engoliria "vencendo".
  @Get("treinamentos/vencendo")
  @Permissions(PEOPLE_PERMISSIONS.treinamento.ver)
  vencendo(@Req() req: any) {
    return this.service.certificacoesVencendo(req.user);
  }

  @Get("treinamentos")
  @Permissions(PEOPLE_PERMISSIONS.treinamento.ver)
  listarCursos(@Req() req: any, @Query("incluirInativos") incluirInativos?: string) {
    return this.service.listarCursos(req.user, incluirInativos === "true");
  }

  @Post("treinamentos")
  @Permissions(PEOPLE_PERMISSIONS.treinamento.gerenciar)
  criarCurso(@Req() req: any, @Body() dto: CriarCursoDto) {
    return this.service.criarCurso(req.user, dto);
  }

  @Put("treinamentos/:id")
  @Permissions(PEOPLE_PERMISSIONS.treinamento.gerenciar)
  atualizarCurso(@Req() req: any, @Param("id") id: string, @Body() dto: AtualizarCursoDto) {
    return this.service.atualizarCurso(req.user, id, dto);
  }

  @Delete("treinamentos/:id")
  @Permissions(PEOPLE_PERMISSIONS.treinamento.gerenciar)
  excluirCurso(@Req() req: any, @Param("id") id: string) {
    return this.service.excluirCurso(req.user, id);
  }

  /* ── Participações ────────────────────────────────────────────────────── */

  @Get("employees/:collaboratorId/treinamentos")
  @Permissions(PEOPLE_PERMISSIONS.treinamento.ver)
  listarTreinamentos(@Req() req: any, @Param("collaboratorId") collaboratorId: string) {
    return this.service.listarTreinamentos(req.user, collaboratorId);
  }

  @Post("employees/:collaboratorId/treinamentos")
  @Permissions(PEOPLE_PERMISSIONS.treinamento.gerenciar)
  registrar(
    @Req() req: any,
    @Param("collaboratorId") collaboratorId: string,
    @Body() dto: RegistrarTreinamentoDto,
  ) {
    return this.service.registrarTreinamento(req.user, collaboratorId, dto);
  }

  @Put("treinamentos/participacoes/:id")
  @Permissions(PEOPLE_PERMISSIONS.treinamento.gerenciar)
  atualizarParticipacao(
    @Req() req: any, @Param("id") id: string, @Body() dto: AtualizarTreinamentoDto,
  ) {
    return this.service.atualizarTreinamento(req.user, id, dto);
  }

  /* ── Avaliações ───────────────────────────────────────────────────────── */

  @Get("employees/:collaboratorId/avaliacoes")
  @Permissions(PEOPLE_PERMISSIONS.avaliacao.ver)
  listarAvaliacoes(@Req() req: any, @Param("collaboratorId") collaboratorId: string) {
    return this.service.listarAvaliacoes(req.user, collaboratorId);
  }

  @Post("employees/:collaboratorId/avaliacoes")
  @Permissions(PEOPLE_PERMISSIONS.avaliacao.gerenciar)
  salvarAvaliacao(
    @Req() req: any,
    @Param("collaboratorId") collaboratorId: string,
    @Body() dto: SalvarAvaliacaoDto,
  ) {
    return this.service.salvarAvaliacao(req.user, collaboratorId, dto);
  }

  @Put("avaliacoes/:id/finalizar")
  @Permissions(PEOPLE_PERMISSIONS.avaliacao.gerenciar)
  finalizar(@Req() req: any, @Param("id") id: string) {
    return this.service.finalizarAvaliacao(req.user, id);
  }

  /* ── Metas ────────────────────────────────────────────────────────────── */

  @Post("avaliacoes/:reviewId/metas")
  @Permissions(PEOPLE_PERMISSIONS.avaliacao.gerenciar)
  criarMeta(@Req() req: any, @Param("reviewId") reviewId: string, @Body() dto: CriarMetaDto) {
    return this.service.criarMeta(req.user, reviewId, dto);
  }

  @Put("avaliacoes/metas/:id")
  @Permissions(PEOPLE_PERMISSIONS.avaliacao.gerenciar)
  atualizarMeta(@Req() req: any, @Param("id") id: string, @Body() dto: AtualizarMetaDto) {
    return this.service.atualizarMeta(req.user, id, dto);
  }

  @Delete("avaliacoes/metas/:id")
  @Permissions(PEOPLE_PERMISSIONS.avaliacao.gerenciar)
  excluirMeta(@Req() req: any, @Param("id") id: string) {
    return this.service.excluirMeta(req.user, id);
  }
}
