'use strict';
// Espelho de backend/src/common/vault.ts — MESMO formato/segredo (APP_VAULT_KEY).
const { createDecipheriv, scryptSync } = require('crypto');
const ALGO = 'aes-256-gcm';
const SALT = 'orkestri-app-vault';

function getKey() {
  const raw = process.env.APP_VAULT_KEY;
  if (!raw) throw new Error('APP_VAULT_KEY nao configurada');
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return scryptSync(raw, SALT, 32);
}

function decryptSecret(blob) {
  const p = String(blob || '').split(':');
  if (p.length !== 4 || p[0] !== 'v1') throw new Error('Formato de segredo invalido');
  const d = createDecipheriv(ALGO, getKey(), Buffer.from(p[1], 'base64'));
  d.setAuthTag(Buffer.from(p[2], 'base64'));
  return Buffer.concat([d.update(Buffer.from(p[3], 'base64')), d.final()]).toString('utf8');
}

module.exports = { decryptSecret, vaultConfigured: () => !!process.env.APP_VAULT_KEY };
