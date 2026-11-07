import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsBoolean, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { AureliaAprendizadoService } from './aurelia-aprendizado.service';
class PreferenciasDto {
  @IsBoolean() ativo: boolean;
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/) manha: string;
}
class RevisaoAprendizadoDto {
  @IsIn(['APROVADO','REJEITADO','ARQUIVADO']) status: string;
  @IsOptional() @IsString() @Length(2,2000) resposta?: string;
}
@Controller('aurelia-aprendizado')
@UseGuards(AuthGuard('jwt'))
export class AureliaAprendizadoController {
  constructor(private svc: AureliaAprendizadoService) {}
  private s(r: any) { return { userId:r.user.id, organizationId:r.user.organizationId }; }
  @Get() painel(@Req() r: any) { return this.svc.painel(this.s(r)); }
  @Post('preferencias') configurar(@Req() r: any,@Body() d: PreferenciasDto) { return this.svc.configurar(this.s(r),d.ativo,d.manha); }
  @Post('exemplos/:id') revisar(@Req() r: any,@Param('id') id: string,@Body() d: RevisaoAprendizadoDto) { return this.svc.revisar(this.s(r),id,d.status,d.resposta); }
  @Delete() apagar(@Req() r: any) { return this.svc.apagar(this.s(r)); }
}
