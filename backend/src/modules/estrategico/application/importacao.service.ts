import { Injectable, BadRequestException } from "@nestjs/common";
import * as XLSX from "xlsx";
import * as path from "path";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.module";
import { lerPlanilha, PreviaImportacao } from "../domain/importacao.parser";
import { executarImportacao } from "./importacao.executor";
import { Usuario } from "./contexto";

export const TAMANHO_MAXIMO_PLANILHA = 10 * 1024 * 1024;

/** Lê o .xlsx em memória e devolve as abas como matriz de células. */
export function abasDoArquivo(buffer: Buffer) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  return wb.SheetNames.map(nome => ({
    nome,
    linhas: XLSX.utils.sheet_to_json<any[]>(wb.Sheets[nome], { header: 1, raw: true, defval: null, blankrows: true }),
  }));
}

/**
 * Importação da planilha "Acompanhamento Estratégico" (seção 21 do plano).
 *
 * Duas chamadas com o MESMO arquivo: a prévia (nada é gravado — a tela mostra
 * o que vai entrar, o que foi unificado e o que precisa de revisão) e a
 * confirmação. O arquivo não fica guardado no servidor: a planilha contém
 * informação estratégica e só o que foi confirmado deve existir no sistema.
 */
@Injectable()
export class ImportacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private get db(): any {
    return this.prisma as any;
  }

  private ler(arquivo: any): { previa: PreviaImportacao; nome: string } {
    if (!arquivo?.buffer?.length) throw new BadRequestException("Envie a planilha (.xlsx).");
    const nome = Buffer.from(arquivo.originalname ?? "planilha.xlsx", "latin1").toString("utf8");
    const ext = path.extname(nome).toLowerCase();
    if (![".xlsx", ".xlsm", ".xls"].includes(ext)) throw new BadRequestException("Formato não suportado — envie .xlsx.");
    try {
      return { previa: lerPlanilha(abasDoArquivo(arquivo.buffer)), nome };
    } catch (e: any) {
      throw new BadRequestException(e?.message ?? "Não foi possível ler a planilha.");
    }
  }

  async previa(user: Usuario, arquivo: any) {
    const { previa, nome } = this.ler(arquivo);
    const existentes = await this.db.estrategicoCaso.findMany({
      where: { organizationId: user.organizationId, importacaoChave: { in: previa.casos.map(c => c.chave) } },
      select: { importacaoChave: true, codigo: true, deletedAt: true },
    });
    const porChave = new Map(existentes.map((e: any) => [e.importacaoChave, e]));
    return {
      arquivo: nome,
      ...previa,
      casos: previa.casos.map(c => {
        const e: any = porChave.get(c.chave);
        return { ...c, jaImportado: e ? { codigo: e.codigo, excluido: !!e.deletedAt } : null };
      }),
      resumo: {
        casos: previa.casos.length,
        novos: previa.casos.filter(c => !porChave.has(c.chave)).length,
        jaImportados: porChave.size,
        eventos: previa.casos.reduce((s, c) => s + c.eventos.length, 0),
        trechosSemData: previa.casos.reduce((s, c) => s + c.trechosSemData.length, 0),
        oportunidades: previa.casos.filter(c => c.tipo === "oportunidade").length,
        comValor: previa.casos.filter(c => Object.values(c.valores).some(v => v != null)).length,
      },
    };
  }

  async confirmar(user: Usuario, arquivo: any, ip?: string) {
    const { previa, nome } = this.ler(arquivo);
    const r = await executarImportacao(this.prisma, {
      organizationId: user.organizationId, userId: user.id, previa, arquivo: nome,
    });
    await this.audit.log({
      organizationId: user.organizationId, userId: user.id, modulo: "estrategico", tabela: "estrategico_casos",
      registroId: "importacao", acao: "importar", ip,
      descricao: `Planilha "${nome}": ${r.criados.length} assunto(s) criado(s), ${r.ignorados.length} ignorado(s), ${r.eventos} andamento(s).`,
      dados: { criados: r.criados.map(c => c.codigo), ignorados: r.ignorados.length, catalogos: r.catalogosCriados },
    });
    return r;
  }
}
