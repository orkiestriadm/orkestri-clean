import { ForbiddenException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { corrigirTelefoneLead } from './lead-phone';
import { normalizarTelefone, personalizar, ProspectSaGuard, ProspectsController, ProspectsWorker } from './prospects.module';

describe('Prospecção exclusiva do SA', () => {
  it.each([
    ['11999991234', '', '5511999991234'],
    ['(11) 99999-1234', '', '5511999991234'],
    ['+55 (11) 99999-1234', '', '5511999991234'],
    ['0055 11 99999 1234', '', '5511999991234'],
    ['011999991234', '', '5511999991234'],
    ['999991234', '11', '5511999991234'],
    ['33331234', '11', '551133331234'],
    ['55999991234', '', '5555999991234'],
    ['5.511999991234E+12', '', '5511999991234'],
    ['5511999991234.0', '', '5511999991234'],
  ])('corrige automaticamente %s com DDD %s', (raw, ddd, expected) => {
    expect(corrigirTelefoneLead(raw, ddd)).toMatchObject({ numero: expected, exibicao: '+' + expected });
  });
  it.each(['999991234', '123', '11 99999-1234 ramal 5', '+1 415 555 2671', '0044 20 7946 0958'])('mantém em conferência sem inventar dados: %s', raw => {
    expect(corrigirTelefoneLead(raw).numero).toBe('');
  });
  it('não muda um número já normalizado com +55', () => {
    expect(corrigirTelefoneLead('+5511999991234').corrigido).toBe(false);
  });
  it('importa contatos revisados na prévia sem exigir arquivo base64', async () => {
    const db: any = { prospectLead: { createMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const result = await new ProspectsController(db).importar({ lista: 'Lista revisada', contatos: [{ nome: 'Maria', telefone: '(11) 99999-1234', empresa: 'ACME', email: '' }] });
    expect(result.importados).toBe(1);
    expect(db.prospectLead.createMany.mock.calls[0][0].data[0]).toMatchObject({ telefone: '5511999991234', lista: 'Lista revisada' });
    expect(db.prospectLead.createMany.mock.calls[0][0].data[0]).not.toHaveProperty('revisado', true);
  });
  it('não chama o banco com importação sem linhas válidas', async () => {
    const db: any = { prospectLead: { createMany: jest.fn() } };
    const result = await new ProspectsController(db).importar({ lista: 'Inválida', contatos: [{ nome: 'Maria', telefone: '123' }] });
    expect(result).toMatchObject({ importados: 0, invalidos: 1 });
    expect(db.prospectLead.createMany).not.toHaveBeenCalled();
  });
  it('permite editar os dados e limpar a data de retorno', async () => {
    const db: any = { prospectLead: { findUnique: jest.fn().mockResolvedValue({ id: 'l1' }), update: jest.fn().mockResolvedValue({ id: 'l1' }) } };
    await new ProspectsController(db).atualizar('l1', { nome: ' Maria ', telefone: '(11) 99999-1234', lista: ' Lista ', proximoContato: null });
    expect(db.prospectLead.update).toHaveBeenCalledWith({ where: { id: 'l1' }, data: { nome: 'Maria', telefone: '5511999991234', lista: 'Lista', proximoContato: null } });
  });
  it('arquiva e restaura contatos em lote sem apagar histórico', async () => {
    const db: any = { prospectLead: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) } };
    const controller = new ProspectsController(db);
    await controller.lote({ ids: ['l1', 'l2'], acao: 'ARQUIVAR' });
    expect(db.prospectLead.updateMany).toHaveBeenLastCalledWith({ where: { id: { in: ['l1', 'l2'] } }, data: { arquivado: true } });
    await controller.lote({ ids: ['l1'], acao: 'RESTAURAR' });
    expect(db.prospectLead.updateMany).toHaveBeenLastCalledWith({ where: { id: { in: ['l1'] } }, data: { arquivado: false } });
  });
  it('exige liberação e contato ativo na seleção para envio', async () => {
    const db: any = { prospectLead: { findMany: jest.fn().mockResolvedValue([]) }, prospectMessage: { createMany: jest.fn() } };
    await expect(new ProspectsController(db).enviar({ ids: ['pendente'], texto: 'Olá', campanha: 'Teste' })).rejects.toThrow('Revise e libere');
    expect(db.prospectLead.findMany).toHaveBeenCalledWith({ where: { id: { in: ['pendente'] }, bloqueado: false, arquivado: false, revisado: true } });
    expect(db.prospectMessage.createMany).not.toHaveBeenCalled();
  });
  it('cancela envio pendente se o contato voltar para revisão ou for arquivado', async () => {
    for (const lead of [{ revisado: false }, { revisado: true, arquivado: true }]) {
      const db: any = { prospectMessage: { findFirst: jest.fn().mockResolvedValue({ id: 'm1', leadId: 'l1' }), updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn() }, prospectLead: { findUnique: jest.fn().mockResolvedValue(lead) } };
      const wa: any = { sendMessage: jest.fn() };
      await new ProspectsWorker(db, wa).tick();
      expect(wa.sendMessage).not.toHaveBeenCalled();
      expect(db.prospectMessage.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELADO' }) }));
    }
  });
  it('recusa master de tenant e exige SA booleano', () => {
    const guard = new ProspectSaGuard();
    const ctx = (user: any): any => ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) });
    for (const user of [{ isMaster: true }, {}, { isSuperAdmin: 'true' }]) expect(() => guard.canActivate(ctx(user))).toThrow(ForbiddenException);
    expect(guard.canActivate(ctx({ isSuperAdmin: true }))).toBe(true);
  });
  it('normaliza DDD sem confundir DDD 55 com código do país', () => {
    expect(normalizarTelefone('(55) 99999-1234')).toBe('5555999991234');
    expect(normalizarTelefone('+55 (11) 99999-1234')).toBe('5511999991234');
    expect(normalizarTelefone('123')).toBeNull();
  });
  it('mantém caracteres literais nos nomes personalizados', () => {
    expect(personalizar('Olá {nome}, {empresa}', { nome: '$&', empresa: 'ACME' })).toBe('Olá $&, ACME');
  });
  it('importa planilha, rejeita inválidos e contabiliza duplicados', async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { Nome: 'Maria', Telefone: '(11) 99999-1234' },
      { Nome: 'Maria', Telefone: '5511999991234' },
      { Nome: 'Sem telefone', Telefone: '123' },
    ]), 'Leads');
    const db: any = { prospectLead: { createMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const result = await new ProspectsController(db).importar({ lista: 'Primeira lista', arquivo: XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) });
    expect(result).toMatchObject({ importados: 1, duplicados: 1, invalidos: 1 });
    expect(db.prospectLead.createMany.mock.calls[0][0].data[0].telefone).toBe('5511999991234');
  });
  it('recusa seleção com contato bloqueado antes de enfileirar', async () => {
    const db: any = { prospectLead: { findMany: jest.fn().mockResolvedValue([]) }, prospectMessage: { createMany: jest.fn() } };
    await expect(new ProspectsController(db).enviar({ ids: ['bloqueado'], texto: 'Olá', campanha: 'Teste' })).rejects.toThrow();
    expect(db.prospectMessage.createMany).not.toHaveBeenCalled();
  });
  it('revalida bloqueio quando retira mensagem da fila', async () => {
    const db: any = { prospectMessage: { findFirst: jest.fn().mockResolvedValue({ id: 'm1', leadId: 'l1' }), updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn() }, prospectLead: { findUnique: jest.fn().mockResolvedValue({ bloqueado: true }) } };
    const wa: any = { sendMessage: jest.fn() };
    await new ProspectsWorker(db, wa).tick();
    expect(wa.sendMessage).not.toHaveBeenCalled();
    expect(db.prospectMessage.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELADO' }) }));
  });
  it('registra falha do provedor sem informar envio bem sucedido', async () => {
    const db: any = { prospectMessage: { findFirst: jest.fn().mockResolvedValue({ id: 'm1', leadId: 'l1', texto: 'Olá' }), updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn() }, prospectLead: { findUnique: jest.fn().mockResolvedValue({ telefone: '5511999991234' }) } };
    const wa: any = { sendMessage: jest.fn().mockResolvedValue(false) };
    await new ProspectsWorker(db, wa).tick();
    expect(db.prospectMessage.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'FALHOU', enviadoEm: null }) }));
  });
});
