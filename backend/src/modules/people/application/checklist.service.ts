import {
  Injectable, BadRequestException, NotFoundException, ConflictException,
  ForbiddenException, Logger,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import {
  IsString, IsOptional, IsBoolean, IsInt, IsIn, MaxLength, Min, Max,
} from "class-validator";
import { ChecklistRepository } from "../infrastructure/checklist.repository";
import { EmployeeHistoryRepository } from "../infrastructure/employee-history.repository";
import { PeopleScopeService, UsuarioContexto } from "./people-scope.service";
import { AuditService } from "../../audit/audit.module";
import {
  EVENTOS_CHECKLIST, RESPONSAVEIS, calcularProgresso, eventoValido,
} from "../domain/checklist.entity";
import { collaboratorDisplayName } from "../../../common/collaborator";

/**
 * Checklist de admissão e desligamento.
 *
 * Responde "o que falta para essa pessoa entrar (ou sair)?" com nome, dono e
 * prazo de cada pendência. Antes disso, admissão era um evento no histórico e
 * o resto morava numa planilha.
 *
 * Ler é amplo (`people.colaborador:ver` alcança o próprio perfil pelo escopo);
 * desenhar modelo e marcar item exigem concessão própria.
 */

export class ModeloDto {
  @IsString() @MaxLength(120) nome!: string;
  @IsIn(EVENTOS_CHECKLIST as unknown as string[]) evento!: string;
  @IsOptional() @IsString() @MaxLength(500) descricao?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

export class ItemModeloDto {
  @IsString() @MaxLength(160) titulo!: string;
  @IsOptional() @IsString() @MaxLength(500) descricao?: string;
  @IsOptional() @IsIn(RESPONSAVEIS as unknown as string[]) responsavel?: string;
  @IsOptional() @IsBoolean() obrigatorio?: boolean;
  // 365 dias: prazo de checklist de entrada/saída não passa de um ano; o teto
  // barra dedo escorregado, não política.
  @IsOptional() @IsInt() @Min(0) @Max(365) prazoDias?: number | null;
}

export class ReordenarItensDto {
  @IsString({ each: true }) ids!: string[];
}

export class AbrirChecklistDto {
  @IsIn(EVENTOS_CHECKLIST as unknown as string[]) evento!: string;
  /** Sem modelo explícito, usa o modelo ativo do evento. */
  @IsOptional() @IsString() templateId?: string;
}

export class MarcarItemDto {
  @IsBoolean() concluido!: boolean;
  @IsOptional() @IsString() @MaxLength(500) observacoes?: string;
}

@Injectable()
export class ChecklistService {
  private readonly logger = new Logger(ChecklistService.name);

  constructor(
    private readonly repo: ChecklistRepository,
    private readonly historico: EmployeeHistoryRepository,
    private readonly escopo: PeopleScopeService,
    private readonly audit: AuditService,
  ) {}

  /* ── Modelos ────────────────────────────────────────────────────────────── */

  async listarModelos(user: UsuarioContexto, incluirInativos = false) {
    const organizationId = this.exigirOrganizacao(user);
    return { success: true, data: await this.repo.listarModelos(organizationId, incluirInativos) };
  }

  async criarModelo(user: UsuarioContexto, dto: ModeloDto) {
    const organizationId = this.exigirOrganizacao(user);
    const nome = dto.nome.trim();

    if (await this.repo.nomeModeloEmUso(organizationId, nome)) {
      throw new ConflictException(`Já existe um modelo chamado "${nome}".`);
    }

    const criado = await this.repo.criarModelo({
      organizationId, nome, evento: dto.evento,
      descricao: dto.descricao?.trim() || null,
      criadoPorId: user.id ?? null,
    });
    await this.auditar(user, criado.id, "criar", `Modelo de checklist "${nome}" criado`);

    return { success: true, data: criado };
  }

  async atualizarModelo(user: UsuarioContexto, id: string, dto: ModeloDto) {
    const organizationId = this.exigirOrganizacao(user);
    const atual = await this.repo.obterModelo(id, organizationId);
    if (!atual) throw new NotFoundException("Modelo não encontrado");

    const nome = dto.nome.trim();
    if (await this.repo.nomeModeloEmUso(organizationId, nome, id)) {
      throw new ConflictException(`Já existe um modelo chamado "${nome}".`);
    }

    const salvo = await this.repo.atualizarModelo(id, {
      nome, evento: dto.evento,
      descricao: dto.descricao?.trim() || null,
      ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
      atualizadoPorId: user.id ?? null,
    });
    await this.auditar(user, id, "editar", `Modelo de checklist "${nome}" editado`);

    return { success: true, data: salvo };
  }

  async excluirModelo(user: UsuarioContexto, id: string) {
    const organizationId = this.exigirOrganizacao(user);
    const modelo = await this.repo.obterModelo(id, organizationId);
    if (!modelo) throw new NotFoundException("Modelo não encontrado");

    // Os checklists já abertos NÃO vão junto: eles têm itens próprios e são o
    // registro do que foi exigido de cada pessoa.
    await this.repo.excluirModelo(id);
    await this.auditar(user, id, "excluir", `Modelo de checklist "${modelo.nome}" excluído`);

    return { success: true, data: { id } };
  }

  async adicionarItemModelo(user: UsuarioContexto, templateId: string, dto: ItemModeloDto) {
    const organizationId = this.exigirOrganizacao(user);
    const modelo = await this.repo.obterModelo(templateId, organizationId);
    if (!modelo) throw new NotFoundException("Modelo não encontrado");

    const criado = await this.repo.criarItemModelo({
      organizationId, templateId,
      ordem: await this.repo.proximaOrdemModelo(templateId),
      titulo: dto.titulo.trim(),
      descricao: dto.descricao?.trim() || null,
      responsavel: dto.responsavel ?? "rh",
      obrigatorio: dto.obrigatorio ?? true,
      prazoDias: dto.prazoDias ?? null,
    });
    await this.auditar(user, criado.id, "criar", `Item adicionado ao modelo "${modelo.nome}"`);

    return { success: true, data: criado };
  }

  async removerItemModelo(user: UsuarioContexto, id: string) {
    const organizationId = this.exigirOrganizacao(user);
    const item = await this.repo.obterItemModelo(id, organizationId);
    if (!item) throw new NotFoundException("Item não encontrado");

    await this.repo.excluirItemModelo(id);

    // Renumera o que sobrou: buraco na sequência faz a tela dizer "item 4 de 3".
    const restantes = await this.repo.itensDoModelo(item.templateId);
    if (restantes.length) {
      await this.repo.reordenarModelo(restantes.map((i: any, idx: number) => ({ id: i.id, ordem: idx + 1 })));
    }

    await this.auditar(user, id, "excluir", `Item removido do modelo "${item.template?.nome}"`);
    return { success: true, data: { id } };
  }

  async reordenarItensModelo(user: UsuarioContexto, templateId: string, dto: ReordenarItensDto) {
    const organizationId = this.exigirOrganizacao(user);
    const modelo = await this.repo.obterModelo(templateId, organizationId);
    if (!modelo) throw new NotFoundException("Modelo não encontrado");

    const existentes = new Set(modelo.itens.map((i: any) => i.id));
    if (dto.ids.length !== existentes.size || dto.ids.some(id => !existentes.has(id))) {
      throw new BadRequestException("A nova ordem precisa conter exatamente os itens deste modelo.");
    }

    await this.repo.reordenarModelo(dto.ids.map((id, i) => ({ id, ordem: i + 1 })));
    return { success: true, data: await this.repo.obterModelo(templateId, organizationId) };
  }

  /* ── Checklist do colaborador ───────────────────────────────────────────── */

  async doColaborador(user: UsuarioContexto, collaboratorId: string) {
    const organizationId = this.exigirOrganizacao(user);
    await this.exigirEscopo(user, collaboratorId);

    const colaborador = await this.repo.colaborador(collaboratorId, organizationId);
    if (!colaborador) throw new NotFoundException("Colaborador não encontrado");

    const instancias = await this.repo.listarDoColaborador(collaboratorId, organizationId);

    return {
      success: true,
      data: instancias.map((c: any) => this.comProgresso(c, colaborador)),
    };
  }

  /**
   * Abre o checklist copiando os itens do modelo.
   *
   * Um por evento: dois checklists de admissão tornariam ambíguo qual é "o"
   * progresso de entrada da pessoa.
   */
  async abrir(user: UsuarioContexto, collaboratorId: string, dto: AbrirChecklistDto) {
    const organizationId = this.exigirOrganizacao(user);
    await this.exigirEscopo(user, collaboratorId);

    const colaborador = await this.repo.colaborador(collaboratorId, organizationId);
    if (!colaborador) throw new NotFoundException("Colaborador não encontrado");

    if (await this.repo.instanciaDoEvento(collaboratorId, dto.evento)) {
      throw new ConflictException(
        `Já existe um checklist de ${dto.evento} para este colaborador.`,
      );
    }

    const modelo = dto.templateId
      ? await this.repo.obterModelo(dto.templateId, organizationId)
      : await this.repo.modeloPadrao(organizationId, dto.evento);

    if (!modelo) {
      throw new BadRequestException(
        `Nenhum modelo de checklist de ${dto.evento} está ativo. Crie um em Catálogos.`,
      );
    }
    if (modelo.evento !== dto.evento) {
      throw new BadRequestException("O modelo escolhido é de outro evento.");
    }

    const checklistId = randomUUID();
    const criada = await this.repo.abrir({
      instancia: {
        id: checklistId,
        organizationId, collaboratorId,
        evento: dto.evento,
        templateId: modelo.id,
        nome: modelo.nome,
        criadoPorId: user.id ?? null,
      },
      // CÓPIA dos itens, não referência: mudar o modelo depois não reescreve o
      // que foi exigido de quem já entrou.
      itens: modelo.itens.map((i: any) => ({
        id: randomUUID(),
        organizationId,
        checklistId,
        ordem: i.ordem,
        titulo: i.titulo,
        descricao: i.descricao,
        responsavel: i.responsavel,
        obrigatorio: i.obrigatorio,
        prazoDias: i.prazoDias,
      })),
    });

    await this.historico.registrar({
      organizationId, collaboratorId,
      evento: "outro",
      descricao: `Checklist de ${dto.evento} aberto: "${modelo.nome}"`,
      registradoPorId: user.id ?? null,
    });
    await this.auditar(
      user, criada.id, "criar",
      `Checklist de ${dto.evento} aberto para ${collaboratorDisplayName(colaborador)}`,
      "collaborator_checklists",
    );

    const completa = await this.repo.obterInstancia(criada.id, organizationId);
    return { success: true, data: this.comProgresso(completa, colaborador) };
  }

  /**
   * Marca ou desmarca um item.
   *
   * Desmarcar é permitido de propósito: item marcado por engano trava a
   * conclusão numa mentira, e corrigir não pode exigir apagar o checklist.
   */
  async marcarItem(user: UsuarioContexto, itemId: string, dto: MarcarItemDto) {
    const organizationId = this.exigirOrganizacao(user);
    const item = await this.repo.obterItem(itemId, organizationId);
    if (!item) throw new NotFoundException("Item não encontrado");
    await this.exigirEscopo(user, item.checklist.collaboratorId);

    await this.repo.atualizarItem(itemId, {
      concluidoEm: dto.concluido ? new Date() : null,
      concluidoPorId: dto.concluido ? user.id ?? null : null,
      ...(dto.observacoes !== undefined ? { observacoes: dto.observacoes?.trim() || null } : {}),
    });

    // A conclusão da INSTÂNCIA é derivada dos itens, não marcada à mão: assim
    // ela nunca diverge do que a lista mostra.
    const instancia = await this.repo.obterInstancia(item.checklist.id, organizationId);
    const colaborador = await this.repo.colaborador(item.checklist.collaboratorId, organizationId);
    const progresso = calcularProgresso(instancia.itens, this.referencia(instancia, colaborador));

    const jaEstavaCompleto = !!instancia.concluidoEm;
    if (progresso.completo && !jaEstavaCompleto) {
      await this.repo.marcarConclusaoDaInstancia(instancia.id, new Date());
      await this.historico.registrar({
        organizationId,
        collaboratorId: item.checklist.collaboratorId,
        evento: "outro",
        descricao: `Checklist de ${instancia.evento} concluído: "${instancia.nome}"`,
        registradoPorId: user.id ?? null,
      });
    } else if (!progresso.completo && jaEstavaCompleto) {
      await this.repo.marcarConclusaoDaInstancia(instancia.id, null);
    }

    const atualizada = await this.repo.obterInstancia(item.checklist.id, organizationId);
    return { success: true, data: this.comProgresso(atualizada, colaborador) };
  }

  async excluirChecklist(user: UsuarioContexto, id: string) {
    const organizationId = this.exigirOrganizacao(user);
    const instancia = await this.repo.obterInstancia(id, organizationId);
    if (!instancia) throw new NotFoundException("Checklist não encontrado");
    await this.exigirEscopo(user, instancia.collaboratorId);

    await this.repo.excluirInstancia(id);
    await this.auditar(
      user, id, "excluir",
      `Checklist de ${instancia.evento} removido`, "collaborator_checklists",
    );

    return { success: true, data: { id } };
  }

  /**
   * Painel: quem tem checklist em aberto, com o que falta e o que atrasou.
   *
   * Sem isto, descobrir pendência exigiria abrir perfil por perfil — que é
   * exatamente o trabalho que o módulo existe para poupar.
   */
  async painel(user: UsuarioContexto) {
    const organizationId = this.exigirOrganizacao(user);
    const escopo = await this.escopo.resolve(user);
    if (escopo.tipo === "nenhum") throw new ForbiddenException("Sem escopo de acesso");

    const ids = escopo.tipo === "organizacao" ? undefined : escopo.collaboratorIds;
    const abertos = await this.repo.emAberto(organizationId, ids);

    const linhas = abertos.map((c: any) => {
      const progresso = calcularProgresso(c.itens, this.referencia(c, c.collaborator));
      return {
        id: c.id,
        evento: c.evento,
        nome: c.nome,
        iniciadoEm: c.iniciadoEm,
        colaborador: {
          id: c.collaborator.id,
          nome: collaboratorDisplayName(c.collaborator),
        },
        percentual: progresso.percentual,
        pendentes: progresso.total - progresso.concluidos,
        atrasados: progresso.atrasados,
      };
    });

    // Mais atrasados primeiro: o painel existe para dizer onde olhar antes.
    linhas.sort((a, b) => b.atrasados - a.atrasados || a.percentual - b.percentual);

    return {
      success: true,
      data: {
        escopoOrganizacional: ids === undefined,
        total: linhas.length,
        comAtraso: linhas.filter(l => l.atrasados > 0).length,
        checklists: linhas,
      },
    };
  }

  /* ── Auxiliares ─────────────────────────────────────────────────────────── */

  /**
   * Data que dá início à contagem de prazo.
   *
   * A do EVENTO, não a da abertura do checklist: um checklist aberto com
   * atraso não pode ganhar prazo extra.
   */
  private referencia(instancia: any, colaborador: any): Date | null {
    if (!colaborador) return null;
    return instancia.evento === "desligamento"
      ? colaborador.dataDesligamento ?? null
      : colaborador.dataAdmissao ?? null;
  }

  private comProgresso(instancia: any, colaborador: any) {
    const progresso = calcularProgresso(instancia.itens, this.referencia(instancia, colaborador));
    return {
      id: instancia.id,
      evento: instancia.evento,
      nome: instancia.nome,
      iniciadoEm: instancia.iniciadoEm,
      concluidoEm: instancia.concluidoEm,
      ...progresso,
    };
  }

  private exigirOrganizacao(user: UsuarioContexto): string {
    if (!user?.organizationId) throw new ForbiddenException("Contexto de organização ausente");
    return user.organizationId;
  }

  private async exigirEscopo(user: UsuarioContexto, collaboratorId: string) {
    if (!(await this.escopo.podeAcessar(user, collaboratorId))) {
      throw new NotFoundException("Colaborador não encontrado");
    }
  }

  private async auditar(
    user: UsuarioContexto, registroId: string, acao: string, descricao: string,
    tabela = "checklist_templates",
  ) {
    try {
      await this.audit.log({
        organizationId: user.organizationId,
        userId: user.id ?? null,
        modulo: "people",
        tabela, registroId, acao, descricao,
      });
    } catch (erro) {
      this.logger.error(`Falha ao auditar ${acao} de ${registroId}`, erro as Error);
    }
  }
}
