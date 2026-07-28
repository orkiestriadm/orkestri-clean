import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Req, UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { Permissions } from "../../auth/permissions.decorator";
import { EmployeeService } from "../application/employee.service";
import { PEOPLE_PERMISSIONS } from "../people.permissions";
import {
  CriarColaboradorDto, AtualizarColaboradorDto, MudarStatusDto, ListarColaboradoresQuery,
} from "../application/dto/employee.dto";

/**
 * API de colaboradores do Orkiestri People.
 *
 * Rota versionada conforme PEOPLE_API.md §3 (`/api/v1/{module}/{resource}`).
 * O prefixo global `api` vem do main.ts, então o caminho final é
 * `/api/v1/people/employees`.
 *
 * O módulo legado `/api/collaborators` continua no ar durante a migração —
 * será aposentado quando o frontend do People assumir (Fase 3).
 *
 * Controller fino: recebe, delega, devolve. Sem regra de negócio (BACKEND.md §14).
 */
@Controller("v1/people/employees")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class EmployeeController {
  constructor(private readonly service: EmployeeService) {}

  @Get()
  @Permissions(PEOPLE_PERMISSIONS.colaborador.ver)
  listar(@Req() req: any, @Query() query: ListarColaboradoresQuery) {
    return this.service.listar(req.user, query);
  }

  @Get(":id")
  @Permissions(PEOPLE_PERMISSIONS.colaborador.ver)
  obter(@Req() req: any, @Param("id") id: string) {
    return this.service.obter(req.user, id);
  }

  @Get(":id/historico")
  @Permissions(PEOPLE_PERMISSIONS.colaborador.ver)
  historico(@Req() req: any, @Param("id") id: string) {
    return this.service.historicoDe(req.user, id);
  }

  @Post()
  @Permissions(PEOPLE_PERMISSIONS.colaborador.criar)
  criar(@Req() req: any, @Body() dto: CriarColaboradorDto) {
    return this.service.criar(req.user, dto);
  }

  @Put(":id")
  @Permissions(PEOPLE_PERMISSIONS.colaborador.editar)
  atualizar(@Req() req: any, @Param("id") id: string, @Body() dto: AtualizarColaboradorDto) {
    return this.service.atualizar(req.user, id, dto);
  }

  @Patch(":id/status")
  @Permissions(PEOPLE_PERMISSIONS.colaborador.mudarSituacao)
  mudarStatus(@Req() req: any, @Param("id") id: string, @Body() dto: MudarStatusDto) {
    return this.service.mudarStatus(req.user, id, dto);
  }

  @Delete(":id")
  @Permissions(PEOPLE_PERMISSIONS.colaborador.excluir)
  excluir(@Req() req: any, @Param("id") id: string) {
    return this.service.excluir(req.user, id);
  }
}
