import {
  Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger,
} from "@nestjs/common";
import {
  IsString, IsOptional, IsNumber, IsDateString, IsInt, IsIn, MaxLength, Min, Max,
} from "class-validator";
import { DevelopmentRepository } from "../infrastructure/development.repository";
import { EmployeeHistoryRepository } from "../infrastructure/employee-history.repository";
import { PeopleScopeService, UsuarioContexto } from "./people-scope.service";
import { AuditService } from "../../audit/audit.module";
import {
  TRAINING_STATUS, REVIEW_STATUS, StatusTreinamento, podeTransicionar,
  statusTreinamentoValido, calcularValidade, situacaoCertificacao,
  validarAvaliacao, progressoPonderado, DIAS_ALERTA_CERTIFICACAO, diasEntre,
  NOTA_MINIMA, NOTA_MAXIMA,
} from "../domain/development.entity";

/** Treinamentos, certificações e avaliação de desempenho. */

export class CriarCursoDto {
  @IsString() @MaxLength(160) nome!: string;
  @IsOptional() @IsString() @MaxLength(120) fornecedor?: string;
  @IsOptional() @IsString() @MaxLength(60) categoria?: string;
  @IsOptional() @IsInt() @Min(1) cargaHoraria?: number;
  @IsOptional() @IsInt() @Min(1) validadeMeses?: number;
  @IsOptional() @IsString() @MaxLength(500) descricao?: string;
}

export class AtualizarCursoDto extends CriarCursoDto {
  @IsOptional() @IsString() @MaxLength(160) nome!: string;
  @IsOptional() ativo?: boolean;
}

export class RegistrarTreinamentoDto {
  @IsString() trainingId!: string;
  @IsOptional() @IsIn(Object.values(TRAINING_STATUS)) status?: string;
  @IsOptional() @IsDateString() inicio?: string;
  @IsOptional() @IsDateString() conclusao?: string;
  @IsOptional() @IsString() @MaxLength(160) certificadoRef?: string;
  @IsOptional() @IsNumber() nota?: number;
  @IsOptional() @IsString() @MaxLength(500) observacoes?: string;
}

export class AtualizarTreinamentoDto {
  @IsOptional() @IsIn(Object.values(TRAINING_STATUS)) status?: string;
  @IsOptional() @IsDateString() inicio?: string;
  @IsOptional() @IsDateString() conclusao?: string;
  @IsOptional() @IsString() @MaxLength(160) certificadoRef?: string;
  @IsOptional() @IsNumber() nota?: number;
  @IsOptional() @IsString() @MaxLength(500) observacoes?: string;
}

export class SalvarAvaliacaoDto {
  @IsString() @MaxLength(10) ciclo!: string;
  @IsOptional() @IsString() avaliadorId?: string;
  @IsOptional() @IsNumber() @Min(NOTA_MINIMA) @Max(NOTA_MAXIMA) nota?: number;
  @IsOptional() @IsString() @MaxLength(2000) pontosFortes?: string;
  @IsOptional() @IsString() @MaxLength(2000) pontosMelhoria?: string;
  @IsOptional() @IsString() @MaxLength(2000) comentarios?: string;
}

export class CriarMetaDto {
  @IsString() @MaxLength(160) titulo!: string;
  @IsOptional() @IsString() @MaxLength(500) descricao?: string;
  @IsOptional() @IsInt() @Min(1) @Max(10) peso?: number;
  @IsOptional() @IsDateString() prazo?: string;
}

export class AtualizarMetaDto {
  @IsOptional() @IsString() @MaxLength(160) titulo?: string;
  @IsOptional() @IsString() @MaxLength(500) descricao?: string;
  @IsOptional() @IsInt() @Min(1) @Max(10) peso?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) progresso?: number;
  @IsOptional() @IsDateString() prazo?: string;
}

@Injectable()
export class DevelopmentService {
  private readonly logger = new Logger(DevelopmentService.name);

  constructor(
    private readonly repo: DevelopmentRepository,
    private readonly historico: EmployeeHistoryRepository,
    private readonly escopo: PeopleScopeService,
    private readonly audit: AuditService,
  ) {}

  /* ── Catálogo de cursos ───────────────────────────────────────────────── */

  async listarCursos(user: UsuarioContexto, incluirInativos = false) {
    const organizationId = this.exigirOrganizacao(user);
    const cursos = await this.repo.listarCursos(organizationId, incluirInativos);
    return {
      success: true,
      data: cursos.map((c: any) => ({
        ...c,
        participacoes: c._count?.participacoes ?? 0,
        _count: undefined,
      })),
    };
  }

  async criarCurso(user: UsuarioContexto, dto: CriarCursoDto) {
    const organizationId = this.exigirOrganizacao(user);
    const nome = dto.nome.trim();
    if (!nome) throw new BadRequestException("Informe o nome do curso");

    if (await this.repo.nomeCursoEmUso(organizationId, nome)) {
      throw new BadRequestException("Já existe um curso com este nome");
    }

    const criado = await this.repo.criarCurso({
      organizationId,
      nome,
      categoria: dto.categoria?.trim() || "outro",
      fornecedor: dto.fornecedor?.trim() || null,
      cargaHoraria: dto.cargaHoraria ?? null,
      validadeMeses: dto.validadeMeses ?? null,
      descricao: dto.descricao?.trim() || null,
      criadoPorId: user.id ?? null,
    });

    await this.auditar(user, criado.id, "criar", `Curso "${nome}" criado`, "training_courses");
    return { success: true, data: criado };
  }

  async atualizarCurso(user: UsuarioContexto, id: string, dto: AtualizarCursoDto) {
    const organizationId = this.exigirOrganizacao(user);
    const atual = await this.repo.obterCurso(id, organizationId);
    if (!atual) throw new NotFoundException("Curso não encontrado");

    if (dto.nome && dto.nome.trim() !== atual.nome) {
      if (await this.repo.nomeCursoEmUso(organizationId, dto.nome.trim(), id)) {
        throw new BadRequestException("Já existe um curso com este nome");
      }
    }

    const atualizado = await this.repo.atualizarCurso(id, {
      ...(dto.nome !== undefined ? { nome: dto.nome.trim() } : {}),
      ...(dto.categoria !== undefined ? { categoria: dto.categoria?.trim() || "outro" } : {}),
      ...(dto.fornecedor !== undefined ? { fornecedor: dto.fornecedor?.trim() || null } : {}),
      ...(dto.cargaHoraria !== undefined ? { cargaHoraria: dto.cargaHoraria } : {}),
      ...(dto.validadeMeses !== undefined ? { validadeMeses: dto.validadeMeses } : {}),
      ...(dto.descricao !== undefined ? { descricao: dto.descricao?.trim() || null } : {}),
      ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
      atualizadoPorId: user.id ?? null,
    });

    await this.auditar(user, id, "editar", `Curso "${atual.nome}" atualizado`, "training_courses");
    return { success: true, data: atualizado };
  }

  async excluirCurso(user: UsuarioContexto, id: string) {
    const organizationId = this.exigirOrganizacao(user);
    const atual = await this.repo.obterCurso(id, organizationId);
    if (!atual) throw new NotFoundException("Curso não encontrado");

    const usos = await this.repo.contarParticipacoes(id);
    if (usos > 0) {
      throw new BadRequestException(
        `Este curso tem ${usos} participação(ões) registrada(s) e faz parte do histórico. ` +
        `Desative-o em vez de excluir.`,
      );
    }

    await this.repo.excluirCurso(id, user.id ?? null);
    await this.auditar(user, id, "excluir", `Curso "${atual.nome}" excluído`, "training_courses");
    return { success: true, data: { id } };
  }

  /* ── Participações ────────────────────────────────────────────────────── */

  async listarTreinamentos(user: UsuarioContexto, collaboratorId: string) {
    const organizationId = this.exigirOrganizacao(user);
    await this.exigirEscopo(user, collaboratorId);

    const itens = await this.repo.listarParticipacoes(collaboratorId, organizationId);
    const hoje = new Date();

    return {
      success: true,
      data: itens.map((t: any) => ({
        ...t,
        situacaoCertificacao: situacaoCertificacao(t.validade, hoje),
        diasParaVencer: t.validade ? diasEntre(hoje, t.validade) : null,
      })),
    };
  }

  async registrarTreinamento(
    user: UsuarioContexto, collaboratorId: string, dto: RegistrarTreinamentoDto,
  ) {
    const organizationId = this.exigirOrganizacao(user);
    await this.exigirEscopo(user, collaboratorId);

    const curso = await this.repo.obterCurso(dto.trainingId, organizationId);
    if (!curso) throw new NotFoundException("Curso não encontrado");
    if (!curso.ativo) {
      throw new BadRequestException(`O curso "${curso.nome}" está desativado.`);
    }

    const status = (dto.status ?? TRAINING_STATUS.PLANEJADO) as StatusTreinamento;
    const conclusao = dto.conclusao ? new Date(dto.conclusao) : null;

    if (status === TRAINING_STATUS.CONCLUIDO && !conclusao) {
      throw new BadRequestException("Informe a data de conclusão para registrar como concluído.");
    }
    if (conclusao && dto.inicio && conclusao < new Date(dto.inicio)) {
      throw new BadRequestException("A conclusão é anterior ao início.");
    }

    const criado = await this.repo.criarParticipacao({
      organizationId,
      collaboratorId,
      trainingId: dto.trainingId,
      status,
      inicio: dto.inicio ? new Date(dto.inicio) : null,
      conclusao,
      validade: conclusao ? calcularValidade(conclusao, curso.validadeMeses) : null,
      certificadoRef: dto.certificadoRef?.trim() || null,
      nota: dto.nota ?? null,
      observacoes: dto.observacoes?.trim() || null,
      criadoPorId: user.id ?? null,
    });

    if (status === TRAINING_STATUS.CONCLUIDO) {
      await this.historico.registrar({
        organizationId,
        collaboratorId,
        evento: "outro",
        descricao: `Treinamento concluído: ${curso.nome}`,
        registradoPorId: user.id ?? null,
      });
    }
    await this.auditar(
      user, criado.id, "criar",
      `Treinamento "${curso.nome}" registrado`, "collaborator_trainings",
    );

    return { success: true, data: criado };
  }

  async atualizarTreinamento(user: UsuarioContexto, id: string, dto: AtualizarTreinamentoDto) {
    const organizationId = this.exigirOrganizacao(user);
    const atual = await this.repo.obterParticipacao(id, organizationId);
    if (!atual) throw new NotFoundException("Registro de treinamento não encontrado");
    await this.exigirEscopo(user, atual.collaboratorId);

    const novoStatus = dto.status as StatusTreinamento | undefined;
    if (novoStatus && novoStatus !== atual.status) {
      if (!statusTreinamentoValido(atual.status)) {
        throw new BadRequestException(`Situação atual desconhecida: ${atual.status}`);
      }
      if (!podeTransicionar(atual.status as StatusTreinamento, novoStatus)) {
        throw new BadRequestException(
          `Não é possível mudar de ${atual.status} para ${novoStatus}. ` +
          `Treinamento concluído ou cancelado é registro final.`,
        );
      }
    }

    const statusFinal = novoStatus ?? (atual.status as StatusTreinamento);
    const conclusao = dto.conclusao !== undefined
      ? (dto.conclusao ? new Date(dto.conclusao) : null)
      : atual.conclusao;

    if (statusFinal === TRAINING_STATUS.CONCLUIDO && !conclusao) {
      throw new BadRequestException("Informe a data de conclusão para concluir o treinamento.");
    }

    const atualizado = await this.repo.atualizarParticipacao(id, {
      ...(novoStatus ? { status: novoStatus } : {}),
      ...(dto.inicio !== undefined ? { inicio: dto.inicio ? new Date(dto.inicio) : null } : {}),
      ...(dto.conclusao !== undefined ? { conclusao } : {}),
      // Recalcula a validade sempre que a conclusão muda; usa a regra do curso
      // no momento da conclusão, e grava — não é derivada em leitura.
      ...(conclusao !== atual.conclusao
        ? { validade: conclusao ? calcularValidade(conclusao, atual.training?.validadeMeses ?? null) : null }
        : {}),
      ...(dto.certificadoRef !== undefined ? { certificadoRef: dto.certificadoRef?.trim() || null } : {}),
      ...(dto.nota !== undefined ? { nota: dto.nota } : {}),
      ...(dto.observacoes !== undefined ? { observacoes: dto.observacoes?.trim() || null } : {}),
      atualizadoPorId: user.id ?? null,
    });

    if (novoStatus === TRAINING_STATUS.CONCLUIDO) {
      await this.historico.registrar({
        organizationId,
        collaboratorId: atual.collaboratorId,
        evento: "outro",
        descricao: `Treinamento concluído: ${atual.training?.nome ?? "—"}`,
        registradoPorId: user.id ?? null,
      });
    }
    await this.auditar(
      user, id, "editar",
      `Treinamento "${atual.training?.nome ?? "—"}" atualizado`, "collaborator_trainings",
    );

    return { success: true, data: atualizado };
  }

  /** Painel: certificações vencidas ou vencendo dentro da janela. */
  async certificacoesVencendo(user: UsuarioContexto) {
    const organizationId = this.exigirOrganizacao(user);
    const escopo = await this.escopo.resolve(user);
    if (escopo.tipo === "nenhum") throw new ForbiddenException("Sem escopo de acesso");

    const ids = escopo.tipo === "organizacao" ? undefined : escopo.collaboratorIds;
    const limite = new Date();
    limite.setDate(limite.getDate() + DIAS_ALERTA_CERTIFICACAO);

    const itens = await this.repo.certificacoesVencendoAte(organizationId, limite, ids);
    const hoje = new Date();

    return {
      success: true,
      data: {
        janelaDias: DIAS_ALERTA_CERTIFICACAO,
        itens: itens.map((t: any) => ({
          id: t.id,
          curso: t.training?.nome ?? "—",
          colaborador: {
            id: t.collaborator.id,
            nome: t.collaborator.nomeCompleto || t.collaborator.user?.nome || "—",
          },
          validade: t.validade,
          diasParaVencer: diasEntre(hoje, t.validade),
        })),
      },
    };
  }

  /* ── Avaliações ───────────────────────────────────────────────────────── */

  async listarAvaliacoes(user: UsuarioContexto, collaboratorId: string) {
    const organizationId = this.exigirOrganizacao(user);
    await this.exigirEscopo(user, collaboratorId);

    const itens = await this.repo.listarAvaliacoes(collaboratorId, organizationId);
    return {
      success: true,
      data: itens.map((a: any) => ({
        ...a,
        avaliadorNome: a.avaliador
          ? a.avaliador.nomeCompleto || a.avaliador.user?.nome || "—"
          : null,
        progressoMetas: progressoPonderado(a.metas ?? []),
      })),
    };
  }

  async salvarAvaliacao(user: UsuarioContexto, collaboratorId: string, dto: SalvarAvaliacaoDto) {
    const organizationId = this.exigirOrganizacao(user);
    await this.exigirEscopo(user, collaboratorId);

    const ciclo = dto.ciclo.trim();
    const existente = await this.repo.avaliacaoDoCiclo(collaboratorId, ciclo);
    const atual = existente ? await this.repo.obterAvaliacao(existente.id, organizationId) : null;

    const validacao = validarAvaliacao({
      ciclo,
      nota: dto.nota ?? null,
      statusAtual: atual?.status as any,
      colaboradorId: collaboratorId,
      avaliadorId: dto.avaliadorId ?? null,
    });
    if (!validacao.valido) throw new BadRequestException(validacao.detalhe);

    const dados = {
      ...(dto.avaliadorId !== undefined ? { avaliadorId: dto.avaliadorId || null } : {}),
      ...(dto.nota !== undefined ? { nota: dto.nota } : {}),
      ...(dto.pontosFortes !== undefined ? { pontosFortes: dto.pontosFortes?.trim() || null } : {}),
      ...(dto.pontosMelhoria !== undefined ? { pontosMelhoria: dto.pontosMelhoria?.trim() || null } : {}),
      ...(dto.comentarios !== undefined ? { comentarios: dto.comentarios?.trim() || null } : {}),
      atualizadoPorId: user.id ?? null,
    };

    const salva = atual
      ? await this.repo.atualizarAvaliacao(atual.id, dados)
      : await this.repo.criarAvaliacao({
          organizationId,
          collaboratorId,
          ciclo,
          status: REVIEW_STATUS.RASCUNHO,
          criadoPorId: user.id ?? null,
          ...dados,
        });

    await this.auditar(
      user, salva.id, atual ? "editar" : "criar",
      `Avaliação ${ciclo} ${atual ? "atualizada" : "criada"}`, "performance_reviews",
    );

    return { success: true, data: salva };
  }

  async finalizarAvaliacao(user: UsuarioContexto, id: string) {
    const organizationId = this.exigirOrganizacao(user);
    const atual = await this.repo.obterAvaliacao(id, organizationId);
    if (!atual) throw new NotFoundException("Avaliação não encontrada");
    await this.exigirEscopo(user, atual.collaboratorId);

    const validacao = validarAvaliacao({
      ciclo: atual.ciclo,
      nota: atual.nota,
      statusAtual: atual.status as any,
      finalizando: true,
    });
    if (!validacao.valido) throw new BadRequestException(validacao.detalhe);

    const finalizada = await this.repo.atualizarAvaliacao(id, {
      status: REVIEW_STATUS.FINALIZADA,
      finalizadaEm: new Date(),
      atualizadoPorId: user.id ?? null,
    });

    await this.historico.registrar({
      organizationId,
      collaboratorId: atual.collaboratorId,
      evento: "outro",
      descricao: `Avaliação de desempenho ${atual.ciclo} finalizada — nota ${atual.nota}`,
      registradoPorId: user.id ?? null,
    });
    await this.auditar(
      user, id, "editar", `Avaliação ${atual.ciclo} finalizada`, "performance_reviews",
    );

    return { success: true, data: finalizada };
  }

  /* ── Metas ────────────────────────────────────────────────────────────── */

  async criarMeta(user: UsuarioContexto, reviewId: string, dto: CriarMetaDto) {
    const organizationId = this.exigirOrganizacao(user);
    const review = await this.repo.obterAvaliacao(reviewId, organizationId);
    if (!review) throw new NotFoundException("Avaliação não encontrada");
    await this.exigirEscopo(user, review.collaboratorId);

    if (review.status === REVIEW_STATUS.FINALIZADA) {
      throw new BadRequestException("A avaliação já foi finalizada e não aceita novas metas.");
    }

    const criada = await this.repo.criarMeta({
      organizationId,
      reviewId,
      titulo: dto.titulo.trim(),
      descricao: dto.descricao?.trim() || null,
      peso: dto.peso ?? 1,
      prazo: dto.prazo ? new Date(dto.prazo) : null,
    });

    return { success: true, data: criada };
  }

  /**
   * Metas continuam editáveis depois da avaliação finalizada, de propósito: o
   * ciclo fecha com o combinado, e o acompanhamento do progresso segue durante
   * o período. Só o texto da avaliação é que fica imutável.
   */
  async atualizarMeta(user: UsuarioContexto, id: string, dto: AtualizarMetaDto) {
    const organizationId = this.exigirOrganizacao(user);
    const meta = await this.repo.obterMeta(id, organizationId);
    if (!meta) throw new NotFoundException("Meta não encontrada");
    await this.exigirEscopo(user, meta.review.collaboratorId);

    const progresso = dto.progresso;
    const atualizada = await this.repo.atualizarMeta(id, {
      ...(dto.titulo !== undefined ? { titulo: dto.titulo.trim() } : {}),
      ...(dto.descricao !== undefined ? { descricao: dto.descricao?.trim() || null } : {}),
      ...(dto.peso !== undefined ? { peso: dto.peso } : {}),
      ...(progresso !== undefined
        ? { progresso, status: progresso >= 100 ? "CONCLUIDA" : "EM_ANDAMENTO" }
        : {}),
      ...(dto.prazo !== undefined ? { prazo: dto.prazo ? new Date(dto.prazo) : null } : {}),
    });

    return { success: true, data: atualizada };
  }

  async excluirMeta(user: UsuarioContexto, id: string) {
    const organizationId = this.exigirOrganizacao(user);
    const meta = await this.repo.obterMeta(id, organizationId);
    if (!meta) throw new NotFoundException("Meta não encontrada");
    await this.exigirEscopo(user, meta.review.collaboratorId);

    if (meta.review.status === REVIEW_STATUS.FINALIZADA) {
      throw new BadRequestException("A avaliação já foi finalizada; a meta não pode ser removida.");
    }

    await this.repo.excluirMeta(id);
    return { success: true, data: { id } };
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
