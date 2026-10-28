const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const child=spawn(process.execPath,['server.js'],{env:{...process.env,HOSTNAME:'127.0.0.1',PORT:'3000'},stdio:'ignore'});
(async()=>{
 let ready=false;
 for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:3000/')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
 assert.ok(ready,'website failed to start');
 let links=0;
 for(const route of ['/','/demo']){
  const r=await fetch('http://127.0.0.1:3000'+route);assert.equal(r.status,200);
  const html=await r.text();assert.ok(html.includes('Responda uma pergunta por vez'),'old signup demonstration');
  if(route==='/')assert.ok(html.includes('3.3.2'),'old version');
  for(const m of html.matchAll(/href="(https:\/\/wa\.me\/[^" ]+)"/g)) {assert.equal(new URL(m[1].replaceAll('&amp;','&')).searchParams.get('text'),'CADASTRO');links++;}
 }
 assert.ok(links>0);
 console.log(JSON.stringify({routes:2,whatsapp_links:links,version:'3.3.2',guided_copy:'passed'}));
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>child.kill('SIGTERM'));
