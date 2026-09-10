import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { Permissions } from "../../auth/permissions.decorator";
import { ESTRATEGICO_PERMISSIONS as P } from "../estrategico.permissions";
import { CasoService } from "../application/caso.service";
import { ipDe } from "../application/contexto";
import { CriarCasoDto, AtualizarCasoDto, FarolManualDto, ListarCasosQuery } from "../application/dto/estrategico.dto";

/**
 * Assuntos estratégicos — `/api/v1/estrategico/casos`.
 *
 * Editar declara só `caso:ver` no decorator: a regra real é linha a linha
 * (`editar` OU `editar_proprios` sendo responsável) e mora no serviço.
 */
@Controller("v1/estrategico/casos")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class CasoController {
  constructor(private readonly service: CasoService) {}

  @Get()
  @Permissions(P.caso.ver)
  listar(@Req() req: any, @Query() q: ListarCasosQuery) {
    return this.service.listar(req.user, q);
  }

  @Get("filtros")
  @Permissions(P.caso.ver)
  filtros(@Req() req: any) {
    return this.service.filtros(req.user);
  }

  @Get(":id")
  @Permissions(P.caso.ver)
  obter(@Req() req: any, @Param("id") id: string) {
    return this.service.obter(req.user, id);
  }

  @Get(":id/historico")
  @Permissions(P.caso.ver)
  historico(@Req() req: any, @Param("id") id: string) {
    return this.service.historico(req.user, id);
  }

  @Get(":id/valores")
  @Permissions(P.financeiro.ver)
  valores(@Req() req: any, @Param("id") id: string) {
    return this.service.valores(req.user, id);
  }

  @Post()
  @Permissions(P.caso.criar)
  criar(@Req() req: any, @Body() dto: CriarCasoDto) {
    return this.service.criar(req.user, dto, ipDe(req));
  }

  @Put(":id")
  @Permissions(P.caso.ver)
  atualizar(@Req() req: any, @Param("id") id: string, @Body() dto: AtualizarCasoDto) {
    return this.service.atualizar(req.user, id, dto, ipDe(req));
  }

  @Patch(":id/farol")
  @Permissions(P.caso.farol)
  farol(@Req() req: any, @Param("id") id: string, @Body() dto: FarolManualDto) {
    return this.service.definirFarol(req.user, id, dto, ipDe(req));
  }

  @Delete(":id")
  @Permissions(P.caso.excluir)
  excluir(@Req() req: any, @Param("id") id: string) {
    return this.service.excluir(req.user, id, ipDe(req));
  }
}
