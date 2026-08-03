import {
  Injectable, BadRequestException, NotFoundException, ConflictException,
  ForbiddenException, Logger,
} from "@nestjs/common";
import {
  IsString, IsOptional, IsBoolean, IsInt, IsNumber, IsIn, MaxLength, Min, Max,
} from "class-validator";
import { CareerRepository } from "../infrastructure/career.repository";
import { PeopleScopeService, UsuarioContexto } from "./people-scope.service";
import { AuditService } from "../../audit/audit.module";
import { EmployeeService } from "./employee.service";
import { SalaryService } from "./salary.service";
import { EmployeeHistoryRepository } from "../infrastructure/employee-history.repository";
import {
  NIVEIS_COMPETENCIA, avaliarProntidao, degrauAtual, proximoDegrau,
  validarRequisito, validarNivelMinimo, Requisito,
} from "../domain/career.entity";

/**
 * Plano de carreira.
 *
 * A trilha ordena cargos do catálogo; progredir é ocupar o próximo cargo. O
 * valor da tela não é o desenho da trilha — é responder "o que falta para o
 * próximo degrau", com o nome de cada item que falta.
 *
 * Permissão: `people.carreira:ver` para ler a trilha e a própria prontidão,
 * `people.carreira:gerenciar` para desenhar. A prontidão de OUTRA pessoa passa
 * pelo PeopleScopeService como todo o resto do módulo.
 */

const TIPOS_REQUISITO = ["competencia", "treinamento", "manual"] as const;

/** Sem importar o catálogo inteiro só para uma checagem. */
const PERMISSAO_SALARIO = "people.salario:gerenciar";

export class TrilhaDto {
  @IsString() @MaxLength(120) nome!: string;
  @IsOptional() @IsString() @MaxLength(500) descricao?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

export class DegrauDto {
  @IsString() positionId!: string;
  // 600 meses = 50 anos. Teto existe para barrar dedo escorregado no
  // formulário, não para julgar a política de carreira de ninguém.
  @IsOptional() @IsInt() @Min(0) @Max(600) mesesMinimos?: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(5) notaMinima?: number | null;
  @IsOptional() @IsString() @MaxLength(500) observacoes?: string;
}

export class ReordenarDto {
  @IsString({ each: true }) ids!: string[];
}

export class RequisitoDto {
  @IsIn(TIPOS_REQUISITO as unknown as string[]) tipo!: string;
  @IsOptional() @IsString() skillId?: string;
  @IsOptional() @IsIn(NIVEIS_COMPETENCIA as unknown as string[]) nivelMinimo?: string;
  @IsOptional() @IsString() trainingId?: string;
  @IsOptional() @IsString() @MaxLength(300) descricao?: string;
  @IsOptional() @IsBoolean() obrigatorio?: boolean;
}

export class DefinirTrilhaDto {
  /** Nulo desfaz a atribuição e devolve o colaborador à inferência pelo cargo. */
  @IsOptional() @IsString() careerTrackId?: string | null;
}

export class PromoverDto {
  /** Degrau de destino. Exigido para não promover "para o próximo" às cegas. */
  @IsString() stepId!: string;
  @IsOptional() @IsString() @MaxLength(500) motivo?: string;
  /**
   * Novo salário, opcional.
   *
   * Existe porque promover sem mexer no salário deixava a pessoa ABAIXO DA
   * FAIXA do cargo novo até alguém lembrar de registrar o valor — e o painel
   * de remuneração passava a acusá-la como fora da faixa por causa da própria
   * promoção. Continua opcional: promoção sem aumento é decisão legítima.
   *
   * Exige `people.salario:gerenciar` ALÉM das permissões de promover. Quem
   * conduz carreira não necessariamente decide remuneração.
   */
  @IsOptional() @IsNumber() @Min(0.01) novoSalario?: number;
}

@Injectable()
export class CareerService {
  private readonly logger = new Logger(CareerService.name);

  constructor(
    private readonly repo: CareerRepository,
    private readonly escopo: PeopleScopeService,
    private readonly audit: AuditService,
    // A promoção troca o cargo pelo MESMO caminho de sempre, em vez de escrever
    // direto no repositório: histórico, auditoria e evento de domínio precisam
    // acontecer uma vez só, num lugar só.
    private readonly employees: EmployeeService,
    private readonly historicoFuncional: EmployeeHistoryRepository,
    // Mesmo motivo de delegar o cargo ao EmployeeService: o registro salarial
    // tem validação, histórico e auditoria próprios, e não pode ter dois donos.
    private readonly salarios: SalaryService,
  ) {}

  /* ── Trilhas ────────────────────────────────────────────────────────────── */

  async listarTrilhas(user: UsuarioContexto, incluirInativas = false) {
    const organizationId = this.exigirOrganizacao(user);
    const [trilhas, porCargo] = await Promise.all([
      this.repo.listarTrilhas(organizationId, incluirInativas),
      this.repo.contarPorCargo(organizationId),
    ]);

    return {
      success: true,
      data: trilhas.map((t: any) => ({
        ...t,
        degraus: t.degraus.map((d: any) => ({
          ...d,
          // Quantas pessoas estão neste degrau hoje: sem isso a trilha é um
          // desenho sem gente dentro.
          colaboradores: porCargo.get(d.positionId) ?? 0,
        })),
      })),
    };
  }

  async criarTrilha(user: UsuarioContexto, dto: TrilhaDto) {
    const organizationId = this.exigirOrganizacao(user);
    const nome = dto.nome.trim();

    if (await this.repo.nomeTrilhaEmUso(organizationId, nome)) {
      throw new ConflictException(`Já existe uma trilha chamada "${nome}".`);
    }

    const criada = await this.repo.criarTrilha({
      organizationId,
      nome,
      descricao: dto.descricao?.trim() || null,
      criadoPorId: user.id ?? null,
    });
    await this.auditar(user, criada.id, "criar", `Trilha de carreira "${nome}" criada`);

    return { success: true, data: criada };
  }

  async atualizarTrilha(user: UsuarioContexto, id: string, dto: TrilhaDto) {
    const organizationId = this.exigirOrganizacao(user);
    const atual = await this.repo.obterTrilha(id, organizationId);
    if (!atual) throw new NotFoundException("Trilha não encontrada");

    const nome = dto.nome.trim();
    if (await this.repo.nomeTrilhaEmUso(organizationId, nome, id)) {
      throw new ConflictException(`Já existe uma trilha chamada "${nome}".`);
    }

    const salva = await this.repo.atualizarTrilha(id, {
      nome,
      descricao: dto.descricao?.trim() || null,
      ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
      atualizadoPorId: user.id ?? null,
    });
    await this.auditar(user, id, "editar", `Trilha de carreira "${nome}" editada`);

    return { success: true, data: salva };
  }

  async excluirTrilha(user: UsuarioContexto, id: string) {
    const organizationId = this.exigirOrganizacao(user);
    const trilha = await this.repo.obterTrilha(id, organizationId);
    if (!trilha) throw new NotFoundException("Trilha não encontrada");

    await this.repo.excluirTrilha(id);
    await this.auditar(user, id, "excluir", `Trilha de carreira "${trilha.nome}" excluída`);

    return { success: true, data: { id } };
  }

  /* ── Degraus ────────────────────────────────────────────────────────────── */

  async adicionarDegrau(user: UsuarioContexto, trackId: string, dto: DegrauDto) {
    const organizationId = this.exigirOrganizacao(user);
    const trilha = await this.repo.obterTrilha(trackId, organizationId);
    if (!trilha) throw new NotFoundException("Trilha não encontrada");

    if (await this.repo.cargoJaNaTrilha(trackId, dto.positionId)) {
      throw new ConflictException(
        "Este cargo já é um degrau desta trilha. O degrau atual de cada pessoa é " +
        "descoberto pelo cargo, e repetição tornaria essa descoberta ambígua.",
      );
    }

    const criado = await this.repo.criarDegrau({
      organizationId,
      trackId,
      positionId: dto.positionId,
      ordem: await this.repo.proximaOrdem(trackId),
      mesesMinimos: dto.mesesMinimos ?? null,
      notaMinima: dto.notaMinima ?? null,
      observacoes: dto.observacoes?.trim() || null,
      criadoPorId: user.id ?? null,
    });
    await this.auditar(user, criado.id, "criar", `Degrau adicionado à trilha "${trilha.nome}"`);

    return { success: true, data: criado };
  }

  async atualizarDegrau(user: UsuarioContexto, id: string, dto: DegrauDto) {
    const organizationId = this.exigirOrganizacao(user);
    const degrau = await this.repo.obterDegrau(id, organizationId);
    if (!degrau) throw new NotFoundException("Degrau não encontrado");

    if (
      dto.positionId !== degrau.positionId &&
      (await this.repo.cargoJaNaTrilha(degrau.trackId, dto.positionId, id))
    ) {
      throw new ConflictException("Este cargo já é um degrau desta trilha.");
    }

    const salvo = await this.repo.atualizarDegrau(id, {
      positionId: dto.positionId,
      mesesMinimos: dto.mesesMinimos ?? null,
      notaMinima: dto.notaMinima ?? null,
      observacoes: dto.observacoes?.trim() || null,
    });
    await this.auditar(user, id, "editar", `Degrau da trilha "${degrau.track?.nome}" editado`);

    return { success: true, data: salvo };
  }

  async removerDegrau(user: UsuarioContexto, id: string) {
    const organizationId = this.exigirOrganizacao(user);
    const degrau = await this.repo.obterDegrau(id, organizationId);
    if (!degrau) throw new NotFoundException("Degrau não encontrado");

    await this.repo.excluirDegrau(id);

    // Renumera o que sobrou: buraco na sequência faz a tela mostrar
    // "degrau 3 de 3" para o penúltimo, o que parece defeito.
    const restantes = await this.repo.degrausDaTrilha(degrau.trackId);
    if (restantes.length) {
      await this.repo.reordenar(
        degrau.trackId,
        restantes.map((d: any, i: number) => ({ id: d.id, ordem: i + 1 })),
      );
    }

    await this.auditar(user, id, "excluir", `Degrau removido da trilha "${degrau.track?.nome}"`);
    return { success: true, data: { id } };
  }

  async reordenarDegraus(user: UsuarioContexto, trackId: string, dto: ReordenarDto) {
    const organizationId = this.exigirOrganizacao(user);
    const trilha = await this.repo.obterTrilha(trackId, organizationId);
    if (!trilha) throw new NotFoundException("Trilha não encontrada");

    const existentes = new Set(trilha.degraus.map((d: any) => d.id));
    if (dto.ids.length !== existentes.size || dto.ids.some(id => !existentes.has(id))) {
      throw new BadRequestException(
        "A nova ordem precisa conter exatamente os degraus desta trilha.",
      );
    }

    await this.repo.reordenar(trackId, dto.ids.map((id, i) => ({ id, ordem: i + 1 })));
    await this.auditar(user, trackId, "editar", `Degraus da trilha "${trilha.nome}" reordenados`);

    return { success: true, data: await this.repo.obterTrilha(trackId, organizationId) };
  }

  /* ── Requisitos ─────────────────────────────────────────────────────────── */

  async adicionarRequisito(user: UsuarioContexto, stepId: string, dto: RequisitoDto) {
    const organizationId = this.exigirOrganizacao(user);
    const degrau = await this.repo.obterDegrau(stepId, organizationId);
    if (!degrau) throw new NotFoundException("Degrau não encontrado");

    const validacao = validarRequisito(dto);
    if (!validacao.valido) throw new BadRequestException(validacao.detalhe);

    const nivel = validarNivelMinimo(dto.nivelMinimo);
    if (!nivel.valido) throw new BadRequestException(nivel.detalhe);

    const criado = await this.repo.criarRequisito({
      organizationId,
      stepId,
      tipo: dto.tipo,
      // Só o alvo do próprio tipo é gravado: guardar skillId num requisito de
      // treinamento deixaria lixo que uma futura mudança de tipo ressuscitaria.
      skillId: dto.tipo === "competencia" ? dto.skillId ?? null : null,
      nivelMinimo: dto.tipo === "competencia" ? dto.nivelMinimo ?? null : null,
      trainingId: dto.tipo === "treinamento" ? dto.trainingId ?? null : null,
      descricao: dto.descricao?.trim() || null,
      obrigatorio: dto.obrigatorio ?? true,
      criadoPorId: user.id ?? null,
    });
    await this.auditar(user, criado.id, "criar", `Requisito adicionado ao degrau de "${degrau.position?.titulo}"`);

    return { success: true, data: criado };
  }

  async removerRequisito(user: UsuarioContexto, id: string) {
    const organizationId = this.exigirOrganizacao(user);
    const requisito = await this.repo.obterRequisito(id, organizationId);
    if (!requisito) throw new NotFoundException("Requisito não encontrado");

    await this.repo.excluirRequisito(id);
    await this.auditar(user, id, "excluir", "Requisito de carreira removido");

    return { success: true, data: { id } };
  }

  /* ── Carreira do colaborador ────────────────────────────────────────────── */

  /**
   * Onde a pessoa está, para onde vai e o que falta.
   *
   * Devolve `trilha: null` sem erro quando não há trilha: não ter plano de
   * carreira definido é um estado normal, não uma falha, e a tela precisa
   * distinguir "não configurado" de "deu errado".
   */
  async situacao(user: UsuarioContexto, collaboratorId: string) {
    const organizationId = this.exigirOrganizacao(user);
    await this.exigirEscopo(user, collaboratorId);

    const colaborador = await this.repo.colaborador(collaboratorId, organizationId);
    if (!colaborador) throw new NotFoundException("Colaborador não encontrado");

    const { trilha, inferida } = await this.resolverTrilha(organizationId, colaborador);
    if (!trilha) {
      return {
        success: true,
        data: {
          trilha: null,
          inferida: false,
          motivo: colaborador.positionId
            ? "O cargo atual não faz parte de nenhuma trilha ativa."
            : "O colaborador não tem cargo do catálogo definido.",
          degrauAtual: null, proximoDegrau: null, prontidao: null,
        },
      };
    }

    const degraus = trilha.degraus.map((d: any) => ({
      id: d.id, ordem: d.ordem, positionId: d.positionId,
      mesesMinimos: d.mesesMinimos, notaMinima: d.notaMinima,
    }));

    const atual = degrauAtual(degraus, colaborador.positionId);
    const proximo = proximoDegrau(degraus, atual);
    const degrauProximo = proximo ? trilha.degraus.find((d: any) => d.id === proximo.id) : null;

    const [competencias, treinamentos, ultimaNota, desde] = await Promise.all([
      this.repo.competenciasDo(collaboratorId),
      this.repo.treinamentosConcluidosDe(collaboratorId),
      this.repo.ultimaNotaDe(collaboratorId),
      this.repo.desdeQuandoNoCargo(collaboratorId, colaborador.positionId),
    ]);

    const requisitos: Requisito[] = (degrauProximo?.requisitos ?? []).map((r: any) => ({
      id: r.id, tipo: r.tipo, obrigatorio: r.obrigatorio,
      skillId: r.skillId, nivelMinimo: r.nivelMinimo, trainingId: r.trainingId,
      descricao: r.descricao,
      skillNome: r.skill?.nome ?? null,
      trainingNome: r.training?.nome ?? null,
    }));

    const mesesNoDegrau = desde ? this.mesesEntre(desde, new Date()) : null;

    // Sem próximo degrau não há prontidão a calcular: a pessoa está no topo da
    // trilha, que é uma conclusão, não uma pendência de 0%.
    const prontidao = proximo
      ? avaliarProntidao(
          { mesesMinimos: proximo.mesesMinimos, notaMinima: proximo.notaMinima },
          requisitos,
          { competencias, treinamentos, mesesNoDegrau, ultimaNota },
        )
      : null;

    return {
      success: true,
      data: {
        trilha: { id: trilha.id, nome: trilha.nome, descricao: trilha.descricao },
        inferida,
        motivo: null,
        noTopo: !!atual && !proximo,
        foraDaTrilha: !atual,
        mesesNoCargo: mesesNoDegrau,
        desdeNoCargo: desde,
        ultimaNota,
        totalDegraus: degraus.length,
        degraus: trilha.degraus.map((d: any) => ({
          id: d.id, ordem: d.ordem,
          cargo: d.position?.titulo ?? null,
          nivel: d.position?.nivel ?? null,
          atual: d.id === atual?.id,
          mesesMinimos: d.mesesMinimos,
          notaMinima: d.notaMinima,
          totalRequisitos: (d.requisitos ?? []).length,
        })),
        degrauAtual: atual
          ? { id: atual.id, ordem: atual.ordem, cargo: colaborador.position?.titulo ?? null }
          : null,
        proximoDegrau: degrauProximo
          ? {
              id: degrauProximo.id,
              ordem: degrauProximo.ordem,
              cargo: degrauProximo.position?.titulo ?? null,
              observacoes: degrauProximo.observacoes,
            }
          : null,
        prontidao,
      },
    };
  }

  /**
   * Promove o colaborador para um degrau da trilha.
   *
   * O que isto faz de fato é TROCAR O CARGO — e a troca é delegada ao
   * EmployeeService, não reimplementada aqui. Duplicar a escrita criaria dois
   * caminhos para o mesmo fato: um gravando histórico, auditoria e evento de
   * domínio, e outro esquecendo algum dos três conforme quem mexesse por
   * último. O cargo sempre foi governado por um campo só; a promoção usa a
   * mesma porta.
   *
   * Sobre a prontidão: ela NÃO é exigida. O sistema calcula o que falta, quem
   * decide é gente — travar a promoção em cima de um checklist automático
   * inverteria os papéis, e o item que mais pesa numa promoção costuma ser
   * justamente o de conferência manual.
   */
  async promover(user: UsuarioContexto, collaboratorId: string, dto: PromoverDto) {
    const organizationId = this.exigirOrganizacao(user);
    await this.exigirEscopo(user, collaboratorId);

    const colaborador = await this.repo.colaborador(collaboratorId, organizationId);
    if (!colaborador) throw new NotFoundException("Colaborador não encontrado");

    const destino = await this.repo.obterDegrau(dto.stepId, organizationId);
    if (!destino) throw new NotFoundException("Degrau não encontrado");

    const { trilha } = await this.resolverTrilha(organizationId, colaborador);
    if (!trilha || destino.trackId !== trilha.id) {
      throw new BadRequestException(
        "O degrau escolhido não pertence à trilha deste colaborador.",
      );
    }

    const degraus = trilha.degraus.map((d: any) => ({
      id: d.id, ordem: d.ordem, positionId: d.positionId,
    }));
    const atual = degrauAtual(degraus, colaborador.positionId);

    if (atual && destino.ordem <= atual.ordem) {
      // Descer de degrau existe (rebaixamento, enquadramento), mas não é
      // promoção e não deve entrar pela porta que grava "promoção" no histórico.
      throw new BadRequestException(
        "O degrau escolhido não está à frente do atual. Para mover para trás, edite o cargo.",
      );
    }

    // A permissão do salário é conferida ANTES de trocar o cargo: promover e
    // depois falhar no salário deixaria a pessoa no cargo novo com o salário
    // antigo — exatamente o estado que este parâmetro existe para evitar.
    if (dto.novoSalario !== undefined) {
      const perms: string[] = user?.permissions ?? [];
      const podeSalario =
        !!(user as any)?.isMaster || perms.includes("*") || perms.includes(PERMISSAO_SALARIO);
      if (!podeSalario) {
        throw new ForbiddenException(
          "Ajustar o salário na promoção exige a permissão de remuneração. " +
          "Promova sem o valor e peça a quem tem a permissão para registrá-lo.",
        );
      }
    }

    const antes = colaborador.position?.titulo ?? "sem cargo";
    await this.employees.atualizar(user, collaboratorId, { positionId: destino.positionId } as any);

    // O salário vai DEPOIS da troca de cargo, de propósito: o registro salarial
    // grava o cargo do momento, e gravá-lo antes atribuiria o valor novo ao
    // cargo antigo no histórico.
    if (dto.novoSalario !== undefined) {
      await this.salarios.registrar(user, collaboratorId, {
        valor: dto.novoSalario,
        vigenciaInicio: new Date().toISOString().slice(0, 10),
        motivo: "promocao",
      } as any);
    }

    // Evento próprio ALÉM do `mudanca_cargo` que o EmployeeService grava: a
    // troca de cargo diz o quê, este diz por quê e sob qual plano.
    await this.historicoFuncional.registrar({
      organizationId,
      collaboratorId,
      evento: "promocao",
      descricao:
        `Promoção na trilha "${trilha.nome}": ${antes} → ${destino.position?.titulo ?? "—"}` +
        (dto.motivo?.trim() ? ` — ${dto.motivo.trim()}` : ""),
      registradoPorId: user.id ?? null,
    });

    await this.auditar(
      user, collaboratorId, "editar",
      `Promoção para "${destino.position?.titulo}" na trilha "${trilha.nome}"`,
      "collaborators",
    );

    return {
      success: true,
      data: { collaboratorId, positionId: destino.positionId, degrauId: destino.id },
    };
  }

  async definirTrilhaDoColaborador(user: UsuarioContexto, collaboratorId: string, dto: DefinirTrilhaDto) {
    const organizationId = this.exigirOrganizacao(user);
    await this.exigirEscopo(user, collaboratorId);

    const colaborador = await this.repo.colaborador(collaboratorId, organizationId);
    if (!colaborador) throw new NotFoundException("Colaborador não encontrado");

    const trackId = dto.careerTrackId || null;
    if (trackId) {
      const trilha = await this.repo.obterTrilha(trackId, organizationId);
      if (!trilha) throw new NotFoundException("Trilha não encontrada");
    }

    const salvo = await this.repo.definirTrilha(collaboratorId, trackId, user.id ?? null);
    await this.auditar(
      user, collaboratorId, "editar",
      trackId ? "Trilha de carreira atribuída" : "Trilha de carreira removida",
      "collaborators",
    );

    return { success: true, data: salvo };
  }

  /* ── Auxiliares ─────────────────────────────────────────────────────────── */

  /**
   * Trilha explícita ou inferida pelo cargo.
   *
   * A inferência só decide quando há UMA trilha com aquele cargo. Com duas,
   * escolher a primeira seria chutar em silêncio — e a tela precisa poder dizer
   * "defina a trilha" em vez de mostrar um plano que talvez não seja o dela.
   */
  private async resolverTrilha(organizationId: string, colaborador: any) {
    if (colaborador.careerTrackId) {
      const trilha = await this.repo.obterTrilha(colaborador.careerTrackId, organizationId);
      if (trilha) return { trilha, inferida: false };
    }

    if (!colaborador.positionId) return { trilha: null, inferida: false };

    const candidatas = await this.repo.trilhasComCargo(organizationId, colaborador.positionId);
    if (candidatas.length !== 1) return { trilha: null, inferida: false };

    const trilha = await this.repo.obterTrilha(candidatas[0].id, organizationId);
    return { trilha, inferida: true };
  }

  /** Meses completos entre duas datas. Meia dúzia de dias a mais não conta mês. */
  private mesesEntre(de: Date, ate: Date): number {
    const inicio = new Date(de);
    let meses = (ate.getFullYear() - inicio.getFullYear()) * 12 + (ate.getMonth() - inicio.getMonth());
    if (ate.getDate() < inicio.getDate()) meses -= 1;
    return Math.max(0, meses);
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
    user: UsuarioContexto,
    registroId: string,
    acao: string,
    descricao: string,
    tabela = "career_tracks",
  ) {
    try {
      await this.audit.log({
        organizationId: user.organizationId,
        userId: user.id ?? null,
        modulo: "people",
        tabela,
        registroId,
        acao,
        descricao,
      });
    } catch (erro) {
      this.logger.error(`Falha ao auditar ${acao} de ${registroId}`, erro as Error);
    }
  }
}
