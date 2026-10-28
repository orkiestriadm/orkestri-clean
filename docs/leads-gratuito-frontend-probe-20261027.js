const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = '/app/.next/static/chunks/app/dashboard/leads';
const chunks = fs.readdirSync(path).filter(f=>f.endsWith('.js'));
const text = chunks.map(f=>fs.readFileSync(path+'/'+f,'utf8')).join('\n')
  .replace(/\\u([0-9a-f]{4})/gi,(_,code)=>String.fromCharCode(parseInt(code,16)))
  .replace(/\\x([0-9a-f]{2})/gi,(_,code)=>String.fromCharCode(parseInt(code,16)));
assert.ok(text.includes('cadastro gratuito no Orkiestri'), 'new invitation not bundled');
assert.ok(!text.includes('7 dias grátis'), 'old invitation still bundled');
assert.ok(text.includes('gratuitos, sem cartão'), 'free phase missing');
console.log(JSON.stringify({lead_chunks:chunks.length,invitation:'free_without_days',status:'passed'}));
