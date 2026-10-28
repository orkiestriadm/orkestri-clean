const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),{randomUUID,timingSafeEqual}=require('node:crypto'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const run=promisify(execFile),MAX=5*1024*1024;
let busy=false;
function authorized(req){const a=Buffer.from(req.headers.authorization||''),b=Buffer.from('Bearer '+(process.env.MEDIA_WORKER_TOKEN||''));return !!process.env.MEDIA_WORKER_TOKEN&&a.length===b.length&&timingSafeEqual(a,b);}
function send(res,status,data){if(!res.headersSent){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}}
http.createServer(async(req,res)=>{
  if(req.method==='GET'&&req.url==='/health')return send(res,200,{ok:true,busy});
  if(req.method!=='POST'||req.url!=='/transcribe')return send(res,404,{error:'Unavailable'});
  if(!authorized(req))return send(res,401,{error:'Unauthorized'});
  if(busy)return send(res,429,{error:'Transcrição ocupada; tente novamente.'});
  busy=true;let dir;
  try{
    const chunks=[];let total=0;
    for await(const chunk of req){total+=chunk.length;if(total>7*1024*1024)throw new Error('SIZE');chunks.push(chunk);}
    const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(typeof body.base64!=='string'||!/^audio\/(?:ogg|mpeg|mp4|wav|x-wav|webm)(?:;.*)?$/i.test(body.mime||''))throw new Error('FORMAT');
    if(!/^[A-Za-z0-9+/]*={0,2}$/.test(body.base64))throw new Error('FORMAT');
    const audio=Buffer.from(body.base64,'base64');if(!audio.length||audio.length>MAX)throw new Error('SIZE');
    dir=path.join('/tmp','asr-'+randomUUID());await fs.mkdir(dir,{mode:0o700});
    const input=path.join(dir,'input'),wav=path.join(dir,'audio.wav'),output=path.join(dir,'result');
    await fs.writeFile(input,audio,{mode:0o600});
    const probe=await run('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',input],{timeout:10000,maxBuffer:8192});
    const duration=Number(probe.stdout.trim());if(!Number.isFinite(duration)||duration<=0||duration>30)throw new Error('DURATION');
    await run('ffmpeg',['-nostdin','-v','error','-i',input,'-t','30','-vn','-ac','1','-ar','16000','-threads','1',wav],{timeout:10000,maxBuffer:32768});
    await run('whisper-cli',['-m','/models/ggml-base.bin','-f',wav,'-l','pt','-t','1','-nt','-otxt','-of',output],{timeout:55000,maxBuffer:262144});
    const text=(await fs.readFile(output+'.txt','utf8')).trim().replace(/\s+/g,' ');
    if(!text||text.length>1500||/^\[.*\]$/.test(text))throw new Error('EMPTY');
    send(res,200,{text,duration});
  }catch(e){const invalid=['SIZE','FORMAT','DURATION','EMPTY'].includes(e.message);send(res,invalid?422:503,{error:invalid?'Envie áudio de fala com até 30 segundos e 5 MB.':'Não foi possível transcrever agora. Envie por texto ou tente novamente.'});}
  finally{if(dir)await fs.rm(dir,{recursive:true,force:true});busy=false;}
}).listen(8081,'0.0.0.0');
