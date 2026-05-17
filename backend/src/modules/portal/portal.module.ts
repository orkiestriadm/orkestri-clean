import {
  Module, Controller, Get, Post, Patch,
  Body, Param, Query,
  NotFoundException, BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

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

  // POST /portal/:token/gerar — regenerate portal token (internal utility, should be called from admin)
  // Actually exposed via a separate admin endpoint below

  // GET /portal-admin/:clienteId/token — get/regenerate portal token (needs no auth since called from clientes module)
  @Get("admin/:clienteId/token")
  async getToken(@Param("clienteId") clienteId: string) {
    const cliente = await this.db.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) throw new NotFoundException("Cliente não encontrado");
    if (!cliente.portalToken) {
      const updated = await this.db.cliente.update({
        where: { id: clienteId },
        data: { portalToken: require("crypto").randomUUID() },
        select: { portalToken: true },
      });
      return { token: updated.portalToken };
    }
    return { token: cliente.portalToken };
  }

  @Post("admin/:clienteId/regenerar")
  async regenerarToken(@Param("clienteId") clienteId: string) {
    const cliente = await this.db.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) throw new NotFoundException("Cliente não encontrado");
    const updated = await this.db.cliente.update({
      where: { id: clienteId },
      data: { portalToken: require("crypto").randomUUID() },
      select: { portalToken: true },
    });
    return { token: updated.portalToken };
  }
}

@Module({ controllers: [PortalController], providers: [PrismaService] })
export class PortalModule {}
