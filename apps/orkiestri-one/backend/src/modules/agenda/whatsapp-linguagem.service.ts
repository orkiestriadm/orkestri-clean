import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { WhatsAppService } from "../notifications/whatsapp.service";

export type PreviaWhats = { comando: string; resumo: string };

/** Intenções delimitadas. Texto não reconhecido nunca vira gravação. */
export function intencaoCotidiana(texto: string): string | null {
  let t = texto.trim().replace(/[.!?]+$/, "");
  if (/^(?:tenho|marque|marca|agende|agenda para mim)\s+/i.test(t))
    return "Evento: " + t.replace(/^(?:tenho|marque|marca|agende|agenda para mim)\s+/i, "").replace(/\s+[àa]s\s+/i, " ");
  if (/^(?:preciso|tenho que|me lembre de|me lembra de|lembrar de)\s+/i.test(t))
    return "tarefa: " + t.replace(/^(?:preciso|tenho que|me lembre de|me lembra de|lembrar de)\s+/i, "");
  if (/^(?:gastei|paguei|comprei)\b/i.test(t)) return t;
  return null;
}

@Injectable()
export class WhatsappLinguagemService {
  constructor(private prisma: PrismaService, private wa: WhatsAppService) {}

  async tratar(userId: string, instancia: string, conversa: string, texto: string,
    preparar: (comando: string) => PreviaWhats | null, forcarPrevia = false): Promise<{ consumido: boolean; comando?: string }> {
    const say = (s: string) => this.wa.sendToJid(conversa, "👤 *Pessoal*\n" + s, instancia);
    if (!forcarPrevia && /^(?:1|sim|confirmar|confirmo|2|corrigir|0|cancelar)$/i.test(texto)) {
      const rows: any[] = await this.prisma.$queryRaw`
        DELETE FROM whatsapp_previas WHERE user_id=${userId} AND instancia=${instancia} AND conversa=${conversa}
          AND expira_em>CURRENT_TIMESTAMP RETURNING comando
      `;
      if (rows.length) {
        if (/^(?:1|sim|confirmar|confirmo)$/i.test(texto)) return { consumido: false, comando: rows[0].comando };
        await say(/^2|corrigir$/i.test(texto) ? "Envie a frase novamente com os dados corretos." : "Rascunho cancelado.");
        return { consumido: true };
      }
    }
    const fala = texto.trim().replace(/[.!?]+$/, "");
    const comando = intencaoCotidiana(fala) || (forcarPrevia && /^(?:evento|gasto|tarefa)\s*:/i.test(fala) ? fala : null)
      || (forcarPrevia && /(?:hoje|amanh[aã]|\d{1,2}\/\d{1,2})/i.test(fala) && /\d{1,2}(?::\d{2}|\s*h)/i.test(fala) ? "Evento: " + fala.replace(/\s+[àa]s\s+/i," ") : null);
    if (forcarPrevia && !comando) {
      await say(`Transcrição: “${texto.slice(0,500)}”\nNão identifiquei uma ação suportada. Envie por texto, por exemplo: *tenho dentista amanhã 14h*. Nada foi registrado.`);
      return { consumido: true };
    }
    if (!comando) return { consumido: false };
    const previa = preparar(comando);
    if (!previa) {
      await say("Não consegui determinar os dados com segurança. Exemplos: *tenho dentista amanhã 14h*, *preciso comprar material amanhã*, *gastei 50 no mercado no pix*. Informe uma única ação por mensagem.");
      return { consumido: true };
    }
    await this.prisma.$executeRaw`
      INSERT INTO whatsapp_previas(user_id,instancia,conversa,comando)
      VALUES (${userId},${instancia},${conversa},${previa.comando})
      ON CONFLICT(user_id,instancia,conversa) DO UPDATE SET comando=EXCLUDED.comando,
        expira_em=CURRENT_TIMESTAMP+INTERVAL '10 minutes'
    `;
    await say(`Confira antes de registrar:\n${previa.resumo}\n\n*1* confirmar · *2* corrigir · *0* cancelar\nExpira em 10 minutos. Trocar de contexto cancela o rascunho.`);
    return { consumido: true };
  }
}
