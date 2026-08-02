import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Único ponto que fala Prisma para plano de carreira.
 *
 * `Decimal` vira `number` na saída pelo mesmo motivo do repositório de
 * remuneração: o domínio compara nota com nota, e Decimal não compara com
 * operador.
 */
@Injectable()
export class CareerRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get db(): any {
    return this.prisma as any;
  }

  private numero(v: any): number | null {
    return v === null || v === undefined ? null : Number(v);
  }

  /** Degraus com cargo e requisitos — o formato que a tela e o domínio usam. */
  private get incluiDegraus() {
    return {
      degraus: {
        orderBy: { ordem: "asc" as const },
        include: {
          position: { select: { id: true, titulo: true, nivel: true } },
          requisitos: {
            include: {
              skill: { select: { id: true, nome: true } },
              training: { select: { id: true, nome: true } },
            },
          },
        },
      },
    };
  }

  private normalizarTrilha(t: any) {
    if (!t) return null;
    return {
      ...t,
      degraus: (t.degraus ?? []).map((d: any) => ({
        ...d,
        notaMinima: this.numero(d.notaMinima),
        colaboradores: d._count?.collaborators,
      })),
    };
  }

  async listarTrilhas(organizationId: string, incluirInativas: boolean) {
    const trilhas = await this.db.careerTrack.findMany({
      where: { organizationId, ...(incluirInativas ? {} : { ativo: true }) },
      include: this.incluiDegraus,
      orderBy: { nome: "asc" },
    });
    return trilhas.map((t: any) => this.normalizarTrilha(t));
  }

  async obterTrilha(id: string, organizationId: string) {
    const t = await this.db.careerTrack.findFirst({
      where: { id, organizationId },
      include: this.incluiDegraus,
    });
    return this.normalizarTrilha(t);
  }

  criarTrilha(dados: {
    organizationId: string; nome: string; descricao?: string | null; criadoPorId?: string | null;
  }) {
    return this.db.careerTrack.create({ data: { id: randomUUID(), ...dados } });
  }

  atualizarTrilha(id: string, dados: Record<string, any>) {
    return this.db.careerTrack.update({ where: { id }, data: dados });
  }

  excluirTrilha(id: string) {
    return this.db.careerTrack.delete({ where: { id } });
  }

  nomeTrilhaEmUso(organizationId: string, nome: string, excetoId?: string) {
    return this.db.careerTrack
      .findFirst({
        where: { organizationId, nome, ...(excetoId ? { NOT: { id: excetoId } } : {}) },
        select: { id: true },
      })
      .then((a: any) => !!a);
  }

  /* ── Degraus ────────────────────────────────────────────────────────────── */

  async proximaOrdem(trackId: string): Promise<number> {
    const ultimo = await this.db.careerTrackStep.findFirst({
      where: { trackId },
      orderBy: { ordem: "desc" },
      select: { ordem: true },
    });
    return (ultimo?.ordem ?? 0) + 1;
  }

  criarDegrau(dados: {
    organizationId: string; trackId: string; positionId: string; ordem: number;
    mesesMinimos?: number | null; notaMinima?: number | null;
    observacoes?: string | null; criadoPorId?: string | null;
  }) {
    return this.db.careerTrackStep.create({ data: { id: randomUUID(), ...dados } });
  }

  obterDegrau(id: string, organizationId: string) {
    return this.db.careerTrackStep.findFirst({
      where: { id, organizationId },
      include: { track: { select: { id: true, nome: true } }, position: { select: { titulo: true } } },
    });
  }

  atualizarDegrau(id: string, dados: Record<string, any>) {
    return this.db.careerTrackStep.update({ where: { id }, data: dados });
  }

  excluirDegrau(id: string) {
    return this.db.careerTrackStep.delete({ where: { id } });
  }

  /**
   * Reordena numa transação.
   *
   * Uma a uma esbarraria no índice único (track, ordem) no meio do caminho:
   * mover o degrau 3 para 1 passa por um instante em que dois degraus são 1.
   * A transação com deslocamento negativo evita o choque sem afrouxar o índice,
   * que é o que garante que "o próximo degrau" nunca fica ambíguo.
   */
  async reordenar(trackId: string, ordens: { id: string; ordem: number }[]) {
    return this.prisma.$transaction([
      ...ordens.map(o =>
        this.db.careerTrackStep.update({ where: { id: o.id }, data: { ordem: -o.ordem } }),
      ),
      ...ordens.map(o =>
        this.db.careerTrackStep.update({ where: { id: o.id }, data: { ordem: o.ordem } }),
      ),
    ]);
  }

  degrausDaTrilha(trackId: string) {
    return this.db.careerTrackStep.findMany({
      where: { trackId },
      orderBy: { ordem: "asc" },
      select: { id: true, ordem: true, positionId: true },
    });
  }

  cargoJaNaTrilha(trackId: string, positionId: string, excetoId?: string) {
    return this.db.careerTrackStep
      .findFirst({
        where: { trackId, positionId, ...(excetoId ? { NOT: { id: excetoId } } : {}) },
        select: { id: true },
      })
      .then((a: any) => !!a);
  }

  /* ── Requisitos ─────────────────────────────────────────────────────────── */

  criarRequisito(dados: {
    organizationId: string; stepId: string; tipo: string;
    skillId?: string | null; nivelMinimo?: string | null; trainingId?: string | null;
    descricao?: string | null; obrigatorio: boolean; criadoPorId?: string | null;
  }) {
    return this.db.careerStepRequirement.create({ data: { id: randomUUID(), ...dados } });
  }

  obterRequisito(id: string, organizationId: string) {
    return this.db.careerStepRequirement.findFirst({
      where: { id, organizationId },
      include: { step: { select: { id: true, trackId: true } } },
    });
  }

  excluirRequisito(id: string) {
    return this.db.careerStepRequirement.delete({ where: { id } });
  }

  /* ── Situação do colaborador ────────────────────────────────────────────── */

  colaborador(id: string, organizationId: string) {
    return this.db.collaborator.findFirst({
      where: { id, organizationId, excluidoEm: null },
      select: {
        id: true, nomeCompleto: true, positionId: true, careerTrackId: true,
        dataAdmissao: true,
        user: { select: { nome: true } },
        position: { select: { id: true, titulo: true } },
      },
    });
  }

  definirTrilha(collaboratorId: string, careerTrackId: string | null, porId: string | null) {
    return this.db.collaborator.update({
      where: { id: collaboratorId },
      data: { careerTrackId, atualizadoPorId: porId },
      select: { id: true, careerTrackId: true },
    });
  }

  /** Trilhas ativas que contêm o cargo — base da inferência quando não há trilha definida. */
  trilhasComCargo(organizationId: string, positionId: string) {
    return this.db.careerTrack.findMany({
      where: { organizationId, ativo: true, degraus: { some: { positionId } } },
      select: { id: true, nome: true },
    });
  }

  /** skillId → nível, do colaborador. */
  async competenciasDo(collaboratorId: string): Promise<Map<string, string>> {
    const linhas = await this.db.collaboratorSkill.findMany({
      where: { collaboratorId },
      select: { skillId: true, nivel: true },
    });
    return new Map(linhas.map((l: any) => [l.skillId, l.nivel]));
  }

  /**
   * Cursos CONCLUÍDOS. Em andamento não conta: o requisito é ter a formação,
   * não estar buscando.
   */
  async treinamentosConcluidosDe(collaboratorId: string): Promise<Set<string>> {
    const linhas = await this.db.collaboratorTraining.findMany({
      where: { collaboratorId, status: "CONCLUIDO" },
      select: { trainingId: true },
    });
    return new Set(linhas.map((l: any) => l.trainingId));
  }

  /** Nota da última avaliação FINALIZADA. Rascunho não vale como desempenho. */
  async ultimaNotaDe(collaboratorId: string): Promise<number | null> {
    const r = await this.db.performanceReview.findFirst({
      where: { collaboratorId, status: "FINALIZADA", nota: { not: null } },
      orderBy: { finalizadaEm: "desc" },
      select: { nota: true },
    });
    return this.numero(r?.nota);
  }

  /**
   * Desde quando a pessoa ocupa o cargo atual.
   *
   * Lido do histórico funcional (`mudanca_cargo` no campo `positionId`), não de
   * uma coluna nova: a data já existe lá desde a Fase 1, e duplicá-la criaria
   * duas verdades que divergem na primeira correção manual. Sem evento de
   * mudança, vale a admissão — quem nunca mudou de cargo está nele desde que
   * entrou.
   */
  async desdeQuandoNoCargo(collaboratorId: string, positionId: string | null): Promise<Date | null> {
    if (!positionId) return null;

    const evento = await this.db.collaboratorHistory.findFirst({
      where: { collaboratorId, campo: "positionId", valorNovo: positionId },
      orderBy: { registradoEm: "desc" },
      select: { registradoEm: true, vigenciaEm: true },
    });
    if (evento) return evento.vigenciaEm ?? evento.registradoEm;

    const c = await this.db.collaborator.findUnique({
      where: { id: collaboratorId },
      select: { dataAdmissao: true },
    });
    return c?.dataAdmissao ?? null;
  }

  /** Quantos colaboradores ativos ocupam cada cargo — dá volume aos degraus. */
  async contarPorCargo(organizationId: string): Promise<Map<string, number>> {
    const linhas = await this.db.collaborator.groupBy({
      by: ["positionId"],
      where: { organizationId, excluidoEm: null, status: "ATIVO", positionId: { not: null } },
      _count: { _all: true },
    });
    return new Map(linhas.map((l: any) => [l.positionId, l._count._all]));
  }
}
