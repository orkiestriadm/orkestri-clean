import { Controller, Get, Post, Patch, Delete, Body, Param, Req, Res, StreamableFile, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Response } from "express";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { Permissions } from "../../auth/permissions.decorator";
import { ESTRATEGICO_PERMISSIONS as P } from "../estrategico.permissions";
import { ReuniaoService } from "../application/reuniao.service";
import { ipDe } from "../application/contexto";
import {
  CriarReuniaoDto, AnotarPautaDto, DecisaoDto, TarefaReuniaoDto, StatusReuniaoDto,
} from "../application/dto/estrategico.dto";

@Controller("v1/estrategico/reunioes")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class ReuniaoController {
  constructor(private readonly service: ReuniaoService) {}

  @Get()
  @Permissions(P.reuniao.ver)
  listar(@Req() req: any) {
    return this.service.listar(req.user);
  }

  @Get(":id")
  @Permissions(P.reuniao.ver)
  obter(@Req() req: any, @Param("id") id: string) {
    return this.service.obter(req.user, id);
  }

  @Get(":id/ata.pdf")
  @Permissions(P.reuniao.ver)
  async ata(@Req() req: any, @Param("id") id: string, @Res({ passthrough: true }) res: Response) {
    const { conteudo, nome } = await this.service.ataPdf(req.user, id);
    res.setHeader("Cache-Control", "private, no-store");
    // StreamableFile: devolver `res.send(...)` com passthrough fazia o Nest
    // tentar serializar o Response ("circular structure") depois do envio.
    return new StreamableFile(conteudo, {
      type: "application/pdf",
      disposition: `attachment; filename="${nome}"`,
      length: conteudo.length,
    });
  }

  @Post()
  @Permissions(P.reuniao.conduzir)
  criar(@Req() req: any, @Body() dto: CriarReuniaoDto) {
    return this.service.criar(req.user, dto, ipDe(req));
  }

  @Post(":id/pauta")
  @Permissions(P.reuniao.conduzir)
  regerarPauta(@Req() req: any, @Param("id") id: string) {
    return this.service.regerarPauta(req.user, id);
  }

  @Patch(":id/anotacoes")
  @Permissions(P.reuniao.conduzir)
  anotar(@Req() req: any, @Param("id") id: string, @Body() dto: AnotarPautaDto) {
    return this.service.anotar(req.user, id, dto);
  }

  @Post(":id/decisoes")
  @Permissions(P.reuniao.conduzir)
  decidir(@Req() req: any, @Param("id") id: string, @Body() dto: DecisaoDto) {
    return this.service.decidir(req.user, id, dto, ipDe(req));
  }

  @Post(":id/tarefas")
  @Permissions(P.reuniao.conduzir)
  tarefa(@Req() req: any, @Param("id") id: string, @Body() dto: TarefaReuniaoDto) {
    return this.service.criarTarefa(req.user, id, dto, ipDe(req));
  }

  @Patch(":id/status")
  @Permissions(P.reuniao.conduzir)
  status(@Req() req: any, @Param("id") id: string, @Body() dto: StatusReuniaoDto) {
    return this.service.mudarStatus(req.user, id, dto.status, ipDe(req));
  }

  @Delete(":id")
  @Permissions(P.reuniao.conduzir)
  excluir(@Req() req: any, @Param("id") id: string) {
    return this.service.excluir(req.user, id, ipDe(req));
  }
}
