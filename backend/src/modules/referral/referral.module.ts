import {
  Module, Controller, Get, Post, Body, Param, Req, UseGuards,
  ForbiddenException, NotFoundException, BadRequestException, HttpCode, HttpStatus, Injectable,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { registrarIndicacao, codigoIndicacao } from "./referral.helpers";

// Valores fixos do MVP (centavos). Configuráveis depois.
const VALOR_ASSINATURA = 2700; // R$ 27,00
const VALOR_COMISSAO = 500;    // R$ 5,00

function requireSuperAdmin(req: any) {
  if (!req.user?.isSuperAdmin) throw new ForbiddenException("Acesso restrito a super-admins.");
}

@Injectable()
export class ReferralService {
  constructor(private prisma: PrismaService) {}

  // Painel: usuários em trial (dias/vencimento), quem indicou, efetivação e comissão.
  async painel() {
    const now = Date.now();
    const usuarios = await this.prisma.user.findMany({
      where: { isTrial: true } as any,
      orderBy: { trialExpiraEm: "asc" } as any,
      select: {
        id: true, nome: true, email: true, criadoEm: true, ativo: true,
        trialExpiraEm: true, trialModulo: true, assinaturaEm: true,
        profile: { select: { whatsapp: true } },
        indicacaoRecebida: {
          select: { id: true, status: true, comissaoValor: true, comissaoStatus: true, indicador: { select: { nome: true } } },
        },
      } as any,
    });

    const linhas = (usuarios as any[]).map((u) => {
      const expira: Date | null = u.trialExpiraEm ? new Date(u.trialExpiraEm) : null;
      const diasRestantes = expira ? Math.ceil((expira.getTime() - now) / 86400000) : null;
      const vencido = expira ? expira.getTime() < now : false;
      const r = u.indicacaoRecebida;
      return {
        id: u.id, nome: u.nome, email: u.email, whatsapp: u.profile?.whatsapp || null,
        codigo: codigoIndicacao(u.id), // código que ELE compartilha para indicar
        modulo: u.trialModulo, inicio: u.criadoEm, expira,
        diasRestantes, vencido,
        efetivado: !!u.assinaturaEm, assinaturaEm: u.assinaturaEm,
        indicadoPor: r?.indicador?.nome || null,
        referralId: r?.id || null,
        comissao: r ? { valor: r.comissaoValor, status: r.comissaoStatus } : null,
      };
    });

    const emTrial = linhas.filter((l) => !l.vencido && !l.efetivado).length;
    const vencidos = linhas.filter((l) => l.vencido && !l.efetivado).length;
    const efetivados = linhas.filter((l) => l.efetivado).length;

    const comissoes = await this.prisma.referral.findMany({
      where: { comissaoValor: { not: null } } as any,
      select: { comissaoValor: true, comissaoStatus: true } as any,
    });
    const soma = (f: (c: any) => boolean) =>
      (comissoes as any[]).filter(f).reduce((s, c) => s + (c.comissaoValor || 0), 0);
    const qtd = (f: (c: any) => boolean) => (comissoes as any[]).filter(f).length;
    const pend = (c: any) => c.comissaoStatus === "PENDENTE";
    const paga = (c: any) => c.comissaoStatus === "PAGA";

    return {
      stats: {
        emTrial, vencidos, efetivados,
        comissaoPendente: { qtd: qtd(pend), total: soma(pend) },
        comissaoPaga: { qtd: qtd(paga), total: soma(paga) },
      },
      usuarios: linhas,
    };
  }

  // Marca a assinatura (R$27). Se o usuário foi indicado, cria a comissão (R$5).
  async efetivar(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, indicacaoRecebida: { select: { id: true } } } as any,
    });
    if (!u) throw new NotFoundException("Usuário não encontrado.");
    await this.prisma.user.update({
      where: { id: userId },
      data: { assinaturaEm: new Date(), assinaturaValor: VALOR_ASSINATURA } as any,
    });
    const r = (u as any).indicacaoRecebida;
    if (r) {
      await this.prisma.referral.update({
        where: { id: r.id },
        data: {
          status: "EFETIVADO", efetivadoEm: new Date(), assinaturaValor: VALOR_ASSINATURA,
          comissaoValor: VALOR_COMISSAO, comissaoStatus: "PENDENTE",
        } as any,
      });
    }
    return { ok: true };
  }

  // Desfaz a efetivação (correção manual).
  async desfazerEfetivacao(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { assinaturaEm: null, assinaturaValor: null } as any,
    });
    const r = await this.prisma.referral.findUnique({ where: { indicadoUserId: userId } as any });
    if (r && (r as any).comissaoStatus !== "PAGA") {
      await this.prisma.referral.update({
        where: { id: (r as any).id },
        data: { status: "PENDENTE", efetivadoEm: null, comissaoValor: null, comissaoStatus: null } as any,
      });
    }
    return { ok: true };
  }

  async comissaoPaga(referralId: string, notas?: string) {
    const r = await this.prisma.referral.findUnique({ where: { id: referralId } });
    if (!r) throw new NotFoundException("Indicação não encontrada.");
    await this.prisma.referral.update({
      where: { id: referralId },
      data: { comissaoStatus: "PAGA", comissaoPagaEm: new Date(), notas: notas ?? (r as any).notas } as any,
    });
    return { ok: true };
  }

  // Define o indicador à mão (quando não veio código no cadastro).
  async definirIndicador(indicadoUserId: string, codigo: string) {
    const ok = await registrarIndicacao(this.prisma, codigo, indicadoUserId);
    if (!ok) throw new BadRequestException("Código inválido, autoindicação, ou o usuário já tem indicador.");
    return { ok: true };
  }

  // Código de indicação de um usuário (para o admin compartilhar/consultar).
  codigoDoUsuario(userId: string) {
    return { codigo: codigoIndicacao(userId) };
  }
}

@Controller("referral/admin")
@UseGuards(AuthGuard("jwt"))
export class ReferralAdminController {
  constructor(private svc: ReferralService) {}

  @Get("painel")
  async painel(@Req() req: any) { requireSuperAdmin(req); return this.svc.painel(); }

  @Get(":userId/codigo")
  async codigo(@Req() req: any, @Param("userId") userId: string) { requireSuperAdmin(req); return this.svc.codigoDoUsuario(userId); }

  @Post(":userId/efetivar")
  @HttpCode(HttpStatus.OK)
  async efetivar(@Req() req: any, @Param("userId") userId: string) { requireSuperAdmin(req); return this.svc.efetivar(userId); }

  @Post(":userId/desfazer-efetivacao")
  @HttpCode(HttpStatus.OK)
  async desfazer(@Req() req: any, @Param("userId") userId: string) { requireSuperAdmin(req); return this.svc.desfazerEfetivacao(userId); }

  @Post(":userId/indicador")
  @HttpCode(HttpStatus.OK)
  async indicador(@Req() req: any, @Param("userId") userId: string, @Body() body: { codigo: string }) {
    requireSuperAdmin(req); return this.svc.definirIndicador(userId, body?.codigo || "");
  }

  @Post("comissao/:referralId/paga")
  @HttpCode(HttpStatus.OK)
  async pagar(@Req() req: any, @Param("referralId") referralId: string, @Body() body: { notas?: string }) {
    requireSuperAdmin(req); return this.svc.comissaoPaga(referralId, body?.notas);
  }
}

@Module({
  controllers: [ReferralAdminController],
  providers: [ReferralService],
  exports: [ReferralService],
})
export class ReferralModule {}
