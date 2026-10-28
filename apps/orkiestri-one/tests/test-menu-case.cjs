const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{PrismaClient}=require('@prisma/client');
const p=new PrismaClient();let org;
async function receive(phone,text){
 const id='MENU-CASE-'+randomUUID();
 const r=await fetch('http://127.0.0.1:3000/api/whatsapp/inbound',{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':process.env.WHATSAPP_INBOUND_SECRET},body:JSON.stringify({instance:'fixture',data:{key:{id,remoteJid:phone+'@s.whatsapp.net',fromMe:false},message:{conversation:text}}})});
 assert.equal(r.status,200);assert.equal((await p.whatsappRecibo.findFirst({where:{instancia:'fixture',mensagemId:id}})).estado,'PROCESSADO');
 const messages=await(await fetch('http://127.0.0.1:18080/test/messages')).json();return messages.at(-1)?.text||'';
}
(async()=>{
assert.equal((await p.$queryRaw`SELECT current_database() AS db`)[0].db,'audit_one_context_20261024');
const full=await p.user.findFirst({where:{nome:'HTTP Fixture 1'},orderBy:{criadoEm:'desc'}});assert.ok(full);
const initial=await p.gasto.count({where:{userId:full.id}});
await receive('5511988880001','menu');assert.match(await receive('5511988880001','0'),/encerra|encerrei/i);
assert.match(await receive('5511988880001','la eele'),/menu|ajuda/i);
assert.match(await receive('5511988880001','teste'),/menu|ajuda/i);
assert.match(await receive('5511988880001','9'),/com qual m[óo]dulo|responder o n[úu]mero/i);
assert.match(await receive('5511988880001','1'),/FINANCEIRO/);
await receive('5511988880001','0');assert.equal(await p.gasto.count({where:{userId:full.id}}),initial);
console.log('PASS screenshot sequence: menu -> 0 -> unknown text -> teste -> 9 reopens menu; 1 selects Finance without creating an expense');
org=await p.organization.create({data:{nome:'Menu financial fixture',slug:randomUUID()}});
const u=await p.user.create({data:{organizationId:org.id,nome:'Menu Finance Fixture',email:randomUUID()+'@example.invalid',senhaHash:'not-a-password',primeiroAcesso:false}});
await p.userProfile.create({data:{userId:u.id,whatsapp:'5511988880999'}});
const permission=await p.permission.upsert({where:{recurso_acao:{recurso:'gastos',acao:'registrar'}},update:{},create:{recurso:'gastos',acao:'registrar',descricao:'Fixture'}});
const role=await p.role.create({data:{organizationId:org.id,nome:'Only expenses',rolePermissions:{create:{permissionId:permission.id}}}});
await p.userRole.create({data:{userId:u.id,roleId:role.id}});
for(const value of ['0','9','1','42','42,50'])await receive('5511988880999',value);
assert.equal(await p.gasto.count({where:{userId:u.id}}),0,'A bare number must never become a financial entry, even for a finance-only account');
await receive('5511988880999','Gasto: Mercado 42 pix');assert.equal(await p.gasto.count({where:{userId:u.id}}),1);
console.log('PASS finance-only permissions: isolated numbers never create expenses; explicit expense command still works');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(org)await p.organization.delete({where:{id:org.id}});await p.$disconnect();});
