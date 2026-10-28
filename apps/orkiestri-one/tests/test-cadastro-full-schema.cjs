const assert = require('node:assert/strict');
const Module = require('node:module');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const database = 'audit_whatsapp_20261024_cadastro';
const url = new URL(process.env.DATABASE_URL);
url.pathname = '/' + database;
const p = new PrismaClient({ datasources: { db: { url: url.toString() } } });
function load(code, filename, overrides = {}) {
  const m = new Module(filename, module); m.filename = filename;
  m.paths = Module._nodeModulePaths(require('path').dirname(filename));
  const normalRequire = m.require.bind(m);
  m.require = name => overrides[name] || normalRequire(name);
  m._compile(Buffer.from(code, 'base64').toString('utf8'), filename);
  return m.exports;
}
const atomic = load(ATOMIC_CODE, '/app/dist/modules/cadastro-whatsapp/audit-atomic.js');
const { CadastroWhatsappService } = load(CADASTRO_CODE, '/app/dist/modules/cadastro-whatsapp/audit.js', { './cadastro-atomico': atomic });
const sent = [];
const wa = { sendMessage: async (_phone, message) => { sent.push(message); return true; } };
async function novo(index) {
  return p.cadastroWhatsapp.create({ data: { id: randomUUID(), nome: 'Teste Isolado', cpf: String(index).padStart(11,'0'),
    whatsapp: '5500000000000', status: 'EM_CONVERSA', etapa: 'CONFIRMACAO', expiraEm: new Date(Date.now()+600000),
    respostas: JSON.stringify({ email: `teste-${index}@example.invalid`, empresa: `Teste Isolado ${index}` }) } });
}
(async () => {
  assert.equal((await p.$queryRawUnsafe('SELECT current_database() AS db'))[0].db, database);
  const c = await novo(1);
  const broken = { $transaction: (fn, options) => p.$transaction(tx => fn(new Proxy(tx, { get: (target, prop) => {
    if (prop === 'userProfile') return { create: async () => { throw new Error('Falha injetada após permissões reais'); } };
    return Reflect.get(target, prop);
  } })), options) };
  await new CadastroWhatsappService(broken, wa).concluir(c, {}, 'isolated');
  for (const model of ['organization','user','role','permission','rolePermission','userRole','userProfile']) assert.equal(await p[model].count(),0,model+' deve sofrer rollback');
  assert.equal((await p.cadastroWhatsapp.findUnique({where:{id:c.id}})).status,'EM_CONVERSA');
  assert.ok(sent.at(-1).includes('tentar novamente'));
  console.log('PASS rollback completo com catálogo real de permissões');
  const svc = new CadastroWhatsappService(p, wa);
  const started = Date.now();
  await Promise.all(Array.from({length:4},()=>svc.concluir(c, {}, 'isolated')));
  const record = await p.cadastroWhatsapp.findUnique({where:{id:c.id}});
  assert.equal(record.status,'CONCLUIDO');
  assert.equal(await p.organization.count(),1); assert.equal(await p.user.count(),1); assert.equal(await p.userProfile.count(),1);
  assert.equal(await p.userRole.count(),1); assert.ok(await p.permission.count()>0);
  const master = await p.userRole.findFirst({where:{userId:record.userId},include:{role:true}});
  assert.equal(master.role.isMaster,true); assert.equal(master.role.organizationId,record.organizationId);
  assert.equal(sent.filter(x=>x.includes('Senha provisória')).length,1);
  console.log('PASS confirmação concorrente, uma conta e papel master na própria organização; duração total ms:',Date.now()-started);
  const initialUsers=await p.user.count();
  await svc.concluir(c, {}, 'isolated'); assert.equal(await p.user.count(),initialUsers);
  console.log('PASS repetição posterior sem criar conta ou senha nova');
  console.log('RESULTADO: schema e helpers reais; banco isolado; transporte WhatsApp simulado.');
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>p.$disconnect());
