import {
  Module, Controller, Get, Post, Put, Patch, Delete, Body, Param, Query,
  UseGuards, Req, Injectable, OnModuleInit, Logger,
  BadRequestException, NotFoundException, ForbiddenException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { WhatsAppService } from "../notifications/whatsapp.service";
import { NotificationsModule } from "../notifications/notifications.module";

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

class DelegarDto {
  novoAprovadorId: string;
  motivo?: string;
}

class AjustesDto {
  mensagem: string;
}

@Injectable()
export class WorkflowsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private wa: WhatsAppService,
  ) {}

  private get appUrl() { return this.config.get("APP_URL", "https://orkiestri.com.br"); }

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

  /** WhatsApp do usuario (respeita whatsappAlertas) — null se desligado/sem numero. */
  private async getUserPhone(userId: string): Promise<string | null> {
    try {
      const p = await (this.prisma as any).userProfile.findUnique({ where: { userId } });
      return (p?.whatsapp && p?.whatsappAlertas) ? p.whatsapp : null;
    } catch { return null; }
  }

  /** Dispara WhatsApp ao aprovador (assincrono, nao bloqueante). */
  private async sendWhatsAppApprovacao(aprovadorId: string, orgId: string, titulo: string, solicitanteNome: string, valor: number | null, requestId: string) {
    const phone = await this.getUserPhone(aprovadorId);
    if (!phone) return;
    const valorTxt = valor && valor > 0 ? `\n*Valor:* R$ ${valor.toFixed(2).replace(".", ",")}` : "";
    const msg =
      `*Nova solicitacao aguardando sua aprovacao*\n\n` +
      `*De:* ${solicitanteNome}\n` +
      `*Assunto:* ${titulo}${valorTxt}\n\n` +
      `Acesse para aprovar:\n${this.appUrl}/dashboard/aprovacoes`;
    this.wa.sendMessageForOrg(orgId, phone, msg).catch(() => {});
  }

  /**
   * Resolve o aprovador para um solicitante segundo a cadeia:
   *  1. Configuracao explicita do setor (com fallback para backup na vigencia)
   *  2. Responsavel do setor (campo legado Setor.responsavelId)
   *  3. Gestor direto via Collaborator.gestor (logica antiga)
   *  4. null (Master tem que resolver manual)
   */
  private async resolveApprover(userId: string, orgId: string): Promise<string | null> {
    // 1. Descobre o setor do solicitante (via Collaborator ou UserProfile)
    const collab = await (this.prisma as any).collaborator.findFirst({
      where: { userId, organizationId: orgId },
      select: { setorId: true, gestor: { select: { userId: true } } },
    });
    let setorId: string | null = collab?.setorId || null;
    if (!setorId) {
      const profile = await (this.prisma as any).userProfile.findUnique({
        where: { userId }, select: { setorId: true },
      });
      setorId = profile?.setorId || null;
    }

    // 2. Configuracao explicita do setor
    if (setorId) {
      const cfg = await (this.prisma as any).aprovadorSetor.findUnique({ where: { setorId } });
      if (cfg) {
        const now = new Date();
        const backupAtivo =
          cfg.backupAprovadorId &&
          cfg.backupInicio && now >= new Date(cfg.backupInicio) &&
          cfg.backupFim    && now <= new Date(cfg.backupFim);
        if (backupAtivo) return cfg.backupAprovadorId;
        return cfg.aprovadorId;
      }
      // 3. Fallback: responsavel legado do setor
      const setor = await (this.prisma as any).setor.findUnique({
        where: { id: setorId }, select: { responsavelId: true },
      });
      if (setor?.responsavelId) return setor.responsavelId;
    }

    // 4. Fallback: gestor direto do colaborador
    if (collab?.gestor?.userId) return collab.gestor.userId;

    return null;
  }

  /** Sobe na cadeia hierárquica para encontrar o próximo aprovador (escalonamento) */
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
    // Resolve aprovador via matriz: config setor -> backup (se vigente) -> responsavel
    // setor -> gestor direto -> null
    const aprovador = await this.resolveApprover(user.id, user.organizationId);

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
    // Notificacoes ao aprovador (sino + WhatsApp opcional)
    await this.notify(aprovador, "workflow_pendente",
      "Solicitação aguardando aprovação",
      `${created.solicitante.nome} enviou: ${created.titulo}`,
      created.id);
    if (aprovador) {
      this.sendWhatsAppApprovacao(
        aprovador, user.organizationId,
        created.titulo, created.solicitante.nome, dto.valor || null, created.id,
      ).catch(() => {});
    }
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

  async delegar(id: string, dto: DelegarDto, user: any) {
    const r = await this.findOne(id, user);
    if (r.status !== "PENDENTE") throw new BadRequestException("Apenas solicitações pendentes podem ser delegadas");
    if (r.aprovadorAtualId !== user.id && !user.isMaster)
      throw new ForbiddenException("Apenas o aprovador atual ou master pode delegar");
    const novoAprovador = await this.prisma.user.findUnique({ where: { id: dto.novoAprovadorId } });
    if (!novoAprovador) throw new NotFoundException("Usuário não encontrado");

    const { v4: uuid } = await import("uuid");
    await (this.prisma as any).workflowApproval.create({
      data: {
        id: uuid(),
        requestId: id,
        aprovadorId: user.id,
        nivel: (r._count?.aprovacoes || 0) + 1,
        decisao: "DELEGADO",
        observacoes: dto.motivo || `Delegado para ${novoAprovador.nome}`,
      },
    });

    const updated = await (this.prisma as any).workflowRequest.update({
      where: { id },
      data: { aprovadorAtualId: dto.novoAprovadorId },
    });

    await this.notify(dto.novoAprovadorId, "workflow_novo",
      `Aprovação delegada: ${r.titulo}`,
      `${user.nome || "Um usuário"} delegou esta solicitação para você.`,
      id);

    const phone = await this.getUserPhone(dto.novoAprovadorId);
    if (phone) {
      const msg = `*Aprovação delegada para você*\n\n*Solicitação:* ${r.titulo}\n*De:* ${r.solicitante?.nome || "?"}\n*Delegado por:* ${user.nome || "?"}\n\n${this.appUrl}/dashboard/aprovacoes`;
      this.wa.sendMessageForOrg(user.organizationId, phone, msg).catch(() => {});
    }
    return updated;
  }

  async solicitarAjustes(id: string, dto: AjustesDto, user: any) {
    const r = await this.findOne(id, user);
    if (r.status !== "PENDENTE") throw new BadRequestException("Apenas solicitações pendentes podem receber pedido de ajuste");
    if (r.aprovadorAtualId !== user.id && !user.isMaster)
      throw new ForbiddenException("Apenas o aprovador atual ou master pode solicitar ajustes");

    const { v4: uuid } = await import("uuid");
    await (this.prisma as any).workflowApproval.create({
      data: {
        id: uuid(),
        requestId: id,
        aprovadorId: user.id,
        nivel: (r._count?.aprovacoes || 0) + 1,
        decisao: "AJUSTE_SOLICITADO",
        observacoes: dto.mensagem,
      },
    });

    await this.notify(r.solicitanteId, "workflow_ajuste",
      `Ajustes solicitados: ${r.titulo}`,
      dto.mensagem, id);

    const phone = await this.getUserPhone(r.solicitanteId);
    if (phone) {
      const msg = `*Ajustes solicitados na sua solicitação*\n\n*Solicitação:* ${r.titulo}\n*Mensagem:* ${dto.mensagem}\n\n${this.appUrl}/dashboard/aprovacoes`;
      this.wa.sendMessageForOrg(user.organizationId, phone, msg).catch(() => {});
    }
    return this.findOne(id, user);
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

  // ── Lembrete + escalonamento automatico (usado pelo scheduler) ─────────────

  /** Reenviar notificacao ao aprovador atual (chamado pelo cron 24h apos criacao). */
  async relembrarAprovador(r: any) {
    if (!r.aprovadorAtualId) return;
    const horas = Math.round((Date.now() - new Date(r.criadoEm).getTime()) / 3600000);
    await this.notify(r.aprovadorAtualId, "workflow_lembrete",
      "Lembrete: solicitacao aguardando ha mais de " + horas + "h",
      `${r.solicitante?.nome || "Usuario"} -> ${r.titulo}`,
      r.id);
    const phone = await this.getUserPhone(r.aprovadorAtualId);
    if (phone) {
      const valorTxt = r.valor && r.valor > 0 ? `\n*Valor:* R$ ${r.valor.toFixed(2).replace(".", ",")}` : "";
      const msg =
        `*Lembrete:* solicitacao aguardando sua aprovacao ha mais de ${horas}h\n\n` +
        `*De:* ${r.solicitante?.nome || "Usuario"}\n` +
        `*Assunto:* ${r.titulo}${valorTxt}\n\n` +
        `${this.appUrl}/dashboard/aprovacoes`;
      this.wa.sendMessageForOrg(r.organizationId, phone, msg).catch(() => {});
    }
    await (this.prisma as any).workflowRequest.update({
      where: { id: r.id },
      data: { ultimoLembreteEm: new Date() },
    });
  }

  /**
   * Escalonamento automatico apos 48h sem decisao:
   *  - Se o aprovador atual e o primario e existe backup configurado -> backup
   *  - Senao, se existe Master da org -> Master
   *  - Senao, mantem como esta (so loga)
   */
  async escalarPorTimeout(r: any) {
    if (!r.aprovadorAtualId) return;
    const orgId = r.organizationId;
    let novoAprovadorId: string | null = null;
    let motivoEscala = "timeout 48h";

    // Procura config do setor do solicitante
    const collab = await (this.prisma as any).collaborator.findFirst({
      where: { userId: r.solicitanteId, organizationId: orgId },
      select: { setorId: true },
    });
    const setorId = collab?.setorId
      || (await (this.prisma as any).userProfile.findUnique({ where: { userId: r.solicitanteId }, select: { setorId: true } }))?.setorId;

    if (setorId) {
      const cfg = await (this.prisma as any).aprovadorSetor.findUnique({ where: { setorId } });
      if (cfg && cfg.backupAprovadorId && cfg.backupAprovadorId !== r.aprovadorAtualId) {
        novoAprovadorId = cfg.backupAprovadorId;
        motivoEscala = "timeout 48h - escalado ao backup do setor";
      }
    }

    // Sem backup -> tenta Master da org
    if (!novoAprovadorId) {
      const master = await this.findMasterDaOrg(orgId, [r.aprovadorAtualId]);
      if (master) {
        novoAprovadorId = master;
        motivoEscala = "timeout 48h - escalado ao Master";
      }
    }

    if (!novoAprovadorId) {
      // Nao ha pra quem escalar — so registra que tentou (evita re-tentar todo tick)
      await (this.prisma as any).workflowRequest.update({
        where: { id: r.id }, data: { escaladoEm: new Date() },
      });
      return;
    }

    // Atualiza request + auditoria via WorkflowApproval (tipo ESCALADO)
    await (this.prisma as any).workflowApproval.create({
      data: {
        requestId: r.id,
        aprovadorId: r.aprovadorAtualId,
        nivel: (await (this.prisma as any).workflowApproval.count({ where: { requestId: r.id } })) + 1,
        decisao: "ESCALADO",
        observacoes: motivoEscala,
      },
    });
    await (this.prisma as any).workflowRequest.update({
      where: { id: r.id },
      data: { aprovadorAtualId: novoAprovadorId, escaladoEm: new Date(), ultimoLembreteEm: new Date() },
    });

    // Notifica o novo aprovador + solicitante
    await this.notify(novoAprovadorId, "workflow_escalado",
      "Solicitacao escalada para sua aprovacao",
      `"${r.titulo}" (sem decisao ha 48h)`, r.id);
    const phone = await this.getUserPhone(novoAprovadorId);
    if (phone) {
      const valorTxt = r.valor && r.valor > 0 ? `\n*Valor:* R$ ${r.valor.toFixed(2).replace(".", ",")}` : "";
      const msg =
        `*ESCALONAMENTO automatico*\n\n` +
        `Solicitacao sem decisao ha 48h foi escalada para voce:\n\n` +
        `*De:* ${r.solicitante?.nome || "Usuario"}\n` +
        `*Assunto:* ${r.titulo}${valorTxt}\n\n` +
        `${this.appUrl}/dashboard/aprovacoes`;
      this.wa.sendMessageForOrg(orgId, phone, msg).catch(() => {});
    }
    await this.notify(r.solicitanteId, "workflow_escalado",
      "Sua solicitacao foi escalada",
      `"${r.titulo}" passou para outro aprovador apos 48h sem decisao`, r.id);
  }

  /** Acha um Master/`*` ativo da org (excluindo IDs ja envolvidos). */
  private async findMasterDaOrg(orgId: string, excluir: string[] = []): Promise<string | null> {
    try {
      const masters = await (this.prisma as any).user.findMany({
        where: {
          organizationId: orgId, ativo: true,
          id: { notIn: excluir },
          userRoles: { some: { role: { permissions: { has: "*" } } } },
        },
        select: { id: true }, take: 1,
      });
      return masters[0]?.id || null;
    } catch { return null; }
  }

  // ── Matriz de aprovadores por setor ────────────────────────────────────────
  /** Apenas Master ou quem tem permissao 'aprovacoes:configurar' gerencia a matriz. */
  private canConfigureMatrix(user: any): boolean {
    return !!user?.isMaster
      || (user?.permissions || []).some((p: string) => p === "*" || p === "aprovacoes:configurar");
  }

  async listAprovadoresSetor(user: any) {
    const orgId = user?.organizationId;
    // Retorna TODOS os setores da org com a config (se houver) — UI montar tabela
    const setores = await (this.prisma as any).setor.findMany({
      where: { ...(orgId ? { organizationId: orgId } : {}), ativo: true },
      orderBy: { nome: "asc" },
      include: {
        responsavel: { select: { id: true, nome: true } },
        aprovadorConfig: {
          include: {
            aprovador:        { select: { id: true, nome: true, email: true, avatar: true } },
            backupAprovador:  { select: { id: true, nome: true, email: true, avatar: true } },
            configuradoPor:   { select: { id: true, nome: true } },
          },
        },
      },
    });
    const now = new Date();
    return setores.map((s: any) => {
      const cfg = s.aprovadorConfig;
      const backupAtivo = !!(cfg?.backupAprovadorId
        && cfg?.backupInicio && now >= new Date(cfg.backupInicio)
        && cfg?.backupFim    && now <= new Date(cfg.backupFim));
      const aprovadorEfetivo = cfg
        ? (backupAtivo ? cfg.backupAprovador : cfg.aprovador)
        : s.responsavel;
      return {
        setor: { id: s.id, nome: s.nome, cor: s.cor },
        config: cfg ? {
          id: cfg.id,
          aprovador: cfg.aprovador,
          backupAprovador: cfg.backupAprovador,
          backupInicio: cfg.backupInicio,
          backupFim: cfg.backupFim,
          backupAtivo,
          configuradoPor: cfg.configuradoPor,
          atualizadoEm: cfg.atualizadoEm,
        } : null,
        responsavelLegado: s.responsavel || null,
        aprovadorEfetivo, // quem realmente recebe AGORA (considera backup)
      };
    });
  }

  async upsertAprovadorSetor(setorId: string, dto: UpsertAprovadorSetorDto, user: any) {
    if (!this.canConfigureMatrix(user)) {
      throw new ForbiddenException("Sem permissao para configurar aprovadores");
    }
    const orgId = user?.organizationId;
    // Setor tem que pertencer ao tenant
    const setor = await (this.prisma as any).setor.findFirst({
      where: { id: setorId, ...(orgId ? { organizationId: orgId } : {}) },
    });
    if (!setor) throw new NotFoundException("Setor nao encontrado");
    if (!dto.aprovadorId) throw new BadRequestException("Aprovador primario obrigatorio");

    // Aprovador (e backup, se houver) precisam ser usuarios do mesmo tenant
    const aprovador = await (this.prisma as any).user.findFirst({
      where: { id: dto.aprovadorId, ...(orgId ? { organizationId: orgId } : {}), ativo: true },
    });
    if (!aprovador) throw new BadRequestException("Aprovador primario invalido");
    if (dto.backupAprovadorId) {
      const bk = await (this.prisma as any).user.findFirst({
        where: { id: dto.backupAprovadorId, ...(orgId ? { organizationId: orgId } : {}), ativo: true },
      });
      if (!bk) throw new BadRequestException("Aprovador backup invalido");
      if (dto.backupAprovadorId === dto.aprovadorId) {
        throw new BadRequestException("Backup deve ser diferente do aprovador primario");
      }
    }
    // Vigencia coerente
    const bi = dto.backupInicio ? new Date(dto.backupInicio) : null;
    const bf = dto.backupFim    ? new Date(dto.backupFim)    : null;
    if (bi && bf && bi > bf) {
      throw new BadRequestException("Backup: data de inicio nao pode ser depois da data fim");
    }

    return (this.prisma as any).aprovadorSetor.upsert({
      where: { setorId },
      create: {
        organizationId: orgId,
        setorId,
        aprovadorId: dto.aprovadorId,
        backupAprovadorId: dto.backupAprovadorId || null,
        backupInicio: bi,
        backupFim: bf,
        configuradoPorId: user.id,
      },
      update: {
        aprovadorId: dto.aprovadorId,
        backupAprovadorId: dto.backupAprovadorId || null,
        backupInicio: bi,
        backupFim: bf,
        configuradoPorId: user.id,
      },
      include: {
        aprovador:       { select: { id: true, nome: true, email: true } },
        backupAprovador: { select: { id: true, nome: true, email: true } },
      },
    });
  }

  async removeAprovadorSetor(setorId: string, user: any) {
    if (!this.canConfigureMatrix(user)) {
      throw new ForbiddenException("Sem permissao para configurar aprovadores");
    }
    const orgId = user?.organizationId;
    const cfg = await (this.prisma as any).aprovadorSetor.findUnique({
      where: { setorId },
      include: { setor: { select: { organizationId: true } } },
    });
    if (!cfg) throw new NotFoundException("Configuracao nao encontrada");
    if (orgId && cfg.setor?.organizationId !== orgId) {
      throw new NotFoundException("Configuracao nao encontrada");
    }
    await (this.prisma as any).aprovadorSetor.delete({ where: { setorId } });
    return { ok: true };
  }
}

class UpsertAprovadorSetorDto {
  aprovadorId: string;
  backupAprovadorId?: string;
  backupInicio?: string;
  backupFim?: string;
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

  @Patch(":id/delegar")
  delegar(@Req() req: any, @Param("id") id: string, @Body() dto: DelegarDto) {
    return this.svc.delegar(id, dto, req.user);
  }

  @Patch(":id/ajustes")
  solicitarAjustes(@Req() req: any, @Param("id") id: string, @Body() dto: AjustesDto) {
    return this.svc.solicitarAjustes(id, dto, req.user);
  }

  @Delete(":id")
  remove(@Req() req: any, @Param("id") id: string) {
    return this.svc.remove(id, req.user);
  }
}

// ── Scheduler: lembrete 24h + escalonamento automatico 48h ──────────────────
@Injectable()
export class WorkflowReminderScheduler implements OnModuleInit {
  private readonly logger = new Logger(WorkflowReminderScheduler.name);

  constructor(private svc: WorkflowsService, private prisma: PrismaService) {}

  onModuleInit() {
    // Primeiro tick depois de 60s; depois a cada 30 min
    setTimeout(() => this.tick().catch(() => {}), 60_000);
    setInterval(() => this.tick().catch(() => {}), 30 * 60 * 1000);
    this.logger.log("WorkflowReminderScheduler iniciado (30min interval)");
  }

  async tick() {
    const now = Date.now();
    const H24 = 24 * 3600 * 1000;
    const H48 = 48 * 3600 * 1000;

    // Pega TODAS as PENDENTES com mais de 24h
    const pendentes = await (this.prisma as any).workflowRequest.findMany({
      where: { status: "PENDENTE", criadoEm: { lt: new Date(now - H24) } },
      include: {
        solicitante:    { select: { id: true, nome: true } },
        aprovadorAtual: { select: { id: true, nome: true } },
      },
    });

    for (const r of pendentes) {
      const idadeMs = now - new Date(r.criadoEm).getTime();
      const semLembrete = !r.ultimoLembreteEm;
      const lembreteHaMais24h = r.ultimoLembreteEm && (now - new Date(r.ultimoLembreteEm).getTime()) > H24;
      const elegivelLembrete = semLembrete && idadeMs >= H24 && idadeMs < H48;
      const elegivelEscalada = !r.escaladoEm && idadeMs >= H48;
      const elegivelRelembre = r.escaladoEm && lembreteHaMais24h; // depois de escalado, lembra a cada 24h

      try {
        if (elegivelEscalada) {
          await this.svc.escalarPorTimeout(r);
        } else if (elegivelLembrete || elegivelRelembre) {
          await this.svc.relembrarAprovador(r);
        }
      } catch (e: any) {
        this.logger.warn(`tick: request ${r.id} -> ${e?.message || e}`);
      }
    }
  }
}

// ── Controller separado: matriz de aprovadores por setor ────────────────────
@Controller("workflows/aprovadores-setor")
@UseGuards(AuthGuard("jwt"))
export class AprovadoresSetorController {
  constructor(private svc: WorkflowsService) {}

  @Get()
  list(@Req() req: any) {
    return this.svc.listAprovadoresSetor(req.user);
  }

  @Put(":setorId")
  upsert(@Req() req: any, @Param("setorId") setorId: string, @Body() dto: UpsertAprovadorSetorDto) {
    return this.svc.upsertAprovadorSetor(setorId, dto, req.user);
  }

  @Delete(":setorId")
  remove(@Req() req: any, @Param("setorId") setorId: string) {
    return this.svc.removeAprovadorSetor(setorId, req.user);
  }
}

@Module({
  imports: [NotificationsModule],
  controllers: [WorkflowsController, AprovadoresSetorController],
  providers: [WorkflowsService, WhatsAppService, WorkflowReminderScheduler],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
