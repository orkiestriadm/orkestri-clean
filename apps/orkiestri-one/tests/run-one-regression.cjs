const fs=require('node:fs'),Module=require('node:module');
const mode=process.argv[2],files={rotina:'test-rotina-full-schema.cjs',inicio:'test-inicio-full-schema.cjs',cadastro:'test-cadastro-full-schema.cjs',recibos:'test-recibos-full-schema.cjs'};
if(!files[mode])throw new Error('Invalid regression suite');
const modules={DATAS_CODE:'agenda/whatsapp-rotina-datas',ROTINA_CODE:'agenda/whatsapp-rotina.service',INBOUND_CODE:'agenda/whatsapp-inbound.module',INICIO_CODE:'cadastro-whatsapp/whatsapp-inicio.service',CADASTRO_CODE:'cadastro-whatsapp/cadastro-whatsapp.module',ATOMIC_CODE:'cadastro-whatsapp/cadastro-atomico',AUTH_CODE:'auth/auth.service',RECIBOS_CODE:'agenda/whatsapp-recibos'};
let prelude='const MIGRATION_CODE="";';
for(const [name,file] of Object.entries(modules))prelude+=`const ${name}='${fs.readFileSync('/app/dist/modules/'+file+'.js').toString('base64')}';`;
prelude+=`
function makeInbound(prisma,wa,auth,ref,cadastro,inicio,rotina){
 const base='/app/dist/modules/';
 const C=require(base+'agenda/whatsapp-contexto.service').WhatsappContextoService;
 const T=require(base+'agenda/whatsapp-equipe.service').WhatsappEquipeService;
 const L=require(base+'agenda/whatsapp-linguagem.service').WhatsappLinguagemService;
 const R=require(base+'agenda/whatsapp-rotina.service').WhatsappRotinaService;
 return new WhatsappInboundService(prisma,wa,auth,ref,cadastro,inicio||{temFluxo:async()=>false},rotina||new R(prisma,wa,auth),new C(prisma),new T(prisma,wa,auth),new L(prisma,wa),{tratar:async()=>({consumido:false})});
}
`;
let source=fs.readFileSync('/tests/'+files[mode],'utf8').replaceAll('new WhatsappInboundService(','makeInbound(');
if(mode==='cadastro')source=source.replace('new CadastroWhatsappService(broken, wa)','new CadastroWhatsappService(broken, wa, new (require("/app/dist/modules/cadastro-whatsapp/whatsapp-inicio.service").WhatsappInicioService)(broken,wa))').replace('new CadastroWhatsappService(p, wa)','new CadastroWhatsappService(p, wa, new (require("/app/dist/modules/cadastro-whatsapp/whatsapp-inicio.service").WhatsappInicioService)(p,wa))').replace("assert.equal(sent.filter(x=>x.includes('Senha provisória')).length,1)","assert.equal(sent.filter(x=>x.includes('Senha provisória')).length,0);assert.equal((await p.$queryRaw`SELECT COUNT(*)::int AS n FROM whatsapp_boas_vindas`)[0].n,1)");
const m=new Module('/app/one-regression-'+mode+'.cjs',module);m.filename='/app/one-regression-'+mode+'.cjs';m.paths=Module._nodeModulePaths('/app');m._compile(prelude+source,m.filename);
