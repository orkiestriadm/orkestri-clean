import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsArray, IsString } from "class-validator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { Permissions } from "../../auth/permissions.decorator";
import {
  PositionService, CriarCargoDto, AtualizarCargoDto,
} from "../application/position.service";
import { PEOPLE_PERMISSIONS } from "../people.permissions";

class ImportarCargosDto {
  @IsArray() @IsString({ each: true }) titulos!: string[];
}

/** Catálogo de cargos do Orkiestri People. */
@Controller("v1/people/cargos")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class PositionController {
  constructor(private readonly service: PositionService) {}

  // Estáticas antes das paramétricas: `:id` engoliria "soltos".
  @Get("soltos")
  @Permissions(PEOPLE_PERMISSIONS.cargo.gerenciar)
  soltos(@Req() req: any) {
    return this.service.cargosSoltos(req.user);
  }

  @Post("importar")
  @Permissions(PEOPLE_PERMISSIONS.cargo.gerenciar)
  importar(@Req() req: any, @Body() dto: ImportarCargosDto) {
    return this.service.importarCargosSoltos(req.user, dto.titulos);
  }

  @Get()
  @Permissions(PEOPLE_PERMISSIONS.cargo.ver)
  listar(@Req() req: any, @Query("incluirInativos") incluirInativos?: string) {
    return this.service.listar(req.user, incluirInativos === "true");
  }

  @Post()
  @Permissions(PEOPLE_PERMISSIONS.cargo.gerenciar)
  criar(@Req() req: any, @Body() dto: CriarCargoDto) {
    return this.service.criar(req.user, dto);
  }

  @Put(":id")
  @Permissions(PEOPLE_PERMISSIONS.cargo.gerenciar)
  atualizar(@Req() req: any, @Param("id") id: string, @Body() dto: AtualizarCargoDto) {
    return this.service.atualizar(req.user, id, dto);
  }

  @Delete(":id")
  @Permissions(PEOPLE_PERMISSIONS.cargo.gerenciar)
  excluir(@Req() req: any, @Param("id") id: string) {
    return this.service.excluir(req.user, id);
  }
}
