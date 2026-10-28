import { AsyncLocalStorage } from "async_hooks";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export type ExecucaoWhats = {
  prisma: any; instancia: string; conversa: string; mensagemId: string;
  userId?: string; organizationId?: string; contexto?: string; util?: string; tipo?: string; encerrada?: boolean;
};
export const execucaoWhats = new AsyncLocalStorage<ExecucaoWhats>();

function chave() {
  const segredo = process.env.APP_VAULT_KEY || process.env.JWT_SECRET;
  if (!segredo) throw new Error("Chave de proteção indisponível");
  return createHash("sha256").update("orkiestri/whatsapp/recibos/v1:" + segredo).digest();
}
export function protegerMensagem(body: any): string {
  const texto = JSON.stringify(body, (key, value) => key === "base64" ? undefined : value);
  if (Buffer.byteLength(texto) > 65536) throw new Error("Mensagem excede o limite de processamento");
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", chave(), iv);
  const data = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}
export function abrirMensagem(texto: string): any {
  const data = Buffer.from(texto, "base64");
  const cipher = createDecipheriv("aes-256-gcm", chave(), data.subarray(0, 12));
  cipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString("utf8"));
}
export async function identificarExecucao(user: { id: string; organizationId: string }, contexto: string) {
  const s = execucaoWhats.getStore();
  if (!s || s.encerrada) return;
  s.userId = user.id; s.organizationId = user.organizationId; s.contexto = contexto;
  await s.prisma.$executeRaw`
    UPDATE whatsapp_recibos SET user_id=${user.id},organization_id=${user.organizationId},contexto=${contexto}
    WHERE instancia=${s.instancia} AND conversa=${s.conversa} AND mensagem_id=${s.mensagemId}
  `;
}
export async function antesDeEfeito() {
  const s = execucaoWhats.getStore();
  if (!s || s.encerrada) return;
  await s.prisma.$executeRaw`
    UPDATE whatsapp_recibos SET efeitos_iniciados=true WHERE instancia=${s.instancia}
      AND conversa=${s.conversa} AND mensagem_id=${s.mensagemId} AND efeitos_iniciados=false
  `;
}
/** Chamar somente após a gravação/transação de negócio ter sido confirmada. */
export function acaoUtil(tipo: string) {
  const s = execucaoWhats.getStore();
  if (s && !s.encerrada) s.util = tipo;
}
