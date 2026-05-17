import { Module, Controller, Get, Post, Delete, Body, Param, UseGuards, Req, NotFoundException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsString } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";

class CreateCommentDto { @IsString() conteudo: string; }

@Controller("projects/:projectId/tasks/:taskId/comments")
class CommentsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @UseGuards(AuthGuard("jwt"))
  async findAll(@Param("taskId") taskId: string) {
    return this.prisma.taskComment.findMany({
      where: { taskId },
      include: { user: { select: { id: true, nome: true } } },
      orderBy: { criadoEm: "asc" },
    });
  }

  @Post()
  @UseGuards(AuthGuard("jwt"))
  async create(@Param("taskId") taskId: string, @Body() dto: CreateCommentDto, @Req() req: any) {
    const comment = await this.prisma.taskComment.create({
      data: { taskId, userId: req.user.id, conteudo: dto.conteudo },
      include: { user: { select: { id: true, nome: true } } },
    });

    // Notifica membros mencionados com @
    const mentions = dto.conteudo.match(/@(\w+)/g) || [];
    if (mentions.length > 0) {
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        include: { project: { include: { members: { include: { user: true } } } } },
      });
      for (const m of mentions) {
        const name = m.slice(1).toLowerCase();
        const member = task?.project?.members?.find((pm: any) =>
          pm.user.nome.toLowerCase().startsWith(name)
        );
        if (member && member.userId !== req.user.id) {
          await this.prisma.notification.create({
            data: {
              userId: member.userId,
              tipo: "mencao",
              titulo: `${req.user.nome} mencionou voce em uma task`,
              mensagem: dto.conteudo.slice(0, 80),
              referenciaTipo: "task",
              referenciaId: taskId,
            },
          });
        }
      }
    }
    return comment;
  }

  @Delete(":commentId")
  @UseGuards(AuthGuard("jwt"))
  async remove(@Param("commentId") commentId: string, @Req() req: any) {
    const c = await this.prisma.taskComment.findUnique({ where: { id: commentId } });
    if (!c) throw new NotFoundException();
    if (c.userId !== req.user.id && !req.user.isMaster) throw new NotFoundException("Sem permissao");
    await this.prisma.taskComment.delete({ where: { id: commentId } });
    return { message: "Comentario removido" };
  }
}

@Module({ controllers: [CommentsController] })
export class CommentsModule {}