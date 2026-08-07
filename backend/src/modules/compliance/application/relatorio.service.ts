import { Injectable, BadRequestException } from "@nestjs/common";
import { ObrigacaoRepository, FiltrosObrigacao } from "../infrastructure/obrigacao.repository";
import { PainelRepository } from "../infrastructure/painel.repository";
import { apresentarLista, ROTULO_SITUACAO } from "./obrigacao.presenter";
import { dataBR } from "../../../common/datas";
import { ListarObrigacoesQuery } from "./dto/obrigacao.dto";

type Usuario = { id: string; organizationId: string };

/**
 * Teto de linhas por exportação.
 *
 * Acima disso a resposta vem marcada como truncada, para a tela avisar em vez
 * de entregar um arquivo incompleto que parece completo.
 */
const MAX_LINHAS = 10_000;

type Coluna = { header: string; get: (o: any) => any };

/** Neutraliza fórmula (CSV injection) e aplica as aspas do CSV. */
function celulaCsv(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v).replace(".", ",");
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

const dinheiro = (v: any) => (v == null ? "" : Number(v));

/**
 * Relatórios e exportação.
 *
 * As colunas espelham a planilha de origem e acrescentam o que ela não tinha:
 * situação DERIVADA, prorrogação e o código do registro. Quem receber o arquivo
 * exportado precisa conseguir usá-lo no lugar da planilha antiga sem sentir
 * falta de nada.
 */
@Injectable()
export class RelatorioService {
  constructor(
    private readonly repo: ObrigacaoRepository,
    private readonly painel: PainelRepository,
  ) {}

  private readonly COLUNAS: Coluna[] = [
    { header: "Código",              get: o => o.codigo },
    { header: "Categoria",           get: o => o.categoria?.nome ?? "" },
    { header: "Sigla",               get: o => o.sigla ?? "" },
    { header: "Obrigação",           get: o => o.nome },
    { header: "Nº do documento",     get: o => o.numeroDocumento ?? "" },
    { header: "Órgão",               get: o => o.orgao?.nome ?? "" },
    { header: "Unidade",             get: o => o.unidade ?? "" },
    { header: "Equipamento",         get: o => o.ativoIdentificador ?? "" },
    { header: "Departamento",        get: o => o.departamento ?? "" },
    { header: "Criticidade",         get: o => o.criticidade },
    { header: "Emissão",             get: o => dataBR(o.dataEmissao) },
    { header: "Validade",            get: o => dataBR(o.dataValidade) },
    { header: "Periodicidade (meses)", get: o => o.validadeMeses ?? "" },
    { header: "Prazo do órgão (dias)", get: o => o.prazoMinimoDias ?? 0 },
    { header: "Prazo interno",       get: o => dataBR(o.prazoInternoEm) },
    { header: "Prazo fatal",         get: o => dataBR(o.prazoFatalEm) },
    { header: "Dias p/ validade",    get: o => o.diasParaValidade ?? "" },
    { header: "Situação",            get: o => ROTULO_SITUACAO[o.situacao] ?? o.situacao },
    { header: "Status",              get: o => o.status },
    { header: "Renovação automática", get: o => (o.renovacaoAutomatica ? "Sim" : "Não") },
    { header: "Protocolo",           get: o => o.protocoloNumero ?? "" },
    { header: "Protocolado em",      get: o => dataBR(o.protocoloEm) },
    { header: "Responsáveis",        get: o => nomesResponsaveis(o) },
    { header: "E-mails",             get: o => emailsResponsaveis(o) },
    { header: "Valor da licença",    get: o => dinheiro(o.valorLicenca) },
    { header: "Valor da renovação",  get: o => dinheiro(o.valorRenovacao) },
    { header: "Tags",                get: o => (o.tags ?? []).map((t: any) => t.nome).join(", ") },
    { header: "Observações",         get: o => o.observacoes ?? "" },
  ];

  /** Dados crus da exportação, já apresentados (situação derivada incluída). */
  async carteira(user: Usuario, query: ListarObrigacoesQuery) {
    const filtros: FiltrosObrigacao = {
      q: query.q?.trim() || undefined,
      categoriaId: query.categoriaId || undefined,
      orgaoId: query.orgaoId || undefined,
      status: query.status || undefined,
      criticidade: query.criticidade || undefined,
      situacao: query.situacao || undefined,
      unidade: query.unidade || undefined,
      departamento: query.departamento || undefined,
      empresa: query.empresa || undefined,
      responsavelId: query.responsavelId || undefined,
      tag: query.tag || undefined,
      venceEmDias: query.venceEmDias,
      de: query.de ? new Date(query.de) : undefined,
      ate: query.ate ? new Date(query.ate) : undefined,
    };

    const r = await this.repo.listar(user.organizationId, filtros, {
      pagina: 1, limite: MAX_LINHAS, ordenar: query.ordenar, userId: user.id,
    });

    return {
      itens: apresentarLista(r.itens),
      total: r.total,
      truncado: r.total > MAX_LINHAS,
    };
  }

  /**
   * Arquivo pronto para download.
   *
   * Devolve buffer e nome; quem escreve os cabeçalhos HTTP é o controller.
   */
  async exportar(
    user: Usuario, formato: string, query: ListarObrigacoesQuery,
  ): Promise<{ nome: string; mime: string; conteudo: Buffer; truncado: boolean }> {
    const { itens, truncado } = await this.carteira(user, query);

    const headers = this.COLUNAS.map(c => c.header);
    const linhas = itens.map(o => this.COLUNAS.map(c => c.get(o)));
    const carimbo = new Date().toISOString().slice(0, 10);

    switch (formato) {
      case "excel":
      case "xlsx":
        return {
          nome: `obrigacoes-${carimbo}.xlsx`,
          mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          conteudo: this.montarXlsx(headers, linhas),
          truncado,
        };

      case "pdf":
        return {
          nome: `obrigacoes-${carimbo}.pdf`,
          mime: "application/pdf",
          conteudo: await this.montarPdf("Carteira de Obrigações", headers, linhas),
          truncado,
        };

      case "csv": {
        // BOM para o Excel reconhecer UTF-8 — sem ele a acentuação chega quebrada.
        const csv = "﻿" + [
          headers.map(celulaCsv).join(";"),
          ...linhas.map(l => l.map(celulaCsv).join(";")),
        ].join("\r\n");
        return {
          nome: `obrigacoes-${carimbo}.csv`,
          mime: "text/csv; charset=utf-8",
          conteudo: Buffer.from(csv, "utf-8"),
          truncado,
        };
      }

      default:
        throw new BadRequestException(`Formato "${formato}" não suportado. Use excel, pdf ou csv.`);
    }
  }

  /** Relatórios agregados que a especificação nomeia. */
  async agregados(user: Usuario) {
    const hoje = new Date();
    const de = new Date(hoje.getTime()); de.setMonth(de.getMonth() - 12);
    const ate = new Date(hoje.getTime()); ate.setMonth(ate.getMonth() + 24);

    const [porCategoria, porStatus, porUnidade, porEmpresa, vencimentos, custos] =
      await Promise.all([
        this.painel.porCategoria(user.organizationId),
        this.painel.porColuna(user.organizationId, "status"),
        this.painel.porColuna(user.organizationId, "unidade"),
        this.painel.porColuna(user.organizationId, "empresa"),
        this.painel.vencimentosPorMes(user.organizationId, de, ate),
        this.painel.custos(user.organizationId),
      ]);

    return {
      porCategoria, porStatus, porUnidade, porEmpresa, vencimentos,
      custos: {
        totalLicencas: Number(custos.agregado?._sum?.valorLicenca ?? 0),
        totalRenovacoes: Number(custos.agregado?._sum?.valorRenovacao ?? 0),
      },
      geradoEm: hoje.toISOString(),
    };
  }

  /* ── Construtores de arquivo ───────────────────────────────────────────── */

  private montarXlsx(headers: string[], linhas: any[][]): Buffer {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const XLSX = require("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([headers, ...linhas]);
    ws["!cols"] = headers.map(h => ({ wch: Math.max(h.length + 4, 12) }));
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Obrigações");
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  }

  private montarPdf(titulo: string, headers: string[], linhas: any[][]): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFDocument = require("pdfkit");
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 24 });
    const pedacos: Buffer[] = [];

    // O PDF paisagem com 28 colunas fica ilegível. Selecionamos as que cabem —
    // e dizemos isso no rodapé, em vez de cortar em silêncio.
    const indices = [0, 1, 3, 6, 11, 14, 15, 17, 22];
    const cabecalhos = indices.map(i => headers[i]);

    return new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (c: Buffer) => pedacos.push(c));
      doc.on("end", () => resolve(Buffer.concat(pedacos)));
      doc.on("error", reject);

      const esquerda = doc.page.margins.left;
      const util = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const largura = util / cabecalhos.length;
      const alturaLinha = 16;

      doc.font("Helvetica-Bold").fontSize(14).fillColor("#1e1b4b").text(titulo, esquerda, 26);
      doc.font("Helvetica").fontSize(8).fillColor("#6b7280").text(
        `Gerado em ${new Date().toLocaleString("pt-BR")} · Orkiestri Compliance · ` +
        `${linhas.length} ${linhas.length === 1 ? "obrigação" : "obrigações"} · ` +
        `colunas resumidas — a versão completa está no Excel`,
        esquerda, 44,
      );

      let y = 64;
      const desenharCabecalho = () => {
        doc.rect(esquerda, y, util, alturaLinha).fill("#1e1b4b");
        doc.font("Helvetica-Bold").fontSize(7).fillColor("#ffffff");
        cabecalhos.forEach((h, i) => {
          doc.text(String(h), esquerda + i * largura + 3, y + 5,
            { width: largura - 6, ellipsis: true, lineBreak: false });
        });
        y += alturaLinha;
      };
      desenharCabecalho();

      doc.font("Helvetica").fontSize(7);
      linhas.forEach((linha, idx) => {
        if (y + alturaLinha > doc.page.height - doc.page.margins.bottom) {
          doc.addPage({ size: "A4", layout: "landscape", margin: 24 });
          y = 36;
          desenharCabecalho();
          doc.font("Helvetica").fontSize(7);
        }
        if (idx % 2 === 0) doc.rect(esquerda, y, util, alturaLinha).fill("#f5f3ff");
        doc.fillColor("#111827");
        indices.forEach((col, i) => {
          const v = linha[col];
          const txt = typeof v === "number" ? v.toLocaleString("pt-BR") : String(v ?? "");
          doc.text(txt, esquerda + i * largura + 3, y + 5,
            { width: largura - 6, ellipsis: true, lineBreak: false });
        });
        y += alturaLinha;
      });

      doc.end();
    });
  }
}

function nomesResponsaveis(o: any): string {
  return (o.responsaveis ?? [])
    .map((r: any) => r.user?.nome ?? r.nome)
    .filter(Boolean)
    .join(", ");
}

function emailsResponsaveis(o: any): string {
  return (o.responsaveis ?? [])
    .map((r: any) => r.email ?? r.user?.email)
    .filter(Boolean)
    .join(", ");
}
