#!/usr/bin/env node
// A real PostgreSQL fixture, always local and disposable. Never uses DATABASE_URL.
const cp = require('node:child_process');
const crypto = require('node:crypto');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function command(bin, args, options = {}) {
  const result = cp.spawnSync(bin, args, { cwd: root, encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${bin} ${args[0]} failed: ${result.stderr || result.stdout || result.status}`);
  return result.stdout?.trim() || '';
}
const runId = crypto.randomBytes(8).toString('hex');
const name = `codex-signup-test-${runId}`;
let container, context;
async function main() {
  context = command('docker', ['context', 'show']);
  const host = command('docker', ['context', 'inspect', context, '--format', '{{.Endpoints.docker.Host}}']);
  if (!/^(npipe:|unix:)/.test(host)) throw new Error('Refusing Docker endpoint: only a local pipe/socket is allowed');
  const docker = args => command('docker', ['--context', context, ...args]);
  docker(['image', 'inspect', 'postgres:16-alpine', '--format', '{{.Id}}']);
  container = docker(['run', '--rm', '-d', '--name', name, '--label', `codex.signup-test=${runId}`, '--memory', '256m',
    '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', 'POSTGRES_DB=codex_signup_audit', '-p', '127.0.0.1::5432', 'postgres:16-alpine']);
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    const result = cp.spawnSync('docker', ['--context', context, 'exec', container, 'pg_isready', '-U', 'postgres', '-d', 'codex_signup_audit'], { encoding: 'utf8' });
    if (result.status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Disposable PostgreSQL did not become ready');
  const binding = docker(['port', container, '5432/tcp']).match(/^127\.0\.0\.1:(\d+)$/);
  if (!binding) throw new Error('Fixture port is not bound exclusively to loopback');
  const database = `postgresql://postgres@127.0.0.1:${binding[1]}/codex_signup_audit`;
  const env = { ...process.env, DATABASE_URL: database, SIGNUP_TEST_DATABASE_URL: database, PRISMA_HIDE_UPDATE_MESSAGE: '1' };
  console.log('Preparing disposable local signup database; existing databases remain untouched.');
  command(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--schema', 'prisma/schema.prisma', '--skip-generate'], { env, stdio: 'inherit' });
  const test = cp.spawnSync(process.execPath, [require.resolve('jest/bin/jest'), '--config', 'test/jest-signup.json', '--runInBand', ...process.argv.slice(2)], { cwd: root, env, stdio: 'inherit' });
  if (test.error) throw test.error;
  process.exitCode = test.status ?? 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => {
  if (!container) return;
  const label = command('docker', ['--context', context, 'inspect', container, '--format', '{{index .Config.Labels "codex.signup-test"}}']);
  if (label !== runId) throw new Error('Refusing cleanup: container ownership does not match');
  command('docker', ['--context', context, 'stop', '--time', '1', container]);
  console.log('Disposable signup database removed.');
});
