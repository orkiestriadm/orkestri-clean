import {
  Module, Controller, Get, Post, Patch,
  Body, Param, Query, Req, UseGuards,
  NotFoundException, BadRequestException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Permissions } from "../auth/permissions.decorator";

const PORTAL_USER_ID = "00000000-0000-0000-0000-000000portal";

@Controller("portal")
class PortalController {
  constructor(private prisma: PrismaService) {}
  private get db() { return this.prisma as any; }

  // GET /portal/:token — client info + stats + recent tickets
  @Get(":token")
  async getPortal(@Param("token") token: string) {
    const cliente = await this.db.cliente.findFirst({
      where: { portalToken: token, ativo: true },
      select: {
        id: true, nome: true, empresa: true, email: true,
        telefone: true, saudeScore: true,
      },
    });
    if (!cliente) throw new NotFoundException("Portal não encontrado");

    const [chamados, total, abertos, resolvidos] = await Promise.all([
      this.db.chamado.findMany({
        where: { clienteId: cliente.id },
        select: {
          id: true, numero: true, titulo: true, status: true,
          prioridade: true, categoria: true, criadoEm: true,
          resolvidoEm: true, avaliacao: true,
          atendente: { select: { id: true, nome: true } },
        },
        orderBy: { criadoEm: "desc" },
        take: 50,
      }),
      this.db.chamado.count({ where: { clienteId: cliente.id } }),
      this.db.chamado.count({ where: { clienteId: cliente.id, status: { in: ["aberto","em_atendimento","aguardando"] } } }),
      this.db.chamado.count({ where: { clienteId: cliente.id, status: { in: ["resolvido","fechado"] } } }),
    ]);

    return { cliente, chamados, stats: { total, abertos, resolvidos } };
  }

  // GET /portal/:token/chamado/:id — single ticket status
  @Get(":token/chamado/:id")
  async getChamado(@Param("token") token: string, @Param("id") id: string) {
    const cliente = await this.db.cliente.findFirst({ where: { portalToken: token, ativo: true } });
    if (!cliente) throw new NotFoundException("Portal não encontrado");

    const chamado = await this.db.chamado.findFirst({
      where: { id, clienteId: cliente.id },
      select: {
        id: true, numero: true, titulo: true, descricao: true,
        status: true, prioridade: true, categoria: true, tags: true,
        criadoEm: true, atualizadoEm: true, resolvidoEm: true,
        avaliacao: true, avaliacaoNota: true,
        atendente:   { select: { id: true, nome: true, avatar: true } },
        solicitante: { select: { id: true, nome: true } },
        comentarios: {
          select: { id: true, conteudo: true, criadoEm: true, publico: true, user: { select: { nome: true, avatar: true } } },
          where: { publico: true },
          orderBy: { criadoEm: "asc" },
        },
      },
    });
    if (!chamado) throw new NotFoundException("Chamado não encontrado");
    return chamado;
  }

  // POST /portal/:token/chamado — open new ticket
  @Post(":token/chamado")
  async createChamado(
    @Param("token") token: string,
    @Body() body: {
      titulo: string;
      descricao: string;
      prioridade?: string;
      categoria?: string;
      nomeContato?: string;
      emailContato?: string;
    },
  ) {
    if (!body.titulo?.trim())    throw new BadRequestException("Título obrigatório");
    if (!body.descricao?.trim()) throw new BadRequestException("Descrição obrigatória");

    const cliente = await this.db.cliente.findFirst({ where: { portalToken: token, ativo: true } });
    if (!cliente) throw new NotFoundException("Portal não encontrado");

    // Build descricao with contact info if provided
    let descricao = body.descricao.trim();
    if (body.nomeContato || body.emailContato) {
      const contact = [
        body.nomeContato  && `Contato: ${body.nomeContato}`,
        body.emailContato && `Email: ${body.emailContato}`,
      ].filter(Boolean).join(" | ");
      descricao = `[${contact}]\n\n${descricao}`;
    }

    const last = await this.db.chamado.findFirst({ orderBy: { numero: "desc" }, select: { numero: true } });
    const numero = (last?.numero || 0) + 1;

    const chamado = await this.db.chamado.create({
      data: {
        id:           require("crypto").randomUUID(),
        numero,
        titulo:       body.titulo.trim(),
        descricao,
        status:       "aberto",
        prioridade:   body.prioridade || "media",
        categoria:    body.categoria  || null,
        clienteId:    cliente.id,
        solicitanteId: PORTAL_USER_ID,
      },
      select: { id: true, numero: true, titulo: true, status: true, criadoEm: true },
    });

    return chamado;
  }

  // PATCH /portal/:token/chamado/:id/avaliar — submit CSAT
  @Patch(":token/chamado/:id/avaliar")
  async avaliar(
    @Param("token") token: string,
    @Param("id") id: string,
    @Body() body: { nota: number; comentario?: string },
  ) {
    const nota = Number(body.nota);
    if (!nota || nota < 1 || nota > 5) throw new BadRequestException("Nota deve ser entre 1 e 5");

    const cliente = await this.db.cliente.findFirst({ where: { portalToken: token, ativo: true } });
    if (!cliente) throw new NotFoundException("Portal não encontrado");

    const chamado = await this.db.chamado.findFirst({ where: { id, clienteId: cliente.id } });
    if (!chamado) throw new NotFoundException("Chamado não encontrado");
    if (!["resolvido","fechado"].includes(chamado.status)) throw new BadRequestException("Chamado ainda não resolvido");

    return this.db.chamado.update({
      where: { id },
      data: { avaliacao: nota, avaliacaoNota: body.comentario?.trim() || null },
      select: { id: true, numero: true, avaliacao: true, avaliacaoNota: true },
    });
  }

  // GET /portal/:token/contratos
  @Get(":token/contratos")
  async getContratos(@Param("token") token: string) {
    const cliente = await this.db.cliente.findFirst({ where: { portalToken: token, ativo: true } });
    if (!cliente) throw new NotFoundException("Portal não encontrado");
    return this.db.contrato.findMany({
      where: { clienteId: cliente.id, ativo: true },
      select: { id: true, numero: true, titulo: true, tipo: true, status: true,
        vigenciaInicio: true, vigenciaFim: true, valor: true, slaHoras: true, plano: true },
      orderBy: { vigenciaFim: "asc" },
    });
  }

  // GET /portal/:token/faturas
  @Get(":token/faturas")
  async getFaturas(@Param("token") token: string) {
    const cliente = await this.db.cliente.findFirst({ where: { portalToken: token, ativo: true } });
    if (!cliente) throw new NotFoundException("Portal não encontrado");
    const faturas = await this.db.fatura.findMany({
      where: { clienteId: cliente.id },
      select: { id: true, numero: true, descricao: true, valor: true,
        dataEmissao: true, dataVencimento: true, dataPagamento: true, status: true },
      orderBy: { dataVencimento: "desc" },
      take: 30,
    });
    const now = new Date();
    return faturas.map((f: any) => ({
      ...f,
      statusComputado: f.status === "pago" || f.status === "cancelado"
        ? f.status
        : f.dataVencimento < now ? "vencido" : "pendente",
    }));
  }

  // As rotas administrativas do token NAO moram aqui — este controller e
  // publico por natureza (o token do cliente E a credencial). Ver
  // PortalAdminController abaixo, que exige JWT e permissao.
}

/**
 * Administracao do token de portal.
 *
 * Vive em um controller SEPARADO e autenticado de proposito. Enquanto estas
 * duas rotas moravam no PortalController — que nao tem guard, porque o portal
 * do cliente e publico —, qualquer pessoa na internet podia:
 *
 *   GET  /api/portal/admin/:clienteId/token      ler o token de QUALQUER cliente
 *   POST /api/portal/admin/:clienteId/regenerar  rotacionar o token de qualquer
 *                                                cliente e receber o novo
 *
 * O primeiro ainda CRIAVA o token quando nao existia; o segundo derrubava o
 * link legitimo do cliente e entregava o acesso a quem chamou. Com o token em
 * maos, o portal expoe chamados, contratos e faturas daquele cliente.
 *
 * O comentario original dizia "needs no auth since called from clientes
 * module". Nao e uma chamada interna — e uma rota HTTP exposta.
 *
 * O prefixo mudou de `portal/admin` para `portal-admin` para nao conviver com
 * as rotas publicas `portal/:token`. Nenhum consumidor quebra: o frontend le o
 * `portalToken` junto do objeto do cliente e nunca chamou estas duas.
 */
@Controller("portal-admin")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class PortalAdminController {
  constructor(private prisma: PrismaService) {}
  private get db() { return this.prisma as any; }

  /** Resolve o cliente DENTRO da organizacao de quem chamou. */
  private async clienteDaOrg(req: any, clienteId: string) {
    const cliente = await this.db.cliente.findFirst({
      where: { id: clienteId, organizationId: req.user.organizationId },
    });
    // 404 e nao 403: para quem esta fora da organizacao, o cliente nao existe.
    // Responder 403 confirmaria a existencia do id em outro tenant.
    if (!cliente) throw new NotFoundException("Cliente nao encontrado");
    return cliente;
  }

  // `crm:*` e nao `clientes:*`: sao os dois esquemas de nome que convivem no
  // projeto, mas e `crm:*` que o ClientesController exige de fato. O token da
  // acesso aos chamados, contratos e faturas do cliente — tem que custar ao
  // menos o mesmo que ver o cliente.
  @Get(":clienteId/token")
  @Permissions("crm:ver")
  async getToken(@Req() req: any, @Param("clienteId") clienteId: string) {
    const cliente = await this.clienteDaOrg(req, clienteId);
    if (cliente.portalToken) return { token: cliente.portalToken };

    const updated = await this.db.cliente.update({
      where: { id: cliente.id },
      data: { portalToken: randomUUID() },
      select: { portalToken: true },
    });
    return { token: updated.portalToken };
  }

  @Post(":clienteId/regenerar")
  @Permissions("crm:editar")
  async regenerarToken(@Req() req: any, @Param("clienteId") clienteId: string) {
    const cliente = await this.clienteDaOrg(req, clienteId);
    const updated = await this.db.cliente.update({
      where: { id: cliente.id },
      data: { portalToken: randomUUID() },
      select: { portalToken: true },
    });
    return { token: updated.portalToken };
  }
}

@Module({ controllers: [PortalController, PortalAdminController] })
export class PortalModule {}
