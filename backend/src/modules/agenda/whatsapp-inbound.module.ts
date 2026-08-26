import {
  Module, Controller, Post, Body, Query, Headers, HttpCode, HttpStatus, Logger, Injectable,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { WhatsAppService } from "../notifications/whatsapp.service";
import { NotificationsModule } from "../notifications/notifications.module";

// ── Parser do comando ─────────────────────────────────────────────────────────
//
// Aceita mensagens que começam com evento/agenda/agendar/compromisso e extrai
// título + data + hora do resto, tolerando variações. Ex.:
//   "Evento: Reunião com cliente 27/08 14:00"
//   "Agenda Dentista amanhã 09h"
//   "Agendar Almoço hoje 12:30"
// Sem hora -> evento de dia inteiro. Sem data -> hoje.

type Parsed = { titulo: string; inicio: Date; fim: Date | null; diaTodo: boolean };

export function parseComandoEvento(texto: string, agora: Date): Parsed | "sem_data_hora" | null {
  const t = (texto || "").trim();
  const mKey = t.match(/^\s*(evento|agenda|agendar|compromisso|marcar)\b[:\-–]?\s*/i);
  if (!mKey) return null; // não é um comando — ignora silenciosamente
  let resto = t.slice(mKey[0].length).trim();
  if (!resto) return "sem_data_hora";

  // ── Hora ──
  let hora: number | null = null, minuto = 0;
  let mHora = resto.match(/\b(\d{1,2}):(\d{2})\b/); // 14:00
  if (mHora) { hora = +mHora[1]; minuto = +mHora[2]; }
  if (hora === null) {
    mHora = resto.match(/\b(\d{1,2})h(\d{2})\b/i); // 14h30
    if (mHora) { hora = +mHora[1]; minuto = +mHora[2]; }
  }
  if (hora === null) {
    mHora = resto.match(/\b(\d{1,2})\s*h(?:oras?)?\b/i); // 14h / 14 horas
    if (mHora) { hora = +mHora[1]; minuto = 0; }
  }
  if (mHora) resto = resto.replace(mHora[0], " ");
  if (hora !== null && (hora > 23 || minuto > 59)) return "sem_data_hora";

  // ── Data ──
  let ano = agora.getFullYear(), mes = agora.getMonth(), dia = agora.getDate();
  let temData = false;
  const low = resto.toLowerCase();
  // Nota: sem \b DEPOIS de "amanh[aã]" — em regex JS o \b é ASCII, e "ã" (não-ASCII)
  // não forma boundary com o espaço seguinte, então "amanhã " nunca casava.
  if (/\bdepois de amanh[aã]/.test(low)) {
    const d = new Date(agora); d.setDate(d.getDate() + 2);
    ano = d.getFullYear(); mes = d.getMonth(); dia = d.getDate(); temData = true;
    resto = resto.replace(/depois de amanh[aã]/i, " ");
  } else if (/\bamanh[aã]/.test(low)) {
    const d = new Date(agora); d.setDate(d.getDate() + 1);
    ano = d.getFullYear(); mes = d.getMonth(); dia = d.getDate(); temData = true;
    resto = resto.replace(/amanh[aã]/i, " ");
  } else if (/\bhoje\b/.test(low)) {
    temData = true;
    resto = resto.replace(/\bhoje\b/i, " ");
  } else {
    const mData = resto.match(/\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/); // 27/08 ou 27/08/2026
    if (mData) {
      dia = +mData[1]; mes = +mData[2] - 1;
      if (mData[3]) ano = mData[3].length === 2 ? 2000 + +mData[3] : +mData[3];
      temData = true;
      resto = resto.replace(mData[0], " ");
    }
  }

  if (!temData && hora === null) return "sem_data_hora";

  // Validação básica de data
  if (mes < 0 || mes > 11 || dia < 1 || dia > 31) return "sem_data_hora";

  // ── Título ── (o que sobrou, limpo)
  let titulo = resto.replace(/\s{2,}/g, " ").replace(/^[\s,;:\-–]+|[\s,;:\-–]+$/g, "").trim();
  if (!titulo) titulo = "Compromisso";

  const diaTodo = hora === null;
  const inicio = diaTodo
    ? new Date(ano, mes, dia, 0, 0, 0, 0)
    : new Date(ano, mes, dia, hora!, minuto, 0, 0);
  if (isNaN(inicio.getTime())) return "sem_data_hora";
  const fim = diaTodo ? null : new Date(inicio.getTime() + 60 * 60 * 1000);

  return { titulo, inicio, fim, diaTodo };
}

// ── Match de telefone (JID x número cadastrado) ───────────────────────────────
function soDigitos(s: string | null | undefined): string { return (s || "").replace(/\D/g, ""); }
function nucleo(s: string): string { let d = soDigitos(s); if (d.length > 11 && d.startsWith("55")) d = d.slice(2); return d; }
function telefoneBate(jid: string, cadastrado: string | null): boolean {
  const a = nucleo(jid), b = nucleo(cadastrado || "");
  if (a.length < 8 || b.length < 8) return false;
  return a === b || a.slice(-10) === b.slice(-10) || a.slice(-11) === b.slice(-11);
}

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable()
export class WhatsappInboundService {
  private readonly logger = new Logger("WhatsappInbound");

  constructor(private prisma: PrismaService, private wa: WhatsAppService) {}

  private fmtData(d: Date): string {
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  async processar(body: any): Promise<void> {
    // Evolution v1.8.2 — evento messages.upsert
    const data = Array.isArray(body?.data) ? body.data[0] : body?.data;
    const key = data?.key || {};
    const remoteJid: string = key?.remoteJid || "";
    if (key?.fromMe) return;                              // mensagem que NÓS enviamos
    if (!remoteJid || remoteJid.includes("@g.us")) return; // grupo — ignora
    const texto: string =
      data?.message?.conversation ||
      data?.message?.extendedTextMessage?.text ||
      data?.message?.ephemeralMessage?.message?.extendedTextMessage?.text || "";
    if (!texto.trim()) return;

    const numero = remoteJid.split("@")[0];

    // Comando?
    const parsed = parseComandoEvento(texto, new Date());
    if (parsed === null) return; // não começa com a palavra-chave — não responde nada

    // Identifica o usuário pelo número cadastrado (só quem tem número cria evento)
    const perfis = await this.prisma.userProfile.findMany({
      where: { NOT: { whatsapp: null } },
      select: { whatsapp: true, user: { select: { id: true, organizationId: true, ativo: true, nome: true } } },
    });
    const perfil = perfis.find(p => p.user?.ativo && telefoneBate(numero, p.whatsapp));
    if (!perfil?.user) {
      this.logger.warn(`Inbound de número não cadastrado (${numero}) — ignorado.`);
      return; // não vaza que o número é desconhecido
    }
    const user = perfil.user;

    if (parsed === "sem_data_hora") {
      await this.wa.sendMessageForOrg(user.organizationId, numero,
        "🤖 Não consegui identificar a data/hora. Envie assim:\n\n*Evento: Reunião com cliente 27/08 14:00*\n\nTambém vale _hoje_, _amanhã_ e horários como _9h_ ou _14:30_.").catch(() => {});
      return;
    }

    // Cria o evento na agenda da pessoa
    const ev = await this.prisma.event.create({
      data: {
        titulo: parsed.titulo,
        inicio: parsed.inicio,
        fim: parsed.fim,
        tipo: "COMPROMISSO" as any,
        cor: "#22d3ee",
        diaTodo: parsed.diaTodo,
        userId: user.id,
        criadoPorId: user.id,
        organizationId: user.organizationId,
      } as any,
    });
    this.logger.log(`Evento criado via WhatsApp: user=${user.id} "${parsed.titulo}" ${parsed.inicio.toISOString()}`);

    const quando = parsed.diaTodo
      ? parsed.inicio.toLocaleDateString("pt-BR") + " (dia todo)"
      : this.fmtData(parsed.inicio);
    await this.wa.sendMessageForOrg(user.organizationId, numero,
      `✅ Evento criado na sua agenda:\n\n🗓️ *${parsed.titulo}*\n🕐 ${quando}` +
      (parsed.fim ? ` – ${this.fmtData(parsed.fim)}` : "")).catch(() => {});
  }
}

// ── Controller (público — validado por segredo) ───────────────────────────────
@Controller("whatsapp")
export class WhatsappInboundController {
  private readonly logger = new Logger("WhatsappInbound");
  constructor(private svc: WhatsappInboundService) {}

  @Post("inbound")
  @HttpCode(HttpStatus.OK)
  async inbound(
    @Body() body: any,
    @Query("secret") secretQuery?: string,
    @Headers("x-webhook-secret") secretHeader?: string,
  ) {
    const esperado = process.env.WHATSAPP_INBOUND_SECRET;
    // Sem segredo configurado, o recurso fica DESLIGADO (evita spoofing de número).
    if (!esperado) { this.logger.warn("WHATSAPP_INBOUND_SECRET não configurado — inbound ignorado."); return { received: true }; }
    if (secretQuery !== esperado && secretHeader !== esperado) return { received: true };
    try { await this.svc.processar(body); } catch (e: any) { this.logger.error("inbound erro: " + e.message); }
    return { received: true };
  }
}

@Module({
  imports: [NotificationsModule],
  controllers: [WhatsappInboundController],
  providers: [WhatsappInboundService],
})
export class WhatsappInboundModule {}
