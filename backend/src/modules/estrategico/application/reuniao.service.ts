import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { MARCA } from "../../../common/marca";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.module";
import { CasoRepository } from "../infrastructure/caso.repository";
import { CasoService } from "./caso.service";
import { AtividadeService } from "./atividade.service";
import { AvisoService } from "./aviso.service";
import { Usuario, hojeData, dataBr } from "./contexto";
import { TAREFA_ABERTA } from "../domain/caso.entity";
import { ROTULO_FAROL } from "../domain/farol.entity";
import { CriarReuniaoDto, AnotarPautaDto, DecisaoDto, TarefaReuniaoDto } from "./dto/estrategico.dto";

const TZ = "America/Sao_Paulo";
const dataHora = (d: Date | string) =>
  new Date(d).toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export type ItemPauta = {
  casoId: string; codigo: string; titulo: string; farol: string | null; etapa: string | null;
  motivo: string; tarefaId?: string;
};
export type SecaoPauta = { id: string; titulo: string; itens: ItemPauta[] };

/**
 * Reunião Estratégica (seção 25 do plano).
 *
 * A pauta é GERADA dos dados, na ordem que o plano define, e CONGELADA na
 * reunião: a ata precisa refletir o que foi posto na mesa naquele dia, mesmo
 * que o farol mude depois. "Regerar pauta" existe para a reunião que ainda não
 * aconteceu.
 *
 * Durante a reunião, decisão vira decisão + andamento na timeline do assunto;
 * tarefa vira tarefa com origem "reunião". Ao encerrar, a ata é montada e cada
 * responsável recebe as ações que lhe couberam.
 */
@Injectable()
export class ReuniaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: CasoRepository,
    private readonly casos: CasoService,
    private readonly atividade: AtividadeService,
    private readonly aviso: AvisoService,
    private readonly audit: AuditService,
  ) {}

  private get db(): any {
    return this.prisma as any;
  }

  async listar(user: Usuario) {
    return this.db.estrategicoReuniao.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      select: {
        id: true, titulo: true, dataReuniao: true, local: true, status: true, participantes: true,
        encerradaEm: true, criadoEm: true, _count: { select: { decisoes: true } },
      },
      orderBy: { dataReuniao: "desc" },
      take: 200,
    });
  }

  private async exigir(user: Usuario, id: string) {
    const r = await this.db.estrategicoReuniao.findFirst({ where: { id, organizationId: user.organizationId, deletedAt: null } });
    if (!r) throw new NotFoundException("Reunião não encontrada");
    return r;
  }

  async obter(user: Usuario, id: string) {
    const r = await this.exigir(user, id);
    const [decisoes, tarefas, carteira] = await Promise.all([
      this.db.estrategicoDecisao.findMany({
        where: { reuniaoId: id, organizationId: user.organizationId },
        include: { caso: { select: { id: true, codigo: true, titulo: true } } },
        orderBy: { criadoEm: "asc" },
      }),
      this.db.estrategicoTarefa.findMany({
        where: { reuniaoId: id, organizationId: user.organizationId, deletedAt: null },
        include: { caso: { select: { id: true, codigo: true, titulo: true } }, responsavel: { select: { id: true, nome: true } } },
        orderBy: { criadoEm: "asc" },
      }),
      this.casos.carteiraApresentada(user),
    ]);
    const idsPauta = new Set<string>(((r.pauta ?? []) as SecaoPauta[]).flatMap(s => s.itens.map(i => i.casoId)));
    const situacaoAtual = Object.fromEntries(carteira.itens.filter(c => idsPauta.has(c.id)).map(c => [c.id, {
      farol: c.farol, farolRotulo: c.farolRotulo, statusTexto: c.statusTexto, proximaAcao: c.proximaAcao,
      proximaAcaoPrazo: c.proximaAcaoPrazo, proximaAcaoResponsavel: c.proximaAcaoResponsavel?.nome ?? c.proximaAcaoResponsavelNome ?? null,
    }]));
    return { ...r, decisoes, tarefas, situacaoAtual };
  }

  async gerarPauta(user: Usuario, desde: Date | null): Promise<SecaoPauta[]> {
    const { itens, config } = await this.casos.carteiraApresentada(user);
    const referencia = desde ?? new Date(Date.now() - 30 * 86_400_000);
    const porId = new Map(itens.map(c => [c.id, c]));
    const ativos = itens.filter(c => c.ativo);
    const item = (c: any, motivo: string): ItemPauta => ({
      casoId: c.id, codigo: c.codigo, titulo: c.titulo, farol: c.farol, etapa: c.statusTexto, motivo,
    });

    const [alteracoes, tarefasVencidas] = await Promise.all([
      this.db.estrategicoHistorico.groupBy({
        by: ["casoId"],
        where: { organizationId: user.organizationId, criadoEm: { gte: referencia }, origem: { notIn: ["sistema", "importacao"] } },
        _count: { _all: true },
      }),
      this.db.estrategicoTarefa.findMany({
        where: { organizationId: user.organizationId, deletedAt: null, status: { in: TAREFA_ABERTA }, prazo: { lt: hojeData() }, caso: { deletedAt: null } },
        include: { caso: { select: { id: true, codigo: true, titulo: true } }, responsavel: { select: { nome: true } } },
        orderBy: { prazo: "asc" },
      }),
    ]);

    return [
      {
        id: "criticos", titulo: "Assuntos críticos",
        itens: itens.filter(c => c.farol === "vermelho").map(c => item(c,
          c.farolMotivos.filter(m => m.nivel === "vermelho").map(m => m.texto).join("; ") || c.farolJustificativa || "Farol vermelho")),
      },
      {
        id: "vencidos", titulo: "Assuntos vencidos",
        itens: ativos.filter(c => c.vencido).map(c => item(c,
          c.acaoVencida ? `Próxima ação vencida há ${-(c.diasProximaAcao ?? 0)} dias` : "Prazo final vencido")),
      },
      {
        id: "sem_atualizacao", titulo: "Assuntos sem atualização",
        itens: ativos.filter(c => c.diasParado == null || c.diasParado >= config.diasAtencaoSemMovimento).map(c => item(c,
          c.diasParado == null ? "Nenhum andamento datado" : `Sem movimentação há ${c.diasParado} dias`)),
      },
      {
        id: "alterados", titulo: "Com alteração desde a última reunião",
        itens: alteracoes
          .filter((a: any) => porId.has(a.casoId))
          .sort((a: any, b: any) => b._count._all - a._count._all)
          .map((a: any) => item(porId.get(a.casoId), `${a._count._all} ${a._count._all === 1 ? "alteração" : "alterações"} desde ${dataBr(referencia)}`)),
      },
      {
        id: "oportunidades_novas", titulo: "Oportunidades novas",
        itens: itens.filter(c => c.tipo === "oportunidade" && new Date(c.criadoEm) >= referencia)
          .map(c => item(c, `Estágio: ${c.estagioRotulo ?? "Identificada"}`)),
      },
      {
        id: "decisoes_pendentes", titulo: "Decisões pendentes",
        itens: ativos.filter(c => c.etapa === "aguardando_decisao" || c.etapa === "decisao_recebida").map(c => item(c,
          c.etapa === "aguardando_decisao" ? (c.dependenciaTexto ?? "Aguardando decisão") : "Decisão recebida — definir implementação")),
      },
      {
        id: "acoes_vencidas", titulo: "Ações vencidas",
        itens: tarefasVencidas.filter((t: any) => porId.has(t.caso.id)).map((t: any) => ({
          ...item(porId.get(t.caso.id), `Tarefa "${t.titulo}" (${t.responsavel?.nome ?? "sem responsável"}) venceu em ${dataBr(t.prazo)}`),
          tarefaId: t.id,
        })),
      },
    ];
  }

  async criar(user: Usuario, dto: CriarReuniaoDto, ip?: string) {
    const anterior = await this.db.estrategicoReuniao.findFirst({
      where: { organizationId: user.organizationId, status: "encerrada", deletedAt: null },
      orderBy: { encerradaEm: "desc" },
    });
    const desde = anterior?.encerradaEm ?? null;
    const participantes = await this.validarParticipantes(user, dto.participantes ?? []);
    const pauta = await this.gerarPauta(user, desde);

    const r = await this.db.estrategicoReuniao.create({
      data: {
        organizationId: user.organizationId, titulo: dto.titulo.trim(), dataReuniao: new Date(dto.dataReuniao),
        local: dto.local ?? null, participantes, pauta,
        referenciaDesde: desde ?? new Date(Date.now() - 30 * 86_400_000),
        reuniaoAnteriorId: anterior?.id ?? null, criadoPorId: user.id,
      },
    });
    if (dto.agendar) await this.agendar(user, r, participantes);
    await this.audit.log({
      organizationId: user.organizationId, userId: user.id, modulo: "estrategico", tabela: "estrategico_reunioes",
      registroId: r.id, acao: "criar", descricao: `${r.titulo} — ${dataHora(r.dataReuniao)}`, ip,
    });
    return this.obter(user, r.id);
  }

  private async validarParticipantes(user: Usuario, lista: { userId?: string; nome: string }[]) {
    const ids = [...new Set(lista.map(p => p.userId).filter(Boolean))] as string[];
    const validos = ids.length
      ? await this.db.user.findMany({ where: { id: { in: ids }, organizationId: user.organizationId, ativo: true }, select: { id: true, nome: true } })
      : [];
    const porId = new Map(validos.map((u: any) => [u.id, u.nome]));
    if (ids.some(id => !porId.has(id))) throw new BadRequestException("Participante não encontrado nesta organização.");
    return lista.map(p => ({ userId: p.userId ?? null, nome: p.userId ? porId.get(p.userId) : p.nome.trim() }));
  }

  /** Compromisso na agenda de cada participante com login (e do organizador). */
  private async agendar(user: Usuario, r: any, participantes: { userId: string | null }[]) {
    const ids = [...new Set([user.id, ...participantes.map(p => p.userId).filter(Boolean)])] as string[];
    for (const uid of ids) {
      await this.db.event.create({
        data: {
          organizationId: user.organizationId, userId: uid, criadoPorId: user.id,
          titulo: `Reunião Estratégica — ${r.titulo}`,
          descricao: "Pauta gerada automaticamente no módulo Strategy.",
          tipo: "REUNIAO", inicio: r.dataReuniao, fim: new Date(new Date(r.dataReuniao).getTime() + 60 * 60 * 1000),
          local: r.local ?? null, origemTipo: "estrategico_reuniao", origemId: r.id, confirmado: true,
        },
      });
      if (uid !== user.id) {
        await this.aviso.avisar({
          organizationId: user.organizationId, userId: uid, tipo: "estrategico_reuniao", reuniaoId: r.id,
          titulo: `Reunião estratégica: ${r.titulo}`, mensagem: dataHora(r.dataReuniao),
          chave: `reuniao-convite:${r.id}:${uid}`,
        });
      }
    }
  }

  private exigirAberta(r: any) {
    if (r.status === "encerrada" || r.status === "cancelada") {
      throw new BadRequestException("Reunião encerrada — a ata e a pauta estão congeladas.");
    }
  }

  async regerarPauta(user: Usuario, id: string) {
    const r = await this.exigir(user, id);
    this.exigirAberta(r);
    const pauta = await this.gerarPauta(user, r.referenciaDesde);
    await this.db.estrategicoReuniao.update({ where: { id }, data: { pauta } });
    return this.obter(user, id);
  }

  async anotar(user: Usuario, id: string, dto: AnotarPautaDto) {
    const r = await this.exigir(user, id);
    this.exigirAberta(r);
    const anotacoes = { ...((r.anotacoes ?? {}) as Record<string, any>) };
    const atual = anotacoes[dto.casoId] ?? { discutido: false, nota: "" };
    anotacoes[dto.casoId] = {
      discutido: dto.discutido ?? atual.discutido,
      nota: dto.nota ?? atual.nota,
    };
    await this.db.estrategicoReuniao.update({ where: { id }, data: { anotacoes } });
    return anotacoes[dto.casoId];
  }

  async decidir(user: Usuario, id: string, dto: DecisaoDto, ip?: string) {
    const r = await this.exigir(user, id);
    this.exigirAberta(r);
    const descricao = dto.descricao.trim();
    if (!descricao) throw new BadRequestException("Descreva a decisão.");
    const caso = dto.casoId ? await this.casos.exigir(user, dto.casoId) : null;

    const decisao = await this.db.estrategicoDecisao.create({
      data: {
        organizationId: user.organizationId, reuniaoId: id, casoId: caso?.id ?? null,
        descricao, decididoEm: new Date(), registradoPorId: user.id,
      },
      include: { caso: { select: { id: true, codigo: true, titulo: true } } },
    });
    if (caso) {
      const hoje = hojeData();
      await this.db.estrategicoEvento.create({
        data: {
          organizationId: user.organizationId, casoId: caso.id, tipo: "decisao", dataEvento: hoje,
          titulo: `Decisão na reunião "${r.titulo}"`, descricao, decisao: descricao,
          autorId: user.id, origem: "reuniao", reuniaoId: id,
        },
      });
      if (!caso.ultimaMovimentacaoEm || new Date(caso.ultimaMovimentacaoEm) < hoje) {
        await this.db.estrategicoCaso.update({ where: { id: caso.id }, data: { ultimaMovimentacaoEm: hoje } });
      }
      await this.repo.historico(user.organizationId, caso.id, {
        userId: user.id, acao: "decidiu", origem: "reuniao", ip, descricao: `Decisão registrada em reunião: ${descricao.slice(0, 300)}`,
      });
      await this.casos.recalcularFarol(user.organizationId, caso.id);
    }
    return decisao;
  }

  async criarTarefa(user: Usuario, id: string, dto: TarefaReuniaoDto, ip?: string) {
    const r = await this.exigir(user, id);
    this.exigirAberta(r);
    const { casoId, ...tarefa } = dto;
    return this.atividade.criarTarefa(user, casoId, tarefa, { origem: "reuniao", reuniaoId: id }, ip);
  }

  async mudarStatus(user: Usuario, id: string, status: string, ip?: string) {
    const r = await this.exigir(user, id);
    if (r.status === "encerrada") throw new BadRequestException("Reunião já encerrada.");
    if (status === "em_andamento") {
      await this.db.estrategicoReuniao.update({ where: { id }, data: { status, iniciadaEm: r.iniciadaEm ?? new Date() } });
    } else if (status === "cancelada") {
      await this.db.estrategicoReuniao.update({ where: { id }, data: { status } });
    } else if (status === "encerrada") {
      const completa = await this.obter(user, id);
      const encerradaEm = new Date();
      const ata = this.montarAta({ ...completa, encerradaEm });
      await this.db.estrategicoReuniao.update({ where: { id }, data: { status, encerradaEm, ata } });

      // Distribui as ações: cada responsável recebe as tarefas que lhe couberam.
      const config = await this.repo.config(user.organizationId);
      for (const t of completa.tarefas as any[]) {
        if (!t.responsavelId) continue;
        await this.aviso.avisar({
          organizationId: user.organizationId, userId: t.responsavelId, tipo: "estrategico_acao_reuniao",
          casoId: t.casoId, tarefaId: t.id, reuniaoId: id,
          titulo: `Ação definida na reunião "${r.titulo}"`,
          mensagem: `${t.caso.codigo}: ${t.titulo}${t.prazo ? ` — até ${dataBr(t.prazo)}` : ""}`,
          chave: `reuniao-acao:${id}:${t.id}`,
        }, config);
      }
    }
    await this.audit.log({
      organizationId: user.organizationId, userId: user.id, modulo: "estrategico", tabela: "estrategico_reunioes",
      registroId: id, acao: `status_${status}`, descricao: r.titulo, ip,
    });
    return this.obter(user, id);
  }

  montarAta(r: any): string {
    const L: string[] = [];
    const anot = (r.anotacoes ?? {}) as Record<string, { discutido?: boolean; nota?: string }>;
    L.push(`ATA — ${r.titulo}`);
    L.push(`Data: ${dataHora(r.dataReuniao)}${r.local ? ` · Local: ${r.local}` : ""}`);
    const participantes = ((r.participantes ?? []) as any[]).map(p => p.nome).filter(Boolean);
    L.push(`Participantes: ${participantes.length ? participantes.join(", ") : "não informados"}`);
    if (r.referenciaDesde) L.push(`Período de referência: alterações desde ${dataBr(r.referenciaDesde)}`);
    L.push("");

    L.push("1. PAUTA");
    for (const s of (r.pauta ?? []) as SecaoPauta[]) {
      L.push(`   ${s.titulo} (${s.itens.length})`);
      if (!s.itens.length) L.push("     — nada neste tópico");
      for (const i of s.itens) {
        const a = anot[i.casoId];
        L.push(`     • ${i.codigo} — ${i.titulo} [${ROTULO_FAROL[i.farol as keyof typeof ROTULO_FAROL] ?? "—"}] — ${i.motivo}${a?.discutido ? " ✓ discutido" : ""}`);
        if (a?.nota?.trim()) L.push(`       Nota: ${a.nota.trim()}`);
      }
    }
    L.push("");

    L.push("2. DECISÕES");
    if (!r.decisoes?.length) L.push("   — nenhuma decisão registrada");
    for (const d of r.decisoes ?? []) {
      L.push(`   • ${d.caso ? `[${d.caso.codigo}] ` : ""}${d.descricao}`);
    }
    L.push("");

    L.push("3. AÇÕES DEFINIDAS");
    if (!r.tarefas?.length) L.push("   — nenhuma ação registrada");
    for (const t of r.tarefas ?? []) {
      L.push(`   • [${t.caso.codigo}] ${t.titulo} — ${t.responsavel?.nome ?? "sem responsável"} — ${t.prazo ? `até ${dataBr(t.prazo)}` : "sem prazo"}`);
    }
    L.push("");
    L.push(`Ata gerada automaticamente pelo ${MARCA} Strategy em ${dataHora(r.encerradaEm ?? new Date())}.`);
    return L.join("\n");
  }

  async ataPdf(user: Usuario, id: string): Promise<{ conteudo: Buffer; nome: string }> {
    const r = await this.obter(user, id);
    const texto = r.ata ?? this.montarAta(r);
    const PDFDocument = require("pdfkit");
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const pedacos: Buffer[] = [];
    const conteudo = await new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (c: Buffer) => pedacos.push(c));
      doc.on("end", () => resolve(Buffer.concat(pedacos)));
      doc.on("error", reject);
      const [primeira, ...resto] = texto.split("\n");
      doc.font("Helvetica-Bold").fontSize(15).fillColor("#111827").text(primeira);
      doc.moveDown(0.5);
      for (const linha of resto) {
        const titulo = /^\d\. /.test(linha);
        doc.font(titulo ? "Helvetica-Bold" : "Helvetica").fontSize(titulo ? 11 : 9.5).fillColor(titulo ? "#111827" : "#374151")
          .text(linha.replace("✓", "(discutido)").replace(" (discutido) discutido", " (discutido)"), { lineGap: 2 });
        if (titulo) doc.moveDown(0.2);
      }
      doc.end();
    });
    return { conteudo, nome: `ata-reuniao-estrategica-${new Date(r.dataReuniao).toISOString().slice(0, 10)}.pdf` };
  }
}
