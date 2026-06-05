import {
  Module, Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards, Req, Logger,
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { WhatsAppService } from "../notifications/whatsapp.service";
import { NotificationsModule } from "../notifications/notifications.module";
import * as crypto from "crypto";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CondicaoItem { campo: string; operador: string; valor?: any; }
interface CondicaoGrupo { itens: CondicaoItem[]; }
interface CondicoesConfig { grupos: CondicaoGrupo[]; }
interface Acao { tipo: string; [key: string]: any; }

const TRIGGERS_VALIDOS = [
  "chamado_criado", "chamado_atualizado", "chamado_resolvido", "chamado_fechado",
  "contrato_vencendo", "contrato_vencido", "ativo_garantia_vencendo",
];

const PRIORIDADE_TO_ENUM: Record<string, string> = {
  baixa: "BAIXA", media: "MEDIA", alta: "ALTA", critica: "URGENTE",
};

// ── AutomacaoService (exported for use in ChamadosModule and others) ──────────
@Injectable()
export class AutomacaoService {
  private readonly logger = new Logger(AutomacaoService.name);
  constructor(
    private prisma: PrismaService,
    private wa: WhatsAppService,
  ) {}
  private get db() { return this.prisma as any; }

  /** Called by ChamadosModule/ContratosModule after relevant events */
  async executar(trigger: string, context: Record<string, any>): Promise<void> {
    try {
      const where: any = { trigger, ativo: true };
      if (context.organizationId) where.organizationId = context.organizationId;

      const automacoes = await this.db.automacao.findMany({ where });
      for (const auto of automacoes) {
        try {
          if (!this.avaliarCondicoes(auto.condicoes, context)) continue;

          const acoes = (auto.acoes as Acao[]) || [];
          const resultados: any[] = [];
          for (const acao of acoes) {
            const r = await this.executarAcao(acao, context);
            resultados.push(r);
          }

          await this.db.automacaoExecucao.create({
            data: {
              id:          crypto.randomUUID(),
              automacaoId: auto.id,
              trigger,
              contextId:   context.id || "unknown",
              resultado:   "sucesso",
              detalhes:    { acoes: resultados },
            },
          });
          await this.db.automacao.update({
            where: { id: auto.id },
            data: { totalExecucoes: { increment: 1 }, ultimaExecucao: new Date() },
          });
        } catch (err: any) {
          this.logger.warn(`Automacao ${auto.id} falhou no trigger ${trigger}: ${err?.message}`);
          await this.db.automacaoExecucao.create({
            data: {
              id: crypto.randomUUID(),
              automacaoId: auto.id,
              trigger,
              contextId: context.id || "unknown",
              resultado: "erro",
              detalhes: { erro: err?.message },
            },
          }).catch(() => {});
        }
      }
    } catch (err: any) {
      this.logger.error(`executar(${trigger}) crash: ${err?.message}`);
    }
  }

  // ── Condition evaluation ────────────────────────────────────────────────────

  avaliarCondicoes(condicoes: any, ctx: Record<string, any>): boolean {
    // New format: {grupos: [{itens: [...]}]} — groups combine with OR
    if (condicoes && !Array.isArray(condicoes) && condicoes.grupos) {
      const grupos = (condicoes as CondicoesConfig).grupos;
      if (grupos.length === 0) return true;
      return grupos.some(g => g.itens.length === 0 || g.itens.every(c => this.avaliarCondicao(c, ctx)));
    }
    // Old format: flat array — all AND
    const itens: CondicaoItem[] = Array.isArray(condicoes) ? condicoes : [];
    if (itens.length === 0) return true;
    return itens.every(c => this.avaliarCondicao(c, ctx));
  }

  private avaliarCondicao(c: CondicaoItem, ctx: Record<string, any>): boolean {
    const val = ctx[c.campo];
    const cval = c.valor;
    switch (c.operador) {
      case "eq":          return val === cval;
      case "neq":         return val !== cval;
      case "in":          return Array.isArray(cval) && cval.includes(val);
      case "nin":         return Array.isArray(cval) && !cval.includes(val);
      case "empty":       return val === null || val === undefined || val === "";
      case "notempty":    return val !== null && val !== undefined && val !== "";
      case "contains":    return typeof val === "string" && val.toLowerCase().includes(String(cval).toLowerCase());
      case "starts_with": return typeof val === "string" && val.toLowerCase().startsWith(String(cval).toLowerCase());
      case "ends_with":   return typeof val === "string" && val.toLowerCase().endsWith(String(cval).toLowerCase());
      case "gt":          return Number(val) > Number(cval);
      case "lt":          return Number(val) < Number(cval);
      case "gte":         return Number(val) >= Number(cval);
      case "lte":         return Number(val) <= Number(cval);
      default:            return false;
    }
  }

  // ── Action execution ────────────────────────────────────────────────────────

  private async executarAcao(acao: Acao, ctx: Record<string, any>): Promise<any> {
    const chamadoId = ctx.id;

    switch (acao.tipo) {
      // ── Chamado mutations ────────────────────────────────────────────────────
      case "atribuir_atendente":
        if (chamadoId && acao.atendenteId) {
          await this.db.chamado.update({
            where: { id: chamadoId },
            data: { atendenteId: acao.atendenteId, status: "em_atendimento" },
          });
          return { acao: "atribuir_atendente", atendenteId: acao.atendenteId };
        }
        break;

      case "mudar_status":
        if (chamadoId && acao.status) {
          const data: any = { status: acao.status };
          if (acao.status === "resolvido") data.resolvidoEm = new Date();
          if (acao.status === "fechado")   data.fechadoEm   = new Date();
          await this.db.chamado.update({ where: { id: chamadoId }, data });
          return { acao: "mudar_status", status: acao.status };
        }
        break;

      case "mudar_prioridade":
        if (chamadoId && acao.prioridade) {
          await this.db.chamado.update({ where: { id: chamadoId }, data: { prioridade: acao.prioridade } });
          return { acao: "mudar_prioridade", prioridade: acao.prioridade };
        }
        break;

      case "escalar_chamado": {
        const novaPrioridade = acao.prioridade || "critica";
        if (chamadoId) {
          await this.db.chamado.update({ where: { id: chamadoId }, data: { prioridade: novaPrioridade } });
          if (acao.notificar !== false) {
            const titulo   = await this.interpolate(`Chamado escalado: {{titulo}} (#{{numero}})`, ctx);
            const mensagem = await this.interpolate(`Prioridade alterada para ${novaPrioridade}`, ctx);
            const masters = await this.db.userRole.findMany({
              where: { role: { isMaster: true } }, select: { userId: true },
            });
            for (const m of masters) {
              await this.db.notification.create({
                data: { id: crypto.randomUUID(), userId: m.userId, tipo: "automacao", titulo, mensagem, referenciaTipo: "chamado", referenciaId: chamadoId },
              }).catch(() => {});
            }
          }
          return { acao: "escalar_chamado", prioridade: novaPrioridade };
        }
        break;
      }

      case "adicionar_tag":
        if (chamadoId && acao.tag) {
          const c = await this.db.chamado.findUnique({ where: { id: chamadoId }, select: { tags: true } });
          if (c) {
            const existing = (c.tags || "").split(",").map((t: string) => t.trim()).filter(Boolean);
            if (!existing.includes(acao.tag)) {
              await this.db.chamado.update({ where: { id: chamadoId }, data: { tags: [...existing, acao.tag].join(",") } });
            }
          }
          return { acao: "adicionar_tag", tag: acao.tag };
        }
        break;

      case "remover_tag":
        if (chamadoId && acao.tag) {
          const c = await this.db.chamado.findUnique({ where: { id: chamadoId }, select: { tags: true } });
          if (c) {
            const updated = (c.tags || "").split(",").map((t: string) => t.trim()).filter((t: string) => t && t !== acao.tag);
            await this.db.chamado.update({ where: { id: chamadoId }, data: { tags: updated.join(",") || null } });
          }
          return { acao: "remover_tag", tag: acao.tag };
        }
        break;

      case "adicionar_comentario": {
        const texto = await this.interpolate(acao.texto || "", ctx);
        if (chamadoId && texto) {
          // Use solicitante or a master as author of the automated comment
          let userId = ctx.solicitanteId;
          if (!userId && ctx.organizationId) {
            const role = await this.db.userRole.findFirst({
              where: { role: { isMaster: true }, user: { organizationId: ctx.organizationId } },
              select: { userId: true },
            });
            userId = role?.userId;
          }
          if (userId) {
            await this.db.chamadoComentario.create({
              data: { id: crypto.randomUUID(), chamadoId, userId, texto, interno: acao.interno !== false },
            });
          }
          return { acao: "adicionar_comentario", interno: acao.interno !== false };
        }
        break;
      }

      // ── Notification / messaging ─────────────────────────────────────────────
      case "criar_notificacao": {
        const titulo   = await this.interpolate(acao.titulo   || "Automação executada", ctx);
        const mensagem = await this.interpolate(acao.mensagem || "", ctx);
        const targets  = await this.resolveTargets(acao, ctx);
        for (const userId of targets) {
          await this.db.notification.create({
            data: {
              id: crypto.randomUUID(), userId, tipo: "automacao",
              titulo, mensagem, referenciaTipo: "chamado", referenciaId: chamadoId,
            },
          }).catch(() => {});
        }
        return { acao: "criar_notificacao", targets: targets.length };
      }

      case "enviar_whatsapp": {
        const mensagem = await this.interpolate(acao.mensagem || "", ctx);
        if (!mensagem || !ctx.organizationId) break;
        const targets = await this.resolveTargets(acao, ctx);
        let sent = 0;
        for (const userId of targets) {
          const profile = await this.db.userProfile.findUnique({ where: { userId } });
          if (profile?.whatsapp && profile.whatsappAlertas) {
            const ok = await this.wa.sendMessageForOrg(ctx.organizationId, profile.whatsapp, mensagem).catch(() => false);
            if (ok) sent++;
          }
        }
        return { acao: "enviar_whatsapp", targets: targets.length, enviados: sent };
      }

      // ── Task creation ────────────────────────────────────────────────────────
      case "criar_tarefa": {
        if (!acao.projectId || !acao.titulo) break;
        const criadoPorId = ctx.atendenteId || ctx.solicitanteId;
        if (!criadoPorId) break;
        const titulo    = await this.interpolate(acao.titulo, ctx);
        const descricao = acao.descricao ? await this.interpolate(acao.descricao, ctx) : null;
        const prioMap   = PRIORIDADE_TO_ENUM[ctx.prioridade || ""] || "MEDIA";
        const task = await this.db.task.create({
          data: {
            id:          crypto.randomUUID(),
            projectId:   acao.projectId,
            assigneeId:  acao.assigneeId || ctx.atendenteId || null,
            criadoPorId,
            titulo,
            descricao,
            status:      "A_FAZER",
            priority:    acao.prioridade ? (PRIORIDADE_TO_ENUM[acao.prioridade] || "MEDIA") : prioMap,
          },
        });
        return { acao: "criar_tarefa", taskId: task.id, titulo };
      }
    }

    return { acao: acao.tipo, ignorado: true };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async resolveTargets(acao: Acao, ctx: Record<string, any>): Promise<string[]> {
    const targets: string[] = [];
    if (acao.para === "solicitante" && ctx.solicitanteId) targets.push(ctx.solicitanteId);
    if (acao.para === "atendente"   && ctx.atendenteId)   targets.push(ctx.atendenteId);
    if (acao.para === "usuario"     && acao.usuarioId)    targets.push(acao.usuarioId);
    if (acao.para === "masters") {
      const masters = await this.db.userRole.findMany({ where: { role: { isMaster: true } }, select: { userId: true } });
      masters.forEach((m: any) => targets.push(m.userId));
    }
    return [...new Set(targets)] as string[];
  }

  private async interpolate(text: string, ctx: Record<string, any>): Promise<string> {
    let result = text
      .replace(/\{\{titulo\}\}/g,     ctx.titulo     || "")
      .replace(/\{\{numero\}\}/g,     String(ctx.numero || ""))
      .replace(/\{\{prioridade\}\}/g, ctx.prioridade  || "")
      .replace(/\{\{status\}\}/g,     ctx.status      || "")
      .replace(/\{\{categoria\}\}/g,  ctx.categoria   || "")
      .replace(/\{\{data\}\}/g,       new Date().toLocaleDateString("pt-BR"))
      .replace(/\{\{hora\}\}/g,       new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));

    // Lazy-load related data for richer templates
    if (ctx.id && (result.includes("{{cliente}}") || result.includes("{{atendente}}") || result.includes("{{solicitante}}"))) {
      const chamado = await this.db.chamado.findUnique({
        where: { id: ctx.id },
        select: {
          cliente:    { select: { nome: true } },
          atendente:  { select: { nome: true } },
          solicitante:{ select: { nome: true } },
        },
      }).catch(() => null);
      if (chamado) {
        result = result
          .replace(/\{\{cliente\}\}/g,     chamado.cliente?.nome    || "")
          .replace(/\{\{atendente\}\}/g,   chamado.atendente?.nome  || "")
          .replace(/\{\{solicitante\}\}/g, chamado.solicitante?.nome || "");
      }
    }
    return result;
  }
}

// ── AutomacoesController ──────────────────────────────────────────────────────
@Controller("automacoes")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class AutomacoesController {
  constructor(
    private prisma: PrismaService,
    private automacaoService: AutomacaoService,
  ) {}
  private get db() { return this.prisma as any; }

  @Get()
  @Permissions("automacoes:ver")
  async findAll(@Req() req: any, @Query("ativo") ativo?: string) {
    const orgId = req.user?.organizationId;
    const where: any = { ...(orgId ? { organizationId: orgId } : {}) };
    if (ativo === "true")  where.ativo = true;
    if (ativo === "false") where.ativo = false;
    return this.db.automacao.findMany({ where, orderBy: { criadoEm: "desc" } });
  }

  @Get("execucoes")
  @Permissions("automacoes:ver")
  async getExecucoes(
    @Req() req: any,
    @Query("automacaoId") automacaoId?: string,
    @Query("limit") limit?: string,
  ) {
    const take  = Math.min(Number(limit) || 50, 200);
    const orgId = req.user?.organizationId;
    const where: any = {};
    if (automacaoId) where.automacaoId = automacaoId;
    if (orgId)       where.automacao   = { organizationId: orgId };
    return this.db.automacaoExecucao.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      take,
      include: { automacao: { select: { id: true, nome: true } } },
    });
  }

  @Get("triggers")
  @Permissions("automacoes:ver")
  getTriggers() {
    return TRIGGERS_VALIDOS;
  }

  @Get(":id")
  @Permissions("automacoes:ver")
  async findOne(@Param("id") id: string) {
    const a = await this.db.automacao.findUnique({ where: { id } });
    if (!a) throw new NotFoundException("Automacao nao encontrada");
    return a;
  }

  @Post()
  @Permissions("automacoes:criar")
  async create(
    @Body() body: { nome: string; descricao?: string; trigger: string; condicoes?: any; acoes?: any[] },
    @Req() req: any,
  ) {
    if (!body.nome?.trim()) throw new BadRequestException("Nome obrigatorio");
    if (!body.trigger)       throw new BadRequestException("Trigger obrigatorio");
    if (!TRIGGERS_VALIDOS.includes(body.trigger)) throw new BadRequestException("Trigger invalido");
    const orgId = req.user?.organizationId;
    return this.db.automacao.create({
      data: {
        id:        crypto.randomUUID(),
        nome:      body.nome.trim(),
        descricao: body.descricao || null,
        trigger:   body.trigger,
        condicoes: body.condicoes || { grupos: [] },
        acoes:     body.acoes     || [],
        ...(orgId ? { organizationId: orgId } : {}),
      } as any,
    });
  }

  @Put(":id")
  @Permissions("automacoes:editar")
  async update(@Param("id") id: string, @Body() body: any) {
    const existing = await this.db.automacao.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Automacao nao encontrada");
    if (body.trigger && !TRIGGERS_VALIDOS.includes(body.trigger)) throw new BadRequestException("Trigger invalido");
    return this.db.automacao.update({
      where: { id },
      data: {
        ...(body.nome       && { nome:      body.nome.trim() }),
        ...(body.descricao  !== undefined && { descricao: body.descricao }),
        ...(body.trigger    && { trigger:   body.trigger }),
        ...(body.condicoes  !== undefined && { condicoes: body.condicoes }),
        ...(body.acoes      !== undefined && { acoes:     body.acoes }),
        ...(body.ativo      !== undefined && { ativo:     Boolean(body.ativo) }),
      },
    });
  }

  @Patch(":id/toggle")
  @Permissions("automacoes:editar")
  async toggle(@Param("id") id: string) {
    const existing = await this.db.automacao.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Automacao nao encontrada");
    return this.db.automacao.update({ where: { id }, data: { ativo: !existing.ativo } });
  }

  @Post(":id/testar")
  @Permissions("automacoes:editar")
  async testar(@Param("id") id: string, @Body() body: { contexto?: Record<string, any> }) {
    const auto = await this.db.automacao.findUnique({ where: { id } });
    if (!auto) throw new NotFoundException("Automacao nao encontrada");
    const ctx = body.contexto || {
      prioridade: "alta", status: "aberto", categoria: "teste",
      titulo: "Chamado de teste", numero: 99, tags: "",
    };
    const match = this.automacaoService.avaliarCondicoes(auto.condicoes, ctx);
    const grupos = this.normalizeGrupos(auto.condicoes);
    return {
      match,
      grupos: grupos.map(g => ({
        ...g,
        itens: g.itens.map((c: CondicaoItem) => ({ ...c, resultado: this.testarCondicao(c, ctx) })),
      })),
      contextoUsado: ctx,
    };
  }

  private normalizeGrupos(condicoes: any): { itens: CondicaoItem[] }[] {
    if (condicoes && !Array.isArray(condicoes) && condicoes.grupos) return condicoes.grupos;
    const itens = Array.isArray(condicoes) ? condicoes : [];
    return itens.length > 0 ? [{ itens }] : [];
  }

  private testarCondicao(c: CondicaoItem, ctx: Record<string, any>): boolean {
    return this.automacaoService["avaliarCondicao"](c, ctx);
  }

  @Delete(":id")
  @Permissions("automacoes:deletar")
  async remove(@Param("id") id: string, @Req() req: any) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters podem remover automacoes");
    const existing = await this.db.automacao.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Automacao nao encontrada");
    await this.db.automacao.delete({ where: { id } });
    return { message: "Automacao removida" };
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  imports:     [NotificationsModule],
  controllers: [AutomacoesController],
  providers:   [PrismaService, AutomacaoService],
  exports:     [AutomacaoService],
})
export class AutomacoesModule {}
