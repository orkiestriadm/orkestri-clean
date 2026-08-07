import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { Permissions } from "../../auth/permissions.decorator";
import { COMPLIANCE_PERMISSIONS } from "../compliance.permissions";
import { CatalogoService } from "../application/catalogo.service";
import { NotificacaoService } from "../application/notificacao.service";
import {
  SalvarCategoriaDto, SalvarOrgaoDto, SalvarTagDto, SalvarRegraDto,
  SalvarTemplateDto, SalvarEscalonamentoDto, SalvarFluxoDto,
} from "../application/dto/configuracao.dto";

/**
 * API de configuração do módulo: categorias e campos, órgãos, tags, réguas de
 * alerta, templates, escalonamento e fluxos.
 */
@Controller("v1/compliance")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class CatalogoController {
  constructor(
    private readonly service: CatalogoService,
    private readonly notificacoes: NotificacaoService,
  ) {}

  /* ── Categorias ────────────────────────────────────────────────────────── */

  @Get("categorias")
  @Permissions(COMPLIANCE_PERMISSIONS.categoria.ver)
  listarCategorias(@Req() req: any, @Query("todas") todas?: string) {
    return this.service.listarCategorias(req.user, todas === "true");
  }

  @Get("categorias/:id")
  @Permissions(COMPLIANCE_PERMISSIONS.categoria.ver)
  obterCategoria(@Req() req: any, @Param("id") id: string) {
    return this.service.obterCategoria(req.user, id);
  }

  @Post("categorias")
  @Permissions(COMPLIANCE_PERMISSIONS.categoria.gerenciar)
  criarCategoria(@Req() req: any, @Body() dto: SalvarCategoriaDto) {
    return this.service.criarCategoria(req.user, dto);
  }

  @Put("categorias/:id")
  @Permissions(COMPLIANCE_PERMISSIONS.categoria.gerenciar)
  atualizarCategoria(@Req() req: any, @Param("id") id: string, @Body() dto: SalvarCategoriaDto) {
    return this.service.atualizarCategoria(req.user, id, dto);
  }

  @Delete("categorias/:id")
  @Permissions(COMPLIANCE_PERMISSIONS.categoria.gerenciar)
  excluirCategoria(@Req() req: any, @Param("id") id: string) {
    return this.service.excluirCategoria(req.user, id);
  }

  /* ── Órgãos ────────────────────────────────────────────────────────────── */

  @Get("orgaos")
  @Permissions(COMPLIANCE_PERMISSIONS.obrigacao.ver)
  listarOrgaos(@Req() req: any) {
    return this.service.listarOrgaos(req.user);
  }

  @Post("orgaos")
  @Permissions(COMPLIANCE_PERMISSIONS.admin.gerenciar)
  criarOrgao(@Req() req: any, @Body() dto: SalvarOrgaoDto) {
    return this.service.criarOrgao(req.user, dto);
  }

  @Put("orgaos/:id")
  @Permissions(COMPLIANCE_PERMISSIONS.admin.gerenciar)
  atualizarOrgao(@Req() req: any, @Param("id") id: string, @Body() dto: SalvarOrgaoDto) {
    return this.service.atualizarOrgao(req.user, id, dto);
  }

  @Delete("orgaos/:id")
  @Permissions(COMPLIANCE_PERMISSIONS.admin.gerenciar)
  excluirOrgao(@Req() req: any, @Param("id") id: string) {
    return this.service.excluirOrgao(req.user, id);
  }

  /* ── Tags ──────────────────────────────────────────────────────────────── */

  @Get("tags")
  @Permissions(COMPLIANCE_PERMISSIONS.obrigacao.ver)
  listarTags(@Req() req: any) {
    return this.service.listarTags(req.user);
  }

  @Post("tags")
  @Permissions(COMPLIANCE_PERMISSIONS.admin.gerenciar)
  criarTag(@Req() req: any, @Body() dto: SalvarTagDto) {
    return this.service.criarTag(req.user, dto);
  }

  @Put("tags/:id")
  @Permissions(COMPLIANCE_PERMISSIONS.admin.gerenciar)
  atualizarTag(@Req() req: any, @Param("id") id: string, @Body() dto: SalvarTagDto) {
    return this.service.atualizarTag(req.user, id, dto);
  }

  @Delete("tags/:id")
  @Permissions(COMPLIANCE_PERMISSIONS.admin.gerenciar)
  excluirTag(@Req() req: any, @Param("id") id: string) {
    return this.service.excluirTag(req.user, id);
  }

  /* ── Réguas de alerta ──────────────────────────────────────────────────── */

  @Get("alertas/regras")
  @Permissions(COMPLIANCE_PERMISSIONS.notificacao.ver)
  listarRegras(@Req() req: any) {
    return this.service.listarRegras(req.user);
  }

  @Post("alertas/regras")
  @Permissions(COMPLIANCE_PERMISSIONS.notificacao.configurar)
  criarRegra(@Req() req: any, @Body() dto: SalvarRegraDto) {
    return this.service.criarRegra(req.user, dto);
  }

  @Put("alertas/regras/:id")
  @Permissions(COMPLIANCE_PERMISSIONS.notificacao.configurar)
  atualizarRegra(@Req() req: any, @Param("id") id: string, @Body() dto: SalvarRegraDto) {
    return this.service.atualizarRegra(req.user, id, dto);
  }

  @Delete("alertas/regras/:id")
  @Permissions(COMPLIANCE_PERMISSIONS.notificacao.configurar)
  excluirRegra(@Req() req: any, @Param("id") id: string) {
    return this.service.excluirRegra(req.user, id);
  }

  /**
   * O que a régua dispararia hoje, sem enviar nada.
   *
   * Configurar régua às cegas é o defeito que a planilha tinha: só se descobre
   * que está errada quando o aviso não chega.
   */
  @Get("alertas/previa")
  @Permissions(COMPLIANCE_PERMISSIONS.notificacao.ver)
  previa(@Req() req: any) {
    return this.notificacoes.previa(req.user.organizationId);
  }

  @Get("alertas/envios")
  @Permissions(COMPLIANCE_PERMISSIONS.notificacao.ver)
  envios(@Req() req: any, @Query("obrigacaoId") obrigacaoId?: string) {
    return this.notificacoes.historicoDeEnvios(req.user.organizationId, obrigacaoId);
  }

  /** Varredura sob demanda. Exige configurar, não só ver: dispara e-mail real. */
  @Post("alertas/varrer")
  @Permissions(COMPLIANCE_PERMISSIONS.notificacao.configurar)
  varrer() {
    return this.notificacoes.executarVarredura();
  }

  /* ── Templates ─────────────────────────────────────────────────────────── */

  @Get("alertas/templates")
  @Permissions(COMPLIANCE_PERMISSIONS.notificacao.ver)
  listarTemplates(@Req() req: any) {
    return this.service.listarTemplates(req.user);
  }

  @Post("alertas/templates")
  @Permissions(COMPLIANCE_PERMISSIONS.notificacao.configurar)
  criarTemplate(@Req() req: any, @Body() dto: SalvarTemplateDto) {
    return this.service.criarTemplate(req.user, dto);
  }

  @Put("alertas/templates/:id")
  @Permissions(COMPLIANCE_PERMISSIONS.notificacao.configurar)
  atualizarTemplate(@Req() req: any, @Param("id") id: string, @Body() dto: SalvarTemplateDto) {
    return this.service.atualizarTemplate(req.user, id, dto);
  }

  @Delete("alertas/templates/:id")
  @Permissions(COMPLIANCE_PERMISSIONS.notificacao.configurar)
  excluirTemplate(@Req() req: any, @Param("id") id: string) {
    return this.service.excluirTemplate(req.user, id);
  }

  /* ── Escalonamento ─────────────────────────────────────────────────────── */

  @Get("alertas/escalonamentos")
  @Permissions(COMPLIANCE_PERMISSIONS.notificacao.ver)
  listarEscalonamentos(@Req() req: any) {
    return this.service.listarEscalonamentos(req.user);
  }

  @Post("alertas/escalonamentos")
  @Permissions(COMPLIANCE_PERMISSIONS.notificacao.configurar)
  criarEscalonamento(@Req() req: any, @Body() dto: SalvarEscalonamentoDto) {
    return this.service.criarEscalonamento(req.user, dto);
  }

  @Put("alertas/escalonamentos/:id")
  @Permissions(COMPLIANCE_PERMISSIONS.notificacao.configurar)
  atualizarEscalonamento(@Req() req: any, @Param("id") id: string, @Body() dto: SalvarEscalonamentoDto) {
    return this.service.atualizarEscalonamento(req.user, id, dto);
  }

  @Delete("alertas/escalonamentos/:id")
  @Permissions(COMPLIANCE_PERMISSIONS.notificacao.configurar)
  excluirEscalonamento(@Req() req: any, @Param("id") id: string) {
    return this.service.excluirEscalonamento(req.user, id);
  }

  /* ── Fluxos ────────────────────────────────────────────────────────────── */

  @Get("fluxos")
  @Permissions(COMPLIANCE_PERMISSIONS.admin.gerenciar)
  listarFluxos(@Req() req: any) {
    return this.service.listarFluxos(req.user);
  }

  @Post("fluxos")
  @Permissions(COMPLIANCE_PERMISSIONS.admin.gerenciar)
  criarFluxo(@Req() req: any, @Body() dto: SalvarFluxoDto) {
    return this.service.criarFluxo(req.user, dto);
  }

  @Put("fluxos/:id")
  @Permissions(COMPLIANCE_PERMISSIONS.admin.gerenciar)
  atualizarFluxo(@Req() req: any, @Param("id") id: string, @Body() dto: SalvarFluxoDto) {
    return this.service.atualizarFluxo(req.user, id, dto);
  }

  @Delete("fluxos/:id")
  @Permissions(COMPLIANCE_PERMISSIONS.admin.gerenciar)
  excluirFluxo(@Req() req: any, @Param("id") id: string) {
    return this.service.excluirFluxo(req.user, id);
  }
}
