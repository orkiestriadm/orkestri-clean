import {
  Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger,
} from "@nestjs/common";
import {
  IsString, IsOptional, IsNumber, IsDateString, IsIn, MaxLength, Min,
} from "class-validator";
import { BenefitRepository } from "../infrastructure/benefit.repository";
import { EmployeeHistoryRepository } from "../infrastructure/employee-history.repository";
import { PeopleScopeService, UsuarioContexto } from "./people-scope.service";
import { AuditService } from "../../audit/audit.module";
import {
  BENEFIT_CATEGORIES, validarConcessao, estaVigente, custoVigente,
} from "../domain/benefit.entity";

/**
 * Benefícios — catálogo da organização e concessão à pessoa.
 *
 * O catálogo não tem escopo por colaborador: é da organização, e quem pode ver
 * benefícios vê a lista inteira. A concessão tem, porque é dado da pessoa —
 * salário indireto é informação sensível.
 */

export class CriarBeneficioDto {
  @IsString() @MaxLength(120) nome!: string;
  @IsIn(BENEFIT_CATEGORIES as unknown as string[]) categoria!: string;
  @IsOptional() @IsString() @MaxLength(500) descricao?: string;
  @IsOptional() @IsNumber() @Min(0) valorReferencia?: number;
}

export class AtualizarBeneficioDto {
  @IsOptional() @IsString() @MaxLength(120) nome?: string;
  @IsOptional() @IsIn(BENEFIT_CATEGORIES as unknown as string[]) categoria?: string;
  @IsOptional() @IsString() @MaxLength(500) descricao?: string;
  @IsOptional() @IsNumber() @Min(0) valorReferencia?: number;
  @IsOptional() ativo?: boolean;
}

export class ConcederDto {
  @IsString() benefitId!: string;
  @IsDateString() inicio!: string;
  @IsOptional() @IsDateString() fim?: string;
  @IsOptional() @IsNumber() @Min(0) valor?: number;
  @IsOptional() @IsString() @MaxLength(500) observacoes?: string;
}

export class EncerrarDto {
  @IsDateString() fim!: string;
  @IsOptional() @IsString() @MaxLength(500) observacoes?: string;
}

@Injectable()
export class BenefitService {
  private readonly logger = new Logger(BenefitService.name);

  constructor(
    private readonly repo: BenefitRepository,
    private readonly historico: EmployeeHistoryRepository,
    private readonly escopo: PeopleScopeService,
    private readonly audit: AuditService,
  ) {}

  /* ── Catálogo ─────────────────────────────────────────────────────────── */

  async listarCatalogo(user: UsuarioContexto, incluirInativos = false) {
    const organizationId = this.exigirOrganizacao(user);
    const itens = await this.repo.listarCatalogo(organizationId, incluirInativos);
    return {
      success: true,
      data: itens.map((b: any) => ({
        ...b,
        concessoes: b._count?.concessoes ?? 0,
        _count: undefined,
      })),
    };
  }

  async criarBeneficio(user: UsuarioContexto, dto: CriarBeneficioDto) {
    const organizationId = this.exigirOrganizacao(user);
    const nome = dto.nome.trim();
    if (!nome) throw new BadRequestException("Informe o nome do benefício");

    if (await this.repo.nomeEmUso(organizationId, nome)) {
      throw new BadRequestException("Já existe um benefício com este nome");
    }

    const criado = await this.repo.criarBeneficio({
      organizationId,
      nome,
      categoria: dto.categoria,
      descricao: dto.descricao?.trim() || null,
      valorReferencia: dto.valorReferencia ?? null,
      criadoPorId: user.id ?? null,
    });

    await this.auditar(user, criado.id, "criar", `Benefício "${nome}" criado`, "benefits");
    return { success: true, data: criado };
  }

  async atualizarBeneficio(user: UsuarioContexto, id: string, dto: AtualizarBeneficioDto) {
    const organizationId = this.exigirOrganizacao(user);
    const atual = await this.repo.obterBeneficio(id, organizationId);
    if (!atual) throw new NotFoundException("Benefício não encontrado");

    if (dto.nome && dto.nome.trim() !== atual.nome) {
      if (await this.repo.nomeEmUso(organizationId, dto.nome.trim(), id)) {
        throw new BadRequestException("Já existe um benefício com este nome");
      }
    }

    const atualizado = await this.repo.atualizarBeneficio(id, {
      ...(dto.nome !== undefined ? { nome: dto.nome.trim() } : {}),
      ...(dto.categoria !== undefined ? { categoria: dto.categoria } : {}),
      ...(dto.descricao !== undefined ? { descricao: dto.descricao?.trim() || null } : {}),
      ...(dto.valorReferencia !== undefined ? { valorReferencia: dto.valorReferencia } : {}),
      ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
      atualizadoPorId: user.id ?? null,
    });

    await this.auditar(user, id, "editar", `Benefício "${atual.nome}" atualizado`, "benefits");
    return { success: true, data: atualizado };
  }

  async excluirBeneficio(user: UsuarioContexto, id: string) {
    const organizationId = this.exigirOrganizacao(user);
    const atual = await this.repo.obterBeneficio(id, organizationId);
    if (!atual) throw new NotFoundException("Benefício não encontrado");

    // Concessão passada é registro trabalhista. Apagar o benefício apagaria o
    // histórico de quem o recebeu — desativar tira dos seletores e preserva.
    const concedido = await this.repo.contarConcessoes(id);
    if (concedido > 0) {
      throw new BadRequestException(
        `Este benefício já foi concedido ${concedido} vez(es) e faz parte do histórico. ` +
        `Desative-o em vez de excluir.`,
      );
    }

    await this.repo.excluirBeneficio(id, user.id ?? null);
    await this.auditar(user, id, "excluir", `Benefício "${atual.nome}" excluído`, "benefits");
    return { success: true, data: { id } };
  }

  /* ── Concessões ───────────────────────────────────────────────────────── */

  async listarDoColaborador(user: UsuarioContexto, collaboratorId: string) {
    const organizationId = this.exigirOrganizacao(user);
    await this.exigirEscopo(user, collaboratorId);

    const concessoes = await this.repo.listarConcessoes(collaboratorId, organizationId);
    const hoje = new Date();

    return {
      success: true,
      data: {
        itens: concessoes.map((c: any) => ({
          ...c,
          vigente: estaVigente({ inicio: c.inicio, fim: c.fim }, hoje),
        })),
        custoMensalVigente: custoVigente(
          concessoes.map((c: any) => ({ inicio: c.inicio, fim: c.fim, valor: c.valor })),
          hoje,
        ),
      },
    };
  }

  async conceder(user: UsuarioContexto, collaboratorId: string, dto: ConcederDto) {
    const organizationId = this.exigirOrganizacao(user);
    await this.exigirEscopo(user, collaboratorId);

    const beneficio = await this.repo.obterBeneficio(dto.benefitId, organizationId);
    if (!beneficio) throw new NotFoundException("Benefício não encontrado");
    if (!beneficio.ativo) {
      throw new BadRequestException(
        `O benefício "${beneficio.nome}" está desativado e não pode ser concedido.`,
      );
    }

    const existentes = await this.repo.concessoesDoBeneficio(collaboratorId, dto.benefitId);
    const validacao = validarConcessao({
      inicio: new Date(dto.inicio),
      fim: dto.fim ? new Date(dto.fim) : null,
      valor: dto.valor ?? null,
      existentes: existentes.map((e: any) => ({ inicio: e.inicio, fim: e.fim })),
    });
    if (!validacao.valido) throw new BadRequestException(validacao.detalhe);

    const criada = await this.repo.criarConcessao({
      organizationId,
      collaboratorId,
      benefitId: dto.benefitId,
      inicio: new Date(dto.inicio),
      fim: dto.fim ? new Date(dto.fim) : null,
      // Sem valor informado, herda o de referência do catálogo — mas gravado,
      // porque mudar a referência depois não pode reescrever concessão antiga.
      valor: dto.valor ?? beneficio.valorReferencia ?? null,
      observacoes: dto.observacoes?.trim() || null,
      criadoPorId: user.id ?? null,
    });

    await this.historico.registrar({
      organizationId,
      collaboratorId,
      evento: "outro",
      descricao: `Benefício concedido: ${beneficio.nome}`,
      registradoPorId: user.id ?? null,
    });
    await this.auditar(
      user, criada.id, "criar",
      `Benefício "${beneficio.nome}" concedido`, "collaborator_benefits",
    );

    return { success: true, data: criada };
  }

  async encerrar(user: UsuarioContexto, id: string, dto: EncerrarDto) {
    const organizationId = this.exigirOrganizacao(user);
    const concessao = await this.repo.obterConcessao(id, organizationId);
    if (!concessao) throw new NotFoundException("Concessão não encontrada");
    await this.exigirEscopo(user, concessao.collaboratorId);

    if (concessao.fim) {
      throw new BadRequestException("Esta concessão já foi encerrada.");
    }

    const fim = new Date(dto.fim);
    const validacao = validarConcessao({ inicio: concessao.inicio, fim });
    if (!validacao.valido) throw new BadRequestException(validacao.detalhe);

    const atualizada = await this.repo.atualizarConcessao(id, {
      fim,
      ...(dto.observacoes !== undefined ? { observacoes: dto.observacoes?.trim() || null } : {}),
      atualizadoPorId: user.id ?? null,
    });

    await this.historico.registrar({
      organizationId,
      collaboratorId: concessao.collaboratorId,
      evento: "outro",
      descricao:
        `Benefício encerrado: ${concessao.benefit?.nome ?? "—"} ` +
        `em ${fim.toLocaleDateString("pt-BR")}`,
      registradoPorId: user.id ?? null,
    });
    await this.auditar(
      user, id, "editar",
      `Benefício "${concessao.benefit?.nome ?? "—"}" encerrado`, "collaborator_benefits",
    );

    return { success: true, data: atualizada };
  }

  /* ── Auxiliares ───────────────────────────────────────────────────────── */

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
    user: UsuarioContexto, registroId: string, acao: string, descricao: string, tabela: string,
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
