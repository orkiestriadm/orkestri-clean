import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { TAREFA_ABERTA, formatarCodigo, DEPENDENCIAS_PADRAO } from "../domain/caso.entity";
import { hojeData, CONFIG_PADRAO } from "../application/contexto";

/**
 * Único ponto que monta a consulta do caso com tudo que a apresentação precisa.
 *
 * O volume do módulo é pequeno por natureza — a planilha de origem tinha 28
 * assuntos —, então painel, filtros e relatórios trabalham sobre a carteira
 * carregada inteira (sem os textos longos). Isso mantém o farol, que é
 * DERIVADO da data de hoje, sempre coerente entre lista, painel e relatório,
 * sem depender de a automação noturna ter rodado. O teto de segurança está em
 * `LIMITE_CARTEIRA`.
 */

export const LIMITE_CARTEIRA = 5000;

const pessoa = { select: { id: true, nome: true, avatar: true } };
const item = { select: { id: true, nome: true, cor: true, natureza: true } };

export function includeCaso(hoje: Date = hojeData()) {
  return {
    grupo: item,
    objetivo: item,
    esfera: item,
    areaExecutiva: item,
    areaOperacional: item,
    responsavelExecutivo: pessoa,
    responsavelOperacional: pessoa,
    proximaAcaoResponsavel: pessoa,
    apoios: { include: { area: item } },
    dependencias: {
      where: { resolvidaEm: null },
      include: { catalogo: item },
      orderBy: { desde: "asc" as const },
    },
    _count: {
      select: {
        tarefas: { where: { deletedAt: null, status: { in: TAREFA_ABERTA }, prazo: { lt: hoje } } },
      },
    },
  };
}

@Injectable()
export class CasoRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get db(): any {
    return this.prisma as any;
  }

  async carteira(organizationId: string) {
    return this.db.estrategicoCaso.findMany({
      where: { organizationId, deletedAt: null },
      include: includeCaso(),
      orderBy: { codigo: "asc" },
      take: LIMITE_CARTEIRA,
    });
  }

  /**
   * Dependências padrão do plano (seção 7), semeadas só se a organização ainda
   * não tem NENHUMA — quem desativou ou apagou uma não a vê voltar.
   */
  async garantirPadroes(organizationId: string, tx: any = this.db) {
    const existe = await tx.estrategicoCatalogo.count({ where: { organizationId, tipo: "dependencia" } });
    if (existe > 0) return;
    await tx.estrategicoCatalogo.createMany({
      data: DEPENDENCIAS_PADRAO.map((d, ordem) => ({ organizationId, tipo: "dependencia", nome: d.nome, natureza: d.natureza, ordem })),
      skipDuplicates: true,
    });
  }

  async obter(organizationId: string, id: string) {
    return this.db.estrategicoCaso.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: includeCaso(),
    });
  }

  async config(organizationId: string) {
    const c = await this.db.estrategicoConfig.findUnique({ where: { organizationId } });
    return c ?? { ...CONFIG_PADRAO, organizationId };
  }

  /**
   * Próximo código. Conta também os excluídos: código é identidade citada em
   * ata e e-mail, e reaproveitar o de um assunto apagado confundiria a trilha.
   */
  async proximoCodigo(organizationId: string, tx: any = this.db): Promise<string> {
    const ultimo = await tx.estrategicoCaso.findFirst({
      where: { organizationId },
      orderBy: { codigo: "desc" },
      select: { codigo: true },
    });
    const n = ultimo ? Number(String(ultimo.codigo).replace(/\D/g, "")) || 0 : 0;
    return formatarCodigo(n + 1);
  }

  async usuarios(organizationId: string) {
    return this.db.user.findMany({
      where: { organizationId, ativo: true },
      select: { id: true, nome: true, avatar: true },
      orderBy: { nome: "asc" },
    });
  }

  async catalogos(organizationId: string, apenasAtivos = false) {
    return this.db.estrategicoCatalogo.findMany({
      where: { organizationId, ...(apenasAtivos ? { ativo: true } : {}) },
      orderBy: [{ tipo: "asc" }, { ordem: "asc" }, { nome: "asc" }],
    });
  }

  async historico(organizationId: string, casoId: string, dados: {
    userId?: string | null; acao: string; campo?: string | null; valorAnterior?: string | null;
    valorNovo?: string | null; descricao?: string | null; origem?: string; ip?: string | null;
  }, tx: any = this.db) {
    return tx.estrategicoHistorico.create({
      data: {
        organizationId, casoId,
        userId: dados.userId ?? null,
        acao: dados.acao,
        campo: dados.campo ?? null,
        valorAnterior: dados.valorAnterior ?? null,
        valorNovo: dados.valorNovo ?? null,
        descricao: dados.descricao ?? null,
        origem: dados.origem ?? "web",
        ip: dados.ip ?? null,
      },
    });
  }
}
