const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{PrismaClient}=require('@prisma/client'),{JwtService}=require('@nestjs/jwt');
const p=new PrismaClient(),jwt=new JwtService(),base='http://127.0.0.1:3000/api',csrf='isolated-http-fixture';
function headers(user){return {'Content-Type':'application/json',Cookie:'csrf_token='+csrf,'X-CSRF-Token':csrf,...(user?{Authorization:'Bearer '+jwt.sign({sub:user.id,email:user.email,roles:['master']},{secret:process.env.JWT_SECRET,expiresIn:'10m'})}:{})};}
async function request(route,user,method='GET',body){const r=await fetch(base+route,{method,headers:headers(user),body:body?JSON.stringify(body):undefined});const text=await r.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {status:r.status,data};}
async function make(org,n){const u=await p.user.create({data:{organizationId:org.id,nome:'HTTP Fixture '+n,email:randomUUID()+'@example.invalid',senhaHash:'not-a-password',ativo:true,primeiroAcesso:false}});await p.userProfile.create({data:{userId:u.id,whatsapp:'551198888000'+n}});return u;}
async function inbound(user,text,id=randomUUID(),media){const body={instance:'fixture',data:{key:{id,remoteJid:user.phone||'5511988880001@s.whatsapp.net',fromMe:false},message:media||{conversation:text}}};const r=await request('/whatsapp/inbound?secret='+process.env.WHATSAPP_INBOUND_SECRET,null,'POST',body);assert.equal(r.status,200,JSON.stringify(r.data));return id;}
(async()=>{
assert.equal((await p.$queryRaw`SELECT current_database() AS db`)[0].db,'audit_one_context_20261024');
for(let n=0;n<60;n++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
const org=await p.organization.create({data:{nome:'HTTP A',slug:randomUUID()}}),foreign=await p.organization.create({data:{nome:'HTTP B',slug:randomUUID()}});
const a=await make(org,1),b=await make(org,2),out=await make(foreign,3);
for(const [u,o] of [[a,org],[b,org],[out,foreign]]){const role=await p.role.upsert({where:{organizationId_nome:{organizationId:o.id,nome:'Fixture Master'}},update:{},create:{organizationId:o.id,nome:'Fixture Master',isMaster:true}});await p.userRole.create({data:{userId:u.id,roleId:role.id}});}
assert.equal((await request('/whatsapp-operacao',null)).status,401);
await inbound(a,'empresa');await inbound(a,'projeto: Projeto HTTP');
const project=await p.project.findFirst({where:{criadoPorId:a.id,titulo:'Projeto HTTP'}});assert.ok(project);
assert.equal((await request('/projects/'+project.id+'/members',a,'POST',{userId:b.id})).status,201);
assert.equal((await request('/projects/'+project.id+'/members',a,'POST',{userId:out.id})).status,404);
await inbound(a,`demanda P-${project.id.slice(0,8)}: Preparar entrega para U-${b.id.slice(0,8)}`);
const task=await p.task.findFirst({where:{projectId:project.id}});assert.equal(task.assigneeId,b.id);
await inbound(a,`iniciar D-${task.id.slice(0,8)}`);assert.equal((await p.task.findUnique({where:{id:task.id}})).status,'EM_ANDAMENTO');
await inbound(a,`concluir D-${task.id.slice(0,8)}`);assert.equal((await p.project.findUnique({where:{id:project.id}})).status,'CONCLUIDO');
await inbound(a,`reabrir D-${task.id.slice(0,8)}`);assert.equal((await p.project.findUnique({where:{id:project.id}})).status,'EM_ANDAMENTO');
assert.ok(await p.projectHistorico.count({where:{projectId:project.id}})>=3);
assert.equal((await request('/projects/'+project.id+'/tasks/'+task.id+'/status',out,'PATCH',{status:'CONCLUIDA'})).status,404);
console.log('PASS HTTP real: WhatsApp -> authenticated Project API -> task status, membership, audit/history and completion/reopen side effects');
await inbound(a,'pessoal');const eid=randomUUID();await Promise.all([inbound(a,'Evento: Concorrência HTTP amanhã 14h',eid),inbound(a,'Evento: Concorrência HTTP amanhã 14h',eid)]);assert.equal(await p.event.count({where:{userId:a.id,titulo:'Concorrência HTTP'}}),1);
await inbound(a,'gastei 75 no mercado no pix');assert.equal(await p.gasto.count({where:{userId:a.id}}),0);await inbound(a,'confirmar');assert.equal(await p.gasto.count({where:{userId:a.id}}),1);
await inbound(a,'','fixture-audio-'+randomUUID(),{audioMessage:{mimetype:'audio/wav',seconds:5,fileLength:200000}});
const pending=await p.$queryRaw`SELECT comando FROM whatsapp_previas WHERE user_id=${a.id}`;assert.equal(pending.length,1);assert.match(pending[0].comando,/dentista/i);const count=await p.event.count({where:{userId:a.id}});await inbound(a,'confirmar');assert.equal(await p.event.count({where:{userId:a.id}}),count+1);
console.log('PASS HTTP real: duplicate receipts, expense confirmation and local voice -> preview -> confirmed event');
await inbound(a,'','fixture-pdf-'+randomUUID(),{documentMessage:{mimetype:'application/pdf',fileName:'private-http.pdf',fileLength:100}});
const files=await request('/whatsapp-anexos',a);assert.equal(files.status,200);assert.equal(files.data.length,1);const file=files.data[0];
assert.equal((await request('/whatsapp-anexos/'+file.id+'/download',b)).status,404);assert.equal((await request('/whatsapp-anexos/'+file.id+'/download',out)).status,404);assert.equal((await request('/whatsapp-anexos/'+file.id+'/download',a)).status,200);
assert.equal((await request('/whatsapp-anexos/'+file.id,b,'DELETE')).status,404);assert.equal((await request('/whatsapp-anexos/'+file.id,a,'DELETE')).status,200);
const panel=await request('/whatsapp-operacao',a),metrics=await request('/whatsapp-operacao/metricas',a);assert.equal(panel.status,200);assert.equal(metrics.status,200);assert.ok(metrics.data.acoes_uteis>=6);assert.ok(!JSON.stringify(panel.data).includes('payload_protegido'));
assert.notEqual((await request('/whatsapp-operacao/metricas?escopo=plataforma',a)).data.escopo,'Plataforma');
console.log('PASS HTTP real: authenticated file isolation, private downloads, operation panel and metrics');
await inbound(a,'começar');await inbound(a,'1');await inbound(a,'tenho consulta');await inbound(a,'amanhã 16h');await inbound(a,'1');
assert.equal(await p.event.count({where:{userId:a.id,titulo:'tenho consulta'}}),1);
const {WhatsappLinguagemService}=require('/app/dist/modules/agenda/whatsapp-linguagem.service');
await p.$executeRaw`INSERT INTO whatsapp_previas(user_id,instancia,conversa,comando) VALUES (${a.id},'fixture','voice-control-fixture','Evento: Protegido amanhã 10h')`;
const lang=new WhatsappLinguagemService(p,{sendToJid:async()=>true});
const audioConfirm=await lang.tratar(a.id,'fixture','voice-control-fixture','confirmar',()=>null,true);assert.ok(audioConfirm.consumido);assert.ok(!audioConfirm.comando);
assert.equal((await p.$queryRaw`SELECT * FROM whatsapp_previas WHERE user_id=${a.id} AND conversa='voice-control-fixture'`).length,1);
await p.$executeRaw`DELETE FROM whatsapp_previas WHERE user_id=${a.id} AND conversa='voice-control-fixture'`;
console.log('PASS HTTP real: guided conversation owns its replies; audio cannot confirm a pending action');
const signup={phone:'5511988880123@s.whatsapp.net'},cpfbase='714302986';let cpf=cpfbase;for(let digits=9;digits<11;digits++){let sum=0;for(let j=0;j<digits;j++)sum+=Number(cpf[j])*(digits+1-j);let d=(sum*10)%11;cpf+=d===10?0:d;}
const email=randomUUID()+'@example.invalid';for(const text of ['cadastro','Pessoa Integração',cpf,email,'Empresa HTTP Fixture'])await inbound(signup,text);
const confirm=randomUUID();await Promise.all([inbound(signup,'confirmar',confirm),inbound(signup,'confirmar',confirm)]);
const created=await p.user.findMany({where:{email}});assert.equal(created.length,1);assert.equal(created[0].primeiroAcesso,false);assert.ok(created[0].senhaHash);
const welcome=await p.$queryRaw`SELECT estado FROM whatsapp_boas_vindas WHERE user_id=${created[0].id}`;assert.equal(welcome.length,1);
assert.equal((await p.$queryRaw`SELECT COUNT(*)::int AS n FROM whatsapp_atividade WHERE user_id=${created[0].id} AND tipo='CADASTRO'`)[0].n,1);
console.log('PASS HTTP real: full signup, duplicate confirmation, durable welcome and actual registration metric');
console.log('RESULTADO: application image under test; isolated PostgreSQL/Redis; fake Evolution transport; real local ASR; no production customer messages.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>p.$disconnect());
