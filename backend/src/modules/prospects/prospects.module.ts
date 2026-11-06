import { Module, Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Injectable, CanActivate, ExecutionContext, ForbiddenException, BadRequestException, NotFoundException, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsString, IsOptional, IsBoolean, IsIn, IsArray, ArrayMaxSize, ArrayMinSize, MaxLength, IsDateString, ValidateNested, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { WhatsAppService } from '../notifications/whatsapp.service';
import * as XLSX from 'xlsx';
import { corrigirTelefoneLead } from './lead-phone';
import { conviteComOpcoes, modelosConviteAgenda } from './lead-onboarding';

export const ETAPAS = ['NOVO', 'CONVIDADO', 'EM_TESTE', 'EM_ACOMPANHAMENTO', 'PAGANTE', 'PERDIDO'];
export function normalizarTelefone(value: unknown): string | null {
  return corrigirTelefoneLead(value).numero || null;
}
export function personalizar(texto: string, lead: { nome: string; empresa: string }) {
  return texto.replace(/\{nome\}/g, () => lead.nome).replace(/\{empresa\}/g, () => lead.empresa);
}
@Injectable()
export class ProspectSaGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    if (ctx.switchToHttp().getRequest().user?.isSuperAdmin !== true) throw new ForbiddenException('Acesso exclusivo do SA');
    return true;
  }
}
class ImportRowDto {
  @IsString() @MaxLength(200) nome: string;
  @IsString() @MaxLength(100) telefone: string;
  @IsOptional() @IsString() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(200) empresa?: string;
}
class ImportDto {
  @IsString() @MaxLength(100) lista: string;
  @IsOptional() @IsString() @MaxLength(7000000) arquivo?: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(5000)
  @ValidateNested({ each: true }) @Type(() => ImportRowDto) contatos?: ImportRowDto[];
}
class UpdateDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) nome?: string;
  @IsOptional() @IsString() @MaxLength(100) telefone?: string;
  @IsOptional() @IsString() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(200) empresa?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) lista?: string;
  @IsOptional() @IsIn(ETAPAS) etapa?: string;
  @IsOptional() @IsString() @MaxLength(5000) observacoes?: string;
  @IsOptional() @IsBoolean() bloqueado?: boolean;
  @IsOptional() @IsBoolean() revisado?: boolean;
  @IsOptional() @IsBoolean() arquivado?: boolean;
  @IsOptional() @IsDateString() proximoContato?: string | null;
}
class CreateDto extends ImportRowDto {
  @IsString() @MinLength(1) @MaxLength(100) lista: string;
}
class BulkDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(5000) @IsString({ each: true }) ids: string[];
  @IsIn(['LIBERAR', 'REVISAR', 'ARQUIVAR', 'RESTAURAR', 'BLOQUEAR', 'DESBLOQUEAR', 'ETAPA', 'LISTA']) acao: string;
  @IsOptional() @IsString() @MaxLength(100) valor?: string;
}
class DeleteManyDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(5000) @IsString({ each: true }) ids: string[];
}
class SendDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1000) @IsString({ each: true }) ids: string[];
  @IsString() @MaxLength(4000) texto: string;
  @IsString() @MaxLength(120) campanha: string;
}
@Injectable()
export class ProspectsWorker implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval>;
  private busy = false;
  private logger = new Logger(ProspectsWorker.name);
  constructor(private db: PrismaService, private wa: WhatsAppService) {}
  onModuleInit() { this.timer = setInterval(() => void this.tick(), 5000); }
  onModuleDestroy() { clearInterval(this.timer); }
  async tick() {
    if (this.busy) return;
    this.busy = true;
    const db = this.db as any;
    try {
      const m = await db.prospectMessage.findFirst({ where: { status: 'PENDENTE' }, orderBy: { criadoEm: 'asc' } });
      if (!m) return;
      const claimed = await db.prospectMessage.updateMany({ where: { id: m.id, status: 'PENDENTE' }, data: { status: 'ENVIANDO' } });
      if (!claimed.count) return;
      const lead = await db.prospectLead.findUnique({ where: { id: m.leadId } });
      if (!lead || lead.bloqueado || lead.arquivado || lead.revisado === false) {
        await db.prospectMessage.update({ where: { id: m.id }, data: { status: 'CANCELADO', erro: 'Contato bloqueado, arquivado ou não liberado após revisão' } });
        return;
      }
      let ok = false;
      const instancia = typeof this.wa.resolveInstance === 'function' ? await this.wa.resolveInstance() : (process.env.EVOLUTION_INSTANCE || 'orkestri-default');
      try { ok = await this.wa.sendMessage(lead.telefone, m.texto, instancia); } catch {}
      const convite = ok && conviteComOpcoes(m.texto);
      await db.prospectMessage.update({ where: { id: m.id }, data: { status: ok ? 'ENVIADO' : 'FALHOU', enviadoEm: ok ? new Date() : null, erro: ok ? null : 'WhatsApp não confirmou o envio. Verifique a conexão.', ...(convite ? { instancia, conviteTelefone: lead.telefone, conviteEstado: 'PENDENTE', conviteRespondidoEm: null } : {}) } });
      if (convite) await db.prospectMessage.updateMany({ where: { leadId: m.leadId, instancia, conviteEstado: 'PENDENTE', id: { not: m.id } }, data: { conviteEstado: 'SUPERADO' } });
    } catch (e) { this.logger.error('Falha na fila de prospecção: ' + e.message); }
    finally { this.busy = false; }
  }
}
@Controller('superadmin/leads')
@UseGuards(AuthGuard('jwt'), ProspectSaGuard)
export class ProspectsController {
  constructor(private prisma: PrismaService) {}
  private logger = new Logger(ProspectsController.name);
  private get db(): any { return this.prisma; }
  @Get()
  list() { return this.db.prospectLead.findMany({ orderBy: { criadoEm: 'desc' }, include: { mensagens: { orderBy: { criadoEm: 'desc' }, take: 20 } } }); }
  @Get('modelos')
  modelos() { return modelosConviteAgenda(); }
  @Post()
  async criar(@Body() body: CreateDto) {
    const telefone = normalizarTelefone(body.telefone);
    if (!telefone || !body.nome.trim() || !body.lista.trim()) throw new BadRequestException('Informe nome, lista e telefone brasileiro com DDD');
    try { return await this.db.prospectLead.create({ data: { nome: body.nome.trim(), telefone, email: body.email?.trim() || '', empresa: body.empresa?.trim() || '', lista: body.lista.trim() } }); }
    catch (e) { if (e.code === 'P2002') throw new BadRequestException('Este telefone já está cadastrado'); throw e; }
  }
  @Post('lote')
  async lote(@Body() body: BulkDto) {
    const dados: any = {};
    const flags: any = { LIBERAR: ['revisado', true], REVISAR: ['revisado', false], ARQUIVAR: ['arquivado', true], RESTAURAR: ['arquivado', false], BLOQUEAR: ['bloqueado', true], DESBLOQUEAR: ['bloqueado', false] };
    if (flags[body.acao]) dados[flags[body.acao][0]] = flags[body.acao][1];
    else if (body.acao === 'ETAPA' && ETAPAS.includes(body.valor)) dados.etapa = body.valor;
    else if (body.acao === 'LISTA' && body.valor?.trim()) dados.lista = body.valor.trim();
    else throw new BadRequestException('Informe uma etapa ou lista válida');
    return this.db.prospectLead.updateMany({ where: { id: { in: [...new Set(body.ids)] } }, data: dados });
  }
  @Post('importar')
  async importar(@Body() body: ImportDto) {
    if (!body.lista.trim()) throw new BadRequestException('Informe o nome da lista');
    let rows: any[] = body.contatos;
    if (!rows) try {
      if (!body.arquivo) throw new Error('Arquivo ausente');
      const wb = XLSX.read(Buffer.from(body.arquivo, 'base64'), { type: 'buffer' });
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
    } catch { throw new BadRequestException('Planilha inválida. Use XLSX, XLS ou CSV.'); }
    if (!rows.length || rows.length > 5000) throw new BadRequestException('Importe entre 1 e 5.000 linhas');
    const validos = new Map<string, any>();
    const erros: { linha: number; motivo: string }[] = [];
    let repetidos = 0;
    rows.forEach((row, i) => {
      const r: any = {};
      Object.entries(row).forEach(([k, v]) => { r[k.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()] = String(v).trim(); });
      const telefone = normalizarTelefone(r.telefone || r.whatsapp || r.celular || r.contato);
      const nome = r.nome || r.name;
      if (!telefone || !nome || nome.length > 200) { erros.push({ linha: i + 2, motivo: 'Nome ou telefone brasileiro com DDD inválido' }); return; }
      if (validos.has(telefone)) { repetidos++; return; }
      validos.set(telefone, { nome, telefone, email: (r.email || r['e-mail'] || '').slice(0, 254), empresa: (r.empresa || '').slice(0, 200), lista: body.lista.trim() });
    });
    const result = validos.size ? await this.db.prospectLead.createMany({ data: [...validos.values()], skipDuplicates: true }) : { count: 0 };
    return { importados: result.count, duplicados: repetidos + validos.size - result.count, invalidos: erros.length, erros };
  }
  @Patch(':id')
  async atualizar(@Param('id') id: string, @Body() body: UpdateDto) {
    if (!await this.db.prospectLead.findUnique({ where: { id } })) throw new NotFoundException('Lead não encontrado');
    const data: any = { ...body, ...(body.proximoContato ? { proximoContato: new Date(body.proximoContato) } : {}) };
    for (const k of ['nome', 'lista', 'email', 'empresa']) if (typeof data[k] === 'string') data[k] = data[k].trim();
    if (data.nome === '' || data.lista === '') throw new BadRequestException('Nome e lista são obrigatórios');
    if (body.telefone !== undefined) {
      data.telefone = normalizarTelefone(body.telefone);
      if (!data.telefone) throw new BadRequestException('Telefone brasileiro com DDD inválido');
    }
    try { return await this.db.prospectLead.update({ where: { id }, data }); }
    catch (e) { if (e.code === 'P2002') throw new BadRequestException('Este telefone já pertence a outro contato'); throw e; }
  }
  /**
   * Exclusão DEFINITIVA — não é o `arquivado`, que esconde e pode ser
   * restaurado. Existe porque a base veio de importação de agenda e tem
   * contato que não deveria estar aqui: arquivar deixa o telefone guardado,
   * e para esses o certo é sumir.
   *
   * O histórico vai junto, na MESMA transação. `ProspectMessage.lead` é uma
   * relação obrigatória sem cascade, então apagar o lead com mensagens falha
   * na FK — e apagar as mensagens fora da transação deixaria o histórico
   * perdido se o lead não fosse embora.
   */
  private async excluir(ids: string[]) {
    const unicos = [...new Set(ids)];
    return this.prisma.$transaction(async (tx: any) => {
      const alvos = await tx.prospectLead.findMany({ where: { id: { in: unicos } }, select: { id: true } });
      if (!alvos.length) throw new NotFoundException('Nenhum contato encontrado para excluir');
      const encontrados = alvos.map((l: any) => l.id);
      const mensagens = await tx.prospectMessage.deleteMany({ where: { leadId: { in: encontrados } } });
      const leads = await tx.prospectLead.deleteMany({ where: { id: { in: encontrados } } });
      return { excluidos: leads.count, mensagensRemovidas: mensagens.count, naoEncontrados: unicos.length - encontrados.length };
    });
  }
  @Delete(':id')
  async remover(@Param('id') id: string) {
    const r = await this.excluir([id]);
    this.logger.warn(`Lead ${id} excluído definitivamente (${r.mensagensRemovidas} mensagens).`);
    return r;
  }
  @Post('excluir')
  async removerVarios(@Body() body: DeleteManyDto) {
    const r = await this.excluir(body.ids);
    this.logger.warn(`${r.excluidos} leads excluídos definitivamente (${r.mensagensRemovidas} mensagens).`);
    return r;
  }
  @Post('enviar')
  async enviar(@Body() body: SendDto) {
    if (!body.texto.trim() || !body.campanha.trim()) throw new BadRequestException('Informe a campanha e a mensagem');
    const ids = [...new Set(body.ids)];
    const leads = await this.db.prospectLead.findMany({ where: { id: { in: ids }, bloqueado: false, arquivado: false, revisado: true } });
    if (leads.length !== ids.length) throw new BadRequestException('Revise e libere todos os contatos antes de enviar. Contatos bloqueados ou arquivados não podem receber mensagens.');
    const result = await this.db.prospectMessage.createMany({ data: leads.map((l: any) => ({ leadId: l.id, campanha: body.campanha.trim(), texto: personalizar(body.texto.trim(), l) })) });
    return { enfileirados: result.count };
  }
}
@Module({ imports: [NotificationsModule], controllers: [ProspectsController], providers: [ProspectSaGuard, ProspectsWorker] })
export class ProspectsModule {}
