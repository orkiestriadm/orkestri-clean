import { Controller, Get, Post, Delete, Body, Param, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { Permissions } from "../../auth/permissions.decorator";
import {
  Review360Service, ConvidarAvaliadorDto, ResponderAvaliacaoDto,
} from "../application/review360.service";
import { PEOPLE_PERMISSIONS } from "../people.permissions";

/**
 * Avaliação 360 — autoavaliação, pares e calibração.
 *
 * DUAS FAIXAS DE ACESSO convivem aqui, e a separação é o ponto:
 *
 *  - CONDUZIR (convidar, ver o painel, calibrar) exige `people.avaliacao:*` —
 *    é ler a leitura que os outros fizeram de alguém.
 *  - RESPONDER e ver o PRÓPRIO resultado não exigem permissão nenhuma além de
 *    estar autenticado. Quem foi convidado responde; quem foi avaliado lê o
 *    que é seu. Exigir concessão do RH para alguém preencher a própria
 *    autoavaliação faria o ciclo depender de um cadastro de permissões.
 *
 * Nas rotas sem permissão o alvo sai do vínculo do usuário, nunca do corpo da
 * requisição — é o que as torna seguras sem guard.
 */
@Controller("v1/people/avaliacao360")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class Review360Controller {
  constructor(private readonly service: Review360Service) {}

  /* ── Quem responde ──────────────────────────────────────────────────────── */

  @Get("minhas-pendencias")
  minhasPendencias(@Req() req: any) {
    return this.service.minhasPendencias(req.user);
  }

  @Post("entradas/:entradaId/responder")
  responder(
    @Req() req: any,
    @Param("entradaId") entradaId: string,
    @Body() dto: ResponderAvaliacaoDto,
  ) {
    return this.service.responder(req.user, entradaId, dto);
  }

  @Get("meu-resultado/:ciclo")
  meuResultado(@Req() req: any, @Param("ciclo") ciclo: string) {
    return this.service.meuResultado(req.user, ciclo);
  }

  /* ── Quem conduz ────────────────────────────────────────────────────────── */

  // Estática antes das paramétricas: o Nest casa por ordem de declaração.
  @Get("calibracao")
  @Permissions(PEOPLE_PERMISSIONS.avaliacao.ver)
  calibracao(@Req() req: any, @Query("ciclo") ciclo: string) {
    return this.service.calibracao(req.user, ciclo);
  }

  @Get("ciclos")
  @Permissions(PEOPLE_PERMISSIONS.avaliacao.ver)
  ciclos(@Req() req: any) {
    return this.service.ciclos(req.user);
  }

  @Get("reviews/:reviewId")
  @Permissions(PEOPLE_PERMISSIONS.avaliacao.ver)
  painel(@Req() req: any, @Param("reviewId") reviewId: string) {
    return this.service.painel(req.user, reviewId);
  }

  @Post("reviews/:reviewId/convidar")
  @Permissions(PEOPLE_PERMISSIONS.avaliacao.gerenciar)
  convidar(
    @Req() req: any,
    @Param("reviewId") reviewId: string,
    @Body() dto: ConvidarAvaliadorDto,
  ) {
    return this.service.convidar(req.user, reviewId, dto);
  }

  @Delete("entradas/:entradaId")
  @Permissions(PEOPLE_PERMISSIONS.avaliacao.gerenciar)
  remover(@Req() req: any, @Param("entradaId") entradaId: string) {
    return this.service.remover(req.user, entradaId);
  }
}
