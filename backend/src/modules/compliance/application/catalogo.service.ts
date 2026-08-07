import {
  Injectable, NotFoundException, BadRequestException, ConflictException,
} from "@nestjs/common";
import { AuditService } from "../../audit/audit.module";
import { CatalogoRepository } from "../infrastructure/catalogo.repository";
import { chaveDeRotulo, normalizarOpcoes } from "../domain/campo.entity";
import { DIAS_ANTES_PADRAO, DIAS_DEPOIS_PADRAO, BASE_DATA } from "../domain/alerta.entity";
import {
  SalvarCategoriaDto, SalvarOrgaoDto, SalvarTagDto, SalvarRegraDto,
  SalvarTemplateDto, SalvarEscalonamentoDto, SalvarFluxoDto, CampoDefinicaoDto,
} from "./dto/configuracao.dto";

type Usuario = { id: string; organizationId: string };

/**
 * Casos de uso de tudo que se CONFIGURA: categorias e campos, órgãos, tags,
 * réguas de alerta, templates, escalonamento e fluxos de aprovação.
 */
@Injectable()
export class CatalogoService {
  constructor(
    private readonly repo: CatalogoRepository,
    private readonly audit: AuditService,
  ) {}

  /* ── Categorias ────────────────────────────────────────────────────────── */

  async listarCategorias(user: Usuario, incluirInativas = false) {
    const lista = await this.repo.listarCategorias(user.organizationId, incluirInativas);
    return lista.map((c: any) => ({ ...c, totalObrigacoes: c._count?.obrigacoes ?? 0, _count: undefined }));
  }

  async obterCategoria(user: Usuario, id: string) {
    const c = await this.repo.obterCategoria(user.organizationId, id);
    if (!c) throw new NotFoundException("Categoria não encontrada");
    return c;
  }

  async criarCategoria(user: Usuario, dto: SalvarCategoriaDto) {
    const criada = await this.repo.criarCategoria({
      organizationId: user.organizationId,
      nome: dto.nome.trim(),
      descricao: dto.descricao ?? null,
      icone: dto.icone ?? "shield-check",
      cor: dto.cor ?? "#7c3aed",
      ativo: dto.ativo ?? true,
      ordem: dto.ordem ?? 0,
      folgaInternaDias: dto.folgaInternaDias ?? 60,
      criadoPorId: user.id,
    }).catch(this.traduzirDuplicidade("Já existe uma categoria com esse nome."));

    if (dto.campos?.length) await this.sincronizarCampos(user, criada.id, dto.campos);

    await this.auditar(user, criada.id, "criar", `Categoria "${dto.nome}" criada`);
    return this.obterCategoria(user, criada.id);
  }

  async atualizarCategoria(user: Usuario, id: string, dto: SalvarCategoriaDto) {
    await this.obterCategoria(user, id);

    await this.repo.atualizarCategoria(id, {
      nome: dto.nome.trim(),
      descricao: dto.descricao ?? null,
      icone: dto.icone,
      cor: dto.cor,
      ativo: dto.ativo,
      ordem: dto.ordem,
      folgaInternaDias: dto.folgaInternaDias,
    }).catch(this.traduzirDuplicidade("Já existe uma categoria com esse nome."));

    if (dto.campos !== undefined) await this.sincronizarCampos(user, id, dto.campos);

    await this.auditar(user, id, "editar", `Categoria "${dto.nome}" atualizada`);
    return this.obterCategoria(user, id);
  }

  /**
   * Categoria com obrigação viva não é excluída — é desativada.
   *
   * Excluí-la deixaria as obrigações apontando para algo que sumiu das telas:
   * os campos personalizados desapareceriam do detalhe e o painel mostraria
   * uma fatia sem nome.
   */
  async excluirCategoria(user: Usuario, id: string) {
    await this.obterCategoria(user, id);
    const emUso = await this.repo.contarObrigacoesDaCategoria(id);
    if (emUso > 0) {
      throw new ConflictException(
        `Esta categoria tem ${emUso} ${emUso === 1 ? "obrigação" : "obrigações"} ativa(s). ` +
        `Mova-as para outra categoria ou desative esta em vez de excluir.`,
      );
    }
    await this.repo.excluirCategoria(id);
    await this.auditar(user, id, "excluir", "Categoria excluída");
    return { success: true };
  }

  /**
   * Sincroniza os campos personalizados da categoria.
   *
   * Campo com `id` é atualizado; sem `id`, criado; ausente da lista, DESATIVADO
   * — nunca apagado. Apagar levaria junto os valores já preenchidos, e há campo
   * (número de processo) que é a única identificação do documento.
   */
  private async sincronizarCampos(user: Usuario, categoriaId: string, campos: CampoDefinicaoDto[]) {
    const existentes = await this.repo.listarCampos(user.organizationId, categoriaId);
    const mantidos = new Set(campos.map(c => c.id).filter(Boolean) as string[]);

    for (const antigo of existentes) {
      if (!mantidos.has(antigo.id) && antigo.ativo) {
        await this.repo.excluirCampo(antigo.id);
      }
    }

    for (const [indice, campo] of campos.entries()) {
      const dados = {
        rotulo: campo.rotulo.trim(),
        tipo: campo.tipo,
        opcoes: normalizarOpcoes(campo.opcoes),
        obrigatorio: campo.obrigatorio ?? false,
        ajuda: campo.ajuda ?? null,
        ordem: campo.ordem ?? indice,
        ativo: campo.ativo ?? true,
      };

      if (campo.id) {
        // A chave NÃO é regerada ao editar: ela está nos templates de mensagem
        // e nos valores já gravados. Corrigir o rótulo não pode quebrar nada.
        await this.repo.atualizarCampo(campo.id, dados);
        continue;
      }

      await this.repo.criarCampo({
        organizationId: user.organizationId,
        categoriaId,
        chave: await this.chaveDisponivel(categoriaId, campo.rotulo),
        ...dados,
      });
    }
  }

  private async chaveDisponivel(categoriaId: string, rotulo: string): Promise<string> {
    const base = chaveDeRotulo(rotulo);
    for (let n = 0; n < 50; n++) {
      const candidata = n === 0 ? base : `${base}_${n + 1}`;
      if (!(await this.repo.campoPorChave(categoriaId, candidata))) return candidata;
    }
    throw new ConflictException("Não foi possível gerar uma chave única para o campo.");
  }

  /* ── Órgãos ────────────────────────────────────────────────────────────── */

  async listarOrgaos(user: Usuario) {
    const lista = await this.repo.listarOrgaos(user.organizationId);
    return lista.map((o: any) => ({ ...o, totalObrigacoes: o._count?.obrigacoes ?? 0, _count: undefined }));
  }

  async criarOrgao(user: Usuario, dto: SalvarOrgaoDto) {
    const criado = await this.repo.criarOrgao({ organizationId: user.organizationId, ...dto })
      .catch(this.traduzirDuplicidade("Já existe um órgão com esse nome."));
    await this.auditar(user, criado.id, "criar", `Órgão "${dto.nome}" criado`);
    return criado;
  }

  async atualizarOrgao(user: Usuario, id: string, dto: SalvarOrgaoDto) {
    await this.exigirOrgao(user, id);
    const atualizado = await this.repo.atualizarOrgao(id, dto)
      .catch(this.traduzirDuplicidade("Já existe um órgão com esse nome."));
    await this.auditar(user, id, "editar", `Órgão "${dto.nome}" atualizado`);
    return atualizado;
  }

  async excluirOrgao(user: Usuario, id: string) {
    await this.exigirOrgao(user, id);
    await this.repo.excluirOrgao(id);
    await this.auditar(user, id, "excluir", "Órgão excluído");
    return { success: true };
  }

  private async exigirOrgao(user: Usuario, id: string) {
    const lista = await this.repo.listarOrgaos(user.organizationId);
    const achado = lista.find((o: any) => o.id === id);
    if (!achado) throw new NotFoundException("Órgão não encontrado");
    return achado;
  }

  /* ── Tags ──────────────────────────────────────────────────────────────── */

  async listarTags(user: Usuario) {
    const lista = await this.repo.listarTags(user.organizationId);
    return lista.map((t: any) => ({ ...t, totalObrigacoes: t._count?.obrigacoes ?? 0, _count: undefined }));
  }

  /**
   * Cria a tag se não existir e aplica a cor.
   *
   * Reaproveita `garantirTags` — o mesmo caminho que a tela de obrigação usa ao
   * digitar uma etiqueta nova. Ter dois jeitos de criar tag daria duas regras
   * de normalização de nome.
   */
  async criarTag(user: Usuario, dto: SalvarTagDto) {
    const [id] = await this.repo.garantirTags(user.organizationId, [dto.nome]);
    if (!id) throw new BadRequestException("Informe um nome para a tag.");
    if (dto.cor) await this.repo.atualizarTag(id, { cor: dto.cor });
    return { id, nome: dto.nome.trim(), cor: dto.cor ?? "#64748b" };
  }

  async atualizarTag(user: Usuario, id: string, dto: SalvarTagDto) {
    const todas = await this.repo.listarTags(user.organizationId);
    if (!todas.some((t: any) => t.id === id)) throw new NotFoundException("Tag não encontrada");
    return this.repo.atualizarTag(id, { nome: dto.nome.trim(), cor: dto.cor })
      .catch(this.traduzirDuplicidade("Já existe uma tag com esse nome."));
  }

  async excluirTag(user: Usuario, id: string) {
    const todas = await this.repo.listarTags(user.organizationId);
    if (!todas.some((t: any) => t.id === id)) throw new NotFoundException("Tag não encontrada");
    await this.repo.excluirTag(id);
    return { success: true };
  }

  /* ── Réguas de alerta ──────────────────────────────────────────────────── */

  async listarRegras(user: Usuario) {
    return this.repo.listarRegras(user.organizationId);
  }

  async criarRegra(user: Usuario, dto: SalvarRegraDto) {
    this.validarEscopoRegra(dto);
    const criada = await this.repo.criarRegra({
      organizationId: user.organizationId,
      nome: dto.nome ?? "Régua",
      categoriaId: dto.categoriaId ?? null,
      obrigacaoId: dto.obrigacaoId ?? null,
      baseData: dto.baseData ?? BASE_DATA.PRAZO_INTERNO,
      diasAntes: this.ordenarDesc(dto.diasAntes ?? [...DIAS_ANTES_PADRAO]),
      diasDepois: this.ordenarAsc(dto.diasDepois ?? [...DIAS_DEPOIS_PADRAO]),
      canais: dto.canais ?? ["interno", "email"],
      destinatarios: dto.destinatarios ?? ["responsavel", "gestor"],
      emailsExtras: dto.emailsExtras ?? [],
      whatsappsExtras: dto.whatsappsExtras ?? [],
      templateId: dto.templateId ?? null,
      ativo: dto.ativo ?? true,
    });
    await this.auditar(user, criada.id, "criar", `Régua de alerta "${criada.nome}" criada`);
    return criada;
  }

  async atualizarRegra(user: Usuario, id: string, dto: SalvarRegraDto) {
    this.validarEscopoRegra(dto);
    await this.exigirRegra(user, id);
    const atualizada = await this.repo.atualizarRegra(id, {
      nome: dto.nome,
      categoriaId: dto.categoriaId ?? null,
      obrigacaoId: dto.obrigacaoId ?? null,
      baseData: dto.baseData,
      ...(dto.diasAntes ? { diasAntes: this.ordenarDesc(dto.diasAntes) } : {}),
      ...(dto.diasDepois ? { diasDepois: this.ordenarAsc(dto.diasDepois) } : {}),
      canais: dto.canais,
      destinatarios: dto.destinatarios,
      emailsExtras: dto.emailsExtras,
      whatsappsExtras: dto.whatsappsExtras,
      templateId: dto.templateId ?? null,
      ativo: dto.ativo,
    });
    await this.auditar(user, id, "editar", "Régua de alerta atualizada");
    return atualizada;
  }

  async excluirRegra(user: Usuario, id: string) {
    await this.exigirRegra(user, id);
    await this.repo.excluirRegra(id);
    await this.auditar(user, id, "excluir", "Régua de alerta excluída");
    return { success: true };
  }

  /**
   * Uma régua vale para a organização, para uma categoria OU para uma
   * obrigação — nunca para duas coisas ao mesmo tempo, senão a resolução de
   * precedência deixaria de ter resposta única.
   */
  private validarEscopoRegra(dto: SalvarRegraDto) {
    if (dto.categoriaId && dto.obrigacaoId) {
      throw new BadRequestException(
        "A régua vale para uma categoria ou para uma obrigação específica, não para as duas.",
      );
    }
  }

  private async exigirRegra(user: Usuario, id: string) {
    const todas = await this.repo.listarRegras(user.organizationId);
    const achada = todas.find((r: any) => r.id === id);
    if (!achada) throw new NotFoundException("Régua não encontrada");
    return achada;
  }

  // Antes decresce (180 → 0) e depois cresce (1 → 30): é a ordem em que o
  // usuário lê a régua na tela, e a que o motor espera.
  private ordenarDesc(v: number[]) { return [...new Set(v)].sort((a, b) => b - a); }
  private ordenarAsc(v: number[]) { return [...new Set(v)].sort((a, b) => a - b); }

  /* ── Templates ─────────────────────────────────────────────────────────── */

  async listarTemplates(user: Usuario) {
    return this.repo.listarTemplates(user.organizationId);
  }

  async criarTemplate(user: Usuario, dto: SalvarTemplateDto) {
    const criado = await this.repo.criarTemplate({ organizationId: user.organizationId, ...dto })
      .catch(this.traduzirDuplicidade("Já existe um template com esse nome."));
    await this.auditar(user, criado.id, "criar", `Template "${dto.nome}" criado`);
    return criado;
  }

  async atualizarTemplate(user: Usuario, id: string, dto: SalvarTemplateDto) {
    await this.exigirTemplate(user, id);
    const atualizado = await this.repo.atualizarTemplate(id, dto)
      .catch(this.traduzirDuplicidade("Já existe um template com esse nome."));
    await this.auditar(user, id, "editar", `Template "${dto.nome}" atualizado`);
    return atualizado;
  }

  async excluirTemplate(user: Usuario, id: string) {
    await this.exigirTemplate(user, id);
    await this.repo.excluirTemplate(id);
    return { success: true };
  }

  private async exigirTemplate(user: Usuario, id: string) {
    const todos = await this.repo.listarTemplates(user.organizationId);
    const achado = todos.find((t: any) => t.id === id);
    if (!achado) throw new NotFoundException("Template não encontrado");
    return achado;
  }

  /* ── Escalonamento ─────────────────────────────────────────────────────── */

  async listarEscalonamentos(user: Usuario) {
    return this.repo.listarEscalonamentos(user.organizationId);
  }

  async criarEscalonamento(user: Usuario, dto: SalvarEscalonamentoDto) {
    this.validarAlvo(dto);
    const criado = await this.repo.criarEscalonamento({
      organizationId: user.organizationId,
      categoriaId: dto.categoriaId ?? null,
      aposDias: dto.aposDias,
      alvo: dto.alvo,
      userId: dto.userId ?? null,
      emails: dto.emails ?? [],
      ordem: dto.ordem ?? 0,
      ativo: dto.ativo ?? true,
    });
    await this.auditar(user, criado.id, "criar",
      `Escalonamento após ${dto.aposDias} dias para ${dto.alvo}`);
    return criado;
  }

  async atualizarEscalonamento(user: Usuario, id: string, dto: SalvarEscalonamentoDto) {
    this.validarAlvo(dto);
    await this.repo.atualizarEscalonamento(id, {
      categoriaId: dto.categoriaId ?? null,
      aposDias: dto.aposDias,
      alvo: dto.alvo,
      userId: dto.userId ?? null,
      emails: dto.emails ?? [],
      ordem: dto.ordem,
      ativo: dto.ativo,
    });
    return { success: true };
  }

  async excluirEscalonamento(user: Usuario, id: string) {
    await this.repo.excluirEscalonamento(id);
    return { success: true };
  }

  /** Um degrau sem destino não escala nada — falha aqui, não no meio da noite. */
  private validarAlvo(dto: SalvarEscalonamentoDto) {
    if (dto.alvo === "usuario" && !dto.userId) {
      throw new BadRequestException("Escolha o usuário que receberá o escalonamento.");
    }
    if (dto.alvo === "email" && !(dto.emails?.length)) {
      throw new BadRequestException("Informe ao menos um e-mail para o escalonamento.");
    }
  }

  /* ── Fluxos ────────────────────────────────────────────────────────────── */

  async listarFluxos(user: Usuario) {
    return this.repo.listarFluxos(user.organizationId);
  }

  async criarFluxo(user: Usuario, dto: SalvarFluxoDto) {
    this.validarEtapas(dto);
    const criado = await this.repo.criarFluxo(
      {
        organizationId: user.organizationId,
        nome: dto.nome,
        descricao: dto.descricao ?? null,
        categoriaId: dto.categoriaId ?? null,
        ativo: dto.ativo ?? true,
      },
      dto.etapas.map(e => ({
        organizationId: user.organizationId,
        nome: e.nome,
        ordem: e.ordem,
        papelAprovador: e.papelAprovador ?? null,
        exigeAprovacao: e.exigeAprovacao ?? true,
        statusAoEntrar: e.statusAoEntrar ?? null,
      })),
    );
    await this.auditar(user, criado.id, "criar", `Fluxo "${dto.nome}" criado`);
    return criado;
  }

  async atualizarFluxo(user: Usuario, id: string, dto: SalvarFluxoDto) {
    this.validarEtapas(dto);
    await this.repo.substituirEtapas(
      user.organizationId, id,
      dto.etapas.map(e => ({
        nome: e.nome,
        ordem: e.ordem,
        papelAprovador: e.papelAprovador ?? null,
        exigeAprovacao: e.exigeAprovacao ?? true,
        statusAoEntrar: e.statusAoEntrar ?? null,
      })),
    );
    const atualizado = await this.repo.atualizarFluxo(id, {
      nome: dto.nome,
      descricao: dto.descricao ?? null,
      categoriaId: dto.categoriaId ?? null,
      ativo: dto.ativo,
    });
    await this.auditar(user, id, "editar", `Fluxo "${dto.nome}" atualizado`);
    return atualizado;
  }

  async excluirFluxo(user: Usuario, id: string) {
    await this.repo.excluirFluxo(id);
    return { success: true };
  }

  private validarEtapas(dto: SalvarFluxoDto) {
    if (!dto.etapas?.length) {
      throw new BadRequestException("Um fluxo precisa de ao menos uma etapa.");
    }
    const ordens = dto.etapas.map(e => e.ordem);
    if (new Set(ordens).size !== ordens.length) {
      throw new BadRequestException("Duas etapas não podem ter a mesma ordem.");
    }
  }

  /* ── Auxiliares ────────────────────────────────────────────────────────── */

  /**
   * Converte a violação de índice único do Prisma numa mensagem que o usuário
   * entende. Sem isso, cadastrar uma categoria repetida devolve "Unique
   * constraint failed on the fields: (`organizationId`,`nome`)".
   */
  private traduzirDuplicidade(mensagem: string) {
    return (erro: any) => {
      if (erro?.code === "P2002") throw new ConflictException(mensagem);
      throw erro;
    };
  }

  private async auditar(user: Usuario, registroId: string, acao: string, descricao: string) {
    await this.audit.log({
      organizationId: user.organizationId,
      userId: user.id,
      modulo: "compliance",
      tabela: "compliance_configuracao",
      registroId, acao, descricao,
    });
  }
}
