import {
  Module, Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards, Req, Logger,
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
  OnModuleInit,
} from "@nestjs/common";
import { ScheduleModule, Cron, CronExpression } from "@nestjs/schedule";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { WhatsAppService } from "../notifications/whatsapp.service";
import { EmailService } from "../notifications/email.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { WebhookService, WebhooksModule } from "./webhooks.module";
import * as crypto from "crypto";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CondicaoItem { campo: string; operador: string; valor?: any; }
interface CondicaoGrupo { itens: CondicaoItem[]; }
interface CondicoesConfig { grupos: CondicaoGrupo[]; }
interface Acao { tipo: string; [key: string]: any; }

const TRIGGERS_VALIDOS = [
  // Chamados
  "chamado_criado", "chamado_atualizado", "chamado_resolvido", "chamado_fechado", "chamado_sla_risco",
  // Contratos
  "contrato_criado", "contrato_atualizado", "contrato_vencendo", "contrato_vencido", "contrato_renovado",
  // Projetos & Tarefas
  "projeto_criado", "projeto_concluido", "projeto_cancelado",
  "tarefa_criada", "tarefa_concluida", "tarefa_atribuida",
  // Workflows / Aprovações
  "workflow_pendente", "workflow_aprovado", "workflow_rejeitado",
  // Ativos
  "ativo_garantia_vencendo", "ativo_offline", "ativo_online",
  // Usuários
  "usuario_criado",
];

const PRIORIDADE_TO_ENUM: Record<string, string> = {
  baixa: "BAIXA", media: "MEDIA", alta: "ALTA", critica: "URGENTE",
};

const ACOES_VALIDAS = new Set([
  "atribuir_atendente", "mudar_status", "mudar_prioridade", "escalar_chamado",
  "adicionar_tag", "remover_tag", "adicionar_comentario", "criar_notificacao",
  "enviar_whatsapp", "enviar_email", "criar_tarefa", "criar_chamado",
  "criar_evento_agenda", "alterar_status_projeto",
]);

const MAX_AUTOMACAO_DEPTH = 3;

function validateAcoes(acoes: any[]): void {
  if (!Array.isArray(acoes)) throw new BadRequestException("acoes deve ser um array");
  acoes.forEach((a, i) => {
    if (!a || typeof a !== "object") throw new BadRequestException(`Ação #${i + 1} inválida`);
    if (!ACOES_VALIDAS.has(a.tipo)) throw new BadRequestException(`Ação #${i + 1}: tipo "${a.tipo}" desconhecido`);
    switch (a.tipo) {
      case "atribuir_atendente":
        if (!a.atendenteId) throw new BadRequestException(`Ação #${i + 1}: atendenteId obrigatório`);
        break;
      case "mudar_status":
        if (!a.status) throw new BadRequestException(`Ação #${i + 1}: status obrigatório`);
        break;
      case "mudar_prioridade":
        if (!a.prioridade) throw new BadRequestException(`Ação #${i + 1}: prioridade obrigatória`);
        break;
      case "adicionar_tag":
      case "remover_tag":
        if (!a.tag) throw new BadRequestException(`Ação #${i + 1}: tag obrigatória`);
        break;
      case "adicionar_comentario":
        if (!a.texto?.trim()) throw new BadRequestException(`Ação #${i + 1}: texto obrigatório`);
        break;
      case "criar_notificacao":
        if (!a.titulo?.trim()) throw new BadRequestException(`Ação #${i + 1}: titulo obrigatório`);
        if (a.para === "usuario" && !a.usuarioId) throw new BadRequestException(`Ação #${i + 1}: usuarioId obrigatório`);
        break;
      case "enviar_whatsapp":
        if (!a.mensagem?.trim()) throw new BadRequestException(`Ação #${i + 1}: mensagem obrigatória`);
        if (a.para === "usuario" && !a.usuarioId) throw new BadRequestException(`Ação #${i + 1}: usuarioId obrigatório`);
        break;
      case "enviar_email":
        if (!a.mensagem?.trim()) throw new BadRequestException(`Ação #${i + 1}: mensagem obrigatória`);
        if (!a.para && !a.para_email) throw new BadRequestException(`Ação #${i + 1}: destinatário (para ou para_email) obrigatório`);
        if (a.para === "usuario" && !a.usuarioId) throw new BadRequestException(`Ação #${i + 1}: usuarioId obrigatório`);
        break;
      case "criar_tarefa":
        if (!a.projectId) throw new BadRequestException(`Ação #${i + 1}: projectId obrigatório`);
        if (!a.titulo?.trim()) throw new BadRequestException(`Ação #${i + 1}: titulo obrigatório`);
        break;
      case "criar_chamado":
        if (!a.titulo_chamado?.trim()) throw new BadRequestException(`Ação #${i + 1}: titulo_chamado obrigatório`);
        break;
      case "criar_evento_agenda":
        if (!a.titulo_evento?.trim()) throw new BadRequestException(`Ação #${i + 1}: titulo_evento obrigatório`);
        break;
      case "alterar_status_projeto":
        if (!a.projectId) throw new BadRequestException(`Ação #${i + 1}: projectId obrigatório`);
        if (!a.status) throw new BadRequestException(`Ação #${i + 1}: status obrigatório`);
        break;
    }
  });
}

// ── AutomacaoService (exported for use in ChamadosModule and others) ──────────
@Injectable()
export class AutomacaoService {
  private readonly logger = new Logger(AutomacaoService.name);
  constructor(
    private prisma: PrismaService,
    private wa: WhatsAppService,
    private email: EmailService,
  ) {}
  private get db() { return this.prisma as any; }

  /** Called by ChamadosModule/ContratosModule after relevant events */
  async executar(trigger: string, context: Record<string, any>): Promise<void> {
    // Loop guard — automation actions can re-trigger automations indirectly
    const depth = Number(context.__depth || 0);
    if (depth >= MAX_AUTOMACAO_DEPTH) {
      this.logger.warn(`Automacao ${trigger}: profundidade máxima (${MAX_AUTOMACAO_DEPTH}) atingida — abortando`);
      return;
    }
    const nextCtx = { ...context, __depth: depth + 1 };

    try {
      const where: any = { trigger, ativo: true };
      if (context.organizationId) where.organizationId = context.organizationId;

      const automacoes = await this.db.automacao.findMany({ where });
      for (const auto of automacoes) {
        try {
          if (!this.avaliarCondicoes(auto.condicoes, nextCtx)) continue;

          // Per-execution cache for richer template variables
          const tplCache: Record<string, string> = {};
          const acoes = (auto.acoes as Acao[]) || [];
          const resultados: any[] = [];
          for (const acao of acoes) {
            const r = await this.executarAcao(acao, nextCtx, tplCache);
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
    if (condicoes && !Array.isArray(condicoes) && condicoes.grupos) {
      const grupos = (condicoes as CondicoesConfig).grupos;
      if (grupos.length === 0) return true;
      return grupos.some(g => g.itens.length === 0 || g.itens.every(c => this.avaliarCondicao(c, ctx)));
    }
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

  /** dry-run version returns what would happen without side-effects */
  async dryRunAcao(acao: Acao, ctx: Record<string, any>, tplCache: Record<string, string>): Promise<any> {
    const targets = ["criar_notificacao","enviar_whatsapp"].includes(acao.tipo)
      ? await this.resolveTargets(acao, ctx)
      : [];
    const texto = acao.mensagem || acao.texto || acao.titulo || "";
    const preview = texto ? await this.interpolate(String(texto), ctx, tplCache) : "";
    return { acao: acao.tipo, dryRun: true, alvo: targets.length || undefined, preview: preview || undefined };
  }

  private async executarAcao(acao: Acao, ctx: Record<string, any>, tplCache: Record<string, string>): Promise<any> {
    const chamadoId = ctx.id;

    switch (acao.tipo) {
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
            const titulo   = await this.interpolate(`Chamado escalado: {{titulo}} (#{{numero}})`, ctx, tplCache);
            const mensagem = await this.interpolate(`Prioridade alterada para ${novaPrioridade}`, ctx, tplCache);
            // Scope masters to this organization
            const masters = await this.db.userRole.findMany({
              where: {
                role: { isMaster: true },
                ...(ctx.organizationId ? { user: { organizationId: ctx.organizationId } } : {}),
              },
              select: { userId: true },
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
        const texto = await this.interpolate(acao.texto || "", ctx, tplCache);
        if (chamadoId && texto) {
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

      case "criar_notificacao": {
        const titulo   = await this.interpolate(acao.titulo   || "Automação executada", ctx, tplCache);
        const mensagem = await this.interpolate(acao.mensagem || "", ctx, tplCache);
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
        const mensagem = await this.interpolate(acao.mensagem || "", ctx, tplCache);
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

      case "criar_tarefa": {
        if (!acao.projectId || !acao.titulo) break;
        const criadoPorId = ctx.atendenteId || ctx.solicitanteId;
        if (!criadoPorId) break;
        const titulo    = await this.interpolate(acao.titulo, ctx, tplCache);
        const descricao = acao.descricao ? await this.interpolate(acao.descricao, ctx, tplCache) : null;
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

      // ── Email ────────────────────────────────────────────────────────────────
      case "enviar_email": {
        const assunto  = await this.interpolate(acao.assunto  || "Notificação do Orkiestri", ctx, tplCache);
        const mensagem = await this.interpolate(acao.mensagem || "", ctx, tplCache);
        if (!mensagem) break;
        const targets  = await this.resolveTargets(acao, ctx);
        let enviados   = 0;
        for (const userId of targets) {
          const u = await this.db.user.findUnique({ where: { id: userId }, select: { email: true, nome: true } });
          if (u?.email) {
            const ok = await this.email.sendGeneric(u.email, u.nome, assunto, mensagem).catch(() => false);
            if (ok) enviados++;
          }
        }
        if (acao.para_email) {
          const ok = await this.email.sendGeneric(acao.para_email, acao.para_nome || "", assunto, mensagem).catch(() => false);
          if (ok) enviados++;
        }
        return { acao: "enviar_email", enviados };
      }

      // ── Criar chamado a partir de outra automação ────────────────────────────
      case "criar_chamado": {
        if (!acao.titulo_chamado || !ctx.organizationId) break;
        const titulo    = await this.interpolate(acao.titulo_chamado, ctx, tplCache);
        const descricao = acao.descricao
          ? await this.interpolate(acao.descricao, ctx, tplCache)
          : "Chamado criado automaticamente pela automação.";
        const criadoPorId = ctx.solicitanteId || ctx.atendenteId;
        if (!criadoPorId) break;
        const count  = await this.db.chamado.count({ where: { organizationId: ctx.organizationId } });
        const numero = count + 1;
        const prio = (acao.prioridade || ctx.prioridade || "media") as string;
        const slaMap: Record<string, number> = { baixa: 72, media: 24, alta: 8, critica: 2 };
        const novoChamado = await this.db.chamado.create({
          data: {
            id:              crypto.randomUUID(),
            numero,
            titulo,
            descricao,
            prioridade:      prio,
            status:          "aberto",
            slaHoras:        slaMap[prio] ?? 24,
            solicitanteId:   criadoPorId,
            atendenteId:     acao.atendenteId || null,
            categoriaId:     acao.categoriaId || null,
            organizationId:  ctx.organizationId,
          },
        });
        return { acao: "criar_chamado", chamadoId: novoChamado.id, numero };
      }

      // ── Criar evento na agenda dos targets ───────────────────────────────────
      case "criar_evento_agenda": {
        if (!ctx.organizationId) break;
        const targets = await this.resolveTargets(acao, ctx);
        if (!targets.length) break;
        const titulo    = await this.interpolate(acao.titulo_evento || "Evento automático", ctx, tplCache);
        const descricao = acao.descricao ? await this.interpolate(acao.descricao, ctx, tplCache) : "";
        const inicio = acao.data_inicio
          ? new Date(acao.data_inicio)
          : (() => { const d = new Date(); d.setDate(d.getDate() + (acao.dias_futuro || 1)); d.setHours(9, 0, 0, 0); return d; })();
        const fim = new Date(inicio.getTime() + 60 * 60 * 1000);
        let criados = 0;
        for (const userId of targets) {
          await this.db.event.create({
            data: {
              id: crypto.randomUUID(),
              titulo, descricao, inicio, fim,
              tipo: "COMPROMISSO",
              userId,
              criadoPorId: userId,
              organizationId: ctx.organizationId,
            },
          }).catch(() => {});
          criados++;
        }
        return { acao: "criar_evento_agenda", criados };
      }

      // ── Alterar status de projeto ────────────────────────────────────────────
      case "alterar_status_projeto": {
        if (!acao.projectId || !acao.status) break;
        await this.db.project.update({
          where: { id: acao.projectId },
          data: { status: acao.status },
        });
        return { acao: "alterar_status_projeto", status: acao.status };
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
      const masters = await this.db.userRole.findMany({
        where: {
          role: { isMaster: true },
          ...(ctx.organizationId ? { user: { organizationId: ctx.organizationId } } : {}),
        },
        select: { userId: true },
      });
      masters.forEach((m: any) => targets.push(m.userId));
    }
    return [...new Set(targets)] as string[];
  }

  private async interpolate(text: string, ctx: Record<string, any>, cache: Record<string, string>): Promise<string> {
    let result = text
      .replace(/\{\{titulo\}\}/g,     ctx.titulo     || "")
      .replace(/\{\{numero\}\}/g,     String(ctx.numero || ""))
      .replace(/\{\{prioridade\}\}/g, ctx.prioridade  || "")
      .replace(/\{\{status\}\}/g,     ctx.status      || "")
      .replace(/\{\{categoria\}\}/g,  ctx.categoria   || "")
      .replace(/\{\{data\}\}/g,       new Date().toLocaleDateString("pt-BR"))
      .replace(/\{\{hora\}\}/g,       new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));

    if (ctx.id && (result.includes("{{cliente}}") || result.includes("{{atendente}}") || result.includes("{{solicitante}}"))) {
      if (cache.cliente === undefined) {
        const chamado = await this.db.chamado.findUnique({
          where: { id: ctx.id },
          select: {
            cliente:    { select: { nome: true } },
            atendente:  { select: { nome: true } },
            solicitante:{ select: { nome: true } },
          },
        }).catch(() => null);
        cache.cliente     = chamado?.cliente?.nome     || "";
        cache.atendente   = chamado?.atendente?.nome   || "";
        cache.solicitante = chamado?.solicitante?.nome || "";
      }
      result = result
        .replace(/\{\{cliente\}\}/g,     cache.cliente)
        .replace(/\{\{atendente\}\}/g,   cache.atendente)
        .replace(/\{\{solicitante\}\}/g, cache.solicitante);
    }
    return result;
  }
}

// ── Cron job: contratos / garantias ───────────────────────────────────────────
@Injectable()
export class AutomacaoCronService {
  private readonly logger = new Logger(AutomacaoCronService.name);
  constructor(
    private prisma: PrismaService,
    private automacao: AutomacaoService,
    private webhook: WebhookService,
  ) {}
  private get db() { return this.prisma as any; }

  // Daily at 08:00 server time — checks expiring/expired contracts and warranties
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async dispararTriggersDiarios() {
    this.logger.log("Disparando triggers diários (contratos / garantias)…");
    await Promise.all([
      this.handleContratosVencendo(),
      this.handleContratosVencidos(),
      this.handleAtivosGarantiaVencendo(),
    ]);
  }

  private async handleContratosVencendo() {
    const now      = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const contratos = await this.db.contrato.findMany({
      where: {
        ativo: true,
        vigenciaFim: { gte: now, lte: in30Days },
        status: { notIn: ["rescindido", "suspenso"] },
      },
      include: { cliente: { select: { nome: true } } },
    });
    for (const c of contratos) {
      const diasRestantes = Math.ceil((c.vigenciaFim.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const payload = {
        id: c.id, numero: c.numero, titulo: c.titulo,
        clienteId: c.clienteId, clienteNome: c.cliente?.nome || "",
        status: c.status, vigenciaFim: c.vigenciaFim,
        diasRestantes,
        organizationId: c.organizationId,
      };
      await this.automacao.executar("contrato_vencendo", payload).catch(() => {});
      this.webhook.fire("contrato.vencendo", payload, c.organizationId).catch(() => {});
    }
    this.logger.log(`contrato_vencendo: ${contratos.length} contratos`);
  }

  private async handleContratosVencidos() {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    // Vencidos no último dia (evita reenviar diariamente para todos os antigos)
    const contratos = await this.db.contrato.findMany({
      where: {
        ativo: true,
        vigenciaFim: { gte: yesterday, lt: now },
        status: { notIn: ["rescindido", "suspenso"] },
      },
      include: { cliente: { select: { nome: true } } },
    });
    for (const c of contratos) {
      const payload = {
        id: c.id, numero: c.numero, titulo: c.titulo,
        clienteId: c.clienteId, clienteNome: c.cliente?.nome || "",
        status: c.status, vigenciaFim: c.vigenciaFim,
        organizationId: c.organizationId,
      };
      await this.automacao.executar("contrato_vencido", payload).catch(() => {});
      this.webhook.fire("contrato.vencido", payload, c.organizationId).catch(() => {});
    }
    this.logger.log(`contrato_vencido: ${contratos.length} contratos`);
  }

  private async handleAtivosGarantiaVencendo() {
    const now      = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const ativos = await this.db.ativo.findMany({
      where: { dataGarantiaFim: { gte: now, lte: in30Days } },
      select: { id: true, codigo: true, nome: true, dataGarantiaFim: true, organizationId: true },
    });
    for (const a of ativos) {
      const diasRestantes = Math.ceil((a.dataGarantiaFim.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const payload = {
        id: a.id, codigo: a.codigo, nome: a.nome,
        dataGarantiaFim: a.dataGarantiaFim, diasRestantes,
        organizationId: a.organizationId,
      };
      await this.automacao.executar("ativo_garantia_vencendo", payload).catch(() => {});
      this.webhook.fire("ativo.garantia_vencendo", payload, a.organizationId).catch(() => {});
    }
    this.logger.log(`ativo_garantia_vencendo: ${ativos.length} ativos`);
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
    validateAcoes(body.acoes || []);
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
    if (body.acoes !== undefined) validateAcoes(body.acoes);
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
  async testar(@Param("id") id: string, @Body() body: { contexto?: Record<string, any>; dryRun?: boolean }) {
    const auto = await this.db.automacao.findUnique({ where: { id } });
    if (!auto) throw new NotFoundException("Automacao nao encontrada");
    const ctx = body.contexto || {
      prioridade: "alta", status: "aberto", categoria: "teste",
      titulo: "Chamado de teste", numero: 99, tags: "",
    };
    const match = this.automacaoService.avaliarCondicoes(auto.condicoes, ctx);
    const grupos = this.normalizeGrupos(auto.condicoes);

    // Dry-run das ações (sem efeitos colaterais)
    const tplCache: Record<string, string> = {};
    const acoesPreview = match
      ? await Promise.all(
          (auto.acoes as Acao[] || []).map(a => this.automacaoService.dryRunAcao(a, ctx, tplCache)),
        )
      : [];

    return {
      match,
      grupos: grupos.map(g => ({
        ...g,
        itens: g.itens.map((c: CondicaoItem) => ({ ...c, resultado: this.testarCondicao(c, ctx) })),
      })),
      acoesPreview,
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
  imports:     [NotificationsModule, WebhooksModule, ScheduleModule.forRoot()],
  controllers: [AutomacoesController],
  providers:   [PrismaService, AutomacaoService, AutomacaoCronService],
  // Re-export NotificationsModule so consumers of AutomacaoService (Projects,
  // Users, Chamados, etc.) inherit WhatsAppService/EmailService transparently.
  exports:     [AutomacaoService, NotificationsModule],
})
export class AutomacoesModule {}
