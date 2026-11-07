import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { anonimizarExemploAurelia } from './aurelia-privacidade';
import { validarExtracaoAgenda } from './aurelia-ia.service';
type Escopo = { userId: string; organizationId: string };

@Injectable()
export class AureliaAprendizadoService {
  constructor(private readonly prisma: PrismaService) {}
  async habilitado(s: Escopo) {
    return !!await this.prisma.aureliaMemoria.findFirst({ where: { ...s, chave: 'aprendizado', valor: 'ativo', consentimento: true } });
  }
  async configurar(s: Escopo, ativo: boolean, manha = '09:00') {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(manha)) throw new BadRequestException('Horário inválido.');
    await this.salvarMemoria({ ...s, chave: 'aprendizado', valor: ativo ? 'ativo' : 'inativo', consentimento: true });
    await this.salvarMemoria({ ...s, chave: 'horario_manha', valor: manha, consentimento: true });
    return { ativo, manha };
  }
  async painel(s: Escopo) {
    const memorias = await this.listarMemorias(s.userId, s.organizationId);
    const exemplos = await this.prisma.aureliaLearningExample.findMany({ where: s, orderBy: { criadoEm: 'desc' }, take: 100 });
    return { ativo: await this.habilitado(s), manha: memorias.find(m => m.chave === 'horario_manha')?.valor || '09:00', exemplos,
      aprovados: await this.prisma.aureliaLearningExample.count({ where: { ...s, status: 'APROVADO' } }) };
  }
  async registrarPendente(input: { organizationId: string; userId?: string; entrada: string; intencao?: string; resposta?: string }) {
    if (!input.userId || input.entrada.length > 1000) return;
    const s = { userId: input.userId, organizationId: input.organizationId };
    if (!await this.habilitado(s)) return;
    let raw: any; try { raw = JSON.parse(input.resposta || '{}'); } catch { return; }
    const resultado = validarExtracaoAgenda(raw, input.entrada);
    if (!resultado) return;
    let entrada = input.entrada;
    if (resultado.titulo) {
      entrada = entrada.split(resultado.titulo).join('compromisso');
      resultado.titulo = 'compromisso';
    }
    entrada = anonimizarExemploAurelia(entrada);
    if (!validarExtracaoAgenda(resultado,entrada)) return;
    const resposta = JSON.stringify(resultado);
    if (await this.prisma.aureliaLearningExample.findFirst({ where: { ...s, entrada, resposta } })) return;
    await this.prisma.aureliaLearningExample.create({ data: { ...s, entrada, resposta, intencao: resultado.acao, status: 'PENDENTE' } });
  }
  async revisar(s: Escopo, id: string, status: string, resposta?: string) {
    if (!['APROVADO','REJEITADO','ARQUIVADO'].includes(status)) throw new BadRequestException('Revisão inválida.');
    const r = await this.prisma.aureliaLearningExample.findFirst({ where: { id, ...s } });
    if (!r) throw new NotFoundException('Exemplo não encontrado.');
    const final = resposta ?? r.resposta;
    if (status === 'APROVADO') {
      let parsed: any; try { parsed = JSON.parse(final); } catch { throw new BadRequestException('Resposta deve ser um JSON válido.'); }
      if (!validarExtracaoAgenda(parsed,r.entrada)) throw new BadRequestException('Os campos devem copiar trechos do exemplo e usar somente ações permitidas.');
    }
    return this.prisma.aureliaLearningExample.update({ where: { id }, data: { status, resposta: final, revisadoEm: new Date() } });
  }
  async exemplosPara(s: Escopo, texto: string) {
    if (!await this.habilitado(s)) return [];
    const rows = await this.prisma.aureliaLearningExample.findMany({ where: { ...s, status: 'APROVADO', revisadoEm: { gt: new Date(Date.now()-90*86400000) } }, orderBy: { revisadoEm: 'desc' }, take: 100 });
    const palavras = new Set(anonimizarExemploAurelia(texto).toLowerCase().split(/\W+/).filter(p => p.length > 2));
    return rows.map(r => ({ r, score: r.entrada.toLowerCase().split(/\W+/).filter(p => palavras.has(p)).length }))
      .filter(x => x.score > 0).sort((a,b) => b.score-a.score).slice(0,3).flatMap(({r}) => {
        try { const v = validarExtracaoAgenda(JSON.parse(r.resposta),r.entrada); return v ? [{ entrada:r.entrada, resposta:JSON.stringify(v) }] : []; } catch { return []; }
      });
  }
  async salvarMemoria(input: Escopo & { chave: string; valor: string; consentimento: boolean; expiraEm?: Date }) {
    if (!input.consentimento) return;
    if (!['aprendizado','horario_manha'].includes(input.chave)) throw new BadRequestException('Preferência não suportada.');
    const { userId, organizationId, chave, valor, expiraEm } = input;
    return this.prisma.aureliaMemoria.upsert({ where: { userId_chave: { userId, chave } }, update: { organizationId, valor, consentimento: true, expiraEm }, create: { organizationId, userId, chave, valor, consentimento: true, expiraEm } });
  }
  async listarMemorias(userId: string, organizationId: string) {
    return this.prisma.aureliaMemoria.findMany({ where: { userId, organizationId, consentimento: true, OR: [{ expiraEm: null }, { expiraEm: { gt: new Date() } }] }, select: { chave: true, valor: true } });
  }
  async apagar(s: Escopo) {
    await this.prisma.$transaction([this.prisma.aureliaLearningExample.deleteMany({ where:s }), this.prisma.aureliaMemoria.deleteMany({ where:s })]);
    return { ok:true };
  }
  @Cron('0 0 3 * * *', { timeZone:'America/Sao_Paulo' })
  async expirar() { await this.prisma.aureliaLearningExample.deleteMany({ where: { criadoEm: { lt: new Date(Date.now()-90*86400000) } } }); }
}
