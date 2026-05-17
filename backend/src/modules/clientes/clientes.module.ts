import {
  Module, Controller, Get, Post, Put, Delete, Patch,
  Body, Param, Query, UseGuards, Req,
  NotFoundException, BadRequestException, ForbiddenException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsString, IsOptional, IsEmail, IsBoolean, IsNumber, IsDateString } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";

// ── DTOs ─────────────────────────────────────────────────────────────────────

class CreateClienteDto {
  @IsString() nome: string;
  @IsOptional() @IsString() empresa?: string;
  @IsOptional() @IsString() cargo?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsString() cnpj?: string;
  @IsOptional() @IsString() site?: string;
  @IsOptional() @IsString() cidade?: string;
  @IsOptional() @IsString() estado?: string;
  @IsOptional() @IsString() segmento?: string;
  @IsOptional() @IsString() origem?: string;
  @IsOptional() @IsString() statusLead?: string;
  @IsOptional() @IsString() notas?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
  @IsOptional() @IsString() responsavelId?: string;
}

class UpdateClienteDto {
  @IsOptional() @IsString() nome?: string;
  @IsOptional() @IsString() empresa?: string;
  @IsOptional() @IsString() cargo?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsString() cnpj?: string;
  @IsOptional() @IsString() site?: string;
  @IsOptional() @IsString() cidade?: string;
  @IsOptional() @IsString() estado?: string;
  @IsOptional() @IsString() segmento?: string;
  @IsOptional() @IsString() origem?: string;
  @IsOptional() @IsString() statusLead?: string;
  @IsOptional() @IsString() notas?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
  @IsOptional() @IsString() responsavelId?: string;
}

class CreateContratoDto {
  @IsOptional() @IsString() tipo?: string;
  @IsOptional() @IsString() plano?: string;
  @IsOptional() @IsNumber() slaHoras?: number;
  @IsOptional() @IsDateString() vigenciaInicio?: string;
  @IsOptional() @IsDateString() vigenciaFim?: string;
  @IsOptional() @IsNumber() valor?: number;
  @IsOptional() @IsBoolean() ativo?: boolean;
  @IsOptional() @IsString() observacoes?: string;
}

class UpdateContratoDto {
  @IsOptional() @IsString() tipo?: string;
  @IsOptional() @IsString() plano?: string;
  @IsOptional() @IsNumber() slaHoras?: number;
  @IsOptional() @IsDateString() vigenciaInicio?: string;
  @IsOptional() @IsDateString() vigenciaFim?: string;
  @IsOptional() @IsNumber() valor?: number;
  @IsOptional() @IsBoolean() ativo?: boolean;
  @IsOptional() @IsString() observacoes?: string;
}

class CreateTimelineNotaDto {
  @IsString() titulo: string;
  @IsOptional() @IsString() descricao?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapCliente(c: any, includeStats = false) {
  return {
    id: c.id,
    nome: c.nome,
    empresa: c.empresa,
    cargo: c.cargo,
    email: c.email,
    telefone: c.telefone,
    cnpj: c.cnpj,
    site: c.site,
    cidade: c.cidade,
    estado: c.estado,
    segmento: c.segmento,
    origem: c.origem,
    statusLead: c.statusLead,
    notas: c.notas,
    ativo: c.ativo ?? true,
    saudeScore: c.saudeScore ?? 100,
    responsavelId: c.responsavelId,
    responsavel: c.responsavel ? { id: c.responsavel.id, nome: c.responsavel.nome, avatar: c.responsavel.avatar } : null,
    criadoEm: c.criadoEm,
    atualizadoEm: c.atualizadoEm,
    ...(includeStats && {
      totalProjetos: c.projetos?.length ?? 0,
      projetosAtivos: c.projetos?.filter((p: any) => p.status === "EM_ANDAMENTO").length ?? 0,
      totalChamados: c.chamados?.length ?? 0,
      chamadosAbertos: c.chamados?.filter((ch: any) => ["aberto", "em_atendimento", "aguardando"].includes(ch.status)).length ?? 0,
      mrr: c.contratos?.filter((ct: any) => ct.ativo).reduce((s: number, ct: any) => s + (ct.valor || 0), 0) ?? 0,
    }),
  };
}

async function calcSaudeScore(prisma: PrismaService, clienteId: string): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // SLA (40 pts): chamados resolvidos nos últimos 30d
  const chamadosResolvidos = await prisma.chamado.findMany({
    where: { clienteId, status: { in: ["resolvido", "fechado"] }, atualizadoEm: { gte: thirtyDaysAgo } },
    select: { slaHoras: true, criadoEm: true, resolvidoEm: true },
  });
  let slaScore = 40;
  if (chamadosResolvidos.length > 0) {
    const dentroDoSla = chamadosResolvidos.filter(ch => {
      if (!ch.slaHoras || !ch.resolvidoEm) return true;
      const horas = (ch.resolvidoEm.getTime() - ch.criadoEm.getTime()) / 3_600_000;
      return horas <= ch.slaHoras;
    });
    slaScore = Math.round((dentroDoSla.length / chamadosResolvidos.length) * 40);
  }

  // Projetos no prazo (30 pts)
  const projetosAtivos = await prisma.project.findMany({
    where: { clienteId, status: "EM_ANDAMENTO" },
    select: { dataFim: true },
  });
  let prazoScore = 30;
  if (projetosAtivos.length > 0) {
    const noPrazo = projetosAtivos.filter(p => !p.dataFim || p.dataFim >= new Date());
    prazoScore = Math.round((noPrazo.length / projetosAtivos.length) * 30);
  }

  // Atividade recente (20 pts): qualquer evento na timeline nos últimos 30d
  const atividadeRecente = await (prisma as any).clienteTimeline.count({
    where: { clienteId, criadoEm: { gte: thirtyDaysAgo } },
  });
  const atividadeScore = atividadeRecente > 0 ? 20 : 0;

  // Avaliação chamados (10 pts)
  const avaliacoes = await prisma.chamado.findMany({
    where: { clienteId, avaliacao: { not: null }, atualizadoEm: { gte: thirtyDaysAgo } },
    select: { avaliacao: true },
  });
  let avaliacaoScore = 10;
  if (avaliacoes.length > 0) {
    const media = avaliacoes.reduce((s, a) => s + (a.avaliacao || 0), 0) / avaliacoes.length;
    avaliacaoScore = Math.round((media / 5) * 10);
  }

  return Math.min(100, slaScore + prazoScore + atividadeScore + avaliacaoScore);
}

async function addTimelineEvent(prisma: PrismaService, data: {
  clienteId: string; tipo: string; titulo: string;
  descricao?: string; referenciaTipo?: string; referenciaId?: string; userId?: string;
}) {
  try {
    await (prisma as any).clienteTimeline.create({
      data: { id: require("crypto").randomUUID(), ...data },
    });
  } catch {}
}

// ── Controller ────────────────────────────────────────────────────────────────

@Controller("clientes")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class ClientesController {
  constructor(private prisma: PrismaService) {}

  // ── CRUD básico ────────────────────────────────────────────────────────────

  @Get()
  @Permissions("crm:ver")
  async findAll(@Req() req: any, @Query("q") q?: string, @Query("status") status?: string) {
    const orgId = req.user?.organizationId;
    const clientes = await this.prisma.cliente.findMany({
      where: {
        ...(orgId ? { organizationId: orgId } as any : {}),
        ...(q ? {
          OR: [
            { nome: { contains: q, mode: "insensitive" } },
            { empresa: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        } : {}),
        ...(status === "ativo" ? { ativo: true } : status === "inativo" ? { ativo: false } : {}),
      },
      include: {
        projetos: { select: { id: true, status: true, valor: true, tipo: true } },
        chamados: { select: { id: true, status: true } },
        contratos: { select: { id: true, ativo: true, valor: true } },
        responsavel: { select: { id: true, nome: true, avatar: true } },
      },
      orderBy: { nome: "asc" },
    });
    return clientes.map(c => mapCliente(c, true));
  }

  @Get(":id")
  @Permissions("crm:ver")
  async findOne(@Param("id") id: string, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const c = await this.prisma.cliente.findFirst({
      where: { id, ...(orgId ? { organizationId: orgId } as any : {}) },
      include: {
        projetos: {
          include: { members: { include: { user: { select: { id: true, nome: true, avatar: true } } } } },
          orderBy: { criadoEm: "desc" },
        },
        chamados: { select: { id: true, status: true }, orderBy: { criadoEm: "desc" } },
        contratos: { where: { ativo: true }, orderBy: { criadoEm: "desc" } },
        responsavel: { select: { id: true, nome: true, avatar: true } },
      },
    });
    if (!c) throw new NotFoundException("Cliente não encontrado");
    return {
      ...mapCliente(c, true),
      projetos: c.projetos.map(p => ({
        id: p.id, titulo: p.titulo, tipo: p.tipo, status: p.status,
        prioridade: p.prioridade, valor: p.valor, dataFim: p.dataFim,
        progressoPct: p.progressoPct, cor: p.cor, criadoEm: p.criadoEm,
        membros: p.members.length,
      })),
    };
  }

  @Post()
  @Permissions("crm:criar")
  async create(@Body() dto: CreateClienteDto, @Req() req: any) {
    if (!dto.nome?.trim()) throw new BadRequestException("Nome obrigatório");
    const orgId = req.user?.organizationId;
    const { responsavelId, ...rest } = dto;
    const cliente = await this.prisma.cliente.create({
      data: {
        ...rest,
        ...(responsavelId ? { responsavelId } : {}),
        ...(orgId ? { organizationId: orgId } : {}),
      } as any,
    });
    return mapCliente(cliente);
  }

  @Put(":id")
  @Permissions("crm:editar")
  async update(@Param("id") id: string, @Body() dto: UpdateClienteDto, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const exists = await this.prisma.cliente.findFirst({ where: { id, ...(orgId ? { organizationId: orgId } as any : {}) } });
    if (!exists) throw new NotFoundException("Cliente não encontrado");
    const { responsavelId, ...rest } = dto;
    const updated = await this.prisma.cliente.update({
      where: { id },
      data: { ...rest, ...(responsavelId !== undefined ? { responsavelId } : {}) } as any,
      include: {
        projetos: { select: { id: true, status: true, valor: true, tipo: true } },
        chamados: { select: { id: true, status: true } },
        contratos: { select: { id: true, ativo: true, valor: true } },
        responsavel: { select: { id: true, nome: true, avatar: true } },
      },
    });
    // Timeline event for status changes
    if (dto.statusLead && dto.statusLead !== exists.statusLead) {
      await addTimelineEvent(this.prisma, {
        clienteId: id, tipo: "status_change",
        titulo: `Status alterado para "${dto.statusLead}"`,
        userId: req.user?.id,
      });
    }
    return mapCliente(updated, true);
  }

  // POST /clientes/importar — bulk import from CSV rows
  @Post("importar")
  @Permissions("crm:criar")
  async importar(@Body() body: { rows: any[] }, @Req() req: any) {
    const rows = body.rows || [];
    const criados: any[] = [];
    const erros: { linha: number; erro: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        if (!r.nome || !r.nome.trim()) throw new Error("nome obrigatório");
        const orgId2 = req.user?.organizationId;
        const cliente = await this.prisma.cliente.create({
          data: {
            id:           require("crypto").randomUUID(),
            nome:         r.nome.trim(),
            empresa:      r.empresa || null,
            email:        r.email || null,
            telefone:     r.telefone || null,
            cnpj:         r.cnpj || null,
            cidade:       r.cidade || null,
            estado:       r.estado || null,
            segmento:     r.segmento || null,
            origem:       r.origem || null,
            statusLead:   r.statusLead || "lead",
            ativo:        r.ativo === "false" || r.ativo === false ? false : true,
            criadoEm:     new Date(),
            atualizadoEm: new Date(),
            ...(orgId2 ? { organizationId: orgId2 } : {}),
          } as any,
        });
        criados.push(cliente);
      } catch (e: any) {
        erros.push({ linha: i + 1, erro: e.message });
      }
    }

    return { total: rows.length, criados: criados.length, erros };
  }

  @Delete(":id")
  @Permissions("crm:deletar")
  async remove(@Param("id") id: string, @Req() req: any) {
    if (!req.user?.isMaster) throw new ForbiddenException("Apenas masters podem remover clientes");
    const orgId = req.user?.organizationId;
    const exists = await this.prisma.cliente.findFirst({ where: { id, ...(orgId ? { organizationId: orgId } as any : {}) } });
    if (!exists) throw new NotFoundException("Cliente não encontrado");
    await this.prisma.project.updateMany({ where: { clienteId: id }, data: { clienteId: null } });
    await this.prisma.cliente.delete({ where: { id } });
    return { message: "Cliente removido" };
  }

  // ── Workspace ──────────────────────────────────────────────────────────────

  @Get(":id/workspace")
  @Permissions("crm:ver")
  async workspace(@Param("id") id: string) {
    const c = await this.prisma.cliente.findUnique({
      where: { id },
      include: {
        responsavel: { select: { id: true, nome: true, avatar: true } },
        contratos: { where: { ativo: true }, orderBy: { criadoEm: "desc" }, take: 1 },
      },
    });
    if (!c) throw new NotFoundException("Cliente não encontrado");

    const [projetos, chamadosAbertos, chamadosTotais, timeline, proximosMarcos] = await Promise.all([
      this.prisma.project.findMany({
        where: { clienteId: id },
        include: {
          members: { include: { user: { select: { id: true, nome: true, avatar: true } } } },
          _count: { select: { tasks: true } },
        },
        orderBy: { atualizadoEm: "desc" },
        take: 10,
      }),
      this.prisma.chamado.count({ where: { clienteId: id, status: { in: ["aberto", "em_atendimento", "aguardando"] } } }),
      this.prisma.chamado.count({ where: { clienteId: id } }),
      (this.prisma as any).clienteTimeline.findMany({
        where: { clienteId: id },
        include: { user: { select: { id: true, nome: true, avatar: true } } },
        orderBy: { criadoEm: "desc" },
        take: 10,
      }),
      this.prisma.milestone.findMany({
        where: { project: { clienteId: id }, concluido: false, dataAlvo: { gte: new Date() } },
        include: { project: { select: { id: true, titulo: true, cor: true } } },
        orderBy: { dataAlvo: "asc" },
        take: 5,
      }),
    ]);

    // SLA compliance (últimos 30d)
    const thirtyDays = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const chamadosResolvidos = await this.prisma.chamado.findMany({
      where: { clienteId: id, status: { in: ["resolvido", "fechado"] }, atualizadoEm: { gte: thirtyDays } },
      select: { slaHoras: true, criadoEm: true, resolvidoEm: true },
    });
    let slaCompliance = 100;
    if (chamadosResolvidos.length > 0) {
      const ok = chamadosResolvidos.filter(ch => {
        if (!ch.slaHoras || !ch.resolvidoEm) return true;
        return (ch.resolvidoEm.getTime() - ch.criadoEm.getTime()) / 3_600_000 <= ch.slaHoras;
      });
      slaCompliance = Math.round((ok.length / chamadosResolvidos.length) * 100);
    }

    // Recalcula e persiste health score
    const saudeScore = await calcSaudeScore(this.prisma, id);
    await this.prisma.cliente.update({ where: { id }, data: { saudeScore } as any });

    // Alertas
    const alertas: string[] = [];
    const chamadosSlaRisco = await this.prisma.chamado.findMany({
      where: { clienteId: id, status: { in: ["aberto", "em_atendimento"] } },
      select: { numero: true, titulo: true, slaHoras: true, criadoEm: true, prioridade: true },
    });
    for (const ch of chamadosSlaRisco) {
      if (!ch.slaHoras) continue;
      const horas = (Date.now() - ch.criadoEm.getTime()) / 3_600_000;
      if (horas >= ch.slaHoras * 0.8) alertas.push(`SLA em risco: Chamado #${ch.numero} — ${ch.titulo}`);
    }
    const projetosAtrasados = projetos.filter(p => p.dataFim && p.dataFim < new Date() && p.status === "EM_ANDAMENTO");
    for (const p of projetosAtrasados) alertas.push(`Projeto atrasado: ${p.titulo}`);

    const mrr = c.contratos.reduce((s, ct) => s + (ct.valor || 0), 0);

    return {
      cliente: {
        ...mapCliente(c, false),
        saudeScore,
        contratos: c.contratos,
      },
      stats: {
        projetosAtivos: projetos.filter(p => p.status === "EM_ANDAMENTO").length,
        projetosTotal: projetos.length,
        chamadosAbertos,
        chamadosTotais,
        slaCompliance,
        mrr,
      },
      projetos: projetos.map(p => ({
        id: p.id, titulo: p.titulo, tipo: p.tipo, status: p.status,
        prioridade: p.prioridade, valor: p.valor, dataFim: p.dataFim,
        progressoPct: p.progressoPct, cor: p.cor, criadoEm: p.criadoEm, atualizadoEm: p.atualizadoEm,
        membros: p.members.map(m => ({ id: m.user.id, nome: m.user.nome, avatar: m.user.avatar })),
        totalTasks: (p as any)._count?.tasks ?? 0,
      })),
      chamadosRecentes: await this.prisma.chamado.findMany({
        where: { clienteId: id },
        select: {
          id: true, numero: true, titulo: true, status: true, prioridade: true,
          slaHoras: true, criadoEm: true, resolvidoEm: true,
          atendente: { select: { id: true, nome: true, avatar: true } },
        },
        orderBy: { criadoEm: "desc" },
        take: 8,
      }),
      proximosMarcos,
      alertas,
      timeline,
    };
  }

  // ── Timeline ───────────────────────────────────────────────────────────────

  @Get(":id/timeline")
  @Permissions("crm:ver")
  async getTimeline(@Param("id") id: string, @Query("page") page = "1") {
    const skip = (parseInt(page) - 1) * 20;
    const [items, total] = await Promise.all([
      (this.prisma as any).clienteTimeline.findMany({
        where: { clienteId: id },
        include: { user: { select: { id: true, nome: true, avatar: true } } },
        orderBy: { criadoEm: "desc" },
        skip,
        take: 20,
      }),
      (this.prisma as any).clienteTimeline.count({ where: { clienteId: id } }),
    ]);
    return { items, total, page: parseInt(page) };
  }

  @Post(":id/timeline/nota")
  @Permissions("crm:editar")
  async addNota(@Param("id") id: string, @Body() dto: CreateTimelineNotaDto, @Req() req: any) {
    const c = await this.prisma.cliente.findUnique({ where: { id } });
    if (!c) throw new NotFoundException("Cliente não encontrado");
    const evento = await (this.prisma as any).clienteTimeline.create({
      data: {
        id: require("crypto").randomUUID(),
        clienteId: id,
        tipo: "nota",
        titulo: dto.titulo,
        descricao: dto.descricao || null,
        userId: req.user?.id || null,
      },
      include: { user: { select: { id: true, nome: true, avatar: true } } },
    });
    return evento;
  }

  // ── Contratos ──────────────────────────────────────────────────────────────

  @Get(":id/contratos")
  @Permissions("crm:ver")
  async getContratos(@Param("id") id: string) {
    return (this.prisma as any).contrato.findMany({
      where: { clienteId: id },
      orderBy: { criadoEm: "desc" },
    });
  }

  @Post(":id/contratos")
  @Permissions("crm:criar")
  async createContrato(@Param("id") id: string, @Body() dto: CreateContratoDto, @Req() req: any) {
    const c = await this.prisma.cliente.findUnique({ where: { id } });
    if (!c) throw new NotFoundException("Cliente não encontrado");
    const contrato = await (this.prisma as any).contrato.create({
      data: { id: require("crypto").randomUUID(), clienteId: id, ...dto },
    });
    await addTimelineEvent(this.prisma, {
      clienteId: id, tipo: "contrato",
      titulo: `Contrato "${dto.plano || dto.tipo || "serviço"}" adicionado`,
      referenciaTipo: "contrato", referenciaId: contrato.id,
      userId: req.user?.id,
    });
    return contrato;
  }

  @Put(":clienteId/contratos/:contratoId")
  @Permissions("crm:editar")
  async updateContrato(
    @Param("clienteId") clienteId: string,
    @Param("contratoId") contratoId: string,
    @Body() dto: UpdateContratoDto,
  ) {
    const exists = await (this.prisma as any).contrato.findFirst({ where: { id: contratoId, clienteId } });
    if (!exists) throw new NotFoundException("Contrato não encontrado");
    return (this.prisma as any).contrato.update({ where: { id: contratoId }, data: dto });
  }
}

// ── Module ────────────────────────────────────────────────────────────────────

@Module({ controllers: [ClientesController] })
export class ClientesModule {}
