import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { anonimizarExemploAurelia } from './aurelia-privacidade';

@Injectable()
export class AureliaAprendizadoService {
  constructor(private readonly prisma: PrismaService) {}

  async registrarPendente(input: { organizationId: string; userId?: string; entrada: string; intencao?: string; resposta?: string }) {
    const entrada = anonimizarExemploAurelia(input.entrada);
    const resposta = anonimizarExemploAurelia(input.resposta || '');
    if (!entrada) return;
    await (this.prisma as any).aureliaLearningExample.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        entrada,
        intencao: input.intencao || 'DESCONHECIDA',
        resposta,
        status: 'PENDENTE',
      },
    });
  }
  async salvarMemoria(input: { organizationId: string; userId: string; chave: string; valor: string; consentimento: boolean; expiraEm?: Date }) {
    if (!input.consentimento || !input.chave || !input.valor) return;
    const valor = anonimizarExemploAurelia(input.valor);
    await (this.prisma as any).aureliaMemoria.upsert({ where: { userId_chave: { userId: input.userId, chave: input.chave } }, update: { valor, consentimento: true, expiraEm: input.expiraEm }, create: { organizationId: input.organizationId, userId: input.userId, chave: input.chave, valor, consentimento: true, expiraEm: input.expiraEm } });
  }
  async listarMemorias(userId: string) {
    return (this.prisma as any).aureliaMemoria.findMany({ where: { userId, consentimento: true, OR: [{ expiraEm: null }, { expiraEm: { gt: new Date() } }] }, select: { chave: true, valor: true } });
  }
}
