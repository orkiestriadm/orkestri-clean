const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('../frontend/node_modules/typescript');
const root = '../apps/orkiestri-one/frontend/';
function load(file, imports = {}, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(require.resolve(root + file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, { exports, require: name => {
    if (name in imports) return imports[name];
    throw new Error('Unexpected dependency: ' + name);
  }, AbortController, setTimeout, clearTimeout, Promise, process, console, ...globals });
  return exports;
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const { createSessionRedirect } = load('src/lib/session-redirect.ts');
  let count = 0, clears = 0, signal;
  const redirect = createSessionRedirect(s => { clears++; signal = s; return new Promise(() => {}); }, () => count++, 20);
  redirect(); redirect();
  await pause(45);
  assert.equal(count, 1, 'Hung cookie cleanup must not block navigation');
  assert.equal(clears, 1, 'Concurrent 401s must share cookie cleanup');
  assert.ok(signal.aborted, 'Hung cleanup must be aborted');
  for (const clear of [() => Promise.resolve(), () => Promise.reject(new Error('offline')), () => { throw new Error('sync failure'); }]) {
    let redirects = 0;
    createSessionRedirect(clear, () => redirects++, 20)();
    await pause(40);
    assert.equal(redirects, 1, 'Success and failures must navigate only once');
  }
  const {middleware} = load('src/middleware.ts', {'next/server': {
    NextResponse: { next: () => ({status:200}), redirect: url => ({status:307, url:String(url)}) },
  }}, {URL});
  function route(path, token) {
    return middleware({cookies: {get: () => token ? {value:token} : undefined}, nextUrl:{pathname:path},url:'https://www.orkiestri.com'+path});
  }
  for (const cookie of [undefined, 'invalid', 'expired', 'revoked']) {
    assert.equal(route('/login', cookie).status, 200, 'Login must remain reachable with stale cookies');
  }
  assert.equal(route('/dashboard', undefined).url, 'https://www.orkiestri.com/login?from=%2Fdashboard');
  assert.equal(route('/dashboard/agenda', undefined).url, 'https://www.orkiestri.com/login?from=%2Fdashboard%2Fagenda');
  assert.equal(route('/dashboard', 'present').status, 200, 'API still authoritatively validates sessions');

  // Exercise the actual Axios response interceptor, including the separate
  // subscription-suspended flow, without contacting any service.
  const axios=require('../frontend/node_modules/axios/dist/node/axios.cjs');
  let navigations=[], clearCalls=0;
  const browser={location:{origin:'https://www.orkiestri.com',pathname:'/dashboard',href:'',replace:url=>navigations.push(url)}};
  const {api}=load('src/lib/api.ts',{
    axios,
    './toast':{useToastStore:{getState:()=>({warning(){},error(){}})}},
    './session-redirect':{createSessionRedirect:(clear,navigate)=>createSessionRedirect(clear,navigate,20)},
  },{window:browser,document:{cookie:''},fetch:()=>{clearCalls++;return new Promise(()=>{});}});
  const reject=(status,data={})=>config=>Promise.reject(new axios.AxiosError('test','ERR_BAD_REQUEST',config,{}, {status,data,config,headers:{},statusText:'test'}));
  await Promise.allSettled([api.get('/auth/me',{adapter:reject(401)}),api.get('/another',{adapter:reject(401)})]);
  await pause(40);
  assert.equal(clearCalls,1);
  assert.equal(navigations.join(','),'/login');
  await api.get('/auth/me',{adapter:reject(401,{code:'BILLING_SUSPENDED',message:'Vencida'})}).catch(()=>{});
  assert.ok(browser.location.href.startsWith('/suspended?'));
  assert.equal(clearCalls,1,'Billing suspension must not clear a valid session');
  browser.location.pathname='/login';
  await api.post('/auth/login',{}, {adapter:reject(401)}).catch(()=>{});
  assert.equal(clearCalls,1,'Incorrect credentials must remain on login');

  // Render the real layout with hooks controlled by the test; no real auth calls.
  let hooks=[], cursor=0, effects=[], checks=[], stateUpdates=[];
  const react = {
    useState(initial) {const index=cursor++; if (!(index in hooks)) hooks[index]=initial; return [hooks[index], value => {hooks[index]=typeof value==='function'?value(hooks[index]):value;}];},
    useEffect(fn) {effects.push(fn);},
  };
  const auth = {me: options => {checks.push(options);return Promise.resolve({id:'valid-user'});}};
  const imports = {
    react, 'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
    '@/lib/store':{useAuthStore:{setState:s=>stateUpdates.push(s)}}, '@/lib/api':{authApi:auth},
    '@/components/layout/Sidebar':{}, '@/components/ui/AlertBanner':{},
    '@/lib/useNotifications':{}, '@/components/ui/CommandPalette':{},
  };
  const layout=load('src/app/dashboard/layout.tsx', imports, {window:{addEventListener(){},removeEventListener(){}}}).default;
  const render=()=>{cursor=0;effects=[];return layout({children:'PRIVATE CONTENT'});};
  assert.ok(!JSON.stringify(render()).includes('PRIVATE CONTENT'), 'Do not render protected content before validating session');
  const cleanup=effects[1]();
  await pause(0);
  assert.equal(hooks[0],true);
  assert.equal(checks[0].timeout,10000, 'Session verification has a deadline');
  assert.equal(stateUpdates.at(-1).user.id,'valid-user');
  cleanup();
  hooks=[]; auth.me=()=>Promise.reject({response:{status:401}});
  render(); effects[1](); await pause(0);
  assert.equal(hooks[0],false);
  assert.ok(hooks[1].includes('sessão terminou'));
  assert.equal(stateUpdates.at(-1).user,null);
  hooks=[]; auth.me=()=>Promise.reject({code:'ECONNABORTED'});
  render(); effects[1](); await pause(0);
  assert.equal(hooks[0],false);
  const errorView=JSON.stringify(render());
  assert.ok(errorView.includes('Tentar novamente') && errorView.includes('/login'));
  assert.ok(!errorView.includes('PRIVATE CONTENT'));
  console.log('PASS: login recovery, concurrent 401s, hung cleanup, cookie variants, valid session, expired session, timeout/retry and protected rendering.');
})().catch(error=>{console.error(error);process.exitCode=1;});
