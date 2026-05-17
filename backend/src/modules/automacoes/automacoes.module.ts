import {
  Module, Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards, Req,
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Condicao { campo: string; operador: string; valor?: any; }
interface Acao     { tipo: string; [key: string]: any; }

// ── AutomacaoService (exported for use in ChamadosModule) ─────────────────────
@Injectable()
export class AutomacaoService {
  constructor(private prisma: PrismaService) {}
  private get db() { return this.prisma as any; }

  /** Called by ChamadosModule after chamado create/update/SLA events */
  async executar(trigger: string, context: Record<string, any>): Promise<void> {
    try {
      const automacoes = await this.db.automacao.findMany({ where: { trigger, ativo: true } });
      for (const auto of automacoes) {
        try {
          const condicoes = (auto.condicoes as Condicao[]) || [];
          if (!this.avaliarCondicoes(condicoes, context)) continue;

          const acoes = (auto.acoes as Acao[]) || [];
          const resultados: any[] = [];
          for (const acao of acoes) {
            const r = await this.executarAcao(acao, context);
            resultados.push(r);
          }

          await this.db.automacaoExecucao.create({
            data: {
              id:          require("crypto").randomUUID(),
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
          await this.db.automacaoExecucao.create({
            data: {
              id: require("crypto").randomUUID(),
              automacaoId: auto.id,
              trigger,
              contextId: context.id || "unknown",
              resultado: "erro",
              detalhes: { erro: err?.message },
            },
          }).catch(() => {});
        }
      }
    } catch {} // never crash the caller
  }

  private avaliarCondicoes(condicoes: Condicao[], ctx: Record<string, any>): boolean {
    for (const c of condicoes) {
      const val = ctx[c.campo];
      switch (c.operador) {
        case "eq":       if (val !== c.valor) return false; break;
        case "neq":      if (val === c.valor) return false; break;
        case "in":       if (!Array.isArray(c.valor) || !c.valor.includes(val)) return false; break;
        case "nin":      if (!Array.isArray(c.valor) || c.valor.includes(val))  return false; break;
        case "empty":    if (val !== null && val !== undefined && val !== "") return false; break;
        case "notempty": if (!val) return false; break;
        case "contains": if (typeof val !== "string" || !val.toLowerCase().includes(String(c.valor).toLowerCase())) return false; break;
      }
    }
    return true;
  }

  private async executarAcao(acao: Acao, ctx: Record<string, any>): Promise<any> {
    const chamadoId = ctx.id;
    switch (acao.tipo) {
      case "atribuir_atendente":
        if (chamadoId && acao.atendenteId) {
          await this.db.chamado.update({ where: { id: chamadoId }, data: { atendenteId: acao.atendenteId, status: "em_atendimento" } });
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

      case "criar_notificacao": {
        const titulo   = this.interpolate(acao.titulo   || "Automação executada", ctx);
        const mensagem = this.interpolate(acao.mensagem || "", ctx);
        const targets: string[] = [];

        if (acao.para === "solicitante" && ctx.solicitanteId) targets.push(ctx.solicitanteId);
        if (acao.para === "atendente"   && ctx.atendenteId)   targets.push(ctx.atendenteId);
        if (acao.para === "usuario"     && acao.usuarioId)    targets.push(acao.usuarioId);
        if (acao.para === "masters") {
          const masters = await this.db.userRole.findMany({ where: { role: { isMaster: true } }, select: { userId: true } });
          masters.forEach((m: any) => targets.push(m.userId));
        }

        for (const userId of [...new Set(targets)]) {
          await this.db.notification.create({
            data: {
              id: require("crypto").randomUUID(),
              userId, tipo: "automacao",
              titulo, mensagem,
              referenciaTipo: "chamado", referenciaId: chamadoId,
            },
          }).catch(() => {});
        }
        return { acao: "criar_notificacao", targets: targets.length };
      }

      case "mudar_prioridade":
        if (chamadoId && acao.prioridade) {
          await this.db.chamado.update({ where: { id: chamadoId }, data: { prioridade: acao.prioridade } });
          return { acao: "mudar_prioridade", prioridade: acao.prioridade };
        }
        break;
    }
    return { acao: acao.tipo, ignorado: true };
  }

  private interpolate(text: string, ctx: Record<string, any>): string {
    return text
      .replace(/\{\{titulo\}\}/g,    ctx.titulo    || "")
      .replace(/\{\{numero\}\}/g,    String(ctx.numero || ""))
      .replace(/\{\{prioridade\}\}/g, ctx.prioridade || "")
      .replace(/\{\{status\}\}/g,    ctx.status    || "")
      .replace(/\{\{categoria\}\}/g, ctx.categoria || "");
  }
}

// ── AutomacoesController ──────────────────────────────────────────────────────
@Controller("automacoes")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class AutomacoesController {
  constructor(private prisma: PrismaService) {}
  private get db() { return this.prisma as any; }

  // GET /automacoes
  @Get()
  @Permissions("automacoes:ver")
  async findAll(@Req() req: any, @Query("ativo") ativo?: string) {
    const orgId = req.user?.organizationId;
    const where: any = { ...(orgId ? { organizationId: orgId } as any : {}) };
    if (ativo === "true")  where.ativo = true;
    if (ativo === "false") where.ativo = false;
    return this.db.automacao.findMany({ where, orderBy: { criadoEm: "desc" } });
  }

  // GET /automacoes/execucoes — execution history
  @Get("execucoes")
  @Permissions("automacoes:ver")
  async getExecucoes(@Req() req: any, @Query("automacaoId") automacaoId?: string, @Query("limit") limit?: string) {
    const take = Math.min(Number(limit) || 50, 200);
    const orgId = req.user?.organizationId;
    return this.db.automacaoExecucao.findMany({
      where: automacaoId ? { automacaoId } : {},
      orderBy: { criadoEm: "desc" },
      take,
      include: { automacao: { select: { id: true, nome: true } } },
    });
  }

  // GET /automacoes/:id
  @Get(":id")
  @Permissions("automacoes:ver")
  async findOne(@Param("id") id: string) {
    const a = await this.db.automacao.findUnique({ where: { id } });
    if (!a) throw new NotFoundException("Automacao nao encontrada");
    return a;
  }

  // POST /automacoes
  @Post()
  @Permissions("automacoes:criar")
  async create(@Body() body: { nome: string; descricao?: string; trigger: string; condicoes?: any[]; acoes?: any[] }, @Req() req: any) {
    if (!body.nome?.trim())  throw new BadRequestException("Nome obrigatorio");
    if (!body.trigger)       throw new BadRequestException("Trigger obrigatorio");
    const orgId = req.user?.organizationId;
    return this.db.automacao.create({
      data: {
        id:        require("crypto").randomUUID(),
        nome:      body.nome.trim(),
        descricao: body.descricao || null,
        trigger:   body.trigger,
        condicoes: body.condicoes || [],
        acoes:     body.acoes     || [],
        ...(orgId ? { organizationId: orgId } : {}),
      } as any,
    });
  }

  // PUT /automacoes/:id
  @Put(":id")
  @Permissions("automacoes:editar")
  async update(@Param("id") id: string, @Body() body: any) {
    const existing = await this.db.automacao.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Automacao nao encontrada");
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

  // PATCH /automacoes/:id/toggle — enable/disable
  @Patch(":id/toggle")
  @Permissions("automacoes:editar")
  async toggle(@Param("id") id: string) {
    const existing = await this.db.automacao.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Automacao nao encontrada");
    return this.db.automacao.update({ where: { id }, data: { ativo: !existing.ativo } });
  }

  // POST /automacoes/:id/testar — test with mock context
  @Post(":id/testar")
  @Permissions("automacoes:editar")
  async testar(@Param("id") id: string, @Body() body: { contexto?: Record<string, any> }) {
    const auto = await this.db.automacao.findUnique({ where: { id } });
    if (!auto) throw new NotFoundException("Automacao nao encontrada");
    const condicoes = (auto.condicoes as Condicao[]) || [];
    const ctx = body.contexto || { prioridade: "alta", status: "aberto", categoria: "teste" };
    const service = new AutomacaoService(this.prisma);
    const match = (service as any).avaliarCondicoes(condicoes, ctx);
    return {
      match,
      condicoes: condicoes.map((c: Condicao) => ({ ...c, resultado: this.testarCondicao(c, ctx) })),
      contextoUsado: ctx,
    };
  }

  private testarCondicao(c: Condicao, ctx: Record<string, any>): boolean {
    const val = ctx[c.campo];
    switch (c.operador) {
      case "eq":       return val === c.valor;
      case "neq":      return val !== c.valor;
      case "in":       return Array.isArray(c.valor) && c.valor.includes(val);
      case "nin":      return Array.isArray(c.valor) && !c.valor.includes(val);
      case "empty":    return val === null || val === undefined || val === "";
      case "notempty": return !!val;
      case "contains": return typeof val === "string" && val.toLowerCase().includes(String(c.valor).toLowerCase());
      default:         return false;
    }
  }

  // DELETE /automacoes/:id
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
  controllers: [AutomacoesController],
  providers:   [PrismaService, AutomacaoService],
  exports:     [AutomacaoService],
})
export class AutomacoesModule {}
