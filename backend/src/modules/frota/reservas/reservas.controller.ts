import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req, HttpCode } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ReservasService } from "./reservas.service";
import { Permissions } from "../../auth/permissions.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";

@Controller("frota/reservas")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class ReservasController {
  constructor(private readonly reservasService: ReservasService) {}

  @Get()
  @Permissions("frota:ver")
  async findAll(@Req() req: any, @Query() query: any) {
    return this.reservasService.findAll(req.user.organizationId, query);
  }

  @Get(":id")
  @Permissions("frota:ver")
  async findOne(@Param("id") id: string, @Req() req: any) {
    return this.reservasService.findOne(id, req.user.organizationId);
  }

  @Post()
  @Permissions("frota:criar")
  async create(@Body() body: any, @Req() req: any) {
    return this.reservasService.create(body, req.user.id, req.user.organizationId, req.ip);
  }

  @Put(":id")
  @Permissions("frota:editar")
  async update(@Param("id") id: string, @Body() body: any, @Req() req: any) {
    return this.reservasService.update(id, body, req.user.id, req.user.organizationId, req.ip);
  }

  @Delete(":id")
  @Permissions("frota:excluir")
  @HttpCode(204)
  async cancel(@Param("id") id: string, @Req() req: any) {
    await this.reservasService.cancel(id, req.user.id, req.user.organizationId, req.ip);
  }
}
