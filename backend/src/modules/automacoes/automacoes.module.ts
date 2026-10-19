import { MARCA } from "../../common/marca";
import { Allow, IsArray, IsBoolean, IsOptional, IsString } from "class-validator";
import {
  Module, Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards, Req, Logger,
  Injectable, BadRequestException, ForbiddenException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { acharNaOrganizacao } from "../../common/escopo-organizacao";
import { WhatsAppService } from "../notifications/whatsapp.service";
import { EmailService } from "../notifications/email.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { NotificacaoDispatcher } from "../notifications/notificacao-dispatcher.service";
import { WebhookService, WebhooksModule } from "./webhooks.module";
import * as crypto from "crypto";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CondicaoItem { campo: string; operador: string; valor?: any; }
interface CondicaoGrupo { itens: CondicaoItem[]; }
interface CondicoesConfig { grupos: CondicaoGrupo[]; }
interface Acao { tipo: string; [key: string]: any; }

/**
 * Gatilhos e ações sobreviventes à redução de escopo de 18/10/2026.
 *
 * O motor de automação continua sendo infraestrutura do Core: é ele que o
 * Projects chama em `projeto_criado`, `tarefa_criada`, `tarefa_atribuida` e
 * `tarefa_concluida`, e o Users em `usuario_criado`. O que saiu foram os
 * gatilhos e as ações dos módulos removidos — chamado_*, contrato_*,
 * workflow_*, ativo_* e as ações que escreviam em chamado (atribuir
 * atendente, mudar status/prioridade, escalar, tags, comentário, criar
 * chamado), além do cron diário que varria contratos e garantias.
 *
 * Automações já gravadas no banco com um gatilho ou ação que saiu continuam
 * lá, mas nunca mais casam: `executar()` só busca pelo gatilho recebido, e
 * uma ação desconhecida cai no `{ ignorado: true }` do fim do switch. Não
 * quebram nada — ficam inertes.
 */
const TRIGGERS_VALIDOS = [
  // Projetos & Tarefas
  "projeto_criado", "projeto_concluido", "projeto_cancelado",
  "tarefa_criada", "tarefa_concluida", "tarefa_atribuida",
  // Usuários
  "usuario_criado",
];

const PRIORIDADE_TO_ENUM: Record<string, string> = {
  baixa: "BAIXA", media: "MEDIA", alta: "ALTA", critica: "URGENTE",
};

const ACOES_VALIDAS = new Set([
  "criar_notificacao", "enviar_whatsapp", "enviar_email",
  "criar_tarefa", "criar_evento_agenda", "alterar_status_projeto",
]);

const MAX_AUTOMACAO_DEPTH = 3;

function validateAcoes(acoes: any[]): void {
  if (!Array.isArray(acoes)) throw new BadRequestException("acoes deve ser um array");
  acoes.forEach((a, i) => {
    if (!a || typeof a !== "object") throw new BadRequestException(`Ação #${i + 1} inválida`);
    if (!ACOES_VALIDAS.has(a.tipo)) throw new BadRequestException(`Ação #${i + 1}: tipo "${a.tipo}" desconhecido`);
    switch (a.tipo) {
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

// ── AutomacaoService (exportado para Projects e Users) ───────────────────────
@Injectable()
export class AutomacaoService {
  private readonly logger = new Logger(AutomacaoService.name);
  constructor(
    private prisma: PrismaService,
    private dispatcher: NotificacaoDispatcher,
    private wa: WhatsAppService,
    private email: EmailService,
  ) {}
  private get db() { return this.prisma as any; }

  /** Chamado por ProjectsModule e UsersModule depois dos eventos relevantes */
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
    const contextoId = ctx.id;

    switch (acao.tipo) {
      case "criar_notificacao": {
        const titulo   = await this.interpolate(acao.titulo   || "Automação executada", ctx, tplCache);
        const mensagem = await this.interpolate(acao.mensagem || "", ctx, tplCache);
        const targets  = await this.resolveTargets(acao, ctx);
        for (const userId of targets) {
          await this.db.notification.create({
            data: {
              id: crypto.randomUUID(), userId, tipo: "automacao",
              titulo, mensagem, referenciaTipo: ctx.referenciaTipo || "projeto", referenciaId: contextoId,
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
          // Número precisa estar VERIFICADO: a automação escolhe o destinatário,
          // mas não valida o telefone dele. Um dígito errado no cadastro faria a
          // automação despejar mensagem da empresa num desconhecido.
          if (profile?.whatsapp && profile.whatsappVerificado) {
            // Vai pela FILA, não direto.
            //
            // A automação não passa pelo filtro de preferência por módulo — quem
            // a montou escolheu o destinatário de propósito, e bloquear seria
            // desfazer a intenção. Mas passar direto a deixava fora do limite de
            // vazão: uma automação mal configurada (ou disparada em lote)
            // mandava dezenas de mensagens seguidas, que é o padrão pelo qual o
            // WhatsApp bane o número da empresa.
            const ok = await this.dispatcher.enfileirarDireto({
              organizationId: ctx.organizationId,
              canal: "whatsapp",
              destino: profile.whatsapp,
              userId,
              modulo: "core",
              tipo: "automacao",
              titulo: "Automação",
              mensagem,
            }).catch(() => false);
            if (ok) sent++;
          }
        }
        return { acao: "enviar_whatsapp", targets: targets.length, enviados: sent };
      }

      case "criar_tarefa": {
        if (!acao.projectId || !acao.titulo) break;
        const criadoPorId = ctx.criadoPorId || ctx.solicitanteId || ctx.userId;
        if (!criadoPorId) break;
        const titulo    = await this.interpolate(acao.titulo, ctx, tplCache);
        const descricao = acao.descricao ? await this.interpolate(acao.descricao, ctx, tplCache) : null;
        const prioMap   = PRIORIDADE_TO_ENUM[ctx.prioridade || ""] || "MEDIA";
        const task = await this.db.task.create({
          data: {
            id:          crypto.randomUUID(),
            projectId:   acao.projectId,
            assigneeId:  acao.assigneeId || null,
            criadoPorId,
            titulo,
            descricao,
            status:      "A_FAZER",
            // `prioridade`, não `priority`: o campo em `Task` sempre se chamou
            // assim. Escrito errado, o Prisma recusava o create e a ação
            // `criar_tarefa` falhava inteira — em silêncio, porque o
            // `executar()` engole a exceção no log da execução.
            prioridade:  acao.prioridade ? (PRIORIDADE_TO_ENUM[acao.prioridade] || "MEDIA") : prioMap,
          },
        });
        return { acao: "criar_tarefa", taskId: task.id, titulo };
      }

      // ── Email ────────────────────────────────────────────────────────────────
      case "enviar_email": {
        const assunto  = await this.interpolate(acao.assunto  || `Notificação do ${MARCA}`, ctx, tplCache);
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
    if (acao.para === "responsavel"  && ctx.assigneeId)   targets.push(ctx.assigneeId);
    if (acao.para === "usuario"      && acao.usuarioId)   targets.push(acao.usuarioId);
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

  /**
   * Interpola as variáveis do contexto no texto.
   *
   * O `cache` ficou na assinatura porque `dryRunAcao` e `executarAcao` o
   * compartilham por execução. Hoje nenhuma variável exige ida ao banco — as
   * que exigiam (`{{cliente}}`, `{{atendente}}`, `{{solicitante}}`, que liam
   * o chamado) saíram com o módulo de Chamados.
   */
  private async interpolate(text: string, ctx: Record<string, any>, cache: Record<string, string>): Promise<string> {
    return text
      .replace(/\{\{titulo\}\}/g,     ctx.titulo     || "")
      .replace(/\{\{numero\}\}/g,     String(ctx.numero || ""))
      .replace(/\{\{prioridade\}\}/g, ctx.prioridade  || "")
      .replace(/\{\{status\}\}/g,     ctx.status      || "")
      .replace(/\{\{projeto\}\}/g,    ctx.projetoNome || ctx.projeto || "")
      .replace(/\{\{data\}\}/g,       new Date().toLocaleDateString("pt-BR"))
      .replace(/\{\{hora\}\}/g,       new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
  }
}

// ── AutomacoesController ──────────────────────────────────────────────────────
// ── DTOs gerados: sem classe, o ValidationPipe global nao tem metadata e a
//    rota aceita qualquer JSON. Campos derivados do tipo inline anterior.
class CreateAutomacoesDto {
  @IsString() nome: string;
  @IsOptional() @IsString() descricao?: string;
  @IsString() trigger: string;
  @IsOptional() @Allow() condicoes?: any;
  @IsOptional() @IsArray() acoes?: any[];
}

class TestarAutomacoesDto {
  @IsOptional() @Allow() contexto?: Record<string, any>;
  @IsOptional() @IsBoolean() dryRun?: boolean;
}

// ── DTOs de corpo antes tipado como `any`.
//    Campos descobertos pelo uso no handler; todos opcionais e com tipo
//    afirmado só onde o código o torna inequívoco. O ganho é a lista
//    fechada de campos aceitos — antes qualquer JSON passava.
class UpdateAutomacoesDto {
  @IsOptional() @Allow() acoes?: any;
  @IsOptional() @IsBoolean() ativo?: any;
  @IsOptional() @Allow() condicoes?: any;
  @IsOptional() @Allow() descricao?: any;
  @IsOptional() @IsString() nome?: any;
  @IsOptional() @Allow() trigger?: any;
}

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
  async findOne(@Param("id") id: string, @Req() req: any) {
    const a = await acharNaOrganizacao(this.db.automacao, id, req, "Automacao nao encontrada");
    return a;
  }

  @Post()
  @Permissions("automacoes:criar")
  async create(
    @Body() body: CreateAutomacoesDto,
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
  async update(@Param("id") id: string, @Body() body: UpdateAutomacoesDto, @Req() req: any) {
    const existing = await acharNaOrganizacao(this.db.automacao, id, req, "Automacao nao encontrada");
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
  async toggle(@Param("id") id: string, @Req() req: any) {
    const existing = await acharNaOrganizacao(this.db.automacao, id, req, "Automacao nao encontrada");
    return this.db.automacao.update({ where: { id }, data: { ativo: !existing.ativo } });
  }

  @Post(":id/testar")
  @Permissions("automacoes:editar")
  async testar(@Param("id") id: string, @Body() body: TestarAutomacoesDto, @Req() req: any) {
    const auto = await acharNaOrganizacao(this.db.automacao, id, req, "Automacao nao encontrada");
    const ctx = body.contexto || {
      prioridade: "alta", status: "EM_ANDAMENTO",
      titulo: "Projeto de teste", numero: 99,
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
  @Permissions("automacoes:excluir")
  async remove(@Param("id") id: string, @Req() req: any) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters podem remover automacoes");
    const existing = await acharNaOrganizacao(this.db.automacao, id, req, "Automacao nao encontrada");
    await this.db.automacao.delete({ where: { id } });
    return { message: "Automacao removida" };
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  imports:     [NotificationsModule, WebhooksModule],
  controllers: [AutomacoesController],
  providers:   [AutomacaoService],
  // Re-export NotificationsModule so consumers of AutomacaoService (Projects,
  // Users) inherit WhatsAppService/EmailService transparently.
  exports:     [AutomacaoService, NotificationsModule],
})
export class AutomacoesModule {}
