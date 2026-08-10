import { Module, Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Req, Res, UseInterceptors, UploadedFile, NotFoundException, BadRequestException } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { randomUUID } from "crypto";
import { AuthGuard } from "@nestjs/passport";
import { IsString, IsOptional, IsArray, IsDateString, IsNumber } from "class-validator";
import { Type } from "class-transformer";
import { PrismaService } from "../../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { WebhookService, WebhooksModule } from "../automacoes/webhooks.module";
import { AutomacaoService, AutomacoesModule } from "../automacoes/automacoes.module";
import { NotificacaoDispatcher } from "../notifications/notificacao-dispatcher.service";
import { NotificationsModule } from "../notifications/notifications.module";

import { ProjectAnexoStorageService } from "./project-anexo-storage.service";

/**
 * Tipos aceitos em anexo de projeto — a mesma lista do Compliance.
 *
 * Lista de permitidos, não de proibidos: o que não está aqui é recusado. A
 * lista de proibidos sempre esquece um formato executável novo.
 */
const ANEXO_MIMES_ACEITOS: readonly string[] = [
  "application/pdf",
  "image/jpeg", "image/png", "image/webp", "image/tiff",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip", "application/x-zip-compressed",
];

/** 25 MB, igual ao Compliance: proposta com anexos técnicos passa de 15 MB. */
const ANEXO_TAMANHO_MAXIMO = 25 * 1024 * 1024;

/** Status do projeto em português, para a mensagem do aviso ser legível. */
const ROTULO_STATUS_PROJETO: Record<string, string> = {
  PLANEJAMENTO: "Planejamento",
  EM_ANDAMENTO: "Em andamento",
  PAUSADO: "Pausado",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

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

// Progresso PONDERADO pelo estagio da tarefa (nao so concluidas), para a barra
// "andar" conforme o trabalho avanca. Canceladas saem da conta (nao travam 100%).
const PESO_STATUS: Record<string, number> = { A_FAZER: 0, EM_ANDAMENTO: 0.5, EM_REVISAO: 0.8, CONCLUIDA: 1 };
function calcPct(tasks: { status: string }[]): number {
  const ativas = tasks.filter(t => t.status !== "CANCELADA");
  if (!ativas.length) return 0;
  const soma = ativas.reduce((acc, t) => acc + (PESO_STATUS[t.status] ?? 0), 0);
  return Math.round((soma / ativas.length) * 100);
}

async function recalcProgress(prisma: PrismaService, projectId: string) {
  const tasks = await prisma.task.findMany({ where: { projectId }, select: { status: true } });
  const pct = calcPct(tasks);
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
    private automacao: AutomacaoService,
    private notificacoes: NotificacaoDispatcher,
    private anexos: ProjectAnexoStorageService,
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
      // Recalcula na hora (ponderado) para projetos antigos refletirem ja na listagem
      progressoPct: calcPct(p.tasks),
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
    return { ...p, progressoPct: calcPct(p.tasks) };
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

    // Todo mundo que entrou no projeto passa a receber os avisos dele.
    if (orgId) await this.garantirPreferenciaDeProjetos(orgId, allMemberIds);

    // Cria evento de prazo na agenda de todos os membros
    if (dto.dataFim) {
      await createDeadlineEvent(this.prisma, { ...project, dataFim: dto.dataFim }, allMemberIds, req.user.id);
    }

    // Trigger automacao + webhook
    this.automacao.executar("projeto_criado", {
      id: project.id, titulo: project.titulo, status: project.status,
      organizationId: orgId, criadoPorId: req.user.id,
    }).catch(() => {});

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

    // Avisa quem está no projeto que o status mudou.
    //
    // Só o status do PROJETO, e não o das tarefas: num quadro ativo, cartão
    // muda de coluna dezenas de vezes por dia, e aviso demais faz a pessoa
    // ignorar todos — inclusive o que importa. Status de projeto muda pouco e
    // cada mudança interessa a todo mundo que está nele.
    if (dto.status && dto.status !== existing.status) {
      const envolvidos = [
        ...existing.members.map((m: any) => m.userId),
        existing.criadoPorId,
      ].filter((u, i, a) => u && a.indexOf(u) === i)
        // Quem fez a mudança não precisa ser avisado dela.
        .filter(u => u !== req.user.id);

      if (envolvidos.length) {
        this.notificacoes.despachar({
          organizationId: (updated as any).organizationId,
          modulo: "projects",
          tipo: "projeto_status",
          titulo: `Projeto ${updated.titulo}: ${ROTULO_STATUS_PROJETO[updated.status] ?? updated.status}`,
          mensagem:
            `${req.user.nome ?? "Alguém"} mudou o status de ` +
            `${ROTULO_STATUS_PROJETO[existing.status] ?? existing.status} para ` +
            `${ROTULO_STATUS_PROJETO[updated.status] ?? updated.status}.`,
          // Cancelamento é "aviso": interrompe o trabalho de quem está no
          // projeto. As demais mudanças são informativas.
          severidade: updated.status === "CANCELADO" ? "aviso" : "info",
          usuariosAlvo: envolvidos,
          referenciaTipo: "projeto",
          referenciaId: updated.id,
          // Sem a chave, salvar o formulário duas vezes com o mesmo status
          // mandaria o aviso duas vezes.
          chave: `projeto:${updated.id}:status:${updated.status}`,
        }).catch(() => {});
      }
    }

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

    // Trigger automacao
    const proj = await this.prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } as any });
    const orgIdTask = (proj as any)?.organizationId;
    this.automacao.executar("tarefa_criada", {
      id: task.id, titulo: task.titulo, projectId, assigneeId: task.assigneeId, status: task.status, organizationId: orgIdTask,
    }).catch(() => {});
    if (task.assigneeId) {
      this.automacao.executar("tarefa_atribuida", {
        id: task.id, titulo: task.titulo, projectId, assigneeId: task.assigneeId, organizationId: orgIdTask,
      }).catch(() => {});
    }

    return task;
  }

  @Patch(":id/tasks/:taskId")
  @Permissions("projetos:editar")
  async updateTask(@Param("id") projectId: string, @Param("taskId") taskId: string, @Body() dto: UpdateTaskDto) {
    const before = await this.prisma.task.findUnique({ where: { id: taskId } });
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

    const proj = await this.prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } as any });
    const orgIdT = (proj as any)?.organizationId;
    if (dto.status === "CONCLUIDA" && before?.status !== "CONCLUIDA") {
      this.automacao.executar("tarefa_concluida", {
        id: task.id, titulo: task.titulo, projectId, assigneeId: task.assigneeId, organizationId: orgIdT,
      }).catch(() => {});
    }
    if (dto.assigneeId && before?.assigneeId !== task.assigneeId) {
      this.automacao.executar("tarefa_atribuida", {
        id: task.id, titulo: task.titulo, projectId, assigneeId: task.assigneeId, organizationId: orgIdT,
      }).catch(() => {});
    }

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
  @Permissions("projetos:gerenciar")
  @Permissions("projetos:editar")
  async addMember(@Param("id") id: string, @Body() body: { userId: string; papel?: string }, @Req() req: any) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException();
    const member = await this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: id, userId: body.userId } },
      update: { papel: body.papel || "membro" },
      create: { projectId: id, userId: body.userId, papel: body.papel || "membro" },
    });

    // Entrou no projeto, passa a receber os avisos dele.
    await this.garantirPreferenciaDeProjetos((project as any).organizationId, [body.userId]);

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
  @Permissions("projetos:gerenciar")
  @Permissions("projetos:editar")
  async removeMember(@Param("id") id: string, @Param("userId") userId: string) {
    await this.prisma.projectMember.delete({ where: { projectId_userId: { projectId: id, userId } } });
    return { message: "Membro removido" };
  }

  /* ── Anexos ──────────────────────────────────────────────────────────────
     Proposta, ata, escopo assinado — o que sustenta a decisão do projeto.
     Guardados fora do diretório público: só saem pelo endpoint de download,
     que confere a organização. */

  /**
   * Garante que quem entra num projeto passe a receber os avisos dele.
   *
   * O despachante NEGA POR PADRÃO: sem linha em `notificacao_preferencias`, a
   * pessoa não recebe nada. É um desenho deliberado e bom — antes o alerta de
   * Frota ia para todos os masters, quisessem ou não. Mas ele parte do princípio
   * de que alguém cadastrou a preferência, e ninguém cadastra: em 10/08/2026 a
   * organização inteira tinha DUAS linhas, nenhuma de `projects`. O aviso de
   * projeto sairia para zero pessoas, em silêncio.
   *
   * Entrar num projeto é o próprio sinal de interesse — mais específico que um
   * papel, e por isso legítimo como gatilho. A pessoa continua podendo desligar
   * depois na tela de notificações.
   *
   * NÃO SOBRESCREVE linha existente: quem desligou de propósito não é religado
   * ao ser posto num projeto novo. Por isso `createMany` com `skipDuplicates`
   * não serve — ele ignora conflito de chave única, e aqui a checagem é por
   * (usuário, módulo).
   *
   * WhatsApp fica ligado, mas só chega em quem tem número no perfil E manteve o
   * opt-in — o despachante confere os dois.
   */
  private async garantirPreferenciaDeProjetos(organizationId: string, userIds: string[]) {
    const alvos = userIds.filter((u, i, a) => u && a.indexOf(u) === i);
    if (!alvos.length) return;

    const existentes = await this.prisma.notificacaoPreferencia.findMany({
      where: { userId: { in: alvos }, modulo: "projects" },
      select: { userId: true },
    });
    const jaTem = new Set(existentes.map(e => e.userId));
    const faltando = alvos.filter(u => !jaTem.has(u));
    if (!faltando.length) return;

    await this.prisma.notificacaoPreferencia.createMany({
      data: faltando.map(userId => ({
        organizationId, userId, modulo: "projects",
        sistema: true, whatsapp: true, email: false,
        severidadeMin: "info",
      })),
    }).catch(() => {
      // Preferência é acessório: não vale derrubar a criação do projeto se a
      // linha não entrar. O pior caso é a pessoa não receber, que é o estado
      // anterior de qualquer forma.
    });
  }

  /** Confere que o projeto existe E é da organização de quem pede. */
  private async exigirProjeto(id: string, req: any) {
    const projeto = await this.prisma.project.findFirst({
      where: { id, organizationId: req.user.organizationId },
    });
    if (!projeto) throw new NotFoundException("Projeto não encontrado.");
    return projeto;
  }

  @Get(":id/anexos")
  @Permissions("projetos:ver")
  async listarAnexos(@Param("id") id: string, @Req() req: any) {
    await this.exigirProjeto(id, req);
    return this.prisma.projectAnexo.findMany({
      where: { projectId: id, deletedAt: null },
      orderBy: { criadoEm: "desc" },
      select: {
        id: true, titulo: true, nomeOriginal: true, mime: true, tamanho: true, criadoEm: true,
        criadoPor: { select: { id: true, nome: true } },
      },
    });
  }

  @Post(":id/anexos")
  @Permissions("projetos:editar")
  @UseInterceptors(FileInterceptor("arquivo", {
    storage: memoryStorage(),
    limits: { fileSize: ANEXO_TAMANHO_MAXIMO },
  }))
  async enviarAnexo(
    @Param("id") id: string,
    @Body() dados: { titulo?: string },
    @UploadedFile() arquivo: any,
    @Req() req: any,
  ) {
    const projeto = await this.exigirProjeto(id, req);

    if (!arquivo) throw new BadRequestException("Nenhum arquivo enviado.");
    if (arquivo.size > ANEXO_TAMANHO_MAXIMO) {
      throw new BadRequestException(
        `Arquivo maior que o limite de ${Math.round(ANEXO_TAMANHO_MAXIMO / 1024 / 1024)} MB.`,
      );
    }
    if (!ANEXO_MIMES_ACEITOS.includes(arquivo.mimetype)) {
      throw new BadRequestException(
        `Tipo de arquivo não aceito (${arquivo.mimetype}). Aceitos: PDF, Word, Excel, imagem e ZIP.`,
      );
    }

    // Nome no disco é o id + extensão, nunca o nome enviado: o original vai
    // para o banco e é usado só no download. Assim nome com `../`, acento ou
    // caractere de shell não vira caminho.
    const anexoId = randomUUID();
    const extensao = (arquivo.originalname.match(/\.([A-Za-z0-9]{1,8})$/)?.[1] ?? "bin").toLowerCase();
    const ref = await this.anexos.gravar(
      projeto.organizationId, id, `${anexoId}.${extensao}`, arquivo.buffer,
    );

    return this.prisma.projectAnexo.create({
      data: {
        id: anexoId,
        organizationId: projeto.organizationId,
        projectId: id,
        titulo: (dados?.titulo || arquivo.originalname).slice(0, 200),
        nomeOriginal: arquivo.originalname,
        arquivoRef: ref,
        mime: arquivo.mimetype,
        tamanho: arquivo.size,
        criadoPorId: req.user.id,
      },
      select: { id: true, titulo: true, nomeOriginal: true, mime: true, tamanho: true, criadoEm: true },
    });
  }

  @Get(":id/anexos/:anexoId/download")
  @Permissions("projetos:ver")
  async baixarAnexo(
    @Param("id") id: string,
    @Param("anexoId") anexoId: string,
    @Req() req: any,
    @Res() res: any,
  ) {
    await this.exigirProjeto(id, req);
    const anexo = await this.prisma.projectAnexo.findFirst({
      where: { id: anexoId, projectId: id, deletedAt: null },
    });
    if (!anexo) throw new NotFoundException("Anexo não encontrado.");
    if (!this.anexos.existe(anexo.arquivoRef)) {
      // O registro existe e o arquivo não: dizer isso é mais útil que um 500.
      throw new NotFoundException("O arquivo não está mais disponível no servidor.");
    }

    res.setHeader("Content-Type", anexo.mime || "application/octet-stream");
    // `attachment` de propósito: anexo de projeto não deve abrir dentro da
    // página, onde um HTML enviado por engano rodaria no nosso domínio.
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(anexo.nomeOriginal)}`,
    );
    this.anexos.abrirLeitura(anexo.arquivoRef).pipe(res);
  }

  @Delete(":id/anexos/:anexoId")
  @Permissions("projetos:editar")
  async removerAnexo(@Param("id") id: string, @Param("anexoId") anexoId: string, @Req() req: any) {
    await this.exigirProjeto(id, req);
    const anexo = await this.prisma.projectAnexo.findFirst({
      where: { id: anexoId, projectId: id, deletedAt: null },
    });
    if (!anexo) throw new NotFoundException("Anexo não encontrado.");

    // Exclusão lógica no registro, remoção física do arquivo: a linha guarda
    // quem enviou e quando, que é o que responde "de onde veio este documento".
    await this.prisma.projectAnexo.update({
      where: { id: anexoId },
      data: { deletedAt: new Date() },
    });
    await this.anexos.remover(anexo.arquivoRef);
    return { message: "Anexo removido" };
  }
}

@Module({
  imports: [WebhooksModule, AutomacoesModule, NotificationsModule],
  providers: [ProjectAnexoStorageService],
  controllers: [ProjectsController],
})
export class ProjectsModule {}