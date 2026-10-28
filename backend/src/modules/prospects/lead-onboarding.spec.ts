import * as authHelpers from '../auth/auth.service';
import { CadastroWhatsappService, pareceInteresseEmCadastro } from '../cadastro-whatsapp/cadastro-whatsapp.module';
import { AuthService } from '../auth/auth.service';
import { conviteComOpcoes, dadosTesteAgenda, interesseConviteAgenda, mensagemInicioTesteAgenda, modelosConviteAgenda, ORIGEM_CONVITE_AGENDA, testeAgendaExpirado } from './lead-onboarding';
import { ProspectsWorker } from './prospects.module';
import { JwtStrategy } from '../auth/jwt.strategy';
import { WhatsappInicioService } from '../cadastro-whatsapp/whatsapp-inicio.service';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import * as vm from 'vm';

describe('Convite → cadastro Aurélia → agenda', () => {
  afterEach(() => jest.restoreAllMocks());
  function setup() {
    const cadastro: any = { id: 'cadastro', whatsapp: '5511999991234', status: 'EM_CONVERSA', etapa: 'NOME', respostas: JSON.stringify({ origem: ORIGEM_CONVITE_AGENDA, whatsappLid: '123456789' }), expiraEm: new Date(Date.now() + 1800000), nome: null, cpf: null };
    let criado: any;
    const p: any = {
      cadastroWhatsapp: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue(cadastro), findUnique: jest.fn(async () => ({ ...cadastro })), updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn(async ({ data }) => Object.assign(cadastro, data)) },
      prospectLead: { findUnique: jest.fn().mockResolvedValue({ id: 'lead' }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      organization: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'org-isolada' }) },
      user: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(async ({ data }) => { criado = { ...data, userRoles: [{ role: { isMaster: false, rolePermissions: [] } }], permissionOverrides: [] }; return criado; }), findUnique: jest.fn(async () => criado) },
      role: { findFirst: jest.fn().mockResolvedValue({ id: 'visualizador-isolado', isMaster: false }) },
      userRole: { create: jest.fn().mockResolvedValue({}) },
      userProfile: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      permission: { findMany: jest.fn().mockResolvedValue(['ver', 'criar', 'editar', 'deletar'].map(acao => ({ recurso: 'agenda', acao }))) },
    };
    p.$transaction = jest.fn(async work => work(p));
    const wa: any = { sendMessage: jest.fn().mockResolvedValue(true) };
    const inicio: any = { enfileirar: jest.fn().mockResolvedValue(undefined), entregar: jest.fn().mockResolvedValue(undefined), enviarAcesso: jest.fn().mockResolvedValue(true) };
    jest.spyOn(authHelpers, 'semearPermissoes').mockResolvedValue({} as any);
    jest.spyOn(authHelpers, 'semearPapeisDaOrganizacao').mockResolvedValue({ id: 'master-nao-atribuido' } as any);
    return { cadastro, p, wa, inicio, service: new CadastroWhatsappService(p, wa, inicio) };
  }
  it('oferece cadastro dentro da conversa com 1/2 e sem links no convite', () => {
    const convite = modelosConviteAgenda()[0].texto;
    expect(convite).not.toMatch(/https?:\/\//);
    expect(conviteComOpcoes(convite)).toBe(true);
    expect(conviteComOpcoes('1 — compromisso\n2 — gasto')).toBe(false);
    expect(pareceInteresseEmCadastro('cadastro agenda')).toBe(true);
    expect(interesseConviteAgenda('CADASTRO AGENDA')).toBe(true);
    expect(convite).toContain('Aurélia');
    expect(modelosConviteAgenda()[1].texto).toContain('/recuperar-senha');
  });
  function comConvite() {
    const state = setup();
    state.p.prospectMessage = {
      findFirst: jest.fn().mockResolvedValue({ id: 'msg', leadId: 'lead', lead: { bloqueado: false, arquivado: false } }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    return state;
  }
  it('1 abre o cadastro e a Aurélia já pergunta o nome na mesma conversa', async () => {
    const { service, p, wa } = comConvite();
    expect(await service.tratarConvite('5511999991234', '1', 'teste', '123456789@lid')).toBe(true);
    expect(p.prospectMessage.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'ENVIADO', conviteTelefone: '5511999991234', instancia: 'teste', conviteEstado: 'PENDENTE' } }));
    expect(p.cadastroWhatsapp.create).toHaveBeenCalledTimes(1);
    expect(wa.sendMessage.mock.calls[0][1]).toContain('nome completo');
    expect(p.prospectMessage.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { conviteEstado: 'INICIADO' } }));
  });
  it('2 finaliza o convite sem criar cadastro ou conta', async () => {
    const { service, p, wa } = comConvite();
    expect(await service.tratarConvite('5511999991234', '2', 'teste')).toBe(true);
    expect(p.cadastroWhatsapp.create).not.toHaveBeenCalled(); expect(p.user.create).not.toHaveBeenCalled();
    expect(wa.sendMessage.mock.calls[0][1]).toContain('Finalizei este convite');
    expect(p.prospectMessage.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ conviteEstado: 'FINALIZADO' }) }));
  });
  it('não interpreta 1 sem convite pendente nem toma os menus de uma conta existente', async () => {
    const { service, p } = comConvite();
    p.prospectMessage.findFirst.mockResolvedValue(null);
    expect(await service.tratarConvite('5511999991234', '1', 'outra-instancia')).toBe(false);
    expect(p.cadastroWhatsapp.create).not.toHaveBeenCalled();
    p.userProfile.findFirst.mockResolvedValue({ userId: 'existente' });
    expect(await service.tratarConvite('5511999991234', '1', 'teste')).toBe(false);
    expect(p.cadastroWhatsapp.create).not.toHaveBeenCalled();
  });
  it('não duplica o cadastro se outra execução já assumiu a resposta', async () => {
    const { service, p } = comConvite(); p.prospectMessage.updateMany.mockResolvedValue({ count: 0 });
    expect(await service.tratarConvite('5511999991234', '1', 'teste')).toBe(true);
    expect(p.cadastroWhatsapp.create).not.toHaveBeenCalled();
  });
  it('o envio confirmado registra a espera por resposta na mesma instância', async () => {
    const db: any = { prospectLead: { findUnique: jest.fn().mockResolvedValue({ telefone: '5511999991234', revisado: true }) }, prospectMessage: { findFirst: jest.fn().mockResolvedValue({ id: 'msg', leadId: 'lead', texto: modelosConviteAgenda()[0].texto }), updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn() } };
    const wa: any = { resolveInstance: jest.fn().mockResolvedValue('teste'), sendMessage: jest.fn().mockResolvedValue(true) };
    await new ProspectsWorker(db, wa).tick();
    expect(db.prospectMessage.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ENVIADO', instancia: 'teste', conviteTelefone: '5511999991234', conviteEstado: 'PENDENTE' }) }));
    expect(db.prospectMessage.updateMany).toHaveBeenLastCalledWith({ where: { leadId: 'lead', instancia: 'teste', conviteEstado: 'PENDENTE', id: { not: 'msg' } }, data: { conviteEstado: 'SUPERADO' } });
  });
  it('permite tentar novamente se o cadastro não pôde ser iniciado', async () => {
    const { service, p } = comConvite(); p.cadastroWhatsapp.create.mockRejectedValue(new Error('Banco indisponível'));
    await expect(service.tratarConvite('5511999991234', '1', 'teste')).rejects.toThrow('Banco indisponível');
    expect(p.prospectMessage.updateMany).toHaveBeenLastCalledWith({ where: { id: 'msg', conviteEstado: 'INICIANDO' }, data: { conviteEstado: 'PENDENTE', conviteRespondidoEm: null } });
  });
  it('preserva o convite ao corrigir os dados e conclui em organização própria, sem aprovação manual', async () => {
    const { cadastro, service, p, inicio } = setup();
    const responder = (texto: string) => service.tratarResposta({ ...cadastro }, texto, 'teste');
    await responder('Pessoa Teste'); await responder('52998224725'); await responder('teste@example.invalid'); await responder('Pessoal');
    expect(cadastro.etapa).toBe('CONFIRMACAO');
    await responder('2');
    expect(JSON.parse(cadastro.respostas)).toMatchObject({ origem: ORIGEM_CONVITE_AGENDA, whatsappLid: '123456789' });
    await responder('Pessoa Teste'); await responder('52998224725'); await responder('teste@example.invalid'); await responder('Pessoal'); await responder('1');
    const user = p.user.create.mock.calls[0][0].data;
    expect(user).toMatchObject({ organizationId: 'org-isolada', isTrial: true, trialModulo: 'one-space', primeiroAcesso: false });
    expect(user.trialExpiraEm.getTime() - Date.now()).toBeGreaterThan(6.99 * 86400000);
    expect(p.userRole.create).toHaveBeenCalledWith({ data: { userId: user.id, roleId: 'visualizador-isolado' } });
    expect(p.userProfile.create.mock.calls[0][0].data).toMatchObject({ userId: user.id, whatsapp: cadastro.whatsapp, whatsappLid: '123456789', modulos: '["agenda"]' });
    expect(p.prospectLead.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { etapa: 'EM_TESTE' } }));
    expect(cadastro.status).toBe('CONCLUIDO');
    expect(inicio.enfileirar).toHaveBeenCalled(); expect(inicio.entregar).toHaveBeenCalledWith(user.id);
    const cache: any = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };
    const auth = new AuthService(p, null, null, cache, null, null, null);
    expect(await auth.resolvePermissions(user.id)).toEqual(expect.arrayContaining(['agenda:ver', 'agenda:criar']));
    expect(await auth.resolvePermissions(user.id)).not.toContain('*');
  });
  it('identifica o convite pelo texto e inicia conversa de teste', async () => {
    const { service, p, wa } = setup(); p.prospectLead.findUnique.mockResolvedValue(null);
    await service.iniciarPeloChat('5511999991234', 'teste', 'CADASTRO AGENDA', '123456789@lid');
    expect(JSON.parse(p.cadastroWhatsapp.create.mock.calls[0][0].data.respostas)).toMatchObject({ origem: ORIGEM_CONVITE_AGENDA, whatsappLid: '123456789' });
    expect(wa.sendMessage.mock.calls[0][1]).toContain('7 dias grátis');
  });
  it('não recria nem renova uma conta já existente', async () => {
    const { service, p, inicio } = setup(); p.userProfile.findFirst.mockResolvedValue({ userId: 'existente' });
    await service.iniciarPeloChat('5511999991234', 'teste', 'CADASTRO AGENDA');
    expect(p.cadastroWhatsapp.create).not.toHaveBeenCalled(); expect(inicio.enviarAcesso).toHaveBeenCalledWith('existente', 'teste');
  });
  it('entrega instruções completas, e não informa teste ativo depois do vencimento', () => {
    const user = { nome: 'Pessoa Teste', email: 'teste@example.invalid', ...dadosTesteAgenda() };
    const texto = mensagemInicioTesteAgenda(user)!;
    for (const parte of ['Aurélia', 'começar', 'compromissos', '/recuperar-senha', '/login', 'WhatsApp']) expect(texto).toContain(parte);
    expect(mensagemInicioTesteAgenda({ ...user, trialExpiraEm: new Date(0) })).toContain('terminou');
    expect(testeAgendaExpirado({ ...user, assinaturaEm: new Date(), trialExpiraEm: new Date(0) })).toBe(false);
  });
  it('sessão existente não abre API de agenda após vencer o teste', async () => {
    const p: any = { user: { findUnique: jest.fn().mockResolvedValue({ ativo: true, bloqueado: false, ...dadosTesteAgenda(new Date(0)) }) } };
    const auth: any = { isTokenBlacklisted: jest.fn().mockResolvedValue(false), resolvePermissions: jest.fn() };
    const config: any = { get: () => 'segredo-de-teste' };
    await expect(new JwtStrategy(config, p, auth).validate({ sub: 'user', email: 'teste@example.invalid' })).rejects.toThrow('teste de 7 dias da agenda terminou');
    expect(auth.resolvePermissions).not.toHaveBeenCalled();
  });
  it('Aurélia conduz o primeiro compromisso e só executa depois da confirmação', async () => {
    let state: any = null;
    const tx: any = {
      $queryRaw: jest.fn(async () => state ? [state] : []),
      $executeRaw: jest.fn(async (sql, ...values) => {
        const query = sql.join('');
        if (query.includes('INSERT INTO whatsapp_inicio')) state = { etapa: values[3], dados: JSON.parse(values[4]) };
        if (query.includes('DELETE FROM whatsapp_inicio')) state = null;
        return 1;
      }),
    };
    const p: any = { $transaction: async work => work(tx) };
    const wa: any = { sendMessage: jest.fn().mockResolvedValue(true) };
    const service = new WhatsappInicioService(p, wa);
    const user = { id: 'convidado', organizationId: 'org-isolada', nome: 'Pessoa Teste', telefone: '5511999991234' };
    const preparar = jest.fn((tipo, dados) => ({ tipo, resumo: 'Compromisso para confirmar', registro: { titulo: dados.titulo } }));
    const executar = jest.fn().mockResolvedValue(undefined);
    const responder = (texto: string) => service.fluxo(user, 'conversa', 'teste', texto, ['agenda:ver', 'agenda:criar'], preparar, executar);
    for (const texto of ['começar', '1', 'Dentista', 'amanhã 14h']) await responder(texto);
    expect(executar).not.toHaveBeenCalled();
    expect(wa.sendMessage.mock.calls.at(-1)[1]).toContain('confirmar');
    await responder('1');
    expect(executar).toHaveBeenCalledTimes(1);
    expect(executar).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'evento', registro: { titulo: 'Dentista' } }));
    expect(state).toBeNull();
  });
  it('abre a agenda no primeiro login mesmo com atalhos de WhatsApp no menu', () => {
    const filename = path.resolve(__dirname, '../../../../frontend/src/lib/modules.tsx');
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
    const exports: any = {};
    vm.runInNewContext(code, { exports, require: () => new Proxy({}, { get: () => () => null }) });
    expect(exports.homeRoute({ isMaster: false, isSuperAdmin: false, permissions: ['agenda:ver', 'agenda:criar', 'agenda:editar'] })).toBe('/dashboard/agenda');
    expect(exports.homeRoute({ isSuperAdmin: true, permissions: ['*'] })).toBe('/dashboard');
  });
});
