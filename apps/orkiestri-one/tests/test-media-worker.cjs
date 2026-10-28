const assert=require('node:assert/strict'),fs=require('node:fs/promises'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const run=promisify(execFile),base='http://127.0.0.1:8081',headers={'Content-Type':'application/json',Authorization:'Bearer isolated-fixture-token'};
async function post(body,auth=headers){return fetch(base+'/transcribe',{method:'POST',headers:auth,body:JSON.stringify(body)});}
(async()=>{
for(let n=0;n<40;n++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
await fs.copyFile('/fixtures/portuguese.wav','/tmp/voice.wav');
const audio=await fs.readFile('/tmp/voice.wav'),body={mime:'audio/wav',base64:audio.toString('base64')};
assert.equal((await post(body,{'Content-Type':'application/json'})).status,401);
assert.equal((await post({mime:'image/svg+xml',base64:'AAAA'})).status,422);
const first=post(body);await new Promise(r=>setTimeout(r,200));const second=await post(body);assert.equal(second.status,429);
const response=await first,result=await response.json();assert.equal(response.status,200,JSON.stringify(result));assert.ok(result.text.length>5);assert.ok(result.duration>0&&result.duration<=30);
console.log('TRANSCRICAO_FIXTURE:',result.text);
assert.match(result.text,/dentista/i,'Portuguese fixture must preserve the actual subject');
assert.match(result.text,/amanh/i,'Portuguese fixture must preserve the day');
console.log('PASS local Portuguese speech transcription with recognizable subject/day, authentication, format rejection and busy admission control');
await run('ffmpeg',['-nostdin','-v','error','-f','lavfi','-i','anullsrc=r=16000:cl=mono','-t','31','/tmp/long.wav']);
assert.equal((await post({mime:'audio/wav',base64:(await fs.readFile('/tmp/long.wav')).toString('base64')})).status,422);
const leftovers=(await fs.readdir('/tmp')).filter(f=>f.startsWith('asr-'));assert.equal(leftovers.length,0);
console.log('PASS 30-second cap and temporary audio cleanup');
})().catch(e=>{console.error(e);process.exitCode=1});
