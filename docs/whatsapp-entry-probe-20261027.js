// Executar apenas na imagem candidata. Todo envio é simulado e os dados são
// criados em uma transação que SEMPRE termina em rollback.
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { Logger } = require('@nestjs/common');
const { CadastroWhatsappService } = require('./dist/modules/cadastro-whatsapp/cadastro-whatsapp.module');
const { WhatsappInicioService } = require('./dist/modules/cadastro-whatsapp/whatsapp-inicio.service');
const { WhatsappInboundService } = require('./dist/modules/agenda/whatsapp-inbound.module');
const { AuthService } = require('./dist/modules/auth/auth.service');
const { consultarNumeroCadastro } = require('./dist/modules/cadastro-whatsapp/whatsapp-entrada');

Logger.overrideLogger(false);
const prisma = new PrismaClient();
const phone = '5511999990001';
const lid = '990000000000001@lid';
const email = `entrada-${Date.now()}@example.invalid`;
const sent = [];
let checked = 0;
const check = (condition, message) => { assert.ok(condition, message); checked++; };
let createdUserId;
const rollback = new Error('ROLLBACK_WHATSAPP_ENTRY_PROBE');

(async () => {
  try {
    await prisma.$transaction(async transaction => {
      const tx = new Proxy(transaction, { get(target, key) {
        if (key === '$transaction') return async action => action(tx);
        const value = Reflect.get(target, key);
        return typeof value === 'function' ? value.bind(target) : value;
      } });
      check((await consultarNumeroCadastro(tx, phone, lid)).tipo === 'novo', 'fixture number already in use');
      check(!await tx.user.findFirst({ where: { cpf: '52998224725' } }), 'fixture CPF already in use');
      const wa = {
        sendMessage: async (...args) => { sent.push(args); return true; },
        sendToJid: async (...args) => { sent.push(args); return true; },
      };
      const inicio = new WhatsappInicioService(tx, wa);
      inicio.entregar = async () => {};
      const cadastro = new CadastroWhatsappService(tx, wa, inicio);
      const auth = new AuthService(tx, null, { get: () => undefined }, { get: () => undefined, set: () => {} }, null, null, null);
      const inbound = new WhatsappInboundService(tx, wa, auth, {}, cadastro, inicio, {},
        { obter: async () => 'PESSOAL', mensagem: () => 'Contexto pessoal' }, {},
        { tratar: async () => ({}) }, { tratar: async () => ({}) });
      const incoming = text => inbound.processarMensagem({ instance: 'probe-sem-envio', data: {
        key: { id: 'msg-probe', remoteJid: lid, remoteJidAlt: `${phone}@s.whatsapp.net`, fromMe: false },
        message: { conversation: text },
      } });
      await incoming('Oi');
      check(sent.at(-1)[1].includes('responda *CADASTRO*'), 'new sender must receive registration guidance');
      check(!sent.at(-1)[1].includes('VINCULAR ABC123'), 'new sender must not be told to link an absent account');
      check(await tx.cadastroWhatsapp.count({ where: { whatsapp: phone } }) === 0, 'greeting must not create a registration');
      await incoming('CADASTRO');
      let state = await cadastro.conversaAberta(phone, lid);
      check(state?.etapa === 'NOME', 'registration must start with name');
      check(sent.at(-1)[1].includes('cadastro no *Orkiestri*'), 'system registration opening');
      check(!JSON.parse(state.respostas).origem, 'general registration must not become an agenda invitation');
      await incoming('CADASTRO');
      check(await tx.cadastroWhatsapp.count({ where: { whatsapp: phone } }) === 1, 'repeated command must not duplicate registration');
      for (const answer of ['Pessoa Verificacao', '52998224725', email, 'Pessoal', '1']) {
        state = await cadastro.conversaAberta(phone, lid);
        check(!!state, 'registration state missing');
        await cadastro.tratarResposta(state, answer, 'probe-sem-envio');
      }
      const user = await tx.user.findFirst({ where: { email }, include: { profile: true, userRoles: { include: { role: true } } } });
      check(!!user, 'general account not created');
      createdUserId = user.id;
      check(!user.isTrial && !user.trialModulo, 'general account must not be restricted to agenda trial');
      check(user.profile.whatsapp === phone && user.profile.whatsappLid === lid.split('@')[0], 'sender identity not preserved');
      check(JSON.parse(user.profile.modulos).includes('financeiro') && JSON.parse(user.profile.modulos).includes('projetos'), 'general account modules missing');
      check(user.userRoles.every(item => item.role.organizationId === user.organizationId), 'roles must belong to new organization');
      check(!await auth.checkGlobalSuperAdmin(user.id, email), 'general signup must not grant global SA');
      const permissions = await auth.resolvePermissions(user.id);
      check(permissions.includes('*') || permissions.includes('agenda:ver'), 'account permissions unavailable');
      check((await consultarNumeroCadastro(tx, phone, lid)).tipo === 'existente', 'account not recognized by phone after signup');
      const count = await tx.cadastroWhatsapp.count({ where: { whatsapp: phone } });
      await incoming('CADASTRO');
      check(sent.at(-1)[1].includes('já tem cadastro'), 'existing sender must not restart signup');
      check(await tx.cadastroWhatsapp.count({ where: { whatsapp: phone } }) === count, 'duplicate registration for existing user');
      check(await tx.user.count({ where: { email } }) === 1, 'duplicate user');
      throw rollback;
    }, { timeout: 60000, maxWait: 10000 });
    throw new Error('Transaction unexpectedly committed');
  } catch (error) {
    if (error !== rollback && error.message !== rollback.message) throw error;
  }
  check(await prisma.user.count({ where: { email } }) === 0, 'probe user persisted');
  check(await prisma.userProfile.count({ where: { whatsapp: phone } }) === 0, 'probe profile persisted');
  check(await prisma.cadastroWhatsapp.count({ where: { whatsapp: phone } }) === 0, 'probe registration persisted');
  if (createdUserId) {
    const rows = await prisma.$queryRaw`SELECT count(*)::int AS count FROM whatsapp_boas_vindas WHERE user_id=${createdUserId}`;
    check(rows[0].count === 0, 'probe welcome queue persisted');
  }
  console.log(JSON.stringify({ checks: checked, database: 'passed', rollback: 'confirmed', real_messages_sent: 0 }));
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
