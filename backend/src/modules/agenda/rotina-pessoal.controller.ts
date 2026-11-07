import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Max, Min, Matches } from 'class-validator';
import { RotinaPessoalService } from './rotina-pessoal.service';
class LembreteDto { @IsString() @Length(5,500) texto: string; }
class HabitoDto {
  @IsString() @Length(1,80) titulo: string;
  @IsInt() @Min(1) @Max(366) dias: number;
  @Matches(/^#[0-9a-f]{6}$/i) cor: string;
  @IsOptional() @IsString() inicio?: string;
}
class ArquivoDto { @IsBoolean() arquivado: boolean; }
@Controller('rotina-pessoal')
@UseGuards(AuthGuard('jwt'))
export class RotinaPessoalController {
  constructor(private svc: RotinaPessoalService) {}
  @Get('lembretes') listar(@Req() r: any) { return this.svc.lembretes(r.user); }
  @Post('lembretes') criar(@Req() r: any, @Body() d: LembreteDto) { return this.svc.criarLembrete(r.user,d.texto); }
  @Post('lembretes/:id/cancelar') cancelar(@Req() r: any, @Param('id') id: string) { return this.svc.cancelar(r.user,id); }
  @Get('habitos') habitos(@Req() r: any) { return this.svc.habitos(r.user); }
  @Post('habitos') novo(@Req() r: any, @Body() d: HabitoDto) { return this.svc.salvarHabito(r.user,d); }
  @Put('habitos/:id') editar(@Req() r: any, @Param('id') id: string, @Body() d: HabitoDto) { return this.svc.salvarHabito(r.user,d,id); }
  @Post('habitos/:id/arquivo') arquivo(@Req() r: any, @Param('id') id: string, @Body() d: ArquivoDto) { return this.svc.arquivar(r.user,id,d.arquivado); }
  @Post('habitos/:id/checkin') checkin(@Req() r: any, @Param('id') id: string) { return this.svc.checkin(r.user,id); }
  @Post('habitos/:id/desfazer') desfazer(@Req() r: any, @Param('id') id: string) { return this.svc.checkin(r.user,id,true); }
}
