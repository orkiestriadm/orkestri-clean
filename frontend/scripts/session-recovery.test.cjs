const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
function load(file, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require, Promise, URL, AbortController, setTimeout, clearTimeout, ...globals });
  return module.exports;
}
test('expired session sends the CSRF header, includes cookies and navigates once', async () => {
  const calls = [], redirects = [];
  const { recoverSession } = load('src/lib/session-recovery.ts', {
    document: { cookie: 'other=1; csrf_token=local-csrf' },
    window: { location: { replace: url => redirects.push(url) } },
    fetch: async (...args) => { calls.push(args); return { ok: true }; },
  });
  const first = recoverSession();
  assert.equal(recoverSession(), first);
  await first;
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], '/api/auth/clear');
  assert.equal(calls[0][1].method, 'POST');
  assert.equal(calls[0][1].credentials, 'include');
  assert.equal(calls[0][1].headers['X-CSRF-Token'], 'local-csrf');
  assert.deepEqual(redirects, ['/login?reauth=1']);
});
test('failed cleanup still opens the login form', async () => {
  const redirects = [];
  const { recoverSession } = load('src/lib/session-recovery.ts', {
    document: { cookie: '' }, window: { location: { replace: url => redirects.push(url) } },
    fetch: async () => { throw Error('offline'); },
  });
  await recoverSession();
  assert.deepEqual(redirects, ['/login?reauth=1']);
});
test('cleanup has a bounded timeout and recovers from an unresponsive API', async () => {
  let expire, redirected = false;
  const { recoverSession } = load('src/lib/session-recovery.ts', {
    document: { cookie: '' }, window: { location: { replace: () => { redirected = true; } } },
    setTimeout: (fn, ms) => { assert.equal(ms, 5000); expire = fn; return 1; }, clearTimeout: () => {},
    fetch: (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(Error('aborted')))),
  });
  const pending = recoverSession(); expire(); await pending;
  assert.equal(redirected, true);
});
const { NextRequest } = require('next/server');
const { middleware } = load('src/middleware.ts');
function request(route, token) { return new NextRequest('http://localhost' + route, { headers: token ? { cookie: 'orkestri_token=expired-test-token' } : {} }); }
test('ordinary login still redirects when a cookie is present', () => {
  const r = middleware(request('/login', true)); assert.equal(new URL(r.headers.get('location')).pathname, '/dashboard');
});
test('recovery opens login even if cleanup failed and an expired cookie remains', () => {
  const r = middleware(request('/login?reauth=1', true)); assert.equal(r.headers.get('location'), null); assert.equal(r.headers.get('x-middleware-next'), '1');
});
test('recovery does not bypass dashboard authentication', () => {
  const r = middleware(request('/dashboard?reauth=1', false)); assert.equal(new URL(r.headers.get('location')).pathname, '/login');
});

