import {
  Injectable, Logger, NotFoundException, BadRequestException, ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.module";
import { ObrigacaoRepository, FiltrosObrigacao } from "../infrastructure/obrigacao.repository";
import { CatalogoRepository } from "../infrastructure/catalogo.repository";
import { HistoricoRepository } from "../infrastructure/arquivo.repository";
import { apresentar, apresentarLista } from "./obrigacao.presenter";
import {
  calcularPrazos, estaProrrogada, proximaValidade, formatarCodigo,
  STATUS_OBRIGACAO, contaNoRadar,
} from "../domain/obrigacao.entity";
import { coagirValor, ValorCampoInvalido } from "../domain/campo.entity";
import { dataBR } from "../../../common/datas";
import {
  CriarObrigacaoDto, AtualizarObrigacaoDto, RenovarObrigacaoDto,
  ProtocolarDto, MudarStatusDto, ListarObrigacoesQuery,
} from "./dto/obrigacao.dto";

type Usuario = { id: string; organizationId: string; nome?: string };

/**
 * Casos de uso das obrigações.
 *
 * Duas invariantes atravessam o arquivo inteiro:
 *
 *  1. `prazoFatalEm` e `prazoInternoEm` NUNCA são gravados a partir da entrada
 *     do usuário — são sempre recalculados por `recalcular()`. O que o usuário
 *     manda é o override (`*Manual`), e mesmo ele passa pelo cálculo.
 *
 *  2. Toda escrita que muda o estado da obrigação também escreve no histórico.
 *     A trilha é a razão de o módulo substituir a planilha: sem ela, "quem
 *     mudou a validade" volta a ser uma pergunta sem resposta.
 */
@Injectable()
export class ObrigacaoService {
  private readonly logger = new Logger(ObrigacaoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: ObrigacaoRepository,
    private readonly catalogo: CatalogoRepository,
    private readonly historico: HistoricoRepository,
    private readonly audit: AuditService,
  ) {}

  private get db(): any {
    return this.prisma as any;
  }

  /* ── Leitura ───────────────────────────────────────────────────────────── */

  async listar(user: Usuario, query: ListarObrigacoesQuery) {
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
      supplierId: query.supplierId || undefined,
      venceEmDias: query.venceEmDias,
      de: query.de ? new Date(query.de) : undefined,
      ate: query.ate ? new Date(query.ate) : undefined,
      favoritosDoUsuario: query.favoritos === "true" ? user.id : undefined,
    };

    const r = await this.repo.listar(user.organizationId, filtros, {
      pagina: query.pagina ?? 1,
      limite: query.limite ?? 25,
      ordenar: query.ordenar,
      userId: user.id,
    });

    return {
      itens: apresentarLista(r.itens),
      total: r.total,
      pagina: r.pagina,
      limite: r.limite,
      paginas: Math.max(1, Math.ceil(r.total / r.limite)),
    };
  }

  async obter(user: Usuario, id: string) {
    const o = await this.repo.obter(user.organizationId, id, user.id);
    if (!o) throw new NotFoundException("Obrigação não encontrada");
    return apresentar(o);
  }

  async historicoDe(user: Usuario, id: string) {
    await this.exigir(user, id);
    return this.historico.listar(user.organizationId, id);
  }

  async versoesDe(user: Usuario, id: string) {
    await this.exigir(user, id);
    return this.repo.listarVersoes(user.organizationId, id);
  }

  async comentariosDe(user: Usuario, id: string) {
    await this.exigir(user, id);
    return this.repo.listarComentarios(id);
  }

  /**
   * Valores distintos para alimentar os combos de filtro.
   *
   * Sai daqui e não do frontend porque a lista precisa refletir o que EXISTE na
   * organização — oferecer "Fábrica de Placa" a quem não tem nenhuma obrigação
   * lá é oferecer um filtro que só devolve vazio.
   */
  async filtros(user: Usuario) {
    const orgId = user.organizationId;
    const base = { organizationId: orgId, deletedAt: null };

    const [categorias, orgaos, tags, unidades, departamentos, empresas] = await Promise.all([
      this.catalogo.listarCategorias(orgId, true),
      this.catalogo.listarOrgaos(orgId),
      this.catalogo.listarTags(orgId),
      this.distintos("unidade", base),
      this.distintos("departamento", base),
      this.distintos("empresa", base),
    ]);

    return {
      categorias: categorias.map((c: any) => ({
        id: c.id, nome: c.nome, cor: c.cor, icone: c.icone, total: c._count?.obrigacoes ?? 0,
      })),
      orgaos: orgaos.map((o: any) => ({ id: o.id, nome: o.nome, sigla: o.sigla })),
      tags: tags.map((t: any) => ({ id: t.id, nome: t.nome, cor: t.cor })),
      unidades, departamentos, empresas,
    };
  }

  private async distintos(coluna: string, where: any): Promise<string[]> {
    const linhas = await this.db.complianceObrigacao.findMany({
      where: { ...where, [coluna]: { not: null } },
      select: { [coluna]: true },
      distinct: [coluna],
      orderBy: { [coluna]: "asc" },
      take: 300,
    });
    return linhas.map((l: any) => l[coluna]).filter(Boolean);
  }

  /* ── Escrita ───────────────────────────────────────────────────────────── */

  async criar(user: Usuario, dto: CriarObrigacaoDto, ip?: string) {
    const categoria = await this.catalogo.obterCategoria(user.organizationId, dto.categoriaId);
    if (!categoria) throw new BadRequestException("Categoria não encontrada");

    const codigo = await this.gerarCodigo(user.organizationId);
    const dados = this.montarDados(dto, categoria);

    const criada = await this.repo.criar({
      ...dados,
      organizationId: user.organizationId,
      codigo,
      categoriaId: dto.categoriaId,
      nome: dto.nome,
      criadoPorId: user.id,
      atualizadoPorId: user.id,
      versaoAtual: 1,
    });

    // A versão 1 nasce junto: sem ela, a primeira renovação não teria de onde
    // congelar o passado, e o histórico começaria pela segunda vigência.
    await this.repo.criarVersao({
      organizationId: user.organizationId,
      obrigacaoId: criada.id,
      versao: 1,
      numeroDocumento: criada.numeroDocumento,
      dataEmissao: criada.dataEmissao,
      dataValidade: criada.dataValidade,
      prazoMinimoDias: criada.prazoMinimoDias,
      prazoFatalEm: criada.prazoFatalEm,
      prazoInternoEm: criada.prazoInternoEm,
      valor: criada.valorLicenca,
      snapshot: this.snapshotDe(criada),
      criadoPorId: user.id,
    });

    await this.aplicarRelacionados(user, criada.id, dto, categoria);
    await this.registrar(user, criada.id, "criou",
      `Obrigação ${codigo} cadastrada na categoria ${categoria.nome}.`, ip);
    await this.auditar(user, criada.id, "criar", `Obrigação ${codigo} — ${dto.nome}`, ip);

    return this.obter(user, criada.id);
  }

  async atualizar(user: Usuario, id: string, dto: AtualizarObrigacaoDto, ip?: string) {
    const atual = await this.exigir(user, id);

    const categoriaId = dto.categoriaId ?? atual.categoriaId;
    const categoria = await this.catalogo.obterCategoria(user.organizationId, categoriaId);
    if (!categoria) throw new BadRequestException("Categoria não encontrada");

    // O cálculo precisa enxergar o registro COMPLETO depois da mescla: mandar
    // só `prazoMinimoDias` sem a validade recalcularia o prazo a partir de
    // `undefined` e zeraria as duas datas.
    const mesclado = { ...atual, ...this.limparIndefinidos(dto) };
    const dados = this.montarDados(mesclado as any, categoria);

    const antes = this.snapshotDe(atual);
    const atualizada = await this.repo.atualizar(id, {
      ...dados,
      categoriaId,
      ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
      atualizadoPorId: user.id,
    });

    if (categoriaId !== atual.categoriaId) {
      await this.repo.limparCamposDeOutraCategoria(id, categoriaId);
    }

    await this.aplicarRelacionados(user, id, dto, categoria);
    await this.registrarDiferencas(user, id, antes, this.snapshotDe(atualizada), ip);
    await this.auditar(user, id, "editar", `Obrigação ${atual.codigo} editada`, ip);

    return this.obter(user, id);
  }

  /**
   * Renovação.
   *
   * Congela a vigência corrente numa versão e abre a próxima. Nunca substitui:
   * a licença que valia em 2022 continua sendo o documento daquele ano, e é
   * dela que o auditor precisa.
   */
  async renovar(user: Usuario, id: string, dto: RenovarObrigacaoDto, ip?: string) {
    const atual = await this.exigir(user, id);

    const emissao = new Date(dto.dataEmissao);
    const validade = dto.dataValidade
      ? new Date(dto.dataValidade)
      : proximaValidade(emissao, atual.validadeMeses);

    if (!validade) {
      throw new BadRequestException(
        "Informe a nova data de validade — esta obrigação não tem periodicidade cadastrada para calcular.",
      );
    }
    if (validade <= emissao) {
      throw new BadRequestException("A validade precisa ser posterior à emissão.");
    }

    const categoria = await this.catalogo.obterCategoria(user.organizationId, atual.categoriaId);
    const prazoMinimo = dto.prazoMinimoDias ?? atual.prazoMinimoDias;

    const prazos = calcularPrazos({
      dataValidade: validade,
      prazoMinimoDias: prazoMinimo,
      folgaInternaDias: atual.folgaInternaDias,
      folgaCategoriaDias: categoria?.folgaInternaDias,
      // A renovação zera os overrides: eles valiam para a vigência que acabou.
      prazoFatalManual: null,
      prazoInternoManual: null,
    });

    const novaVersao = atual.versaoAtual + 1;

    await this.repo.encerrarVersaoCorrente(id, atual.versaoAtual);

    const renovada = await this.repo.atualizar(id, {
      numeroDocumento: dto.numeroDocumento ?? atual.numeroDocumento,
      dataEmissao: emissao,
      dataValidade: validade,
      dataUltimaRenovacao: new Date(),
      prazoMinimoDias: prazoMinimo,
      prazoFatalEm: prazos.prazoFatalEm,
      prazoInternoEm: prazos.prazoInternoEm,
      prazoFatalManual: null,
      prazoInternoManual: null,
      valorLicenca: dto.valor ?? atual.valorLicenca,
      versaoAtual: novaVersao,
      status: STATUS_OBRIGACAO.ATIVA,
      // O protocolo era da vigência anterior. Mantê-lo faria a obrigação nova
      // nascer "prorrogada" por um protocolo que já foi decidido.
      protocoloNumero: null,
      protocoloEm: null,
      protocoloObservacao: null,
      prorrogacaoVigente: false,
      atualizadoPorId: user.id,
    });

    await this.repo.criarVersao({
      organizationId: user.organizationId,
      obrigacaoId: id,
      versao: novaVersao,
      numeroDocumento: renovada.numeroDocumento,
      dataEmissao: emissao,
      dataValidade: validade,
      prazoMinimoDias: prazoMinimo,
      prazoFatalEm: prazos.prazoFatalEm,
      prazoInternoEm: prazos.prazoInternoEm,
      valor: dto.valor ?? null,
      observacao: dto.observacao ?? null,
      snapshot: this.snapshotDe(renovada),
      criadoPorId: user.id,
    });

    await this.registrar(user, id, "renovou",
      `Renovada para a versão ${novaVersao}. Nova validade: ${dataBR(validade)} ` +
      `(anterior: ${dataBR(atual.dataValidade) || "sem validade"}).`, ip);
    await this.auditar(user, id, "renovar",
      `Obrigação ${atual.codigo} renovada — versão ${novaVersao}`, ip);

    return this.obter(user, id);
  }

  /**
   * Registro do protocolo de renovação.
   *
   * É o que sustenta a prorrogação: com renovação automática ligada e protocolo
   * tempestivo, a obrigação continua regular depois da validade. Sem uma das
   * duas coisas, não continua — e o serviço diz isso na resposta em vez de
   * deixar o usuário achar que resolveu.
   */
  async protocolar(user: Usuario, id: string, dto: ProtocolarDto, ip?: string) {
    const atual = await this.exigir(user, id);
    const protocoloEm = new Date(dto.protocoloEm);

    const prorrogacaoVigente = estaProrrogada({
      renovacaoAutomatica: atual.renovacaoAutomatica,
      protocoloEm,
      prazoFatalEm: atual.prazoFatalEm,
      dataValidade: atual.dataValidade,
    });

    await this.repo.atualizar(id, {
      protocoloNumero: dto.protocoloNumero,
      protocoloEm,
      protocoloObservacao: dto.observacao ?? null,
      prorrogacaoVigente,
      status: STATUS_OBRIGACAO.EM_RENOVACAO,
      atualizadoPorId: user.id,
    });

    const aviso = !atual.renovacaoAutomatica
      ? "Esta obrigação não está marcada como de renovação automática, então o protocolo não prorroga a validade."
      : !prorrogacaoVigente
        ? `O protocolo é posterior ao prazo fatal (${dataBR(atual.prazoFatalEm)}), então não prorroga a validade automaticamente.`
        : null;

    await this.registrar(user, id, "protocolou",
      `Protocolo ${dto.protocoloNumero} em ${dataBR(protocoloEm)}. ` +
      (prorrogacaoVigente ? "Validade prorrogada até decisão do órgão." : (aviso ?? "")), ip);
    await this.auditar(user, id, "protocolar",
      `Protocolo ${dto.protocoloNumero} registrado em ${atual.codigo}`, ip);

    return { ...(await this.obter(user, id)), aviso };
  }

  async mudarStatus(user: Usuario, id: string, dto: MudarStatusDto, ip?: string) {
    const atual = await this.exigir(user, id);
    if (atual.status === dto.status) return this.obter(user, id);

    await this.repo.atualizar(id, { status: dto.status, atualizadoPorId: user.id });

    await this.registrar(user, id, "mudou_status",
      `Status alterado de "${atual.status}" para "${dto.status}".` +
      (dto.motivo ? ` Motivo: ${dto.motivo}` : ""), ip,
      "status", atual.status, dto.status);
    await this.auditar(user, id, "mudar_status",
      `Obrigação ${atual.codigo}: ${atual.status} → ${dto.status}`, ip);

    // Sair do radar é decisão consciente; registrar torna auditável quem tirou.
    if (!contaNoRadar(dto.status)) {
      this.logger.log(`Obrigação ${atual.codigo} saiu do radar de alertas (${dto.status})`);
    }

    return this.obter(user, id);
  }

  async excluir(user: Usuario, id: string, ip?: string) {
    const atual = await this.exigir(user, id);
    await this.repo.excluirLogicamente(id, user.id);
    await this.registrar(user, id, "excluiu", `Obrigação ${atual.codigo} excluída.`, ip);
    await this.auditar(user, id, "excluir", `Obrigação ${atual.codigo} — ${atual.nome}`, ip);
    return { success: true };
  }

  async alternarFavorito(user: Usuario, id: string) {
    await this.exigir(user, id);
    const favorito = await this.repo.alternarFavorito(user.organizationId, id, user.id);
    return { favorito };
  }

  async comentar(user: Usuario, id: string, conteudo: string, ip?: string) {
    await this.exigir(user, id);
    const c = await this.repo.comentar(user.organizationId, id, user.id, conteudo);
    await this.registrar(user, id, "comentou", conteudo.slice(0, 200), ip);
    return c;
  }

  /* ── Auxiliares ────────────────────────────────────────────────────────── */

  private async exigir(user: Usuario, id: string) {
    const o = await this.repo.obterCru(user.organizationId, id);
    if (!o) throw new NotFoundException("Obrigação não encontrada");
    return o;
  }

  /**
   * Código sequencial com desempate.
   *
   * `proximoSequencial` conta e soma 1, o que colide se dois cadastros
   * acontecerem no mesmo instante. Em vez de serializar tudo numa transação
   * pesada, tentamos os próximos números — o índice único é quem manda, e a
   * colisão é rara o bastante para não valer um lock de tabela.
   */
  private async gerarCodigo(organizationId: string): Promise<string> {
    let n = await this.repo.proximoSequencial(organizationId);
    for (let tentativa = 0; tentativa < 20; tentativa++) {
      const codigo = formatarCodigo(n + tentativa);
      if (!(await this.repo.codigoExiste(organizationId, codigo))) return codigo;
    }
    throw new ConflictException("Não foi possível gerar um código único. Tente novamente.");
  }

  /** Campos escalares + prazos recalculados. Nunca aceita prazo pronto. */
  private montarDados(dto: any, categoria: any): Record<string, any> {
    const dados: Record<string, any> = {};
    const copiarTexto = [
      "sigla", "numeroDocumento", "descricao", "orgaoId", "empresa", "filial",
      "unidade", "departamento", "centroCusto", "ativoIdentificador", "projectId",
      "criticidade", "supplierId", "notaFiscal", "observacoes", "protocoloNumero",
      "protocoloObservacao",
    ];
    for (const campo of copiarTexto) {
      if (dto[campo] !== undefined) dados[campo] = dto[campo] || null;
    }

    const copiarNumero = ["validadeMeses", "prazoMinimoDias", "folgaInternaDias", "valorLicenca", "valorRenovacao"];
    for (const campo of copiarNumero) {
      if (dto[campo] !== undefined) dados[campo] = dto[campo] ?? null;
    }

    for (const campo of ["dataEmissao", "dataValidade", "dataAprovacao", "protocoloEm"]) {
      if (dto[campo] !== undefined) dados[campo] = dto[campo] ? new Date(dto[campo]) : null;
    }

    if (dto.renovacaoAutomatica !== undefined) {
      dados.renovacaoAutomatica = !!dto.renovacaoAutomatica;
    }

    const prazos = calcularPrazos({
      dataValidade: dto.dataValidade,
      prazoMinimoDias: dto.prazoMinimoDias,
      folgaInternaDias: dto.folgaInternaDias,
      folgaCategoriaDias: categoria?.folgaInternaDias,
      prazoFatalManual: dto.prazoFatalManual,
      prazoInternoManual: dto.prazoInternoManual,
    });

    dados.prazoFatalEm = prazos.prazoFatalEm;
    dados.prazoInternoEm = prazos.prazoInternoEm;
    dados.prazoFatalManual = dto.prazoFatalManual ? new Date(dto.prazoFatalManual) : null;
    dados.prazoInternoManual = dto.prazoInternoManual ? new Date(dto.prazoInternoManual) : null;

    dados.prorrogacaoVigente = estaProrrogada({
      renovacaoAutomatica: dto.renovacaoAutomatica,
      protocoloEm: dto.protocoloEm,
      prazoFatalEm: prazos.prazoFatalEm,
      dataValidade: dto.dataValidade,
    });

    return dados;
  }

  /**
   * Amarra o responsável à conta de usuário quando o e-mail bate com uma.
   *
   * O formulário coleta responsável como TEXTO — nome, e-mail e WhatsApp — e não
   * tem seletor de usuário, então `userId` nunca chegava preenchido. Duas coisas
   * dependem desse vínculo e por isso não funcionavam para ninguém:
   *
   *   - "Minhas obrigações", que consulta `responsaveis.some({ userId })` e
   *     devolvia lista vazia mesmo para quem estava nomeado na obrigação;
   *   - a notificação interna (o sino), que precisa de um usuário para destinar.
   *
   * O e-mail já identifica a pessoa dentro da organização, então a ligação é
   * feita aqui, na gravação. Quem preenche continua digitando o e-mail e não
   * precisa saber que existe um id por trás.
   *
   * Só amarra dentro da MESMA organização: e-mail igual em outro tenant é outra
   * pessoa, e vincular atravessaria o isolamento entre clientes.
   */
  private async vincularResponsaveisAoUsuario(organizationId: string, responsaveis: any[]) {
    const emails = responsaveis
      .map(r => (r.userId ? null : r.email?.trim().toLowerCase()))
      .filter((e): e is string => !!e);

    const porEmail = new Map<string, string>();
    if (emails.length) {
      const usuarios = await (this.repo as any).usuariosPorEmail(organizationId, emails);
      for (const u of usuarios) porEmail.set(u.email.toLowerCase(), u.id);
    }

    return responsaveis.map((r: any) => ({
      papel: r.papel,
      userId: r.userId ?? porEmail.get(r.email?.trim().toLowerCase() ?? "") ?? null,
      collaboratorId: r.collaboratorId ?? null,
      nome: r.nome ?? null,
      email: r.email ?? null,
      telefone: r.telefone ?? null,
      notificar: r.notificar ?? true,
    }));
  }

  /** Responsáveis, tags e campos personalizados — tudo que vive fora da linha. */
  private async aplicarRelacionados(
    user: Usuario, obrigacaoId: string, dto: any, categoria: any,
  ) {
    if (dto.responsaveis !== undefined) {
      const comVinculo = await this.vincularResponsaveisAoUsuario(
        user.organizationId, dto.responsaveis,
      );
      await this.repo.substituirResponsaveis(user.organizationId, obrigacaoId, comVinculo);
    }

    if (dto.tags !== undefined) {
      const ids = await this.catalogo.garantirTags(user.organizationId, dto.tags);
      await this.repo.substituirTags(user.organizationId, obrigacaoId, ids);
    }

    if (dto.campos !== undefined) {
      const definicoes = categoria.campos ?? [];
      for (const def of definicoes) {
        if (!(def.chave in dto.campos)) continue;
        try {
          const colunas = coagirValor(def, dto.campos[def.chave]);
          await this.repo.gravarCampoValor(user.organizationId, obrigacaoId, def.id, colunas);
        } catch (erro) {
          if (erro instanceof ValorCampoInvalido) throw new BadRequestException(erro.message);
          throw erro;
        }
      }
    }
  }

  /** Remove chaves `undefined` para a mescla não apagar o que não foi enviado. */
  private limparIndefinidos<T extends Record<string, any>>(obj: T): Partial<T> {
    const saida: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) saida[k] = v;
    }
    return saida as Partial<T>;
  }

  private snapshotDe(o: any): Record<string, any> {
    return {
      nome: o.nome, sigla: o.sigla, numeroDocumento: o.numeroDocumento,
      categoriaId: o.categoriaId, orgaoId: o.orgaoId,
      unidade: o.unidade, departamento: o.departamento, empresa: o.empresa,
      ativoIdentificador: o.ativoIdentificador,
      criticidade: o.criticidade, status: o.status,
      dataEmissao: o.dataEmissao, dataValidade: o.dataValidade,
      prazoMinimoDias: o.prazoMinimoDias, folgaInternaDias: o.folgaInternaDias,
      prazoFatalEm: o.prazoFatalEm, prazoInternoEm: o.prazoInternoEm,
      renovacaoAutomatica: o.renovacaoAutomatica,
      protocoloNumero: o.protocoloNumero, protocoloEm: o.protocoloEm,
      valorLicenca: o.valorLicenca == null ? null : String(o.valorLicenca),
      valorRenovacao: o.valorRenovacao == null ? null : String(o.valorRenovacao),
      versaoAtual: o.versaoAtual,
    };
  }

  /** Rótulos legíveis — o histórico é lido por gente, não por máquina. */
  private static readonly ROTULO_CAMPO: Record<string, string> = {
    nome: "Nome", sigla: "Sigla", numeroDocumento: "Número do documento",
    categoriaId: "Categoria", orgaoId: "Órgão", unidade: "Unidade",
    departamento: "Departamento", empresa: "Empresa",
    ativoIdentificador: "Equipamento", criticidade: "Criticidade", status: "Status",
    dataEmissao: "Data de emissão", dataValidade: "Data de validade",
    prazoMinimoDias: "Prazo mínimo do órgão (dias)", folgaInternaDias: "Folga interna (dias)",
    prazoFatalEm: "Prazo fatal", prazoInternoEm: "Prazo interno",
    renovacaoAutomatica: "Renovação automática",
    protocoloNumero: "Número do protocolo", protocoloEm: "Data do protocolo",
    valorLicenca: "Valor da licença", valorRenovacao: "Valor da renovação",
    versaoAtual: "Versão",
  };

  private static readonly DATAS = new Set([
    "dataEmissao", "dataValidade", "prazoFatalEm", "prazoInternoEm", "protocoloEm",
  ]);

  /**
   * Uma linha de histórico por campo alterado.
   *
   * "João alterou a validade de 31/07/2012 para 31/07/2016" é o que o auditor
   * precisa ler. Um único registro dizendo "editou" não responderia nada.
   */
  private async registrarDiferencas(
    user: Usuario, obrigacaoId: string, antes: any, depois: any, ip?: string,
  ) {
    const eventos: any[] = [];

    for (const [campo, valorNovo] of Object.entries(depois)) {
      const valorAntigo = antes[campo];
      if (this.mesmoValor(valorAntigo, valorNovo)) continue;

      const rotulo = ObrigacaoService.ROTULO_CAMPO[campo] ?? campo;
      const de = this.formatar(campo, valorAntigo);
      const para = this.formatar(campo, valorNovo);

      eventos.push({
        organizationId: user.organizationId,
        obrigacaoId,
        userId: user.id,
        acao: "editou",
        campo: rotulo,
        valorAnterior: de,
        valorNovo: para,
        descricao: `${rotulo}: "${de || "vazio"}" → "${para || "vazio"}"`,
        ip: ip ?? null,
        origem: "web",
      });
    }

    if (eventos.length === 0) return;
    await this.historico.registrarVarios(eventos);
  }

  private mesmoValor(a: any, b: any): boolean {
    if (a instanceof Date || b instanceof Date) {
      const ta = a ? new Date(a).getTime() : null;
      const tb = b ? new Date(b).getTime() : null;
      return ta === tb;
    }
    return String(a ?? "") === String(b ?? "");
  }

  private formatar(campo: string, valor: any): string {
    if (valor == null) return "";
    if (ObrigacaoService.DATAS.has(campo)) return dataBR(valor);
    if (typeof valor === "boolean") return valor ? "sim" : "não";
    return String(valor);
  }

  private async registrar(
    user: Usuario, obrigacaoId: string, acao: string, descricao: string, ip?: string,
    campo?: string, valorAnterior?: string, valorNovo?: string,
  ) {
    try {
      await this.historico.registrar({
        organizationId: user.organizationId,
        obrigacaoId, userId: user.id, acao, descricao,
        campo: campo ?? null,
        valorAnterior: valorAnterior ?? null,
        valorNovo: valorNovo ?? null,
        ip: ip ?? null,
      });
    } catch (erro) {
      // A falha não derruba a operação de negócio, mas vai para o log: trilha
      // que some em silêncio é pior que trilha ausente.
      this.logger.error(`Falha ao gravar histórico de ${obrigacaoId} (${acao})`, erro as Error);
    }
  }

  private async auditar(
    user: Usuario, registroId: string, acao: string, descricao: string, ip?: string,
  ) {
    await this.audit.log({
      organizationId: user.organizationId,
      userId: user.id,
      modulo: "compliance",
      tabela: "compliance_obrigacoes",
      registroId, acao, descricao,
      ip: ip ?? null,
    });
  }
}
