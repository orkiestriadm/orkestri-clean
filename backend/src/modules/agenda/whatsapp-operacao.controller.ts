import { Controller, Get, Post, Param, Body, Query, Req, UseGuards, Inject, BadRequestException, NotFoundException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsIn, IsString, Length } from "class-validator";
import { randomUUID } from "crypto";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";

class RevisaoDto {
  @IsString() @Length(12,500) motivo: string;
  @IsIn(["REPROCESSAR","RESOLVER"]) acao: string;
}

@Controller("whatsapp-operacao")
@UseGuards(AuthGuard("jwt"))
export class WhatsappOperacaoController {
  constructor(private prisma: PrismaService, @Inject("WHATSAPP_INBOUND") private inbound: any) {}
  private admin(req: any) { return req.user.isMaster === true || req.user.permissions?.includes("*"); }

  @Get()
  async painel(@Req() req: any) {
    const uid = req.user.id, org = req.user.organizationId, admin = !!this.admin(req);
    await this.prisma.$executeRaw`
      UPDATE whatsapp_recibos SET estado='REVISAR',atualizado_em=CURRENT_TIMESTAMP
      WHERE estado='PROCESSANDO' AND atualizado_em<CURRENT_TIMESTAMP-INTERVAL '10 minutes'
        AND (user_id=${uid} OR (${admin} AND organization_id=${org} AND contexto='EMPRESA'))
    `;
    const recibos = await this.prisma.$queryRaw`
      SELECT id,estado,contexto,efeitos_iniciados,tentativas,criado_em,atualizado_em,
        (estado='REVISAR' AND NOT efeitos_iniciados AND payload_protegido IS NOT NULL AND tentativas<3
          AND criado_em>CURRENT_TIMESTAMP-INTERVAL '14 days') AS pode_reprocessar
      FROM whatsapp_recibos WHERE user_id=${uid} OR (${admin} AND organization_id=${org} AND contexto='EMPRESA')
      ORDER BY criado_em DESC LIMIT 100
    `;
    const boasVindas = await this.prisma.$queryRaw`
      SELECT estado,tentativas,proxima_tentativa,expira_em FROM whatsapp_boas_vindas WHERE user_id=${uid}
    `;
    const resumo = await this.prisma.$queryRaw`
      SELECT dia,estado,atualizado_em FROM whatsapp_rotina_envios WHERE user_id=${uid} ORDER BY dia DESC LIMIT 14
    `;
    return { recibos, boasVindas, resumo, escopo: admin ? "Seu uso pessoal e mensagens empresariais da sua organização" : "Suas mensagens" };
  }

  @Post(":id/revisao")
  async revisar(@Param("id") id: string, @Body() dto: RevisaoDto, @Req() req: any) {
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw new BadRequestException("Recibo inválido");
    if (dto.motivo.trim().length < 12) throw new BadRequestException("Descreva a verificação realizada em pelo menos 12 caracteres");
    const uid = req.user.id, org = req.user.organizationId, admin = !!this.admin(req);
    const row: any = await this.prisma.$transaction(async tx => {
      const rows: any[] = await tx.$queryRaw`
        SELECT * FROM whatsapp_recibos WHERE id=${id} AND
          (user_id=${uid} OR (${admin} AND organization_id=${org} AND contexto='EMPRESA')) FOR UPDATE
      `;
      if (!rows.length) throw new NotFoundException("Recibo não encontrado");
      const r = rows[0];
      if (r.estado !== "REVISAR") throw new BadRequestException("Este recibo não aguarda revisão");
      if (dto.acao === "REPROCESSAR" && (r.efeitos_iniciados || !r.payload_protegido || r.tentativas >= 3 || new Date(r.criado_em).getTime() < Date.now()-14*86400000))
        throw new BadRequestException("Não é seguro repetir esta mensagem. Confira os registros no módulo de origem e resolva a revisão.");
      const estado = dto.acao === "REPROCESSAR" ? "PROCESSANDO" : "RESOLVIDO";
      await tx.$executeRaw`UPDATE whatsapp_recibos SET estado=${estado},tentativas=tentativas+${dto.acao === "REPROCESSAR" ? 1 : 0},atualizado_em=CURRENT_TIMESTAMP WHERE id=${id}`;
      await tx.$executeRaw`
        INSERT INTO whatsapp_revisoes(id,instancia,mensagem_id,autor_id,motivo,acao)
        VALUES (${randomUUID()},${r.instancia},${r.mensagem_id},${uid},${dto.motivo.trim()},${dto.acao})
      `;
      return r;
    });
    if (dto.acao === "RESOLVER") return { estado: "RESOLVIDO" };
    let estado = "PROCESSADO";
    try { await this.inbound.reprocessarSeguro(row); } catch { estado = "REVISAR"; }
    await this.prisma.$executeRaw`UPDATE whatsapp_recibos SET estado=${estado},atualizado_em=CURRENT_TIMESTAMP WHERE id=${id}`;
    return { estado };
  }

  @Get("metricas")
  async metricas(@Req() req: any, @Query("escopo") escopo?: string) {
    const uid = req.user.id, org = req.user.organizationId, admin = !!this.admin(req);
    const global = req.user.isSuperAdmin === true && escopo === "plataforma";
    const totais: any[] = await this.prisma.$queryRaw`
      SELECT MIN(criado_em) AS inicio,COUNT(*)::int AS mensagens,
        COUNT(DISTINCT user_id)::int AS usuarios,
        COUNT(*) FILTER (WHERE acao_util IS NOT NULL)::int AS acoes_uteis,
        COUNT(DISTINCT user_id) FILTER (WHERE acao_util IS NOT NULL)::int AS usuarios_ativados,
        COUNT(*) FILTER (WHERE tipo='CADASTRO')::int AS cadastros
      FROM whatsapp_atividade WHERE ${global} OR user_id=${uid} OR (${admin} AND organization_id=${org} AND contexto='EMPRESA')
    `;
    const coortes = await this.prisma.$queryRaw`
      WITH eventos AS (
        SELECT * FROM whatsapp_atividade WHERE ${global} OR user_id=${uid} OR (${admin} AND organization_id=${org} AND contexto='EMPRESA')
      ), cadastros AS (
        SELECT user_id,MIN(criado_em) AS cadastro FROM eventos WHERE tipo='CADASTRO' GROUP BY user_id
      )
      SELECT date_trunc('week',cadastro AT TIME ZONE 'America/Sao_Paulo')::date AS semana,
        COUNT(*)::int AS cadastros,
        COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM eventos e WHERE e.user_id=c.user_id AND e.acao_util IS NOT NULL AND e.criado_em>=c.cadastro))::int AS ativados,
        COUNT(*) FILTER (WHERE cadastro<CURRENT_TIMESTAMP-INTERVAL '14 days')::int AS elegiveis_retorno,
        COUNT(*) FILTER (WHERE cadastro<CURRENT_TIMESTAMP-INTERVAL '14 days' AND EXISTS (
          SELECT 1 FROM eventos e WHERE e.user_id=c.user_id AND e.criado_em>=c.cadastro+INTERVAL '7 days' AND e.criado_em<c.cadastro+INTERVAL '14 days'
        ))::int AS retornaram_semana_1
      FROM cadastros c GROUP BY 1 ORDER BY 1 DESC LIMIT 26
    `;
    return { ...totais[0], coortes, escopo: global ? "Plataforma" : admin ? "Pessoal e empresa" : "Pessoal",
      definicoes: { ativacao: "Primeira gravação útil confirmada pelo WhatsApp: compromisso, gasto, tarefa, projeto ou demanda. Preferências e menus não contam.",
        retorno: "Ao menos uma mensagem entre o 7º e o 14º dia após cadastro instrumentado. Só coortes com 14 dias completos entram no denominador.",
        historico: "Dados coletados a partir desta instrumentação. Não há reconstrução de cadastros ou ações anteriores." } };
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { timeZone: "America/Sao_Paulo" })
  async expirarConteudo() {
    await this.prisma.$executeRaw`UPDATE whatsapp_recibos SET payload_protegido=NULL WHERE criado_em<CURRENT_TIMESTAMP-INTERVAL '14 days' AND payload_protegido IS NOT NULL`;
    await this.prisma.$executeRaw`DELETE FROM whatsapp_previas WHERE expira_em<CURRENT_TIMESTAMP`;
  }
}
