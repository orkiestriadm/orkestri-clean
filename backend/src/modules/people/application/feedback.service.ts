import {
  Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { IsString, IsOptional, IsDateString, IsIn, MaxLength } from "class-validator";
import { PrismaService } from "../../../prisma/prisma.service";
import { PeopleScopeService, UsuarioContexto } from "./people-scope.service";
import { AuditService } from "../../audit/audit.module";
import { collaboratorDisplayName } from "../../../common/collaborator";

/**
 * Feedback contínuo.
 *
 * Fecha PEOPLE_HUB_BLUEPRINT.md §14 — "Evaluation cycles. Goals. Feedback.
 * Ratings. History." As outras quatro já existiam; esta faltava.
 *
 * Existe porque avaliação semestral sem registro no meio do caminho vira
 * surpresa: ninguém lembra de março em novembro, e a nota acaba refletindo as
 * últimas semanas em vez do ciclo.
 */

export const TIPOS_FEEDBACK = ["elogio", "correcao", "um_a_um", "reconhecimento", "outro"] as const;
export const VISIBILIDADES = ["privado", "compartilhado"] as const;

export class CriarFeedbackDto {
  @IsIn(TIPOS_FEEDBACK as unknown as string[]) tipo!: string;
  @IsString() @MaxLength(4000) conteudo!: string;
  @IsOptional() @IsDateString() ocorridoEm?: string;
  @IsOptional() @IsIn(VISIBILIDADES as unknown as string[]) visibilidade?: string;
  @IsOptional() @IsString() autorId?: string;
  @IsOptional() @IsString() reviewId?: string;
}

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly escopo: PeopleScopeService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Feedbacks do colaborador.
   *
   * `incluirPrivados` separa duas leituras da mesma tela: quem gerencia vê a
   * anotação privada do gestor; o próprio avaliado, não. Filtrar aqui e não no
   * frontend é o que impede o dado privado de sair no JSON.
   */
  async listar(user: UsuarioContexto, collaboratorId: string, incluirPrivados: boolean) {
    const organizationId = this.exigirOrganizacao(user);
    await this.exigirEscopo(user, collaboratorId);

    const itens = await (this.prisma as any).performanceFeedback.findMany({
      where: {
        collaboratorId,
        organizationId,
        ...(incluirPrivados ? {} : { visibilidade: "compartilhado" }),
      },
      orderBy: { ocorridoEm: "desc" },
      include: {
        autor: { select: { id: true, nomeCompleto: true, user: { select: { nome: true } } } },
        review: { select: { id: true, ciclo: true } },
      },
    });

    return {
      success: true,
      data: itens.map((f: any) => ({
        id: f.id,
        tipo: f.tipo,
        visibilidade: f.visibilidade,
        conteudo: f.conteudo,
        ocorridoEm: f.ocorridoEm,
        ciclo: f.review?.ciclo ?? null,
        autorNome: f.autor ? collaboratorDisplayName(f.autor) : null,
      })),
    };
  }

  async criar(user: UsuarioContexto, collaboratorId: string, dto: CriarFeedbackDto) {
    const organizationId = this.exigirOrganizacao(user);
    await this.exigirEscopo(user, collaboratorId);

    const conteudo = dto.conteudo.trim();
    if (!conteudo) throw new BadRequestException("Escreva o feedback");

    // Registrar feedback sobre si mesmo esvazia o instrumento: o valor está em
    // ser observação de outra pessoa.
    if (dto.autorId && dto.autorId === collaboratorId) {
      throw new BadRequestException("O autor do feedback não pode ser o próprio avaliado.");
    }

    const criado = await (this.prisma as any).performanceFeedback.create({
      data: {
        id: randomUUID(),
        organizationId,
        collaboratorId,
        autorId: dto.autorId || null,
        tipo: dto.tipo,
        visibilidade: dto.visibilidade ?? "compartilhado",
        conteudo,
        // Sem data informada, é agora: o caso comum é registrar logo depois da
        // conversa, e obrigar a digitar a data só atrapalha.
        ocorridoEm: dto.ocorridoEm ? new Date(dto.ocorridoEm) : new Date(),
        reviewId: dto.reviewId || null,
        criadoPorId: user.id ?? null,
      },
    });

    await this.auditar(
      user, criado.id, "criar",
      // O conteúdo não vai para a auditoria: é texto sobre desempenho de uma
      // pessoa, e a trilha é lida por quem administra o sistema.
      `Feedback (${dto.tipo}) registrado`,
    );

    return { success: true, data: criado };
  }

  async excluir(user: UsuarioContexto, id: string) {
    const organizationId = this.exigirOrganizacao(user);
    const feedback = await (this.prisma as any).performanceFeedback.findFirst({
      where: { id, organizationId },
    });
    if (!feedback) throw new NotFoundException("Feedback não encontrado");
    await this.exigirEscopo(user, feedback.collaboratorId);

    await (this.prisma as any).performanceFeedback.delete({ where: { id } });
    await this.auditar(user, id, "excluir", "Feedback removido");

    return { success: true, data: { id } };
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

  private async auditar(user: UsuarioContexto, registroId: string, acao: string, descricao: string) {
    try {
      await this.audit.log({
        organizationId: user.organizationId,
        userId: user.id ?? null,
        modulo: "people",
        tabela: "performance_feedbacks",
        registroId,
        acao,
        descricao,
      });
    } catch (erro) {
      this.logger.error(`Falha ao auditar ${acao} de ${registroId}`, erro as Error);
    }
  }
}
