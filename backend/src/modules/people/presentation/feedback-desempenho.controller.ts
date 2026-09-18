import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { Permissions } from "../../auth/permissions.decorator";
import {
  FeedbackDesempenhoService,
  AgendarReuniaoDto, CriarFeedbackDesempenhoDto, DecidirExclusaoDto, EditarFeedbackDesempenhoDto,
  FiltroFeedbackDesempenhoDto, FiltroImpressaoDto, RegistrarCienciaDto, RegistrarReuniaoDto, SolicitarExclusaoDto,
} from "../application/feedback-desempenho.service";
import { PEOPLE_PERMISSIONS } from "../people.permissions";

const P = PEOPLE_PERMISSIONS.feedbackDesempenho;

/**
 * Avaliação de Desempenho › Feedback — quem conduz e quem decide.
 *
 * O detalhe (`GET :id`) não tem `@Permissions`: quem o abre pode ser o gestor
 * que registrou, alguém da gestão com a equipe no escopo, ou o RH chegando
 * por uma notificação de exclusão — três caminhos que uma permissão única não
 * descreve. O serviço decide e responde 404 a quem não alcança.
 *
 * Controller fino: nenhuma regra mora aqui.
 */
@Controller("v1/people/feedbacks-desempenho")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class FeedbackDesempenhoController {
  constructor(private readonly service: FeedbackDesempenhoService) {}

  // Estáticas antes das paramétricas: o Nest casa por ordem de declaração.
  @Get("colaboradores-elegiveis")
  @Permissions(P.registrar)
  elegiveis(@Req() req: any) {
    return this.service.colaboradoresElegiveis(req.user);
  }

  // Impressão (relatório consolidado e fichas). O nome NÃO leva "relatorio":
  // o nginx limita a 5 req/min qualquer rota com essa palavra — o filtro da
  // tela bateria no limite em poucos cliques. Mesma faixa de acesso da lista.
  @Get("impressao")
  impressao(@Req() req: any, @Query() filtro: FiltroImpressaoDto) {
    return this.service.impressao(req.user, filtro);
  }

  // Acompanhamento: mesma faixa de acesso da lista, conferida no serviço.
  // `dias` limitado ao que a tela oferece — período livre viraria varredura
  // aberta na tabela por querystring.
  @Get("acompanhamento")
  acompanhamento(@Req() req: any, @Query("dias") dias?: string) {
    const permitidos = [30, 90, 180, 365];
    const pedido = Number(dias);
    return this.service.acompanhamento(req.user, permitidos.includes(pedido) ? pedido : 90);
  }

  // Sem `@Permissions`: o guard exige TODAS as listadas, e a lista vale para
  // quem tem `ver` OU `aprovar_exclusao` (o RH que só decide pedidos). O
  // serviço confere.
  @Get()
  listar(@Req() req: any, @Query() filtro: FiltroFeedbackDesempenhoDto) {
    return this.service.listar(req.user, filtro);
  }

  @Get(":id")
  obter(@Req() req: any, @Param("id") id: string) {
    return this.service.obter(req.user, id);
  }

  @Post()
  @Permissions(P.registrar)
  criar(@Req() req: any, @Body() dto: CriarFeedbackDesempenhoDto) {
    return this.service.criar(req.user, dto);
  }

  @Patch(":id")
  @Permissions(P.registrar)
  editar(@Req() req: any, @Param("id") id: string, @Body() dto: EditarFeedbackDesempenhoDto) {
    return this.service.editar(req.user, id, dto);
  }

  @Post(":id/reuniao")
  @Permissions(P.registrar)
  agendar(@Req() req: any, @Param("id") id: string, @Body() dto: AgendarReuniaoDto) {
    return this.service.agendarReuniao(req.user, id, dto);
  }

  @Post(":id/reuniao/realizada")
  @Permissions(P.registrar)
  registrarReuniao(@Req() req: any, @Param("id") id: string, @Body() dto: RegistrarReuniaoDto) {
    return this.service.registrarReuniao(req.user, id, dto);
  }

  @Post(":id/exclusao")
  @Permissions(P.registrar)
  solicitarExclusao(@Req() req: any, @Param("id") id: string, @Body() dto: SolicitarExclusaoDto) {
    return this.service.solicitarExclusao(req.user, id, dto);
  }

  @Post(":id/exclusao/decisao")
  @Permissions(P.aprovarExclusao)
  decidirExclusao(@Req() req: any, @Param("id") id: string, @Body() dto: DecidirExclusaoDto) {
    return this.service.decidirExclusao(req.user, id, dto);
  }
}

/**
 * O lado do colaborador: ler o feedback recebido e dar ciência.
 *
 * Sem `PermissionsGuard`, como todo o Meu RH: nenhuma rota recebe
 * `collaboratorId` — o alvo sai do token, no serviço.
 */
@Controller("v1/people/eu/feedbacks-desempenho")
@UseGuards(AuthGuard("jwt"))
export class MeusFeedbacksDesempenhoController {
  constructor(private readonly service: FeedbackDesempenhoService) {}

  @Get()
  meus(@Req() req: any) {
    return this.service.meus(req.user);
  }

  @Get(":id")
  meu(@Req() req: any, @Param("id") id: string) {
    return this.service.meu(req.user, id);
  }

  @Post(":id/ciencia")
  ciencia(@Req() req: any, @Param("id") id: string, @Body() dto: RegistrarCienciaDto) {
    return this.service.registrarCiencia(req.user, id, dto);
  }
}
