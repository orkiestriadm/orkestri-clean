const fs=require('node:fs'),c=require('node:crypto');
const baselines={
  'src/middleware.ts':'a3e790810151b4ec46c137b6b18841f8a6d46e76678b54f5fc775364acc4845e',
  'src/lib/api.ts':'ac7e9d2610bd912b69abccb7b4e07a565759499f5400a2c8d081f9516c2a6048',
  'src/app/dashboard/layout.tsx':'edba76674ad560df9391738b7c2eda422057bacb46cecf56f2d8b0d43f98ee93',
  'src/lib/session-redirect.ts':null,
};
const files=Object.entries(baselines).map(([p,baseline])=>({path:'frontend/'+p,baseline,sha256:c.createHash('sha256').update(fs.readFileSync('apps/orkiestri-one/frontend/'+p,'utf8').replace(/\r\n/g,'\n')).digest('hex')}));
fs.writeFileSync('docs/dashboard-release-20261027.json',JSON.stringify({release:'dashboard-session-20261027',files},null,2));
console.log('Manifest prepared for '+files.length+' files.');
