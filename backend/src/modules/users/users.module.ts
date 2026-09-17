import { Module, Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Req, ConflictException, BadRequestException, NotFoundException, ForbiddenException } from "@nestjs/common";
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
import { ConfigService } from "@nestjs/config";
import { AuthModule } from "../auth/auth.module";
import { AuthService } from "../auth/auth.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { NotificacaoDispatcher } from "../notifications/notificacao-dispatcher.service";
import { montarBoasVindasCadastro, normalizarWhatsapp } from "../notifications/whatsapp-boas-vindas";
import { MARCA } from "../../common/marca";

const CACHE_USERS_LIST = "cache:users:list";
const CACHE_USER       = (id: string) => `cache:user:${id}`;
const TTL_LIST         = 60;   // 1 min
const TTL_USER         = 120;  // 2 min

// Modulos "gerenciaveis" (visibilidade no menu). Devem casar com o catalogo do
// front (cadastros/page.tsx MODULOS_CATALOG) e com o gating do Sidebar.tsx.
// Regra: lista vazia => usuario ve TODOS os modulos (retrocompat, ninguem perde acesso).
const ALL_MODULOS = [
  "chamados", "conhecimento", "projetos", "gantt", "agenda", "ativos",
  "monitoramento", "keep", "crm", "financeiro", "orcamento", "frota", "relatorios",
  "whatsapp",
];

function parseModulos(raw?: string | null): string[] {
  try { return JSON.parse(raw || "[]"); } catch { return [...ALL_MODULOS]; }
}

class CreateUserDto {
  @IsString() nome: string;
  @IsEmail() email: string;
  @IsString() @MinLength(6) senha: string;
  @IsOptional() @IsString() cargo?: string;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsString() setorId?: string;
  @IsOptional() @IsArray() modulos?: string[];
}
class UpdateUserDto {
  @IsOptional() @IsString() nome?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
  @IsOptional() @IsString() cargo?: string;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsString() setorId?: string;
}

/**
 * WhatsApp informado pelo administrador no cadastro. Já nasce confirmado
 * (decisão de 17/09/2026: a palavra de quem cadastra substitui o código) e com
 * os alertas ligados. Trocar o número derruba o código pendente; apagar desliga.
 */
function camposWhatsapp(bruto: string): Record<string, any> {
  let numero: string | null;
  try { numero = normalizarWhatsapp(bruto); }
  catch (e: any) { throw new BadRequestException(e.message); }
  if (!numero) return { whatsapp: null, whatsappVerificado: false, whatsappAlertas: false };
  return {
    whatsapp: numero, whatsappVerificado: true, whatsappAlertas: true,
    whatsappCodigo: null, whatsappCodigoExpira: null, whatsappTentativas: 0,
  };
}
class ChangePasswordDto { @IsString() @MinLength(6) novaSenha: string; }
class UpdateModulosDto { @IsArray() modulos: string[]; }

function mapUser(u: any) {
  return {
    id: u.id, nome: u.nome, email: u.email, ativo: u.ativo,
    avatar: u.avatar, ultimoLogin: u.ultimoLogin, criadoEm: u.criadoEm,
    cargo: u.profile?.cargo,
    telefone: u.profile?.telefone,
    whatsapp: u.profile?.whatsapp,
    setor: u.profile?.setor ? { id: u.profile.setor.id, nome: u.profile.setor.nome, cor: u.profile.setor.cor } : null,
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
    private auth: AuthService,
    private dispatcher: NotificacaoDispatcher,
    private config: ConfigService,
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
        profile: { include: { setor: true } },
      },
    });
    const result = users
      .filter(u => incluirMaster === "true" ? true : !u.userRoles.some(ur => ur.role.isMaster))
      .map(mapUser);
    await this.cache.set(cacheKey, result, TTL_LIST);
    return result;
  }

  @Get("roles/list")
  @Permissions("usuarios:ver")
  async getRoles() { return this.prisma.role.findMany({ orderBy: { nome: "asc" } }); }

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
      include: { userRoles: { include: { role: true } }, profile: { include: { setor: true } } },
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
      include: { userRoles: { include: { role: true } }, profile: { include: { setor: true } } },
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

    const hash = await bcrypt.hash(dto.senha, 12);
    const modulosJson = JSON.stringify(dto.modulos ?? ALL_MODULOS);
    const whatsapp = dto.whatsapp !== undefined ? camposWhatsapp(dto.whatsapp) : {};

    const user = await this.prisma.user.create({
      data: {
        nome: dto.nome, email: dto.email, senhaHash: hash,
        ...(orgId ? { organizationId: orgId } : {}),
        profile: { create: { cargo: dto.cargo, telefone: dto.telefone, setorId: dto.setorId || null, modulos: modulosJson, ...whatsapp } },
      } as any,
      include: { userRoles: { include: { role: true } }, profile: { include: { setor: true } } },
    });
    await this.cache.delPattern(`${CACHE_USERS_LIST}:*`);
    this.webhook.fire("usuario.criado", {
      id: user.id, nome: user.nome, email: user.email,
      cargo: dto.cargo || null, criadoEm: user.criadoEm,
    }, orgId).catch(() => {});
    this.automacao.executar("usuario_criado", {
      id: user.id, nome: user.nome, email: user.email,
      cargo: dto.cargo || null, organizationId: orgId,
    }).catch(() => {});
    return mapUser(user);
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
    await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.nome && { nome: dto.nome }),
        ...(dto.email && { email: dto.email }),
        ...(dto.ativo !== undefined && { ativo: dto.ativo }),
      },
    });
    // Só mexe no WhatsApp quando o número MUDOU: salvar o cadastro sem tocar no
    // campo não pode religar alertas que a pessoa desligou no próprio perfil.
    let whatsapp: Record<string, any> = {};
    if (dto.whatsapp !== undefined) {
      const atual = await this.prisma.userProfile.findUnique({ where: { userId: id }, select: { whatsapp: true } });
      const novo = camposWhatsapp(dto.whatsapp);
      if ((novo.whatsapp ?? null) !== (atual?.whatsapp ?? null)) whatsapp = novo;
    }
    await this.prisma.userProfile.upsert({
      where: { userId: id },
      update: { cargo: dto.cargo, telefone: dto.telefone, ...(dto.setorId !== undefined && { setorId: dto.setorId || null }), ...whatsapp },
      create: { userId: id, cargo: dto.cargo, telefone: dto.telefone, setorId: dto.setorId || null, ...whatsapp },
    });
    await this.cache.del(CACHE_USER(id));
    // A lista é cacheada por `${CACHE_USERS_LIST}:${orgId}:${incluirMaster}` — o
    // orgId no meio fazia as chaves fixas antigas nunca baterem, e a exclusão/
    // edição só "aparecia" após o TTL de 60s. delPattern limpa todas as variantes.
    await this.cache.delPattern(`${CACHE_USERS_LIST}:*`);
    return this.findOne(id, req);
  }

  /**
   * Manda as boas-vindas pelo WhatsApp. Rota separada, e não dentro do POST,
   * porque a tela grava os papéis DEPOIS de criar o usuário: enviada no create,
   * a mensagem sairia sem nenhum módulo. A tela chama ao fim do salvamento.
   *
   * Sem `@Permissions` porque serve a quem cria OU a quem edita, e o guard só
   * sabe exigir todas; a checagem é feita aqui.
   */
  @Post(":id/whatsapp/boas-vindas")
  async boasVindasWhatsapp(@Param("id") id: string, @Req() req: any) {
    const perms: string[] = req.user?.permissions || [];
    const pode = req.user?.isMaster || perms.includes("*") || perms.includes("usuarios:criar") || perms.includes("usuarios:editar");
    if (!pode) throw new ForbiddenException("Sem permissão para cadastrar usuários.");

    const user: any = await acharNaOrganizacao(this.prisma.user, id, req, "Usuario nao encontrado", {
      include: { profile: { select: { whatsapp: true, whatsappVerificado: true } } },
    });
    if (!user.ativo || !user.profile?.whatsapp || !user.profile?.whatsappVerificado) return { enviado: false };

    // O papel acabou de ser gravado: sem limpar o cache, a mensagem sairia com
    // as permissões de antes (ou nenhuma).
    await this.auth.invalidatePermissionsCache(id);
    const permissoes = await this.auth.resolvePermissions(id);
    const url = this.config.get<string>("APP_URL") || "";
    const enviado = await this.dispatcher.enfileirarDireto({
      organizationId: user.organizationId,
      canal: "whatsapp",
      destino: user.profile.whatsapp,
      modulo: "core",
      tipo: "boas_vindas_whatsapp",
      titulo: "Boas-vindas",
      mensagem: montarBoasVindasCadastro({ nome: user.nome, email: user.email, permissoes, marca: MARCA, url }),
      userId: id,
      // Disparada por quem cadastra, na hora: não espera a janela de silêncio.
      ignorarSilencio: true,
    });
    return { enviado };
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
    const masterRole = await (this.prisma as any).role.findUnique({ where: { nome: "master" } });
    const tecnicoRole = await (this.prisma as any).role.findFirst({ where: { nome: { in: ["tecnico", "analista"] } } });

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
        if (tecnicoRole) await (this.prisma as any).userRole.create({ data: { userId: user.id, roleId: tecnicoRole.id } });
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
  imports: [WebhooksModule, AutomacoesModule, AuthModule, NotificationsModule],
  controllers: [UsersController, UsersCsvController],
  providers: [CacheService],
})
export class UsersModule {}
