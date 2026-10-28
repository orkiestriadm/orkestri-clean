// Executar a partir de /app, por stdin: node < este-arquivo.js.
// Todos os envios são simulados; a transação é sempre desfeita.
require('reflect-metadata');
const { PrismaClient } = require('@prisma/client');
const { JwtService } = require('@nestjs/jwt');
const { Reflector } = require('@nestjs/core');
const { randomInt, randomBytes } = require('crypto');
const { AuthService } = require('./dist/modules/auth/auth.service');
const { JwtStrategy } = require('./dist/modules/auth/jwt.strategy');
const { PermissionsGuard } = require('./dist/modules/auth/permissions.guard');
const { CadastroWhatsappService } = require('./dist/modules/cadastro-whatsapp/cadastro-whatsapp.module');
const { WhatsappInicioService } = require('./dist/modules/cadastro-whatsapp/whatsapp-inicio.service');
const { WhatsappInboundService } = require('./dist/modules/agenda/whatsapp-inbound.module');
const { AgendaModule } = require('./dist/modules/agenda/agenda.module');
const { modelosConviteAgenda, conviteComOpcoes } = require('./dist/modules/prospects/lead-onboarding');
const p = new PrismaClient();
const marker = 'ROLLBACK_VALIDACAO_CONVITE';
const suffix = Date.now().toString();
const email = 'teste-convite-' + suffix + '@example.invalid';
const telefone = '55119' + suffix.slice(-8);
const lid = '999' + suffix + '@lid';
let userId, organizationId, otp, rollback = false;
const results = {};
function check(name, value) { if (!value) throw new Error('Falhou: ' + name); results[name] = true; }
function cpfTeste() {
  const d = Array.from({ length: 9 }, () => randomInt(10));
  for (const n of [9, 10]) { const r = d.reduce((sum, v, i) => sum + v * (n + 1 - i), 0) * 10 % 11; d.push(r === 10 ? 0 : r); }
  return d.join('');
}
(async () => {
  check('telefone_temporario_livre', !await p.userProfile.findFirst({ where: { whatsapp: telefone } }) && !await p.prospectLead.findUnique({ where: { telefone } }));
  try {
    await p.$transaction(async tx => {
      let db;
      db = new Proxy(tx, { get(target, key) { if (key === '$transaction') return async work => work(db); const v = Reflect.get(target, key); return typeof v === 'function' ? v.bind(target) : v; } });
      const sent = [];
      const wa = {
        sendMessage: async (_n, text) => { sent.push(text); return true; },
        sendToJid: async (_n, text) => { sent.push(text); return true; },
        resolveInstance: async () => 'orkestri-default',
        sendOtpForOrg: async (_org, _n, code) => { otp = code; return true; },
      };
      const map = new Map();
      const cache = { get: async k => map.get(k) ?? null, set: async (k, v) => { map.set(k, v); }, del: async (...keys) => keys.forEach(k => map.delete(k)), delPattern: async () => { map.clear(); } };
      const config = { get: (k, fallback) => process.env[k] || fallback };
      const auth = new AuthService(db, new JwtService(), config, cache, wa, { sendPasswordResetLink: async () => true }, {});
      const inicio = new WhatsappInicioService(db, wa);
      inicio.entregar = async () => {}; // A fila permanece na transação; não há entrega externa.
      const cadastroService = new CadastroWhatsappService(db, wa, inicio);
      const inbound = new WhatsappInboundService(db, wa, auth, {}, cadastroService, inicio, {}, { obter: async () => 'PESSOAL' }, {}, { tratar: async () => ({ consumido: false }) }, { tratar: async () => ({ consumido: false }) });
      let mensagemId = 0;
      const receber = (texto, remoteJid = lid, numero = telefone) => inbound.processarMensagem({ instance: 'orkestri-default', data: { key: { id: 'teste-opcao-' + suffix + '-' + (++mensagemId), remoteJid, remoteJidAlt: numero + '@s.whatsapp.net', fromMe: false }, message: { conversation: texto } } });
      const mensagemConvite = modelosConviteAgenda()[0].texto;
      check('convite_sem_link_com_opcoes', !/https?:\/\//.test(mensagemConvite) && conviteComOpcoes(mensagemConvite));
      const leadTeste = await db.prospectLead.create({ data: { nome: 'Validação de convite', telefone, lista: 'Validação temporária' } });
      // Simula somente o registro de envio; nenhuma mensagem sai do processo.
      await db.prospectMessage.create({ data: { leadId: leadTeste.id, campanha: 'Validação de convite numérico', texto: mensagemConvite, status: 'ENVIADO', enviadoEm: new Date(), instancia: 'orkestri-default', conviteTelefone: telefone, conviteEstado: 'PENDENTE' } });
      check('outra_instancia_nao_assume_convite', !await cadastroService.tratarConvite(telefone, '1', 'outra-instancia', lid));
      await receber('1');
      check('resposta_1_inicia_cadastro', (await cadastroService.conversaAberta(telefone, lid))?.etapa === 'NOME');
      check('primeira_pergunta_na_conversa', sent.some(t => t.includes('nome completo')));
      check('convite_assumido', (await db.prospectMessage.findFirst({ where: { leadId: leadTeste.id } })).conviteEstado === 'INICIADO');
      let cpf;
      do { cpf = cpfTeste(); } while (await db.user.findFirst({ where: { cpf } }));
      for (const answer of ['Pessoa Convidada Teste', cpf, email, 'Pessoal', '1']) {
        const state = await cadastroService.conversaAberta(telefone, lid);
        check('cadastro_aberto_ate_confirmar', !!state);
        await receber(answer);
      }
      const user = await db.user.findFirst({ where: { email }, include: { profile: true, userRoles: { include: { role: true } } } });
      check('conta_criada', !!user);
      userId = user.id; organizationId = user.organizationId;
      check('organizacao_propria', organizationId !== '00000000-0000-0000-0000-000000000001');
      check('teste_7_dias', user.isTrial && user.trialModulo === 'one-space' && user.trialExpiraEm.getTime() - Date.now() > 6.99 * 86400000);
      check('sem_master', !user.userRoles.some(x => x.role.isMaster));
      check('whatsapp_vinculado', user.profile.whatsapp === telefone && user.profile.whatsappLid === lid.split('@')[0]);
      const lead = await db.prospectLead.findUnique({ where: { telefone } });
      check('lead_em_teste', lead.etapa === 'EM_TESTE');
      const telefone2 = '55119' + String(Date.now() + 137).slice(-8);
      check('segundo_telefone_livre', !await db.userProfile.findFirst({ where: { whatsapp: telefone2 } }) && !await db.prospectLead.findUnique({ where: { telefone: telefone2 } }));
      const lead2 = await db.prospectLead.create({ data: { nome: 'Validação de finalizar', telefone: telefone2, lista: 'Validação temporária' } });
      const msg2 = await db.prospectMessage.create({ data: { leadId: lead2.id, campanha: 'Validação de finalizar', texto: mensagemConvite, status: 'ENVIADO', enviadoEm: new Date(), instancia: 'orkestri-default', conviteTelefone: telefone2, conviteEstado: 'PENDENTE' } });
      await receber('2', telefone2 + '@s.whatsapp.net', telefone2);
      check('resposta_2_finaliza', sent.some(t => t.includes('Finalizei este convite')));
      check('opcao_2_sem_cadastro', await db.cadastroWhatsapp.count({ where: { whatsapp: telefone2 } }) === 0 && !await db.userProfile.findFirst({ where: { whatsapp: telefone2 } }));
      check('convite_finalizado', (await db.prospectMessage.findUnique({ where: { id: msg2.id } })).conviteEstado === 'FINALIZADO');
      check('sem_reabertura_apos_2', !await cadastroService.tratarConvite(telefone2, '1', 'orkestri-default'));
      await inicio.enviarAcesso(userId, 'orkestri-default');
      check('orientacoes_completas', sent.some(t => t.includes('/recuperar-senha') && t.includes('começar') && t.includes('Aurélia')));
      await auth.sendPasswordOtp(telefone);
      check('codigo_simulado', !!otp);
      const reset = await auth.verifyPasswordOtp(telefone, otp);
      check('codigo_confirmado', !!reset.resetToken);
      const senha = 'Aa9!' + randomBytes(15).toString('hex');
      await auth.resetPasswordWithToken(reset.resetToken, senha);
      const login = await auth.login(email, senha);
      check('login_com_senha_propria', !!login.accessToken && login.user.id === userId && !login.user.primeiroAcesso);
      check('somente_agenda', !login.user.isMaster && !login.user.isSuperAdmin && login.user.permissions.includes('agenda:criar') && login.user.permissions.every(v => v.startsWith('agenda:')));
      const jwt = new JwtStrategy(config, db, auth);
      const reqUser = await jwt.validate({ sub: userId, email });
      for (const answer of ['começar', '1', 'Dentista de validação', 'amanhã 14h']) await inbound.tratarInicio(lid, 'orkestri-default', answer);
      check('confirmacao_obrigatoria', await db.event.count({ where: { userId } }) === 0);
      await inbound.tratarInicio(lid, 'orkestri-default', '1');
      check('primeiro_compromisso_aurelia', await db.event.count({ where: { userId, organizationId, titulo: 'Dentista de validação' } }) === 1);
      const Controller = Reflect.getMetadata('controllers', AgendaModule).find(c => c.name === 'AgendaController');
      const controller = new Controller(db, { onEventCreated: async () => {} });
      await controller.create({ titulo: 'Compromisso pelo site', inicio: new Date(Date.now() + 3600000).toISOString() }, { user: reqUser });
      const events = await controller.findAll({ user: reqUser }, new Date(Date.now() - 86400000).toISOString(), new Date(Date.now() + 3 * 86400000).toISOString());
      check('agenda_site_mostra_eventos', events.length === 2 && events.every(e => e.userId === userId && e.organizationId === organizationId));
      const finance = () => {};
      Reflect.defineMetadata('permissions', ['financeiro:ver'], finance);
      const guard = new PermissionsGuard(new Reflector());
      check('sem_acesso_financeiro', !guard.canActivate({ getHandler: () => finance, getClass: () => Controller, switchToHttp: () => ({ getRequest: () => ({ user: reqUser }) }) }));
      await db.user.update({ where: { id: userId }, data: { trialExpiraEm: new Date(Date.now() - 1000) } });
      await cache.del('cache:permissions:' + userId);
      check('whatsapp_sem_permissao_apos_expirar', (await auth.resolvePermissions(userId)).length === 0);
      let denied = false; try { await jwt.validate({ sub: userId, email }); } catch (e) { denied = e.status === 401; }
      check('sessao_recusada_apos_expirar', denied);
      throw new Error(marker);
    }, { timeout: 120000, maxWait: 10000 });
  } catch (e) { if (e.message !== marker) throw e; rollback = true; }
  check('rollback_executado', rollback);
  check('nenhuma_conta_persistida', await p.user.count({ where: { email } }) === 0);
  check('nenhuma_organizacao_persistida', await p.organization.count({ where: { id: organizationId } }) === 0);
  check('nenhum_lead_persistido', await p.prospectLead.count({ where: { telefone } }) === 0);
  check('nenhum_evento_persistido', await p.event.count({ where: { userId } }) === 0);
  console.log(JSON.stringify({ resultado: 'OK', verificacoes: results, enviosReais: 0 }));
})().catch(e => { console.error('Validação falhou: ' + e.message); process.exitCode = 1; }).finally(() => p.$disconnect());
