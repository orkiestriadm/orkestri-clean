import {
  Module, Controller, Get, Post, Put, Patch, Delete, Body, Param, Query,
  UseGuards, Req, Injectable, BadRequestException, NotFoundException, ForbiddenException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";

const TIPOS_VALIDOS = ["despesa", "horas_extra", "alteracao_cadastral", "folga_compensatoria", "compra", "viagem", "outro"];

class CreateWfRequestDto {
  tipo: string;
  titulo: string;
  descricao?: string;
  payload?: any;
  valor?: number;
}

class DecisionDto {
  observacoes?: string;
}

class RejectDto {
  motivo: string;
  observacoes?: string;
}

@Injectable()
export class WorkflowsService {
  constructor(private prisma: PrismaService) {}

  private orgScope(user: any) {
    return user?.organizationId ? { organizationId: user.organizationId } : {};
  }

  /** Master ou quem tem colaboradores:ver enxerga workflows de toda a org. */
  private isPrivileged(user: any) {
    return !!user?.isMaster ||
      (user?.permissions || []).some((p: string) => p === "*" || p === "colaboradores:ver");
  }

  private async notify(userId: string | null | undefined, tipo: string, titulo: string, mensagem: string, refId?: string) {
    if (!userId) return;
    try {
      await (this.prisma as any).notification.create({
        data: { userId, tipo, titulo, mensagem, referenciaTipo: "workflow", referenciaId: refId || null },
      });
    } catch {}
  }

  /** Encontra o aprovador inicial: gestor direto do solicitante (via Collaborator) */
  private async findInitialApprover(userId: string, orgId: string): Promise<string | null> {
    const collab = await (this.prisma as any).collaborator.findFirst({
      where: { userId, organizationId: orgId },
      include: { gestor: { select: { userId: true } } },
    });
    if (!collab) return null;
    return collab.gestor?.userId || null;
  }

  /** Sobe na cadeia hierárquica para encontrar o próximo aprovador */
  private async findNextApprover(currentApproverId: string, orgId: string): Promise<string | null> {
    const collab = await (this.prisma as any).collaborator.findFirst({
      where: { userId: currentApproverId, organizationId: orgId },
      include: { gestor: { select: { userId: true } } },
    });
    if (!collab) return null;
    return collab.gestor?.userId || null;
  }

  async findAll(user: any, filter?: { status?: string; tipo?: string; minhas?: boolean; aguardandoMinhaAprovacao?: boolean }) {
    const where: any = { ...this.orgScope(user) };
    if (filter?.status) where.status = filter.status;
    if (filter?.tipo) where.tipo = filter.tipo;
    if (filter?.minhas) where.solicitanteId = user.id;
    if (filter?.aguardandoMinhaAprovacao) {
      where.aprovadorAtualId = user.id;
      where.status = "PENDENTE";
    }
    // Privacidade: na aba "Todas", não-privilegiados só veem o que solicitaram
    // ou o que está sob sua aprovação. Master/colaboradores:ver veem tudo da org.
    if (!filter?.minhas && !filter?.aguardandoMinhaAprovacao && !this.isPrivileged(user)) {
      where.OR = [{ solicitanteId: user.id }, { aprovadorAtualId: user.id }];
    }
    return (this.prisma as any).workflowRequest.findMany({
      where,
      include: {
        solicitante:    { select: { id: true, nome: true, email: true, avatar: true } },
        aprovadorAtual: { select: { id: true, nome: true } },
        aprovadoPor:    { select: { id: true, nome: true } },
        rejeitadoPor:   { select: { id: true, nome: true } },
        _count: { select: { aprovacoes: true } },
      },
      orderBy: { criadoEm: "desc" },
    });
  }

  async findOne(id: string, user: any) {
    const r = await (this.prisma as any).workflowRequest.findFirst({
      where: { id, ...this.orgScope(user) },
      include: {
        solicitante:    { select: { id: true, nome: true, email: true, avatar: true } },
        aprovadorAtual: { select: { id: true, nome: true } },
        aprovadoPor:    { select: { id: true, nome: true } },
        rejeitadoPor:   { select: { id: true, nome: true } },
        aprovacoes: {
          include: { aprovador: { select: { id: true, nome: true } } },
          orderBy: { criadoEm: "asc" },
        },
      },
    });
    if (!r) throw new NotFoundException("Solicitação não encontrada");
    return r;
  }

  async create(dto: CreateWfRequestDto, user: any) {
    if (!TIPOS_VALIDOS.includes(dto.tipo)) throw new BadRequestException("Tipo inválido");
    if (!dto.titulo?.trim()) throw new BadRequestException("Título obrigatório");
    const aprovador = await this.findInitialApprover(user.id, user.organizationId);

    const created = await (this.prisma as any).workflowRequest.create({
      data: {
        organizationId: user.organizationId,
        solicitanteId: user.id,
        tipo: dto.tipo,
        titulo: dto.titulo.trim(),
        descricao: dto.descricao?.trim() || null,
        payload: dto.payload || null,
        valor: dto.valor ?? null,
        status: "PENDENTE",
        aprovadorAtualId: aprovador,
      },
      include: {
        solicitante:    { select: { id: true, nome: true } },
        aprovadorAtual: { select: { id: true, nome: true } },
      },
    });
    await this.notify(aprovador, "workflow_pendente",
      "Solicitação aguardando aprovação",
      `${created.solicitante.nome} enviou: ${created.titulo}`,
      created.id);
    return created;
  }

  async approve(id: string, dto: DecisionDto, user: any) {
    const r = await this.findOne(id, user);
    if (r.status !== "PENDENTE") throw new BadRequestException("Solicitação não está pendente");
    const isMaster = !!user?.isMaster;
    const isCurrentApprover = r.aprovadorAtualId === user.id;
    if (!isCurrentApprover && !isMaster) throw new ForbiddenException("Apenas o aprovador atual ou master pode aprovar");

    const nivel = (r.aprovacoes?.length || 0) + 1;
    // Registra a aprovação
    await (this.prisma as any).workflowApproval.create({
      data: {
        requestId: id, aprovadorId: user.id, nivel,
        decisao: "APROVADO",
        observacoes: dto.observacoes?.trim() || null,
      },
    });

    // Regra simples de escalonamento: despesas > R$ 5.000 sobem 1 nível
    const precisaSubir = r.tipo === "despesa" && (r.valor || 0) > 5000 && nivel < 2;
    if (precisaSubir) {
      const proximo = await this.findNextApprover(user.id, user.organizationId);
      if (proximo) {
        const escalada = await (this.prisma as any).workflowRequest.update({
          where: { id },
          data: { aprovadorAtualId: proximo, atualizadoEm: new Date() },
        });
        await this.notify(proximo, "workflow_pendente",
          "Solicitação escalada para aprovação",
          `"${r.titulo}" (R$ ${(r.valor||0).toFixed(2)}) foi escalada para você`, id);
        await this.notify(r.solicitanteId, "workflow_andamento",
          "Solicitação em análise", `"${r.titulo}" foi aprovada no 1º nível e escalada.`, id);
        return escalada;
      }
    }

    // Finaliza como APROVADA
    const aprovada = await (this.prisma as any).workflowRequest.update({
      where: { id },
      data: {
        status: "APROVADA",
        aprovadoPorId: user.id,
        aprovadoEm: new Date(),
        aprovadorAtualId: null,
      },
    });
    await this.notify(r.solicitanteId, "workflow_aprovado",
      "Solicitação aprovada", `Sua solicitação "${r.titulo}" foi aprovada.`, id);
    return aprovada;
  }

  async reject(id: string, dto: RejectDto, user: any) {
    const r = await this.findOne(id, user);
    if (r.status !== "PENDENTE") throw new BadRequestException("Solicitação não está pendente");
    const isMaster = !!user?.isMaster;
    const isCurrentApprover = r.aprovadorAtualId === user.id;
    if (!isCurrentApprover && !isMaster) throw new ForbiddenException("Sem permissão");
    if (!dto.motivo?.trim()) throw new BadRequestException("Motivo obrigatório para rejeição");

    const nivel = (r.aprovacoes?.length || 0) + 1;
    await (this.prisma as any).workflowApproval.create({
      data: {
        requestId: id, aprovadorId: user.id, nivel,
        decisao: "REJEITADO",
        observacoes: dto.observacoes?.trim() || null,
      },
    });
    const rejeitada = await (this.prisma as any).workflowRequest.update({
      where: { id },
      data: {
        status: "REJEITADA",
        rejeitadoPorId: user.id,
        rejeitadoEm: new Date(),
        motivoRejeicao: dto.motivo.trim(),
        aprovadorAtualId: null,
      },
    });
    await this.notify(r.solicitanteId, "workflow_rejeitado",
      "Solicitação rejeitada", `Sua solicitação "${r.titulo}" foi rejeitada. Motivo: ${dto.motivo.trim()}`, id);
    return rejeitada;
  }

  async cancel(id: string, user: any) {
    const r = await this.findOne(id, user);
    if (r.solicitanteId !== user.id && !user.isMaster) throw new ForbiddenException("Apenas o solicitante ou master pode cancelar");
    if (r.status !== "PENDENTE") throw new BadRequestException("Apenas solicitações pendentes podem ser canceladas");
    return (this.prisma as any).workflowRequest.update({
      where: { id },
      data: { status: "CANCELADA", aprovadorAtualId: null },
    });
  }

  async remove(id: string, user: any) {
    const r = await this.findOne(id, user);
    if (r.solicitanteId !== user.id && !user.isMaster) throw new ForbiddenException("Sem permissão");
    if (r.status === "APROVADA") throw new BadRequestException("Solicitação aprovada não pode ser removida");
    return (this.prisma as any).workflowRequest.delete({ where: { id } });
  }

  async stats(user: any) {
    const orgScope = this.orgScope(user);
    const [minhasPendentes, aguardando, aprovadas, rejeitadas] = await Promise.all([
      (this.prisma as any).workflowRequest.count({ where: { ...orgScope, solicitanteId: user.id, status: "PENDENTE" } }),
      (this.prisma as any).workflowRequest.count({ where: { ...orgScope, aprovadorAtualId: user.id, status: "PENDENTE" } }),
      (this.prisma as any).workflowRequest.count({ where: { ...orgScope, status: "APROVADA" } }),
      (this.prisma as any).workflowRequest.count({ where: { ...orgScope, status: "REJEITADA" } }),
    ]);
    return { minhasPendentes, aguardandoMinhaAprovacao: aguardando, aprovadas, rejeitadas };
  }
}

@Controller("workflows/requests")
@UseGuards(AuthGuard("jwt"))
export class WorkflowsController {
  constructor(private svc: WorkflowsService) {}

  @Get("stats")
  stats(@Req() req: any) {
    return this.svc.stats(req.user);
  }

  @Get()
  findAll(@Req() req: any,
    @Query("status") status?: string,
    @Query("tipo") tipo?: string,
    @Query("minhas") minhas?: string,
    @Query("aguardandoMinhaAprovacao") aguardando?: string,
  ) {
    return this.svc.findAll(req.user, {
      status, tipo,
      minhas: minhas === "true",
      aguardandoMinhaAprovacao: aguardando === "true",
    });
  }

  @Get(":id")
  findOne(@Req() req: any, @Param("id") id: string) {
    return this.svc.findOne(id, req.user);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateWfRequestDto) {
    return this.svc.create(dto, req.user);
  }

  @Patch(":id/aprovar")
  approve(@Req() req: any, @Param("id") id: string, @Body() dto: DecisionDto) {
    return this.svc.approve(id, dto, req.user);
  }

  @Patch(":id/rejeitar")
  reject(@Req() req: any, @Param("id") id: string, @Body() dto: RejectDto) {
    return this.svc.reject(id, dto, req.user);
  }

  @Patch(":id/cancelar")
  cancel(@Req() req: any, @Param("id") id: string) {
    return this.svc.cancel(id, req.user);
  }

  @Delete(":id")
  remove(@Req() req: any, @Param("id") id: string) {
    return this.svc.remove(id, req.user);
  }
}

@Module({
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
