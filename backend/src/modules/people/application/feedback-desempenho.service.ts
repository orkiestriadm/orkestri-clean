import {
  Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import {
  IsString, IsOptional, IsDateString, IsBoolean, MaxLength, MinLength, IsIn,
} from "class-validator";
import { PrismaService } from "../../../prisma/prisma.service";
import { PeopleScopeService, UsuarioContexto } from "./people-scope.service";
import { AuditService } from "../../audit/audit.module";
import { CalendarWritebackService } from "../../integracoes/calendar/calendar-writeback.service";
import { EmailService } from "../../notifications/email.service";
import { collaboratorDisplayName } from "../../../common/collaborator";
import { expandLegacyPermissions } from "../../../common/permission-aliases";
import { PEOPLE_PERMISSIONS } from "../people.permissions";
import {
  AcaoFeedback, DURACAO_REUNIAO_MIN, EXCLUSAO, EXPLICACAO_RECUSA, PapelNoFeedback,
  ROTULO_STATUS, STATUS_FEEDBACK, StatusFeedback,
  acoesDisponiveis, camposFaltantesRegistro, colaboradorLeConteudo, consolidarPorGestor,
  diasDeEspera, proximoStatus, realizacaoValida, resumoDoPeriodo, validarAcao,
} from "../domain/feedback-desempenho.entity";

/**
 * Avaliação de Desempenho › Feedback.
 *
 * O fluxo formal que o RH descreveu: o gestor registra, agenda e realiza a
 * reunião; o colaborador lê e dá ciência; o processo encerra. As regras de
 * etapa moram em `domain/feedback-desempenho.entity.ts` — aqui só se decide
 * QUEM é cada pessoa em relação ao registro e o que acontece em volta (agenda,
 * notificação, trilha).
 *
 * TRÊS PAPÉIS, decididos pelo REGISTRO e não pelo cargo:
 *  - gestor: o cadastro de quem registrou. Só ele conduz — o RH acompanha, mas
 *    a conversa é do gestor.
 *  - colaborador: quem recebe. Lê e dá ciência pelo Meu RH, sem permissão
 *    nenhuma além do login (a mesma lógica do 360).
 *  - rh: quem tem `aprovar_exclusao`. Decide pedidos de exclusão, e não pode
 *    decidir o pedido que ele mesmo fez.
 *
 * O PRÓPRIO FEEDBACK NUNCA APARECE NA VISÃO DE GESTÃO de quem o recebe. Um
 * gestor tem a si mesmo no escopo; sem essa exclusão ele leria, pela lista da
 * equipe, o feedback que o chefe dele ainda nem apresentou.
 */

const TABELA = "feedbacks_desempenho";
const REF_TIPO = "people_feedback";
const ORIGEM_AGENDA = "people_feedback";

export class CriarFeedbackDesempenhoDto {
  @IsString() collaboratorId!: string;
  @IsString() @MaxLength(4000) pontosFortes!: string;
  @IsString() @MaxLength(4000) oportunidades!: string;
}

export class EditarFeedbackDesempenhoDto {
  @IsOptional() @IsString() @MaxLength(4000) pontosFortes?: string;
  @IsOptional() @IsString() @MaxLength(4000) oportunidades?: string;
}

export class AgendarReuniaoDto {
  @IsDateString() inicio!: string;
  @IsOptional() @IsString() @MaxLength(300) local?: string;
}

export class RegistrarReuniaoDto {
  @IsOptional() @IsDateString() realizadaEm?: string;
  @IsString() @MaxLength(4000) alinhamentos!: string;
}

export class RegistrarCienciaDto {
  @IsOptional() @IsString() @MaxLength(4000) comentario?: string;
}

export class SolicitarExclusaoDto {
  @IsString() @MinLength(3) @MaxLength(1000) motivo!: string;
}

export class DecidirExclusaoDto {
  @IsBoolean() aprovar!: boolean;
  @IsOptional() @IsString() @MaxLength(1000) parecer?: string;
}

export class FiltroFeedbackDesempenhoDto {
  @IsOptional() @IsIn(Object.values(STATUS_FEEDBACK)) status?: string;
  @IsOptional() @IsString() collaboratorId?: string;
  @IsOptional() @IsIn(["1", "true"]) exclusaoPendente?: string;
  @IsOptional() @IsString() @MaxLength(100) busca?: string;
}

const INCLUDE_PESSOAS = {
  collaborator: {
    select: {
      id: true, nomeCompleto: true, userId: true, emailCorporativo: true,
      user: { select: { nome: true, email: true } },
      position: { select: { titulo: true } },
    },
  },
  gestor: {
    select: { id: true, nomeCompleto: true, userId: true, user: { select: { nome: true } } },
  },
};

const fmtDataHora = (d: Date) =>
  new Date(d).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

@Injectable()
export class FeedbackDesempenhoService {
  private readonly logger = new Logger(FeedbackDesempenhoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly escopo: PeopleScopeService,
    private readonly audit: AuditService,
    private readonly writeback: CalendarWritebackService,
    private readonly email: EmailService,
  ) {}

  private get db(): any {
    return this.prisma as any;
  }

  /* ── Visão de gestão ────────────────────────────────────────────────────── */

  /**
   * O filtro base de tudo que se LÊ pela gestão: lista e acompanhamento.
   *
   * Devolve nulo quando a pessoa não alcança nada. Quem decide exclusão vê a
   * organização inteira — precisa achar o que vai decidir. Um gestor vê a
   * equipe no escopo mais o que ele mesmo registrou (gestor que mudou de área
   * continua respondendo pelo que conduziu), e nunca o próprio feedback, que é
   * lido pelo Meu RH.
   */
  private async alcanceDeLeitura(user: UsuarioContexto) {
    const organizationId = this.exigirOrganizacao(user);
    const ehRh = this.tem(user, PEOPLE_PERMISSIONS.feedbackDesempenho.aprovarExclusao);
    if (!ehRh && !this.tem(user, PEOPLE_PERMISSIONS.feedbackDesempenho.ver)) {
      throw new ForbiddenException("Sem permissão para ver feedbacks de desempenho.");
    }

    const eu = await this.escopo.proprioCollaboratorId(user);
    const escopo = await this.escopo.resolve(user);
    const organizacaoInteira = escopo.tipo === "organizacao" || ehRh;

    // Sem `OR` quando o alcance é a organização inteira. `OR: [{}]` parece
    // "nenhuma restrição", mas o Prisma não casa nada com a condição vazia — e
    // o RH abria a lista vazia enquanto os pedidos de exclusão o esperavam.
    const clausulas: any[] = [];
    if (!organizacaoInteira) {
      if (escopo.tipo === "equipe" || escopo.tipo === "proprio") {
        clausulas.push({ collaboratorId: { in: escopo.collaboratorIds } });
      }
      if (eu) clausulas.push({ gestorId: eu });
      if (clausulas.length === 0) return null;
    }

    return {
      organizationId,
      eu,
      organizacaoInteira,
      escopo,
      where: {
        organizationId,
        excluidoEm: null,
        ...(organizacaoInteira ? {} : { OR: clausulas }),
        ...(eu ? { NOT: { collaboratorId: eu } } : {}),
      } as any,
    };
  }

  async listar(user: UsuarioContexto, filtro: FiltroFeedbackDesempenhoDto) {
    const alcance = await this.alcanceDeLeitura(user);
    if (!alcance) return { success: true, data: [] };
    const { eu, where: base } = alcance;

    const where: any = {
      ...base,
      ...(filtro.status ? { status: filtro.status } : {}),
      ...(filtro.collaboratorId ? { collaboratorId: filtro.collaboratorId } : {}),
      ...(filtro.exclusaoPendente ? { exclusaoStatus: EXCLUSAO.PENDENTE } : {}),
    };

    const busca = filtro.busca?.trim();
    if (busca) {
      const nome = { contains: busca, mode: "insensitive" };
      where.AND = [{
        OR: [
          { collaborator: { nomeCompleto: nome } },
          { collaborator: { user: { nome } } },
          { gestor: { nomeCompleto: nome } },
          { gestor: { user: { nome } } },
        ],
      }];
    }

    const itens = await this.db.feedbackDesempenho.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      take: 500,
      include: INCLUDE_PESSOAS,
    });

    return {
      success: true,
      data: itens.map((f: any) => ({
        id: f.id,
        status: f.status,
        rotuloStatus: ROTULO_STATUS[f.status as StatusFeedback] ?? f.status,
        colaborador: { id: f.collaborator.id, nome: collaboratorDisplayName(f.collaborator) },
        gestor: { id: f.gestor.id, nome: collaboratorDisplayName(f.gestor) },
        criadoEm: f.criadoEm,
        reuniaoInicio: f.reuniaoInicio,
        cienciaEm: f.cienciaEm,
        exclusaoPendente: f.exclusaoStatus === EXCLUSAO.PENDENTE,
        souGestor: !!eu && f.gestorId === eu,
      })),
    };
  }

  async obter(user: UsuarioContexto, id: string) {
    const { feedback, papeis } = await this.carregarParaGestao(user, id);
    return { success: true, data: await this.montarDetalhe(user, feedback, papeis) };
  }

  /**
   * Acompanhamento: quem já fez e quem não retornou.
   *
   * A lista responde "como está este feedback"; isto responde as duas perguntas
   * que ela não responde. A primeira delas só é respondível partindo dos
   * GESTORES DO ORGANOGRAMA — quem não registrou nada não tem linha na lista de
   * feedbacks, e é justamente quem o RH procura.
   *
   * A fila de quem não deu ciência IGNORA o período de propósito: um feedback
   * parado há seis meses é o que mais precisa de cobrança, e some da tela se o
   * filtro de período o cortar.
   */
  async acompanhamento(user: UsuarioContexto, dias: number) {
    const alcance = await this.alcanceDeLeitura(user);
    if (!alcance) {
      return { success: true, data: { dias, resumo: null, gestores: [], semRetorno: [], exclusoesPendentes: 0 } };
    }
    const { organizationId, organizacaoInteira, escopo, where: base } = alcance;

    const desde = new Date();
    desde.setDate(desde.getDate() - dias);

    const [doPeriodo, aguardando, exclusoesPendentes] = await Promise.all([
      this.db.feedbackDesempenho.findMany({
        where: { ...base, criadoEm: { gte: desde } },
        select: { gestorId: true, collaboratorId: true, status: true, reuniaoRealizadaEm: true, cienciaEm: true },
      }),
      this.db.feedbackDesempenho.findMany({
        where: { ...base, status: STATUS_FEEDBACK.AGUARDANDO_CIENCIA },
        orderBy: { reuniaoRealizadaEm: "asc" },
        take: 100,
        include: INCLUDE_PESSOAS,
      }),
      this.db.feedbackDesempenho.count({ where: { ...base, exclusaoStatus: EXCLUSAO.PENDENTE } }),
    ]);

    const gestores = await this.gestoresDoQuadro(organizationId, organizacaoInteira ? null : escopo);
    const contagem = doPeriodo.map((f: any) => ({
      gestorId: f.gestorId,
      collaboratorId: f.collaboratorId,
      status: f.status,
      temReuniaoRealizada: !!f.reuniaoRealizadaEm,
      temCiencia: !!f.cienciaEm,
    }));

    const linhas = consolidarPorGestor(gestores, contagem);

    return {
      success: true,
      data: {
        dias,
        resumo: { ...resumoDoPeriodo(contagem, linhas), gestores: gestores.length },
        exclusoesPendentes,
        gestores: linhas,
        semRetorno: aguardando.map((f: any) => ({
          id: f.id,
          colaborador: collaboratorDisplayName(f.collaborator),
          gestor: collaboratorDisplayName(f.gestor),
          reuniaoRealizadaEm: f.reuniaoRealizadaEm,
          diasEsperando: f.reuniaoRealizadaEm ? diasDeEspera(f.reuniaoRealizadaEm) : 0,
        })),
      },
    };
  }

  /**
   * Os gestores do organograma: quem tem ao menos um liderado ativo.
   *
   * Decisão do usuário em 17/09/2026 — "gestor" aqui é o do organograma, não o
   * cargo nem o setor. Quem não lidera ninguém não aparece cobrado por não ter
   * registrado feedback.
   */
  private async gestoresDoQuadro(organizationId: string, escopo: any | null) {
    const grupos = await this.db.collaborator.groupBy({
      by: ["gestorId"],
      where: { organizationId, excluidoEm: null, gestorId: { not: null } },
      _count: { _all: true },
    });

    const idsNoEscopo: string[] | null =
      escopo && (escopo.tipo === "equipe" || escopo.tipo === "proprio") ? escopo.collaboratorIds : null;

    const relevantes = grupos
      .map((g: any) => ({ id: g.gestorId as string, liderados: g._count._all as number }))
      .filter((g: { id: string }) => !idsNoEscopo || idsNoEscopo.includes(g.id));
    if (relevantes.length === 0) return [];

    const nomes = await this.db.collaborator.findMany({
      where: { id: { in: relevantes.map((g: { id: string }) => g.id) }, excluidoEm: null },
      select: { id: true, nomeCompleto: true, user: { select: { nome: true } } },
    });
    const porId = new Map(nomes.map((c: any) => [c.id, collaboratorDisplayName(c)]));

    // Gestor desligado sai do quadro: cobrar feedback de quem não está mais na
    // empresa só empurraria a cobertura para baixo sem ninguém a quem cobrar.
    return relevantes
      .filter((g: { id: string }) => porId.has(g.id))
      .map((g: { id: string; liderados: number }) => ({ ...g, nome: porId.get(g.id) as string }));
  }

  /**
   * Quem pode receber feedback de mim: equipe no escopo, com login, menos eu.
   *
   * Sem login não entra: a ciência é do colaborador, e registrar feedback
   * para quem não consegue dar ciência deixaria o processo sem fim.
   */
  async colaboradoresElegiveis(user: UsuarioContexto) {
    this.exigirOrganizacao(user);
    const eu = await this.escopo.proprioCollaboratorId(user);

    // Sem cadastro vinculado não há como ser o gestor do registro. Antes a
    // lista vinha preenchida (quem enxerga a organização via todo mundo) e o
    // erro só aparecia depois de escrever o feedback inteiro — caso da
    // gestora de RH no Hub. Agora a tela sabe disso ao abrir.
    if (!eu) return { success: true, data: [], semVinculo: true };

    const where = await this.escopo.whereColaborador(user);
    const itens = await this.db.collaborator.findMany({
      where: {
        ...where,
        userId: { not: null },
        user: { ativo: true },
        ...(eu ? { NOT: { id: eu } } : {}),
      },
      select: {
        id: true, nomeCompleto: true,
        user: { select: { nome: true } },
        position: { select: { titulo: true } },
      },
      take: 1000,
    });
    return {
      success: true,
      data: itens
        .map((c: any) => ({ id: c.id, nome: collaboratorDisplayName(c), cargo: c.position?.titulo ?? null }))
        .sort((a: any, b: any) => a.nome.localeCompare(b.nome, "pt-BR")),
    };
  }

  /* ── 1. Registro ────────────────────────────────────────────────────────── */

  async criar(user: UsuarioContexto, dto: CriarFeedbackDesempenhoDto) {
    const organizationId = this.exigirOrganizacao(user);
    const eu = await this.escopo.proprioCollaboratorId(user);
    if (!eu) {
      throw new BadRequestException(
        "Seu usuário não está vinculado a um cadastro de colaborador. Peça ao RH para vincular antes de registrar feedback.",
      );
    }
    if (dto.collaboratorId === eu) {
      throw new BadRequestException("Não é possível registrar feedback para você mesmo.");
    }
    if (!(await this.escopo.podeAcessar(user, dto.collaboratorId))) {
      throw new NotFoundException("Colaborador não encontrado");
    }

    const alvo = await this.db.collaborator.findFirst({
      where: { id: dto.collaboratorId, organizationId, excluidoEm: null },
      select: { id: true, userId: true, user: { select: { ativo: true } } },
    });
    if (!alvo) throw new NotFoundException("Colaborador não encontrado");
    if (!alvo.userId || alvo.user?.ativo === false) {
      throw new BadRequestException(
        "Este colaborador não tem acesso ao sistema. O feedback exige login, porque é o colaborador quem registra a ciência.",
      );
    }

    this.exigirCampos(dto);

    const criado = await this.db.feedbackDesempenho.create({
      data: {
        id: randomUUID(),
        organizationId,
        collaboratorId: dto.collaboratorId,
        gestorId: eu,
        status: STATUS_FEEDBACK.REGISTRADO,
        pontosFortes: dto.pontosFortes.trim(),
        oportunidades: dto.oportunidades.trim(),
        criadoPorId: user.id ?? null,
      },
    });

    await this.registrarEvento(user, criado.id, "registrado");
    // O texto não vai para a auditoria geral: é avaliação de uma pessoa, e a
    // trilha é lida por quem administra o sistema. A linha do tempo do próprio
    // feedback guarda o que aconteceu.
    await this.auditar(user, criado.id, "criar", "Feedback de desempenho registrado");

    return this.obter(user, criado.id);
  }

  async editar(user: UsuarioContexto, id: string, dto: EditarFeedbackDesempenhoDto) {
    const { feedback } = await this.exigirAcao(user, id, "editar");

    const dados = {
      pontosFortes: dto.pontosFortes ?? feedback.pontosFortes,
      oportunidades: dto.oportunidades ?? feedback.oportunidades,
    };
    this.exigirCampos(dados);

    await this.db.feedbackDesempenho.update({
      where: { id },
      data: { pontosFortes: dados.pontosFortes.trim(), oportunidades: dados.oportunidades.trim() },
    });
    await this.registrarEvento(user, id, "editado");
    await this.auditar(user, id, "editar", "Feedback de desempenho editado");

    return this.obter(user, id);
  }

  /* ── 2. Reunião ─────────────────────────────────────────────────────────── */

  /** Agenda — ou remarca, se já estava agendada. A tela usa o mesmo formulário. */
  async agendarReuniao(user: UsuarioContexto, id: string, dto: AgendarReuniaoDto) {
    const atual = await this.carregarParaGestao(user, id);
    const reagendar = atual.feedback.status === STATUS_FEEDBACK.REUNIAO_AGENDADA;
    const acao: AcaoFeedback = reagendar ? "reagendar_reuniao" : "agendar_reuniao";
    const { feedback } = await this.exigirAcao(user, id, acao, atual);

    const inicio = new Date(dto.inicio);
    if (Number.isNaN(inicio.getTime())) throw new BadRequestException("Data da reunião inválida.");
    const local = dto.local?.trim() || null;

    await this.db.feedbackDesempenho.update({
      where: { id },
      data: {
        status: proximoStatus(acao, feedback.status),
        reuniaoInicio: inicio,
        reuniaoLocal: local,
      },
    });

    await this.sincronizarAgenda(user, feedback, inicio, local);

    const quando = fmtDataHora(inicio) + (local ? ` · ${local}` : "");
    await this.registrarEvento(user, id, reagendar ? "reuniao_reagendada" : "reuniao_agendada", quando);
    await this.auditar(user, id, reagendar ? "reagendar" : "agendar", `Reunião de feedback ${reagendar ? "remarcada" : "agendada"}`);

    const gestorNome = collaboratorDisplayName(feedback.gestor);
    await this.notificar(
      feedback.collaborator.userId, "people_feedback_reuniao",
      reagendar ? "Reunião de feedback remarcada" : "Reunião de feedback agendada",
      `${gestorNome} ${reagendar ? "remarcou" : "marcou"} uma conversa de feedback com você: ${quando}.`,
      id,
    );

    // E-mail com data e local — pedido do RH em 18/09/2026: o aviso dentro do
    // sistema só é visto por quem entra nele, e a reunião precisa chegar antes.
    this.enviarEmail(feedback.collaborator, id, "reunião", (email, nome) =>
      this.email.sendFeedbackReuniaoAgendada(email, nome, gestorNome, fmtDataHora(inicio), local, reagendar));

    return this.obter(user, id);
  }

  /**
   * Registra que a reunião aconteceu. É aqui que o conteúdo passa a ser
   * visível ao colaborador — a leitura vem DEPOIS da conversa.
   */
  async registrarReuniao(user: UsuarioContexto, id: string, dto: RegistrarReuniaoDto) {
    const { feedback } = await this.exigirAcao(user, id, "registrar_reuniao");

    const alinhamentos = dto.alinhamentos?.trim();
    if (!alinhamentos) {
      throw new BadRequestException("Registre as expectativas e os próximos passos alinhados na reunião.");
    }
    const realizadaEm = dto.realizadaEm ? new Date(dto.realizadaEm) : new Date();
    if (Number.isNaN(realizadaEm.getTime())) throw new BadRequestException("Data da reunião inválida.");
    if (!realizacaoValida(realizadaEm)) {
      throw new BadRequestException("A reunião não pode ser registrada como realizada numa data futura. Se ela mudou de dia, remarque.");
    }

    await this.db.feedbackDesempenho.update({
      where: { id },
      data: {
        status: proximoStatus("registrar_reuniao", feedback.status),
        reuniaoRealizadaEm: realizadaEm,
        alinhamentos,
      },
    });

    await this.registrarEvento(user, id, "reuniao_realizada", fmtDataHora(realizadaEm));
    await this.auditar(user, id, "reuniao_realizada", "Reunião de feedback realizada");

    await this.notificar(
      feedback.collaborator.userId, "people_feedback_ciencia",
      "Feedback aguardando sua ciência",
      `Leia o feedback de ${collaboratorDisplayName(feedback.gestor)} e registre sua ciência no Meu RH.`,
      id,
    );

    // "Você recebeu um feedback", com o passo a passo até a ciência. Sai AQUI,
    // e não no registro: antes da reunião o texto não aparece para o
    // colaborador, e o e-mail o levaria a uma tela vazia.
    this.enviarEmail(feedback.collaborator, id, "feedback disponível", (email, nome) =>
      this.email.sendFeedbackDisponivel(email, nome, collaboratorDisplayName(feedback.gestor)));

    return this.obter(user, id);
  }

  /* ── Exclusão: gestor pede, RH decide ───────────────────────────────────── */

  async solicitarExclusao(user: UsuarioContexto, id: string, dto: SolicitarExclusaoDto) {
    const { feedback } = await this.exigirAcao(user, id, "solicitar_exclusao");
    const motivo = dto.motivo.trim();
    if (motivo.length < 3) throw new BadRequestException("Explique o motivo da exclusão para o RH.");

    await this.db.feedbackDesempenho.update({
      where: { id },
      data: {
        exclusaoStatus: EXCLUSAO.PENDENTE,
        exclusaoMotivo: motivo,
        exclusaoSolicitadaPor: user.id ?? null,
        exclusaoSolicitadaEm: new Date(),
        exclusaoDecididaPor: null,
        exclusaoDecididaEm: null,
        exclusaoParecer: null,
      },
    });

    await this.registrarEvento(user, id, "exclusao_solicitada", motivo);
    await this.auditar(user, id, "solicitar_exclusao", "Exclusão de feedback de desempenho solicitada ao RH");

    const aprovadores = (await this.aprovadoresDeExclusao(feedback.organizationId))
      .filter(uid => uid !== user.id);
    if (aprovadores.length === 0) {
      this.logger.warn(`Pedido de exclusão ${id} sem aprovador de RH na organização ${feedback.organizationId}`);
    }
    const titulo = "Pedido de exclusão de feedback";
    const mensagem =
      `${collaboratorDisplayName(feedback.gestor)} pediu para excluir o feedback dado a ` +
      `${collaboratorDisplayName(feedback.collaborator)}. Motivo: ${motivo}`;
    for (const uid of aprovadores) {
      await this.notificar(uid, "people_feedback_exclusao", titulo, mensagem, id);
    }

    return { ...(await this.obter(user, id)), aprovadoresNotificados: aprovadores.length };
  }

  async decidirExclusao(user: UsuarioContexto, id: string, dto: DecidirExclusaoDto) {
    const { feedback } = await this.exigirAcao(user, id, "decidir_exclusao");
    const parecer = dto.parecer?.trim() || null;
    const agora = new Date();

    if (dto.aprovar) {
      await this.db.feedbackDesempenho.update({
        where: { id },
        data: {
          exclusaoStatus: null,
          exclusaoDecididaPor: user.id ?? null,
          exclusaoDecididaEm: agora,
          exclusaoParecer: parecer,
          excluidoEm: agora,
        },
      });
      await this.removerCompromissosFuturos(id);
    } else {
      await this.db.feedbackDesempenho.update({
        where: { id },
        data: {
          exclusaoStatus: EXCLUSAO.REPROVADA,
          exclusaoDecididaPor: user.id ?? null,
          exclusaoDecididaEm: agora,
          exclusaoParecer: parecer,
        },
      });
    }

    await this.registrarEvento(user, id, dto.aprovar ? "exclusao_aprovada" : "exclusao_reprovada", parecer);
    await this.auditar(
      user, id, dto.aprovar ? "excluir" : "reprovar_exclusao",
      dto.aprovar ? "Exclusão de feedback de desempenho aprovada pelo RH" : "Exclusão de feedback de desempenho reprovada pelo RH",
    );

    // O pedido saiu da fila de todos os aprovadores, não só de quem decidiu:
    // um segundo RH clicando "aprovar" num pedido já decidido só geraria erro.
    await this.db.notification.updateMany({
      where: { tipo: "people_feedback_exclusao", referenciaTipo: REF_TIPO, referenciaId: id, lida: false },
      data: { lida: true },
    });

    const colaboradorNome = collaboratorDisplayName(feedback.collaborator);
    if (feedback.exclusaoSolicitadaPor) {
      await this.notificar(
        feedback.exclusaoSolicitadaPor,
        dto.aprovar ? "people_feedback_exclusao_aprovada" : "people_feedback_exclusao_reprovada",
        dto.aprovar ? "Exclusão de feedback aprovada" : "Exclusão de feedback reprovada",
        dto.aprovar
          ? `O RH aprovou a exclusão do feedback de ${colaboradorNome}.` + (parecer ? ` Parecer: ${parecer}` : "")
          : `O RH reprovou a exclusão do feedback de ${colaboradorNome}. O registro continua ativo.` +
            (parecer ? ` Parecer: ${parecer}` : ""),
        id,
      );
    }

    if (dto.aprovar) return { success: true, data: { id, excluido: true } };
    return this.obter(user, id);
  }

  /* ── 3. Ciência (Meu RH) ────────────────────────────────────────────────── */

  /**
   * Feedbacks recebidos por quem está logado.
   *
   * O alvo sai do vínculo do token, nunca da requisição — é o que dispensa
   * permissão. Antes da reunião aparece só o agendamento, sem o texto.
   */
  async meus(user: UsuarioContexto) {
    const organizationId = this.exigirOrganizacao(user);
    const eu = await this.escopo.proprioCollaboratorId(user);
    if (!eu) return { success: true, data: [] };

    const itens = await this.db.feedbackDesempenho.findMany({
      where: {
        organizationId, collaboratorId: eu, excluidoEm: null,
        status: { in: [STATUS_FEEDBACK.REUNIAO_AGENDADA, STATUS_FEEDBACK.AGUARDANDO_CIENCIA, STATUS_FEEDBACK.ENCERRADO] },
      },
      orderBy: { criadoEm: "desc" },
      include: INCLUDE_PESSOAS,
    });

    return { success: true, data: itens.map((f: any) => this.visaoDoColaborador(f)) };
  }

  async meu(user: UsuarioContexto, id: string) {
    const f = await this.carregarDoColaborador(user, id);
    const eventos = colaboradorLeConteudo(f.status) ? await this.eventosVisiveisAoColaborador(id) : [];
    return { success: true, data: { ...this.visaoDoColaborador(f), eventos } };
  }

  async registrarCiencia(user: UsuarioContexto, id: string, dto: RegistrarCienciaDto) {
    const f = await this.carregarDoColaborador(user, id);
    const recusa = validarAcao("registrar_ciencia", "colaborador", f);
    if (recusa) throw new BadRequestException(EXPLICACAO_RECUSA[recusa]);

    const comentario = dto.comentario?.trim() || null;
    await this.db.feedbackDesempenho.update({
      where: { id },
      data: {
        status: proximoStatus("registrar_ciencia", f.status),
        cienciaEm: new Date(),
        comentarioColaborador: comentario,
      },
    });

    await this.registrarEvento(user, id, "ciencia", comentario ? "Com comentário" : null);
    await this.auditar(user, id, "ciencia", "Ciência do feedback de desempenho registrada");

    await this.notificar(
      f.gestor.userId, "people_feedback_encerrado",
      "Feedback encerrado",
      `${collaboratorDisplayName(f.collaborator)} registrou ciência do seu feedback` +
        (comentario ? " e deixou um comentário." : "."),
      id,
    );

    return this.meu(user, id);
  }

  /* ── Montagem ───────────────────────────────────────────────────────────── */

  private visaoDoColaborador(f: any) {
    const le = colaboradorLeConteudo(f.status);
    return {
      id: f.id,
      status: f.status,
      rotuloStatus: ROTULO_STATUS[f.status as StatusFeedback] ?? f.status,
      gestor: { nome: collaboratorDisplayName(f.gestor) },
      reuniaoInicio: f.reuniaoInicio,
      reuniaoLocal: f.reuniaoLocal,
      reuniaoRealizadaEm: f.reuniaoRealizadaEm,
      // Conteúdo só depois da reunião — nulo, e não string vazia, para a tela
      // não confundir "ainda não liberado" com "gestor não escreveu".
      pontosFortes: le ? f.pontosFortes : null,
      oportunidades: le ? f.oportunidades : null,
      alinhamentos: le ? f.alinhamentos : null,
      cienciaEm: f.cienciaEm,
      comentarioColaborador: f.comentarioColaborador,
      podeDarCiencia: validarAcao("registrar_ciencia", "colaborador", f) === null,
      criadoEm: f.criadoEm,
    };
  }

  private async montarDetalhe(user: UsuarioContexto, f: any, papeis: PapelNoFeedback[]) {
    const acoes = [...new Set(papeis.flatMap(p => acoesDisponiveis(p, f)))]
      // Quem pediu a exclusão não decide o próprio pedido, mesmo sendo RH.
      .filter(a => !(a === "decidir_exclusao" && f.exclusaoSolicitadaPor && f.exclusaoSolicitadaPor === user.id));

    const eventos = await this.db.feedbackDesempenhoEvento.findMany({
      where: { feedbackId: f.id },
      orderBy: { criadoEm: "asc" },
    });

    return {
      id: f.id,
      status: f.status,
      rotuloStatus: ROTULO_STATUS[f.status as StatusFeedback] ?? f.status,
      colaborador: {
        id: f.collaborator.id,
        nome: collaboratorDisplayName(f.collaborator),
        cargo: f.collaborator.position?.titulo ?? null,
      },
      gestor: { id: f.gestor.id, nome: collaboratorDisplayName(f.gestor) },
      pontosFortes: f.pontosFortes,
      oportunidades: f.oportunidades,
      reuniaoInicio: f.reuniaoInicio,
      reuniaoLocal: f.reuniaoLocal,
      reuniaoRealizadaEm: f.reuniaoRealizadaEm,
      alinhamentos: f.alinhamentos,
      cienciaEm: f.cienciaEm,
      comentarioColaborador: f.comentarioColaborador,
      exclusao: f.exclusaoStatus || f.exclusaoSolicitadaEm
        ? {
            status: f.exclusaoStatus,
            motivo: f.exclusaoMotivo,
            solicitadaEm: f.exclusaoSolicitadaEm,
            decididaEm: f.exclusaoDecididaEm,
            parecer: f.exclusaoParecer,
          }
        : null,
      criadoEm: f.criadoEm,
      papeis,
      acoes,
      eventos: eventos.map((e: any) => ({
        id: e.id, tipo: e.tipo, autorNome: e.autorNome, detalhe: e.detalhe, criadoEm: e.criadoEm,
      })),
    };
  }

  /**
   * A linha do tempo como o colaborador a vê: sem o pedido de exclusão e sem
   * as edições anteriores à reunião. O que ele precisa é saber quando a
   * conversa aconteceu e quando deu ciência.
   */
  private async eventosVisiveisAoColaborador(feedbackId: string) {
    const eventos = await this.db.feedbackDesempenhoEvento.findMany({
      where: { feedbackId, tipo: { in: ["reuniao_agendada", "reuniao_reagendada", "reuniao_realizada", "ciencia"] } },
      orderBy: { criadoEm: "asc" },
    });
    return eventos.map((e: any) => ({ id: e.id, tipo: e.tipo, autorNome: e.autorNome, detalhe: e.detalhe, criadoEm: e.criadoEm }));
  }

  /* ── Acesso ─────────────────────────────────────────────────────────────── */

  /**
   * Carrega o feedback para quem gerencia e diz em que papéis a pessoa está.
   *
   * 404 — e não 403 — para quem não alcança: dizer "existe mas não é seu" já
   * revela que alguém recebeu feedback.
   */
  private async carregarParaGestao(user: UsuarioContexto, id: string) {
    const organizationId = this.exigirOrganizacao(user);
    const feedback = await this.db.feedbackDesempenho.findFirst({
      where: { id, organizationId, excluidoEm: null },
      include: INCLUDE_PESSOAS,
    });
    if (!feedback) throw new NotFoundException("Feedback não encontrado");

    const eu = await this.escopo.proprioCollaboratorId(user);
    // O próprio colaborador lê pelo Meu RH, nunca por aqui.
    if (eu && feedback.collaboratorId === eu) throw new NotFoundException("Feedback não encontrado");

    const papeis: PapelNoFeedback[] = [];
    if (eu && feedback.gestorId === eu && this.tem(user, PEOPLE_PERMISSIONS.feedbackDesempenho.registrar)) {
      papeis.push("gestor");
    }
    const ehRh = this.tem(user, PEOPLE_PERMISSIONS.feedbackDesempenho.aprovarExclusao);
    if (ehRh) papeis.push("rh");

    const ehGestorDoRegistro = !!eu && feedback.gestorId === eu;
    const leNaEquipe =
      this.tem(user, PEOPLE_PERMISSIONS.feedbackDesempenho.ver) &&
      (await this.escopo.podeAcessar(user, feedback.collaboratorId));

    if (!ehGestorDoRegistro && !ehRh && !leNaEquipe) throw new NotFoundException("Feedback não encontrado");

    return { feedback, papeis };
  }

  private async exigirAcao(
    user: UsuarioContexto, id: string, acao: AcaoFeedback,
    carregado?: { feedback: any; papeis: PapelNoFeedback[] },
  ) {
    const { feedback, papeis } = carregado ?? (await this.carregarParaGestao(user, id));

    const recusas = papeis.map(p => validarAcao(acao, p, feedback));
    if (!recusas.includes(null)) {
      // A recusa mais informativa: "etapa errada" diz mais que "papel" a quem
      // tem o papel certo.
      const motivo = recusas.find(r => r && r !== "papel_nao_permitido") ?? "papel_nao_permitido";
      if (motivo === "papel_nao_permitido") throw new ForbiddenException(EXPLICACAO_RECUSA[motivo]);
      throw new BadRequestException(EXPLICACAO_RECUSA[motivo]);
    }

    if (acao === "decidir_exclusao" && feedback.exclusaoSolicitadaPor && feedback.exclusaoSolicitadaPor === user.id) {
      throw new ForbiddenException("Quem pediu a exclusão não pode decidir o próprio pedido.");
    }

    return { feedback, papeis };
  }

  private async carregarDoColaborador(user: UsuarioContexto, id: string) {
    const organizationId = this.exigirOrganizacao(user);
    const eu = await this.escopo.proprioCollaboratorId(user);
    if (!eu) throw new NotFoundException("Feedback não encontrado");

    const f = await this.db.feedbackDesempenho.findFirst({
      where: {
        id, organizationId, collaboratorId: eu, excluidoEm: null,
        // Registrado e ainda sem reunião é rascunho do gestor: não existe para o colaborador.
        status: { not: STATUS_FEEDBACK.REGISTRADO },
      },
      include: INCLUDE_PESSOAS,
    });
    if (!f) throw new NotFoundException("Feedback não encontrado");
    return f;
  }

  private tem(user: UsuarioContexto, permissao: string): boolean {
    if (user.isMaster) return true;
    const perms = expandLegacyPermissions(user.permissions ?? []);
    return perms.has("*") || perms.has(permissao);
  }

  /**
   * Usuários ativos da organização que podem decidir exclusão.
   *
   * Resolve a permissão pelo banco (papel + concessão direta − revogação) em
   * vez de por nome de papel: cada cliente decide quem é o RH. Se ninguém tiver
   * a permissão, o master da organização recebe — um pedido sem destinatário
   * travaria o feedback para sempre.
   */
  private async aprovadoresDeExclusao(organizationId: string): Promise<string[]> {
    const permissao = await this.db.permission.findFirst({
      where: { recurso: "people.feedback_desempenho", acao: "aprovar_exclusao" },
      select: { id: true },
    });

    const usuarios = await this.db.user.findMany({
      where: { organizationId, ativo: true },
      select: {
        id: true,
        userRoles: {
          select: {
            role: {
              select: {
                isMaster: true,
                rolePermissions: permissao
                  ? { where: { permissionId: permissao.id }, select: { permissionId: true } }
                  : { where: { permissionId: "__nenhuma__" }, select: { permissionId: true } },
              },
            },
          },
        },
        permissionOverrides: permissao
          ? { where: { permissionId: permissao.id }, select: { conceder: true } }
          : { where: { permissionId: "__nenhuma__" }, select: { conceder: true } },
      },
    });

    const comPermissao: string[] = [];
    const masters: string[] = [];
    for (const u of usuarios) {
      const override = u.permissionOverrides[0];
      const peloPapel = u.userRoles.some((ur: any) => ur.role.rolePermissions.length > 0);
      if (override ? override.conceder : peloPapel) comPermissao.push(u.id);
      if (u.userRoles.some((ur: any) => ur.role.isMaster)) masters.push(u.id);
    }

    return comPermissao.length > 0 ? comPermissao : masters;
  }

  /* ── Agenda ─────────────────────────────────────────────────────────────── */

  /**
   * Um compromisso na agenda do gestor e outro na do colaborador — o mesmo
   * desenho da reunião do Strategy. Remarcar atualiza os dois em vez de criar
   * novos, e o writeback leva a mudança ao Outlook de quem tem integração.
   */
  private async sincronizarAgenda(user: UsuarioContexto, f: any, inicio: Date, local: string | null) {
    const fim = new Date(inicio.getTime() + DURACAO_REUNIAO_MIN * 60_000);
    const colaboradorNome = collaboratorDisplayName(f.collaborator);
    const gestorNome = collaboratorDisplayName(f.gestor);

    const participantes = [
      { userId: f.gestor.userId as string | null, titulo: `Reunião de feedback — ${colaboradorNome}` },
      { userId: f.collaborator.userId as string | null, titulo: `Reunião de feedback com ${gestorNome}` },
    ].filter(p => !!p.userId) as { userId: string; titulo: string }[];

    try {
      const existentes = await this.db.event.findMany({
        where: { organizationId: f.organizationId, origemTipo: ORIGEM_AGENDA, origemId: f.id },
        select: { id: true, userId: true },
      });

      for (const p of participantes) {
        const atual = existentes.find((e: any) => e.userId === p.userId);
        if (atual) {
          await this.db.event.update({
            where: { id: atual.id },
            data: { titulo: p.titulo, inicio, fim, local },
          });
          this.writeback.onEventUpdated(atual.id).catch(() => {});
        } else {
          const ev = await this.db.event.create({
            data: {
              organizationId: f.organizationId, userId: p.userId, criadoPorId: user.id,
              titulo: p.titulo,
              descricao: "Conversa individual de feedback — Avaliação de Desempenho.",
              tipo: "REUNIAO", inicio, fim, local,
              origemTipo: ORIGEM_AGENDA, origemId: f.id, confirmado: true,
            },
          });
          this.writeback.onEventCreated(ev.id).catch(() => {});
        }
      }
    } catch (erro) {
      // A agenda é consequência, não a regra: falhar aqui não pode desfazer o
      // agendamento que já está gravado no feedback.
      this.logger.error(`Falha ao sincronizar agenda do feedback ${f.id}`, erro as Error);
    }
  }

  /** Feedback excluído não deixa reunião futura na agenda de ninguém. */
  private async removerCompromissosFuturos(feedbackId: string) {
    try {
      const futuros = await this.db.event.findMany({
        where: { origemTipo: ORIGEM_AGENDA, origemId: feedbackId, inicio: { gte: new Date() } },
        select: { id: true, userId: true, externalId: true, connectionId: true },
      });
      for (const ev of futuros) {
        await this.db.event.delete({ where: { id: ev.id } });
        this.writeback.onEventDeleted({ externalId: ev.externalId, connectionId: ev.connectionId, userId: ev.userId }).catch(() => {});
      }
    } catch (erro) {
      this.logger.error(`Falha ao remover compromissos do feedback ${feedbackId}`, erro as Error);
    }
  }

  /* ── Auxiliares ─────────────────────────────────────────────────────────── */

  private exigirCampos(dados: { pontosFortes?: string | null; oportunidades?: string | null }) {
    const faltam = camposFaltantesRegistro(dados);
    if (faltam.length) throw new BadRequestException(`Preencha ${faltam.join(" e ")}.`);
  }

  private exigirOrganizacao(user: UsuarioContexto): string {
    if (!user?.organizationId) throw new ForbiddenException("Contexto de organização ausente");
    return user.organizationId;
  }

  private async registrarEvento(user: UsuarioContexto, feedbackId: string, tipo: string, detalhe?: string | null) {
    // O JWT não carrega o nome — e ele é guardado no evento para a linha do
    // tempo continuar legível se o usuário for renomeado ou removido.
    const autor = user.id
      ? await this.db.user.findUnique({ where: { id: user.id }, select: { nome: true } })
      : null;
    await this.db.feedbackDesempenhoEvento.create({
      data: {
        id: randomUUID(), feedbackId, tipo,
        userId: user.id ?? null, autorNome: autor?.nome ?? null, detalhe: detalhe ?? null,
      },
    });
  }

  /**
   * Manda e-mail ao colaborador sem segurar a resposta nem desfazer a ação.
   *
   * O e-mail é aviso, não parte da regra: se o servidor de e-mail falhar, o
   * agendamento e a liberação continuam valendo e o aviso no sistema já foi
   * criado. Por isso roda solto e só registra no log.
   *
   * Destino: o e-mail do login (quem recebe feedback tem login, por regra); o
   * corporativo da ficha só entra se o login não tiver e-mail.
   */
  private enviarEmail(
    colaborador: any, feedbackId: string, oque: string,
    enviar: (email: string, nome: string) => Promise<boolean>,
  ) {
    const destino = colaborador?.user?.email || colaborador?.emailCorporativo;
    if (!destino) {
      this.logger.warn(`Feedback ${feedbackId}: colaborador sem e-mail — e-mail de ${oque} não enviado.`);
      return;
    }
    enviar(destino, collaboratorDisplayName(colaborador))
      .then(ok => {
        if (!ok) this.logger.warn(`Feedback ${feedbackId}: e-mail de ${oque} para ${destino} não saiu (ver EmailService).`);
      })
      .catch(erro => this.logger.error(`Feedback ${feedbackId}: falha no e-mail de ${oque}`, erro as Error));
  }

  private async notificar(userId: string | null | undefined, tipo: string, titulo: string, mensagem: string, feedbackId: string) {
    if (!userId) return;
    try {
      await this.db.notification.create({
        data: {
          id: randomUUID(), userId, tipo, titulo, mensagem,
          referenciaTipo: REF_TIPO, referenciaId: feedbackId, modulo: "people",
        },
      });
    } catch (erro) {
      this.logger.error(`Falha ao notificar ${tipo} do feedback ${feedbackId}`, erro as Error);
    }
  }

  private async auditar(user: UsuarioContexto, registroId: string, acao: string, descricao: string) {
    try {
      await this.audit.log({
        organizationId: user.organizationId!,
        userId: user.id ?? null,
        modulo: "people",
        tabela: TABELA,
        registroId, acao, descricao,
      });
    } catch (erro) {
      this.logger.error(`Falha ao auditar ${acao} de ${registroId}`, erro as Error);
    }
  }
}
