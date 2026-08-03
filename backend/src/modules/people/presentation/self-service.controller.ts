import {
  Controller, Get, Post, Body, Req, UseGuards, UseInterceptors, UploadedFile,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { SelfServiceService } from "../application/self-service.service";
import { SolicitarFeriasDto } from "../application/vacation.service";
import { EnviarDocumentoDto } from "../application/dto/document.dto";
import { TAMANHO_MAXIMO_BYTES } from "../domain/document.entity";

/**
 * Meu RH — as rotas do próprio colaborador.
 *
 * SEM `PermissionsGuard` E SEM `@Permissions`, de propósito. Todas as outras
 * rotas do People exigem uma permissão `people.*` porque tratam do dado de
 * terceiros; estas tratam do dado de quem chamou. Exigir concessão do RH para
 * alguém ver o próprio saldo de férias inverteria o sentido do controle de
 * acesso — ele existe para proteger o dado dos outros, não o da própria pessoa.
 *
 * NENHUMA ROTA AQUI RECEBE `collaboratorId`. O alvo sai do token, no serviço.
 * É a propriedade que sustenta a decisão acima: sem parâmetro de identidade,
 * não existe requisição que peça o dado do colega, e portanto não existe
 * checagem que possa faltar.
 *
 * Controller fino: nenhuma regra mora aqui (BACKEND.md §14).
 */
@Controller("v1/people/eu")
@UseGuards(AuthGuard("jwt"))
export class SelfServiceController {
  constructor(private readonly service: SelfServiceService) {}

  @Get()
  resumo(@Req() req: any) {
    return this.service.resumo(req.user);
  }

  @Get("ferias")
  ferias(@Req() req: any) {
    return this.service.minhasFerias(req.user);
  }

  @Post("ferias")
  solicitarFerias(@Req() req: any, @Body() dto: SolicitarFeriasDto) {
    return this.service.solicitarFerias(req.user, dto);
  }

  @Get("documentos")
  documentos(@Req() req: any) {
    return this.service.meusDocumentos(req.user);
  }

  // `memoryStorage` pela mesma razão do DocumentController: com disco o multer
  // grava antes de qualquer validação, em diretório escolhido por ele.
  @Post("documentos")
  @UseInterceptors(FileInterceptor("arquivo", {
    storage: memoryStorage(),
    limits: { fileSize: TAMANHO_MAXIMO_BYTES },
  }))
  enviarDocumento(
    @Req() req: any,
    @Body() dto: EnviarDocumentoDto,
    @UploadedFile() arquivo: any,
  ) {
    return this.service.enviarDocumento(req.user, dto, arquivo);
  }

  @Get("desenvolvimento")
  desenvolvimento(@Req() req: any) {
    return this.service.meuDesenvolvimento(req.user);
  }

  @Get("carreira")
  carreira(@Req() req: any) {
    return this.service.minhaCarreira(req.user);
  }

  @Get("checklist")
  checklist(@Req() req: any) {
    return this.service.meusChecklists(req.user);
  }

  @Get("beneficios")
  beneficios(@Req() req: any) {
    return this.service.meusBeneficios(req.user);
  }

  @Get("feedbacks")
  feedbacks(@Req() req: any) {
    return this.service.meusFeedbacks(req.user);
  }
}
