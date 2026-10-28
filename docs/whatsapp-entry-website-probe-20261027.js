const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, HOSTNAME: '127.0.0.1', PORT: '3000' }, stdio: 'ignore' });
(async () => {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch('http://127.0.0.1:3000/')).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, 'website failed to start');
  let links = 0;
  for (const route of ['/', '/demo', '/blog', '/products/orkiestri-one']) {
    const response = await fetch('http://127.0.0.1:3000' + route);
    assert.equal(response.status, 200, route);
    const html = await response.text();
    const whatsappLinks = [...html.matchAll(/href="(https:\/\/wa\.me\/[^" ]+)"/g)].map(m => m[1]);
    assert.ok(whatsappLinks.length, 'no WhatsApp signup link: ' + route);
    for (const url of whatsappLinks) {
      assert.equal(new URL(url.replaceAll('&amp;', '&')).searchParams.get('text'), 'CADASTRO', 'wrong signup command: ' + route);
      links++;
    }
    assert.ok(!html.includes('CADASTRO AGENDA'), 'legacy agenda command: ' + route);
    if (route === '/') assert.ok(html.includes('3.3.1'), 'wrong website version');
  }
  const redirect = await fetch('http://127.0.0.1:3000/entrar', { redirect: 'manual' });
  assert.equal(redirect.status, 307);
  assert.ok(redirect.headers.get('location').endsWith('/login'));
  console.log(JSON.stringify({ routes: 4, whatsapp_links: links, signup: 'CADASTRO', login_redirect: 'passed' }));
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => server.kill('SIGTERM'));
