import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.module";
import { CasoRepository } from "../infrastructure/caso.repository";
import { apresentarCaso, ordenarPorGravidade, CasoApresentado, ORDEM_FAROL } from "./presenter";
import {
  Usuario, paraData, hojeData, isoDia, dataBr, moedaBr, parametrosDe, podeEditarCaso, verFinanceiro,
} from "./contexto";
import { tem, ESTRATEGICO_PERMISSIONS as P } from "../estrategico.permissions";
import { ROTULO_FAROL, FAROIS } from "../domain/farol.entity";
import {
  etapaDe, naturezaDe, CAMPOS_VALOR, CAMPO_VALOR_IDS, DIMENSOES_RISCO, ETAPAS, PIPELINE_OPORTUNIDADE,
  PRIORIDADES, ROTULO_PRIORIDADE, TIPOS_EVENTO, CATEGORIAS_DOCUMENTO, CLASSIFICACOES_FINANCEIRAS,
  FAIXAS_AGING, chaveNormalizada,
} from "../domain/caso.entity";
import { AtualizarCasoDto, CriarCasoDto, FarolManualDto, ListarCasosQuery } from "./dto/estrategico.dto";

const ROTULOS: Record<string, string> = {
  titulo: "Título", descricao: "Descrição", tipo: "Tipo",
  grupoId: "Grupo", objetivoId: "Objetivo", esferaId: "Esfera",
  etapa: "Etapa", estagioOportunidade: "Estágio da oportunidade", prioridade: "Prioridade",
  areaExecutivaId: "Área executiva", areaOperacionalId: "Área operacional",
  responsavelExecutivoId: "Responsável executivo", responsavelOperacionalId: "Responsável operacional",
  proximaAcao: "Próxima ação", proximaAcaoResponsavelId: "Responsável pela próxima ação",
  proximaAcaoResponsavelNome: "Responsável pela próxima ação (sem login)",
  proximaAcaoPrazo: "Prazo da próxima ação", proximaAcaoPrioridade: "Prioridade da próxima ação",
  prazoFinal: "Prazo final",
  classificacaoFinanceira: "Classificação financeira", valoresReferenciaEm: "Data de referência dos valores",
  probabilidade: "Probabilidade", impacto: "Impacto",
  riscoFinanceiro: "Risco financeiro", riscoJuridico: "Risco jurídico", riscoRegulatorio: "Risco regulatório",
  riscoOperacional: "Risco operacional", riscoPrazo: "Risco de prazo", planoMitigacao: "Plano de mitigação",
  revisarImportacao: "Revisão da importação",
  ...Object.fromEntries(CAMPOS_VALOR.map(c => [c.campo, `Valor ${c.rotulo.toLowerCase()}`])),
};

const EDITAVEIS = Object.keys(ROTULOS);
const CATALOGO_DO_CAMPO: Record<string, string> = {
  grupoId: "grupo", objetivoId: "objetivo", esferaId: "esfera", areaExecutivaId: "area", areaOperacionalId: "area",
};
const USUARIO_CAMPOS = ["responsavelExecutivoId", "responsavelOperacionalId", "proximaAcaoResponsavelId"];
const DATA_CAMPOS = ["proximaAcaoPrazo", "prazoFinal", "valoresReferenciaEm"];
const RISCO_CAMPOS = ["probabilidade", "impacto", ...DIMENSOES_RISCO.map(d => d.campo), "planoMitigacao"];
const FINANCEIRO_CAMPOS = [...CAMPO_VALOR_IDS, "classificacaoFinanceira", "valoresReferenciaEm"];

function acaoDoCampo(campo: string): string {
  if (campo === "etapa" || campo === "estagioOportunidade") return "mudou_etapa";
  if (USUARIO_CAMPOS.includes(campo) || campo === "areaExecutivaId" || campo === "areaOperacionalId") return "mudou_responsavel";
  if (CAMPO_VALOR_IDS.includes(campo)) return "mudou_valor";
  if (campo === "proximaAcaoPrazo" || campo === "prazoFinal") return "mudou_prazo";
  if (RISCO_CAMPOS.includes(campo)) return "mudou_risco";
  return "editou";
}

type Cache = { catalogo: Map<string, any>; usuarios: Map<string, any> };

const normalizarBusca = (s: string) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Casos de uso do assunto estratégico.
 *
 * Invariante que atravessa o arquivo: TODA escrita que muda o caso escreve no
 * histórico campo a campo, e toda mudança de valor escreve também no histórico
 * financeiro. É a resposta a "quem mudou isso e quando", que a planilha não
 * tinha como dar.
 */
@Injectable()
export class CasoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: CasoRepository,
    private readonly audit: AuditService,
  ) {}

  private get db(): any {
    return this.prisma as any;
  }

  /* ── Leitura ───────────────────────────────────────────────────────────── */

  async carteiraApresentada(user: Usuario): Promise<{ itens: CasoApresentado[]; config: any }> {
    const [casos, config] = await Promise.all([
      this.repo.carteira(user.organizationId),
      this.repo.config(user.organizationId),
    ]);
    const ctx = { hoje: new Date(), parametros: parametrosDe(config), verFinanceiro: verFinanceiro(user) };
    return { itens: casos.map((c: any) => apresentarCaso(c, ctx)), config };
  }

  async listar(user: Usuario, q: ListarCasosQuery) {
    const { itens, config } = await this.carteiraApresentada(user);
    // As contagens dos chips ignoram o próprio chip (farol/recorte), senão
    // clicar em "Vermelho" zeraria o número de "Amarelo" ao lado.
    const base = this.filtrar(itens, { ...q, farol: undefined, recorte: undefined }, config);
    const filtrados = this.filtrar(itens, q, config);
    return {
      itens: this.ordenar(filtrados, q.ordenar),
      total: filtrados.length,
      contagens: this.contar(base, config),
    };
  }

  filtrar(itens: CasoApresentado[], q: Partial<ListarCasosQuery>, config?: any): CasoApresentado[] {
    const texto = q.q ? normalizarBusca(q.q.trim()) : null;
    const diasParado = config?.diasAtencaoSemMovimento ?? 30;
    const lista = (v?: string) => (v ? v.split(",").filter(Boolean) : null);
    const farois = lista(q.farol);
    const etapas = lista(q.etapa);

    return itens.filter(c => {
      if (texto) {
        const alvo = normalizarBusca([c.codigo, c.titulo, c.descricao, c.statusOriginal, c.proximaAcao, c.objetivo?.nome, c.grupo?.nome].join(" "));
        if (!alvo.includes(texto)) return false;
      }
      if (farois && !farois.includes(c.farol)) return false;
      if (etapas && !etapas.includes(c.etapa)) return false;
      if (q.tipo && c.tipo !== q.tipo) return false;
      if (q.objetivoId && c.objetivo?.id !== q.objetivoId) return false;
      if (q.esferaId && c.esfera?.id !== q.esferaId) return false;
      if (q.grupoId && c.grupo?.id !== q.grupoId) return false;
      if (q.prioridade && c.prioridade !== q.prioridade) return false;
      if (q.areaId && ![c.areaExecutiva?.id, c.areaOperacional?.id, ...c.areasApoio.map((a: any) => a.id)].includes(q.areaId)) return false;
      if (q.dependenciaId && !c.dependencias.some((d: any) => d.catalogoId === q.dependenciaId)) return false;
      if (q.responsavelId && ![c.responsavelExecutivo?.id, c.responsavelOperacional?.id, c.proximaAcaoResponsavel?.id].includes(q.responsavelId)) return false;
      if (q.paradoDias && !(c.ativo && c.diasParado != null && c.diasParado >= q.paradoDias)) return false;

      switch (q.recorte) {
        case "ativos": return c.ativo;
        case "encerrados": return c.natureza === "encerrada";
        case "suspensos": return c.natureza === "suspensa";
        case "sem_acao": return c.semProximaAcao;
        case "vencidos": return c.vencido;
        case "parados": return c.ativo && c.diasParado != null && c.diasParado >= diasParado;
        case "sem_movimentacao": return c.ativo && c.diasParado == null;
        case "revisar": return c.revisarImportacao;
        case "risco_alto": return c.riscoNivel === "alto" || c.riscoNivel === "critico";
        case "oportunidades": return c.tipo === "oportunidade" && c.etapa !== "cancelado";
        case "sem_responsavel": return c.ativo && !c.responsavelExecutivo && !c.responsavelOperacional && !c.proximaAcaoResponsavel;
        default: return true;
      }
    });
  }

  private ordenar(itens: CasoApresentado[], ordem?: string): CasoApresentado[] {
    const copia = [...itens];
    const nuloNoFim = (a: number | null, b: number | null, dir = 1) =>
      a == null && b == null ? 0 : a == null ? 1 : b == null ? -1 : (a - b) * dir;
    switch (ordem) {
      case "prazo": return copia.sort((a, b) => nuloNoFim(a.diasProximaAcao, b.diasProximaAcao) || a.codigo.localeCompare(b.codigo));
      case "parado": return copia.sort((a, b) => nuloNoFim(a.diasParado, b.diasParado, -1) || a.codigo.localeCompare(b.codigo));
      case "valor": return copia.sort((a, b) => (b.valorPrincipal ?? 0) - (a.valorPrincipal ?? 0) || a.codigo.localeCompare(b.codigo));
      case "codigo": return copia.sort((a, b) => a.codigo.localeCompare(b.codigo));
      case "titulo": return copia.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
      case "atualizado": return copia.sort((a, b) => new Date(b.atualizadoEm).getTime() - new Date(a.atualizadoEm).getTime());
      default: return copia.sort(ordenarPorGravidade);
    }
  }

  private contar(itens: CasoApresentado[], config: any) {
    const porFarol: Record<string, number> = Object.fromEntries(FAROIS.map(f => [f, 0]));
    for (const c of itens) porFarol[c.farol] = (porFarol[c.farol] ?? 0) + 1;
    const diasParado = config?.diasAtencaoSemMovimento ?? 30;
    return {
      total: itens.length,
      porFarol,
      ativos: itens.filter(c => c.ativo).length,
      semAcao: itens.filter(c => c.semProximaAcao).length,
      vencidos: itens.filter(c => c.vencido).length,
      parados: itens.filter(c => c.ativo && c.diasParado != null && c.diasParado >= diasParado).length,
      semMovimentacao: itens.filter(c => c.ativo && c.diasParado == null).length,
      revisar: itens.filter(c => c.revisarImportacao).length,
      suspensos: itens.filter(c => c.natureza === "suspensa").length,
      oportunidades: itens.filter(c => c.tipo === "oportunidade" && c.etapa !== "cancelado").length,
      riscoAlto: itens.filter(c => c.riscoNivel === "alto" || c.riscoNivel === "critico").length,
      semResponsavel: itens.filter(c => c.ativo && !c.responsavelExecutivo && !c.responsavelOperacional && !c.proximaAcaoResponsavel).length,
    };
  }

  async obter(user: Usuario, id: string) {
    const c = await this.repo.obter(user.organizationId, id);
    if (!c) throw new NotFoundException("Assunto não encontrado");
    const config = await this.repo.config(user.organizationId);
    const fin = verFinanceiro(user);
    const ap = apresentarCaso(c, { hoje: new Date(), parametros: parametrosDe(config), verFinanceiro: fin });
    const dados: any = c.importacaoDados ?? null;
    return {
      ...ap,
      podeEditar: podeEditarCaso(user, c),
      andamentosOriginais: c.andamentosOriginais ?? null,
      importacao: dados ? { ...dados, valoresCitados: fin ? dados.valoresCitados ?? [] : [] } : null,
    };
  }

  async exigir(user: Usuario, id: string) {
    const c = await this.db.estrategicoCaso.findFirst({ where: { id, organizationId: user.organizationId, deletedAt: null } });
    if (!c) throw new NotFoundException("Assunto não encontrado");
    return c;
  }

  async historico(user: Usuario, id: string) {
    await this.exigir(user, id);
    const linhas = await this.db.estrategicoHistorico.findMany({
      where: { casoId: id, organizationId: user.organizationId },
      include: { user: { select: { id: true, nome: true } } },
      orderBy: { criadoEm: "desc" },
      take: 1000,
    });
    // Sem permissão financeira, a trilha continua mostrando QUE o valor mudou,
    // mas não os números.
    if (verFinanceiro(user)) return linhas;
    return linhas.map((l: any) => (l.acao === "mudou_valor" ? { ...l, valorAnterior: null, valorNovo: null } : l));
  }

  async valores(user: Usuario, id: string) {
    await this.exigir(user, id);
    const linhas = await this.db.estrategicoValorHistorico.findMany({
      where: { casoId: id, organizationId: user.organizationId },
      orderBy: { criadoEm: "asc" },
    });
    const ids = [...new Set(linhas.map((l: any) => l.userId).filter(Boolean))];
    const usuarios = ids.length
      ? await this.db.user.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } })
      : [];
    const nomes = new Map(usuarios.map((u: any) => [u.id, u.nome]));
    return linhas.map((l: any) => ({
      ...l,
      rotulo: CAMPOS_VALOR.find(c => c.campo === l.campo)?.rotulo ?? l.campo,
      valorAnterior: l.valorAnterior == null ? null : Number(l.valorAnterior),
      valorNovo: l.valorNovo == null ? null : Number(l.valorNovo),
      usuario: l.userId ? nomes.get(l.userId) ?? null : null,
    }));
  }

  async filtros(user: Usuario) {
    const orgId = user.organizationId;
    await this.repo.garantirPadroes(orgId);
    const [catalogos, usuarios] = await Promise.all([
      this.repo.catalogos(orgId, true),
      this.repo.usuarios(orgId),
    ]);
    const porTipo = (tipo: string) => catalogos.filter((c: any) => c.tipo === tipo)
      .map((c: any) => ({ id: c.id, nome: c.nome, cor: c.cor, natureza: c.natureza }));
    return {
      grupos: porTipo("grupo"),
      objetivos: porTipo("objetivo"),
      esferas: porTipo("esfera"),
      areas: porTipo("area"),
      dependencias: porTipo("dependencia"),
      usuarios,
      etapas: ETAPAS,
      pipeline: PIPELINE_OPORTUNIDADE,
      prioridades: PRIORIDADES.map(id => ({ id, rotulo: ROTULO_PRIORIDADE[id] })),
      tiposEvento: TIPOS_EVENTO,
      categoriasDocumento: CATEGORIAS_DOCUMENTO,
      classificacoesFinanceiras: CLASSIFICACOES_FINANCEIRAS,
      faixasAging: FAIXAS_AGING,
      dimensoesRisco: DIMENSOES_RISCO,
      camposValor: CAMPOS_VALOR,
      farois: FAROIS.map(id => ({ id, rotulo: ROTULO_FAROL[id] })),
    };
  }

  /* ── Escrita ───────────────────────────────────────────────────────────── */

  private async cache(orgId: string): Promise<Cache> {
    const [catalogos, usuarios] = await Promise.all([
      this.db.estrategicoCatalogo.findMany({ where: { organizationId: orgId } }),
      this.db.user.findMany({ where: { organizationId: orgId }, select: { id: true, nome: true, ativo: true } }),
    ]);
    return {
      catalogo: new Map(catalogos.map((c: any) => [c.id, c])),
      usuarios: new Map(usuarios.map((u: any) => [u.id, u])),
    };
  }

  private validarReferencias(dto: any, cache: Cache) {
    for (const [campo, tipo] of Object.entries(CATALOGO_DO_CAMPO)) {
      const id = dto[campo];
      if (!id) continue;
      const c = cache.catalogo.get(id);
      if (!c || c.tipo !== tipo) throw new BadRequestException(`${ROTULOS[campo]} inválido.`);
    }
    for (const campo of USUARIO_CAMPOS) {
      const id = dto[campo];
      if (!id) continue;
      const u = cache.usuarios.get(id);
      if (!u || !u.ativo) throw new BadRequestException(`${ROTULOS[campo]}: usuário não encontrado ou inativo nesta organização.`);
    }
    for (const id of dto.areasApoioIds ?? []) {
      const c = cache.catalogo.get(id);
      if (!c || c.tipo !== "area") throw new BadRequestException("Área de apoio inválida.");
    }
  }

  private temCampoFinanceiro(dto: any): boolean {
    return FINANCEIRO_CAMPOS.some(c => dto[c] !== undefined);
  }

  private normalizar(campo: string, v: any) {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    if (DATA_CAMPOS.includes(campo)) return isoDia(v);
    if (CAMPO_VALOR_IDS.includes(campo)) return Number(v);
    if (typeof v === "string") return v.trim();
    return v;
  }

  private paraBanco(campo: string, v: any) {
    if (v === null || v === "") return null;
    if (DATA_CAMPOS.includes(campo)) return paraData(v);
    if (CAMPO_VALOR_IDS.includes(campo)) return Number(v);
    if (typeof v === "string") return v.trim();
    return v;
  }

  exibir(campo: string, v: any, cache: Cache): string | null {
    if (v == null || v === "") return null;
    if (CATALOGO_DO_CAMPO[campo]) return cache.catalogo.get(v)?.nome ?? String(v);
    if (USUARIO_CAMPOS.includes(campo)) return cache.usuarios.get(v)?.nome ?? String(v);
    if (DATA_CAMPOS.includes(campo)) return dataBr(v);
    if (CAMPO_VALOR_IDS.includes(campo)) return moedaBr(v);
    if (campo === "etapa") return etapaDe(v)?.rotulo ?? String(v);
    if (campo === "prioridade" || campo === "proximaAcaoPrioridade") return ROTULO_PRIORIDADE[v] ?? String(v);
    if (campo === "estagioOportunidade") return PIPELINE_OPORTUNIDADE.find(e => e.id === v)?.rotulo ?? String(v);
    if (campo === "classificacaoFinanceira") return CLASSIFICACOES_FINANCEIRAS.find(c => c.id === v)?.rotulo ?? String(v);
    if (typeof v === "boolean") return v ? "Sim" : "Não";
    return String(v);
  }

  async criar(user: Usuario, dto: CriarCasoDto, ip?: string) {
    const orgId = user.organizationId;
    if (!dto.titulo?.trim()) throw new BadRequestException("Informe o título do assunto.");
    if (this.temCampoFinanceiro(dto) && !tem(user, P.financeiro.editar)) {
      throw new ForbiddenException("Sem permissão para informar valores financeiros.");
    }
    const cache = await this.cache(orgId);
    this.validarReferencias(dto, cache);

    const tipo = dto.tipo ?? "assunto";
    const etapa = dto.etapa ?? (tipo === "oportunidade" ? "ideia" : "em_analise");
    const data: any = {
      organizationId: orgId,
      titulo: dto.titulo.trim(),
      tipo,
      etapa,
      prioridade: dto.prioridade ?? "media",
      estagioOportunidade: dto.estagioOportunidade ?? (tipo === "oportunidade" ? "identificada" : null),
      encerradoEm: naturezaDe(etapa) === "encerrada" ? new Date() : null,
      criadoPorId: user.id,
      atualizadoPorId: user.id,
    };
    for (const campo of EDITAVEIS) {
      if (campo in data) continue;
      const v = (dto as any)[campo];
      if (v === undefined) continue;
      data[campo] = this.paraBanco(campo, v);
    }

    let criado: any = null;
    for (let tentativa = 0; tentativa < 3 && !criado; tentativa++) {
      try {
        criado = await this.db.$transaction(async (tx: any) => {
          const codigo = await this.repo.proximoCodigo(orgId, tx);
          const caso = await tx.estrategicoCaso.create({ data: { ...data, codigo } });
          const apoios = [...new Set(dto.areasApoioIds ?? [])];
          if (apoios.length) {
            await tx.estrategicoCasoArea.createMany({ data: apoios.map(areaId => ({ casoId: caso.id, areaId })), skipDuplicates: true });
          }
          await this.repo.historico(orgId, caso.id, {
            userId: user.id, acao: "criou", ip,
            descricao: `${tipo === "oportunidade" ? "Oportunidade" : "Assunto"} ${codigo} cadastrado na etapa "${etapaDe(etapa)?.rotulo}".`,
          }, tx);
          for (const campo of CAMPO_VALOR_IDS) {
            if (data[campo] == null) continue;
            await tx.estrategicoValorHistorico.create({
              data: {
                organizationId: orgId, casoId: caso.id, campo, valorAnterior: null, valorNovo: data[campo],
                referenciaEm: data.valoresReferenciaEm ?? null, observacao: dto.observacaoValor ?? "Valor inicial", userId: user.id,
              },
            });
          }
          return caso;
        });
      } catch (e: any) {
        // Dois cadastros simultâneos disputando o mesmo código: tenta o próximo.
        if (e?.code !== "P2002" || tentativa === 2) throw e;
      }
    }

    await this.recalcularFarol(orgId, criado.id, { registrar: false });
    await this.audit.log({
      organizationId: orgId, userId: user.id, modulo: "estrategico", tabela: "estrategico_casos",
      registroId: criado.id, acao: "criar", descricao: `${criado.codigo} — ${criado.titulo}`, ip,
    });
    return this.obter(user, criado.id);
  }

  async atualizar(user: Usuario, id: string, dto: AtualizarCasoDto, ip?: string) {
    const orgId = user.organizationId;
    const atual = await this.db.estrategicoCaso.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
      include: { apoios: true },
    });
    if (!atual) throw new NotFoundException("Assunto não encontrado");
    if (!podeEditarCaso(user, atual)) {
      throw new ForbiddenException("Você só pode atualizar assuntos sob sua responsabilidade.");
    }
    if (this.temCampoFinanceiro(dto) && !tem(user, P.financeiro.editar)) {
      throw new ForbiddenException("Sem permissão para alterar valores financeiros.");
    }
    if (dto.titulo !== undefined && !dto.titulo?.trim()) throw new BadRequestException("O título não pode ficar vazio.");
    const cache = await this.cache(orgId);
    this.validarReferencias(dto, cache);

    const data: any = {};
    const mudancas: { campo: string; antes: any; depois: any }[] = [];
    for (const campo of EDITAVEIS) {
      const bruto = (dto as any)[campo];
      if (bruto === undefined) continue;
      if (campo === "titulo" && bruto === null) continue;
      const antes = this.normalizar(campo, atual[campo]);
      const depois = this.normalizar(campo, bruto);
      if (antes === depois) continue;
      data[campo] = this.paraBanco(campo, bruto);
      mudancas.push({ campo, antes: atual[campo], depois: data[campo] });
    }

    const apoiosAntes = atual.apoios.map((a: any) => a.areaId).sort();
    const apoiosDepois = dto.areasApoioIds ? [...new Set(dto.areasApoioIds)].sort() : apoiosAntes;
    const apoiosMudaram = apoiosAntes.join() !== apoiosDepois.join();

    if (!mudancas.length && !apoiosMudaram) return this.obter(user, id);

    const hoje = hojeData();
    const mudouEtapa = mudancas.find(m => m.campo === "etapa");
    if (mudouEtapa) {
      data.encerradoEm = naturezaDe(data.etapa) === "encerrada" ? new Date() : null;
      data.ultimaMovimentacaoEm = hoje;
    }
    if (data.tipo === "oportunidade" && !atual.estagioOportunidade && data.estagioOportunidade === undefined) {
      data.estagioOportunidade = "identificada";
    }
    data.atualizadoPorId = user.id;

    await this.db.$transaction(async (tx: any) => {
      await tx.estrategicoCaso.update({ where: { id }, data });

      if (apoiosMudaram) {
        await tx.estrategicoCasoArea.deleteMany({ where: { casoId: id } });
        if (apoiosDepois.length) {
          await tx.estrategicoCasoArea.createMany({ data: apoiosDepois.map((areaId: string) => ({ casoId: id, areaId })) });
        }
        await this.repo.historico(orgId, id, {
          userId: user.id, acao: "mudou_responsavel", campo: "areasApoio", ip,
          valorAnterior: apoiosAntes.map((a: string) => cache.catalogo.get(a)?.nome).join(", ") || null,
          valorNovo: apoiosDepois.map((a: string) => cache.catalogo.get(a)?.nome).join(", ") || null,
          descricao: "Áreas de apoio alteradas.",
        }, tx);
      }

      for (const m of mudancas) {
        await this.repo.historico(orgId, id, {
          userId: user.id, acao: acaoDoCampo(m.campo), campo: m.campo, ip,
          valorAnterior: this.exibir(m.campo, m.antes, cache),
          valorNovo: this.exibir(m.campo, m.depois, cache),
          descricao: m.campo === "etapa" && dto.motivo ? `${ROTULOS[m.campo]} alterada. Motivo: ${dto.motivo}` : `${ROTULOS[m.campo]} alterado.`,
        }, tx);
        if (CAMPO_VALOR_IDS.includes(m.campo)) {
          await tx.estrategicoValorHistorico.create({
            data: {
              organizationId: orgId, casoId: id, campo: m.campo,
              valorAnterior: m.antes, valorNovo: m.depois,
              referenciaEm: data.valoresReferenciaEm ?? atual.valoresReferenciaEm ?? null,
              observacao: dto.observacaoValor ?? null, userId: user.id,
            },
          });
        }
      }

      if (mudouEtapa) {
        await tx.estrategicoEvento.create({
          data: {
            organizationId: orgId, casoId: id, tipo: "alteracao_status", dataEvento: hoje,
            titulo: `Etapa: ${this.exibir("etapa", mudouEtapa.antes, cache)} → ${this.exibir("etapa", mudouEtapa.depois, cache)}`,
            descricao: dto.motivo ?? null, autorId: user.id, origem: "sistema",
          },
        });
      }

      const trocasResponsavel = mudancas.filter(m =>
        ["responsavelExecutivoId", "responsavelOperacionalId", "areaExecutivaId", "areaOperacionalId"].includes(m.campo));
      if (trocasResponsavel.length) {
        await tx.estrategicoEvento.create({
          data: {
            organizationId: orgId, casoId: id, tipo: "mudanca_responsavel", dataEvento: hoje,
            titulo: "Mudança de responsável",
            descricao: trocasResponsavel.map(m =>
              `${ROTULOS[m.campo]}: ${this.exibir(m.campo, m.antes, cache) ?? "—"} → ${this.exibir(m.campo, m.depois, cache) ?? "—"}`).join("\n"),
            autorId: user.id, origem: "sistema",
          },
        });
      }
    });

    await this.recalcularFarol(orgId, id);
    await this.audit.log({
      organizationId: orgId, userId: user.id, modulo: "estrategico", tabela: "estrategico_casos",
      registroId: id, acao: "editar", ip,
      descricao: `${atual.codigo}: ${[...mudancas.map(m => ROTULOS[m.campo]), ...(apoiosMudaram ? ["Áreas de apoio"] : [])].join(", ")}`,
      dados: { campos: mudancas.map(m => m.campo) },
    });
    return this.obter(user, id);
  }

  async definirFarol(user: Usuario, id: string, dto: FarolManualDto, ip?: string) {
    const caso = await this.exigir(user, id);
    const novo = dto.farol ?? null;
    const justificativa = dto.justificativa?.trim() ?? "";
    if (novo && justificativa.length < 10) {
      throw new BadRequestException("Justifique a alteração manual do farol (mínimo de 10 caracteres).");
    }
    if ((caso.farolManual ?? null) === novo && (caso.farolJustificativa ?? "") === (novo ? justificativa : "")) {
      return this.obter(user, id);
    }
    await this.db.estrategicoCaso.update({
      where: { id },
      data: { farolManual: novo, farolJustificativa: novo ? justificativa : null, atualizadoPorId: user.id },
    });
    await this.repo.historico(user.organizationId, id, {
      userId: user.id, acao: "farol_manual", campo: "farol", ip,
      valorAnterior: caso.farolManual ? `${ROTULO_FAROL[caso.farolManual as keyof typeof ROTULO_FAROL]} (manual)` : `Automático (${ROTULO_FAROL[caso.farolCalculado as keyof typeof ROTULO_FAROL]})`,
      valorNovo: novo ? `${ROTULO_FAROL[novo as keyof typeof ROTULO_FAROL]} (manual)` : "Automático",
      descricao: novo ? `Justificativa: ${justificativa}` : "Farol voltou ao cálculo automático.",
    });
    await this.audit.log({
      organizationId: user.organizationId, userId: user.id, modulo: "estrategico", tabela: "estrategico_casos",
      registroId: id, acao: "farol_manual", descricao: `${caso.codigo}: farol ${novo ?? "automático"}`, ip,
    });
    return this.obter(user, id);
  }

  async excluir(user: Usuario, id: string, ip?: string) {
    const caso = await this.exigir(user, id);
    await this.db.estrategicoCaso.update({ where: { id }, data: { deletedAt: new Date(), atualizadoPorId: user.id } });
    await this.repo.historico(user.organizationId, id, {
      userId: user.id, acao: "excluiu", ip, descricao: `Assunto ${caso.codigo} excluído (exclusão lógica — o histórico é preservado).`,
    });
    await this.audit.log({
      organizationId: user.organizationId, userId: user.id, modulo: "estrategico", tabela: "estrategico_casos",
      registroId: id, acao: "excluir", descricao: `${caso.codigo} — ${caso.titulo}`, ip,
    });
    return { ok: true };
  }

  /**
   * Persiste o farol calculado. Chamado depois de toda escrita que o afeta
   * (caso, tarefa, dependência, andamento) e pela automação diária.
   *
   * `registrar: false` na criação: sem isso a trilha de um assunto novo
   * começaria com "farol Verde → Amarelo", que não é um acontecimento.
   */
  async recalcularFarol(orgId: string, casoId: string, opcoes: { registrar?: boolean; origem?: string } = {}) {
    const c = await this.repo.obter(orgId, casoId);
    if (!c) return null;
    const config = await this.repo.config(orgId);
    const ap = apresentarCaso(c, { hoje: new Date(), parametros: parametrosDe(config), verFinanceiro: true });
    const motivosMudaram = JSON.stringify(c.farolMotivos ?? []) !== JSON.stringify(ap.farolMotivos);
    const corMudou = c.farolCalculado !== ap.farolCalculado;
    if (corMudou || motivosMudaram || !c.farolCalculadoEm) {
      await this.db.estrategicoCaso.update({
        where: { id: casoId },
        data: { farolCalculado: ap.farolCalculado, farolMotivos: ap.farolMotivos, farolCalculadoEm: new Date() },
      });
    }
    if (corMudou && opcoes.registrar !== false) {
      await this.repo.historico(orgId, casoId, {
        acao: "farol_calculado", campo: "farol", origem: opcoes.origem ?? "sistema",
        valorAnterior: ROTULO_FAROL[c.farolCalculado as keyof typeof ROTULO_FAROL] ?? c.farolCalculado,
        valorNovo: ROTULO_FAROL[ap.farolCalculado],
        descricao: ap.farolMotivos.map(m => m.texto).join("; ") || "Sem pendências.",
      });
    }
    return { anterior: c.farolCalculado, atual: ap.farolCalculado, mudou: corMudou, apresentado: ap };
  }

  /** Nome de área por normalização — usado pelos relatórios regulatório/jurídico. */
  async areasPorNome(orgId: string, prefixo: string) {
    const areas = await this.db.estrategicoCatalogo.findMany({ where: { organizationId: orgId, tipo: "area" } });
    return areas.filter((a: any) => chaveNormalizada(a.nome).startsWith(prefixo)).map((a: any) => a.id);
  }

  static ordemFarol = ORDEM_FAROL;
}
