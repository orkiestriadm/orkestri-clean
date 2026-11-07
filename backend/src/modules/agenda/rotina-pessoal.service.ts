import { BadRequestException, Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { antesDeEfeito, acaoUtil, execucaoWhats } from './whatsapp-execucao';
import { diaSaoPaulo, somarDias } from './whatsapp-rotina-datas';
import { interpretarLembrete, normalizarRotina, textoRotina } from './rotina-pessoal-parser';

type Dono = { id: string; organizationId: string };
const scope = (u: Dono) => ({ userId: u.id, organizationId: u.organizationId });
const legivel = (d: Date) => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

@Injectable()
export class RotinaPessoalService {
  private readonly logger = new Logger(RotinaPessoalService.name);
  constructor(private prisma: PrismaService, private wa: WhatsAppService, private auth: AuthService) {}
  async permitir(u: Dono, acao: string) {
    const p = await this.auth.resolvePermissions(u.id);
    if (!p.includes('*') && !p.includes('agenda:' + acao)) throw new ForbiddenException('Sua conta precisa de acesso à Agenda para esta função.');
  }
  async lembretes(u: Dono) { await this.permitir(u, 'ver'); return this.prisma.personalReminder.findMany({ where: scope(u), orderBy: { quando: 'desc' }, take: 100 }); }
  async criarLembrete(u: Dono, texto: string, instancia?: string, origem?: string) {
    await this.permitir(u, 'criar');
    const pref = await this.prisma.aureliaMemoria.findFirst({ where: { ...scope(u), chave: 'horario_manha', consentimento: true, OR: [{ expiraEm: null }, { expiraEm: { gt: new Date() } }] } });
    const r = interpretarLembrete(texto, new Date(), pref?.valor || '09:00');
    if (!r) throw new BadRequestException('Me diga o que lembrar e quando. Ex.: Me lembre de beber água daqui 15m ou Me lembre amanhã pela manhã de marcar uma consulta.');
    const user = await this.prisma.user.findFirst({ where: { id: u.id, organizationId: u.organizationId }, include: { profile: true } });
    if (!user?.profile?.whatsapp) throw new BadRequestException('Cadastre seu WhatsApp no Perfil para receber lembretes.');
    const data = { ...scope(u), titulo: r.titulo, quando: r.quando, instancia, origem };
    const salvo = origem ? await this.prisma.personalReminder.upsert({ where: { origem }, create: data, update: {} }) : await this.prisma.personalReminder.create({ data });
    return { ...salvo, padrao: r.padrao };
  }
  async cancelar(u: Dono, id: string) {
    await this.permitir(u, 'editar');
    const r = await this.prisma.personalReminder.updateMany({ where: { id, ...scope(u), status: 'PENDENTE' }, data: { status: 'CANCELADO' } });
    if (!r.count) throw new BadRequestException('O lembrete não está mais pendente ou não foi encontrado.');
    return { ok: true };
  }
  async habitos(u: Dono) {
    await this.permitir(u, 'ver');
    return { hoje: diaSaoPaulo(new Date()), itens: await this.prisma.personalHabit.findMany({ where: scope(u), include: { checkins: { orderBy: { dia: 'asc' } } }, orderBy: { criadoEm: 'desc' } }) };
  }
  async salvarHabito(u: Dono, dto: { titulo: string; dias: number; cor: string; inicio?: string }, id?: string) {
    await this.permitir(u, id ? 'editar' : 'criar');
    const titulo = dto.titulo.trim(), inicio = dto.inicio || diaSaoPaulo(new Date());
    if (!titulo || titulo.length > 80 || !Number.isInteger(dto.dias) || dto.dias < 1 || dto.dias > 366 || !/^#[0-9a-f]{6}$/i.test(dto.cor)) throw new BadRequestException('Confira o nome, a cor e a meta de 1 a 366 dias.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !Number.isFinite(Date.parse(inicio)) || new Date(inicio).toISOString().slice(0,10) !== inicio) throw new BadRequestException('Data inicial inválida.');
    const nomeNormalizado = normalizarRotina(titulo);
    const existente = await this.prisma.personalHabit.findFirst({ where: { ...scope(u), nomeNormalizado, ...(id ? { id: { not: id } } : {}) } });
    if (existente) throw new BadRequestException('Você já tem um hábito com esse nome. Use outro nome ou reative o card existente.');
    return this.prisma.$transaction(async tx => {
      if (!id) return tx.personalHabit.create({ data: { ...scope(u), titulo, nomeNormalizado, dias: dto.dias, inicio, cor: dto.cor } });
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`;
      const h = await tx.personalHabit.findFirst({ where: { id, ...scope(u) }, include: { checkins: true } });
      if (!h) throw new NotFoundException('Hábito não encontrado.');
      if (h.checkins.length && (dto.dias !== h.dias || inicio !== h.inicio)) throw new BadRequestException('Depois do primeiro check-in, preserve a meta e o início. Crie outro card para um novo ciclo.');
      return tx.personalHabit.update({ where: { id }, data: { titulo, nomeNormalizado, dias: dto.dias, inicio, cor: dto.cor } });
    });
  }
  async arquivar(u: Dono, id: string, arquivado: boolean) {
    await this.permitir(u, 'editar');
    const r = await this.prisma.personalHabit.updateMany({ where: { id, ...scope(u) }, data: { arquivado } });
    if (!r.count) throw new NotFoundException('Hábito não encontrado.');
    return { ok: true };
  }
  async checkin(u: Dono, id: string, desfazer = false, agora = new Date()) {
    await this.permitir(u, 'editar');
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`;
      const h = await tx.personalHabit.findFirst({ where: { id, ...scope(u), arquivado: false }, include: { checkins: true } });
      if (!h) throw new NotFoundException('Hábito não encontrado.');
      const hoje = diaSaoPaulo(agora);
      if (hoje < h.inicio || hoje >= somarDias(h.inicio, h.dias)) throw new BadRequestException('Este hábito está fora do período do card. Crie um novo ciclo para continuar.');
      if (desfazer) { await tx.habitCheckin.deleteMany({ where: { habitId: id, dia: hoje } }); return { titulo: h.titulo, desfeito: true }; }
      const repetido = h.checkins.some(c => c.dia === hoje);
      await tx.habitCheckin.upsert({ where: { habitId_dia: { habitId: id, dia: hoje } }, create: { habitId: id, dia: hoje }, update: {} });
      return { titulo: h.titulo, repetido, total: h.checkins.length + (repetido ? 0 : 1), meta: h.dias };
    });
  }
  async tratar(u: Dono, texto: string, conversa: string, instancia: string) {
    const t = textoRotina(texto), n = normalizarRotina(t);
    const ehLembrete = /^me lembre\b/.test(n);
    const check = t.match(/^(?:fa[cç]a\s+)?check[ -]?in\s+(?:no\s+)?h[aá]bito\s*["“]?(.+?)["”]?$/i);
    const criar = t.match(/^(?:crie|criar)\s+(?:um\s+)?h[aá]bito\s+["“]?(.+?)["”]?\s+por\s+(\d+)\s+dias$/i);
    if (!ehLembrete && !check && !criar) return false;
    try {
      await antesDeEfeito();
      let resposta: string;
      if (ehLembrete) {
        const ctx = execucaoWhats.getStore(), origem = ctx ? `${u.id}:${ctx.instancia}:${ctx.mensagemId}` : undefined;
        const r = await this.criarLembrete(u, t, instancia, origem);
        resposta = `Combinado! Vou te lembrar de ${r.titulo} em ${legivel(r.quando)} pelo WhatsApp. 🔔${r.padrao ? '\nUsei seu horário padrão para esse período.' : ''}\nHorário de Brasília. Você pode cancelar na tela Lembretes.`;
      } else if (criar) {
        const h = await this.salvarHabito(u, { titulo: criar[1], dias: +criar[2], cor: '#f97316' });
        resposta = `Criei o hábito ${h.titulo} por ${h.dias} dias! Para marcar hoje, diga: Faça check-in no hábito "${h.titulo}". Um check-in por dia. ✅`;
      } else {
        const h = await this.prisma.personalHabit.findFirst({ where: { ...scope(u), nomeNormalizado: normalizarRotina(check[1]), arquivado: false } });
        if (!h) throw new BadRequestException('Não encontrei esse hábito entre os seus cards. Confira o nome na tela Hábitos.');
        const r = await this.checkin(u,h.id);
        resposta = `${r.repetido ? 'O check-in de hoje já estava marcado' : 'Check-in de hoje feito'} em ${r.titulo}! ${r.total}/${r.meta} dias. ✅`;
      }
      acaoUtil(ehLembrete ? 'LEMBRETE_CRIADO' : check ? 'HABITO_CHECKIN' : 'HABITO_CRIADO');
      await this.wa.sendToJid(conversa,resposta,instancia);
    } catch (e) {
      if (!(e instanceof BadRequestException || e instanceof ForbiddenException || e instanceof NotFoundException)) throw e;
      await this.wa.sendToJid(conversa,e.message,instancia);
    }
    return true;
  }
  @Cron('*/15 * * * * *')
  async enviarPendentes() {
    if (process.env.ROTINA_LEMBRETES_ENABLED !== 'true') return;
    // Claim persistente: processos concorrentes nunca enviam a mesma linha.
    // Envio incerto não é repetido automaticamente; fica visível para revisão.
    const rows: any[] = await this.prisma.$queryRaw`
      UPDATE personal_reminders SET status='ENVIANDO', atualizado_em=CURRENT_TIMESTAMP
      WHERE id IN (SELECT id FROM personal_reminders WHERE status='PENDENTE' AND quando<=CURRENT_TIMESTAMP
        ORDER BY quando LIMIT 10 FOR UPDATE SKIP LOCKED) RETURNING *`;
    for (const r of rows) {
      let status = 'FALHOU';
      try {
        const u = await this.prisma.user.findFirst({ where: { id: r.user_id, organizationId: r.organization_id }, include: { profile: true, organization: true } });
        if (u?.ativo && !u.bloqueado && u.organization?.ativo !== false && !(u.isTrial && u.trialExpiraEm && u.trialExpiraEm < new Date()) && u.profile?.whatsapp) {
          await this.permitir(u, 'ver');
          const msg = `🔔 Oiee! Passando para te lembrar: ${r.titulo}.`;
          const ok = r.instancia ? await this.wa.sendMessage(u.profile.whatsapp, msg, r.instancia) : await this.wa.sendMessageForOrg(u.organizationId,u.profile.whatsapp,msg);
          status = ok ? 'ENVIADO' : 'REVISAR';
        }
      } catch { status = 'REVISAR'; this.logger.warn('Lembrete com entrega pendente de revisão.'); }
      await this.prisma.personalReminder.update({ where: { id: r.id }, data: { status, enviadoEm: status === 'ENVIADO' ? new Date() : null } });
    }
    await this.prisma.personalReminder.updateMany({ where: { status: 'ENVIANDO', atualizadoEm: { lt: new Date(Date.now()-10*60000) } }, data: { status: 'REVISAR' } });
  }
}
