import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

/**
 * Cofre simples para segredos guardados no banco (ex: senha de rede do OSA).
 * AES-256-GCM autenticado. Chave de APP_VAULT_KEY (env):
 *   - 64 hex => chave de 32 bytes direta;  - outra string => derivada via scrypt.
 * Formato: "v1:<iv b64>:<tag b64>:<ciphertext b64>".
 * O worker tem um espelho deste arquivo em monitoring-worker/lib/vault.js.
 */
const ALGO = "aes-256-gcm";
const SALT = "orkestri-app-vault";

function getKey(): Buffer {
  const raw = process.env.APP_VAULT_KEY;
  if (!raw) throw new Error("APP_VAULT_KEY nao configurada — cofre indisponivel");
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  return scryptSync(raw, SALT, 32);
}

export function vaultConfigured(): boolean {
  return !!process.env.APP_VAULT_KEY;
}

export function encryptSecret(plain: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(blob: string): string {
  const key = getKey();
  const p = (blob || "").split(":");
  if (p.length !== 4 || p[0] !== "v1") throw new Error("Formato de segredo invalido");
  const decipher = createDecipheriv(ALGO, key, Buffer.from(p[1], "base64"));
  decipher.setAuthTag(Buffer.from(p[2], "base64"));
  return Buffer.concat([decipher.update(Buffer.from(p[3], "base64")), decipher.final()]).toString("utf8");
}
