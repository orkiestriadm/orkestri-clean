import { Module, Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Req, ConflictException, BadRequestException, NotFoundException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsArray, IsBoolean, IsEmail, IsOptional, IsString, MinLength } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import * as bcrypt from "bcryptjs";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { acharNaOrganizacao } from "../../common/escopo-organizacao";
import { CacheService } from "../cache/cache.service";
import { WebhookService, WebhooksModule } from "../automacoes/webhooks.module";
import { AutomacaoService, AutomacoesModule } from "../automacoes/automacoes.module";

const CACHE_USERS_LIST = "cache:users:list";
const CACHE_USER       = (id: string) => `cache:user:${id}`;
const TTL_LIST         = 60;   // 1 min
const TTL_USER         = 120;  // 2 min

// Modulos da versao reduzida do Orkiestri (escopo de 19/10/2026): Space,
// Projects, Finance, Service e Quality. Sairam ativos, monitoramento, crm,
// frota e relatorios -- produtos removidos em 2.0.0.
//
// Regra: lista vazia => usuario ve TODOS os modulos (retrocompat, ninguem
// perde acesso). Hoje o menu NAO le isto: Sidebar.tsx decide por permissao
// (canAccessModule). A lista sobrevive porque as notificacoes por modulo a
// usam -- ver PermissoesMensagemModal.
const ALL_MODULOS = [
  "agenda", "keep", "projetos", "gantt",
  "financeiro", "gastos", "orcamento",
  "chamados", "conhecimento", "whatsapp",
];

/** Deixa so os digitos: o cadastro aceita 000.000.000-00 ou 00000000000. */
function soDigitos(v?: string | null): string {
  return (v || "").replace(/\D/g, "");
}

/**
 * Valida CPF pelos dois digitos verificadores.
 *
 * Checagem de formato nao basta: "111.111.111-11" tem 11 digitos e e invalido.
 * Como o CPF e a identidade do cadastro geral, errar um digito criaria uma
 * pessoa que nunca mais e encontrada pela busca.
 */
function cpfValido(bruto?: string | null): boolean {
  const cpf = soDigitos(bruto);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // todos iguais
  for (const corte of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < corte; i++) soma += Number(cpf[i]) * (corte + 1 - i);
    const resto = (soma * 10) % 11;
    const digito = resto === 10 ? 0 : resto;
    if (digito !== Number(cpf[corte])) return false;
  }
  return true;
}

/**
 * Senha provisoria do cadastro novo.
 *
 * Sem ambiguidade visual (nem 0/O, nem 1/l/I): ela e ditada por telefone ou
 * colada de um WhatsApp, e um zero lido como letra gera um "nao consigo
 * entrar" que ninguem consegue depurar. Garante maiuscula, numero e simbolo
 * para passar em qualquer politica de senha que venha depois.
 */
function gerarSenhaProvisoria(): string {
  const alfabeto = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const corpo = Array.from(
    { length: 10 },
    () => alfabeto[Math.floor(Math.random() * alfabeto.length)],
  ).join("");
  return corpo + "A9!";
}

function parseModulos(raw?: string | null): string[] {
  try { return JSON.parse(raw || "[]"); } catch { return [...ALL_MODULOS]; }
}

/**
 * O cadastro geral de usuario -- cinco campos, nada mais.
 *
 * Decisao do usuario em 20/10/2026: nome completo, CPF, e-mail, telefone e
 * WhatsApp. Sairam `senha` (gerada aqui, ver create()), `cargo`, `setorId`
 * (a tabela `setores` foi derrubada) e `modulos` (todo usuario recebe o
 * papel `usuario`, que abre todos os produtos).
 */
class CreateUserDto {
  @IsString() nome: string;
  @IsString() cpf: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsString() whatsapp?: string;
}
class UpdateUserDto {
  @IsOptional() @IsString() nome?: string;
  @IsOptional() @IsString() cpf?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsString() whatsapp?: string;
}
class ChangePasswordDto { @IsString() @MinLength(6) novaSenha: string; }
class UpdateModulosDto { @IsArray() modulos: string[]; }

function mapUser(u: any) {
  return {
    id: u.id, nome: u.nome, email: u.email, ativo: u.ativo,
    avatar: u.avatar, ultimoLogin: u.ultimoLogin, criadoEm: u.criadoEm,
    cpf: u.cpf ?? null,
    telefone: u.profile?.telefone ?? null,
    whatsapp: u.profile?.whatsapp ?? null,
    roles: u.userRoles.map((ur: any) => ur.role.nome),
    isMaster: u.userRoles.some((ur: any) => ur.role.isMaster),
    modulos: parseModulos(u.profile?.modulos),
  };
}

// ── DTOs gerados: sem classe, o ValidationPipe global nao tem metadata e a
//    rota aceita qualquer JSON. Campos derivados do tipo inline anterior.
class UpdateMeUsersDto {
  @IsOptional() @IsString() nome?: string;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsString() cargo?: string;
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsBoolean() whatsappAlertas?: boolean;
  @IsOptional() @IsString() statusOnline?: string;
}

class ChangeMyPasswordUsersDto {
  @IsString() senhaAtual: string;
  @IsString() novaSenha: string;
}

class ImportCsvUsersDto {
  @IsString() csv: string;
}

@Controller("users")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class UsersController {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private webhook: WebhookService,
    private automacao: AutomacaoService,
  ) {}

  @Get()
  @Permissions("usuarios:ver")
  async findAll(@Query("incluirMaster") incluirMaster?: string, @Req() req?: any) {
    const orgId = req?.user?.organizationId;
    const cacheKey = `${CACHE_USERS_LIST}:${orgId}:${incluirMaster ?? "0"}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const users = await this.prisma.user.findMany({
      where: orgId ? { organizationId: orgId } as any : undefined,
      orderBy: { criadoEm: "asc" },
      include: {
        userRoles: { include: { role: true } },
        profile: true,
      },
    });
    const result = users
      .filter(u => incluirMaster === "true" ? true : !u.userRoles.some(ur => ur.role.isMaster))
      .map(mapUser);
    await this.cache.set(cacheKey, result, TTL_LIST);
    return result;
  }

  // GET /users/roles/list saiu em 20/10/2026. Alimentava o seletor de papel do
  // cadastro, que deixou de existir (o cadastro nao escolhe perfil), e listava
  // os papeis de TODOS os tenants -- sem filtro por organizationId.

  // Lista leve para seletores (participantes de eventos, membros de tarefas, etc).
  // Não exige usuarios:ver — qualquer usuário autenticado pode escolher colegas.
  @Get("picklist")
  async picklist(@Req() req: any) {
    const orgId = req?.user?.organizationId;
    const users = await this.prisma.user.findMany({
      where: { ...(orgId ? { organizationId: orgId } : {}), ativo: true } as any,
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, email: true, avatar: true },
    });
    return users;
  }

  // ── Self-profile endpoints (no extra permission required) ──────────────────
  @Get("me")
  async getMe(@Req() req: any) {
    const id = req.user.id;
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } }, profile: true },
    });
    if (!u) throw new NotFoundException("Usuario nao encontrado");
    return {
      ...mapUser(u),
      whatsapp: u.profile?.whatsapp,
      whatsappAlertas: u.profile?.whatsappAlertas ?? false,
      statusOnline: u.profile?.statusOnline ?? "disponivel",
    };
  }

  @Patch("me")
  async updateMe(@Req() req: any, @Body() body: UpdateMeUsersDto) {
    const id = req.user.id;
    if (body.nome) {
      await this.prisma.user.update({ where: { id }, data: { nome: body.nome } });
    }
    await this.prisma.userProfile.upsert({
      where: { userId: id },
      update: {
        ...(body.telefone !== undefined && { telefone: body.telefone }),
        ...(body.cargo !== undefined && { cargo: body.cargo }),
        ...(body.whatsapp !== undefined && { whatsapp: body.whatsapp }),
        ...(body.whatsappAlertas !== undefined && { whatsappAlertas: body.whatsappAlertas }),
        ...(body.statusOnline !== undefined && { statusOnline: body.statusOnline }),
      },
      create: {
        userId: id, telefone: body.telefone, cargo: body.cargo,
        whatsapp: body.whatsapp, whatsappAlertas: body.whatsappAlertas ?? false,
        statusOnline: body.statusOnline ?? "disponivel",
      },
    });
    await this.cache.del(CACHE_USER(id));
    return this.getMe(req);
  }

  @Patch("me/senha")
  async changeMyPassword(@Req() req: any, @Body() body: ChangeMyPasswordUsersDto) {
    const id = req.user.id;
    if (!body.senhaAtual || !body.novaSenha) throw new BadRequestException("Campos obrigatórios");
    if (body.novaSenha.length < 6) throw new BadRequestException("Senha deve ter ao menos 6 caracteres");
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("Usuário não encontrado");
    const ok = await bcrypt.compare(body.senhaAtual, user.senhaHash);
    if (!ok) throw new BadRequestException("Senha atual incorreta");
    await this.prisma.user.update({ where: { id }, data: { senhaHash: await bcrypt.hash(body.novaSenha, 12) } });
    return { message: "Senha alterada com sucesso" };
  }

  @Get(":id")
  @Permissions("usuarios:ver")
  async findOne(@Param("id") id: string, @Req() req: any) {
    // O escopo vem ANTES do cache: servir do cache sem conferir a organizacao
    // devolveria usuario de outro tenant para quem tivesse o id.
    const u = await acharNaOrganizacao(this.prisma.user, id, req, "Usuario nao encontrado", {
      include: { userRoles: { include: { role: true } }, profile: true },
    });

    const cached = await this.cache.get(CACHE_USER(id));
    if (cached) return cached;

    const result = mapUser(u);
    await this.cache.set(CACHE_USER(id), result, TTL_USER);
    return result;
  }

  @Post()
  @Permissions("usuarios:criar")
  async create(@Body() dto: CreateUserDto, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const exists = await this.prisma.user.findFirst({ where: { email: dto.email, ...(orgId ? { organizationId: orgId } : {}) } as any });
    if (exists) throw new ConflictException("E-mail ja cadastrado");

    if (!cpfValido(dto.cpf)) throw new BadRequestException("CPF invalido");
    const cpf = soDigitos(dto.cpf);
    // Unicidade POR ORGANIZACAO, verificada aqui e nao por UNIQUE no banco:
    // um UNIQUE global impediria a mesma pessoa de existir em dois tenants.
    const cpfEmUso = await this.prisma.user.findFirst({
      where: { cpf, ...(orgId ? { organizationId: orgId } : {}) } as any,
    });
    if (cpfEmUso) throw new ConflictException("CPF ja cadastrado");

    // Verificar limite de usuários do plano
    if (orgId) {
      try {
        const billing = await (this.prisma as any).orgBilling.findUnique({
          where: { organizationId: orgId },
          select: { plano: true, status: true },
        });
        const PLAN_LIMITS: Record<string, number | null> = {
          business_cloud: 5, business_plus: 10, enterprise: null,
        };
        const maxUsers = billing ? (PLAN_LIMITS[billing.plano] ?? null) : null;
        if (maxUsers !== null) {
          const currentCount = await (this.prisma as any).user.count({
            where: { organizationId: orgId, ativo: true },
          });
          if (currentCount >= maxUsers) {
            throw new BadRequestException(
              `Limite de ${maxUsers} usuários atingido para o plano atual. Faça upgrade para adicionar mais usuários.`
            );
          }
        }
      } catch (e: any) {
        if (e instanceof BadRequestException) throw e;
        // Ignora erros de infraestrutura (tabela billing ainda não existe)
      }
    }

    // A senha nao e mais pedida no formulario (o cadastro tem cinco campos), e
    // sim sorteada aqui e devolvida UMA vez no corpo da resposta, para quem
    // cadastrou repassar. `primeiroAcesso` obriga a troca no primeiro login.
    const senhaProvisoria = gerarSenhaProvisoria();
    const hash = await bcrypt.hash(senhaProvisoria, 12);

    const user = await this.prisma.user.create({
      data: {
        nome: dto.nome, email: dto.email, senhaHash: hash, cpf,
        primeiroAcesso: true,
        ...(orgId ? { organizationId: orgId } : {}),
        profile: {
          create: {
            telefone: dto.telefone || null,
            whatsapp: dto.whatsapp || null,
            // Todos os modulos da versao reduzida: nao ha mais perfil a
            // escolher. O menu nem le isto (decide por permissao), mas as
            // notificacoes por modulo leem.
            modulos: JSON.stringify(ALL_MODULOS),
          },
        },
      } as any,
      include: { userRoles: { include: { role: true } }, profile: true },
    });

    // Papel `usuario`: abre todos os produtos do Orkiestri e fecha o Core.
    // Antes desta versao o POST /users nao atribuia papel NENHUM -- quem era
    // criado pela aba ficava so com as BASE_PERMISSIONS (agenda, keep, gastos)
    // ate alguem lhe dar um papel a mao na aba Papeis, que nao existe mais.
    const papel = await this.prisma.role.findFirst({
      where: { nome: "usuario", isMaster: false, ...(orgId ? { organizationId: orgId } : {}) } as any,
    });
    if (!papel) {
      // Sem papel o usuario nasce sem ver nada alem do Space. Isso e defeito de
      // semeadura da organizacao, nao escolha -- falha alto em vez de entregar
      // uma conta muda.
      throw new BadRequestException(
        "O papel 'usuario' nao existe nesta organizacao. Reinicie a API para semear os papeis e tente de novo."
      );
    }
    await this.prisma.userRole.create({
      data: { userId: user.id, roleId: papel.id, atribuidoPorId: req.user?.id },
    });

    await this.cache.delPattern(`${CACHE_USERS_LIST}:*`);
    this.webhook.fire("usuario.criado", {
      id: user.id, nome: user.nome, email: user.email, criadoEm: user.criadoEm,
    }, orgId).catch(() => {});
    this.automacao.executar("usuario_criado", {
      id: user.id, nome: user.nome, email: user.email, organizationId: orgId,
    }).catch(() => {});

    const criado = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { userRoles: { include: { role: true } }, profile: true },
    });
    return { ...mapUser(criado), senhaProvisoria };
  }

  @Put(":id")
  @Permissions("usuarios:editar")
  async update(@Param("id") id: string, @Body() dto: UpdateUserDto, @Req() req?: any) {
    const orgId = req?.user?.organizationId;
    const exists = await this.prisma.user.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("Usuario nao encontrado");
    if (dto.email && dto.email !== exists.email) {
      const t = await this.prisma.user.findFirst({ where: { email: dto.email, ...(orgId ? { organizationId: orgId } : {}) } as any });
      if (t) throw new ConflictException("E-mail ja em uso");
    }
    let cpf: string | undefined;
    if (dto.cpf !== undefined) {
      if (!cpfValido(dto.cpf)) throw new BadRequestException("CPF invalido");
      cpf = soDigitos(dto.cpf);
      if (cpf !== (exists as any).cpf) {
        const t = await this.prisma.user.findFirst({
          where: { cpf, ...(orgId ? { organizationId: orgId } : {}) } as any,
        });
        if (t) throw new ConflictException("CPF ja em uso");
      }
    }
    await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.nome && { nome: dto.nome }),
        ...(dto.email && { email: dto.email }),
        ...(cpf !== undefined && { cpf }),
        ...(dto.ativo !== undefined && { ativo: dto.ativo }),
      } as any,
    });
    // Campos omitidos ficam como estao: antes um PUT sem `cargo` gravava
    // `undefined` e o Prisma ignorava, mas com `telefone`/`whatsapp` a mesma
    // forma apagaria o que o proprio usuario tinha posto no perfil dele.
    await this.prisma.userProfile.upsert({
      where: { userId: id },
      update: {
        ...(dto.telefone !== undefined && { telefone: dto.telefone || null }),
        ...(dto.whatsapp !== undefined && { whatsapp: dto.whatsapp || null }),
      },
      create: { userId: id, telefone: dto.telefone || null, whatsapp: dto.whatsapp || null },
    });
    await this.cache.del(CACHE_USER(id));
    // A lista é cacheada por `${CACHE_USERS_LIST}:${orgId}:${incluirMaster}` — o
    // orgId no meio fazia as chaves fixas antigas nunca baterem, e a exclusão/
    // edição só "aparecia" após o TTL de 60s. delPattern limpa todas as variantes.
    await this.cache.delPattern(`${CACHE_USERS_LIST}:*`);
    return this.findOne(id, req);
  }

  @Patch(":id/password")
  @Permissions("usuarios:editar")
  async changePassword(@Param("id") id: string, @Body() dto: ChangePasswordDto, @Req() req: any) {
    // Sem o escopo, um administrador trocava a senha de usuario de OUTRA
    // organizacao — tomada de conta, nao so leitura indevida.
    await acharNaOrganizacao(this.prisma.user, id, req, "Usuario nao encontrado");
    await this.prisma.user.update({ where: { id }, data: { senhaHash: await bcrypt.hash(dto.novaSenha, 12) } });
    return { message: "Senha alterada com sucesso" };
  }

  @Patch(":id/modulos")
  @Permissions("usuarios:editar")
  async updateModulos(@Param("id") id: string, @Body() dto: UpdateModulosDto) {
    const validModulos = dto.modulos.filter(m => ALL_MODULOS.includes(m));
    await this.prisma.userProfile.upsert({
      where: { userId: id },
      update: { modulos: JSON.stringify(validModulos) },
      create: { userId: id, modulos: JSON.stringify(validModulos) },
    });
    return { modulos: validModulos };
  }

  @Patch(":id/toggle")
  @Permissions("usuarios:editar")
  async toggle(@Param("id") id: string, @Req() req: any) {
    if (id === req.user.id) throw new BadRequestException("Voce nao pode desativar sua propria conta");
    const user = await acharNaOrganizacao(this.prisma.user, id, req, "Usuario nao encontrado");
    const updated = await this.prisma.user.update({ where: { id }, data: { ativo: !user.ativo } });
    await this.cache.del(CACHE_USER(id));
    // A lista é cacheada por `${CACHE_USERS_LIST}:${orgId}:${incluirMaster}` — o
    // orgId no meio fazia as chaves fixas antigas nunca baterem, e a exclusão/
    // edição só "aparecia" após o TTL de 60s. delPattern limpa todas as variantes.
    await this.cache.delPattern(`${CACHE_USERS_LIST}:*`);
    return { message: updated.ativo ? "Usuario ativado" : "Usuario desativado", ativo: updated.ativo };
  }

  @Delete(":id")
  @Permissions("usuarios:excluir")
  async remove(@Param("id") id: string, @Req() req: any) {
    if (id === req.user.id) throw new BadRequestException("Voce nao pode remover sua propria conta");
    const user = await acharNaOrganizacao(this.prisma.user, id, req, "Usuario nao encontrado");

    try {
    await this.prisma.$transaction(async (tx) => {
      // Nullify optional FK refs that have no CASCADE/SET NULL in DB
      await tx.userRole.updateMany({ where: { atribuidoPorId: id }, data: { atribuidoPorId: null } });
      await tx.task.updateMany({ where: { assigneeId: id }, data: { assigneeId: null } });
      await tx.chamado.updateMany({ where: { atendenteId: id }, data: { atendenteId: null } });
      await tx.clienteTimeline.updateMany({ where: { userId: id }, data: { userId: null } });
      await tx.auditLog.updateMany({ where: { userId: id }, data: { userId: null } });
      await tx.checklistItem.updateMany({ where: { assigneeId: id }, data: { assigneeId: null } });

      // Workforce: aprovações de workflow feitas pelo usuário.
      // A FK era SET NULL numa coluna NOT NULL — quebrava o delete.
      await (tx as any).workflowApproval.deleteMany({ where: { aprovadorId: id } });

      // Delete approval requests made by this user
      await tx.aprovacaoOrcamento.deleteMany({ where: { solicitadoPorId: id } });
      // Delete orcamento items created by user (cascades: meses, timeline, aprovacoes)
      await tx.itemOrcamento.deleteMany({ where: { criadoPorId: id } });
      // Delete knowledge base articles authored by user
      await tx.artigoConhecimento.deleteMany({ where: { autorId: id } });
      // Delete asset transfers performed by user
      await tx.transferenciaAtivo.deleteMany({ where: { realizadoPorId: id } });
      // Delete chamados where user was the requester (cascades: comentarios, apontamentos)
      await tx.chamado.deleteMany({ where: { solicitanteId: id } });

      // Delete owned records
      await tx.taskComment.deleteMany({ where: { userId: id } });
      await tx.task.deleteMany({ where: { criadoPorId: id } });
      await tx.project.deleteMany({ where: { criadoPorId: id } });
      await tx.event.deleteMany({ where: { OR: [{ userId: id }, { criadoPorId: id }] } });
      await tx.note.deleteMany({ where: { userId: id } });
      await tx.noteLabel.deleteMany({ where: { userId: id } });
      await tx.dailyTask.deleteMany({ where: { userId: id } });

      // Delete user — DB CASCADE handles: SuperAdmin, PasswordResetOtp, UserProfile,
      // UserRole, UserPermissionOverride, UserSession, EventParticipant,
      // ChamadoComentario, ProjectMember, Notification, ApontamentoHoras, NoteCollaborator
      await tx.user.delete({ where: { id } });
    }, { timeout: 30000 });
    } catch (e: any) {
      if (e?.code === "P2003" || /foreign key|constraint/i.test(e?.message || "")) {
        const alvo = e?.meta?.field_name || e?.meta?.constraint || "vínculo no sistema";
        throw new BadRequestException(
          `Não foi possível remover: o usuário ainda possui registros vinculados (${alvo}). Reatribua ou remova esses registros antes.`,
        );
      }
      throw e;
    }

    await this.cache.del(CACHE_USER(id));
    // A lista é cacheada por `${CACHE_USERS_LIST}:${orgId}:${incluirMaster}` — o
    // orgId no meio fazia as chaves fixas antigas nunca baterem, e a exclusão/
    // edição só "aparecia" após o TTL de 60s. delPattern limpa todas as variantes.
    await this.cache.delPattern(`${CACHE_USERS_LIST}:*`);
    return { message: "Usuario removido permanentemente" };
  }
}

// ── CSV Import Controller ──────────────────────────────────────────────────────
@Controller("users")
@UseGuards(AuthGuard("jwt"))
class UsersCsvController {
  constructor(private prisma: PrismaService, private cache: CacheService) {}

  @Post("import-csv")
  async importCsv(@Req() req: any, @Body() body: ImportCsvUsersDto) {
    if (!req.user?.isMaster) throw new BadRequestException("Apenas Masters podem importar usuários");
    if (!body?.csv?.trim()) throw new BadRequestException("CSV vazio");

    const lines = body.csv.split("\n").map((l: string) => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new BadRequestException("CSV deve ter cabeçalho + ao menos 1 linha");

    const headers = lines[0].split(",").map((h: string) => h.trim().toLowerCase().replace(/['"]/g, ""));
    const nomeIdx = headers.findIndex((h: string) => h.includes("nome"));
    const emailIdx = headers.findIndex((h: string) => h.includes("email"));
    const perfilIdx = headers.findIndex((h: string) => h.includes("perfil") || h.includes("role"));
    if (nomeIdx === -1 || emailIdx === -1) throw new BadRequestException("CSV deve conter colunas 'nome' e 'email'");

    const orgId = req.user.organizationId;
    // Papel `usuario`, escopado pela organizacao. Antes pegava tecnico/analista
    // de QUALQUER tenant (findFirst sem organizationId) e tambem buscava um
    // `masterRole` que nunca era usado -- por `nome` sozinho, que deixou de ser
    // unico quando papel virou dado por organizacao.
    const papelUsuario = await (this.prisma as any).role.findFirst({
      where: { nome: "usuario", isMaster: false, organizationId: orgId },
    });
    if (!papelUsuario) {
      throw new BadRequestException(
        "O papel 'usuario' nao existe nesta organizacao. Reinicie a API para semear os papeis e tente de novo."
      );
    }

    const results = { criados: 0, ignorados: 0, erros: [] as string[] };

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c: string) => c.trim().replace(/^["']|["']$/g, ""));
      const nome = cols[nomeIdx]?.trim();
      const email = cols[emailIdx]?.trim()?.toLowerCase();
      if (!nome || !email || !email.includes("@")) { results.erros.push(`Linha ${i + 1}: nome ou email inválido`); continue; }

      const existing = await (this.prisma as any).user.findFirst({ where: { email, organizationId: orgId } });
      if (existing) { results.ignorados++; continue; }

      const senhaTemp = Math.random().toString(36).slice(2, 10).toUpperCase() + "@" + Math.floor(Math.random() * 900 + 100);
      const senhaHash = await bcrypt.hash(senhaTemp, 10);
      const { v4: uuid } = await import("uuid");
      try {
        const user = await (this.prisma as any).user.create({ data: { id: uuid(), organizationId: orgId, nome, email, senhaHash, ativo: true, primeiroAcesso: true } as any });
        await (this.prisma as any).userRole.create({ data: { userId: user.id, roleId: papelUsuario.id } });
        results.criados++;
      } catch (e: any) {
        results.erros.push(`Linha ${i + 1}: ${e.message?.slice(0, 60)}`);
      }
    }

    await this.cache.delPattern(`${CACHE_USERS_LIST}:*`);
    return { ...results, total: lines.length - 1 };
  }
}

@Module({
  imports: [WebhooksModule, AutomacoesModule],
  controllers: [UsersController, UsersCsvController],
  providers: [CacheService],
})
export class UsersModule {}
