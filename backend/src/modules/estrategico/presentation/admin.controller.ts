import {
  Controller, Get, Post, Put, Body, Param, Req, UseGuards, UseInterceptors, UploadedFile,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { Permissions } from "../../auth/permissions.decorator";
import { ESTRATEGICO_PERMISSIONS as P } from "../estrategico.permissions";
import { AdminService } from "../application/admin.service";
import { ImportacaoService, TAMANHO_MAXIMO_PLANILHA } from "../application/importacao.service";
import { AutomacaoService } from "../application/automacao.service";
import { ipDe } from "../application/contexto";
import { CatalogoDto, ConfigDto } from "../application/dto/estrategico.dto";

@Controller("v1/estrategico/admin")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly importacao: ImportacaoService,
    private readonly automacao: AutomacaoService,
  ) {}

  @Get("catalogos")
  @Permissions(P.caso.ver)
  catalogos(@Req() req: any) {
    return this.admin.catalogos(req.user);
  }

  @Post("catalogos")
  @Permissions(P.admin.gerenciar)
  criarCatalogo(@Req() req: any, @Body() dto: CatalogoDto) {
    return this.admin.criarCatalogo(req.user, dto);
  }

  @Put("catalogos/:id")
  @Permissions(P.admin.gerenciar)
  atualizarCatalogo(@Req() req: any, @Param("id") id: string, @Body() dto: CatalogoDto) {
    return this.admin.atualizarCatalogo(req.user, id, dto);
  }

  @Get("config")
  @Permissions(P.caso.ver)
  config(@Req() req: any) {
    return this.admin.config(req.user);
  }

  @Put("config")
  @Permissions(P.admin.gerenciar)
  salvarConfig(@Req() req: any, @Body() dto: ConfigDto) {
    return this.admin.salvarConfig(req.user, dto);
  }

  @Get("perfis")
  @Permissions(P.admin.gerenciar)
  perfis() {
    return this.admin.perfis();
  }

  @Post("importacao/previa")
  @Permissions(P.admin.gerenciar)
  @UseInterceptors(FileInterceptor("arquivo", { storage: memoryStorage(), limits: { fileSize: TAMANHO_MAXIMO_PLANILHA } }))
  previa(@Req() req: any, @UploadedFile() arquivo: any) {
    return this.importacao.previa(req.user, arquivo);
  }

  @Post("importacao/confirmar")
  @Permissions(P.admin.gerenciar)
  @UseInterceptors(FileInterceptor("arquivo", { storage: memoryStorage(), limits: { fileSize: TAMANHO_MAXIMO_PLANILHA } }))
  confirmar(@Req() req: any, @UploadedFile() arquivo: any) {
    return this.importacao.confirmar(req.user, arquivo, ipDe(req));
  }

  /** Roda as automações agora, só para a organização de quem chama. */
  @Post("automacoes/executar")
  @Permissions(P.admin.gerenciar)
  executarAutomacoes(@Req() req: any) {
    return this.automacao.executar(req.user.organizationId);
  }
}
