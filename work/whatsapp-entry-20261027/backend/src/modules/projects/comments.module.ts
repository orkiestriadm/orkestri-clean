import { Module, Controller, Get, Post, Delete, Body, Param, UseGuards, Req, NotFoundException, ForbiddenException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsString } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { organizacaoDe } from "../../common/escopo-organizacao";
import { TaskRegistrosController } from "./task-registros.controller";

class CreateCommentDto { @IsString() conteudo: string; }

@Controller("projects/:projectId/tasks/:taskId/comments")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class CommentsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Permissions("projetos:ver")
  async findAll(@Param("projectId") projectId: string, @Param("taskId") taskId: string, @Req() req: any) {
    await this.exigirTask(projectId, taskId, req);
    return this.prisma.taskComment.findMany({
      where: { taskId },
      include: { user: { select: { id: true, nome: true } } },
      orderBy: { criadoEm: "asc" },
    });
  }

  @Post()
  @Permissions("projetos:ver")
  async create(
    @Param("projectId") projectId: string, @Param("taskId") taskId: string,
    @Body() dto: CreateCommentDto, @Req() req: any,
  ) {
    const projeto = await this.exigirTask(projectId, taskId, req);
    const comment = await this.prisma.taskComment.create({
      data: { taskId, userId: req.user.id, conteudo: dto.conteudo },
      include: { user: { select: { id: true, nome: true } } },
    });

    // Notifica membros mencionados com @
    const mentions = dto.conteudo.match(/@(\w+)/g) || [];
    // O usuário do token não traz o nome (só id, e-mail e permissões): sem esta
    // busca o aviso saía "undefined mencionou voce em uma task".
    const autor = mentions.length
      ? (await this.prisma.user.findUnique({ where: { id: req.user.id }, select: { nome: true } }))?.nome ?? "Alguém"
      : "";
    for (const m of mentions) {
      const name = m.slice(1).toLowerCase();
      const member = projeto.members.find(pm => pm.user.nome.toLowerCase().startsWith(name));
      if (member && member.userId !== req.user.id) {
        await this.prisma.notification.create({
          data: {
            userId: member.userId,
            tipo: "mencao",
            titulo: `${autor} mencionou voce em uma task`,
            mensagem: dto.conteudo.slice(0, 80),
            referenciaTipo: "task",
            referenciaId: taskId,
          },
        });
      }
    }
    return comment;
  }

  @Delete(":commentId")
  @Permissions("projetos:ver")
  async remove(
    @Param("projectId") projectId: string, @Param("taskId") taskId: string,
    @Param("commentId") commentId: string, @Req() req: any,
  ) {
    await this.exigirTask(projectId, taskId, req);
    const c = await this.prisma.taskComment.findFirst({ where: { id: commentId, taskId } });
    if (!c) throw new NotFoundException("Comentario nao encontrado");
    if (c.userId !== req.user.id && !req.user.isMaster) throw new ForbiddenException("Sem permissao");
    await this.prisma.taskComment.delete({ where: { id: commentId } });
    return { message: "Comentario removido" };
  }

  /**
   * A task dentro do projeto da URL e da organização do token.
   *
   * Até 11/09/2026 estas rotas pediam só login e resolviam a task por id solto:
   * qualquer usuário de qualquer organização lia e comentava tarefa alheia.
   */
  private async exigirTask(projectId: string, taskId: string, req: any) {
    const projeto = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: organizacaoDe(req) },
      select: { id: true, members: { select: { userId: true, user: { select: { nome: true } } } } },
    });
    if (!projeto) throw new NotFoundException("Projeto nao encontrado");
    const task = await this.prisma.task.findFirst({ where: { id: taskId, projectId }, select: { id: true } });
    if (!task) throw new NotFoundException("Tarefa nao encontrada");
    return projeto;
  }
}

/** Colaboração dentro da tarefa: comentários (conversa) e Keep (o que foi feito). */
@Module({ controllers: [CommentsController, TaskRegistrosController] })
export class CommentsModule {}
