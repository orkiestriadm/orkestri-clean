import {
  Module, Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, Req, BadRequestException, NotFoundException, Injectable,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Permissions } from "../auth/permissions.decorator";

class CreateSkillDto {
  nome: string;
  categoria?: string;
  descricao?: string;
  cor?: string;
}
class UpdateSkillDto {
  nome?: string;
  categoria?: string | null;
  descricao?: string | null;
  cor?: string | null;
  ativo?: boolean;
}
class AssignSkillDto {
  skillId: string;
  nivel?: string; // junior|pleno|senior|especialista
  certificadoEm?: string;
  validade?: string;
  observacoes?: string;
}

@Injectable()
export class SkillsService {
  constructor(private prisma: PrismaService) {}

  private orgScope(user: any) {
    return user?.organizationId ? { organizationId: user.organizationId } : {};
  }

  // ── Catálogo de Skills ─────────────────────────────────────────────────────
  async findAll(user: any, categoria?: string) {
    const where: any = { ...this.orgScope(user) };
    if (categoria) where.categoria = categoria;
    return (this.prisma as any).skill.findMany({
      where,
      include: { _count: { select: { collaborators: true } } },
      orderBy: [{ categoria: "asc" }, { nome: "asc" }],
    });
  }

  async findOne(id: string, user: any) {
    const s = await (this.prisma as any).skill.findFirst({
      where: { id, ...this.orgScope(user) },
      include: {
        collaborators: {
          include: { collaborator: { include: { user: { select: { id: true, nome: true, email: true } } } } },
        },
      },
    });
    if (!s) throw new NotFoundException("Skill não encontrada");
    return s;
  }

  async create(dto: CreateSkillDto, user: any) {
    if (!dto.nome?.trim()) throw new BadRequestException("Nome obrigatório");
    const orgId = user.organizationId;
    const exists = await (this.prisma as any).skill.findFirst({
      where: { organizationId: orgId, nome: dto.nome.trim() },
    });
    if (exists) throw new BadRequestException("Skill com este nome já existe");
    return (this.prisma as any).skill.create({
      data: {
        organizationId: orgId,
        nome: dto.nome.trim(),
        categoria: dto.categoria?.trim() || null,
        descricao: dto.descricao?.trim() || null,
        cor: dto.cor || null,
      },
    });
  }

  async update(id: string, dto: UpdateSkillDto, user: any) {
    await this.findOne(id, user);
    if (dto.nome) {
      const dup = await (this.prisma as any).skill.findFirst({
        where: { organizationId: user.organizationId, nome: dto.nome.trim(), NOT: { id } },
      });
      if (dup) throw new BadRequestException("Nome já em uso");
    }
    return (this.prisma as any).skill.update({
      where: { id },
      data: {
        ...(dto.nome !== undefined ? { nome: dto.nome.trim() } : {}),
        ...(dto.categoria !== undefined ? { categoria: dto.categoria?.trim() || null } : {}),
        ...(dto.descricao !== undefined ? { descricao: dto.descricao?.trim() || null } : {}),
        ...(dto.cor !== undefined ? { cor: dto.cor || null } : {}),
        ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
      },
    });
  }

  async remove(id: string, user: any) {
    await this.findOne(id, user);
    return (this.prisma as any).skill.delete({ where: { id } });
  }

  // ── Skills do Colaborador ──────────────────────────────────────────────────
  async listForCollaborator(collaboratorId: string, user: any) {
    const c = await (this.prisma as any).collaborator.findFirst({
      where: { id: collaboratorId, ...this.orgScope(user) },
    });
    if (!c) throw new NotFoundException("Colaborador não encontrado");
    return (this.prisma as any).collaboratorSkill.findMany({
      where: { collaboratorId },
      include: { skill: true },
      orderBy: { criadoEm: "desc" },
    });
  }

  async assign(collaboratorId: string, dto: AssignSkillDto, user: any) {
    const c = await (this.prisma as any).collaborator.findFirst({
      where: { id: collaboratorId, ...this.orgScope(user) },
    });
    if (!c) throw new NotFoundException("Colaborador não encontrado");
    const skill = await (this.prisma as any).skill.findFirst({
      where: { id: dto.skillId, ...this.orgScope(user) },
    });
    if (!skill) throw new BadRequestException("Skill inválida");
    const dup = await (this.prisma as any).collaboratorSkill.findUnique({
      where: { collaboratorId_skillId: { collaboratorId, skillId: dto.skillId } },
    });
    if (dup) throw new BadRequestException("Colaborador já possui esta skill");
    return (this.prisma as any).collaboratorSkill.create({
      data: {
        collaboratorId,
        skillId: dto.skillId,
        nivel: dto.nivel || "pleno",
        certificadoEm: dto.certificadoEm ? new Date(dto.certificadoEm) : null,
        validade: dto.validade ? new Date(dto.validade) : null,
        observacoes: dto.observacoes?.trim() || null,
      },
      include: { skill: true },
    });
  }

  async updateAssignment(collaboratorId: string, assignmentId: string, dto: Partial<AssignSkillDto>, user: any) {
    const c = await (this.prisma as any).collaborator.findFirst({
      where: { id: collaboratorId, ...this.orgScope(user) },
    });
    if (!c) throw new NotFoundException("Colaborador não encontrado");
    const a = await (this.prisma as any).collaboratorSkill.findFirst({
      where: { id: assignmentId, collaboratorId },
    });
    if (!a) throw new NotFoundException("Atribuição não encontrada");
    return (this.prisma as any).collaboratorSkill.update({
      where: { id: assignmentId },
      data: {
        ...(dto.nivel !== undefined ? { nivel: dto.nivel } : {}),
        ...(dto.certificadoEm !== undefined ? { certificadoEm: dto.certificadoEm ? new Date(dto.certificadoEm) : null } : {}),
        ...(dto.validade !== undefined ? { validade: dto.validade ? new Date(dto.validade) : null } : {}),
        ...(dto.observacoes !== undefined ? { observacoes: dto.observacoes?.trim() || null } : {}),
      },
      include: { skill: true },
    });
  }

  async unassign(collaboratorId: string, assignmentId: string, user: any) {
    const c = await (this.prisma as any).collaborator.findFirst({
      where: { id: collaboratorId, ...this.orgScope(user) },
    });
    if (!c) throw new NotFoundException("Colaborador não encontrado");
    return (this.prisma as any).collaboratorSkill.delete({ where: { id: assignmentId } });
  }

  // ── Smart Suggest ──────────────────────────────────────────────────────────
  // NIVEL_RANK: nível >= que o requerido qualifica
  private rankNivel(n?: string | null) {
    const map: Record<string, number> = { junior: 1, pleno: 2, senior: 3, especialista: 4 };
    return map[(n || "").toLowerCase()] || 0;
  }

  async suggest(user: any, skillId?: string, nivelMinimo?: string, limit = 5) {
    const orgScope = this.orgScope(user);
    // 1. Candidatos ativos
    const collabsWhere: any = { ...orgScope, ativo: true };
    if (skillId) {
      collabsWhere.collabSkills = { some: { skillId } };
    }
    const collabs = await (this.prisma as any).collaborator.findMany({
      where: collabsWhere,
      include: {
        user:  { select: { id: true, nome: true, email: true, avatar: true } },
        setor: { select: { id: true, nome: true, cor: true } },
        collabSkills: { where: skillId ? { skillId } : {}, include: { skill: { select: { id: true, nome: true } } } },
      },
    });

    // 2. Filtrar por nível mínimo se especificado
    const minRank = this.rankNivel(nivelMinimo);
    const filtered = skillId && minRank > 0
      ? collabs.filter((c: any) => c.collabSkills.some((cs: any) => this.rankNivel(cs.nivel) >= minRank))
      : collabs;

    if (filtered.length === 0) return [];

    // 3. Calcular carga atual de cada candidato
    const userIds = filtered.map((c: any) => c.userId);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Chamados abertos atribuídos
    const chamadosAtivos = await (this.prisma as any).chamado.groupBy({
      by: ["atendenteId"],
      where: {
        ...orgScope,
        status: { notIn: ["fechado", "cancelado"] },
        atendenteId: { in: userIds },
      },
      _count: { id: true },
      _sum: { horasEstimadas: true, slaHoras: true },
    });
    const cargaPorUser = new Map<string, { tickets: number; horas: number }>();
    chamadosAtivos.forEach((c: any) => {
      cargaPorUser.set(c.atendenteId, {
        tickets: c._count.id,
        horas: (c._sum.horasEstimadas || 0) + (c._sum.slaHoras || 0) * 0.1, // peso menor pro SLA
      });
    });

    // 4. Score: priorizar quem está disponível + tem nível mais alto
    const scored = filtered.map((c: any) => {
      const jornadaMes = (c.jornadaHorasDia || 8) * 22;
      const carga = cargaPorUser.get(c.userId) || { tickets: 0, horas: 0 };
      const utilizacao = jornadaMes > 0 ? (carga.horas / jornadaMes * 100) : 0;
      const skillMatch = c.collabSkills[0]?.nivel || null;
      const skillRank = this.rankNivel(skillMatch);

      // Score: disponibilidade (50%) + skill level (30%) + senioridade (20%)
      const dispScore = Math.max(0, 100 - utilizacao);
      const senRank = this.rankNivel(c.senioridade);
      const score = (dispScore * 0.5) + (skillRank * 25 * 0.3) + (senRank * 25 * 0.2);

      return {
        collaborator: {
          id: c.id,
          userId: c.userId,
          nome: c.user.nome,
          email: c.user.email,
          avatar: c.user.avatar,
          cargo: c.cargo,
          setor: c.setor,
          senioridade: c.senioridade,
        },
        skillMatch: skillMatch ? { nivel: skillMatch, skillNome: c.collabSkills[0]?.skill?.nome } : null,
        carga: {
          ticketsAbertos: carga.tickets,
          horasAlocadas: Number(carga.horas.toFixed(2)),
          jornadaMes: Number(jornadaMes.toFixed(2)),
          utilizacao: Number(utilizacao.toFixed(1)),
        },
        score: Number(score.toFixed(2)),
        motivo: this.explainScore(skillMatch, utilizacao, c.senioridade),
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  private explainScore(nivel: string | null, util: number, senioridade: string | null): string {
    const parts: string[] = [];
    if (nivel) parts.push(`Skill nível ${nivel}`);
    if (util < 50) parts.push("baixa carga");
    else if (util < 80) parts.push("carga moderada");
    else parts.push("alta carga");
    if (senioridade) parts.push(`${senioridade}`);
    return parts.join(" • ");
  }
}

// ─── Controllers ─────────────────────────────────────────────────────────────

@Controller("skills")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class SkillsController {
  constructor(private svc: SkillsService) {}

  @Get()
  @Permissions("colaboradores:ver")
  findAll(@Req() req: any, @Query("categoria") categoria?: string) {
    return this.svc.findAll(req.user, categoria);
  }

  @Get("suggest")
  @Permissions("colaboradores:ver")
  suggest(@Req() req: any, @Query("skillId") skillId?: string, @Query("nivelMinimo") nivelMinimo?: string, @Query("limit") limit?: string) {
    return this.svc.suggest(req.user, skillId, nivelMinimo, limit ? parseInt(limit, 10) : 5);
  }

  @Get(":id")
  @Permissions("colaboradores:ver")
  findOne(@Req() req: any, @Param("id") id: string) {
    return this.svc.findOne(id, req.user);
  }

  @Post()
  @Permissions("colaboradores:criar")
  create(@Req() req: any, @Body() dto: CreateSkillDto) {
    return this.svc.create(dto, req.user);
  }

  @Put(":id")
  @Permissions("colaboradores:editar")
  update(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateSkillDto) {
    return this.svc.update(id, dto, req.user);
  }

  @Delete(":id")
  @Permissions("colaboradores:excluir")
  remove(@Req() req: any, @Param("id") id: string) {
    return this.svc.remove(id, req.user);
  }
}

@Controller("collaborators/:collabId/skills")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class CollabSkillsController {
  constructor(private svc: SkillsService) {}

  @Get()
  @Permissions("colaboradores:ver")
  list(@Req() req: any, @Param("collabId") collabId: string) {
    return this.svc.listForCollaborator(collabId, req.user);
  }

  @Post()
  @Permissions("colaboradores:editar")
  assign(@Req() req: any, @Param("collabId") collabId: string, @Body() dto: AssignSkillDto) {
    return this.svc.assign(collabId, dto, req.user);
  }

  @Put(":assignmentId")
  @Permissions("colaboradores:editar")
  updateAssign(@Req() req: any, @Param("collabId") collabId: string, @Param("assignmentId") aid: string, @Body() dto: Partial<AssignSkillDto>) {
    return this.svc.updateAssignment(collabId, aid, dto, req.user);
  }

  @Delete(":assignmentId")
  @Permissions("colaboradores:editar")
  unassign(@Req() req: any, @Param("collabId") collabId: string, @Param("assignmentId") aid: string) {
    return this.svc.unassign(collabId, aid, req.user);
  }
}

@Module({
  controllers: [SkillsController, CollabSkillsController],
  providers: [SkillsService],
  exports: [SkillsService],
})
export class SkillsModule {}
