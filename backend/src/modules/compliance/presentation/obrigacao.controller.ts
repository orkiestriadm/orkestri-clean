import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Req, Res, UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Response } from "express";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { Permissions } from "../../auth/permissions.decorator";
import { COMPLIANCE_PERMISSIONS } from "../compliance.permissions";
import { ObrigacaoService } from "../application/obrigacao.service";
import { RelatorioService } from "../application/relatorio.service";
import { FluxoService } from "../application/fluxo.service";
import {
  CriarObrigacaoDto, AtualizarObrigacaoDto, RenovarObrigacaoDto,
  ProtocolarDto, MudarStatusDto, ComentarDto, ListarObrigacoesQuery,
} from "../application/dto/obrigacao.dto";
import { DecidirAprovacaoDto } from "../application/dto/configuracao.dto";

/**
 * API de obrigações.
 *
 * Rota versionada: `/api/v1/compliance/obrigacoes` (o prefixo `api` vem do
 * main.ts). Controller fino — recebe, delega, devolve.
 */
@Controller("v1/compliance/obrigacoes")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class ObrigacaoController {
  constructor(
    private readonly service: ObrigacaoService,
    private readonly relatorios: RelatorioService,
    private readonly fluxo: FluxoService,
  ) {}

  private ip(req: any): string | undefined {
    return req.ip ?? req.headers?.["x-forwarded-for"] ?? undefined;
  }

  @Get()
  @Permissions(COMPLIANCE_PERMISSIONS.obrigacao.ver)
  listar(@Req() req: any, @Query() query: ListarObrigacoesQuery) {
    return this.service.listar(req.user, query);
  }

  // Rotas estáticas ANTES da paramétrica: o Nest casa por ordem de declaração,
  // e com `:id` na frente "filtros" viraria um id.
  @Get("filtros")
  @Permissions(COMPLIANCE_PERMISSIONS.obrigacao.ver)
  filtros(@Req() req: any) {
    return this.service.filtros(req.user);
  }

  @Get("exportar")
  @Permissions(COMPLIANCE_PERMISSIONS.obrigacao.exportar)
  async exportar(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
    @Query("formato") formato = "excel",
    @Query() query: ListarObrigacoesQuery,
  ) {
    const arquivo = await this.relatorios.exportar(req.user, formato, query);

    res.setHeader("Content-Type", arquivo.mime);
    res.setHeader("Content-Disposition", `attachment; filename="${arquivo.nome}"`);
    // Cabeçalho próprio para a tela avisar que o arquivo não veio inteiro —
    // um download truncado que parece completo é pior que um erro.
    if (arquivo.truncado) res.setHeader("X-Export-Truncado", "true");
    return res.send(arquivo.conteudo);
  }

  @Get("aprovacoes/pendentes")
  @Permissions(COMPLIANCE_PERMISSIONS.aprovacao.aprovar)
  aprovacoesPendentes(@Req() req: any) {
    return this.fluxo.pendentes(req.user);
  }

  @Get(":id")
  @Permissions(COMPLIANCE_PERMISSIONS.obrigacao.ver)
  obter(@Req() req: any, @Param("id") id: string) {
    return this.service.obter(req.user, id);
  }

  @Get(":id/historico")
  @Permissions(COMPLIANCE_PERMISSIONS.obrigacao.ver)
  historico(@Req() req: any, @Param("id") id: string) {
    return this.service.historicoDe(req.user, id);
  }

  @Get(":id/versoes")
  @Permissions(COMPLIANCE_PERMISSIONS.obrigacao.ver)
  versoes(@Req() req: any, @Param("id") id: string) {
    return this.service.versoesDe(req.user, id);
  }

  @Get(":id/comentarios")
  @Permissions(COMPLIANCE_PERMISSIONS.obrigacao.ver)
  comentarios(@Req() req: any, @Param("id") id: string) {
    return this.service.comentariosDe(req.user, id);
  }

  @Get(":id/aprovacao")
  @Permissions(COMPLIANCE_PERMISSIONS.obrigacao.ver)
  aprovacao(@Req() req: any, @Param("id") id: string) {
    return this.fluxo.situacao(req.user, id);
  }

  @Post()
  @Permissions(COMPLIANCE_PERMISSIONS.obrigacao.criar)
  criar(@Req() req: any, @Body() dto: CriarObrigacaoDto) {
    return this.service.criar(req.user, dto, this.ip(req));
  }

  @Put(":id")
  @Permissions(COMPLIANCE_PERMISSIONS.obrigacao.editar)
  atualizar(@Req() req: any, @Param("id") id: string, @Body() dto: AtualizarObrigacaoDto) {
    return this.service.atualizar(req.user, id, dto, this.ip(req));
  }

  @Post(":id/renovar")
  @Permissions(COMPLIANCE_PERMISSIONS.obrigacao.renovar)
  renovar(@Req() req: any, @Param("id") id: string, @Body() dto: RenovarObrigacaoDto) {
    return this.service.renovar(req.user, id, dto, this.ip(req));
  }

  @Post(":id/protocolo")
  @Permissions(COMPLIANCE_PERMISSIONS.obrigacao.renovar)
  protocolar(@Req() req: any, @Param("id") id: string, @Body() dto: ProtocolarDto) {
    return this.service.protocolar(req.user, id, dto, this.ip(req));
  }

  @Patch(":id/status")
  @Permissions(COMPLIANCE_PERMISSIONS.obrigacao.mudarStatus)
  mudarStatus(@Req() req: any, @Param("id") id: string, @Body() dto: MudarStatusDto) {
    return this.service.mudarStatus(req.user, id, dto, this.ip(req));
  }

  @Post(":id/favorito")
  @Permissions(COMPLIANCE_PERMISSIONS.obrigacao.ver)
  favoritar(@Req() req: any, @Param("id") id: string) {
    return this.service.alternarFavorito(req.user, id);
  }

  @Post(":id/comentarios")
  @Permissions(COMPLIANCE_PERMISSIONS.obrigacao.ver)
  comentar(@Req() req: any, @Param("id") id: string, @Body() dto: ComentarDto) {
    return this.service.comentar(req.user, id, dto.conteudo, this.ip(req));
  }

  @Post(":id/fluxo/iniciar")
  @Permissions(COMPLIANCE_PERMISSIONS.obrigacao.editar)
  iniciarFluxo(@Req() req: any, @Param("id") id: string) {
    return this.fluxo.iniciar(req.user, id);
  }

  @Post(":id/fluxo/decisao")
  @Permissions(COMPLIANCE_PERMISSIONS.aprovacao.aprovar)
  decidir(@Req() req: any, @Param("id") id: string, @Body() dto: DecidirAprovacaoDto) {
    return this.fluxo.decidir(req.user, id, dto, this.ip(req));
  }

  @Delete(":id")
  @Permissions(COMPLIANCE_PERMISSIONS.obrigacao.excluir)
  excluir(@Req() req: any, @Param("id") id: string) {
    return this.service.excluir(req.user, id, this.ip(req));
  }
}
