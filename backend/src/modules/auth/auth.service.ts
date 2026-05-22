import { Injectable, UnauthorizedException, OnModuleInit, Logger, NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { CacheService } from "../cache/cache.service";
import { WhatsAppService } from "../notifications/whatsapp.service";
import { EmailService } from "../notifications/email.service";
import * as bcrypt from "bcryptjs";

// Todas as permissões do sistema no formato "recurso:acao"
const ALL_PERMISSIONS: { recurso: string; acao: string; descricao: string }[] = [
  { recurso: "agenda",        acao: "ver",        descricao: "Ver agenda" },
  { recurso: "agenda",        acao: "criar",       descricao: "Criar eventos" },
  { recurso: "agenda",        acao: "editar",      descricao: "Editar eventos" },
  { recurso: "agenda",        acao: "deletar",     descricao: "Deletar eventos" },
  { recurso: "projetos",      acao: "ver",         descricao: "Ver projetos" },
  { recurso: "projetos",      acao: "criar",       descricao: "Criar projetos" },
  { recurso: "projetos",      acao: "editar",      descricao: "Editar projetos" },
  { recurso: "projetos",      acao: "deletar",     descricao: "Deletar projetos" },
  { recurso: "projetos",      acao: "gerenciar",   descricao: "Gerenciar membros e configurações do projeto" },
  { recurso: "crm",           acao: "ver",         descricao: "Ver CRM / clientes" },
  { recurso: "crm",           acao: "criar",       descricao: "Criar negócios/leads" },
  { recurso: "crm",           acao: "editar",      descricao: "Editar negócios/leads" },
  { recurso: "crm",           acao: "deletar",     descricao: "Deletar negócios/leads" },
  { recurso: "keep",          acao: "ver",         descricao: "Ver notas" },
  { recurso: "keep",          acao: "criar",       descricao: "Criar notas" },
  { recurso: "keep",          acao: "editar",      descricao: "Editar notas" },
  { recurso: "keep",          acao: "deletar",     descricao: "Deletar notas" },
  { recurso: "gantt",         acao: "ver",         descricao: "Ver linha do tempo" },
  { recurso: "relatorios",    acao: "ver",         descricao: "Ver relatórios" },
  { recurso: "chamados",      acao: "ver",         descricao: "Ver chamados" },
  { recurso: "chamados",      acao: "criar",       descricao: "Abrir chamados" },
  { recurso: "chamados",      acao: "editar",      descricao: "Editar chamados" },
  { recurso: "chamados",      acao: "fechar",      descricao: "Fechar/resolver chamados" },
  { recurso: "chamados",      acao: "atribuir",    descricao: "Atribuir chamados a atendentes" },
  { recurso: "whatsapp",      acao: "ver",         descricao: "Ver configurações WhatsApp" },
  { recurso: "whatsapp",      acao: "configurar",  descricao: "Configurar integração WhatsApp" },
  { recurso: "usuarios",      acao: "ver",         descricao: "Ver usuários" },
  { recurso: "usuarios",      acao: "criar",       descricao: "Criar usuários" },
  { recurso: "usuarios",      acao: "editar",      descricao: "Editar usuários" },
  { recurso: "usuarios",      acao: "desativar",   descricao: "Ativar/desativar usuários" },
  { recurso: "usuarios",      acao: "permissoes",  descricao: "Gerenciar permissões de usuários" },
  { recurso: "configuracoes", acao: "ver",         descricao: "Ver configurações do sistema" },
  { recurso: "configuracoes", acao: "editar",      descricao: "Editar configurações do sistema" },
  { recurso: "historico",     acao: "ver",         descricao: "Ver histórico de auditoria" },
  { recurso: "setores",       acao: "gerenciar",   descricao: "Gerenciar setores" },
  { recurso: "clientes",      acao: "ver",         descricao: "Ver clientes" },
  { recurso: "clientes",      acao: "criar",       descricao: "Criar clientes" },
  { recurso: "clientes",      acao: "editar",      descricao: "Editar clientes" },
  { recurso: "clientes",      acao: "deletar",     descricao: "Deletar clientes" },
  { recurso: "orcamento",     acao: "ver",         descricao: "Ver orçamentos" },
  { recurso: "orcamento",     acao: "planejar",    descricao: "Planejar orçamentos (CAPEX/OPEX)" },
  { recurso: "orcamento",     acao: "lancar",      descricao: "Lançar valores realizados" },
  { recurso: "orcamento",     acao: "aprovar",     descricao: "Aprovar orçamentos" },
  { recurso: "orcamento",     acao: "admin",       descricao: "Administrar ciclos e configurações" },
  { recurso: "fornecedores",  acao: "ver",         descricao: "Ver cadastro de fornecedores" },
  { recurso: "fornecedores",  acao: "criar",       descricao: "Cadastrar novos fornecedores" },
  { recurso: "fornecedores",  acao: "editar",      descricao: "Editar fornecedores" },
  { recurso: "fornecedores",  acao: "excluir",     descricao: "Excluir fornecedores" },
  // Relatórios extras
  { recurso: "relatorios",    acao: "exportar",    descricao: "Exportar relatórios em PDF/Excel" },
  { recurso: "relatorios",    acao: "criar",       descricao: "Criar relatórios personalizados" },
  // Ativos corporativos
  { recurso: "ativos",        acao: "ver",         descricao: "Ver ativos corporativos" },
  { recurso: "ativos",        acao: "criar",       descricao: "Cadastrar novos ativos" },
  { recurso: "ativos",        acao: "editar",      descricao: "Editar ativos" },
  { recurso: "ativos",        acao: "excluir",     descricao: "Excluir ativos" },
  { recurso: "ativos",        acao: "mover",       descricao: "Realocar ativos entre setores" },
  // Solicitações corporativas
  { recurso: "solicitacoes",  acao: "ver",         descricao: "Ver solicitações corporativas" },
  { recurso: "solicitacoes",  acao: "criar",       descricao: "Abrir solicitações" },
  { recurso: "solicitacoes",  acao: "editar",      descricao: "Editar solicitações" },
  { recurso: "solicitacoes",  acao: "aprovar",     descricao: "Aprovar/rejeitar solicitações" },
  // Colaboradores (Workforce)
  { recurso: "colaboradores", acao: "ver",         descricao: "Ver colaboradores da organização" },
  { recurso: "colaboradores", acao: "criar",       descricao: "Criar colaboradores" },
  { recurso: "colaboradores", acao: "editar",      descricao: "Editar colaboradores" },
  { recurso: "colaboradores", acao: "excluir",     descricao: "Remover colaboradores" },
  // Base de conhecimento
  { recurso: "conhecimento",  acao: "ver",         descricao: "Ver base de conhecimento" },
  { recurso: "conhecimento",  acao: "criar",       descricao: "Criar artigos" },
  { recurso: "conhecimento",  acao: "editar",      descricao: "Editar artigos" },
  { recurso: "conhecimento",  acao: "excluir",     descricao: "Excluir artigos" },
  { recurso: "conhecimento",  acao: "publicar",    descricao: "Publicar artigos na base" },
  // Portal do cliente
  { recurso: "portal",        acao: "acessar",     descricao: "Acessar portal do cliente" },
  // SLA
  { recurso: "sla",           acao: "ver",         descricao: "Ver configurações SLA" },
  { recurso: "sla",           acao: "gerenciar",   descricao: "Gerenciar regras e acordos SLA" },
  // Automações
  { recurso: "automacoes",    acao: "ver",         descricao: "Ver automações configuradas" },
  { recurso: "automacoes",    acao: "criar",       descricao: "Criar automações" },
  { recurso: "automacoes",    acao: "editar",      descricao: "Editar automações" },
  { recurso: "automacoes",    acao: "excluir",     descricao: "Excluir automações" },
];

// Permissões base — todo usuário recebe automaticamente, independente do papel
const BASE_PERMISSIONS = [
  "agenda:ver", "agenda:criar", "agenda:editar", "agenda:deletar",
  "whatsapp:ver",
];

// Permissões por papel padrão (master ignora — tem acesso total via isMaster)
// As BASE_PERMISSIONS são adicionadas automaticamente no resolvePermissions()
// e NÃO precisam ser repetidas aqui, mas estão inclusas para clareza na UI
const ROLE_DEFAULTS: Record<string, { nivel: number; descricao: string; permissoes: string[] }> = {
  administrador: {
    nivel: 90,
    descricao: "Acesso total ao sistema, gerenciamento de usuários e configurações",
    permissoes: ALL_PERMISSIONS.map(p => `${p.recurso}:${p.acao}`),
  },
  gestor: {
    nivel: 60,
    descricao: "Gestão de projetos, equipes, relatórios e chamados",
    permissoes: [
      "agenda:ver","agenda:criar","agenda:editar","agenda:deletar",
      "projetos:ver","projetos:criar","projetos:editar","projetos:deletar","projetos:gerenciar",
      "crm:ver","crm:criar","crm:editar","crm:deletar",
      "keep:ver","keep:criar","keep:editar",
      "gantt:ver",
      "relatorios:ver",
      "chamados:ver","chamados:criar","chamados:editar","chamados:fechar","chamados:atribuir",
      "whatsapp:ver",
      "usuarios:ver",
      "clientes:ver","clientes:criar","clientes:editar",
      "setores:gerenciar",
      "orcamento:ver","orcamento:planejar","orcamento:lancar","orcamento:aprovar","orcamento:admin",
      "fornecedores:ver","fornecedores:criar","fornecedores:editar","fornecedores:excluir",
      "relatorios:exportar","relatorios:criar",
      "ativos:ver","ativos:criar","ativos:editar","ativos:mover",
      "solicitacoes:ver","solicitacoes:criar","solicitacoes:editar","solicitacoes:aprovar",
      "colaboradores:ver","colaboradores:criar","colaboradores:editar","colaboradores:excluir",
      "conhecimento:ver","conhecimento:criar","conhecimento:editar","conhecimento:publicar",
      "sla:ver","sla:gerenciar",
      "automacoes:ver","automacoes:criar","automacoes:editar","automacoes:excluir",
    ],
  },
  analista: {
    nivel: 30,
    descricao: "Perfil operacional padrão — agenda, KEEP, projetos e tarefas",
    permissoes: [
      "agenda:ver","agenda:criar","agenda:editar","agenda:deletar",
      "projetos:ver","projetos:criar","projetos:editar",
      "keep:ver","keep:criar","keep:editar","keep:deletar",
      "gantt:ver",
      "chamados:ver","chamados:criar",
      "whatsapp:ver",
      "clientes:ver",
      "solicitacoes:ver","solicitacoes:criar",
      "conhecimento:ver","conhecimento:criar",
      "ativos:ver",
    ],
  },
  tecnico: {
    nivel: 20,
    descricao: "Foco em chamados e execução operacional",
    permissoes: [
      "agenda:ver","agenda:criar","agenda:editar","agenda:deletar",
      "chamados:ver","chamados:criar","chamados:editar","chamados:fechar",
      "whatsapp:ver",
      "clientes:ver",
      "solicitacoes:ver","solicitacoes:criar",
      "conhecimento:ver",
      "ativos:ver",
    ],
  },
  visualizador: {
    nivel: 10,
    descricao: "Somente leitura em todos os módulos",
    permissoes: [
      ...ALL_PERMISSIONS.filter(p => p.acao === "ver").map(p => `${p.recurso}:${p.acao}`),
      "whatsapp:ver",
    ],
  },
  supervisor: {
    nivel: 50,
    descricao: "Supervisiona equipes e monitora operações — visão ampla com edição limitada",
    permissoes: [
      "agenda:ver","agenda:criar","agenda:editar","agenda:deletar",
      "projetos:ver","projetos:criar","projetos:editar",
      "crm:ver","crm:criar","crm:editar",
      "keep:ver","keep:criar","keep:editar","keep:deletar",
      "gantt:ver",
      "relatorios:ver","relatorios:exportar",
      "chamados:ver","chamados:criar","chamados:editar","chamados:fechar","chamados:atribuir",
      "whatsapp:ver",
      "usuarios:ver",
      "clientes:ver","clientes:criar","clientes:editar",
      "orcamento:ver",
      "fornecedores:ver",
      "solicitacoes:ver","solicitacoes:criar","solicitacoes:editar","solicitacoes:aprovar",
      "colaboradores:ver","colaboradores:criar","colaboradores:editar",
      "conhecimento:ver","conhecimento:criar","conhecimento:editar",
      "sla:ver",
      "ativos:ver","ativos:criar","ativos:editar",
    ],
  },
  operador: {
    nivel: 15,
    descricao: "Perfil operacional básico — executa tarefas atribuídas em chamados e projetos",
    permissoes: [
      "agenda:ver","agenda:criar","agenda:editar",
      "projetos:ver",
      "keep:ver","keep:criar",
      "chamados:ver","chamados:criar","chamados:editar",
      "whatsapp:ver",
      "clientes:ver",
      "solicitacoes:ver","solicitacoes:criar",
      "conhecimento:ver",
      "ativos:ver",
    ],
  },
  auditor: {
    nivel: 40,
    descricao: "Acesso somente-leitura a todos os módulos incluindo trilha de auditoria",
    permissoes: [
      ...ALL_PERMISSIONS.filter(p => p.acao === "ver").map(p => `${p.recurso}:${p.acao}`),
      "relatorios:exportar",
    ],
  },
  cliente_portal: {
    nivel: 5,
    descricao: "Acesso ao portal do cliente — abertura e acompanhamento de chamados próprios",
    permissoes: [
      "portal:acessar",
      "chamados:ver","chamados:criar",
      "conhecimento:ver",
      "whatsapp:ver",
    ],
  },
};

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private cache: CacheService,
    private wa: WhatsAppService,
    private email: EmailService,
  ) {}

  async onModuleInit() {
    try {
      await this.seedMaster();
    } catch (e) {
      this.logger.warn("Seed master erro: " + e.message);
    }
  }

  private async seedMaster() {
    const masterEmail = this.config.get("MASTER_EMAIL", "sa@orkestri.local");
    const masterPassword = this.config.get("MASTER_PASSWORD", "123@TBR");
    const masterNome = this.config.get("MASTER_NOME", "SA");

    await this.seedPermissionsAndRoles();

    // Garante que role master existe
    let masterRole = await this.prisma.role.findUnique({ where: { nome: "master" } });
    if (!masterRole) {
      masterRole = await this.prisma.role.create({
        data: { nome: "master", descricao: "Acesso total ao sistema", isMaster: true, nivel: 100 }
      });
      this.logger.log("Role master criada");
    } else if ((masterRole as any).nivel !== 100) {
      await this.prisma.role.update({ where: { id: masterRole.id }, data: { nivel: 100 } });
    }

    const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";
    const exists = await this.prisma.user.findFirst({ where: { email: masterEmail } });
    if (!exists) {
      const hash = await bcrypt.hash(masterPassword, 12);
      await this.prisma.user.create({
        data: {
          nome: masterNome,
          email: masterEmail,
          senhaHash: hash,
          ativo: true,
          organizationId: DEFAULT_ORG,
          userRoles: { create: { roleId: masterRole.id } },
        } as any,
      });
      this.logger.log("Usuario master criado: " + masterEmail);
    } else {
      // Sempre sincroniza hash, desbloqueia e garante ativo
      const hash = await bcrypt.hash(masterPassword, 12);
      await this.prisma.user.update({
        where: { id: exists.id },
        data: { senhaHash: hash, bloqueado: false, tentativasFalhas: 0, ativo: true } as any,
      });
      const hasRole = await this.prisma.userRole.findUnique({
        where: { userId_roleId: { userId: exists.id, roleId: masterRole.id } }
      });
      if (!hasRole) {
        await this.prisma.userRole.create({ data: { userId: exists.id, roleId: masterRole.id } });
        this.logger.log("Role master atribuida ao usuario: " + masterEmail);
      }
      this.logger.log("Usuario master verificado: " + masterEmail);
    }
  }

  private async seedPermissionsAndRoles() {
    // Migra nomes de papéis legados para os nomes corretos
    const legacyMap: Record<string, string> = {
      admin: "administrador", gerente: "gestor",
      colaborador: "analista", atendente: "tecnico",
    };
    for (const [old, novo] of Object.entries(legacyMap)) {
      const existing = await this.prisma.role.findUnique({ where: { nome: old } });
      const conflict = await this.prisma.role.findUnique({ where: { nome: novo } });
      if (existing && !conflict) {
        await this.prisma.role.update({ where: { id: existing.id }, data: { nome: novo } });
        this.logger.log(`Role '${old}' renomeada para '${novo}'`);
      }
    }

    // Cria/atualiza todas as permissões
    const permMap: Record<string, string> = {};
    for (const p of ALL_PERMISSIONS) {
      const perm = await this.prisma.permission.upsert({
        where: { recurso_acao: { recurso: p.recurso, acao: p.acao } },
        create: { id: require("crypto").randomUUID(), recurso: p.recurso, acao: p.acao, descricao: p.descricao },
        update: { descricao: p.descricao },
      });
      permMap[`${p.recurso}:${p.acao}`] = perm.id;
    }

    // Cria/atualiza papéis padrão e associa permissões
    for (const [nome, cfg] of Object.entries(ROLE_DEFAULTS)) {
      let role = await this.prisma.role.findUnique({ where: { nome } });
      if (!role) {
        role = await this.prisma.role.create({
          data: { id: require("crypto").randomUUID(), nome, descricao: this.roleDesc(nome), isMaster: false, nivel: cfg.nivel }
        });
        this.logger.log(`Role '${nome}' criada`);
      } else {
        await this.prisma.role.update({ where: { id: role.id }, data: { nivel: cfg.nivel } });
      }

      // Sincroniza permissões do papel
      const existingPerms = await this.prisma.rolePermission.findMany({ where: { roleId: role.id } });
      const existingIds = new Set(existingPerms.map(rp => rp.permissionId));
      const desiredIds = new Set(cfg.permissoes.map(p => permMap[p]).filter(Boolean));

      // Adiciona faltantes
      for (const permId of desiredIds) {
        if (!existingIds.has(permId)) {
          await this.prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permId } });
        }
      }
    }

    this.logger.log("Permissões e papéis padrão verificados");
  }

  private roleDesc(nome: string) {
    return (ROLE_DEFAULTS[nome] as any)?.descricao || nome;
  }

  // Resolve as permissões efetivas de um usuário (base + papéis + overrides)
  // Sempre busca do cache/banco — nunca do JWT — para que mudanças de papel sejam imediatas
  async resolvePermissions(userId: string): Promise<string[]> {
    const cacheKey = `cache:permissions:${userId}`;
    const cached = await this.cache.get<string[]>(cacheKey);
    if (cached) return cached;

    const user = await (this.prisma.user.findUnique as any)({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: { rolePermissions: { include: { permission: true } } }
            }
          }
        },
        permissionOverrides: { include: { permission: true } },
      },
    }) as {
      userRoles: { role: { isMaster: boolean; rolePermissions: { permission: { recurso: string; acao: string } }[] } }[];
      permissionOverrides: { conceder: boolean; permission: { recurso: string; acao: string } }[];
    } | null;

    if (!user) return [];

    let result: string[];

    if (user.userRoles.some(ur => ur.role.isMaster)) {
      result = ["*"];
    } else {
      const perms = new Set<string>(BASE_PERMISSIONS);
      for (const ur of user.userRoles) {
        for (const rp of ur.role.rolePermissions) {
          perms.add(`${rp.permission.recurso}:${rp.permission.acao}`);
        }
      }
      for (const ov of user.permissionOverrides) {
        const key = `${ov.permission.recurso}:${ov.permission.acao}`;
        if (ov.conceder) perms.add(key);
        else perms.delete(key);
      }
      result = Array.from(perms);
    }

    await this.cache.set(cacheKey, result, 300);
    return result;
  }

  async invalidatePermissionsCache(userId: string): Promise<void> {
    await this.cache.del(`cache:permissions:${userId}`);
  }

  async login(email: string, senha: string) {
    const user = await this.prisma.user.findFirst({
      where: { email },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user || !user.ativo) throw new UnauthorizedException("Credenciais inválidas");
    const isMasterUser = user.userRoles.some(ur => ur.role.isMaster);
    if ((user as any).bloqueado) {
      if (isMasterUser) {
        // Master nunca fica bloqueado permanentemente
        await this.prisma.user.update({ where: { id: user.id }, data: { bloqueado: false, tentativasFalhas: 0 } as any });
      } else {
        throw new UnauthorizedException("Conta bloqueada. Contate o Administrador.");
      }
    }
    const valid = await bcrypt.compare(senha, user.senhaHash);
    if (!valid) {
      if (!isMasterUser) {
        const novasTentativas = ((user as any).tentativasFalhas || 0) + 1;
        const bloquear = novasTentativas >= 5;
        await this.prisma.user.update({
          where: { id: user.id },
          data: { tentativasFalhas: novasTentativas, ...(bloquear ? { bloqueado: true } : {}) } as any,
        });
        if (bloquear) throw new UnauthorizedException("Conta bloqueada após múltiplas tentativas. Contate o Administrador.");
      }
      throw new UnauthorizedException("Credenciais inválidas");
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { ultimoLogin: new Date(), tentativasFalhas: 0 } as any,
    });
    this.logAudit(user.id, "auth", "users", user.id, "LOGIN", `Login bem-sucedido: ${user.email}`, (user as any).organizationId).catch(() => {});
    const roles = user.userRoles.map(ur => ur.role.nome);
    const isMaster = user.userRoles.some(ur => ur.role.isMaster);
    const isSuperAdmin = await this.checkGlobalSuperAdmin(user.id, user.email);
    const permissions = await this.resolvePermissions(user.id);
    const primeiroAcesso = (user as any).primeiroAcesso ?? true;
    const organizationId = (user as any).organizationId;
    const payload = { sub: user.id, email: user.email, organizationId, roles, isMaster, isSuperAdmin, permissions };
    const accessToken = this.jwt.sign(payload, { secret: this.config.get("JWT_SECRET"), expiresIn: "8h" });
    const refreshToken = this.jwt.sign({ sub: user.id }, { secret: this.config.get("JWT_REFRESH_SECRET"), expiresIn: "7d" });
    return {
      accessToken, refreshToken, primeiroAcesso,
      user: { id: user.id, nome: user.nome, email: user.email, avatar: user.avatar, organizationId, roles, isMaster, isSuperAdmin, permissions, primeiroAcesso },
    };
  }

  /**
   * Super Admin GLOBAL — único usuário com visão de todas as organizações.
   * NÃO confundir com "master" (papel administrativo dentro de um tenant).
   * Determinado por: e-mail do SA global OU registro em super_admins.
   */
  async checkGlobalSuperAdmin(userId: string, email: string): Promise<boolean> {
    const saEmail = (this.config.get<string>("SUPER_ADMIN_EMAIL", "administrator@orkiestri.com") || "").toLowerCase();
    if (email && email.toLowerCase() === saEmail) return true;
    try {
      const sa = await (this.prisma as any).superAdmin.findUnique({ where: { userId } });
      return !!sa;
    } catch { return false; }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } }, profile: true },
    });
    if (!user) throw new UnauthorizedException();
    const isMaster = user.userRoles.some(ur => ur.role.isMaster);
    const isSuperAdmin = await this.checkGlobalSuperAdmin(user.id, user.email);
    let modulos: string[];
    try { modulos = JSON.parse((user.profile as any)?.modulos || "[]"); } catch { modulos = []; }
    const permissions = await this.resolvePermissions(userId);
    return {
      id: user.id, nome: user.nome, email: user.email, avatar: user.avatar,
      organizationId: (user as any).organizationId,
      roles: user.userRoles.map(ur => ur.role.nome),
      isMaster,
      isSuperAdmin,
      modulos,
      permissions,
    };
  }

  async logout(userId: string, iat?: number, exp?: number) {
    if (iat && exp) {
      const now = Math.floor(Date.now() / 1000);
      const ttl = exp - now;
      if (ttl > 0) {
        await this.cache.set(`blacklist:jwt:${userId}:${iat}`, 1, ttl);
      }
    }
    return { message: "Logout realizado" };
  }

  async isTokenBlacklisted(userId: string, iat: number): Promise<boolean> {
    const val = await this.cache.get<number>(`blacklist:jwt:${userId}:${iat}`);
    return val !== null;
  }

  private async logAudit(userId: string | null, modulo: string, tabela: string, registroId: string, acao: string, descricao: string, organizationId?: string) {
    try {
      await (this.prisma.auditLog.create as any)({
        data: {
          id: require("crypto").randomUUID(),
          userId, modulo, tabela, registroId, acao, descricao,
          ...(organizationId ? { organizationId } : {}),
        },
      });
    } catch {}
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findFirst({ where: { email } });
    if (!user) return { message: "Se o e-mail existir, o master sera notificado" };
    const master = await this.prisma.user.findFirst({
      where: { ativo: true, userRoles: { some: { role: { isMaster: true } } } },
      orderBy: { criadoEm: "asc" },
    });
    if (master) {
      await this.prisma.notification.create({
        data: {
          userId: master.id,
          tipo: "reset_senha",
          titulo: "Solicitacao de reset de senha",
          mensagem: user.nome + " (" + user.email + ") solicitou redefinicao de senha.",
          referenciaTipo: "user",
          referenciaId: user.id,
        },
      });
      this.email.sendPasswordResetRequest(user.email, user.nome, master.nome, master.email).catch(() => {});
    }
    return { message: "Solicitacao enviada. O administrador sera notificado." };
  }

  private async getMasterUserId(): Promise<string> {
    const master = await this.prisma.user.findFirst({
      where: { ativo: true, userRoles: { some: { role: { isMaster: true } } } },
      orderBy: { criadoEm: "asc" },
    });
    if (!master) throw new NotFoundException("Master nao encontrado");
    return master.id;
  }

  async getPasswordRequests(requestUser: any) {
    if (!requestUser.isMaster) throw new ForbiddenException("Apenas masters");
    return this.prisma.notification.findMany({
      where: { tipo: "reset_senha", lida: false },
      orderBy: { criadoEm: "desc" },
    });
  }

  async resolvePasswordRequest(notificationId: string, requestUser: any) {
    if (!requestUser.isMaster) throw new ForbiddenException("Apenas masters");
    await this.prisma.notification.update({ where: { id: notificationId }, data: { lida: true } });
    return { message: "Solicitacao resolvida" };
  }

  // ── Solicitações de acesso ─────────────────────────────────────────────────────

  async createUserRequest(dto: {
    nome: string; email: string; whatsapp?: string; cargo?: string;
    departamento?: string; empresa?: string; motivacao?: string; organizationId?: string;
  }) {
    // Validate organizationId if provided
    if (dto.organizationId) {
      const org = await this.prisma.organization.findFirst({
        where: { id: dto.organizationId, ativo: true } as any,
      });
      if (!org) throw new BadRequestException("Organização não encontrada ou inativa.");
    }
    const existing = await this.prisma.user.findFirst({ where: { email: dto.email } });
    if (existing) throw new BadRequestException("Este e-mail já possui cadastro no sistema.");
    const pending = await (this.prisma as any).userRequest.findFirst({
      where: { email: dto.email, status: "PENDENTE" },
    });
    if (pending) throw new BadRequestException("Já existe uma solicitação pendente para este e-mail.");
    const req = await (this.prisma as any).userRequest.create({
      data: { id: require("crypto").randomUUID(), ...dto },
    });
    // Notificar master e todos os administradores
    try {
      const adminUsers = await this.prisma.user.findMany({
        where: {
          ativo: true,
          userRoles: { some: { role: { OR: [{ isMaster: true }, { nome: "administrador" }] } } },
        },
        select: { id: true },
      });
      for (const admin of adminUsers) {
        await this.prisma.notification.create({
          data: {
            id: require("crypto").randomUUID(),
            userId: admin.id,
            tipo: "solicitacao_acesso",
            titulo: "Nova solicitação de acesso",
            mensagem: `${dto.nome} (${dto.email}) solicitou criação de acesso.`,
            referenciaTipo: "user_request",
            referenciaId: req.id,
          },
        });
      }
    } catch {}
    return { message: "Solicitação enviada. Aguarde aprovação do administrador." };
  }

  private canManageRequests(requestUser: any): boolean {
    return requestUser.isMaster ||
      (Array.isArray(requestUser.permissions) && (
        requestUser.permissions.includes("*") ||
        requestUser.permissions.includes("usuarios:criar")
      ));
  }

  async listUserRequests(requestUser: any) {
    if (!this.canManageRequests(requestUser)) throw new ForbiddenException("Acesso negado.");
    // Isolamento multi-tenant: master de tenant só vê solicitações da
    // própria organização. Apenas o Super Admin global vê todas.
    const where = requestUser.isSuperAdmin
      ? {}
      : { organizationId: requestUser.organizationId };
    return (this.prisma as any).userRequest.findMany({
      where,
      orderBy: { criadoEm: "desc" },
    });
  }

  async approveUserRequest(id: string, dto: {
    nome?: string; email?: string; whatsapp?: string;
    cargo?: string; departamento?: string; empresa?: string;
    // Workforce: provisionamento estrutural do colaborador
    setorId?: string | null;
    gestorId?: string | null;
    jornadaHorasDia?: number;
    squad?: string;
    senioridade?: string;
    tipoVinculo?: string;
    perfilRoleId?: string | null;
    matricula?: string;
  }, requestUser: any) {
    if (!this.canManageRequests(requestUser)) throw new ForbiddenException("Acesso negado.");
    const req = await (this.prisma as any).userRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException("Solicitação não encontrada.");
    if (req.status !== "PENDENTE") throw new BadRequestException("Solicitação já processada.");
    // Isolamento: master de tenant só aprova solicitações da própria org
    if (!requestUser.isSuperAdmin && req.organizationId && req.organizationId !== requestUser.organizationId) {
      throw new ForbiddenException("Solicitação pertence a outra organização.");
    }

    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$";
    const tempPassword = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("") + "A1!";
    const senhaHash = await bcrypt.hash(tempPassword, 12);

    // Role a aplicar: o que o admin escolheu, ou fallback para técnico/analista
    let chosenRole: any = null;
    if (dto.perfilRoleId) {
      chosenRole = await this.prisma.role.findUnique({ where: { id: dto.perfilRoleId } });
    }
    if (!chosenRole) {
      chosenRole = await this.prisma.role.findFirst({
        where: { nome: { in: ["tecnico", "analista"] }, isMaster: false },
        orderBy: { nivel: "asc" },
      });
    }

    // Usa dados editados pelo admin (fallback para os dados originais)
    const nome = dto.nome?.trim() || req.nome;
    const email = dto.email?.trim() || req.email;
    const whatsapp = dto.whatsapp?.trim() || req.whatsapp || null;
    const cargo = dto.cargo?.trim() || req.cargo || null;
    const departamento = dto.departamento?.trim() || req.departamento || null;
    const empresa = dto.empresa?.trim() || req.empresa || null;

    const organizationId = req.organizationId || requestUser.organizationId || "00000000-0000-0000-0000-000000000001";
    const userId = require("crypto").randomUUID();
    await this.prisma.user.create({
      data: {
        id: userId,
        nome,
        email,
        senhaHash,
        ativo: true,
        primeiroAcesso: true,
        bloqueado: false,
        tentativasFalhas: 0,
        organizationId,
      } as any,
    });
    await this.prisma.userProfile.create({
      data: {
        id: require("crypto").randomUUID(),
        userId,
        whatsapp,
        cargo,
        setorId: dto.setorId || null,
      } as any,
    });
    if (chosenRole) {
      await this.prisma.userRole.create({
        data: { userId, roleId: chosenRole.id, atribuidoPorId: requestUser.id, atribuidoEm: new Date() } as any,
      });
    }
    // ── Workforce: cria Collaborator vinculado ao novo User ──────────
    try {
      await (this.prisma as any).collaborator.create({
        data: {
          organizationId,
          userId,
          matricula:        dto.matricula || null,
          emailCorporativo: email,
          telefone:         whatsapp,
          cargo,
          departamento,
          setorId:          dto.setorId || null,
          squad:            dto.squad || null,
          senioridade:      dto.senioridade || req.senioridade || null,
          gestorId:         dto.gestorId || null,
          jornadaHorasDia:  dto.jornadaHorasDia ?? req.jornadaHorasDia ?? 8,
          jornadaHorasMes:  (dto.jornadaHorasDia ?? req.jornadaHorasDia ?? 8) * 22,
          tipoVinculo:      dto.tipoVinculo || req.tipoVinculo || null,
          ativo:            true,
        },
      });
    } catch (e) {
      // Não bloqueia aprovação se Collaborator falhar (ex: matrícula duplicada)
      console.error("[approveUserRequest] failed to create Collaborator:", e);
    }
    await (this.prisma as any).userRequest.update({
      where: { id },
      data: { status: "APROVADO", approvedById: requestUser.id, approvedAt: new Date() },
    });
    const appUrl = this.config.get("APP_URL", "http://localhost");
    let entregaWhatsapp = false;
    if (whatsapp) {
      try {
        const inst = await this.wa.resolveInstance(organizationId);
        entregaWhatsapp = await this.wa.sendAccountApproved(whatsapp, nome, email, tempPassword, appUrl, inst);
      } catch { entregaWhatsapp = false; }
    }
    let entregaEmail = false;
    try {
      await this.email.sendAccountApproved(email, nome, tempPassword);
      entregaEmail = true;
    } catch { entregaEmail = false; }
    this.logAudit(requestUser.id, "usuarios", "users", userId, "CREATE", `Conta aprovada via solicitação: ${email}`).catch(() => {});
    return {
      message: "Usuário aprovado com sucesso.",
      userId,
      email,
      senhaTemporaria: tempPassword,
      entregaWhatsapp,
      entregaEmail,
    };
  }

  async rejectUserRequest(id: string, reason: string | undefined, requestUser: any) {
    if (!this.canManageRequests(requestUser)) throw new ForbiddenException("Acesso negado.");
    const req = await (this.prisma as any).userRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException("Solicitação não encontrada.");
    if (req.status !== "PENDENTE") throw new BadRequestException("Solicitação já processada.");
    if (!requestUser.isSuperAdmin && req.organizationId && req.organizationId !== requestUser.organizationId) {
      throw new ForbiddenException("Solicitação pertence a outra organização.");
    }
    await (this.prisma as any).userRequest.update({
      where: { id },
      data: { status: "REJEITADO", approvedById: requestUser.id, approvedAt: new Date(), rejectionReason: reason || null },
    });
    if (req.whatsapp) {
      this.wa.sendAccountRejected(req.whatsapp, req.nome).catch(() => {});
    }
    this.email.sendAccountRejected(req.email, req.nome, reason).catch(() => {});
    return { message: "Solicitação rejeitada." };
  }

  // ── Reset de senha via Email ───────────────────────────────────────────────────

  async sendPasswordResetEmail(email: string) {
    const user = await this.prisma.user.findFirst({ where: { email } });
    if (!user) return { message: "Se o e-mail estiver cadastrado, você receberá o link de redefinição." };
    if (!user.ativo || (user as any).bloqueado) return { message: "Se o e-mail estiver cadastrado, você receberá o link de redefinição." };

    const resetToken = this.jwt.sign(
      { sub: user.id, type: "email_reset" },
      { secret: this.config.get("JWT_SECRET"), expiresIn: "30m" },
    );
    const appUrl = this.config.get("APP_URL", "http://localhost");
    const resetUrl = `${appUrl}/recuperar-senha?token=${resetToken}`;
    this.email.sendPasswordResetLink(user.email, user.nome, resetUrl).catch(() => {});
    return { message: "Se o e-mail estiver cadastrado, você receberá o link de redefinição." };
  }

  // ── OTP via WhatsApp ───────────────────────────────────────────────────────────

  async sendPasswordOtp(whatsapp: string) {
    const profile = await this.prisma.userProfile.findFirst({ where: { whatsapp } });
    if (!profile) return { message: "Se o número estiver cadastrado, você receberá o código." };
    const user = await this.prisma.user.findUnique({ where: { id: profile.userId } });
    if (!user || !user.ativo) return { message: "Se o número estiver cadastrado, você receberá o código." };
    if ((user as any).bloqueado) throw new UnauthorizedException("Conta bloqueada. Contate o Administrador.");

    // Invalida OTPs anteriores
    await (this.prisma as any).passwordResetOtp.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await (this.prisma as any).passwordResetOtp.create({
      data: {
        id: require("crypto").randomUUID(),
        userId: user.id,
        otpCode: code,
        otpExpiresAt: expiresAt,
        otpAttempts: 0,
        used: false,
      },
    });
    this.wa.sendOtp(whatsapp, code).catch(() => {});
    return { message: "Se o número estiver cadastrado, você receberá o código." };
  }

  async verifyPasswordOtp(whatsapp: string, code: string) {
    const profile = await this.prisma.userProfile.findFirst({ where: { whatsapp } });
    if (!profile) throw new UnauthorizedException("Código inválido ou expirado.");
    const user = await this.prisma.user.findUnique({ where: { id: profile.userId } });
    if (!user || !user.ativo || (user as any).bloqueado) throw new UnauthorizedException("Conta bloqueada. Contate o Administrador.");

    const otp = await (this.prisma as any).passwordResetOtp.findFirst({
      where: { userId: user.id, used: false },
      orderBy: { criadoEm: "desc" },
    });
    if (!otp || otp.otpExpiresAt < new Date()) throw new UnauthorizedException("Código inválido ou expirado.");

    if (otp.otpCode !== code) {
      const newAttempts = otp.otpAttempts + 1;
      await (this.prisma as any).passwordResetOtp.update({
        where: { id: otp.id },
        data: { otpAttempts: newAttempts },
      });
      if (newAttempts >= 2) {
        await this.prisma.user.update({ where: { id: user.id }, data: { bloqueado: true } as any });
        throw new UnauthorizedException("Muitas tentativas incorretas. Conta bloqueada. Contate o Administrador.");
      }
      throw new UnauthorizedException(`Código incorreto. ${2 - newAttempts} tentativa(s) restante(s).`);
    }

    await (this.prisma as any).passwordResetOtp.update({ where: { id: otp.id }, data: { used: true } });
    // Token temporário de redefinição (3 min)
    const resetToken = this.jwt.sign(
      { sub: user.id, type: "reset" },
      { secret: this.config.get("JWT_SECRET"), expiresIn: "3m" },
    );
    return { resetToken };
  }

  async resetPasswordWithToken(resetToken: string, novaSenha: string) {
    let payload: any;
    try {
      payload = this.jwt.verify(resetToken, { secret: this.config.get("JWT_SECRET") });
    } catch {
      throw new UnauthorizedException("Token inválido ou expirado.");
    }
    if (payload.type !== "reset" && payload.type !== "email_reset") throw new UnauthorizedException("Token inválido.");
    this.validatePasswordStrength(novaSenha);
    const hash = await bcrypt.hash(novaSenha, 12);
    await this.prisma.user.update({
      where: { id: payload.sub },
      data: { senhaHash: hash, tentativasFalhas: 0 } as any,
    });
    return { message: "Senha redefinida com sucesso." };
  }

  // ── Primeiro acesso ────────────────────────────────────────────────────────────

  async changeFirstPassword(userId: string, novaSenha: string) {
    this.validatePasswordStrength(novaSenha);
    const hash = await bcrypt.hash(novaSenha, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { senhaHash: hash, primeiroAcesso: false } as any,
    });
    await this.invalidatePermissionsCache(userId);
    return { message: "Senha definida com sucesso." };
  }

  async unblockUser(targetId: string, requestUser: any) {
    if (!requestUser.isMaster) throw new ForbiddenException("Acesso negado.");
    await this.prisma.user.update({
      where: { id: targetId },
      data: { bloqueado: false, tentativasFalhas: 0 } as any,
    });
    return { message: "Usuário desbloqueado." };
  }

  getTenantInfo() {
    return { nome: this.config.get("TENANT_NOME", "Orkestri") };
  }

  async getPublicOrganizations() {
    const orgs = await this.prisma.organization.findMany({
      where: { ativo: true } as any,
      select: { id: true, nome: true } as any,
      orderBy: { nome: "asc" } as any,
    });
    return orgs;
  }

  private validatePasswordStrength(senha: string) {
    if (senha.length < 8) throw new BadRequestException("A senha deve ter no mínimo 8 caracteres.");
    if (!/[A-Z]/.test(senha)) throw new BadRequestException("A senha deve conter ao menos uma letra maiúscula.");
    if (!/[a-z]/.test(senha)) throw new BadRequestException("A senha deve conter ao menos uma letra minúscula.");
    if (!/[0-9]/.test(senha)) throw new BadRequestException("A senha deve conter ao menos um número.");
  }
}
