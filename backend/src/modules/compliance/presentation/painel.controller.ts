import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { Permissions } from "../../auth/permissions.decorator";
import { COMPLIANCE_PERMISSIONS } from "../compliance.permissions";
import { PainelService } from "../application/painel.service";
import { RelatorioService } from "../application/relatorio.service";

@Controller("v1/compliance")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class PainelController {
  constructor(
    private readonly painel: PainelService,
    private readonly relatorios: RelatorioService,
  ) {}

  @Get("painel")
  @Permissions(COMPLIANCE_PERMISSIONS.relatorio.ver)
  executivo(@Req() req: any) {
    return this.painel.painel(req.user);
  }

  /**
   * Painel pessoal.
   *
   * SEM permissão declarada, de propósito: é a única tela do módulo feita para
   * quem RESPONDE pela obrigação, e não para quem administra o módulo. Exigir
   * concessão para alguém ver as próprias pendências inverteria o controle de
   * acesso — e o serviço já só devolve aquilo em que o usuário está nomeado.
   */
  @Get("meu-painel")
  meu(@Req() req: any) {
    return this.painel.meuPainel(req.user);
  }

  @Get("calendario")
  @Permissions(COMPLIANCE_PERMISSIONS.obrigacao.ver)
  calendario(@Req() req: any, @Query("de") de?: string, @Query("ate") ate?: string) {
    return this.painel.calendario(req.user, de, ate);
  }

  @Get("relatorios")
  @Permissions(COMPLIANCE_PERMISSIONS.relatorio.ver)
  agregados(@Req() req: any) {
    return this.relatorios.agregados(req.user);
  }
}
