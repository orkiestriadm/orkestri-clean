import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { CasoService } from "./caso.service";
import { CasoApresentado, ORDEM_FAROL } from "./presenter";
import { Usuario, verFinanceiro, hojeData } from "./contexto";
import { FAROIS, ROTULO_FAROL } from "../domain/farol.entity";
import { ETAPAS, FAIXAS_AGING, PIPELINE_OPORTUNIDADE, TAREFA_ABERTA, CAMPOS_VALOR } from "../domain/caso.entity";

type Filtros = { grupoId?: string; objetivoId?: string; esferaId?: string; areaId?: string; tipo?: string };

const COR_FAROL: Record<string, string> = {
  vermelho: "var(--accent-red)", amarelo: "var(--accent-amber)", azul: "var(--accent-cyan)",
  verde: "var(--accent-green)", cinza: "var(--text-muted)",
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * Painel executivo e da Diretoria.
 *
 * Toda métrica sai dos dados reais da carteira — o prompt é explícito, e o
 * painel de faturamento com R$ 19k fictício já ensinou o custo de misturar.
 * Sem permissão financeira, o bloco de valores volta `null` e a tela diz
 * "restrito", não "R$ 0,00".
 */
@Injectable()
export class PainelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly casos: CasoService,
  ) {}

  private get db(): any {
    return this.prisma as any;
  }

  async painel(user: Usuario, filtros: Filtros = {}) {
    const orgId = user.organizationId;
    const fin = verFinanceiro(user);
    const { itens: todos, config } = await this.casos.carteiraApresentada(user);
    const itens = this.casos.filtrar(todos, filtros as any, config);
    const ids = itens.map(c => c.id);
    const ativos = itens.filter(c => c.ativo);
    const naoCancelados = itens.filter(c => c.etapa !== "cancelado");
    const hoje = hojeData();

    const kpis = {
      total: itens.length,
      emAndamento: ativos.length,
      emAtencao: ativos.filter(c => c.farol === "amarelo").length,
      criticos: itens.filter(c => c.farol === "vermelho").length,
      suspensos: itens.filter(c => c.natureza === "suspensa").length,
      encerrados: itens.filter(c => c.natureza === "encerrada").length,
      oportunidades: ativos.filter(c => c.tipo === "oportunidade").length,
      semProximaAcao: ativos.filter(c => c.semProximaAcao).length,
      vencidos: ativos.filter(c => c.vencido).length,
      parados30: ativos.filter(c => (c.diasParado ?? -1) > 30).length,
      parados60: ativos.filter(c => (c.diasParado ?? -1) > 60).length,
      parados90: ativos.filter(c => (c.diasParado ?? -1) > 90).length,
      semMovimentacao: ativos.filter(c => c.diasParado == null).length,
      semResponsavel: ativos.filter(c => !c.responsavelExecutivo && !c.responsavelOperacional && !c.proximaAcaoResponsavel).length,
      revisar: itens.filter(c => c.revisarImportacao).length,
      riscoAltoOuCritico: ativos.filter(c => c.riscoNivel === "alto" || c.riscoNivel === "critico").length,
      semAvaliacaoRisco: ativos.filter(c => !c.riscoNivel).length,
    };

    const somar = (campo: string) => naoCancelados.reduce((s, c: any) => s + (c[campo] ?? 0), 0);
    const valores: (Record<string, number> & { casosComValor: number; casosSemValor: number }) | null = fin
      ? Object.assign(Object.fromEntries(CAMPOS_VALOR.map(v => [v.campo, somar(v.campo)])) as Record<string, number>, {
        casosComValor: naoCancelados.filter(c => c.temValor).length,
        casosSemValor: naoCancelados.filter(c => !c.temValor).length,
      })
      : null;

    const agrupar = (lista: CasoApresentado[], chave: (c: CasoApresentado) => { id: string; rotulo: string } | null, semRotulo: string) => {
      const mapa = new Map<string, { id: string; rotulo: string; valor: number; criticos: number; casos: string[] }>();
      for (const c of lista) {
        const k = chave(c) ?? { id: "sem", rotulo: semRotulo };
        const g = mapa.get(k.id) ?? { id: k.id, rotulo: k.rotulo, valor: 0, criticos: 0, casos: [] };
        g.valor++;
        if (c.farol === "vermelho") g.criticos++;
        g.casos.push(c.id);
        mapa.set(k.id, g);
      }
      return [...mapa.values()].sort((a, b) => b.valor - a.valor);
    };
    const somarPor = (lista: CasoApresentado[], chave: (c: CasoApresentado) => { id: string; rotulo: string } | null, semRotulo: string) => {
      const mapa = new Map<string, { id: string; rotulo: string; valor: number }>();
      for (const c of lista) {
        if (!c.valorPrincipal) continue;
        const k = chave(c) ?? { id: "sem", rotulo: semRotulo };
        const g = mapa.get(k.id) ?? { id: k.id, rotulo: k.rotulo, valor: 0 };
        g.valor += c.valorPrincipal;
        mapa.set(k.id, g);
      }
      return [...mapa.values()].sort((a, b) => b.valor - a.valor);
    };
    const ref = (x: any) => (x ? { id: x.id, rotulo: x.nome } : null);
    const donoPessoa = (c: CasoApresentado) => {
      const p = c.proximaAcaoResponsavel ?? c.responsavelOperacional ?? c.responsavelExecutivo;
      return p ? { id: p.id, rotulo: p.nome } : null;
    };

    const graficos = {
      porObjetivo: agrupar(itens, c => ref(c.objetivo), "Sem objetivo"),
      porEsfera: agrupar(itens, c => ref(c.esfera), "Sem esfera"),
      porGrupo: agrupar(itens, c => ref(c.grupo), "Sem grupo"),
      porEtapa: ETAPAS.map(e => ({
        id: e.id, rotulo: e.rotulo, natureza: e.natureza,
        valor: itens.filter(c => c.etapa === e.id).length,
        casos: itens.filter(c => c.etapa === e.id).map(c => c.id),
      })).filter(e => e.valor > 0),
      porFarol: FAROIS.map(f => ({ id: f, rotulo: ROTULO_FAROL[f], cor: COR_FAROL[f], valor: itens.filter(c => c.farol === f).length })),
      porArea: agrupar(itens, c => ref(c.areaOperacional), "Sem área"),
      porResponsavel: agrupar(ativos, donoPessoa, "Sem responsável nomeado"),
      porDependencia: (() => {
        const mapa = new Map<string, { id: string; rotulo: string; valor: number; casos: string[] }>();
        for (const c of ativos) for (const d of c.dependencias) {
          const k = d.catalogoId ?? `livre:${d.nome}`;
          const g = mapa.get(k) ?? { id: k, rotulo: d.nome, valor: 0, casos: [] };
          g.valor++; g.casos.push(c.id); mapa.set(k, g);
        }
        return [...mapa.values()].sort((a, b) => b.valor - a.valor);
      })(),
      aging: FAIXAS_AGING.map(f => ({ id: f.id, rotulo: f.rotulo, valor: ativos.filter(c => c.faixaAging === f.id).length })),
      valorPorAssunto: fin
        ? naoCancelados.filter(c => (c.valorPrincipal ?? 0) > 0).sort((a, b) => (b.valorPrincipal ?? 0) - (a.valorPrincipal ?? 0))
          .slice(0, 10).map(c => ({ id: c.id, rotulo: `${c.codigo} · ${c.titulo}`, valor: c.valorPrincipal }))
        : null,
      valorPorObjetivo: fin ? somarPor(naoCancelados, c => ref(c.objetivo), "Sem objetivo") : null,
      valorPorFarol: fin ? somarPor(naoCancelados, c => ({ id: c.farol, rotulo: ROTULO_FAROL[c.farol] }), "—") : null,
    };

    const oportunidades = itens.filter(c => c.tipo === "oportunidade" && c.etapa !== "cancelado");
    const pipeline = PIPELINE_OPORTUNIDADE.map(e => {
      const casos = oportunidades.filter(c => (c.estagioOportunidade ?? "identificada") === e.id);
      return {
        id: e.id, rotulo: e.rotulo, quantidade: casos.length,
        potencial: fin ? casos.reduce((s, c: any) => s + (c.valorPotencial ?? c.valorPretendido ?? 0), 0) : null,
        casos: casos.map(c => ({ id: c.id, codigo: c.codigo, titulo: c.titulo, farol: c.farol })),
      };
    });

    const matriz: { probabilidade: number; impacto: number; quantidade: number; casos: { id: string; codigo: string; titulo: string }[] }[] = [];
    for (let p = 5; p >= 1; p--) {
      for (let i = 1; i <= 5; i++) {
        const casos = ativos.filter(c => c.probabilidade === p && c.impacto === i);
        matriz.push({ probabilidade: p, impacto: i, quantidade: casos.length, casos: casos.map(c => ({ id: c.id, codigo: c.codigo, titulo: c.titulo })) });
      }
    }

    const [evolucaoMensal, quemPrecisaAgir, oQueMudou] = await Promise.all([
      this.evolucao(orgId, ids, fin),
      this.quemPrecisaAgir(orgId, ativos, hoje),
      this.oQueMudou(orgId, itens, fin),
    ]);

    const resumo = (c: CasoApresentado) => ({
      id: c.id, codigo: c.codigo, titulo: c.titulo, farol: c.farol, etapaRotulo: c.etapaRotulo,
      statusTexto: c.statusTexto, proximaAcao: c.proximaAcao, proximaAcaoPrazo: c.proximaAcaoPrazo,
      diasProximaAcao: c.diasProximaAcao, diasParado: c.diasParado, ultimaMovimentacaoEm: c.ultimaMovimentacaoEm,
      riscoNivel: c.riscoNivel, riscoScore: c.riscoScore, valorPrincipal: c.valorPrincipal,
      motivo: c.farolMotivos[0]?.texto ?? null,
      responsavel: c.proximaAcaoResponsavel?.nome ?? c.proximaAcaoResponsavelNome ?? c.responsavelOperacional?.nome ?? c.areaOperacional?.nome ?? null,
    });

    return {
      geradoEm: new Date(),
      financeiroVisivel: fin,
      kpis,
      valores,
      graficos,
      pipeline,
      matrizRisco: matriz,
      evolucaoMensal,
      quemPrecisaAgir,
      oQueMudou,
      oQueImporta: ativos
        .sort((a, b) => (ORDEM_FAROL[a.farol] - ORDEM_FAROL[b.farol]) || ((b.riscoScore ?? 0) - (a.riscoScore ?? 0)) || ((b.valorPrincipal ?? 0) - (a.valorPrincipal ?? 0)))
        .slice(0, 10).map(resumo),
      oQueEstaParado: ativos.filter(c => c.diasParado != null).sort((a, b) => (b.diasParado ?? 0) - (a.diasParado ?? 0)).slice(0, 10).map(resumo),
      semMovimentacao: ativos.filter(c => c.diasParado == null).map(resumo),
      vencidos: ativos.filter(c => c.vencido).map(resumo),
      semProximaAcao: ativos.filter(c => c.semProximaAcao).map(resumo),
      parametros: { diasAtencaoSemMovimento: config.diasAtencaoSemMovimento, diasCriticoSemMovimento: config.diasCriticoSemMovimento },
    };
  }

  /** Últimos 12 meses: andamentos, decisões, encerramentos e (com permissão) valor reconhecido/alcançado. */
  private async evolucao(orgId: string, casoIds: string[], fin: boolean) {
    const agora = new Date();
    const inicio = new Date(Date.UTC(agora.getFullYear(), agora.getMonth() - 11, 1));
    const chaveMes = (d: Date | string) => new Date(d).toISOString().slice(0, 7);
    const meses = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + i, 1));
      return { mes: d.toISOString().slice(0, 7), rotulo: `${MESES[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`, andamentos: 0, decisoes: 0, encerrados: 0, novos: 0, valorReconhecido: fin ? 0 : null as number | null };
    });
    const porMes = new Map(meses.map(m => [m.mes, m]));
    if (!casoIds.length) return meses;

    const [eventos, decisoes, encerrados, novos, valores] = await Promise.all([
      this.db.estrategicoEvento.findMany({
        where: { organizationId: orgId, casoId: { in: casoIds }, deletedAt: null, dataEvento: { gte: inicio }, origem: { not: "sistema" } },
        select: { dataEvento: true },
      }),
      this.db.estrategicoDecisao.findMany({
        where: {
          organizationId: orgId, decididoEm: { gte: inicio },
          AND: [
            { OR: [{ casoId: { in: casoIds } }, { casoId: null }] },
            // Decisão de reunião excluída não conta — a de assunto, sim (ela
            // está na timeline do assunto, aconteceu de fato).
            { OR: [{ reuniaoId: null }, { casoId: { not: null } }, { reuniao: { deletedAt: null } }] },
          ],
        },
        select: { decididoEm: true },
      }),
      this.db.estrategicoCaso.findMany({
        where: { organizationId: orgId, id: { in: casoIds }, encerradoEm: { gte: inicio } }, select: { encerradoEm: true },
      }),
      this.db.estrategicoCaso.findMany({
        where: { organizationId: orgId, id: { in: casoIds }, criadoEm: { gte: inicio }, importacaoChave: null }, select: { criadoEm: true },
      }),
      fin
        ? this.db.estrategicoValorHistorico.findMany({
          where: { organizationId: orgId, casoId: { in: casoIds }, criadoEm: { gte: inicio }, campo: { in: ["valorReconhecido", "valorAlcancado"] } },
          select: { criadoEm: true, valorAnterior: true, valorNovo: true, referenciaEm: true },
        })
        : Promise.resolve([]),
    ]);
    for (const e of eventos) { const m = porMes.get(chaveMes(e.dataEvento)); if (m) m.andamentos++; }
    for (const d of decisoes) { const m = porMes.get(chaveMes(d.decididoEm)); if (m) m.decisoes++; }
    for (const c of encerrados) { const m = porMes.get(chaveMes(c.encerradoEm)); if (m) m.encerrados++; }
    for (const c of novos) { const m = porMes.get(chaveMes(c.criadoEm)); if (m) m.novos++; }
    for (const v of valores as any[]) {
      const m = porMes.get(chaveMes(v.referenciaEm ?? v.criadoEm));
      if (m && m.valorReconhecido != null) m.valorReconhecido += Number(v.valorNovo ?? 0) - Number(v.valorAnterior ?? 0);
    }
    return meses;
  }

  /**
   * "Quem precisa agir?" — agrupado pela pessoa que responde pela próxima ação.
   * Sem pessoa, cai para o responsável operacional, depois para a área; o que
   * não tem nada disso aparece como "Sem responsável" — é pendência também.
   */
  private async quemPrecisaAgir(orgId: string, ativos: CasoApresentado[], hoje: Date) {
    type Linha = { chave: string; nome: string; tipo: string; assuntos: number; acoesVencidas: number; semAcao: number; criticos: number; tarefasAbertas: number; tarefasVencidas: number };
    const mapa = new Map<string, Linha>();
    const linha = (chave: string, nome: string, tipo: string) => {
      if (!mapa.has(chave)) mapa.set(chave, { chave, nome, tipo, assuntos: 0, acoesVencidas: 0, semAcao: 0, criticos: 0, tarefasAbertas: 0, tarefasVencidas: 0 });
      return mapa.get(chave)!;
    };
    for (const c of ativos) {
      const l = c.proximaAcaoResponsavel ? linha(`u:${c.proximaAcaoResponsavel.id}`, c.proximaAcaoResponsavel.nome, "usuario")
        : c.proximaAcaoResponsavelNome ? linha(`n:${c.proximaAcaoResponsavelNome}`, c.proximaAcaoResponsavelNome, "externo")
          : c.responsavelOperacional ? linha(`u:${c.responsavelOperacional.id}`, c.responsavelOperacional.nome, "usuario")
            : c.areaOperacional ? linha(`a:${c.areaOperacional.id}`, c.areaOperacional.nome, "area")
              : linha("ninguem", "Sem responsável", "nenhum");
      l.assuntos++;
      if (c.acaoVencida) l.acoesVencidas++;
      if (c.semProximaAcao) l.semAcao++;
      if (c.farol === "vermelho") l.criticos++;
    }
    const ids = ativos.map(c => c.id);
    if (ids.length) {
      const tarefas = await this.db.estrategicoTarefa.findMany({
        where: { organizationId: orgId, casoId: { in: ids }, deletedAt: null, status: { in: TAREFA_ABERTA } },
        select: { prazo: true, responsavel: { select: { id: true, nome: true } } },
      });
      for (const t of tarefas) {
        const l = t.responsavel ? linha(`u:${t.responsavel.id}`, t.responsavel.nome, "usuario") : linha("ninguem", "Sem responsável", "nenhum");
        l.tarefasAbertas++;
        if (t.prazo && new Date(t.prazo) < hoje) l.tarefasVencidas++;
      }
    }
    return [...mapa.values()].sort((a, b) =>
      (b.acoesVencidas + b.tarefasVencidas) - (a.acoesVencidas + a.tarefasVencidas) || b.semAcao - a.semAcao || b.assuntos - a.assuntos);
  }

  /** "O que mudou?" — desde a última reunião encerrada (ou 30 dias). */
  private async oQueMudou(orgId: string, itens: CasoApresentado[], fin: boolean) {
    const ultima = await this.db.estrategicoReuniao.findFirst({
      where: { organizationId: orgId, status: "encerrada", deletedAt: null },
      orderBy: { encerradaEm: "desc" },
      select: { id: true, titulo: true, encerradaEm: true, dataReuniao: true },
    });
    const desde = ultima?.encerradaEm ?? new Date(Date.now() - 30 * 86_400_000);
    const porId = new Map(itens.map(c => [c.id, c]));
    const linhas = await this.db.estrategicoHistorico.findMany({
      where: { organizationId: orgId, criadoEm: { gte: desde }, casoId: { in: [...porId.keys()] } },
      include: { user: { select: { nome: true } } },
      orderBy: { criadoEm: "desc" },
      take: 500,
    });
    const grupos = new Map<string, { caso: any; alteracoes: number; ultimas: any[] }>();
    for (const l of linhas) {
      const c = porId.get(l.casoId);
      if (!c) continue;
      const g = grupos.get(l.casoId) ?? { caso: { id: c.id, codigo: c.codigo, titulo: c.titulo, farol: c.farol }, alteracoes: 0, ultimas: [] };
      g.alteracoes++;
      if (g.ultimas.length < 4) {
        const oculto = !fin && l.acao === "mudou_valor";
        g.ultimas.push({
          acao: l.acao, campo: l.campo, descricao: l.descricao, origem: l.origem, criadoEm: l.criadoEm, usuario: l.user?.nome ?? null,
          valorAnterior: oculto ? null : l.valorAnterior, valorNovo: oculto ? null : l.valorNovo,
        });
      }
      grupos.set(l.casoId, g);
    }
    return {
      desde,
      referencia: ultima ? { tipo: "reuniao", id: ultima.id, titulo: ultima.titulo, data: ultima.dataReuniao } : { tipo: "30_dias" },
      novos: itens.filter(c => new Date(c.criadoEm) >= desde).map(c => ({ id: c.id, codigo: c.codigo, titulo: c.titulo, tipo: c.tipo })),
      farolMudou: linhas.filter((l: any) => l.acao === "farol_calculado" || l.acao === "farol_manual").length,
      casos: [...grupos.values()].sort((a, b) => b.alteracoes - a.alteracoes).slice(0, 20),
    };
  }
}
