import {
  Controller, Get, Put, Post, Body, Param, Query, UseGuards, Req,
  ForbiddenException, BadRequestException, NotFoundException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { PrismaService } from "../../prisma/prisma.service";
import { WhatsAppService } from "./whatsapp.service";
import * as crypto from "crypto";
import { MODULOS_NOTIFICAVEIS, MODULO_IDS, moduloValido, modulosVisiveis } from "./notificacao-modulos";

/**
 * Configuração de quem recebe o quê.
 *
 * Regra de acesso: só MASTER configura as preferências dos outros. A pessoa
 * comum consulta as suas e verifica o próprio número, mas não se autoconcede
 * módulo — senão a permissão que o master define não valeria nada.
 */

const SEVERIDADES = ["info", "aviso", "critico"];

function exigirMaster(req: any) {
  if (!req.user?.isMaster) throw new ForbiddenException("Apenas masters podem configurar notificações");
}

@Controller("notificacoes/preferencias")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class NotificacaoPrefsController {
  constructor(private prisma: PrismaService, private wa: WhatsAppService) {}
  private get db() { return this.prisma as any; }

  /** Catálogo para a tela montar as opções sem duplicar a lista no frontend. */
  @Get("catalogo")
  async catalogo() {
    return { modulos: MODULOS_NOTIFICAVEIS, severidades: SEVERIDADES };
  }

  /**
   * Quadro completo para o modal do master: cada usuário, o que ele ENXERGA e
   * o que ele RECEBE.
   *
   * `modulosVisiveis` vai junto porque o modal precisa desabilitar o que a
   * pessoa não acessa. Deixar marcar um módulo sem acesso criaria preferência
   * que nunca dispara — configuração que mente para quem configurou.
   */
  @Get()
  async listar(@Req() req: any, @Query("userId") userId?: string) {
    exigirMaster(req);
    const orgId = req.user.organizationId;

    const where: any = { organizationId: orgId, ativo: true };
    if (userId) where.id = userId;

    const users = await this.db.user.findMany({
      where,
      select: {
        id: true, nome: true, email: true, avatar: true,
        profile: {
          select: {
            whatsapp: true, whatsappVerificado: true, whatsappAlertas: true, modulos: true,
          },
        },
      },
      orderBy: { nome: "asc" },
    });

    const prefs = await this.db.notificacaoPreferencia.findMany({
      where: { organizationId: orgId, ...(userId ? { userId } : {}) },
    });
    const porUsuario = new Map<string, any[]>();
    for (const p of prefs) {
      if (!porUsuario.has(p.userId)) porUsuario.set(p.userId, []);
      porUsuario.get(p.userId)!.push(p);
    }

    return {
      modulos: MODULOS_NOTIFICAVEIS,
      severidades: SEVERIDADES,
      usuarios: users.map((u: any) => ({
        id: u.id, nome: u.nome, email: u.email, avatar: u.avatar,
        whatsapp: u.profile?.whatsapp || null,
        whatsappVerificado: !!u.profile?.whatsappVerificado,
        modulosVisiveis: modulosVisiveis(u.profile?.modulos),
        preferencias: (porUsuario.get(u.id) || []).map((p: any) => ({
          modulo: p.modulo, sistema: p.sistema, whatsapp: p.whatsapp,
          email: p.email, severidadeMin: p.severidadeMin,
        })),
      })),
    };
  }

  /** O que EU recebo — leitura para o usuário comum. */
  @Get("me")
  async minhas(@Req() req: any) {
    const prefs = await this.db.notificacaoPreferencia.findMany({
      where: { organizationId: req.user.organizationId, userId: req.user.id },
    });
    const perfil = await this.db.userProfile.findUnique({
      where: { userId: req.user.id },
      select: { whatsapp: true, whatsappVerificado: true },
    });
    return {
      modulos: MODULOS_NOTIFICAVEIS,
      preferencias: prefs,
      whatsapp: perfil?.whatsapp || null,
      whatsappVerificado: !!perfil?.whatsappVerificado,
    };
  }

  /**
   * Grava o conjunto de preferências de UM usuário, substituindo o anterior.
   *
   * Substituição total (e não merge) é deliberada: o modal mostra o estado
   * inteiro, então desmarcar um módulo tem que apagá-lo. Com merge, desmarcar
   * não teria efeito e a pessoa continuaria recebendo — falha silenciosa
   * justamente no sentido perigoso.
   */
  @Put(":userId")
  async salvar(@Param("userId") userId: string, @Body() body: any, @Req() req: any) {
    exigirMaster(req);
    const orgId = req.user.organizationId;

    const alvo = await this.db.user.findFirst({
      where: { id: userId, organizationId: orgId },
      select: { id: true, profile: { select: { modulos: true } } },
    });
    if (!alvo) throw new NotFoundException("Usuário não encontrado nesta organização");

    const entradas = Array.isArray(body?.preferencias) ? body.preferencias : null;
    if (!entradas) throw new BadRequestException("Envie `preferencias` como lista");

    const visiveis = modulosVisiveis(alvo.profile?.modulos);
    const validas: any[] = [];
    for (const e of entradas) {
      const modulo = String(e?.modulo || "").trim();
      if (!moduloValido(modulo)) throw new BadRequestException(`Módulo desconhecido: "${modulo}"`);
      // Impede configurar módulo que a pessoa não acessa: a preferência nunca
      // dispararia (o despachante checa o acesso de novo) e o master ficaria
      // achando que configurou.
      if (!visiveis.includes(modulo)) {
        throw new BadRequestException(`O usuário não tem acesso ao módulo "${modulo}". Ajuste o acesso antes.`);
      }
      const sev = String(e?.severidadeMin || "info");
      if (!SEVERIDADES.includes(sev)) throw new BadRequestException(`Severidade inválida: "${sev}"`);

      const sistema = e?.sistema !== false;
      const whatsapp = !!e?.whatsapp;
      const email = !!e?.email;
      // Linha sem canal nenhum é ruído: equivale a não ter preferência.
      if (!sistema && !whatsapp && !email) continue;

      validas.push({ modulo, sistema, whatsapp, email, severidadeMin: sev });
    }

    await this.db.$transaction([
      this.db.notificacaoPreferencia.deleteMany({ where: { organizationId: orgId, userId } }),
      ...validas.map(v => this.db.notificacaoPreferencia.create({
        data: {
          id: crypto.randomUUID(), organizationId: orgId, userId,
          ...v, atualizadoPorId: req.user.id,
        },
      })),
    ]);

    return { ok: true, total: validas.length };
  }

  /** Aplica o mesmo conjunto a vários usuários de uma vez. */
  @Post("aplicar-em-lote")
  async lote(@Body() body: any, @Req() req: any) {
    exigirMaster(req);
    const userIds: string[] = Array.isArray(body?.userIds) ? body.userIds : [];
    if (!userIds.length) throw new BadRequestException("Informe `userIds`");

    let aplicados = 0;
    const ignorados: string[] = [];
    for (const uid of userIds) {
      try {
        await this.salvar(uid, body, req);
        aplicados++;
      } catch (e: any) {
        // Um usuário sem acesso ao módulo não derruba o lote inteiro — ele é
        // reportado e o resto segue.
        ignorados.push(`${uid}: ${e?.message || e}`);
      }
    }
    return { ok: true, aplicados, ignorados };
  }

  // ── Configuração de silêncio e vazão da organização ────────────────────────

  @Get("config/org")
  async lerConfig(@Req() req: any) {
    exigirMaster(req);
    const cfg = await this.db.orgNotificacaoConfig.findUnique({
      where: { organizationId: req.user.organizationId },
    });
    return cfg || {
      silencioInicio: 21, silencioFim: 7, silencioIgnoraCritico: true,
      maxPorMinuto: 12, agruparPorModulo: true, _padrao: true,
    };
  }

  @Put("config/org")
  @Permissions("whatsapp:configurar")
  async salvarConfig(@Body() body: any, @Req() req: any) {
    exigirMaster(req);
    const hora = (v: any, padrao: number) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 23) {
        if (v === undefined || v === null) return padrao;
        throw new BadRequestException("Hora deve ser inteiro entre 0 e 23");
      }
      return n;
    };
    const maxPorMinuto = Number(body?.maxPorMinuto ?? 12);
    // Teto de 60: acima disso o padrão de disparo passa a parecer robô para o
    // WhatsApp, que é exatamente o critério de banimento que se quer evitar.
    if (!Number.isInteger(maxPorMinuto) || maxPorMinuto < 1 || maxPorMinuto > 60) {
      throw new BadRequestException("Vazão deve ser entre 1 e 60 mensagens por minuto");
    }

    const dados = {
      silencioInicio: hora(body?.silencioInicio, 21),
      silencioFim: hora(body?.silencioFim, 7),
      silencioIgnoraCritico: body?.silencioIgnoraCritico !== false,
      maxPorMinuto,
      agruparPorModulo: body?.agruparPorModulo !== false,
    };

    return this.db.orgNotificacaoConfig.upsert({
      where: { organizationId: req.user.organizationId },
      create: { id: crypto.randomUUID(), organizationId: req.user.organizationId, ...dados },
      update: dados,
    });
  }

  // ── Verificação do número ──────────────────────────────────────────────────

  /**
   * Envia código de confirmação para o número do próprio usuário.
   *
   * Sem esta etapa o telefone era digitado à mão e usado direto: um dígito
   * errado manda alerta interno da empresa para um desconhecido, e ninguém
   * descobre porque não existe retorno de entrega.
   */
  @Post("verificar/enviar")
  async enviarCodigo(@Req() req: any, @Body() body: any) {
    const telefone = String(body?.whatsapp || "").replace(/\D/g, "");
    if (telefone.length < 10 || telefone.length > 13) {
      throw new BadRequestException("Número inválido. Use DDD + número.");
    }

    const codigo = String(crypto.randomInt(100000, 999999));
    const expira = new Date(Date.now() + 10 * 60000);

    await this.db.userProfile.upsert({
      where: { userId: req.user.id },
      create: {
        userId: req.user.id, whatsapp: telefone,
        whatsappCodigo: codigo, whatsappCodigoExpira: expira,
        whatsappVerificado: false, whatsappTentativas: 0,
      },
      update: {
        whatsapp: telefone, whatsappCodigo: codigo, whatsappCodigoExpira: expira,
        // Trocar o número derruba a verificação anterior — senão bastaria
        // verificar um número próprio e depois apontar para outro qualquer.
        whatsappVerificado: false, whatsappTentativas: 0,
      },
    });

    // Composto a partir de `resolveInstance` + `sendOtp` em vez de usar o
    // atalho `sendOtpForOrg`: o serviço de WhatsApp está em versões diferentes
    // entre os ambientes, e depender do atalho obrigaria a sobrescrever o
    // arquivo inteiro lá — junto com 13 linhas de template de mensagem que só
    // existem naquele servidor. As duas peças usadas aqui existem em ambos.
    const instancia = await this.wa.resolveInstance(req.user.organizationId).catch(() => undefined);
    const enviado = await this.wa.sendOtp(telefone, codigo, instancia).catch(() => false);
    if (!enviado) {
      throw new BadRequestException(
        "Não foi possível enviar o código. Verifique se o WhatsApp da organização está conectado.",
      );
    }
    return { ok: true, expiraEm: expira };
  }

  @Post("verificar/confirmar")
  async confirmarCodigo(@Req() req: any, @Body() body: any) {
    const codigo = String(body?.codigo || "").trim();
    const perfil = await this.db.userProfile.findUnique({ where: { userId: req.user.id } });
    if (!perfil?.whatsappCodigo || !perfil?.whatsappCodigoExpira) {
      throw new BadRequestException("Nenhuma verificação pendente. Solicite um novo código.");
    }
    if (new Date(perfil.whatsappCodigoExpira).getTime() < Date.now()) {
      throw new BadRequestException("Código expirado. Solicite um novo.");
    }
    // Limite de tentativas: 6 dígitos são adivinháveis por força bruta se o
    // número de tentativas for livre.
    if ((perfil.whatsappTentativas || 0) >= 5) {
      throw new BadRequestException("Tentativas esgotadas. Solicite um novo código.");
    }
    if (perfil.whatsappCodigo !== codigo) {
      await this.db.userProfile.update({
        where: { userId: req.user.id },
        data: { whatsappTentativas: { increment: 1 } },
      });
      throw new BadRequestException("Código incorreto.");
    }

    await this.db.userProfile.update({
      where: { userId: req.user.id },
      data: {
        whatsappVerificado: true, whatsappCodigo: null,
        whatsappCodigoExpira: null, whatsappTentativas: 0,
      },
    });
    return { ok: true };
  }

  // ── Trilha de envios ───────────────────────────────────────────────────────

  /** Histórico do que o sistema tentou enviar — antes disso não havia registro
   *  nenhum e era impossível responder "essa mensagem foi enviada?". */
  @Get("envios")
  async envios(@Req() req: any, @Query() q: any) {
    exigirMaster(req);
    const where: any = { organizationId: req.user.organizationId };
    if (q.status) where.status = q.status;
    if (q.canal) where.canal = q.canal;
    if (q.modulo && moduloValido(q.modulo)) where.modulo = q.modulo;
    if (q.userId) where.userId = q.userId;

    const take = Math.min(Number(q.limit) || 100, 500);
    const [itens, total] = await Promise.all([
      this.db.notificacaoEnvio.findMany({ where, orderBy: { criadoEm: "desc" }, take }),
      this.db.notificacaoEnvio.count({ where }),
    ]);
    return { itens, total, exibindo: itens.length };
  }
}
