import { Module, Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Req, NotFoundException, BadRequestException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsString, IsOptional, IsArray, IsDateString, IsNumber } from "class-validator";
import { Type } from "class-transformer";
import { PrismaService } from "../../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { WebhookService, WebhooksModule } from "../automacoes/webhooks.module";

class CreateProjectDto {
  @IsString() titulo: string;
  @IsOptional() @IsString() descricao?: string;
  @IsOptional() @IsString() cor?: string;
  @IsOptional() @IsString() prioridade?: string;
  @IsOptional() @IsDateString() dataFim?: string;
  @IsOptional() @IsArray() membros?: string[];
  @IsOptional() @IsString() tipo?: string;
  @IsOptional() @IsString() clienteId?: string;
  @IsOptional() @IsNumber() @Type(() => Number) valor?: number;
}
class UpdateProjectDto {
  @IsOptional() @IsString() titulo?: string;
  @IsOptional() @IsString() descricao?: string;
  @IsOptional() @IsString() cor?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() prioridade?: string;
  @IsOptional() @IsDateString() dataFim?: string;
  @IsOptional() @IsString() tipo?: string;
  @IsOptional() @IsString() clienteId?: string;
  @IsOptional() @IsNumber() @Type(() => Number) valor?: number;
}
class CreateTaskDto {
  @IsString() titulo: string;
  @IsOptional() @IsString() descricao?: string;
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsString() prioridade?: string;
  @IsOptional() @IsDateString() dataVencimento?: string;
}
class UpdateTaskDto {
  @IsOptional() @IsString() titulo?: string;
  @IsOptional() @IsString() descricao?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsString() prioridade?: string;
  @IsOptional() @IsDateString() dataVencimento?: string;
}

async function recalcProgress(prisma: PrismaService, projectId: string) {
  const tasks = await prisma.task.findMany({ where: { projectId } });
  if (!tasks.length) { await prisma.project.update({ where: { id: projectId }, data: { progressoPct: 0 } }); return 0; }
  const pct = Math.round((tasks.filter(t => t.status === "CONCLUIDA").length / tasks.length) * 100);
  await prisma.project.update({ where: { id: projectId }, data: { progressoPct: pct } });
  return pct;
}

async function createDeadlineEvent(prisma: PrismaService, project: any, userIds: string[], criadoPorId: string) {
  if (!project.dataFim) return;
  // Multi-tenant: Event exige organizationId. Pega do proprio projeto.
  const orgId = project.organizationId;
  const deadline = new Date(project.dataFim);
  deadline.setHours(9, 0, 0, 0);
  for (const uid of userIds) {
    await prisma.event.create({
      data: {
        titulo: "Prazo: " + project.titulo,
        descricao: "Prazo final do projeto " + project.titulo,
        inicio: deadline,
        fim: new Date(deadline.getTime() + 60 * 60 * 1000),
        tipo: "PROJETO",
        cor: project.cor || "#a78bfa",
        userId: uid,
        criadoPorId,
        origemTipo: "projeto",
        origemId: project.id,
        confirmado: uid === criadoPorId,
        ...(orgId ? { organizationId: orgId } : {}),
      } as any,
    });
    // Notifica membro
    if (uid !== criadoPorId) {
      await prisma.notification.create({
        data: {
          userId: uid,
          tipo: "projeto_prazo",
          titulo: "Voce foi adicionado ao projeto: " + project.titulo,
          mensagem: "Prazo: " + deadline.toLocaleDateString("pt-BR"),
          referenciaTipo: "project",
          referenciaId: project.id,
        },
      });
    }
  }
}

@Controller("projects")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class ProjectsController {
  constructor(
    private prisma: PrismaService,
    private webhook: WebhookService,
  ) {}

  @Get()
  @Permissions("projetos:ver")
  async findAll(@Req() req: any, @Query("tipo") tipo?: string) {
    const orgId = req.user?.organizationId;
    const projects = await this.prisma.project.findMany({
      where: {
        AND: [
          { OR: [{ criadoPorId: req.user.id }, { members: { some: { userId: req.user.id } } }] },
          ...(tipo ? [{ tipo: tipo as any }] : []),
          ...(orgId ? [{ organizationId: orgId } as any] : []),
        ],
      },
      include: {
        members: { include: { user: { select: { id: true, nome: true, email: true } } } },
        tasks: { select: { id: true, status: true } },
        cliente: { select: { id: true, nome: true, empresa: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { criadoEm: "desc" },
    });
    return projects.map((p: any) => ({
      ...p,
      totalTasks: p._count.tasks,
      tasksConcluidas: p.tasks.filter((t: any) => t.status === "CONCLUIDA").length,
    }));
  }

  @Get(":id")
  @Permissions("projetos:ver")
  async findOne(@Param("id") id: string) {
    const p = await this.prisma.project.findUnique({
      where: { id },
      include: {
        members: { include: { user: { select: { id: true, nome: true, email: true } } } },
        tasks: { include: { assignee: { select: { id: true, nome: true } }, comments: { include: { user: { select: { id: true, nome: true } } } } }, orderBy: { criadoEm: "asc" } },
        milestones: { orderBy: { dataAlvo: "asc" } },
        cliente: { select: { id: true, nome: true, empresa: true, email: true, telefone: true } },
      },
    });
    if (!p) throw new NotFoundException("Projeto nao encontrado");
    return p;
  }

  @Post()
  @Permissions("projetos:criar")
  async create(@Body() dto: CreateProjectDto, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const project = await this.prisma.project.create({
      data: {
        titulo: dto.titulo, descricao: dto.descricao,
        cor: dto.cor || "#a78bfa", prioridade: (dto.prioridade || "MEDIA") as any,
        tipo: (dto.tipo || "PROJETO") as any,
        clienteId: dto.clienteId || null,
        valor: dto.valor ?? null,
        dataInicio: new Date(),
        dataFim: dto.dataFim ? new Date(dto.dataFim) : null,
        criadoPorId: req.user.id,
        members: { create: [{ userId: req.user.id, papel: "owner" }] },
        ...(orgId ? { organizationId: orgId } : {}),
      } as any,
    });

    const allMemberIds = [req.user.id];

    if (dto.membros?.length) {
      for (const uid of dto.membros) {
        if (uid === req.user.id) continue;
        await this.prisma.projectMember.create({ data: { projectId: project.id, userId: uid, papel: "membro" } });
        allMemberIds.push(uid);
      }
    }

    // Cria evento de prazo na agenda de todos os membros
    if (dto.dataFim) {
      await createDeadlineEvent(this.prisma, { ...project, dataFim: dto.dataFim }, allMemberIds, req.user.id);
    }

    return project;
  }

  @Put(":id")
  @Permissions("projetos:editar")
  async update(@Param("id") id: string, @Body() dto: UpdateProjectDto, @Req() req: any) {
    const existing = await this.prisma.project.findUnique({ where: { id }, include: { members: true } });
    if (!existing) throw new NotFoundException();

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.titulo && { titulo: dto.titulo }),
        ...(dto.descricao !== undefined && { descricao: dto.descricao }),
        ...(dto.cor && { cor: dto.cor }),
        ...(dto.status && { status: dto.status as any }),
        ...(dto.prioridade && { prioridade: dto.prioridade as any }),
        ...(dto.dataFim && { dataFim: new Date(dto.dataFim) }),
        ...(dto.tipo && { tipo: dto.tipo as any }),
        ...(dto.clienteId !== undefined && { clienteId: dto.clienteId || null }),
        ...(dto.valor !== undefined && { valor: dto.valor ?? null }),
      },
    });

    // Webhook quando projeto é marcado como concluído
    if (dto.status === "CONCLUIDO" && existing.status !== "CONCLUIDO") {
      this.webhook.fire("projeto.concluido", {
        id: updated.id, titulo: updated.titulo, status: updated.status,
        clienteId: updated.clienteId || null, progressoPct: updated.progressoPct,
        concluidoEm: new Date(),
      }, (updated as any).organizationId).catch(() => {});
    }

    // Se mudou o prazo, atualiza eventos existentes ou cria novos
    if (dto.dataFim && dto.dataFim !== existing.dataFim?.toISOString().slice(0, 10)) {
      // Remove eventos antigos de prazo
      await this.prisma.event.deleteMany({ where: { origemTipo: "projeto", origemId: id } });
      // Cria novos
      const memberIds = existing.members.map((m: any) => m.userId);
      await createDeadlineEvent(this.prisma, { ...updated, dataFim: dto.dataFim }, memberIds, req.user.id);
    }

    return updated;
  }

  @Delete(":id")
  @Permissions("projetos:deletar")
  async remove(@Param("id") id: string, @Req() req: any) {
    const p = await this.prisma.project.findUnique({ where: { id } });
    if (!p) throw new NotFoundException();
    if (p.criadoPorId !== req.user.id && !req.user.isMaster) throw new BadRequestException("Sem permissao");
    // Remove eventos de prazo
    await this.prisma.event.deleteMany({ where: { origemTipo: "projeto", origemId: id } });
    await this.prisma.project.delete({ where: { id } });
    return { message: "Projeto removido" };
  }

  @Post(":id/tasks")
  @Permissions("projetos:editar")
  async createTask(@Param("id") projectId: string, @Body() dto: CreateTaskDto, @Req() req: any) {
    const task = await this.prisma.task.create({
      data: {
        projectId, titulo: dto.titulo, descricao: dto.descricao,
        assigneeId: dto.assigneeId || null,
        prioridade: (dto.prioridade || "MEDIA") as any,
        status: "A_FAZER" as any,
        dataVencimento: dto.dataVencimento ? new Date(dto.dataVencimento) : null,
        criadoPorId: req.user.id,
      },
      include: { assignee: { select: { id: true, nome: true } } },
    });

    // Se task tem data de vencimento e responsavel, cria evento na agenda dele
    if (dto.dataVencimento && dto.assigneeId) {
      const venc = new Date(dto.dataVencimento);
      venc.setHours(9, 0, 0, 0);
      const proj = await this.prisma.project.findUnique({ where: { id: projectId } });
      await this.prisma.event.create({
        data: {
          titulo: "Task: " + dto.titulo,
          descricao: "Vencimento da task no projeto " + (proj?.titulo || ""),
          inicio: venc,
          fim: new Date(venc.getTime() + 60 * 60 * 1000),
          tipo: "PROJETO",
          cor: proj?.cor || "#60a5fa",
          userId: dto.assigneeId,
          criadoPorId: req.user.id,
          origemTipo: "task",
          origemId: task.id,
          confirmado: dto.assigneeId === req.user.id,
          ...((proj as any)?.organizationId ? { organizationId: (proj as any).organizationId } : {}),
        } as any,
      });
      await this.prisma.notification.create({
        data: {
          userId: dto.assigneeId,
          tipo: "task_atribuida",
          titulo: "Nova task atribuida: " + dto.titulo,
          mensagem: "Vencimento: " + venc.toLocaleDateString("pt-BR"),
          referenciaTipo: "task",
          referenciaId: task.id,
        },
      });
    }

    await recalcProgress(this.prisma, projectId);
    return task;
  }

  @Patch(":id/tasks/:taskId")
  @Permissions("projetos:editar")
  async updateTask(@Param("id") projectId: string, @Param("taskId") taskId: string, @Body() dto: UpdateTaskDto) {
    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(dto.titulo && { titulo: dto.titulo }),
        ...(dto.descricao !== undefined && { descricao: dto.descricao }),
        ...(dto.status && { status: dto.status as any }),
        ...(dto.assigneeId !== undefined && { assigneeId: (dto.assigneeId || null) as any }),
        ...(dto.prioridade && { prioridade: dto.prioridade as any }),
        ...(dto.dataVencimento !== undefined && { dataVencimento: dto.dataVencimento ? new Date(dto.dataVencimento) : null }),
      },
      include: { assignee: { select: { id: true, nome: true } } },
    });
    await recalcProgress(this.prisma, projectId);
    return task;
  }

  @Delete(":id/tasks/:taskId")
  @Permissions("projetos:editar")
  async deleteTask(@Param("id") projectId: string, @Param("taskId") taskId: string) {
    await this.prisma.task.delete({ where: { id: taskId } });
    await recalcProgress(this.prisma, projectId);
    return { message: "Task removida" };
  }

  // ── Milestones ───────────────────────────────────────────────────────────────

  @Post(":id/milestones")
  @Permissions("projetos:editar")
  async createMilestone(@Param("id") projectId: string, @Body() body: { titulo: string; descricao?: string; dataAlvo: string }) {
    if (!body.titulo?.trim() || !body.dataAlvo) throw new BadRequestException("titulo e dataAlvo obrigatorios");
    return this.prisma.milestone.create({
      data: { projectId, titulo: body.titulo, descricao: body.descricao, dataAlvo: new Date(body.dataAlvo) },
    });
  }

  @Patch(":id/milestones/:mid")
  @Permissions("projetos:editar")
  async updateMilestone(@Param("mid") mid: string, @Body() body: { titulo?: string; descricao?: string; dataAlvo?: string; concluido?: boolean }) {
    return this.prisma.milestone.update({
      where: { id: mid },
      data: {
        ...(body.titulo && { titulo: body.titulo }),
        ...(body.descricao !== undefined && { descricao: body.descricao }),
        ...(body.dataAlvo && { dataAlvo: new Date(body.dataAlvo) }),
        ...(body.concluido !== undefined && { concluido: body.concluido }),
      },
    });
  }

  @Delete(":id/milestones/:mid")
  @Permissions("projetos:editar")
  async deleteMilestone(@Param("mid") mid: string) {
    await this.prisma.milestone.delete({ where: { id: mid } });
    return { message: "Marco removido" };
  }

  // ── Members ───────────────────────────────────────────────────────────────

  @Post(":id/members")
  @Permissions("projetos:editar")
  async addMember(@Param("id") id: string, @Body() body: { userId: string; papel?: string }, @Req() req: any) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException();
    const member = await this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: id, userId: body.userId } },
      update: { papel: body.papel || "membro" },
      create: { projectId: id, userId: body.userId, papel: body.papel || "membro" },
    });
    if (body.userId !== req.user.id) {
      if (project.dataFim) {
        // Cria evento de prazo + notificacao de convite
        await createDeadlineEvent(this.prisma, project, [body.userId], req.user.id);
      } else {
        // Sem prazo: cria evento generico de convite na agenda do membro
        await this.prisma.event.create({
          data: {
            titulo: "Projeto: " + project.titulo,
            descricao: "Voce foi adicionado ao projeto",
            inicio: new Date(),
            fim: new Date(Date.now() + 30 * 60 * 1000),
            tipo: "PROJETO",
            cor: project.cor || "#a78bfa",
            userId: body.userId,
            criadoPorId: req.user.id,
            origemTipo: "projeto",
            origemId: project.id,
            confirmado: false,
            ...((project as any).organizationId ? { organizationId: (project as any).organizationId } : {}),
          } as any,
        });
        await this.prisma.notification.create({
          data: {
            userId: body.userId,
            tipo: "projeto_prazo",
            titulo: "Voce foi adicionado ao projeto: " + project.titulo,
            mensagem: "Confirme sua participacao",
            referenciaTipo: "project",
            referenciaId: project.id,
          },
        });
      }
    }
    return member;
  }

  @Delete(":id/members/:userId")
  @Permissions("projetos:editar")
  async removeMember(@Param("id") id: string, @Param("userId") userId: string) {
    await this.prisma.projectMember.delete({ where: { projectId_userId: { projectId: id, userId } } });
    return { message: "Membro removido" };
  }
}

@Module({
  imports: [WebhooksModule],
  controllers: [ProjectsController],
})
export class ProjectsModule {}