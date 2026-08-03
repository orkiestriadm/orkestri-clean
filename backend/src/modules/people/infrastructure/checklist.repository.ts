import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../../../prisma/prisma.service";

/** Único ponto que fala Prisma para checklist de admissão e desligamento. */
@Injectable()
export class ChecklistRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get db(): any {
    return this.prisma as any;
  }

  /* ── Modelos ────────────────────────────────────────────────────────────── */

  listarModelos(organizationId: string, incluirInativos: boolean) {
    return this.db.checklistTemplate.findMany({
      where: { organizationId, ...(incluirInativos ? {} : { ativo: true }) },
      include: { itens: { orderBy: { ordem: "asc" } } },
      orderBy: [{ evento: "asc" }, { nome: "asc" }],
    });
  }

  obterModelo(id: string, organizationId: string) {
    return this.db.checklistTemplate.findFirst({
      where: { id, organizationId },
      include: { itens: { orderBy: { ordem: "asc" } } },
    });
  }

  /** Modelo ativo do evento — usado ao abrir um checklist automaticamente. */
  modeloPadrao(organizationId: string, evento: string) {
    return this.db.checklistTemplate.findFirst({
      where: { organizationId, evento, ativo: true },
      include: { itens: { orderBy: { ordem: "asc" } } },
      orderBy: { criadoEm: "asc" },
    });
  }

  criarModelo(dados: Record<string, any>) {
    return this.db.checklistTemplate.create({ data: { id: randomUUID(), ...dados } });
  }

  atualizarModelo(id: string, dados: Record<string, any>) {
    return this.db.checklistTemplate.update({ where: { id }, data: dados });
  }

  excluirModelo(id: string) {
    return this.db.checklistTemplate.delete({ where: { id } });
  }

  nomeModeloEmUso(organizationId: string, nome: string, excetoId?: string) {
    return this.db.checklistTemplate
      .findFirst({
        where: { organizationId, nome, ...(excetoId ? { NOT: { id: excetoId } } : {}) },
        select: { id: true },
      })
      .then((a: any) => !!a);
  }

  async proximaOrdemModelo(templateId: string): Promise<number> {
    const ultimo = await this.db.checklistTemplateItem.findFirst({
      where: { templateId },
      orderBy: { ordem: "desc" },
      select: { ordem: true },
    });
    return (ultimo?.ordem ?? 0) + 1;
  }

  criarItemModelo(dados: Record<string, any>) {
    return this.db.checklistTemplateItem.create({ data: { id: randomUUID(), ...dados } });
  }

  obterItemModelo(id: string, organizationId: string) {
    return this.db.checklistTemplateItem.findFirst({
      where: { id, organizationId },
      include: { template: { select: { id: true, nome: true } } },
    });
  }

  excluirItemModelo(id: string) {
    return this.db.checklistTemplateItem.delete({ where: { id } });
  }

  itensDoModelo(templateId: string) {
    return this.db.checklistTemplateItem.findMany({
      where: { templateId },
      orderBy: { ordem: "asc" },
      select: { id: true, ordem: true },
    });
  }

  /**
   * Reordena numa transação, com passagem por negativo.
   *
   * O índice único (template, ordem) é violado no meio do caminho se as
   * atualizações forem diretas: mover o item 3 para 1 passa por um instante com
   * dois itens em 1.
   */
  reordenarModelo(ordens: { id: string; ordem: number }[]) {
    return this.prisma.$transaction([
      ...ordens.map(o =>
        this.db.checklistTemplateItem.update({ where: { id: o.id }, data: { ordem: -o.ordem } }),
      ),
      ...ordens.map(o =>
        this.db.checklistTemplateItem.update({ where: { id: o.id }, data: { ordem: o.ordem } }),
      ),
    ]);
  }

  /* ── Instâncias ─────────────────────────────────────────────────────────── */

  listarDoColaborador(collaboratorId: string, organizationId: string) {
    return this.db.collaboratorChecklist.findMany({
      where: { collaboratorId, organizationId },
      include: { itens: { orderBy: { ordem: "asc" } } },
      orderBy: { iniciadoEm: "desc" },
    });
  }

  obterInstancia(id: string, organizationId: string) {
    return this.db.collaboratorChecklist.findFirst({
      where: { id, organizationId },
      include: { itens: { orderBy: { ordem: "asc" } } },
    });
  }

  instanciaDoEvento(collaboratorId: string, evento: string) {
    return this.db.collaboratorChecklist.findFirst({
      where: { collaboratorId, evento },
      select: { id: true },
    });
  }

  /**
   * Abre o checklist COPIANDO os itens do modelo, numa transação.
   *
   * Cópia e não referência: mudar o modelo depois não pode reescrever o
   * checklist de quem já foi admitido. Sem a transação, uma falha no meio
   * deixaria um checklist sem itens — pior que nenhum, porque parece cumprido.
   */
  async abrir(params: {
    instancia: Record<string, any>;
    itens: Record<string, any>[];
  }) {
    const [criada] = await this.prisma.$transaction([
      this.db.collaboratorChecklist.create({ data: params.instancia }),
      ...params.itens.map(i => this.db.collaboratorChecklistItem.create({ data: i })),
    ]);
    return criada;
  }

  obterItem(id: string, organizationId: string) {
    return this.db.collaboratorChecklistItem.findFirst({
      where: { id, organizationId },
      include: {
        checklist: { select: { id: true, collaboratorId: true, evento: true, nome: true } },
      },
    });
  }

  atualizarItem(id: string, dados: Record<string, any>) {
    return this.db.collaboratorChecklistItem.update({ where: { id }, data: dados });
  }

  marcarConclusaoDaInstancia(id: string, concluidoEm: Date | null) {
    return this.db.collaboratorChecklist.update({
      where: { id },
      data: { concluidoEm },
      select: { id: true, concluidoEm: true },
    });
  }

  excluirInstancia(id: string) {
    return this.db.collaboratorChecklist.delete({ where: { id } });
  }

  /**
   * Checklists em aberto da organização, com o colaborador e a data do evento.
   *
   * Base do painel: sem isto, saber quem está com pendência exigiria abrir
   * perfil por perfil.
   */
  emAberto(organizationId: string, collaboratorIds?: string[]) {
    return this.db.collaboratorChecklist.findMany({
      where: {
        organizationId,
        concluidoEm: null,
        ...(collaboratorIds ? { collaboratorId: { in: collaboratorIds } } : {}),
      },
      include: {
        itens: { orderBy: { ordem: "asc" } },
        collaborator: {
          select: {
            id: true, nomeCompleto: true, dataAdmissao: true, dataDesligamento: true,
            user: { select: { nome: true } },
          },
        },
      },
      orderBy: { iniciadoEm: "asc" },
    });
  }

  colaborador(id: string, organizationId: string) {
    return this.db.collaborator.findFirst({
      where: { id, organizationId, excluidoEm: null },
      select: {
        id: true, nomeCompleto: true, dataAdmissao: true, dataDesligamento: true,
        user: { select: { nome: true } },
      },
    });
  }
}
