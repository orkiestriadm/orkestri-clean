import {
  Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { IsString, IsOptional, IsIn, IsNumber, Min, Max, MaxLength } from "class-validator";
import { Review360Repository } from "../infrastructure/review360.repository";
import { PeopleScopeService, UsuarioContexto } from "./people-scope.service";
import { AuditService } from "../../audit/audit.module";
import {
  ORIGENS_360, EXPLICACAO_RECUSA, ROTULO_ORIGEM,
  calibrar, consolidar, divergenciaAutoavaliacao, validarConvite,
} from "../domain/avaliacao360.entity";
import { NOTA_MINIMA, NOTA_MAXIMA, REVIEW_STATUS } from "../domain/development.entity";
import { collaboratorDisplayName } from "../../../common/collaborator";

/**
 * Avaliação 360 — autoavaliação, pares e calibração.
 *
 * O ciclo era gestor → liderado com uma nota. Faltavam as três peças que fazem
 * a avaliação virar conversa: a leitura que a pessoa faz de si, a leitura de
 * quem trabalha ao lado, e a comparação das réguas entre gestores.
 *
 * A NOTA DO GESTOR NÃO VIRA MÉDIA COM AS OUTRAS. A responsabilidade pela
 * avaliação é dele, e diluí-la numa média faria a nota não ser de ninguém —
 * sem dono, ela deixa de ser defensável numa conversa sobre promoção ou
 * desligamento. As demais entram como insumo, ao lado, e é o gestor quem
 * decide o que fazer com a divergência.
 */

export class ConvidarAvaliadorDto {
  @IsString() avaliadorId!: string;
  @IsIn(ORIGENS_360 as unknown as string[]) origem!: string;
}

export class ResponderAvaliacaoDto {
  @IsOptional() @IsNumber() @Min(NOTA_MINIMA) @Max(NOTA_MAXIMA) nota?: number;
  @IsOptional() @IsString() @MaxLength(4000) pontosFortes?: string;
  @IsOptional() @IsString() @MaxLength(4000) pontosMelhoria?: string;
  @IsOptional() @IsString() @MaxLength(4000) comentarios?: string;
}

@Injectable()
export class Review360Service {
  private readonly logger = new Logger(Review360Service.name);

  constructor(
    private readonly repo: Review360Repository,
    private readonly escopo: PeopleScopeService,
    private readonly audit: AuditService,
  ) {}

  /* ── Condução ───────────────────────────────────────────────────────────── */

  /**
   * O painel de 360 de uma avaliação, para quem a conduz.
   *
   * Sem omissão por anonimato: gestor e RH precisam do dado para decidir, e já
   * sabem quem convidaram. A omissão existe do outro lado — ver `paraOAvaliado`.
   */
  async painel(user: UsuarioContexto, reviewId: string) {
    const organizationId = this.exigirOrganizacao(user);
    const review = await this.repo.review(reviewId, organizationId);
    if (!review) throw new NotFoundException("Avaliação não encontrada");
    await this.exigirEscopo(user, review.collaboratorId);

    const entradas = await this.repo.entradas(reviewId);
    const auto = entradas.find((e: any) => e.origem === "autoavaliacao" && e.status === "RESPONDIDA");

    return {
      success: true,
      data: {
        reviewId,
        ciclo: review.ciclo,
        notaGestor: review.nota,
        resumo: consolidar(entradas),
        // O número mais útil do ciclo: aponta para uma conversa específica.
        divergenciaAutoavaliacao: divergenciaAutoavaliacao(review.nota, auto?.nota ?? null),
        entradas: entradas.map((e: any) => ({
          id: e.id,
          origem: e.origem,
          rotuloOrigem: ROTULO_ORIGEM[e.origem as keyof typeof ROTULO_ORIGEM] ?? e.origem,
          avaliador: { id: e.avaliadorId, nome: collaboratorDisplayName(e.avaliador) },
          status: e.status,
          nota: e.nota,
          pontosFortes: e.pontosFortes,
          pontosMelhoria: e.pontosMelhoria,
          comentarios: e.comentarios,
          respondidoEm: e.respondidoEm,
        })),
      },
    };
  }

  async convidar(user: UsuarioContexto, reviewId: string, dto: ConvidarAvaliadorDto) {
    const organizationId = this.exigirOrganizacao(user);
    const review = await this.repo.review(reviewId, organizationId);
    if (!review) throw new NotFoundException("Avaliação não encontrada");
    await this.exigirEscopo(user, review.collaboratorId);

    // O convidado precisa estar no escopo de quem convida: convidar alguém que
    // não se enxerga permitiria descobrir ids alheios por tentativa.
    if (!(await this.escopo.podeAcessar(user, dto.avaliadorId))) {
      throw new NotFoundException("Avaliador não encontrado");
    }

    const existentes = await this.repo.entradas(reviewId);
    const recusa = validarConvite({
      origem: dto.origem,
      avaliadorId: dto.avaliadorId,
      avaliadoId: review.collaboratorId,
      jaConvidados: existentes.map((e: any) => e.avaliadorId),
      reviewFinalizada: review.status === REVIEW_STATUS.FINALIZADA,
    });
    if (recusa) throw new BadRequestException(EXPLICACAO_RECUSA[recusa]);

    const criada = await this.repo.criar({
      id: randomUUID(),
      organizationId, reviewId,
      avaliadorId: dto.avaliadorId,
      origem: dto.origem,
      criadoPorId: user.id ?? null,
    });

    await this.auditar(user, criada.id, "criar",
      `Convite de ${ROTULO_ORIGEM[dto.origem as keyof typeof ROTULO_ORIGEM] ?? dto.origem} ` +
      `no ciclo ${review.ciclo}`);

    return { success: true, data: criada };
  }

  async remover(user: UsuarioContexto, entradaId: string) {
    const organizationId = this.exigirOrganizacao(user);
    const entrada = await this.repo.entrada(entradaId, organizationId);
    if (!entrada) throw new NotFoundException("Convite não encontrado");
    await this.exigirEscopo(user, entrada.review.collaboratorId);

    // Resposta dada não se apaga: seria descartar uma opinião por não gostar
    // dela, e o avaliado nunca saberia que existiu.
    if (entrada.status === "RESPONDIDA") {
      throw new BadRequestException(
        "Esta pessoa já respondeu. Uma resposta registrada não pode ser removida.",
      );
    }

    await this.repo.remover(entradaId);
    await this.auditar(user, entradaId, "excluir", `Convite de 360 removido (${entrada.review.ciclo})`);
    return { success: true, data: { id: entradaId } };
  }

  /* ── Resposta ───────────────────────────────────────────────────────────── */

  /**
   * Responde um convite.
   *
   * `avaliadorId` NÃO vem da requisição: sai do vínculo de quem chamou. É o que
   * impede responder no lugar de outra pessoa, e o que faz esta operação ser
   * segura sem depender de permissão nenhuma.
   */
  async responder(user: UsuarioContexto, entradaId: string, dto: ResponderAvaliacaoDto) {
    const organizationId = this.exigirOrganizacao(user);
    const entrada = await this.repo.entrada(entradaId, organizationId);
    if (!entrada) throw new NotFoundException("Convite não encontrado");

    const meuId = await this.escopo.proprioCollaboratorId(user);
    if (!meuId || meuId !== entrada.avaliadorId) {
      // 404 e não 403: dizer "existe mas não é seu" já revela que alguém foi
      // convidado para aquela avaliação.
      throw new NotFoundException("Convite não encontrado");
    }

    if (entrada.review.status === REVIEW_STATUS.FINALIZADA) {
      throw new BadRequestException("A avaliação já foi finalizada e não recebe respostas.");
    }
    if (entrada.status === "RESPONDIDA") {
      throw new BadRequestException("Você já respondeu esta avaliação.");
    }
    if (dto.nota === undefined && !dto.pontosFortes?.trim() && !dto.pontosMelhoria?.trim()) {
      // Uma resposta vazia contaria como participação e não diria nada — pior
      // que a ausência dela, porque some da lista de pendentes.
      throw new BadRequestException("Dê ao menos uma nota ou um comentário.");
    }

    const salva = await this.repo.responder(entradaId, {
      nota: dto.nota ?? null,
      pontosFortes: dto.pontosFortes?.trim() || null,
      pontosMelhoria: dto.pontosMelhoria?.trim() || null,
      comentarios: dto.comentarios?.trim() || null,
    });

    return { success: true, data: salva };
  }

  /** O que esta pessoa tem para responder — a própria e a dos colegas. */
  async minhasPendencias(user: UsuarioContexto) {
    const organizationId = this.exigirOrganizacao(user);
    const meuId = await this.escopo.proprioCollaboratorId(user);
    if (!meuId) return { success: true, data: [] };

    const itens = await this.repo.pendentesDoAvaliador(meuId, organizationId);
    return {
      success: true,
      data: itens.map((i: any) => ({
        id: i.id,
        origem: i.origem,
        rotuloOrigem: ROTULO_ORIGEM[i.origem as keyof typeof ROTULO_ORIGEM] ?? i.origem,
        ciclo: i.review.ciclo,
        // Na autoavaliação o "avaliado" é quem está lendo — a tela diz isso.
        sobre: i.origem === "autoavaliacao"
          ? null
          : { id: i.review.collaborator.id, nome: collaboratorDisplayName(i.review.collaborator) },
        convidadoEm: i.criadoEm,
      })),
    };
  }

  /**
   * O 360 como o AVALIADO o vê, depois de finalizada a avaliação.
   *
   * Antes de finalizar não devolve nada: ler as respostas enquanto o gestor
   * ainda decide transformaria o ciclo numa negociação, e os pares deixariam
   * de responder com franqueza.
   *
   * A média de pares só aparece com respostas suficientes para que ninguém
   * seja identificável, e os comentários vêm SEM AUTOR pelo mesmo motivo.
   */
  async meuResultado(user: UsuarioContexto, ciclo: string) {
    const organizationId = this.exigirOrganizacao(user);
    const meuId = await this.escopo.proprioCollaboratorId(user);
    if (!meuId) throw new NotFoundException("Seu usuário não está vinculado a um colaborador.");

    const review = await this.repo.reviewDoCiclo(meuId, ciclo, organizationId);
    if (!review) throw new NotFoundException("Avaliação não encontrada");
    if (review.status !== REVIEW_STATUS.FINALIZADA) {
      throw new BadRequestException("Esta avaliação ainda está em andamento.");
    }

    const entradas = await this.repo.entradas(review.id);
    const auto = entradas.find((e: any) => e.origem === "autoavaliacao" && e.status === "RESPONDIDA");

    return {
      success: true,
      data: {
        ciclo,
        notaGestor: review.nota,
        resumo: consolidar(entradas, true),
        divergenciaAutoavaliacao: divergenciaAutoavaliacao(review.nota, auto?.nota ?? null),
        comentarios: entradas
          .filter((e: any) => e.status === "RESPONDIDA" && e.origem !== "autoavaliacao")
          .flatMap((e: any) => [
            e.pontosFortes && { origem: e.origem, tipo: "forte", texto: e.pontosFortes },
            e.pontosMelhoria && { origem: e.origem, tipo: "melhoria", texto: e.pontosMelhoria },
          ])
          .filter(Boolean),
      },
    };
  }

  /* ── Calibração ─────────────────────────────────────────────────────────── */

  /**
   * Compara a régua de cada gestor no mesmo ciclo.
   *
   * NÃO ajusta nota nenhuma: é insumo para a reunião entre gestores. Reescalar
   * por trás faria a nota que a pessoa recebeu deixar de ser a que o gestor
   * deu, e ninguém conseguiria explicar a diferença.
   */
  async calibracao(user: UsuarioContexto, ciclo: string) {
    const organizationId = this.exigirOrganizacao(user);
    const escopo = await this.escopo.resolve(user);
    if (escopo.tipo === "nenhum") throw new ForbiddenException("Sem escopo de acesso");

    const ids = escopo.tipo === "organizacao" ? undefined : escopo.collaboratorIds;
    const linhas = await this.repo.notasFinalizadasDoCiclo(organizationId, ciclo, ids);

    const calibracao = calibrar(
      ciclo,
      linhas.map((l: any) => ({
        gestorId: l.collaborator?.gestor?.id ?? null,
        gestorNome: l.collaborator?.gestor
          ? collaboratorDisplayName(l.collaborator.gestor)
          : "Sem gestor",
        nota: l.nota,
      })),
    );

    return {
      success: true,
      data: { ...calibracao, escopoOrganizacional: ids === undefined },
    };
  }

  async ciclos(user: UsuarioContexto) {
    const organizationId = this.exigirOrganizacao(user);
    const linhas = await this.repo.ciclosDisponiveis(organizationId);
    return { success: true, data: linhas.map((l: any) => l.ciclo) };
  }

  /* ── Auxiliares ─────────────────────────────────────────────────────────── */

  private exigirOrganizacao(user: UsuarioContexto): string {
    if (!user?.organizationId) throw new ForbiddenException("Contexto de organização ausente");
    return user.organizationId;
  }

  private async exigirEscopo(user: UsuarioContexto, collaboratorId: string) {
    if (!(await this.escopo.podeAcessar(user, collaboratorId))) {
      throw new NotFoundException("Avaliação não encontrada");
    }
  }

  private async auditar(user: UsuarioContexto, registroId: string, acao: string, descricao: string) {
    try {
      await this.audit.log({
        organizationId: user.organizationId,
        userId: user.id ?? null,
        modulo: "people",
        tabela: "performance_review_inputs",
        registroId, acao, descricao,
      });
    } catch (erro) {
      this.logger.error(`Falha ao auditar ${acao} de ${registroId}`, erro as Error);
    }
  }
}
