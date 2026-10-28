const fs=require('node:fs/promises'),{execFile,spawn}=require('node:child_process'),{promisify}=require('node:util');
const run=promisify(execFile);
(async()=>{
 await fs.mkdir('/fixtures',{recursive:true});
 const files=[['https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz','piper.tar.gz'],['https://huggingface.co/rhasspy/piper-voices/resolve/4ddc3e5fe132918785d98c0c8c7d6ca295c0034c/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx','voice.onnx'],['https://huggingface.co/rhasspy/piper-voices/resolve/4ddc3e5fe132918785d98c0c8c7d6ca295c0034c/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx.json','voice.onnx.json']];
 for(const [url,file] of files){const r=await fetch(url);if(!r.ok)throw new Error('Fixture dependency '+r.status);await fs.writeFile('/fixtures/'+file,Buffer.from(await r.arrayBuffer()));}
 await run('tar',['-xzf','/fixtures/piper.tar.gz','-C','/fixtures']);
 await new Promise((resolve,reject)=>{const p=spawn('/fixtures/piper/piper',['--model','/fixtures/voice.onnx','--output_file','/fixtures/portuguese.wav'],{stdio:['pipe','ignore','pipe']});let err='';p.stderr.on('data',b=>err+=b);p.on('error',reject);p.on('close',code=>code?reject(new Error('Fixture generation failed: '+err.slice(-300))):resolve());p.stdin.end('Tenho dentista amanhã às quatorze horas.\n');});
 await fs.chmod('/fixtures/portuguese.wav',0o644);
 console.log('PASS Portuguese natural voice fixture generated locally. No client data.');
})().catch(e=>{console.error(e);process.exitCode=1});
