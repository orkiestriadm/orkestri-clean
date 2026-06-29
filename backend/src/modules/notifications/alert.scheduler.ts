import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { WhatsAppService } from "./whatsapp.service";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import { EmailService } from "./email.service";
import { FrotaRelatoriosService } from "../frota/frota-relatorios.service";

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

          // WhatsApp — usa a instância da organização do evento (multi-tenant)
          const profile = (ev.user as any).profile;
          if (profile?.whatsapp && profile?.whatsappAlertas) {
            const body = this.fmt(cfg.mensagem, ev.titulo, horario, appUrl);
            const msg  = `${cfg.emoji} *Orkestri*\n\n${body}`;
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
        // sla-violado e frota-* têm de-dup diário próprio; não limpar para evitar reenvio
        if (!k.startsWith("sla-violado") && !k.startsWith("frota-") && t < cutoff) this.sent.delete(k);
      }

    } catch (e: any) {
      this.logger.error("Scheduler erro: " + e.message);
    }

    await this.runSlaCheck();
    await this.runFaturaCheck();
    await this.runFrotaCheck();
    await this.runScheduledReports();
  }

  private async runFaturaCheck() {
    try {
      const now = getNow();
      const hoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const em2dias = new Date(hoje.getTime() + 2 * 86400000);

      // Faturas que vencem hoje ou amanhã (lembrete) ou já vencidas hoje
      const faturas = await (this.prisma as any).fatura.findMany({
        where: {
          status: { notIn: ["pago", "cancelado"] },
          dataVencimento: { lte: em2dias },
        },
        include: { cliente: { select: { nome: true, empresa: true } } },
      });

      const masters = await this.prisma.user.findMany({
        where: { ativo: true, userRoles: { some: { role: { isMaster: true } } } },
        select: { id: true },
      }).catch(() => [] as any[]);

      for (const f of faturas) {
        const venc = new Date(f.dataVencimento);
        const diasAtraso = Math.floor((now.getTime() - venc.getTime()) / 86400000);
        const vencendoHoje = venc >= hoje && venc < new Date(hoje.getTime() + 86400000);
        const vencida = venc < hoje;

        if (!vencendoHoje && !vencida) continue;

        const keyPrefix = vencida ? `fatura-venc::${f.id}::${hoje.toISOString().slice(0,10)}` : `fatura-hj::${f.id}`;
        if (this.sent.has(keyPrefix)) continue;
        this.sent.set(keyPrefix, Date.now());

        const nomeCliente = f.cliente?.empresa || f.cliente?.nome || "Cliente";
        const valor = `R$ ${Number(f.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
        const titulo = vencida
          ? `⚠️ Fatura #${f.numero} vencida há ${diasAtraso}d — ${nomeCliente}`
          : `📅 Fatura #${f.numero} vence hoje — ${nomeCliente}`;
        const mensagem = `${nomeCliente} | ${f.descricao || "Sem descrição"} | ${valor}`;

        for (const m of masters) {
          await this.prisma.notification.create({
            data: {
              userId: m.id,
              tipo: vencida ? "fatura_vencida" : "fatura_vencendo",
              titulo,
              mensagem,
              referenciaTipo: "fatura",
              referenciaId: f.id,
            },
          }).catch(() => {});
        }
      }
    } catch (e: any) {
      this.logger.error("Fatura check erro: " + e.message);
    }
  }

  // ── Gestão de Frotas: CNH, documentos, revisões e manutenções ────────────────
  private async runFrotaCheck() {
    try {
      const now = getNow();
      const hoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const em30 = new Date(hoje.getTime() + 30 * 86400000);
      const em90 = new Date(hoje.getTime() + 90 * 86400000);
      const em7  = new Date(hoje.getTime() + 7 * 86400000);
      const diaKey = hoje.toISOString().slice(0, 10);

      // Coleta os registros que precisam de alerta (todas as orgs, escopo respeitado por org abaixo)
      const [motoristas, documentos, revisoes, manutencoes] = await Promise.all([
        (this.prisma as any).motorista.findMany({
          where: { deletedAt: null, status: "ativo", validadeCnh: { not: null, lte: em90 } },
          select: { id: true, nome: true, validadeCnh: true, organizationId: true },
        }).catch(() => []),
        (this.prisma as any).documentoVeiculo.findMany({
          where: { deletedAt: null, dataVencimento: { not: null, lte: em90 } },
          select: { id: true, tipo: true, dataVencimento: true, organizationId: true, veiculo: { select: { placa: true } } },
        }).catch(() => []),
        (this.prisma as any).revisaoVeiculo.findMany({
          where: { deletedAt: null, status: "agendada", dataPrevista: { not: null, lte: em7 } },
          select: { id: true, dataPrevista: true, organizationId: true, veiculo: { select: { placa: true } } },
        }).catch(() => []),
        (this.prisma as any).manutencaoVeiculo.findMany({
          where: { deletedAt: null, status: { notIn: ["concluida", "cancelada"] }, dataAgendada: { not: null, lte: em7 } },
          select: { id: true, descricao: true, dataAgendada: true, organizationId: true, veiculo: { select: { placa: true } } },
        }).catch(() => []),
      ]);

      const pneus = await (this.prisma as any).pneu.findMany({
        where: { deletedAt: null, status: "em_uso", veiculoId: { not: null } },
        select: { id: true, numeroFogo: true, codigo: true, posicao: true, kmInicial: true, kmInstalacao: true, kmAtual: true, vidaUtilKm: true, kmPrevisto: true, organizationId: true, veiculo: { select: { placa: true } } },
      }).catch(() => []);

      type Alerta = { org: string; tipo: string; titulo: string; mensagem: string; refTipo: string; refId: string; key: string };
      const alertas: Alerta[] = [];
      const dias = (d: Date) => Math.ceil((new Date(d).getTime() - hoje.getTime()) / 86400000);

      // Faixas de alerta da CNH: 90, 60, 30, 15, 7 dias e vencida.
      const CNH_FAIXAS = [7, 15, 30, 60, 90];
      for (const m of motoristas) {
        const d = dias(m.validadeCnh);
        const vISO = new Date(m.validadeCnh).toISOString().slice(0, 10);
        if (d < 0) {
          alertas.push({
            org: m.organizationId, tipo: "frota_cnh_vencida",
            titulo: `🚫 CNH vencida — ${m.nome}`,
            mensagem: `Motorista ${m.nome} — CNH vencida há ${-d} dia(s).`,
            refTipo: "motorista", refId: m.id, key: `frota-cnh-venc::${m.id}::${vISO}::${diaKey}`,
          });
        } else {
          const faixa = CNH_FAIXAS.find(x => d <= x); // menor faixa que cobre os dias restantes
          if (faixa != null) {
            alertas.push({
              org: m.organizationId, tipo: "frota_cnh_vencendo",
              titulo: `📄 CNH vence em ${d}d — ${m.nome}`,
              mensagem: `Motorista ${m.nome} — CNH vence em ${d} dia(s) (alerta de ${faixa} dias).`,
              refTipo: "motorista", refId: m.id, key: `frota-cnh::${m.id}::${vISO}::${faixa}`,
            });
          }
        }
      }
      // Documentos: faixas 90/60/30/15/7 dias e vencido.
      const DOC_FAIXAS = [7, 15, 30, 60, 90];
      for (const doc of documentos) {
        const d = dias(doc.dataVencimento);
        const placa = doc.veiculo?.placa || "veículo";
        const tp = String(doc.tipo).toUpperCase();
        const vISO = new Date(doc.dataVencimento).toISOString().slice(0, 10);
        if (d < 0) {
          alertas.push({
            org: doc.organizationId, tipo: "frota_doc_vencido",
            titulo: `🚫 ${tp} vencido — ${placa}`,
            mensagem: `Documento ${doc.tipo} do veículo ${placa} — vencido há ${-d} dia(s).`,
            refTipo: "documento_veiculo", refId: doc.id, key: `frota-doc-venc::${doc.id}::${vISO}::${diaKey}`,
          });
        } else {
          const faixa = DOC_FAIXAS.find(x => d <= x);
          if (faixa != null) {
            alertas.push({
              org: doc.organizationId, tipo: "frota_doc_vencendo",
              titulo: `📄 ${tp} vence em ${d}d — ${placa}`,
              mensagem: `Documento ${doc.tipo} do veículo ${placa} — vence em ${d} dia(s) (alerta de ${faixa} dias).`,
              refTipo: "documento_veiculo", refId: doc.id, key: `frota-doc::${doc.id}::${vISO}::${faixa}`,
            });
          }
        }
      }
      for (const r of revisoes) {
        const d = dias(r.dataPrevista);
        const placa = r.veiculo?.placa || "veículo";
        alertas.push({
          org: r.organizationId, tipo: "frota_revisao",
          titulo: `🔧 Revisão ${d < 0 ? "atrasada" : `em ${d}d`} — ${placa}`,
          mensagem: `Revisão agendada do veículo ${placa} — ${d < 0 ? `atrasada há ${-d} dia(s)` : `prevista em ${d} dia(s)`}.`,
          refTipo: "revisao_veiculo", refId: r.id, key: `frota-rev::${r.id}::${diaKey}`,
        });
      }
      for (const mn of manutencoes) {
        const d = dias(mn.dataAgendada);
        const placa = mn.veiculo?.placa || "veículo";
        alertas.push({
          org: mn.organizationId, tipo: "frota_manutencao",
          titulo: `🛠️ Manutenção ${d < 0 ? "atrasada" : `em ${d}d`} — ${placa}`,
          mensagem: `Manutenção ${mn.descricao || ""} do veículo ${placa} — ${d < 0 ? `atrasada há ${-d} dia(s)` : `agendada em ${d} dia(s)`}.`,
          refTipo: "manutencao_veiculo", refId: mn.id, key: `frota-man::${mn.id}::${diaKey}`,
        });
      }

      // Pneus: rodízio, desgaste, recapagem e substituição (por km rodado).
      const RODIZIO_KM = 10000;
      for (const p of pneus) {
        const ini = p.kmInicial ?? p.kmInstalacao;
        if (ini == null || p.kmAtual == null) continue;
        const rodado = p.kmAtual - ini;
        if (rodado <= 0) continue;
        const placa = p.veiculo?.placa || "veículo";
        const ident = p.numeroFogo || p.codigo || "pneu";
        const pos = p.posicao || "-";
        const marco = Math.floor(rodado / RODIZIO_KM);
        if (marco >= 1) {
          alertas.push({
            org: p.organizationId, tipo: "frota_pneu_rodizio",
            titulo: `🔄 Rodízio de pneu — ${placa}`,
            mensagem: `Pneu ${ident} (${pos}) já rodou ${rodado.toLocaleString("pt-BR")} km. Rodízio recomendado.`,
            refTipo: "pneu", refId: p.id, key: `frota-pneu-rod::${p.id}::${marco}`,
          });
        }
        const vida = p.vidaUtilKm || p.kmPrevisto || null;
        if (vida && vida > 0) {
          const pct = rodado / vida;
          if (pct >= 1) {
            alertas.push({ org: p.organizationId, tipo: "frota_pneu_substituicao", titulo: `⛔ Substituir pneu — ${placa}`, mensagem: `Pneu ${ident} (${pos}) atingiu a vida útil (${rodado.toLocaleString("pt-BR")}/${vida.toLocaleString("pt-BR")} km).`, refTipo: "pneu", refId: p.id, key: `frota-pneu-sub::${p.id}::${vida}` });
          } else if (pct >= 0.9) {
            alertas.push({ org: p.organizationId, tipo: "frota_pneu_recapagem", titulo: `♻️ Recapagem de pneu — ${placa}`, mensagem: `Pneu ${ident} (${pos}) em ${Math.round(pct * 100)}% da vida útil — avaliar recapagem.`, refTipo: "pneu", refId: p.id, key: `frota-pneu-rec::${p.id}::${vida}` });
          } else if (pct >= 0.7) {
            alertas.push({ org: p.organizationId, tipo: "frota_pneu_desgaste", titulo: `⚠️ Desgaste de pneu — ${placa}`, mensagem: `Pneu ${ident} (${pos}) em ${Math.round(pct * 100)}% da vida útil.`, refTipo: "pneu", refId: p.id, key: `frota-pneu-desg::${p.id}::${vida}` });
          }
        }
      }

      if (!alertas.length) return;

      // Masters por organização (cache dentro deste tick)
      const orgIds = [...new Set(alertas.map(a => a.org))];
      const mastersByOrg = new Map<string, any[]>();
      for (const org of orgIds) {
        const masters = await this.prisma.user.findMany({
          where: { organizationId: org, ativo: true, userRoles: { some: { role: { isMaster: true } } } },
          select: { id: true, profile: { select: { whatsapp: true, whatsappAlertas: true } } },
        }).catch(() => [] as any[]);
        mastersByOrg.set(org, masters);
      }

      for (const a of alertas) {
        if (this.sent.has(a.key)) continue;
        this.sent.set(a.key, Date.now());
        const masters = mastersByOrg.get(a.org) || [];
        const inst = await this.wa.resolveInstance(a.org).catch(() => null);
        for (const m of masters) {
          await this.prisma.notification.create({
            data: { userId: m.id, tipo: a.tipo, titulo: a.titulo, mensagem: a.mensagem, referenciaTipo: a.refTipo, referenciaId: a.refId },
          }).catch(() => {});
          const phone = m.profile?.whatsapp;
          if (phone && m.profile?.whatsappAlertas && inst) {
            await this.wa.sendMessage(phone, `🚗 *Orkestri — Frota*\n\n${a.titulo}\n${a.mensagem}`, inst).catch(() => {});
          }
        }
        this.logger.log(`Alerta frota [${a.tipo}] org=${a.org} ref=${a.refId}`);
      }
    } catch (e: any) {
      this.logger.error("Frota check erro: " + e.message);
    }
  }

  private async runScheduledReports() {
    try {
      const now = getNow();
      const schedules = await (this.prisma as any).frotaReportSchedule.findMany({
        where: { ativo: true },
      });

      if (!schedules.length) return;

      const relService = new FrotaRelatoriosService(this.prisma, this.email);

      for (const schedule of schedules) {
        let shouldSend = false;
        if (!schedule.ultimoEnvio) {
          shouldSend = true;
        } else {
          const diffMs = now.getTime() - new Date(schedule.ultimoEnvio).getTime();
          if (schedule.frequencia === "diaria" && diffMs >= 23 * 3600 * 1000) {
            shouldSend = true;
          } else if (schedule.frequencia === "semanal" && diffMs >= 6 * 24 * 3600 * 1000) {
            shouldSend = true;
          } else if (schedule.frequencia === "mensal" && diffMs >= 28 * 24 * 3600 * 1000) {
            shouldSend = true;
          }
        }

        if (shouldSend) {
          this.logger.log(`Executando envio agendado de relatorio "${schedule.titulo}" (Tipo: ${schedule.tipoRelatorio}) para org=${schedule.organizationId}`);
          try {
            const mockBody = {
              tipoRelatorio: schedule.tipoRelatorio,
              filtros: schedule.filtros || {},
              destinatarios: schedule.destinatarios,
              formato: schedule.formato,
            };

            await relService.enviarEmail(schedule.organizationId, mockBody);

            await (this.prisma as any).frotaReportSchedule.update({
              where: { id: schedule.id },
              data: { ultimoEnvio: now },
            });
            this.logger.log(`Relatorio agendado "${schedule.titulo}" enviado com sucesso.`);
          } catch (err: any) {
            this.logger.error(`Erro ao enviar relatorio agendado "${schedule.titulo}": ${err.message}`);
          }
        }
      }
    } catch (e: any) {
      this.logger.error("Erro no runScheduledReports: " + e.message);
    }
  }
}