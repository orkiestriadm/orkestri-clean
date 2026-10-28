#!/usr/bin/env node
// Offline verification. Reads sources and a saved manifest; never connects to a server.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const file = process.argv[2] || path.join(root, 'docs/baselines/production-20261028.json');
const baseline = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8').replace(/^\uFEFF/, ''));
const mismatches = [];
let checked = 0;
for (const [relative, expected] of Object.entries(baseline.files)) {
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(root + path.sep)) throw new Error('Manifest path outside repository');
  if (!fs.existsSync(absolute)) { mismatches.push({ file: relative, reason: 'missing' }); continue; }
  if (fs.lstatSync(absolute).isSymbolicLink()) throw new Error('Source symlink is not allowed');
  const data = fs.readFileSync(absolute);
  const normalized = Buffer.from(data.toString('binary').replace(/\r\n/g, '\n'), 'binary');
  const actual = crypto.createHash('sha256').update(normalized).digest('hex');
  checked++;
  if (actual !== expected.sha256) mismatches.push({ file: relative, reason: 'different' });
}
const scope = relative => /^(backend\/(src|prisma|assets)|frontend\/(src|public)|website\/(src|public)|media-worker)\//.test(relative) || /^(backend|frontend|website|media-worker)\/(Dockerfile|package(?:-lock)?\.json|tsconfig\.json|nest-cli\.json|next-env\.d\.ts|\.dockerignore|(?:next|postcss|tailwind|eslint)\.config\.[^/]+)$/.test(relative);
const inventory = cp.spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' });
if (inventory.status !== 0) throw new Error('Cannot inspect source inventory');
for (const relative of new Set(inventory.stdout.split('\0').filter(Boolean))) {
  if (scope(relative) && fs.existsSync(path.join(root, relative)) && !baseline.files[relative]) mismatches.push({ file: relative, reason: 'extra' });
}
console.log(JSON.stringify({ checked, expected: Object.keys(baseline.files).length, mismatches }, null, 2));
process.exitCode = mismatches.length ? 1 : 0;
