import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificacaoDispatcher } from "../notifications/notificacao-dispatcher.service";

/**
 * Vigia dos prazos de projeto e de tarefa.
 *
 * Avisa quem está no projeto que um prazo se aproxima ou já passou. Roda uma
 * vez ao dia — prazo é assunto de dia, não de minuto, e varrer de hora em hora
 * só multiplicaria a chance de mandar a mesma coisa duas vezes.
 *
 * 07:00, o mesmo horário do Compliance e do People, de propósito: quem cuida de
 * mais de um módulo recebe tudo de uma vez em vez de ser interrompido três
 * vezes na manhã.
 *
 * ## O que impede virar ruído
 *
 * A chave de deduplicação carrega o MARCO, não a data: `projeto:{id}:prazo:7`
 * dispara uma única vez na vida daquele projeto. Sem isso, um prazo vencido
 * mandaria a mesma mensagem todo santo dia até alguém mexer — que é o jeito
 * mais rápido de ensinar as pessoas a ignorar o aviso.
 *
 * O atraso é a exceção deliberada: `atraso:{dias}` muda de valor a cada dia, e
 * isso é intencional — prazo estourado que ninguém tratou PRECISA insistir.
 * Mas só nos marcos 1, 3, 7, 15 e 30, não diariamente.
 */
@Injectable()
export class PrazosProjetoScheduler {
  private readonly logger = new Logger(PrazosProjetoScheduler.name);

  /** Dias antes do vencimento que geram aviso. 0 = vence hoje. */
  private readonly MARCOS_ANTES = [15, 7, 3, 1, 0];
  /** Dias DEPOIS do vencimento em que a cobrança insiste. */
  private readonly MARCOS_DEPOIS = [1, 3, 7, 15, 30];

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacaoDispatcher,
  ) {}

  @Cron("0 7 * * *")
  async varrer() {
    try {
      const projetos = await this.varrerProjetos();
      const tarefas = await this.varrerTarefas();
      if (projetos || tarefas) {
        this.logger.log(`Prazos: ${projetos} aviso(s) de projeto, ${tarefas} de tarefa.`);
      }
    } catch (erro) {
      this.logger.error("Varredura de prazos de projeto falhou", erro as Error);
    }
  }

  /**
   * Diferença em DIAS DE CALENDÁRIO, não em múltiplos de 24 horas.
   *
   * Zerar a hora nos dois lados é o que faz "vence amanhã" continuar sendo 1
   * quando a varredura roda às 07:00 e o prazo está gravado às 23:00 — a conta
   * por milissegundos devolveria 0 e o aviso sairia com o marco errado.
   */
  private diasAte(alvo: Date, hoje: Date): number {
    const a = new Date(alvo); a.setHours(0, 0, 0, 0);
    const b = new Date(hoje); b.setHours(0, 0, 0, 0);
    return Math.round((a.getTime() - b.getTime()) / 86_400_000);
  }

  /** O marco cruzado, ou null quando o dia não é de aviso. */
  private marcoDe(dias: number): { chave: string; texto: string; grave: boolean } | null {
    if (dias >= 0) {
      if (!this.MARCOS_ANTES.includes(dias)) return null;
      return {
        chave: `prazo:${dias}`,
        texto: dias === 0 ? "vence hoje" : `vence em ${dias} ${dias === 1 ? "dia" : "dias"}`,
        grave: dias <= 1,
      };
    }
    const atraso = -dias;
    if (!this.MARCOS_DEPOIS.includes(atraso)) return null;
    return {
      chave: `atraso:${atraso}`,
      texto: `venceu há ${atraso} ${atraso === 1 ? "dia" : "dias"}`,
      grave: true,
    };
  }

  private async envolvidos(projeto: { criadoPorId: string; members: { userId: string }[] }) {
    return [...projeto.members.map(m => m.userId), projeto.criadoPorId]
      .filter((u, i, a) => u && a.indexOf(u) === i);
  }

  private async varrerProjetos(): Promise<number> {
    const hoje = new Date();
    // Só o que ainda está em jogo: cobrar prazo de projeto concluído ou
    // cancelado é ruído puro.
    const projetos = await this.prisma.project.findMany({
      where: { dataFim: { not: null }, status: { notIn: ["CONCLUIDO", "CANCELADO"] } },
      select: {
        id: true, titulo: true, dataFim: true, organizationId: true,
        criadoPorId: true, members: { select: { userId: true } },
      },
    });

    let enviados = 0;
    for (const p of projetos) {
      const marco = this.marcoDe(this.diasAte(p.dataFim!, hoje));
      if (!marco) continue;

      const alvos = await this.envolvidos(p);
      if (!alvos.length) continue;

      const r = await this.notificacoes.despachar({
        organizationId: p.organizationId,
        modulo: "projects",
        tipo: "projeto_prazo",
        titulo: `Projeto ${p.titulo} ${marco.texto}`,
        mensagem: `Prazo: ${p.dataFim!.toLocaleDateString("pt-BR")}.`,
        severidade: marco.grave ? "aviso" : "info",
        usuariosAlvo: alvos,
        referenciaTipo: "projeto",
        referenciaId: p.id,
        chave: `projeto:${p.id}:${marco.chave}`,
      }).catch(() => null);

      if (r) enviados++;
    }
    return enviados;
  }

  private async varrerTarefas(): Promise<number> {
    const hoje = new Date();
    const tarefas = await this.prisma.task.findMany({
      where: { dataVencimento: { not: null }, status: { notIn: ["CONCLUIDA", "CANCELADA"] } },
      select: {
        id: true, titulo: true, dataVencimento: true, assigneeId: true,
        project: {
          select: {
            id: true, titulo: true, organizationId: true, status: true,
            criadoPorId: true, members: { select: { userId: true } },
          },
        },
      },
    });

    let enviados = 0;
    for (const t of tarefas) {
      // Projeto encerrado não cobra tarefa: quem fechou o projeto já decidiu
      // que o que ficou aberto não importa mais.
      if (!t.project || ["CONCLUIDO", "CANCELADO"].includes(t.project.status)) continue;

      const marco = this.marcoDe(this.diasAte(t.dataVencimento!, hoje));
      if (!marco) continue;

      const alvos = await this.envolvidos(t.project);
      if (!alvos.length) continue;

      const r = await this.notificacoes.despachar({
        organizationId: t.project.organizationId,
        modulo: "projects",
        tipo: "projeto_tarefa_prazo",
        titulo: `Tarefa ${t.titulo} ${marco.texto}`,
        mensagem:
          `Projeto ${t.project.titulo}. ` +
          `Prazo: ${t.dataVencimento!.toLocaleDateString("pt-BR")}.`,
        severidade: marco.grave ? "aviso" : "info",
        usuariosAlvo: alvos,
        referenciaTipo: "projeto",
        referenciaId: t.project.id,
        chave: `tarefa:${t.id}:${marco.chave}`,
      }).catch(() => null);

      if (r) enviados++;
    }
    return enviados;
  }
}
