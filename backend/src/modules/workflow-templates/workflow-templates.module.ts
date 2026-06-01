import {
  Module, Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, Req, Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { v4 as uuid } from "uuid";

/* ── Types ── */
export interface WfStep {
  id: string;
  nome: string;
  tipo: "inicio" | "tarefa" | "aprovacao" | "notificacao" | "condicao" | "fim";
  responsavel?: string;
  descricao?: string;
  prazo?: number; // dias
  obrigatorio?: boolean;
  proximaEtapaId?: string;
  etapaAlternativaId?: string; // para condicao: se NAO
}

class CreateTemplateDto {
  nome: string;
  descricao?: string;
  tipo?: string;
  icone?: string;
  cor?: string;
  etapas?: WfStep[];
}

class UpdateTemplateDto {
  nome?: string;
  descricao?: string;
  tipo?: string;
  icone?: string;
  cor?: string;
  ativo?: boolean;
  etapas?: WfStep[];
}

@Injectable()
export class WorkflowTemplatesService {
  constructor(private prisma: PrismaService) {}

  private db() { return this.prisma as any; }
  private orgScope(user: any) { return user?.organizationId ? { organizationId: user.organizationId } : {}; }

  async findAll(user: any, tipo?: string) {
    const where: any = { ...this.orgScope(user) };
    if (tipo) where.tipo = tipo;
    return this.db().workflowTemplate.findMany({
      where,
      include: { criadoPor: { select: { id: true, nome: true } } },
      orderBy: [{ tipo: "asc" }, { nome: "asc" }],
    });
  }

  async findOne(id: string, user: any) {
    const t = await this.db().workflowTemplate.findFirst({ where: { id, ...this.orgScope(user) } });
    if (!t) throw new NotFoundException("Template não encontrado");
    return t;
  }

  async create(dto: CreateTemplateDto, user: any) {
    if (!dto.nome?.trim()) throw new BadRequestException("Nome obrigatório");
    return this.db().workflowTemplate.create({
      data: {
        id: uuid(),
        organizationId: user.organizationId,
        nome: dto.nome.trim(),
        descricao: dto.descricao || null,
        tipo: dto.tipo || "outro",
        icone: dto.icone || null,
        cor: dto.cor || "#a78bfa",
        etapas: dto.etapas || [],
        criadoPorId: user.id,
      },
    });
  }

  async update(id: string, dto: UpdateTemplateDto, user: any) {
    await this.findOne(id, user);
    return this.db().workflowTemplate.update({
      where: { id },
      data: {
        ...(dto.nome !== undefined ? { nome: dto.nome.trim() } : {}),
        ...(dto.descricao !== undefined ? { descricao: dto.descricao } : {}),
        ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
        ...(dto.icone !== undefined ? { icone: dto.icone } : {}),
        ...(dto.cor !== undefined ? { cor: dto.cor } : {}),
        ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
        ...(dto.etapas !== undefined ? { etapas: dto.etapas } : {}),
      },
    });
  }

  async remove(id: string, user: any) {
    const t = await this.findOne(id, user);
    if (t.organizationId !== user.organizationId && !user.isMaster)
      throw new ForbiddenException("Sem permissão");
    return this.db().workflowTemplate.delete({ where: { id } });
  }

  // Seed default templates for a new org (called from organizations module or on first access)
  async seedDefaults(organizationId: string, criadoPorId: string) {
    const existing = await this.db().workflowTemplate.count({ where: { organizationId } });
    if (existing > 0) return;

    const defaults = [
      {
        nome: "Onboarding de Funcionário", tipo: "rh", cor: "#34d399", icone: "👤",
        descricao: "Processo completo de integração de novo colaborador",
        etapas: [
          { id: "1", nome: "Início", tipo: "inicio", proximaEtapaId: "2" },
          { id: "2", nome: "Criar conta de usuário", tipo: "tarefa", responsavel: "TI", prazo: 1, obrigatorio: true, proximaEtapaId: "3" },
          { id: "3", nome: "Configurar equipamentos", tipo: "tarefa", responsavel: "TI", prazo: 2, proximaEtapaId: "4" },
          { id: "4", nome: "Aprovação RH", tipo: "aprovacao", responsavel: "RH", obrigatorio: true, proximaEtapaId: "5" },
          { id: "5", nome: "Treinamento inicial", tipo: "tarefa", responsavel: "Gestor", prazo: 5, proximaEtapaId: "6" },
          { id: "6", nome: "Notificar equipe", tipo: "notificacao", proximaEtapaId: "7" },
          { id: "7", nome: "Conclusão", tipo: "fim" },
        ],
      },
      {
        nome: "Offboarding de Funcionário", tipo: "rh", cor: "#f87171", icone: "🚪",
        descricao: "Processo de desligamento e revogação de acessos",
        etapas: [
          { id: "1", nome: "Início", tipo: "inicio", proximaEtapaId: "2" },
          { id: "2", nome: "Aprovação do desligamento", tipo: "aprovacao", responsavel: "RH", obrigatorio: true, proximaEtapaId: "3" },
          { id: "3", nome: "Revogar acessos", tipo: "tarefa", responsavel: "TI", prazo: 1, obrigatorio: true, proximaEtapaId: "4" },
          { id: "4", nome: "Recolher equipamentos", tipo: "tarefa", responsavel: "TI", prazo: 3, proximaEtapaId: "5" },
          { id: "5", nome: "Entrevista de desligamento", tipo: "tarefa", responsavel: "RH", prazo: 5, proximaEtapaId: "6" },
          { id: "6", nome: "Conclusão", tipo: "fim" },
        ],
      },
      {
        nome: "Solicitação de Compra", tipo: "compras", cor: "#fbbf24", icone: "🛒",
        descricao: "Fluxo de aprovação para aquisição de bens e serviços",
        etapas: [
          { id: "1", nome: "Início", tipo: "inicio", proximaEtapaId: "2" },
          { id: "2", nome: "Verificar orçamento", tipo: "tarefa", responsavel: "Financeiro", prazo: 2, proximaEtapaId: "3" },
          { id: "3", nome: "Aprovação do gestor", tipo: "aprovacao", responsavel: "Gestor", obrigatorio: true, proximaEtapaId: "4" },
          { id: "4", nome: "Valor > R$ 5.000?", tipo: "condicao", proximaEtapaId: "5", etapaAlternativaId: "6" },
          { id: "5", nome: "Aprovação diretoria", tipo: "aprovacao", responsavel: "Diretoria", obrigatorio: true, proximaEtapaId: "6" },
          { id: "6", nome: "Emitir pedido de compra", tipo: "tarefa", responsavel: "Compras", prazo: 3, proximaEtapaId: "7" },
          { id: "7", nome: "Conclusão", tipo: "fim" },
        ],
      },
      {
        nome: "Implantação de Sistema", tipo: "ti", cor: "#60a5fa", icone: "💻",
        descricao: "Processo padrão para implantação de novos sistemas",
        etapas: [
          { id: "1", nome: "Início", tipo: "inicio", proximaEtapaId: "2" },
          { id: "2", nome: "Levantamento de requisitos", tipo: "tarefa", responsavel: "TI", prazo: 5, proximaEtapaId: "3" },
          { id: "3", nome: "Aprovação do escopo", tipo: "aprovacao", responsavel: "Gestor", obrigatorio: true, proximaEtapaId: "4" },
          { id: "4", nome: "Configuração do ambiente", tipo: "tarefa", responsavel: "TI", prazo: 3, proximaEtapaId: "5" },
          { id: "5", nome: "Testes e homologação", tipo: "tarefa", responsavel: "TI", prazo: 5, proximaEtapaId: "6" },
          { id: "6", nome: "Treinamento de usuários", tipo: "tarefa", responsavel: "TI", prazo: 3, proximaEtapaId: "7" },
          { id: "7", nome: "Go live", tipo: "tarefa", responsavel: "TI", prazo: 1, proximaEtapaId: "8" },
          { id: "8", nome: "Conclusão", tipo: "fim" },
        ],
      },
    ];

    for (const d of defaults) {
      await this.db().workflowTemplate.create({
        data: { id: uuid(), organizationId, criadoPorId, ...d },
      });
    }
  }
}

@Controller("workflow-templates")
@UseGuards(AuthGuard("jwt"))
export class WorkflowTemplatesController {
  constructor(private svc: WorkflowTemplatesService) {}

  @Get()
  findAll(@Req() req: any, @Query("tipo") tipo?: string) {
    return this.svc.findAll(req.user, tipo);
  }

  @Get("seed")
  async seed(@Req() req: any) {
    if (!req.user?.organizationId) return { ok: false };
    await this.svc.seedDefaults(req.user.organizationId, req.user.id);
    return { ok: true };
  }

  @Get(":id")
  findOne(@Req() req: any, @Param("id") id: string) {
    return this.svc.findOne(id, req.user);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateTemplateDto) {
    return this.svc.create(dto, req.user);
  }

  @Put(":id")
  update(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateTemplateDto) {
    return this.svc.update(id, dto, req.user);
  }

  @Delete(":id")
  remove(@Req() req: any, @Param("id") id: string) {
    return this.svc.remove(id, req.user);
  }
}

@Module({
  controllers: [WorkflowTemplatesController],
  providers: [WorkflowTemplatesService],
  exports: [WorkflowTemplatesService],
})
export class WorkflowTemplatesModule {}
