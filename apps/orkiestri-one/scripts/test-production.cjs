const assert=require('node:assert/strict'),{randomUUID,createHash}=require('node:crypto'),{PrismaClient}=require('@prisma/client'),{JwtService}=require('@nestjs/jwt'),PDFDocument=require('pdfkit');
const {WhatsAppService}=require('/app/dist/modules/notifications/whatsapp.service');
const {ConfigService}=require('@nestjs/config');
const fs=require('node:fs/promises'),voiceFixture='/tmp/orkiestri-one-audio-fixture.wav';
const {tokenMedia}=require('/app/dist/modules/agenda/whatsapp-media.service');
const p=new PrismaClient(),ids=[],instance='orkestri-default',userId=process.env.TEST_USER_ID,phone=process.env.TEST_PHONE;
const prefix='AUDIT-ONE-20261025-',title='TESTE TECNICO ORKIESTRI '+randomUUID();
let createdEvent,createdFile,user;
function normalized(s){const n=String(s||'').replace(/\D/g,'');return n.startsWith('55')?n:'55'+n;}
async function request(route,method='GET',body,auth=true){
 const token=auth?new JwtService().sign({sub:user.id},{secret:process.env.JWT_SECRET,expiresIn:'5m'}):null;
 const csrf='audit-one-'+randomUUID();
 const r=await fetch('http://127.0.0.1:3000/api'+route,{method,headers:{'Content-Type':'application/json',Cookie:'csrf_token='+csrf,'X-CSRF-Token':csrf,...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(90000)});
 return r;
}
async function inbound(text,message){
 const id=prefix+randomUUID();ids.push(id);
 const r=await fetch('http://127.0.0.1:3000/api/whatsapp/inbound',{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':process.env.WHATSAPP_INBOUND_SECRET},body:JSON.stringify({instance,data:{key:{id,remoteJid:phone+'@s.whatsapp.net',fromMe:false},message:message||{conversation:text}}}),signal:AbortSignal.timeout(90000)});
 assert.equal(r.status,200);
 const receipt=await p.whatsappRecibo.findFirst({where:{instancia:instance,mensagemId:id}});
 assert.equal(receipt.estado,'PROCESSADO','Synthetic inbound must complete; provider acceptance is checked separately.');
 return id;
}
(async()=>{
 assert.match(userId||'',/^[a-f0-9-]{36}$/i);assert.match(phone||'',/^55\d{10,11}$/);
 user=await p.user.findUnique({where:{id:userId},include:{profile:true}});
 assert.ok(user?.ativo&&!user.bloqueado);assert.equal(normalized(user.profile?.whatsapp),phone);
 const profiles=await p.userProfile.findMany({where:{NOT:{whatsapp:null}},select:{whatsapp:true}});
 assert.equal(profiles.filter(x=>normalized(x.whatsapp)===phone).length,1);
 const context=await p.whatsappContexto.findFirst({where:{userId,instancia:instance,conversa:phone+'@s.whatsapp.net'}});
 assert.ok(!context||context.contexto==='PESSOAL','Do not change the user context during production validation.');
 const guided=await p.whatsappInicio.count({where:{userId,expiraEm:{gt:new Date()}}}),drafts=await p.whatsappPrevia.count({where:{userId,expiraEm:{gt:new Date()}}});
 assert.equal(guided+drafts,0,'Do not interrupt an active user draft.');
 const wa=new WhatsAppService(new ConfigService(process.env),p);
 assert.ok((await wa.getStatus(instance)).connected);
 assert.equal((await request('/whatsapp-operacao','GET',null,false)).status,401);
 assert.equal((await request('/whatsapp-operacao')).status,200);
 assert.equal((await request('/whatsapp-operacao/metricas')).status,200);
 const voice=await fs.readFile(voiceFixture);
 const asr=await fetch(process.env.MEDIA_WORKER_URL+'/transcribe',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokenMedia()},body:JSON.stringify({mime:'audio/wav',base64:voice.toString('base64')}),signal:AbortSignal.timeout(70000)});
 assert.equal(asr.status,200);const transcript=await asr.json();assert.match(transcript.text,/dentista/i);assert.match(transcript.text,/amanh/i);
 console.log('PASS production: private local ASR service, real authentication token and Portuguese fixture transcription.');
 await inbound('contexto');
 await inbound('tenho '+title+' amanhã 14h');
 assert.equal(await p.event.count({where:{userId,titulo:title}}),0);
 await inbound('confirmar');
 createdEvent=await p.event.findFirst({where:{userId,organizationId:user.organizationId,titulo:title}});assert.ok(createdEvent);
 console.log('PASS production: authenticated endpoints, personal context and confirmed test appointment; real WhatsApp replies requested.');
 const pdf=await new Promise(resolve=>{const d=new PDFDocument(),chunks=[];d.on('data',c=>chunks.push(c));d.on('end',()=>resolve(Buffer.concat(chunks)));d.fontSize(20).text('Orkiestri — teste tecnico autorizado');d.fontSize(12).text('Arquivo de demonstracao, sem dados pessoais.');d.end();});
 const sent=await fetch(process.env.EVOLUTION_API_URL.replace(/\/$/,'')+'/message/sendMedia/'+instance,{method:'POST',headers:{'Content-Type':'application/json',apikey:process.env.EVOLUTION_API_KEY},body:JSON.stringify({number:phone,mediatype:'document',mimetype:'application/pdf',media:pdf.toString('base64'),fileName:'Teste-tecnico-Orkiestri.pdf',caption:'Teste técnico autorizado: documento de demonstração para validar anexos privados.'}),signal:AbortSignal.timeout(20000)});
 assert.ok(sent.ok,'Provider must accept the real test PDF');const sentBody=await sent.json();assert.ok(sentBody.message);
 await inbound('',sentBody.message);
 createdFile=await p.whatsappAnexo.findFirst({where:{userId,nome:'Teste-tecnico-Orkiestri.pdf'},orderBy:{criadoEm:'desc'}});assert.ok(createdFile);
 const own=await request('/whatsapp-anexos/'+createdFile.id+'/download');assert.equal(own.status,200);assert.equal(createHash('sha256').update(Buffer.from(await own.arrayBuffer())).digest('hex'),createHash('sha256').update(pdf).digest('hex'));
 assert.equal((await request('/whatsapp-anexos/'+createdFile.id+'/download','GET',null,false)).status,401);
 assert.equal((await request('/whatsapp-anexos/'+createdFile.id,'DELETE')).status,200);createdFile=null;
 await p.event.deleteMany({where:{userId,organizationId:user.organizationId,titulo:title}});createdEvent=null;
 assert.equal(await wa.sendMessage(phone,'✅ Validação técnica do Orkiestri: canal compartilhado e anexos privados verificados. Os registros de demonstração foram removidos do sistema.',instance),true);
 console.log('PASS production: real provider upload/download, private owner download, anonymous refusal and provider-accepted test message.');
 console.log('LIMIT: inbound payloads were injected through the authenticated webhook for the authorized test phone. Real sends and provider media transfer were exercised; delivery/read receipts were not asserted.');
})().catch(e=>{console.error('PRODUCTION_TEST_FAILED:',e.message);process.exitCode=1}).finally(async()=>{
 try{
  if(user){
   await p.event.deleteMany({where:{userId,organizationId:user.organizationId,titulo:title}});
   await p.whatsappPrevia.deleteMany({where:{userId,comando:{contains:title}}});
   await p.whatsappAtividade.deleteMany({where:{userId,instancia:instance,mensagemId:{in:ids}}});
   if(createdFile)await request('/whatsapp-anexos/'+createdFile.id,'DELETE');
  }
 }catch(e){console.error('TEST_CLEANUP_FAILED:',e.message);process.exitCode=1;}
 await p.$disconnect();
 await fs.unlink(voiceFixture).catch(()=>{});
});
