import {
  Module, Controller, Get, Put, Body, Param, Query, UseGuards, Req,
  BadRequestException, ForbiddenException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsOptional, IsBoolean, IsArray, IsString } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";

function uuid() { return require("crypto").randomUUID(); }

// Catálogo de tipos de alerta que a organização pode configurar.
const TIPOS = [
  { tipo: "orcamento_estouro",  titulo: "Orçamento estourado",        descricao: "Quando um item de orçamento passa do previsto no mês." },
  { tipo: "sla_risco",          titulo: "SLA em risco",               descricao: "Quando um chamado está prestes a violar o SLA." },
  { tipo: "garantia_vencendo",  titulo: "Garantia de ativo vencendo", descricao: "Quando a garantia de um ativo está perto de expirar." },
  { tipo: "documento_vencendo", titulo: "Documento de veículo vencendo", descricao: "Quando um documento/veículo da frota está perto de vencer." },
];
const CANAIS = ["sistema", "email", "whatsapp"];

class SalvarRegraDto {
  @IsOptional() @IsBoolean() ativo?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) canais?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) destinatarios?: string[];
}

@Controller("alertas")
@UseGuards(AuthGuard("jwt"))
class AlertasController {
  constructor(private prisma: PrismaService) {}

  // Área administrativa: master, administrador ou super admin.
  private assertAdmin(user: any) {
    const ok = user?.isMaster || user?.isSuperAdmin || (user?.roles ?? []).includes("administrador");
    if (!ok) throw new ForbiddenException("Acesso restrito à administração da organização");
  }

  @Get("regras")
  async regras(@Req() req: any) {
    this.assertAdmin(req.user);
    const orgId = req.user?.organizationId;
    const existentes = await (this.prisma as any).alertaRegra.findMany({ where: { organizationId: orgId } });
    const porTipo = new Map(existentes.map((r: any) => [r.tipo, r]));
    const parse = (s: string, fallback: any) => { try { return JSON.parse(s || ""); } catch { return fallback; } };
    // Mescla o catálogo com o que já está salvo; tipos sem registro vêm no padrão.
    return TIPOS.map(t => {
      const r: any = porTipo.get(t.tipo);
      return {
        tipo: t.tipo, titulo: t.titulo, descricao: t.descricao,
        ativo: r ? r.ativo : true,
        canais: r ? parse(r.canais, ["sistema"]) : ["sistema"],
        destinatarios: r ? parse(r.destinatarios, []) : [],
      };
    });
  }

  @Put("regras/:tipo")
  async salvar(@Param("tipo") tipo: string, @Body() dto: SalvarRegraDto, @Req() req: any) {
    this.assertAdmin(req.user);
    if (!TIPOS.find(t => t.tipo === tipo)) throw new BadRequestException("Tipo de alerta inválido");
    const orgId = req.user?.organizationId;
    const canais = JSON.stringify(Array.from(new Set((dto.canais ?? []).filter(c => CANAIS.includes(c)))));
    const destinatarios = JSON.stringify(Array.from(new Set((dto.destinatarios ?? []).filter(Boolean))));
    const ativo = dto.ativo ?? true;
    await (this.prisma as any).alertaRegra.upsert({
      where: { organizationId_tipo: { organizationId: orgId, tipo } },
      create: { id: uuid(), organizationId: orgId, tipo, ativo, canais, destinatarios },
      update: { ativo, canais, destinatarios },
    });
    return { ok: true };
  }

  // Usuários da organização para escolher como destinatários.
  @Get("usuarios")
  async usuarios(@Req() req: any, @Query("q") q?: string) {
    this.assertAdmin(req.user);
    const orgId = req.user?.organizationId;
    const where: any = { ativo: true, ...(orgId ? { organizationId: orgId } : {}) };
    if (q && q.trim()) {
      where.OR = [
        { nome: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }
    return (this.prisma as any).user.findMany({
      where, select: { id: true, nome: true, email: true }, orderBy: { nome: "asc" }, take: 50,
    });
  }
}

@Module({ controllers: [AlertasController] })
export class AlertasModule {}
