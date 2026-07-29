import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { Permissions } from "../../auth/permissions.decorator";
import { SalaryService, RegistrarSalarioDto, FaixaDto } from "../application/salary.service";
import { FeedbackService, CriarFeedbackDto } from "../application/feedback.service";
import { PEOPLE_PERMISSIONS } from "../people.permissions";

/**
 * Remuneração e feedback.
 *
 * Remuneração exige `people.salario:*`, que não entra em nenhum perfil padrão:
 * ver salário é decisão explícita, não consequência de ser gestor.
 */
@Controller("v1/people")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class SalaryController {
  constructor(
    private readonly service: SalaryService,
    private readonly feedback: FeedbackService,
  ) {}

  /* ── Remuneração ──────────────────────────────────────────────────────── */

  // Estática antes da paramétrica.
  @Get("salarios/painel")
  @Permissions(PEOPLE_PERMISSIONS.salario.ver, PEOPLE_PERMISSIONS.relatorio.ver)
  painel(@Req() req: any) {
    return this.service.painel(req.user);
  }

  @Get("employees/:collaboratorId/salario")
  @Permissions(PEOPLE_PERMISSIONS.salario.ver)
  situacao(@Req() req: any, @Param("collaboratorId") collaboratorId: string) {
    return this.service.situacao(req.user, collaboratorId);
  }

  @Post("employees/:collaboratorId/salario")
  @Permissions(PEOPLE_PERMISSIONS.salario.gerenciar)
  registrar(
    @Req() req: any,
    @Param("collaboratorId") collaboratorId: string,
    @Body() dto: RegistrarSalarioDto,
  ) {
    return this.service.registrar(req.user, collaboratorId, dto);
  }

  @Delete("salarios/:id")
  @Permissions(PEOPLE_PERMISSIONS.salario.gerenciar)
  excluirSalario(@Req() req: any, @Param("id") id: string) {
    return this.service.excluir(req.user, id);
  }

  /**
   * Faixa salarial do cargo.
   *
   * Sob `salario:gerenciar` e não `cargo:gerenciar`: quem organiza o catálogo
   * de cargos não decide quanto cada um vale.
   */
  @Put("cargos/:positionId/faixa")
  @Permissions(PEOPLE_PERMISSIONS.salario.gerenciar)
  definirFaixa(@Req() req: any, @Param("positionId") positionId: string, @Body() dto: FaixaDto) {
    return this.service.definirFaixa(req.user, positionId, dto);
  }

  /* ── Feedback ─────────────────────────────────────────────────────────── */

  @Get("employees/:collaboratorId/feedbacks")
  @Permissions(PEOPLE_PERMISSIONS.feedback.ver)
  listarFeedbacks(
    @Req() req: any,
    @Param("collaboratorId") collaboratorId: string,
  ) {
    // Só quem registra feedback enxerga a anotação privada. A checagem é aqui
    // e não no frontend para o dado privado nem sair no JSON.
    const perms: string[] = req.user?.permissions ?? [];
    const podeVerPrivado =
      !!req.user?.isMaster ||
      perms.includes("*") ||
      perms.includes(PEOPLE_PERMISSIONS.feedback.registrar);

    return this.feedback.listar(req.user, collaboratorId, podeVerPrivado);
  }

  @Post("employees/:collaboratorId/feedbacks")
  @Permissions(PEOPLE_PERMISSIONS.feedback.registrar)
  criarFeedback(
    @Req() req: any,
    @Param("collaboratorId") collaboratorId: string,
    @Body() dto: CriarFeedbackDto,
  ) {
    return this.feedback.criar(req.user, collaboratorId, dto);
  }

  @Delete("feedbacks/:id")
  @Permissions(PEOPLE_PERMISSIONS.feedback.registrar)
  excluirFeedback(@Req() req: any, @Param("id") id: string) {
    return this.feedback.excluir(req.user, id);
  }
}
