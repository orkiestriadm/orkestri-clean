import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../../../prisma/prisma.service";
import { CasoRepository } from "../infrastructure/caso.repository";
import { CasoService } from "./caso.service";
import { AvisoService } from "./aviso.service";
import { apresentarCaso } from "./presenter";
import { hojeData, dataBr, parametrosDe } from "./contexto";
import { TAREFA_ABERTA, diasEntre, estaAtivo } from "../domain/caso.entity";
import {
  marcoPrazo, degrauEscalonamento, marcoAging, cicloFollowUp, chaves, textoMarco,
} from "../domain/alerta.entity";

type Resultado = {
  organizacoes: number; casos: number; farolAlterado: number; avisos: number;
  escalonamentos: number; followUps: number; semDestinatario: number; desativadas: number;
};

const zero = (): Resultado => ({
  organizacoes: 0, casos: 0, farolAlterado: 0, avisos: 0, escalonamentos: 0, followUps: 0, semDestinatario: 0, desativadas: 0,
});

/**
 * Automações do Strategy (seção 17 do plano).
 *
 *  1. recalcula e grava o farol de todo assunto (a trilha registra a mudança);
 *  2. avisa o dono da próxima ação a 15/7/3/0 dias e no vencimento;
 *  3. escalona assunto crítico vencido: responsável → operacional → executivo + gestores;
 *  4. avisa aging de 30/60/90 dias sem movimentação;
 *  5. cria a tarefa de cobrança quando a espera por terceiro passa do ciclo;
 *  6. avisa os prazos das tarefas.
 *
 * Nada aqui altera informação crítica do assunto — só farol calculado (que é
 * derivado), avisos e tarefas de follow-up. O override manual do farol, a etapa
 * e os valores continuam sendo decisão humana.
 *
 * Quem não tem destinatário nomeado não gera aviso para "alguém": entra em
 * `semDestinatario`, que a tela de configuração mostra.
 */
@Injectable()
export class AutomacaoService {
  private readonly logger = new Logger(AutomacaoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: CasoRepository,
    private readonly casos: CasoService,
    private readonly aviso: AvisoService,
  ) {}

  private get db(): any {
    return this.prisma as any;
  }

  /** 07:30 — meia hora depois do Compliance, para não disputar a mesma janela. */
  @Cron("30 7 * * *")
  async diaria() {
    const inicio = Date.now();
    try {
      const r = await this.executar();
      this.logger.log(`Automações do Strategy em ${Date.now() - inicio}ms: ${JSON.stringify(r)}`);
    } catch (e) {
      this.logger.error("Automações do Strategy falharam", e as Error);
    }
  }

  async executar(organizationId?: string, agora: Date = new Date()): Promise<Resultado> {
    const orgs: string[] = organizationId
      ? [organizationId]
      : (await this.db.estrategicoCaso.findMany({ where: { deletedAt: null }, distinct: ["organizationId"], select: { organizationId: true } }))
        .map((o: any) => o.organizationId);
    const total = zero();
    for (const orgId of orgs) {
      try {
        const r = await this.executarOrganizacao(orgId, agora);
        for (const k of Object.keys(total) as (keyof Resultado)[]) total[k] += r[k];
      } catch (e) {
        this.logger.error(`Automações do Strategy falharam para a organização ${orgId}`, e as Error);
      }
    }
    return total;
  }

  private async executarOrganizacao(orgId: string, agora: Date): Promise<Resultado> {
    const r = zero();
    r.organizacoes = 1;
    const config: any = await this.repo.config(orgId);
    if (config.automacoesAtivas === false) {
      r.desativadas = 1;
      return r;
    }
    const hoje = hojeData(agora);
    const antecedencias: number[] = config.antecedenciasAviso?.length ? config.antecedenciasAviso : [15, 7, 3, 0];
    const limitesAging = [
      config.diasAtencaoSemMovimento,
      Math.round((config.diasAtencaoSemMovimento + config.diasCriticoSemMovimento) / 2),
      config.diasCriticoSemMovimento,
    ];
    const avisar = (a: Parameters<AvisoService["avisar"]>[0]) => this.aviso.avisar(a, config);

    const carteira = await this.repo.carteira(orgId);
    for (const bruto of carteira) {
      r.casos++;
      const f = await this.casos.recalcularFarol(orgId, bruto.id, { origem: "sistema" });
      if (f?.mudou) r.farolAlterado++;
      const c = f?.apresentado ?? apresentarCaso(bruto, { hoje: agora, parametros: parametrosDe(config), verFinanceiro: true });
      if (!c.ativo) continue;

      // ── Próxima ação ──────────────────────────────────────────────────────
      if (c.proximaAcao && c.proximaAcaoPrazo && c.diasProximaAcao != null) {
        const marco = marcoPrazo(c.diasProximaAcao, antecedencias);
        if (marco) {
          const alvo = bruto.proximaAcaoResponsavelId;
          if (!alvo) r.semDestinatario++;
          else if (await avisar({
            organizationId: orgId, userId: alvo, tipo: "estrategico_prazo", casoId: c.id,
            chave: chaves.acao(c.id, c.proximaAcaoPrazo, marco, alvo),
            severidade: marco === "vencido" ? "critico" : "atencao",
            titulo: `${c.codigo}: próxima ação ${textoMarco(marco)}`,
            mensagem: `${c.proximaAcao} — prazo ${dataBr(c.proximaAcaoPrazo)}`,
          })) r.avisos++;
        }

        // ── Escalonamento ───────────────────────────────────────────────────
        const critico = c.farol === "vermelho" || c.prioridade === "critica" || c.prioridade === "alta";
        if (c.diasProximaAcao < 0 && critico) {
          const degrau = degrauEscalonamento(-c.diasProximaAcao, config.diasEscalonamento);
          if (degrau > 0) {
            const destinos = new Set<string>();
            if (bruto.proximaAcaoResponsavelId) destinos.add(bruto.proximaAcaoResponsavelId);
            if (degrau >= 2 && bruto.responsavelOperacionalId) destinos.add(bruto.responsavelOperacionalId);
            if (degrau >= 3) {
              if (bruto.responsavelExecutivoId) destinos.add(bruto.responsavelExecutivoId);
              for (const g of config.gestoresEscalonamento ?? []) destinos.add(g);
            }
            if (!destinos.size) r.semDestinatario++;
            const dono = c.proximaAcaoResponsavel?.nome ?? c.proximaAcaoResponsavelNome ?? "sem responsável";
            for (const uid of destinos) {
              if (await avisar({
                organizationId: orgId, userId: uid, tipo: "estrategico_escalonamento", casoId: c.id, severidade: "critico",
                chave: chaves.escalonamento(c.id, c.proximaAcaoPrazo, degrau, uid),
                titulo: `Escalonamento ${degrau}/3 — ${c.codigo} vencido há ${-c.diasProximaAcao} dias`,
                mensagem: `${c.titulo}. Próxima ação: ${c.proximaAcao} (${dono}).`,
              })) r.escalonamentos++;
            }
          }
        }
      }

      // ── Aging ─────────────────────────────────────────────────────────────
      if (c.diasParado != null && c.ultimaMovimentacaoEm) {
        const marco = marcoAging(c.diasParado, limitesAging);
        if (marco) {
          const destinos = [...new Set([bruto.proximaAcaoResponsavelId, bruto.responsavelOperacionalId].filter(Boolean))] as string[];
          if (!destinos.length) r.semDestinatario++;
          for (const uid of destinos) {
            if (await avisar({
              organizationId: orgId, userId: uid, tipo: "estrategico_aging", casoId: c.id,
              chave: chaves.aging(c.id, c.ultimaMovimentacaoEm, marco, uid),
              titulo: `${c.codigo}: sem movimentação há ${c.diasParado} dias`,
              mensagem: `${c.titulo} — último andamento em ${dataBr(c.ultimaMovimentacaoEm)}.`,
            })) r.avisos++;
          }
        }
      }

      // ── Follow-up de dependência externa ─────────────────────────────────
      for (const d of bruto.dependencias ?? []) {
        const natureza = d.catalogo?.natureza ?? (d.organizacao ? "externa" : null);
        if (natureza !== "externa" || !d.desde || d.resolvidaEm) continue;
        if (d.proximoFollowUpEm && new Date(d.proximoFollowUpEm) > hoje) continue;
        const dias = diasEntre(d.desde, agora);
        const ciclo = cicloFollowUp(dias, config.diasFollowUp);
        if (ciclo < 1) continue;

        const chave = chaves.followUp(d.id, ciclo);
        const existe = await this.db.estrategicoTarefa.findFirst({ where: { organizationId: orgId, chaveAutomacao: chave }, select: { id: true } });
        if (existe) continue;

        const nome = d.catalogo?.nome ?? d.organizacao ?? "terceiro";
        const responsavelId = bruto.proximaAcaoResponsavelId ?? bruto.responsavelOperacionalId ?? null;
        try {
          const tarefa = await this.db.estrategicoTarefa.create({
            data: {
              organizationId: orgId, casoId: c.id,
              titulo: `Cobrar ${nome} — aguardando há ${dias} dias`,
              descricao: `Gerada automaticamente: o assunto aguarda ${nome} desde ${dataBr(d.desde)}. Ao concluir, o follow-up fica registrado na dependência.`,
              responsavelId, prazo: new Date(hoje.getTime() + 3 * 86_400_000),
              prioridade: c.prioridade === "critica" ? "critica" : "alta",
              origem: "automacao", chaveAutomacao: chave,
            },
          });
          await this.repo.historico(orgId, c.id, { acao: "tarefa", origem: "sistema", descricao: `Follow-up automático criado: ${tarefa.titulo}` });
          r.followUps++;
          if (responsavelId) {
            await avisar({
              organizationId: orgId, userId: responsavelId, tipo: "estrategico_followup", casoId: c.id, tarefaId: tarefa.id,
              chave: `followup-aviso:${tarefa.id}:${responsavelId}`,
              titulo: `${c.codigo}: cobrar ${nome}`,
              mensagem: `Aguardando há ${dias} dias. Tarefa criada com prazo ${dataBr(tarefa.prazo)}.`,
            });
          } else {
            r.semDestinatario++;
          }
        } catch (e: any) {
          if (e?.code !== "P2002") throw e;
        }
      }
    }

    // ── Prazos das tarefas ──────────────────────────────────────────────────
    const tarefas = await this.db.estrategicoTarefa.findMany({
      where: {
        organizationId: orgId, deletedAt: null, status: { in: TAREFA_ABERTA },
        prazo: { not: null }, responsavelId: { not: null }, caso: { deletedAt: null },
      },
      include: { caso: { select: { id: true, codigo: true, etapa: true } } },
    });
    for (const t of tarefas) {
      if (!estaAtivo(t.caso.etapa)) continue;
      const marco = marcoPrazo(diasEntre(agora, t.prazo), antecedencias);
      if (!marco) continue;
      if (await avisar({
        organizationId: orgId, userId: t.responsavelId, tipo: "estrategico_tarefa_prazo", casoId: t.caso.id, tarefaId: t.id,
        chave: chaves.tarefa(t.id, t.prazo, marco, t.responsavelId),
        severidade: marco === "vencido" ? "critico" : "atencao",
        titulo: `${t.caso.codigo}: tarefa ${textoMarco(marco)}`,
        mensagem: `${t.titulo} — prazo ${dataBr(t.prazo)}`,
      })) r.avisos++;
    }

    return r;
  }
}
