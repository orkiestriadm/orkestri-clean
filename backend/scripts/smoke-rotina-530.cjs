// Executar no container da API via stdin. Todas as escritas são revertidas.
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { RotinaPessoalService } = require('./dist/modules/agenda/rotina-pessoal.service');
const { AureliaAprendizadoService } = require('./dist/modules/agenda/aurelia-aprendizado.service');
const { diaSaoPaulo } = require('./dist/modules/agenda/whatsapp-rotina-datas');
const prisma = new PrismaClient();
const rollback = new Error('ROLLBACK_SMOKE');
(async()=>{
 const u=await prisma.user.findFirst({where:{email:'aurelia.teste@example.com'},select:{id:true,organizationId:true}});
 if(!u) throw Error('Conta fictícia de teste não encontrada; nenhuma alteração feita.');
 const s={userId:u.id,organizationId:u.organizationId};
 try { await prisma.$transaction(async tx=>{
   const db=new Proxy(tx,{get(t,p){if(p==='$transaction')return async fn=>typeof fn==='function'?fn(db):Promise.all(fn);return t[p];}});
   const wa={sendToJid:async()=>true,sendMessage:async()=>{throw Error('Envio real proibido neste smoke');}};
   const svc=new RotinaPessoalService(db,wa,{resolvePermissions:async()=>['*']});
   const learning=new AureliaAprendizadoService(db);
   const h=await svc.salvarHabito(u,{titulo:'SMOKE 5.3 '+Date.now(),dias:30,cor:'#f97316'});
   const first=await svc.checkin(u,h.id),second=await svc.checkin(u,h.id);
   assert.equal(first.total,1);assert.equal(second.total,1);assert.equal(second.repetido,true);
   await assert.rejects(()=>svc.checkin({...u,id:'outra-conta'},h.id));
   await svc.checkin(u,h.id,true);
   assert.equal(await tx.habitCheckin.count({where:{habitId:h.id}}),0);
   const r=await svc.criarLembrete(u,'Me lembre de teste controlado daqui 15m','smoke','smoke-'+Date.now());
   assert.equal(r.status,'PENDENTE');assert.equal(r.titulo,'teste controlado');
   await svc.cancelar(u,r.id);
   assert.equal((await tx.personalReminder.findUnique({where:{id:r.id}})).status,'CANCELADO');
   await learning.configurar(s,true,'08:30');
   const entrada='Marque consulta de teste amanhã às 15h';
   const resposta=JSON.stringify({acao:'criar',titulo:'consulta de teste',dia:'amanhã',hora:'15h',duracao:''});
   await learning.registrarPendente({...s,entrada,resposta});
   const e=await tx.aureliaLearningExample.findFirst({where:{...s,entrada:'Marque compromisso amanhã às 15h'}});
   assert.ok(e);await learning.revisar(s,e.id,'APROVADO');
   assert.ok((await learning.exemplosPara(s,'Marque amanhã às 15h')).length);
   assert.equal((await learning.exemplosPara({...s,userId:'outra-conta'},'Marque amanhã')).length,0);
   await learning.configurar(s,false);
   assert.equal((await learning.exemplosPara(s,'Marque amanhã')).length,0);
   console.log('SMOKE_OK: hábito, duplicidade, isolamento, desfazer, lembrete, cancelamento, coleta, revisão, consulta e desligamento. Dia '+diaSaoPaulo(new Date()));
   throw rollback;
 },{timeout:30000}); } catch(e){if(e!==rollback)throw e;}
 console.log('ROLLBACK_OK: nenhum registro de teste persistido; nenhum WhatsApp enviado.');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
