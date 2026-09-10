import { Injectable, BadRequestException, ForbiddenException } from "@nestjs/common";
import * as XLSX from "xlsx";
import { MARCA } from "../../../common/marca";
import { PrismaService } from "../../../prisma/prisma.service";
import { CasoService } from "./caso.service";
import { PainelService } from "./painel.service";
import { CasoApresentado } from "./presenter";
import { Usuario, verFinanceiro, dataBr } from "./contexto";
import {
  CLASSIFICACOES_FINANCEIRAS, FAIXAS_AGING, TAREFA_ABERTA, diasEntre, CAMPOS_VALOR,
} from "../domain/caso.entity";

export const TIPOS_RELATORIO: readonly { id: string; titulo: string; descricao: string; financeiro?: boolean }[] = [
  { id: "executivo",     titulo: "Relatório executivo",       descricao: "Carteira completa por gravidade: farol, etapa, próxima ação e responsáveis." },
  { id: "financeiro",    titulo: "Relatório financeiro",      descricao: "Os nove valores do modelo econômico por assunto, com totais.", financeiro: true },
  { id: "regulatorio",   titulo: "Relatório regulatório",     descricao: "Assuntos em que a área Regulatório é executiva, operacional ou de apoio." },
  { id: "juridico",      titulo: "Relatório jurídico",        descricao: "Assuntos em que a área Jurídico é executiva, operacional ou de apoio." },
  { id: "oportunidades", titulo: "Relatório de oportunidades", descricao: "Pipeline de oportunidades por estágio, com potencial." },
  { id: "riscos",        titulo: "Relatório de riscos",       descricao: "Matriz probabilidade × impacto, dimensões de risco e mitigação." },
  { id: "pendencias",    titulo: "Relatório de pendências",   descricao: "Sem próxima ação, ações e prazos vencidos, tarefas abertas." },
  { id: "aging",         titulo: "Relatório de aging",        descricao: "Tempo sem movimentação de cada assunto ativo." },
  { id: "evolucao",      titulo: "Relatório de evolução mensal", descricao: "Andamentos, decisões, novos e encerrados nos últimos 12 meses." },
];

type Celula = string | number | null;
export type Tabela = {
  tipo: string;
  titulo: string;
  colunas: string[];
  /** Índices das colunas monetárias — numéricas no Excel, formatadas no PDF. */
  moeda: number[];
  linhas: Celula[][];
  totais?: Celula[];
  avisos: string[];
  geradoEm: Date;
};

function celulaCsv(v: Celula): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v).replace(".", ",");
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

const statusDe = (c: CasoApresentado) => c.statusTexto;
const responsavelDe = (c: CasoApresentado) =>
  c.proximaAcaoResponsavel?.nome ?? c.proximaAcaoResponsavelNome ?? c.responsavelOperacional?.nome ?? c.areaOperacional?.nome ?? "";

/**
 * Relatórios do Strategy. A mesma tabela alimenta a prévia na tela e os três
 * formatos de exportação — o que a pessoa vê é o que ela baixa.
 */
@Injectable()
export class RelatorioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly casos: CasoService,
    private readonly painel: PainelService,
  ) {}

  private get db(): any {
    return this.prisma as any;
  }

  tipos(user: Usuario) {
    const fin = verFinanceiro(user);
    return TIPOS_RELATORIO.filter(t => !t.financeiro || fin);
  }

  async gerar(user: Usuario, tipo: string): Promise<Tabela> {
    const def = TIPOS_RELATORIO.find(t => t.id === tipo);
    if (!def) throw new BadRequestException("Relatório desconhecido.");
    const fin = verFinanceiro(user);
    if (def.financeiro && !fin) throw new ForbiddenException("Relatório financeiro exige permissão para ver valores.");

    const { itens } = await this.casos.carteiraApresentada(user);
    const vivos = this.casos.filtrar(itens, {}).filter(c => c.etapa !== "cancelado");
    const base = { tipo, titulo: def.titulo, moeda: [] as number[], avisos: [] as string[], geradoEm: new Date() };

    const executivo = (lista: CasoApresentado[]): Omit<Tabela, "tipo" | "titulo" | "avisos" | "geradoEm"> => {
      const colunas = ["Código", "Assunto", "Tipo", "Farol", "Etapa / status", "Grupo", "Objetivo", "Esfera", "Área operacional",
        "Próxima ação", "Responsável", "Prazo", "Dias p/ prazo", "Dias parado", "Risco"];
      if (fin) colunas.push("Valor principal");
      return {
        colunas,
        moeda: fin ? [colunas.length - 1] : [],
        linhas: lista.map(c => {
          const l: Celula[] = [
            c.codigo, c.titulo, c.tipo === "oportunidade" ? "Oportunidade" : "Assunto", c.farolRotulo, statusDe(c),
            c.grupo?.nome ?? "", c.objetivo?.nome ?? "", c.esfera?.nome ?? "", c.areaOperacional?.nome ?? "",
            c.proximaAcao ?? (c.semProximaAcao ? "⚠ sem próxima ação" : ""), responsavelDe(c),
            c.proximaAcaoPrazo ? dataBr(c.proximaAcaoPrazo) : "", c.diasProximaAcao, c.diasParado, c.riscoNivel ?? "",
          ];
          if (fin) l.push(c.valorPrincipal || null);
          return l;
        }),
      };
    };

    switch (tipo) {
      case "executivo":
        return { ...base, ...executivo(vivos) };

      case "regulatorio":
      case "juridico": {
        const areaIds = await this.casos.areasPorNome(user.organizationId, tipo === "regulatorio" ? "regulator" : "juridic");
        const lista = vivos.filter(c => [c.areaExecutiva?.id, c.areaOperacional?.id, ...c.areasApoio.map((a: any) => a.id)].some(id => id && areaIds.includes(id)));
        const avisos = areaIds.length ? [] : [`Nenhuma área com nome "${tipo === "regulatorio" ? "Regulatório" : "Jurídico"}" cadastrada no catálogo.`];
        return { ...base, avisos, ...executivo(lista) };
      }

      case "financeiro": {
        const colunas = ["Código", "Assunto", "Classificação", ...CAMPOS_VALOR.map(v => v.rotulo), "Referência"];
        const moeda = CAMPOS_VALOR.map((_, i) => 3 + i);
        const linhas = vivos.map(c => [
          c.codigo, c.titulo, CLASSIFICACOES_FINANCEIRAS.find(x => x.id === c.classificacaoFinanceira)?.rotulo ?? "",
          ...CAMPOS_VALOR.map(v => (c as any)[v.campo] as number | null),
          c.valoresReferenciaEm ? dataBr(c.valoresReferenciaEm) : "",
        ]);
        const totais: Celula[] = ["", "Total", "", ...CAMPOS_VALOR.map((_, i) => linhas.reduce((s, l) => s + Number(l[3 + i] ?? 0), 0)), ""];
        const semValor = vivos.filter(c => !c.temValor).length;
        return { ...base, colunas, moeda, linhas, totais, avisos: semValor ? [`${semValor} assunto(s) sem nenhum valor informado.`] : [] };
      }

      case "oportunidades": {
        const lista = vivos.filter(c => c.tipo === "oportunidade");
        const colunas = ["Código", "Oportunidade", "Estágio", "Farol", "Etapa / status", "Próxima ação", "Responsável", "Prazo"];
        if (fin) colunas.push("Potencial", "Pretendido");
        return {
          ...base, colunas, moeda: fin ? [8, 9] : [],
          linhas: lista.map(c => {
            const l: Celula[] = [c.codigo, c.titulo, c.estagioRotulo ?? "Identificada", c.farolRotulo, statusDe(c), c.proximaAcao ?? "", responsavelDe(c), c.proximaAcaoPrazo ? dataBr(c.proximaAcaoPrazo) : ""];
            if (fin) l.push((c as any).valorPotencial, (c as any).valorPretendido);
            return l;
          }),
        };
      }

      case "riscos": {
        const lista = vivos.filter(c => c.riscoNivel).sort((a, b) => (b.riscoScore ?? 0) - (a.riscoScore ?? 0));
        const colunas = ["Código", "Assunto", "Farol", "Probabilidade", "Impacto", "Score", "Nível", "Financeiro", "Jurídico", "Regulatório", "Operacional", "Prazo", "Plano de mitigação"];
        if (fin) colunas.push("Valor em risco");
        const semAvaliacao = vivos.filter(c => c.ativo && !c.riscoNivel).length;
        return {
          ...base, colunas, moeda: fin ? [13] : [],
          avisos: semAvaliacao ? [`${semAvaliacao} assunto(s) ativo(s) ainda sem avaliação de risco.`] : [],
          linhas: lista.map(c => {
            const l: Celula[] = [c.codigo, c.titulo, c.farolRotulo, c.probabilidade, c.impacto, c.riscoScore, c.riscoNivel,
              c.riscoFinanceiro, c.riscoJuridico, c.riscoRegulatorio, c.riscoOperacional, c.riscoPrazo, c.planoMitigacao ?? ""];
            if (fin) l.push((c as any).valorEmRisco);
            return l;
          }),
        };
      }

      case "pendencias": {
        const ativos = vivos.filter(c => c.ativo);
        const linhas: Celula[][] = [];
        for (const c of ativos) {
          if (c.semProximaAcao) linhas.push(["Sem próxima ação", c.codigo, c.titulo, "", c.areaOperacional?.nome ?? "", "", "Definir ação, responsável e prazo"]);
          if (c.acaoVencida) linhas.push(["Próxima ação vencida", c.codigo, c.titulo, c.proximaAcao, responsavelDe(c), dataBr(c.proximaAcaoPrazo), `Vencida há ${-(c.diasProximaAcao ?? 0)} dias`]);
          if (c.prazoFinalVencido) linhas.push(["Prazo final vencido", c.codigo, c.titulo, "", responsavelDe(c), dataBr(c.prazoFinal), "Vencido"]);
          if (!c.responsavelExecutivo && !c.responsavelOperacional && !c.proximaAcaoResponsavel) {
            linhas.push(["Sem responsável nomeado", c.codigo, c.titulo, "", c.areaOperacional?.nome ?? "", "", "Nomear responsáveis"]);
          }
        }
        const tarefas = await this.db.estrategicoTarefa.findMany({
          where: { organizationId: user.organizationId, deletedAt: null, status: { in: TAREFA_ABERTA }, casoId: { in: ativos.map(c => c.id) } },
          include: { caso: { select: { codigo: true, titulo: true } }, responsavel: { select: { nome: true } } },
          orderBy: { prazo: "asc" },
        });
        for (const t of tarefas) {
          const dias = t.prazo ? diasEntre(new Date(), t.prazo) : null;
          linhas.push([dias != null && dias < 0 ? "Tarefa vencida" : "Tarefa aberta", t.caso.codigo, t.caso.titulo, t.titulo,
            t.responsavel?.nome ?? "", t.prazo ? dataBr(t.prazo) : "", dias == null ? "Sem prazo" : dias < 0 ? `Vencida há ${-dias} dias` : `Em ${dias} dias`]);
        }
        return { ...base, colunas: ["Pendência", "Código", "Assunto", "Descrição", "Responsável", "Prazo", "Situação"], linhas };
      }

      case "aging": {
        const lista = vivos.filter(c => c.ativo).sort((a, b) => (b.diasParado ?? Number.MAX_SAFE_INTEGER) - (a.diasParado ?? Number.MAX_SAFE_INTEGER));
        return {
          ...base,
          colunas: ["Código", "Assunto", "Última movimentação", "Dias parado", "Faixa", "Farol", "Etapa / status", "Responsável"],
          linhas: lista.map(c => [c.codigo, c.titulo, c.ultimaMovimentacaoEm ? dataBr(c.ultimaMovimentacaoEm) : "Sem andamento datado",
            c.diasParado, FAIXAS_AGING.find(f => f.id === c.faixaAging)?.rotulo ?? "", c.farolRotulo, statusDe(c), responsavelDe(c)]),
        };
      }

      case "evolucao": {
        const p = await this.painel.painel(user);
        const colunas = ["Mês", "Andamentos", "Decisões", "Cadastrados", "Encerrados"];
        if (fin) colunas.push("Variação reconhecido/alcançado");
        return {
          ...base, colunas, moeda: fin ? [5] : [],
          avisos: ["Assuntos importados da planilha não contam como cadastrados no mês da importação."],
          linhas: p.evolucaoMensal.map((m: any) => {
            const l: Celula[] = [m.rotulo, m.andamentos, m.decisoes, m.novos, m.encerrados];
            if (fin) l.push(m.valorReconhecido);
            return l;
          }),
        };
      }
    }
    throw new BadRequestException("Relatório desconhecido.");
  }

  async exportar(user: Usuario, tipo: string, formato: string) {
    const t = await this.gerar(user, tipo);
    const data = new Date().toISOString().slice(0, 10);
    const nome = `estrategico-${tipo}-${data}`;
    if (formato === "csv") {
      const linhas = [t.colunas, ...t.linhas, ...(t.totais ? [t.totais] : [])];
      const conteudo = Buffer.from("﻿" + linhas.map(l => l.map(celulaCsv).join(";")).join("\r\n"), "utf8");
      return { conteudo, mime: "text/csv; charset=utf-8", nome: `${nome}.csv` };
    }
    if (formato === "pdf") {
      return { conteudo: await this.pdf(t), mime: "application/pdf", nome: `${nome}.pdf` };
    }
    if (formato !== "excel" && formato !== "xlsx") throw new BadRequestException("Formato inválido (excel, csv ou pdf).");

    const aoa: Celula[][] = [
      [t.titulo],
      [`Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · ${MARCA} Strategy`],
      [],
      t.colunas,
      ...t.linhas,
      ...(t.totais ? [t.totais] : []),
      ...(t.avisos.length ? [[], ...t.avisos.map(a => [a])] : []),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = t.colunas.map((c, i) => ({
      wch: Math.min(60, Math.max(c.length, ...t.linhas.map(l => String(l[i] ?? "").length)) + 2),
    }));
    for (let r = 0; r < t.linhas.length + (t.totais ? 1 : 0); r++) {
      for (const col of t.moeda) {
        const ref = XLSX.utils.encode_cell({ r: r + 4, c: col });
        if (ws[ref] && typeof ws[ref].v === "number") ws[ref].z = '"R$" #,##0.00';
      }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    const conteudo = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return { conteudo, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", nome: `${nome}.xlsx` };
  }

  private pdf(t: Tabela): Promise<Buffer> {
    const PDFDocument = require("pdfkit");
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 24 });
    const pedacos: Buffer[] = [];

    const fmt = (v: Celula, col: number) => {
      if (v == null) return "";
      if (typeof v === "number" && t.moeda.includes(col)) return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      return String(v);
    };

    return new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (c: Buffer) => pedacos.push(c));
      doc.on("end", () => resolve(Buffer.concat(pedacos)));
      doc.on("error", reject);

      const esquerda = doc.page.margins.left;
      const util = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      // Largura proporcional ao conteúdo, com piso e teto — texto longo (assunto,
      // próxima ação) ganha espaço; coluna numérica não desperdiça.
      const pesos = t.colunas.map((c, i) => Math.min(40, Math.max(6, c.length, ...t.linhas.slice(0, 200).map(l => fmt(l[i], i).length))));
      const soma = pesos.reduce((s, p) => s + p, 0);
      const larguras = pesos.map(p => (p / soma) * util);
      const alturaLinha = 15;

      doc.font("Helvetica-Bold").fontSize(14).fillColor("#111827").text(t.titulo, esquerda, 24);
      doc.font("Helvetica").fontSize(8).fillColor("#6b7280").text(
        `Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · ${MARCA} Strategy · ${t.linhas.length} linha(s)`,
        esquerda, 42,
      );

      let y = 60;
      const cabecalho = () => {
        doc.rect(esquerda, y, util, alturaLinha).fill("#111827");
        doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#ffffff");
        let x = esquerda;
        t.colunas.forEach((h, i) => {
          doc.text(h, x + 2, y + 4, { width: larguras[i] - 4, ellipsis: true, lineBreak: false });
          x += larguras[i];
        });
        y += alturaLinha;
      };
      cabecalho();

      const linhas = [...t.linhas, ...(t.totais ? [t.totais] : [])];
      linhas.forEach((linha, idx) => {
        if (y + alturaLinha > doc.page.height - doc.page.margins.bottom - 20) {
          doc.addPage();
          y = doc.page.margins.top;
          cabecalho();
        }
        const total = t.totais && idx === linhas.length - 1;
        if (idx % 2 === 1 || total) doc.rect(esquerda, y, util, alturaLinha).fill(total ? "#e5e7eb" : "#f3f4f6");
        doc.font(total ? "Helvetica-Bold" : "Helvetica").fontSize(6.5).fillColor("#111827");
        let x = esquerda;
        linha.forEach((v, i) => {
          doc.text(fmt(v, i), x + 2, y + 4, { width: larguras[i] - 4, ellipsis: true, lineBreak: false });
          x += larguras[i];
        });
        y += alturaLinha;
      });

      if (t.avisos.length) {
        y += 8;
        doc.font("Helvetica-Oblique").fontSize(7).fillColor("#6b7280");
        for (const a of t.avisos) { doc.text(a, esquerda, y); y += 11; }
      }
      doc.end();
    });
  }
}
