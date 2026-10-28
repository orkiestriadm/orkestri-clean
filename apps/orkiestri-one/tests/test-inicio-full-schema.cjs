const assert=require('node:assert/strict'), Module=require('node:module'),{randomUUID}=require('node:crypto');
const {PrismaClient}=require('@prisma/client');const url=new URL(process.env.DATABASE_URL);url.pathname='/audit_whatsapp_20261024_inicio';
const p=new PrismaClient({datasources:{db:{url:url.toString()}}});
function load(code,file,overrides={}){const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(require('path').dirname(file));const req=m.require.bind(m);m.require=n=>overrides[n]||req(n);m._compile(Buffer.from(code,'base64').toString('utf8'),file);return m.exports;}
const inicioExports=load(INICIO_CODE,'/app/dist/modules/cadastro-whatsapp/whatsapp-inicio.service.js');
const {WhatsappInicioService}=inicioExports;
const {CadastroWhatsappService}=load(CADASTRO_CODE,'/app/dist/modules/cadastro-whatsapp/test-inicio.js',{'./whatsapp-inicio.service':inicioExports});
const {WhatsappInboundService}=load(INBOUND_CODE,'/app/dist/modules/agenda/test-inicio.js',{'../cadastro-whatsapp/whatsapp-inicio.service':inicioExports});
const sent=[];let transportOk=false;
const wa={sendMessage:async(...args)=>{sent.push(args);return transportOk;},sendToJid:async(...args)=>{sent.push(args);return transportOk;}};
const inicio=new WhatsappInicioService(p,wa),cadastro=new CadastroWhatsappService(p,wa,inicio);
let permissions=['*'];
const svc=new WhatsappInboundService(p,wa,{resolvePermissions:async()=>permissions},{},cadastro,inicio);
const receive=(text,id=randomUUID())=>svc.processar({instance:'isolated-inicio',data:{key:{id,remoteJid:'5500000000000@s.whatsapp.net',fromMe:false},message:{conversation:text}}});
const last=()=>sent.at(-1)?.[1]||'';
async function queue(userId){return (await p.$queryRaw`SELECT * FROM whatsapp_boas_vindas WHERE user_id=${userId}`)[0];}
async function rearm(userId,attempts=1){await p.$executeRaw`UPDATE whatsapp_boas_vindas SET estado='PENDENTE',tentativas=${attempts},proxima_tentativa=CURRENT_TIMESTAMP-INTERVAL '1 second' WHERE user_id=${userId}`;}
(async()=>{
 assert.equal((await p.$queryRawUnsafe('SELECT current_database() AS db'))[0].db,'audit_whatsapp_20261024_inicio');
 for(const sql of Buffer.from(MIGRATION_CODE,'base64').toString('utf8').split(';').map(s=>s.trim()).filter(Boolean))await p.$executeRawUnsafe(sql);
 const c=await p.cadastroWhatsapp.create({data:{id:randomUUID(),nome:'Teste Inicio',cpf:'00000000021',whatsapp:'5500000000000',status:'EM_CONVERSA',etapa:'CONFIRMACAO',expiraEm:new Date(Date.now()+600000),respostas:JSON.stringify({email:'inicio@example.invalid',empresa:'Teste Inicio'})}});
 const broken=new CadastroWhatsappService(p,wa,{enfileirar:async()=>{throw new Error('Falha injetada na fila');}});
 await broken.concluir(c,{},'isolated-inicio');assert.equal(await p.user.count(),0);assert.equal(await p.organization.count(),0);
 console.log('PASS fila e conta na mesma transação: falha da fila desfaz provisionamento');
 await cadastro.concluir(c,{},'isolated-inicio');const user=await p.user.findFirst();assert.ok(user);assert.equal(user.primeiroAcesso,false);
 let q=await queue(user.id);assert.equal(q.estado,'PENDENTE');assert.equal(q.tentativas,1);assert.ok(last().includes('/recuperar-senha'));assert.ok(!last().includes('Senha provisória'));
 assert.ok(!Object.keys(q).some(k=>/senha|token|mensagem/.test(k)));
 console.log('PASS falha de transporte preserva conta e boas-vindas sem senha em fila persistente');
 transportOk=true;await rearm(user.id);await new WhatsappInicioService(p,wa).processarPendentes();q=await queue(user.id);assert.equal(q.estado,'ACEITA');assert.equal(q.tentativas,2);
 console.log('PASS novo worker recupera envio pendente');
 await rearm(user.id);const before=sent.length;await Promise.all([inicio.entregar(user.id),new WhatsappInicioService(p,wa).entregar(user.id)]);assert.equal(sent.length-before,1);
 console.log('PASS concorrência na fila envia uma vez');
 transportOk=false;await rearm(user.id,4);await inicio.entregar(user.id);assert.equal((await queue(user.id)).estado,'FALHOU');transportOk=true;
 await rearm(user.id);await p.userProfile.update({where:{userId:user.id},data:{whatsapp:'5500000000001'}});const skip=sent.length;await inicio.entregar(user.id);assert.equal(sent.length,skip);assert.equal((await queue(user.id)).estado,'DESCARTADA');
 await p.userProfile.update({where:{userId:user.id},data:{whatsapp:'5500000000000'}});
 console.log('PASS limite de tentativas e bloqueio de envio ao telefone que deixou de pertencer ao perfil');
 assert.equal(await cadastro.iniciarPeloChat('5500000000000','isolated-inicio'),true);assert.equal(await p.user.count(),1);await receive('acesso');assert.ok(last().includes('/recuperar-senha'));
 console.log('PASS conta existente e comando acesso recebem orientação sem recriar conta');
 await receive('começar');assert.ok(last().includes('compromisso'));const duplicate=randomUUID();await receive('1',duplicate);await receive('1',duplicate);assert.ok(last().includes('Qual é o compromisso'));
 await receive('Dentista consultório 2');await receive('31/02 14h');assert.ok(last().includes('Não consegui validar'));
 await receive('amanhã 14h');assert.ok(last().includes('confirmar'));assert.equal(await p.event.count(),0);
 await receive('2');await receive('amanhã 15h');await receive('1');const event=await p.event.findFirst();assert.equal(event.titulo,'Dentista consultório 2');assert.equal(event.userId,user.id);assert.equal(event.organizationId,user.organizationId);assert.equal(new Date(event.inicio).getHours(),15);
 console.log('PASS compromisso guiado valida data, corrige, confirma e grava no titular correto');
 for(const text of ['começar','2','Mercado 99','150,25','pix','0'])await receive(text);assert.equal(await p.gasto.count(),0);
 for(const text of ['começar','2','Mercado 99','150,25','pix','1'])await receive(text);const gasto=await p.gasto.findFirst();assert.equal(Number(gasto.valor),150.25);assert.equal(gasto.descricao,'Mercado 99');assert.equal(gasto.formaPagamento,'PIX');assert.equal(gasto.userId,user.id);
 console.log('PASS gasto guiado confirma valor correto mesmo com número na descrição; cancelamento não grava');
 await receive('começar');await receive('1');await receive('Restrito');await receive('amanhã 12h');permissions=['gastos:registrar'];await receive('1');assert.equal(await p.event.count(),1);assert.ok(last().includes('acesso'));
 permissions=['*'];await receive('começar');await receive('menu');assert.equal(await inicio.temFluxo('5500000000000@s.whatsapp.net','isolated-inicio'),false);
 await receive('começar');await p.$executeRaw`UPDATE whatsapp_inicio SET expira_em=CURRENT_TIMESTAMP-INTERVAL '1 second'`;assert.equal(await inicio.temFluxo('5500000000000@s.whatsapp.net','isolated-inicio'),false);
 console.log('PASS permissão revogada, saída para menu e expiração da conversa');
 const {AuthService}=load(AUTH_CODE,'/app/dist/modules/auth/test-inicio-auth.js');
 const {JwtService}=require('@nestjs/jwt'),{ConfigService}=require('@nestjs/config');
 const auth=Object.create(AuthService.prototype),cache=new Map();let otpSent;
 Object.assign(auth,{prisma:p,jwt:new JwtService(),config:new ConfigService({JWT_SECRET:'isolated-test-only',JWT_REFRESH_SECRET:'isolated-refresh-only'}),
  cache:{get:async k=>cache.get(k)||null,set:async(k,v)=>cache.set(k,v),del:async k=>cache.delete(k),delPattern:async()=>{}},
  wa:{sendOtpForOrg:async(org,phone,code)=>{assert.equal(org,user.organizationId);assert.equal(phone,'5500000000000');otpSent=code;return true;}},email:{},automacao:{}});
 // Logger privado é inicializado pelo construtor no produto; a instância de teste usa um logger neutro.
 auth.logger={log:()=>{},warn:()=>{},error:()=>{}};
 const otpResult=await auth.sendPasswordOtp('00000000000');assert.equal(otpResult.semCadastro,false);assert.ok(otpSent);
 const token=await auth.verifyPasswordOtp('(00) 00000-0000',otpSent);assert.ok(token.resetToken);
 await assert.rejects(()=>auth.verifyPasswordOtp('5500000000000',otpSent));
 const password='TesteAcesso2026!';await auth.resetPasswordWithToken(token.resetToken,password);
 assert.ok(await require('bcryptjs').compare(password,(await p.user.findUnique({where:{id:user.id}})).senhaHash));
 const login=await auth.login(user.email,password);assert.ok(login.accessToken);assert.equal(login.primeiroAcesso,false);
 console.log('PASS recuperação com DDD, verificação formatada, código usado recusado e login com senha definida');
 const ambiguous=await p.user.create({data:{organizationId:user.organizationId,nome:'Teste Ambiguidade',email:'ambiguo@example.invalid',senhaHash:user.senhaHash}});
 await p.userProfile.create({data:{userId:ambiguous.id,whatsapp:'00000000000'}});
 await assert.rejects(()=>auth.sendPasswordOtp('5500000000000'),e=>e.getStatus()===400);
 console.log('PASS recuperação recusa dois vínculos possíveis em vez de escolher uma conta');
 console.log('RESULTADO: schema e permissões reais de cadastro; ações no banco isolado; transporte simulado.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>p.$disconnect());
