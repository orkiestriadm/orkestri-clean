import { Module, Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Req, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsString, IsOptional, IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { WhatsAppService } from "../notifications/whatsapp.service";
import { EmailService } from "../notifications/email.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { SlaService } from "../sla/sla.module";
import { AutomacaoService } from "../automacoes/automacoes.module";
import { WebhookService } from "../automacoes/webhooks.module";

const SLA_HORAS: Record<string, number> = { baixa: 72, media: 24, alta: 8, critica: 2 };

class CreateChamadoDto {
  @IsString() titulo: string;
  @IsString() descricao: string;
  @IsOptional() @IsString() prioridade?: string;
  @IsOptional() @IsString() categoria?: string;
  @IsOptional() @IsString() tags?: string;
  @IsOptional() @IsString() clienteId?: string;
  @IsOptional() @IsString() atendenteId?: string;
}

class UpdateChamadoDto {
  @IsOptional() @IsString() titulo?: string;
  @IsOptional() @IsString() descricao?: string;
  @IsOptional() @IsString() prioridade?: string;
  @IsOptional() @IsString() categoria?: string;
  @IsOptional() @IsString() tags?: string;
  @IsOptional() @IsString() clienteId?: string;
  @IsOptional() @IsString() atendenteId?: string;
  @IsOptional() @IsString() status?: string;
}

class AddComentarioDto {
  @IsString() texto: string;
  @IsOptional() interno?: boolean;
}

class AvaliarDto {
  @IsInt() @Min(1) @Max(5) @Type(() => Number) avaliacao: number;
  @IsOptional() @IsString() avaliacaoNota?: string;
}

const STATUS_VALID = ["aberto", "em_atendimento", "aguardando", "resolvido", "fechado"];
const PRIORIDADE_VALID = ["baixa", "media", "alta", "critica"];

function mapChamado(c: any) {
  const now = new Date();
  const fechado = ["resolvido", "fechado"].includes(c.status);

  // Resolution SLA
  let slaDeadline: Date | null = c.slaResolucaoAt ? new Date(c.slaResolucaoAt)
    : c.slaHoras ? new Date(new Date(c.criadoEm).getTime() + c.slaHoras * 3600000)
    : null;
  let slaStatus = "ok";
  if (slaDeadline && !fechado) {
    if (now > slaDeadline) slaStatus = "violado";
    else if (now > new Date(slaDeadline.getTime() - 2 * 3600000)) slaStatus = "risco";
  }

  // Response SLA
  let slaRespostaStatus = "pendente";
  if (c.slaRespostaAt) {
    if (c.primeiraRespostaEm) {
      slaRespostaStatus = new Date(c.primeiraRespostaEm) <= new Date(c.slaRespostaAt) ? "cumprido" : "violado";
    } else if (now > new Date(c.slaRespostaAt)) {
      slaRespostaStatus = "violado";
    } else if (now > new Date(new Date(c.slaRespostaAt).getTime() - 3600000)) {
      slaRespostaStatus = "risco";
    } else {
      slaRespostaStatus = "ok";
    }
  }

  return {
    id: c.id, numero: c.numero, titulo: c.titulo, descricao: c.descricao,
    status: c.status, prioridade: c.prioridade, categoria: c.categoria, tags: c.tags,
    solicitanteId: c.solicitanteId, atendenteId: c.atendenteId, clienteId: c.clienteId,
    slaHoras: c.slaHoras, slaDeadline, slaStatus,
    slaRespostaAt: c.slaRespostaAt || null,
    slaResolucaoAt: c.slaResolucaoAt || null,
    primeiraRespostaEm: c.primeiraRespostaEm || null,
    slaRespostaStatus,
    avaliacao: c.avaliacao, avaliacaoNota: c.avaliacaoNota,
    resolvidoEm: c.resolvidoEm, fechadoEm: c.fechadoEm,
    criadoEm: c.criadoEm, atualizadoEm: c.atualizadoEm,
    solicitante: c.solicitante ? { id: c.solicitante.id, nome: c.solicitante.nome, email: c.solicitante.email, avatar: c.solicitante.avatar } : null,
    atendente: c.atendente ? { id: c.atendente.id, nome: c.atendente.nome, email: c.atendente.email, avatar: c.atendente.avatar } : null,
    cliente: c.cliente ? { id: c.cliente.id, nome: c.cliente.nome, empresa: c.cliente.empresa } : null,
    totalComentarios: c._count?.comentarios ?? c.comentarios?.length ?? 0,
    comentarios: c.comentarios?.map((cm: any) => ({
      id: cm.id, texto: cm.texto, interno: cm.interno, criadoEm: cm.criadoEm,
      user: { id: cm.user.id, nome: cm.user.nome, avatar: cm.user.avatar },
    })),
  };
}

const INCLUDE_LIST = {
  solicitante: { select: { id: true, nome: true, email: true, avatar: true } },
  atendente:   { select: { id: true, nome: true, email: true, avatar: true } },
  cliente:     { select: { id: true, nome: true, empresa: true } },
  _count:      { select: { comentarios: true } },
};
const INCLUDE_DETAIL = {
  ...INCLUDE_LIST,
  comentarios: {
    include: { user: { select: { id: true, nome: true, avatar: true } } },
    orderBy: { criadoEm: "asc" as const },
  },
};

@Controller("chamados")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class ChamadosController {
  constructor(
    private prisma: PrismaService,
    private wa: WhatsAppService,
    private email: EmailService,
    private config: ConfigService,
    private sla: SlaService,
    private automacao: AutomacaoService,
    private webhook: WebhookService,
  ) {}

  private get appUrl() { return this.config.get("APP_URL", "http://localhost"); }

  private async getUserPhone(userId: string): Promise<string | null> {
    const p = await this.prisma.userProfile.findUnique({ where: { userId } });
    return (p?.whatsapp && p?.whatsappAlertas) ? p.whatsapp : null;
  }

  private deadlineFor(criadoEm: Date, slaHoras: number | null): Date | null {
    if (!slaHoras) return null;
    return new Date(criadoEm.getTime() + slaHoras * 3600000);
  }

  @Get("stats")
  @Permissions("chamados:ver")
  async getStats(@Req() req: any) {
    const userId = req.user.id;
    const isMaster = req.user.isMaster;
    const orgId = req.user?.organizationId;
    const where: any = { ...(orgId ? { organizationId: orgId } : {}) };
    if (!isMaster) where.OR = [{ solicitanteId: userId }, { atendenteId: userId }];
    const [total, porStatus, porPrioridade, todos] = await Promise.all([
      this.prisma.chamado.count({ where }),
      this.prisma.chamado.groupBy({ by: ["status"], where, _count: true }),
      this.prisma.chamado.groupBy({ by: ["prioridade"], where, _count: true }),
      this.prisma.chamado.findMany({ where, select: { status: true, prioridade: true, slaHoras: true, criadoEm: true } }),
    ]);
    const now = new Date();
    let slaViolados = 0, slaEmRisco = 0;
    for (const c of todos) {
      if (["resolvido", "fechado"].includes(c.status)) continue;
      if (!c.slaHoras) continue;
      const deadline = new Date(c.criadoEm.getTime() + c.slaHoras * 3600000);
      if (now > deadline) slaViolados++;
      else if (now > new Date(deadline.getTime() - 7200000)) slaEmRisco++;
    }
    const byStatus = Object.fromEntries(porStatus.map(s => [s.status, s._count]));
    return {
      total,
      aberto:         byStatus["aberto"]         ?? 0,
      em_atendimento: byStatus["em_atendimento"] ?? 0,
      aguardando:     byStatus["aguardando"]     ?? 0,
      resolvido:      byStatus["resolvido"]      ?? 0,
      fechado:        byStatus["fechado"]        ?? 0,
      slaViolados, slaEmRisco,
      porPrioridade: Object.fromEntries(porPrioridade.map(p => [p.prioridade, p._count])),
    };
  }

  @Get()
  @Permissions("chamados:ver")
  async findAll(
    @Req() req: any,
    @Query("status") status?: string,
    @Query("prioridade") prioridade?: string,
    @Query("categoria") categoria?: string,
    @Query("atendenteId") atendenteId?: string,
    @Query("clienteId") clienteId?: string,
    @Query("q") q?: string,
  ) {
    const userId = req.user.id;
    const isMaster = req.user.isMaster;
    const orgId = req.user?.organizationId;
    const where: any = { ...(orgId ? { organizationId: orgId } as any : {}) };
    if (!isMaster) where.OR = [{ solicitanteId: userId }, { atendenteId: userId }];
    if (status) where.status = status;
    if (prioridade) where.prioridade = prioridade;
    if (categoria) where.categoria = categoria;
    if (atendenteId) where.atendenteId = atendenteId;
    if (clienteId) where.clienteId = clienteId;
    if (q) where.OR = [
      ...(where.OR || []),
      { titulo: { contains: q, mode: "insensitive" } },
      { descricao: { contains: q, mode: "insensitive" } },
    ];
    const chamados = await this.prisma.chamado.findMany({
      where, include: INCLUDE_LIST, orderBy: [{ prioridade: "asc" }, { criadoEm: "desc" }],
    });
    return chamados.map(c => mapChamado(c));
  }

  // ── Bulk actions ─────────────────────────────────────────────────────────────

  @Patch("bulk/status")
  @Permissions("chamados:editar")
  async bulkStatus(@Body() body: { ids: string[]; status: string }) {
    if (!body.ids?.length) throw new BadRequestException("Nenhum chamado selecionado");
    if (!STATUS_VALID.includes(body.status)) throw new BadRequestException("Status inválido");
    const data: any = { status: body.status };
    if (body.status === "resolvido") data.resolvidoEm = new Date();
    if (body.status === "fechado")   data.fechadoEm   = new Date();
    await (this.prisma as any).chamado.updateMany({ where: { id: { in: body.ids } }, data });
    return { updated: body.ids.length };
  }

  @Patch("bulk/atribuir")
  @Permissions("chamados:editar")
  async bulkAtribuir(@Body() body: { ids: string[]; atendenteId: string | null }) {
    if (!body.ids?.length) throw new BadRequestException("Nenhum chamado selecionado");
    await (this.prisma as any).chamado.updateMany({
      where: { id: { in: body.ids } },
      data: { atendenteId: body.atendenteId || null },
    });
    return { updated: body.ids.length };
  }

  @Get(":id")
  @Permissions("chamados:ver")
  async findOne(@Param("id") id: string, @Req() req: any) {
    const c = await this.prisma.chamado.findUnique({ where: { id }, include: INCLUDE_DETAIL });
    if (!c) throw new NotFoundException("Chamado nao encontrado");
    const userId = req.user.id;
    if (!req.user.isMaster && c.solicitanteId !== userId && c.atendenteId !== userId) {
      throw new ForbiddenException("Acesso negado");
    }
    return mapChamado(c);
  }

  @Post()
  @Permissions("chamados:criar")
  async create(@Body() dto: CreateChamadoDto, @Req() req: any) {
    if (!dto.titulo?.trim()) throw new BadRequestException("Titulo obrigatorio");
    if (!dto.descricao?.trim()) throw new BadRequestException("Descricao obrigatoria");
    const prioridade = PRIORIDADE_VALID.includes(dto.prioridade || "") ? dto.prioridade! : "media";
    const slaHoras = SLA_HORAS[prioridade];
    const orgId = req.user?.organizationId;
    const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "").trim();
    const chamado = await this.prisma.chamado.create({
      data: {
        titulo: stripHtml(dto.titulo),
        descricao: stripHtml(dto.descricao),
        prioridade,
        categoria: dto.categoria,
        tags: dto.tags,
        solicitanteId: req.user.id,
        atendenteId: dto.atendenteId || null,
        clienteId: dto.clienteId || null,
        status: dto.atendenteId ? "em_atendimento" : "aberto",
        slaHoras,
        ...(orgId ? { organizationId: orgId } : {}),
      } as any,
      include: INCLUDE_DETAIL,
    });
    // Apply SLA rule
    const regra = await this.sla.findRegra(prioridade, dto.categoria || null, orgId);
    if (regra) {
      const { slaRespostaAt, slaResolucaoAt } = this.sla.computeDeadlines(chamado.criadoEm, regra);
      await (this.prisma.chamado as any).update({
        where: { id: chamado.id },
        data: { slaRegraId: regra.id, slaRespostaAt, slaResolucaoAt },
      });
      (chamado as any).slaRegraId    = regra.id;
      (chamado as any).slaRespostaAt = slaRespostaAt;
      (chamado as any).slaResolucaoAt = slaResolucaoAt;
    }

    if (dto.atendenteId && dto.atendenteId !== req.user.id) {
      await this.notificarAtendente(dto.atendenteId, chamado, "atribuido");
      const atendente = await this.prisma.user.findUnique({ where: { id: dto.atendenteId }, select: { email: true, nome: true } });
      const phone = await this.getUserPhone(dto.atendenteId);
      if (phone) this.wa.sendChamadoAtribuido(phone, chamado.numero, chamado.titulo, chamado.prioridade, this.deadlineFor(chamado.criadoEm, chamado.slaHoras), this.appUrl).catch(() => {});
      if (atendente?.email) this.email.sendChamadoAtribuido(atendente.email, atendente.nome, chamado.numero, chamado.titulo, chamado.prioridade, chamado.solicitante?.nome || "").catch(() => {});
    }
    // Notifica solicitante da abertura
    const solicitante = await this.prisma.user.findUnique({ where: { id: chamado.solicitanteId }, select: { email: true, nome: true } });
    const solPhone = await this.getUserPhone(chamado.solicitanteId);
    if (solPhone) this.wa.sendChamadoAberto(solPhone, chamado.numero, chamado.titulo, chamado.prioridade, chamado.slaHoras, this.appUrl).catch(() => {});
    if (solicitante?.email) this.email.sendChamadoAberto(solicitante.email, solicitante.nome, chamado.numero, chamado.titulo, chamado.prioridade, chamado.slaHoras).catch(() => {});

    // Fire automations async (non-blocking)
    this.automacao.executar("chamado_criado", { id: chamado.id, numero: chamado.numero, titulo: chamado.titulo, prioridade, status: chamado.status, categoria: dto.categoria || null, solicitanteId: chamado.solicitanteId, atendenteId: chamado.atendenteId || null, clienteId: chamado.clienteId || null }).catch(() => {});
    this.webhook.fire("chamado.criado", { id: chamado.id, numero: chamado.numero, titulo: chamado.titulo, prioridade, status: chamado.status, clienteId: chamado.clienteId || null, criadoEm: chamado.criadoEm }).catch(() => {});

    return mapChamado(chamado);
  }

  @Put(":id")
  @Permissions("chamados:editar")
  async update(@Param("id") id: string, @Body() dto: UpdateChamadoDto, @Req() req: any) {
    const existing = await this.prisma.chamado.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Chamado nao encontrado");
    const canEdit = req.user.isMaster || existing.solicitanteId === req.user.id || existing.atendenteId === req.user.id;
    if (!canEdit) throw new ForbiddenException("Sem permissao para editar este chamado");
    if (dto.status && !STATUS_VALID.includes(dto.status)) throw new BadRequestException("Status invalido");
    const resolvidoEm = dto.status === "resolvido" && existing.status !== "resolvido" ? new Date() : undefined;
    const fechadoEm   = dto.status === "fechado"   && existing.status !== "fechado"   ? new Date() : undefined;
    const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "").trim();
    const updated = await this.prisma.chamado.update({
      where: { id },
      data: {
        ...(dto.titulo     && { titulo: stripHtml(dto.titulo) }),
        ...(dto.descricao  && { descricao: stripHtml(dto.descricao) }),
        ...(dto.prioridade && { prioridade: dto.prioridade, slaHoras: SLA_HORAS[dto.prioridade] }),
        ...(dto.categoria  !== undefined && { categoria: dto.categoria || null }),
        ...(dto.tags       !== undefined && { tags: dto.tags || null }),
        ...(dto.clienteId  !== undefined && { clienteId: dto.clienteId || null }),
        ...(dto.atendenteId !== undefined && { atendenteId: dto.atendenteId || null }),
        ...(dto.status     && { status: dto.status }),
        ...(resolvidoEm    && { resolvidoEm }),
        ...(fechadoEm      && { fechadoEm }),
      },
      include: INCLUDE_DETAIL,
    });
    // Recalculate SLA if priority changed
    if (dto.prioridade && dto.prioridade !== existing.prioridade) {
      const regra = await this.sla.findRegra(dto.prioridade, updated.categoria || null, req.user?.organizationId);
      if (regra) {
        const { slaRespostaAt, slaResolucaoAt } = this.sla.computeDeadlines(updated.criadoEm, regra);
        await (this.prisma.chamado as any).update({
          where: { id },
          data: { slaRegraId: regra.id, slaRespostaAt, slaResolucaoAt },
        });
      }
    }

    if (dto.atendenteId && dto.atendenteId !== existing.atendenteId && dto.atendenteId !== req.user.id) {
      await this.notificarAtendente(dto.atendenteId, updated, "atribuido");
      const atendente = await this.prisma.user.findUnique({ where: { id: dto.atendenteId }, select: { email: true, nome: true } });
      const phone = await this.getUserPhone(dto.atendenteId);
      if (phone) this.wa.sendChamadoAtribuido(phone, updated.numero, updated.titulo, updated.prioridade, this.deadlineFor(updated.criadoEm, updated.slaHoras), this.appUrl).catch(() => {});
      if (atendente?.email) this.email.sendChamadoAtribuido(atendente.email, atendente.nome, updated.numero, updated.titulo, updated.prioridade, updated.solicitante?.nome || "").catch(() => {});
    }
    if (dto.status && dto.status !== existing.status && existing.solicitanteId !== req.user.id) {
      await this.notificarSolicitante(existing.solicitanteId, updated, dto.status);
      const solicitante = await this.prisma.user.findUnique({ where: { id: existing.solicitanteId }, select: { email: true, nome: true } });
      const phone = await this.getUserPhone(existing.solicitanteId);
      if (phone) {
        if (dto.status === "resolvido") {
          this.wa.sendChamadoResolvido(phone, updated.numero, updated.titulo, this.appUrl).catch(() => {});
        } else {
          this.wa.sendChamadoStatus(phone, updated.numero, updated.titulo, dto.status, this.appUrl).catch(() => {});
        }
      }
      if (solicitante?.email) {
        if (dto.status === "resolvido") {
          this.email.sendChamadoResolvido(solicitante.email, solicitante.nome, updated.numero, updated.titulo).catch(() => {});
        } else {
          this.email.sendChamadoStatus(solicitante.email, solicitante.nome, updated.numero, updated.titulo, dto.status).catch(() => {});
        }
      }
    }
    if (dto.status && ["resolvido", "fechado"].includes(dto.status) && dto.status !== existing.status) {
      this.webhook.fire("chamado.resolvido", { id: updated.id, numero: updated.numero, titulo: updated.titulo, status: updated.status, clienteId: updated.clienteId || null, resolvidoEm: (updated as any).resolvidoEm || new Date() }).catch(() => {});
    }
    return mapChamado(updated);
  }

  @Patch(":id/status")
  @Permissions("chamados:editar")
  async changeStatus(@Param("id") id: string, @Body() body: { status: string }, @Req() req: any) {
    if (!STATUS_VALID.includes(body.status)) throw new BadRequestException("Status invalido");
    const existing = await this.prisma.chamado.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Chamado nao encontrado");
    const canEdit = req.user.isMaster || existing.solicitanteId === req.user.id || existing.atendenteId === req.user.id;
    if (!canEdit) throw new ForbiddenException("Sem permissao");
    const resolvidoEm = body.status === "resolvido" && existing.status !== "resolvido" ? new Date() : undefined;
    const fechadoEm   = body.status === "fechado"   && existing.status !== "fechado"   ? new Date() : undefined;
    const updated = await this.prisma.chamado.update({
      where: { id },
      data: { status: body.status, ...(resolvidoEm && { resolvidoEm }), ...(fechadoEm && { fechadoEm }) },
      include: INCLUDE_DETAIL,
    });
    if (existing.solicitanteId !== req.user.id) {
      await this.notificarSolicitante(existing.solicitanteId, updated, body.status);
      const solicitante = await this.prisma.user.findUnique({ where: { id: existing.solicitanteId }, select: { email: true, nome: true } });
      const phone = await this.getUserPhone(existing.solicitanteId);
      if (phone) {
        if (body.status === "resolvido") {
          this.wa.sendChamadoResolvido(phone, updated.numero, updated.titulo, this.appUrl).catch(() => {});
        } else {
          this.wa.sendChamadoStatus(phone, updated.numero, updated.titulo, body.status, this.appUrl).catch(() => {});
        }
      }
      if (solicitante?.email) {
        if (body.status === "resolvido") {
          this.email.sendChamadoResolvido(solicitante.email, solicitante.nome, updated.numero, updated.titulo).catch(() => {});
        } else {
          this.email.sendChamadoStatus(solicitante.email, solicitante.nome, updated.numero, updated.titulo, body.status).catch(() => {});
        }
      }
    }
    // Fire automations async
    this.automacao.executar("chamado_atualizado", { id: updated.id, numero: updated.numero, titulo: updated.titulo, prioridade: updated.prioridade, status: body.status, categoria: updated.categoria || null, solicitanteId: updated.solicitanteId, atendenteId: updated.atendenteId || null }).catch(() => {});
    if (["resolvido", "fechado"].includes(body.status) && body.status !== existing.status) {
      this.webhook.fire("chamado.resolvido", { id: updated.id, numero: updated.numero, titulo: updated.titulo, status: updated.status, clienteId: updated.clienteId || null, resolvidoEm: (updated as any).resolvidoEm || new Date() }).catch(() => {});
    }
    return mapChamado(updated);
  }

  @Patch(":id/atribuir")
  @Permissions("chamados:editar")
  async atribuir(@Param("id") id: string, @Body() body: { atendenteId: string | null }, @Req() req: any) {
    const existing = await this.prisma.chamado.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Chamado nao encontrado");
    if (!req.user.isMaster && existing.solicitanteId !== req.user.id) throw new ForbiddenException("Sem permissao");
    const updated = await this.prisma.chamado.update({
      where: { id },
      data: {
        atendenteId: body.atendenteId || null,
        status: body.atendenteId ? "em_atendimento" : "aberto",
      },
      include: INCLUDE_DETAIL,
    });
    if (body.atendenteId && body.atendenteId !== req.user.id) {
      await this.notificarAtendente(body.atendenteId, updated, "atribuido");
      const phone = await this.getUserPhone(body.atendenteId);
      if (phone) this.wa.sendChamadoAtribuido(phone, updated.numero, updated.titulo, updated.prioridade, this.deadlineFor(updated.criadoEm, updated.slaHoras), this.appUrl).catch(() => {});
    }
    return mapChamado(updated);
  }

  @Post(":id/comentarios")
  @Permissions("chamados:editar")
  async addComentario(@Param("id") id: string, @Body() dto: AddComentarioDto, @Req() req: any) {
    if (!dto.texto?.trim()) throw new BadRequestException("Texto obrigatorio");
    const chamado = await this.prisma.chamado.findUnique({ where: { id } });
    if (!chamado) throw new NotFoundException("Chamado nao encontrado");
    const canComment = req.user.isMaster || chamado.solicitanteId === req.user.id || chamado.atendenteId === req.user.id;
    if (!canComment) throw new ForbiddenException("Sem permissao");
    const comentario = await this.prisma.chamadoComentario.create({
      data: { chamadoId: id, userId: req.user.id, texto: dto.texto.trim(), interno: dto.interno ?? false },
      include: { user: { select: { id: true, nome: true, avatar: true } } },
    });
    // Track primeira resposta do atendente (SLA response time)
    if (!dto.interno && req.user.id === chamado.atendenteId) {
      const slaData = await (this.prisma as any).chamado.findUnique({ where: { id }, select: { primeiraRespostaEm: true } });
      if (!slaData?.primeiraRespostaEm) {
        await (this.prisma as any).chamado.update({ where: { id }, data: { primeiraRespostaEm: new Date() } });
      }
    }

    // Notifica a outra parte
    if (!dto.interno) {
      const notifyId = req.user.id === chamado.solicitanteId ? chamado.atendenteId : chamado.solicitanteId;
      if (notifyId && notifyId !== req.user.id) {
        const me = await this.prisma.user.findUnique({ where: { id: req.user.id }, select: { nome: true } });
        await this.prisma.notification.create({
          data: {
            userId: notifyId, tipo: "chamado_comentario",
            titulo: `Novo comentario no chamado #${chamado.numero}`,
            mensagem: `${me?.nome}: ${dto.texto.slice(0, 80)}`,
            referenciaTipo: "chamado", referenciaId: id,
          },
        });
      }
    }
    return {
      id: comentario.id, texto: comentario.texto, interno: comentario.interno,
      criadoEm: comentario.criadoEm,
      user: comentario.user,
    };
  }

  @Delete(":id/comentarios/:comentId")
  @Permissions("chamados:editar")
  async deleteComentario(@Param("id") id: string, @Param("comentId") comentId: string, @Req() req: any) {
    const coment = await this.prisma.chamadoComentario.findUnique({ where: { id: comentId } });
    if (!coment || coment.chamadoId !== id) throw new NotFoundException("Comentario nao encontrado");
    if (coment.userId !== req.user.id && !req.user.isMaster) throw new ForbiddenException("Sem permissao");
    await this.prisma.chamadoComentario.delete({ where: { id: comentId } });
    return { message: "Comentario removido" };
  }

  @Patch(":id/avaliar")
  @Permissions("chamados:editar")
  async avaliar(@Param("id") id: string, @Body() dto: AvaliarDto, @Req() req: any) {
    const chamado = await this.prisma.chamado.findUnique({ where: { id } });
    if (!chamado) throw new NotFoundException("Chamado nao encontrado");
    if (chamado.solicitanteId !== req.user.id) throw new ForbiddenException("Apenas o solicitante pode avaliar");
    if (!["resolvido", "fechado"].includes(chamado.status)) throw new BadRequestException("Chamado precisa estar resolvido para avaliar");
    const updated = await this.prisma.chamado.update({
      where: { id },
      data: { avaliacao: dto.avaliacao, avaliacaoNota: dto.avaliacaoNota, status: "fechado", fechadoEm: new Date() },
      include: INCLUDE_DETAIL,
    });
    return mapChamado(updated);
  }

  @Delete(":id")
  @Permissions("chamados:deletar")
  async remove(@Param("id") id: string, @Req() req: any) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters podem remover chamados");
    const chamado = await this.prisma.chamado.findUnique({ where: { id } });
    if (!chamado) throw new NotFoundException("Chamado nao encontrado");
    await this.prisma.chamado.delete({ where: { id } });
    return { message: "Chamado removido" };
  }

  private async notificarAtendente(atendenteId: string, chamado: any, tipo: string) {
    try {
      await this.prisma.notification.create({
        data: {
          userId: atendenteId, tipo: "chamado_atribuido",
          titulo: `Chamado #${chamado.numero} atribuido a voce`,
          mensagem: chamado.titulo,
          referenciaTipo: "chamado", referenciaId: chamado.id,
        },
      });
    } catch {}
  }

  private async notificarSolicitante(solicitanteId: string, chamado: any, status: string) {
    const labels: Record<string, string> = {
      em_atendimento: "em atendimento",
      aguardando: "aguardando sua resposta",
      resolvido: "marcado como resolvido",
      fechado: "fechado",
    };
    const label = labels[status];
    if (!label) return;
    try {
      await this.prisma.notification.create({
        data: {
          userId: solicitanteId, tipo: "chamado_status",
          titulo: `Chamado #${chamado.numero} ${label}`,
          mensagem: chamado.titulo,
          referenciaTipo: "chamado", referenciaId: chamado.id,
        },
      });
    } catch {}
  }
}

import { SlaModule } from "../sla/sla.module";
import { AutomacoesModule } from "../automacoes/automacoes.module";
import { WebhooksModule } from "../automacoes/webhooks.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports:     [SlaModule, AutomacoesModule, WebhooksModule, NotificationsModule],
  controllers: [ChamadosController],
  providers:   [WhatsAppService, EmailService],
})
export class ChamadosModule {}
