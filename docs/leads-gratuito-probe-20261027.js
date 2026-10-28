const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { Logger } = require('@nestjs/common');
const { CadastroWhatsappService } = require('./dist/modules/cadastro-whatsapp/cadastro-whatsapp.module');
const { WhatsappInicioService } = require('./dist/modules/cadastro-whatsapp/whatsapp-inicio.service');
const { AuthService } = require('./dist/modules/auth/auth.service');
const { modelosConviteAgenda, conviteComOpcoes, dadosTesteAgenda, testeAgendaExpirado, ORIGEM_CONVITE_GRATUITO } = require('./dist/modules/prospects/lead-onboarding');
const { acessoVencido, faseDaConta } = require('./dist/modules/auth/trial-renovacao');
Logger.overrideLogger(false);
const db = new PrismaClient();
const phone = '5511999990001', email = `gratis-${Date.now()}@example.invalid`;
const rollback = new Error('ROLLBACK_GRATUITO_PROBE');
let checks = 0;
const check = (value, msg) => { assert.ok(value, msg); checks++; };
(async () => {
  const select = { id: true, isTrial: true, trialExpiraEm: true, assinaturaEm: true, assinaturaValidaAte: true };
  const antigos = await db.user.findMany({ select, orderBy: { id: 'asc' } });
  try {
    await db.$transaction(async transaction => {
      const tx = new Proxy(transaction, { get(target,key) {
        if (key === '$transaction') return async fn => fn(tx);
        const value = Reflect.get(target,key); return typeof value === 'function' ? value.bind(target) : value;
      }});
      check(!await tx.prospectLead.findUnique({ where: { telefone: phone } }), 'fixture lead already exists');
      check(!await tx.user.findFirst({ where: { cpf: '52998224725' } }), 'fixture CPF already exists');
      const modelo = modelosConviteAgenda()[0];
      check(!/7 dias|sete dias/.test(modelo.texto), 'invitation still has a deadline');
      check(modelo.texto.includes('gratuitos, sem cartão'), 'free-phase terms missing');
      check(conviteComOpcoes(modelo.texto), 'interactive invitation not recognized');
      const lead = await tx.prospectLead.create({ data: { nome: 'Pessoa Verificação', telefone: phone, lista: 'probe', revisado: true } });
      const convite = await tx.prospectMessage.create({ data: { leadId: lead.id, campanha: modelo.nome, texto: modelo.texto, status: 'ENVIADO', instancia: 'probe', conviteTelefone: phone, conviteEstado: 'PENDENTE' } });
      const sent = [];
      const wa = { sendMessage: async (...args) => { sent.push(args); return true; }, sendToJid: async (...args) => { sent.push(args); return true; } };
      const inicio = new WhatsappInicioService(tx,wa); inicio.entregar = async () => {};
      const cadastro = new CadastroWhatsappService(tx,wa,inicio);
      check(await cadastro.tratarConvite(phone,'1','probe','990000000000001@lid'), 'option 1 not handled');
      let form = await cadastro.conversaAberta(phone,'990000000000001@lid');
      check(form.etapa === 'NOME', 'name question missing');
      check(JSON.parse(form.respostas).origem === ORIGEM_CONVITE_GRATUITO, 'wrong signup origin');
      check(!/7 dias|sete dias/.test(sent.at(-1)[1]), 'opening still has seven days');
      check((await tx.prospectMessage.findUnique({ where: { id: convite.id } })).conviteEstado === 'INICIADO', 'invitation not claimed');
      for (const answer of ['Pessoa Verificação','52998224725',email,'Pessoal','1']) {
        form = await cadastro.conversaAberta(phone,'990000000000001@lid');
        await cadastro.tratarResposta(form,answer,'probe');
      }
      const user = await tx.user.findFirst({ where: { email }, include: { profile: true, userRoles: { include: { role: true } } } });
      check(!!user, 'account not created');
      check(user.trialExpiraEm === null, 'new account has an automatic expiry');
      check(user.assinaturaEm === null && user.assinaturaValidaAte === null, 'signup created a subscription');
      check(!acessoVencido(user,new Date('2030-01-01T00:00:00Z')), 'new free account would auto-expire');
      check(faseDaConta(user) === null, 'new free account entered automatic renewal cycle');
      check(JSON.parse(user.profile.modulos).includes('projetos'), 'registration restricted to agenda');
      check(user.userRoles.every(r => r.role.organizationId === user.organizationId), 'cross-organization role');
      const auth = new AuthService(tx,null,{ get: () => undefined },{ get: () => undefined, set: () => {} },null,null,null);
      check(!await auth.checkGlobalSuperAdmin(user.id,email), 'signup granted global SA');
      check((await tx.prospectLead.findUnique({ where: { id: lead.id } })).etapa === 'EM_TESTE', 'lead stage missing');
      const novoAgenda = dadosTesteAgenda();
      check(novoAgenda.trialExpiraEm === null, 'legacy command still creates an expiry');
      check(testeAgendaExpirado({ isTrial:true,trialModulo:'one-space',trialExpiraEm:new Date(0),assinaturaEm:null }), 'existing expiry no longer enforced');
      throw rollback;
    }, { timeout: 60000 });
    throw new Error('transaction committed');
  } catch (error) { if (error.message !== rollback.message) throw error; }
  check(await db.user.count({ where: { email } }) === 0, 'fixture account persisted');
  check(await db.prospectLead.count({ where: { telefone: phone } }) === 0, 'fixture lead persisted');
  const depois = await db.user.findMany({ where: { id: { in: antigos.map(u => u.id) } }, select, orderBy: { id: 'asc' } });
  check(JSON.stringify(antigos) === JSON.stringify(depois), 'existing account conditions changed');
  console.log(JSON.stringify({ checks, database:'passed', rollback:'confirmed', existing_accounts:'unchanged', real_messages_sent:0 }));
})().catch(error => { console.error(error.message); process.exitCode=1; }).finally(()=>db.$disconnect());
