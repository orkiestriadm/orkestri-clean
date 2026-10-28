const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{PrismaClient}=require('@prisma/client');
const {WhatsappOperacaoController}=require('/app/dist/modules/agenda/whatsapp-operacao.controller');
const p=new PrismaClient();let org;
(async()=>{
assert.equal((await p.$queryRaw`SELECT current_database() AS db`)[0].db,'audit_one_context_20261024');
org=await p.organization.create({data:{nome:'COHORT fixture',slug:randomUUID()}});
const users=[];
for(const days of [21,20,5]){
 const u=await p.user.create({data:{organizationId:org.id,nome:'COHORT fixture '+days,email:randomUUID()+'@example.invalid',senhaHash:'not-a-password'}});users.push(u);
 await p.$executeRaw`INSERT INTO whatsapp_atividade(instancia,mensagem_id,user_id,organization_id,contexto,tipo,criado_em)
 VALUES ('cohort-fixture',${randomUUID()},${u.id},${org.id},'EMPRESA','CADASTRO',CURRENT_TIMESTAMP-${days}*INTERVAL '1 day')`;
}
await p.$executeRaw`INSERT INTO whatsapp_atividade(instancia,mensagem_id,user_id,organization_id,contexto,tipo,acao_util,criado_em)
 VALUES ('cohort-fixture',${randomUUID()},${users[0].id},${org.id},'EMPRESA','MENSAGEM','COMPROMISSO_CRIADO',CURRENT_TIMESTAMP-INTERVAL '12 days')`;
const op=new WhatsappOperacaoController(p,{}),req={user:{id:users[0].id,organizationId:org.id,isMaster:true}};
const result=await op.metricas(req);
assert.equal(result.cadastros,3);assert.equal(result.acoes_uteis,1);assert.equal(result.usuarios_ativados,1);
assert.equal(result.coortes.reduce((n,c)=>n+c.elegiveis_retorno,0),2);assert.equal(result.coortes.reduce((n,c)=>n+c.retornaram_semana_1,0),1);
assert.notEqual((await op.metricas(req,'plataforma')).escopo,'Plataforma');
console.log('PASS real PostgreSQL cohort calculation: 3 registrations, 1 activation, 2 complete windows, 1 return; platform scope cannot be requested by an organization administrator');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(org)await p.organization.delete({where:{id:org.id}});await p.$disconnect();});
