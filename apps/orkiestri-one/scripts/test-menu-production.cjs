const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{PrismaClient}=require('@prisma/client');
const {WhatsAppService}=require('/app/dist/modules/notifications/whatsapp.service'),{ConfigService}=require('@nestjs/config');
const p=new PrismaClient(),userId=process.env.TEST_USER_ID,phone=process.env.TEST_PHONE,ids=[];
(async()=>{
const user=await p.user.findUnique({where:{id:userId},include:{profile:true}});assert.ok(user?.ativo&&!user.bloqueado);
const actual=user.profile.whatsapp.replace(/\D/g,'');assert.equal(actual.startsWith('55')?actual:'55'+actual,phone);
assert.equal(await p.whatsappInicio.count({where:{userId,expiraEm:{gt:new Date()}}}),0);assert.equal(await p.whatsappPrevia.count({where:{userId,expiraEm:{gt:new Date()}}}),0);
const expenses=await p.gasto.count({where:{userId}});
for(const text of ['menu','0','teste','42','9']){
 const id='AUDIT-MENU-20261025-'+randomUUID();ids.push(id);
 const response=await fetch('http://127.0.0.1:3000/api/whatsapp/inbound',{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':process.env.WHATSAPP_INBOUND_SECRET},body:JSON.stringify({instance:'orkestri-default',data:{key:{id,remoteJid:phone+'@s.whatsapp.net',fromMe:false},message:{conversation:text}}})});
 assert.equal(response.status,200);assert.equal((await p.whatsappRecibo.findFirst({where:{instancia:'orkestri-default',mensagemId:id}})).estado,'PROCESSADO');
}
assert.equal(await p.gasto.count({where:{userId}}),expenses);
const wa=new WhatsAppService(new ConfigService(process.env),p);assert.equal(await wa.sendMessage(phone,'✅ Correção aplicada: depois de encerrar com 0, envie 9 para reabrir o menu. Números soltos não viram gastos.', 'orkestri-default'),true);
console.log('PASS production: menu -> 0 -> teste -> isolated number -> 9 processed without financial writes; real test notification accepted by shared provider.');
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(async()=>{await p.whatsappAtividade.deleteMany({where:{userId,instancia:'orkestri-default',mensagemId:{in:ids}}});await p.$disconnect();});
