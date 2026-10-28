import { MARCA } from "../../common/marca";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { WhatsAppService } from "./whatsapp.service";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import { EmailService } from "./email.service";

const DEFAULT_CONFIGS = [
  { id:"d60", minutos:60, ativo:true, emoji:"ðŸ””", titulo:"Lembrete 1 hora",    mensagem:"Voce tem um evento em 60 minutos:\n\n*{evento}*\n{horario}\n\n{url}" },
  { id:"d15", minutos:15, ativo:true, emoji:"â°", titulo:"Lembrete 15 minutos", mensagem:"Atencao! Seu evento comeca em 15 minutos:\n\n*{evento}*\n{horario}\n\n{url}" },
  { id:"d5",  minutos:5,  ativo:true, emoji:"âš ", titulo:"URGENTE 5 minutos",   mensagem:"URGENTE! Faltam apenas 5 minutos:\n\n*{evento}*\n{horario}\n\n{url}" },
  { id:"d0",  minutos:0,  ativo:true, emoji:"ðŸš¨", titulo:"Acontecendo AGORA",   mensagem:"Seu evento esta acontecendo AGORA:\n\n*{evento}*\n\n{url}" },
];

// Offset fixo para America/Sao_Paulo em ms (-3h)
// Usa a variavel de ambiente TZ se disponivel, senao usa offset manual
function getNow(): Date {
  return new Date();
}

function fmtHorario(date: Date): string {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit", minute: "2-digit",
    timeZone: process.env.TZ || "America/Sao_Paulo"
  });
}

@Injectable()
export class AlertScheduler implements OnModuleInit {
  private readonly logger = new Logger(AlertScheduler.name);
  private sent = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private wa: WhatsAppService,
    private config: ConfigService,
    private email: EmailService,
  ) {}

  onModuleInit() {
    const tz = process.env.TZ || "UTC";
    this.logger.log(`AlertScheduler iniciado â€” TZ: ${tz}`);
    setTimeout(() => this.run(), 5000);
    setInterval(() => this.run(), 30000);
  }

  private fmt(t: string, evento: string, horario: string, url: string) {
    return t.replace(/{evento}/g, evento).replace(/{horario}/g, horario).replace(/{url}/g, url);
  }

  private fmtTempo(mins: number): string {
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}min` : `${mins}min`;
  }

  private async runSlaCheck() {
    try {
      const now = getNow();
      const appUrl = this.config.get("APP_URL", "http://localhost");

      const chamados = await this.prisma.chamado.findMany({
        where: { status: { notIn: ["resolvido", "fechado"] }, slaHoras: { not: null } },
        include: {
          atendente: { select: { id: true, profile: { select: { whatsapp: true, whatsappAlertas: true } } } },
        },
      });

      for (const c of chamados) {
        if (!c.slaHoras) continue;
        const deadline = new Date(c.criadoEm.getTime() + c.slaHoras * 3600000);
        const totalMs = c.slaHoras * 3600000;
        const elapsedPct = (now.getTime() - c.criadoEm.getTime()) / totalMs;
        const remainingMs = deadline.getTime() - now.getTime();
        const atendente = c.atendente as any;
        const phone: string | undefined = atendente?.profile?.whatsapp;
        const alertsOn: boolean = atendente?.profile?.whatsappAlertas ?? false;
        const notifyUserId = c.atendenteId || c.solicitanteId;

        if (elapsedPct >= 1.0) {
          const key = `sla-violado::${c.id}`;
          const lastSent = this.sent.get(key) || 0;
          if (Date.now() - lastSent > 2 * 3600000) {
            this.sent.set(key, Date.now());
            await this.prisma.notification.create({
              data: {
                userId: notifyUserId,
                tipo: "sla_violado",
                titulo: `SLA VIOLADO - Chamado #${c.numero}`,
                mensagem: c.titulo,
                referenciaTipo: "chamado", referenciaId: c.id,
              },
            }).catch(() => {});
            if (phone && alertsOn) {
              const overMin = Math.round(-remainingMs / 60000);
              const inst = await this.wa.resolveInstance((c as any).organizationId);
              await this.wa.sendSlaViolado(phone, c.numero, c.titulo, overMin, appUrl, inst).catch(() => {});
              this.logger.warn(`SLA VIOLADO #${c.numero} [${inst}] -> ${phone}`);
            }
          }
        } else if (elapsedPct >= 0.8) {
          const key = `sla-risco::${c.id}`;
          if (!this.sent.has(key)) {
            this.sent.set(key, Date.now());
            if (c.atendenteId) {
              await this.prisma.notification.create({
                data: {
                  userId: c.atendenteId,
                  tipo: "sla_risco",
                  titulo: `SLA em risco - Chamado #${c.numero}`,
                  mensagem: c.titulo,
                  referenciaTipo: "chamado", referenciaId: c.id,
                },
              }).catch(() => {});
            }
            if (phone && alertsOn) {
              const remMin = Math.round(remainingMs / 60000);
              const inst = await this.wa.resolveInstance((c as any).organizationId);
              await this.wa.sendSlaRisco(phone, c.numero, c.titulo, remMin, appUrl, inst).catch(() => {});
              this.logger.log(`SLA risco #${c.numero} [${inst}] -> ${phone}`);
            }
          }

          // Auto-escalation: bump priority one level
          const PRIO_NEXT: Record<string, string> = { baixa: "media", media: "alta", alta: "urgente" };
          const escalKey = `sla-escal::${c.id}`;
          if (!this.sent.has(escalKey) && PRIO_NEXT[c.prioridade as string]) {
            this.sent.set(escalKey, Date.now());
            const novaPrio = PRIO_NEXT[c.prioridade as string];
            const pct = Math.round(elapsedPct * 100);
            await (this.prisma as any).chamado.update({
              where: { id: c.id },
              data: { prioridade: novaPrio },
            }).catch(() => {});
            await (this.prisma as any).comentarioChamado.create({
              data: {
                id: crypto.randomUUID(),
                chamadoId: c.id,
                userId: notifyUserId,
                texto: `⚠️ Escalonamento automático de SLA: ${pct}% do prazo decorrido. Prioridade alterada de "${c.prioridade}" para "${novaPrio}".`,
                interno: true,
              },
            }).catch(() => {});
            // Notify masters
            const masters = await this.prisma.user.findMany({
              where: { ativo: true, userRoles: { some: { role: { isMaster: true } } } },
              select: { id: true },
            }).catch(() => [] as any[]);
            for (const m of masters) {
              if (m.id === notifyUserId) continue;
              await this.prisma.notification.create({
                data: {
                  userId: m.id,
                  tipo: "sla_escalado",
                  titulo: `🔺 SLA escalado - Chamado #${(c as any).numero}`,
                  mensagem: `Prioridade: ${c.prioridade} → ${novaPrio}. ${(c as any).titulo}`,
                  referenciaTipo: "chamado", referenciaId: c.id,
                },
              }).catch(() => {});
            }
            this.logger.warn(`SLA escalonado #${(c as any).numero}: ${c.prioridade} → ${novaPrio}`);
          }
        }
      }
    } catch (e: any) {
      this.logger.error("SLA check erro: " + e.message);
    }
  }

  async run() {
    try {
      const now = getNow();
      const appUrl = this.config.get("APP_URL", "http://localhost");

      this.logger.debug(`Scheduler tick: ${now.toISOString()} (local: ${now.toLocaleString("pt-BR", { timeZone: process.env.TZ || "America/Sao_Paulo" })})`);

      let configs: any[] = DEFAULT_CONFIGS;
      try {
        const dbCfgs = await this.prisma.alertConfig.findMany({ where: { ativo: true } });
        if (dbCfgs.length > 0) configs = dbCfgs;
      } catch {}

      const maxMin = Math.max(...configs.map((c: any) => c.minutos));
      const windowEnd = new Date(now.getTime() + (maxMin + 3) * 60 * 1000);

      const events = await this.prisma.event.findMany({
        where: { inicio: { gte: now, lte: windowEnd } },
        include: {
          user: {
            select: {
              id: true, email: true, nome: true,
              profile: { select: { whatsapp: true, whatsappAlertas: true } },
            },
          },
        },
      });

      if (events.length > 0) {
        this.logger.log(`Eventos proximos: ${events.length}`);
      }

      for (const ev of events) {
        const diffMs  = new Date(ev.inicio).getTime() - now.getTime();
        const diffMin = diffMs / 60000;
        const horario = fmtHorario(new Date(ev.inicio));

        for (const cfg of configs) {
          if (Math.abs(diffMin - cfg.minutos) > 2.5) continue;

          const key = `${ev.id}::${cfg.minutos}`;
          const lastSent = this.sent.get(key) || 0;
          if (Date.now() - lastSent < 8 * 60 * 1000) continue;

          this.sent.set(key, Date.now());
          this.logger.log(`ALERTA [${cfg.minutos}min] "${ev.titulo}" -> ${(ev.user as any).email}`);

          // Notificacao in-app
          try {
            await this.prisma.notification.create({
              data: {
                userId: ev.userId,
                tipo: cfg.minutos === 0 ? "evento_agora" : "evento_lembrete",
                titulo: `${cfg.emoji} ${cfg.titulo}: ${ev.titulo}`,
                mensagem: `${horario} â€” ${ev.titulo}`,
                referenciaTipo: "event",
                referenciaId: ev.id,
              },
            });
          } catch (e: any) { this.logger.error("Notif erro: " + e.message); }

          // WhatsApp — usa a instância da organização do evento (multi-tenant).
          // Basta ter o número: o antigo opt-in `whatsappAlertas` nascia false e
          // seu único toggle vivia na aba de WhatsApp de Configurações, que foi
          // removida — então o lembrete de agenda nunca saía para ninguém. Quem
          // cadastrou o WhatsApp recebe o lembrete do próprio compromisso.
          const profile = (ev.user as any).profile;
          if (profile?.whatsapp) {
            const body = this.fmt(cfg.mensagem, ev.titulo, horario, appUrl);
            const msg  = `${cfg.emoji} *${MARCA}*\n\n${body}`;
            try {
              const inst = await this.wa.resolveInstance((ev as any).organizationId);
              const ok = await this.wa.sendMessage(profile.whatsapp, msg, inst);
              this.logger.log(`WA ${ok ? "OK" : "FALHOU"} [${inst}] -> ${profile.whatsapp}`);
            } catch (e: any) { this.logger.error("WA erro: " + e.message); }
          }
        }
      }

      // Limpa cache antigo (exceto chaves sla-violado que tem ciclo proprio de 2h)
      const cutoff = Date.now() - 30 * 60 * 1000;
      for (const [k, t] of this.sent) {
        // sla-violado e orc-estouro têm de-dup diário próprio; não limpar
        if (!k.startsWith("sla-violado") && !k.startsWith("orc-estouro") && t < cutoff) this.sent.delete(k);
      }

    } catch (e: any) {
      this.logger.error("Scheduler erro: " + e.message);
    }

    await this.runSlaCheck();
    await this.runOrcamentoAlertCheck();
  }

  // Alerta de estouro de orçamento — guiado pelas Regras de Alertas da organização
  // (tipo "orcamento_estouro"): respeita ativo, canais e destinatários configurados.
  private async runOrcamentoAlertCheck() {
    try {
      const now = getNow();
      const diaKey = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10);
      const mesAtual = now.getMonth() + 1;
      const ano = now.getFullYear();

      const regras = await (this.prisma as any).alertaRegra.findMany({
        where: { tipo: "orcamento_estouro", ativo: true },
      }).catch(() => [] as any[]);
      if (!regras.length) return;

      for (const regra of regras) {
        let destinatarios: string[] = [];
        let canais: string[] = [];
        try { destinatarios = JSON.parse(regra.destinatarios || "[]"); } catch {}
        try { canais = JSON.parse(regra.canais || "[]"); } catch {}
        if (!destinatarios.length || !canais.length) continue;

        const ciclos = await (this.prisma as any).orcamentoCiclo.findMany({
          where: { organizationId: regra.organizationId, ano }, select: { id: true },
        }).catch(() => [] as any[]);
        if (!ciclos.length) continue;
        const cicloIds = ciclos.map((c: any) => c.id);

        const meses = await (this.prisma as any).itemOrcamentoMes.findMany({
          where: {
            mes: mesAtual,
            valorPrevisto: { gt: 0 },
            item: { cicloId: { in: cicloIds }, status: { not: "cancelado" } },
          },
          select: { id: true, valorPrevisto: true, valorRealizado: true, item: { select: { id: true, nome: true } } },
        }).catch(() => [] as any[]);
        const estourados = meses.filter((m: any) => m.valorRealizado != null && m.valorRealizado > m.valorPrevisto);
        if (!estourados.length) continue;

        const users = await this.prisma.user.findMany({
          where: { id: { in: destinatarios }, ativo: true },
          select: { id: true, nome: true, email: true, profile: { select: { whatsapp: true, whatsappAlertas: true } } },
        }).catch(() => [] as any[]);
        if (!users.length) continue;
        const inst = await this.wa.resolveInstance(regra.organizationId).catch(() => null);

        for (const m of estourados) {
          const key = `orc-estouro::${m.id}::${diaKey}`;
          if (this.sent.has(key)) continue;
          this.sent.set(key, Date.now());
          const excedente = (m.valorRealizado - m.valorPrevisto);
          const nomeItem = m.item?.nome || "item";
          const titulo = `Orçamento estourado — ${nomeItem}`;
          const mensagem = `O item "${nomeItem}" passou do previsto no mês: previsto R$ ${Number(m.valorPrevisto).toLocaleString("pt-BR")}, realizado R$ ${Number(m.valorRealizado).toLocaleString("pt-BR")} (excedente R$ ${Number(excedente).toLocaleString("pt-BR")}).`;

          for (const u of users) {
            if (canais.includes("sistema")) {
              await this.prisma.notification.create({
                data: { userId: u.id, tipo: "orcamento_estouro", titulo, mensagem, referenciaTipo: "orcamento_item", referenciaId: m.item?.id || m.id },
              }).catch(() => {});
            }
            if (canais.includes("email") && this.email.isEnabled() && (u as any).email) {
              await this.email.sendGeneric((u as any).email, (u as any).nome, `⚠️ ${titulo}`, mensagem).catch(() => {});
            }
            const phone = (u as any).profile?.whatsapp;
            if (canais.includes("whatsapp") && phone && (u as any).profile?.whatsappAlertas && inst) {
              await this.wa.sendMessage(phone, `💸 *${MARCA} — Orçamento*\n\n${titulo}\n${mensagem}`, inst).catch(() => {});
            }
          }
          this.logger.log(`Alerta orçamento estouro item=${m.item?.id} org=${regra.organizationId}`);
        }
      }
    } catch (e: any) {
      this.logger.error("Orcamento alert check erro: " + e.message);
    }
  }
}