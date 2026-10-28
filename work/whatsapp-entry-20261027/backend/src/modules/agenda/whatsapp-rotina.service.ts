import { Injectable, Logger } from "@nestjs/common";
import { acaoUtil } from "./whatsapp-execucao";
import { Cron, CronExpression } from "@nestjs/schedule";
import { randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { WhatsAppService } from "../notifications/whatsapp.service";
import { dataTarefa, diaSaoPaulo, instanteSaoPaulo, ocorrenciaNoDia, somarDias } from "./whatsapp-rotina-datas";

const limpar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const linha = (s: string) => (s || "").replace(/[\r\n]+/g, " ").slice(0, 110);
const permite = (p: string[], acao: string) => p.includes("*") || p.includes(acao);
const codigo = (id: string) => "T-" + id.slice(0, 8).toUpperCase();
const INSTRUCOES = "Envie *meu dia* para consultar agora.\n" +
  "Para receber automaticamente: *ativar resumo diário 08:00*.\n" +
  "Só de segunda a sexta: *ativar resumo diário 08:00 dias úteis*.\n" +
  "Para pausar: *pausar resumo diário*.\nHorários de Brasília.";

export function comandoRotina(texto: string): boolean {
  const t = limpar(texto);
  return /^(meu dia|resumo de hoje|rotina|resumo diario|tarefas(?: de hoje)?)$/.test(t) ||
    /^(?:(?:ativar|ligar|pausar|parar|desligar|cancelar)\s+(?:o\s+)?)?resumo diario\b/.test(t) ||
    /^(?:concluir|reabrir) tarefa\b/.test(t) || /^tarefa\s*:/.test(t);
}

@Injectable()
export class WhatsappRotinaService {
  private readonly logger = new Logger("WhatsappRotina");
  private rodando = false;
  constructor(private prisma: PrismaService, private wa: WhatsAppService, private auth: AuthService) {}

  private async usuario(id: string) {
    const user = await (this.prisma as any).user.findUnique({ where: { id }, include: { profile: true, organization: true } });
    if (!user?.ativo || user.bloqueado || user.organization?.ativo === false ||
      (user.isTrial && user.trialExpiraEm && new Date(user.trialExpiraEm) < new Date())) return null;
    return user;
  }

  private async responder(user: any, instancia: string, texto: string) {
    if (user.profile?.whatsapp) await this.wa.sendMessage(user.profile.whatsapp, texto, instancia);
  }

  async montarResumo(user: any, perms: string[], agora = new Date(), somenteTarefas = false): Promise<string | null> {
    const agenda = !somenteTarefas && permite(perms, "agenda:ver"), keep = permite(perms, "keep:ver");
    if (!agenda && !keep) return null;
    const dia = diaSaoPaulo(agora), inicio = instanteSaoPaulo(dia), fim = instanteSaoPaulo(somarDias(dia, 1));
    const data = new Date(dia + "T00:00:00Z");
    let msg = `☀️ *${somenteTarefas ? "Suas tarefas" : "Seu dia"} — ${dia.slice(8)}/${dia.slice(5, 7)}*\n`;
    if (agenda) {
      const [unicos, recorrentes] = await Promise.all([
        this.prisma.event.findMany({ where: { userId: user.id, organizationId: user.organizationId, confirmado: true, recorrencia: null,
          inicio: { lt: fim }, OR: [{ fim: { gt: inicio } }, { inicio: { gte: inicio } }] }, orderBy: { inicio: "asc" }, take: 101 }),
        this.prisma.event.findMany({ where: { userId: user.id, organizationId: user.organizationId, confirmado: true, recorrencia: { not: null },
          inicio: { lt: fim }, OR: [{ recorrenciaFim: null }, { recorrenciaFim: { gte: inicio } }] }, orderBy: { inicio: "desc" }, take: 201 }),
      ]);
      const eventos = [...unicos.slice(0, 100), ...recorrentes.slice(0, 200)].map(e => ocorrenciaNoDia(e, dia, inicio, fim))
        .filter(Boolean).sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());
      msg += "\n🗓️ *Sua agenda*\n";
      msg += eventos.length ? eventos.slice(0, 8).map(e => {
        const hora = e.diaTodo ? "Dia todo" : new Date(e.inicio) < inicio ? "Em andamento" : new Date(e.inicio).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
        return `• ${hora} — ${linha(e.titulo)}`;
      }).join("\n") : "Nenhum compromisso para hoje.";
      if (eventos.length > 8 || unicos.length > 100 || recorrentes.length > 200) msg += "\n_Há mais registros; consulte a Agenda no sistema._";
      msg += "\n";
    }
    if (keep) {
      const [hoje, atrasadas, concluidas] = await Promise.all([
        this.prisma.dailyTask.findMany({ where: { userId: user.id, concluido: false, data }, orderBy: [{ prioridade: "desc" }, { criadoEm: "asc" }], take: 6 }),
        this.prisma.dailyTask.findMany({ where: { userId: user.id, concluido: false, data: { lt: data } }, orderBy: [{ data: "asc" }, { prioridade: "desc" }], take: 4 }),
        this.prisma.dailyTask.count({ where: { userId: user.id, concluido: true, data } }),
      ]);
      msg += "\n📝 *Tarefas pessoais de hoje*\n" + (hoje.length ? hoje.slice(0, 5).map(t => `• ${codigo(t.id)} — ${linha(t.titulo)}`).join("\n") : "Nenhuma tarefa pendente para hoje.");
      if (hoje.length > 5) msg += "\n_Há mais tarefas para hoje no Keep._";
      if (atrasadas.length) msg += "\n\n⏳ *Tarefas pessoais atrasadas*\n" + atrasadas.slice(0, 3).map(t => `• ${codigo(t.id)} — ${linha(t.titulo)}`).join("\n") + (atrasadas.length > 3 ? "\n_Há mais tarefas atrasadas no Keep._" : "");
      if (concluidas) msg += `\n✅ ${concluidas} concluída(s) entre as tarefas programadas para hoje.`;
      const primeira = hoje[0] || atrasadas[0];
      if (primeira) msg += `\n\nPara concluir, por exemplo: *concluir tarefa ${codigo(primeira.id)}*.`;
    }
    return msg + "\n\nPara criar: *tarefa: comprar material amanhã*.\nPara pausar o envio automático: *pausar resumo diário*.";
  }

  async tratar(userId: string, instancia: string, texto: string, agora = new Date()): Promise<void> {
    const user = await this.usuario(userId);
    if (!user?.profile?.whatsapp) return;
    const t = limpar(texto), perms = await this.auth.resolvePermissions(userId);
    const responder = (msg: string) => this.responder(user, instancia, msg);
    if (/^(meu dia|resumo de hoje|tarefas(?: de hoje)?)$/.test(t)) {
      const msg = await this.montarResumo(user, perms, agora, /^tarefas/.test(t));
      await responder(msg || "Sua conta não tem acesso para consultar esses dados. Peça ao administrador acesso à Agenda ou ao Keep."); return;
    }
    if (/^tarefa\s*:/.test(t)) {
      if (!permite(perms, "keep:criar")) { await responder("Sua conta não tem permissão para criar tarefas no Keep."); return; }
      const parsed = dataTarefa(texto.replace(/^tarefa\s*:\s*/i, ""), agora);
      if (!parsed) { await responder("Envie *tarefa: comprar material amanhã*. Aceito hoje, amanhã ou uma data como 25/10/2026, com descrição de 2 a 200 caracteres."); return; }
      const tarefa = await this.prisma.dailyTask.create({ data: { userId, titulo: parsed.titulo, data: new Date(parsed.dia + "T00:00:00Z"), tipo: "TAREFA", concluido: false } });
      acaoUtil("TAREFA_CRIADA");
      await responder(`📝 Tarefa criada: *${linha(tarefa.titulo)}*\n${parsed.dia.split("-").reverse().join("/")} — *${codigo(tarefa.id)}*\nPara concluir: *concluir tarefa ${codigo(tarefa.id)}*.`); return;
    }
    if (/^(concluir|reabrir) tarefa\b/.test(t)) {
      if (!permite(perms, "keep:editar")) { await responder("Sua conta não tem permissão para atualizar tarefas no Keep."); return; }
      const m = t.match(/^(concluir|reabrir) tarefa t-([a-f0-9]{8})$/);
      if (!m) { await responder("Use o código mostrado em *meu dia*. Exemplo: *concluir tarefa T-AB12CD34*."); return; }
      const matches = await this.prisma.dailyTask.findMany({ where: { userId, id: { startsWith: m[2] } }, take: 2 });
      if (matches.length !== 1) { await responder("Não encontrei uma tarefa única com esse código entre as suas tarefas. Consulte o Keep para identificar o registro."); return; }
      const tarefa = matches[0], concluido = m[1] === "concluir";
      const update = await this.prisma.dailyTask.updateMany({ where: { id: tarefa.id, userId, concluido: !concluido }, data: { concluido } });
      if (update.count) acaoUtil(concluido ? "TAREFA_CONCLUIDA" : "TAREFA_REABERTA");
      await responder(`${update.count ? (concluido ? "✅ Concluída" : "📝 Reaberta") : (concluido ? "Já estava concluída" : "Já estava pendente")}: *${linha(tarefa.titulo)}*.\nEnvie *meu dia* para acompanhar.`); return;
    }
    if (/^(pausar|parar|desligar|cancelar) (?:o )?resumo diario$/.test(t)) {
      const revisao = randomUUID();
      await this.prisma.$executeRaw`UPDATE whatsapp_rotina SET ativo=false,revisao=${revisao},atualizado_em=CURRENT_TIMESTAMP WHERE user_id=${userId}`;
      await responder("🔕 Resumo diário pausado. Você pode consultar quando quiser com *meu dia*. Para voltar, envie *ativar resumo diário 08:00*."); return;
    }
    const ativar = t.match(/^(?:ativar|ligar) (?:o )?resumo diario (?:as )?(\d{1,2}):(\d{2})(?: (dias uteis|todos os dias))?$/);
    if (ativar) {
      if (+ativar[1] > 23 || +ativar[2] > 59) { await responder("Horário inválido. Use *ativar resumo diário 08:00*."); return; }
      if (!permite(perms, "agenda:ver") && !permite(perms, "keep:ver")) { await responder("Sua conta precisa de acesso à Agenda ou ao Keep para ativar esse resumo."); return; }
      const horario = ativar[1].padStart(2, "0") + ":" + ativar[2], uteis = ativar[3] === "dias uteis", revisao = randomUUID();
      await this.prisma.$executeRaw`
        INSERT INTO whatsapp_rotina(user_id,ativo,horario,dias_uteis,telefone,instancia,revisao)
        VALUES (${userId},true,${horario},${uteis},${user.profile.whatsapp},${instancia},${revisao})
        ON CONFLICT(user_id) DO UPDATE SET ativo=true,horario=EXCLUDED.horario,dias_uteis=EXCLUDED.dias_uteis,
          telefone=EXCLUDED.telefone,instancia=EXCLUDED.instancia,revisao=EXCLUDED.revisao,atualizado_em=CURRENT_TIMESTAMP
      `;
      await responder(`🔔 Resumo diário ativado às *${horario}*, ${uteis ? "de segunda a sexta" : "todos os dias"}, no horário de Brasília.\nInclui sua agenda e suas tarefas pessoais disponíveis.\nPara pausar: *pausar resumo diário*.`); return;
    }
    const prefs: any[] = await this.prisma.$queryRaw`SELECT ativo,horario,dias_uteis FROM whatsapp_rotina WHERE user_id=${userId}`;
    const pref = prefs[0];
    await responder((pref?.ativo ? `🔔 Ativo às ${pref.horario}, ${pref.dias_uteis ? "de segunda a sexta" : "todos os dias"}.\n\n` : "🔕 Seu resumo diário está desativado.\n\n") + INSTRUCOES);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async cron() { await this.processarAgendados(); }

  async processarAgendados(agora = new Date()) {
    if (this.rodando) return;
    this.rodando = true;
    try {
      await this.prisma.$executeRaw`UPDATE whatsapp_rotina_envios SET estado='REVISAR',atualizado_em=CURRENT_TIMESTAMP WHERE estado='ENVIANDO' AND atualizado_em < CURRENT_TIMESTAMP-INTERVAL '10 minutes'`;
      const rows: any[] = await this.prisma.$queryRaw`
        SELECT r.*, ((${agora}::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date)::text AS dia
        FROM whatsapp_rotina r WHERE r.ativo=true
          AND (NOT r.dias_uteis OR EXTRACT(ISODOW FROM (${agora}::timestamptz AT TIME ZONE 'America/Sao_Paulo')) < 6)
          AND EXTRACT(EPOCH FROM ((${agora}::timestamptz AT TIME ZONE 'America/Sao_Paulo')::time-r.horario::time)) BETWEEN 0 AND 7200
          AND NOT EXISTS (SELECT 1 FROM whatsapp_rotina_envios e WHERE e.user_id=r.user_id AND e.dia=(${agora}::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date)
        ORDER BY r.horario,r.user_id LIMIT 50
      `;
      const conectadas = new Map<string, boolean>();
      for (const row of rows) {
        if (!conectadas.has(row.instancia)) {
          const status = await this.wa.getStatus(row.instancia).catch(() => null);
          conectadas.set(row.instancia, !!status?.connected);
        }
        // Sem conexão conhecida, ainda não houve tentativa: pode recuperar
        // no próximo minuto, dentro da janela, sem criar recibo de envio.
        if (!conectadas.get(row.instancia)) continue;
        try { await this.enviarAgendado(row, agora); } catch { this.logger.error("Falha de rotina registrada; os demais usuários continuam no processamento."); }
      }
    } catch { this.logger.error("Não foi possível consultar o resumo diário."); }
    finally { this.rodando = false; }
  }

  private async enviarAgendado(pref: any, agora: Date) {
    const claim: any[] = await this.prisma.$queryRaw`
      INSERT INTO whatsapp_rotina_envios(user_id,dia,revisao) VALUES (${pref.user_id},${pref.dia}::date,${pref.revisao})
      ON CONFLICT DO NOTHING RETURNING user_id
    `;
    if (!claim.length) return;
    let estado = "FALHOU";
    try {
      const user = await this.usuario(pref.user_id);
      const ativo: any[] = await this.prisma.$queryRaw`SELECT revisao,ativo FROM whatsapp_rotina WHERE user_id=${pref.user_id}`;
      if (!ativo[0]?.ativo || ativo[0].revisao !== pref.revisao ||
        !user?.profile?.whatsapp || user.profile.whatsapp.replace(/\D/g, "") !== pref.telefone.replace(/\D/g, "")) estado = "CANCELADA";
      else {
        const perms = await this.auth.resolvePermissions(user.id);
        const texto = await this.montarResumo(user, perms, agora);
        if (!texto) estado = "SEM_ACESSO";
        else {
          const atual: any[] = await this.prisma.$queryRaw`SELECT revisao,ativo FROM whatsapp_rotina WHERE user_id=${pref.user_id}`;
          const destinatario = await this.usuario(user.id);
          if (!atual[0]?.ativo || atual[0].revisao !== pref.revisao ||
            !destinatario?.profile?.whatsapp || destinatario.organizationId !== user.organizationId ||
            destinatario.profile.whatsapp.replace(/\D/g, "") !== pref.telefone.replace(/\D/g, "")) estado = "CANCELADA";
          else estado = await this.wa.sendMessage(pref.telefone, texto, pref.instancia) ? "ACEITA" : "FALHOU";
        }
      }
    } catch { this.logger.warn("Resumo não enviado; consulte a trilha da rotina."); }
    await this.prisma.$executeRaw`UPDATE whatsapp_rotina_envios SET estado=${estado},atualizado_em=CURRENT_TIMESTAMP WHERE user_id=${pref.user_id} AND dia=${pref.dia}::date AND estado='ENVIANDO'`;
  }
}
