import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { Permissions } from "../../auth/permissions.decorator";
import { ESTRATEGICO_PERMISSIONS as P } from "../estrategico.permissions";
import { AtividadeService } from "../application/atividade.service";
import { ipDe } from "../application/contexto";
import {
  CriarEventoDto, AtualizarEventoDto, CriarTarefaDto, AtualizarTarefaDto, ComentarDto, DependenciaDto,
} from "../application/dto/estrategico.dto";

/**
 * Timeline, tarefas, comentários e dependências — `/api/v1/estrategico/*`.
 * O decorator exige leitura; quem pode escrever é decidido no serviço, caso a caso.
 */
@Controller("v1/estrategico")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class AtividadeController {
  constructor(private readonly service: AtividadeService) {}

  @Get("minhas")
  @Permissions(P.caso.ver)
  minhas(@Req() req: any) {
    return this.service.minhas(req.user);
  }

  /* Timeline */
  @Get("casos/:id/eventos")
  @Permissions(P.caso.ver)
  eventos(@Req() req: any, @Param("id") id: string) {
    return this.service.eventos(req.user, id);
  }

  @Post("casos/:id/eventos")
  @Permissions(P.caso.ver)
  criarEvento(@Req() req: any, @Param("id") id: string, @Body() dto: CriarEventoDto) {
    return this.service.criarEvento(req.user, id, dto, ipDe(req));
  }

  @Put("eventos/:id")
  @Permissions(P.caso.ver)
  atualizarEvento(@Req() req: any, @Param("id") id: string, @Body() dto: AtualizarEventoDto) {
    return this.service.atualizarEvento(req.user, id, dto, ipDe(req));
  }

  @Delete("eventos/:id")
  @Permissions(P.caso.ver)
  excluirEvento(@Req() req: any, @Param("id") id: string) {
    return this.service.excluirEvento(req.user, id, ipDe(req));
  }

  /* Tarefas */
  @Get("casos/:id/tarefas")
  @Permissions(P.caso.ver)
  tarefas(@Req() req: any, @Param("id") id: string) {
    return this.service.tarefas(req.user, id);
  }

  @Post("casos/:id/tarefas")
  @Permissions(P.caso.ver)
  criarTarefa(@Req() req: any, @Param("id") id: string, @Body() dto: CriarTarefaDto) {
    return this.service.criarTarefa(req.user, id, dto, {}, ipDe(req));
  }

  @Put("tarefas/:id")
  @Permissions(P.caso.ver)
  atualizarTarefa(@Req() req: any, @Param("id") id: string, @Body() dto: AtualizarTarefaDto) {
    return this.service.atualizarTarefa(req.user, id, dto, ipDe(req));
  }

  @Delete("tarefas/:id")
  @Permissions(P.caso.ver)
  excluirTarefa(@Req() req: any, @Param("id") id: string) {
    return this.service.excluirTarefa(req.user, id, ipDe(req));
  }

  /* Comentários */
  @Get("casos/:id/comentarios")
  @Permissions(P.caso.ver)
  comentarios(@Req() req: any, @Param("id") id: string) {
    return this.service.comentarios(req.user, id);
  }

  @Post("casos/:id/comentarios")
  @Permissions(P.caso.ver)
  comentar(@Req() req: any, @Param("id") id: string, @Body() dto: ComentarDto) {
    return this.service.comentar(req.user, id, dto, ipDe(req));
  }

  @Delete("comentarios/:id")
  @Permissions(P.caso.ver)
  excluirComentario(@Req() req: any, @Param("id") id: string) {
    return this.service.excluirComentario(req.user, id);
  }

  /* Dependências */
  @Get("casos/:id/dependencias")
  @Permissions(P.caso.ver)
  dependencias(@Req() req: any, @Param("id") id: string) {
    return this.service.dependencias(req.user, id);
  }

  @Post("casos/:id/dependencias")
  @Permissions(P.caso.ver)
  criarDependencia(@Req() req: any, @Param("id") id: string, @Body() dto: DependenciaDto) {
    return this.service.criarDependencia(req.user, id, dto, ipDe(req));
  }

  @Put("dependencias/:id")
  @Permissions(P.caso.ver)
  atualizarDependencia(@Req() req: any, @Param("id") id: string, @Body() dto: DependenciaDto) {
    return this.service.atualizarDependencia(req.user, id, dto, ipDe(req));
  }

  @Delete("dependencias/:id")
  @Permissions(P.caso.ver)
  excluirDependencia(@Req() req: any, @Param("id") id: string) {
    return this.service.excluirDependencia(req.user, id, ipDe(req));
  }
}
