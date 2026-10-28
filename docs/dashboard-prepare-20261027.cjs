const fs = require('node:fs');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const hash = s => crypto.createHash('sha256').update(s.replace(/\r\n/g, '\n')).digest('hex');
if (fs.existsSync('apps/orkiestri-one/frontend/src/lib/session-redirect.ts')) {
  throw new Error('Preparation already applied; refusing to overwrite the One sources.');
}
const expected = {
  'src/middleware.ts': '9b21ff84ced9b5b0fcea0964539c051ded363b221aed4487e442bf9700c26dcd',
  'src/lib/api.ts': 'd96f574fc22bfdf92ac726a9395e6206d82b662284f58af17f752d277bcc6b7c',
  'src/app/dashboard/layout.tsx': 'edba76674ad560df9391738b7c2eda422057bacb46cecf56f2d8b0d43f98ee93',
};
// Preserve the enterprise checkout; apply the reviewed changes to the One edition.
for (const [p, baseline] of Object.entries(expected)) {
  const root = 'frontend/' + p;
  const original = cp.execFileSync('git', ['show', 'HEAD:' + root], {encoding:'utf8'});
  if (hash(original) !== baseline) throw new Error('Original mismatch: ' + root);
  const edited = fs.readFileSync(root, 'utf8');
  const one = 'apps/orkiestri-one/frontend/' + p;
  let result = edited;
  if (p === 'src/middleware.ts') {
    result = edited.replace(' e /reservas', '').replace(' || pathname.startsWith("/reservas")', '').replace(', "/reservas/:path*"', '');
  } else if (p === 'src/lib/api.ts') {
    const index = edited.indexOf('// ── Auth API');
    const oneOriginal = fs.readFileSync(one, 'utf8');
    result = edited.slice(0, index) + oneOriginal.slice(oneOriginal.indexOf('// ── Auth API'));
    result = result.replace('me: async () => {', 'me: async (options: { timeout?: number; silent?: boolean; signal?: AbortSignal } = {}) => {')
      .replace('api.get("/auth/me");', 'api.get("/auth/me", options);');
  } else {
    result = result.replace('import { useRouter } from "next/navigation";\n', '')
      .replace('  const router = useRouter();\n', '').replace('  const { user } = useAuthStore();\n', '');
  }
  fs.writeFileSync(one, result.replace(/\r\n/g, '\n'));
  fs.writeFileSync(root, original);
}
fs.renameSync('frontend/src/lib/session-redirect.ts', 'apps/orkiestri-one/frontend/src/lib/session-redirect.ts');
console.log('One changes prepared; enterprise originals preserved.');
