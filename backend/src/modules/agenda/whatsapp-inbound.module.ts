import {
  Module, Controller, Post, Body, Query, Headers, HttpCode, HttpStatus, Logger, Injectable,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { WhatsAppService } from "../notifications/whatsapp.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuthModule } from "../auth/auth.module";
import { AuthService } from "../auth/auth.service";
import { registrarIndicacao, montarMensagemAtivacao, codigoIndicacao } from "../referral/referral.helpers";
import { createHash } from "crypto";

// Código de vínculo do WhatsApp (mostrado no Perfil). Determinístico por usuário
// e não adivinhável sem o segredo — quem manda "VINCULAR <código>" prova ser o dono.
export function codigoVinculoWhatsapp(userId: string): string {
  const secret = process.env.WHATSAPP_INBOUND_SECRET || process.env.JWT_SECRET || "orkiestri";
  return createHash("sha256").update(userId + "|" + secret).digest("hex").slice(0, 6).toUpperCase();
}

// ── Parser do comando ─────────────────────────────────────────────────────────
//
// Aceita mensagens que começam com evento/agenda/agendar/compromisso e extrai
// título + data + hora do resto, tolerando variações. Ex.:
//   "Evento: Reunião com cliente 27/08 14:00"
//   "Agenda Dentista amanhã 09h"
//   "Agendar Almoço hoje 12:30"
// Sem hora -> evento de dia inteiro. Sem data -> hoje.

type Parsed = { titulo: string; inicio: Date; fim: Date | null; diaTodo: boolean; recorrencia: string | null; recorrenciaFim: Date | null };

export const RECOR_LABEL: Record<string, string> = {
  DIARIA: "todo dia", SEMANAL: "toda semana", QUINZENAL: "a cada 2 semanas", MENSAL: "todo mês",
};

// Tutorial enviado logo após vincular o WhatsApp — simples, com exemplos prontos.
const TUTORIAL_WHATSAPP =
  "🎉 *Tudo pronto!* Agora você anota compromissos na sua agenda só mandando uma mensagem aqui 📲\n\n" +
  "✍️ *Como criar:* escreva *Evento:* e diga o quê, o dia e a hora.\n\n" +
  "📌 *Exemplos (é só copiar e trocar):*\n" +
  "• Evento: Dentista amanhã 14h\n" +
  "• Evento: Reunião 30/08 09:30\n" +
  "• Evento: Almoço hoje 12h\n\n" +
  "🔁 *Para repetir:*\n" +
  "• Evento: Academia 18h todo dia por 30 dias\n" +
  "• Evento: Reunião 10h toda semana até 31/12\n\n" +
  "⏰ Pode usar *hoje*, *amanhã* ou a data (dia/mês), e horas como *9h* ou *14:30*.\n\n" +
  "✅ Toda vez que eu criar, te aviso aqui na hora.\n\n" +
  "💸 *Tem acesso ao Financeiro?* Registre uma despesa: *Custo: Energia 350 vence 10/09*\n\n" +
  "🎁 Veio por indicação de alguém? Envie o código dele assim: *INDICACAO ORK-XXXXXX*\n\n" +
  "Manda a sua primeira! 😉";

export function parseComandoEvento(texto: string, agora: Date): Parsed | "sem_data_hora" | null {
  const t = (texto || "").trim();
  const mKey = t.match(/^\s*(evento|agenda|agendar|compromisso|marcar)\b[:\-–]?\s*/i);
  if (!mKey) return null; // não é um comando — ignora silenciosamente
  let resto = t.slice(mKey[0].length).trim();
  if (!resto) return "sem_data_hora";

  // ── Recorrência ── (detecta e REMOVE antes de datas/horas, para não confundir)
  let recorrencia: string | null = null;
  let recFimData: Date | null = null;      // "até <data>"
  let porQtd: number | null = null, porUnidade: string | null = null; // "por N <unidade>"
  const stripRe = (re: RegExp) => { resto = resto.replace(re, " "); };
  if (/\b(a cada (2|duas) semanas|quinzenal(mente)?|cada 15 dias)\b/i.test(resto)) { recorrencia = "QUINZENAL"; stripRe(/\b(a cada (2|duas) semanas|quinzenal(mente)?|cada 15 dias)\b/i); }
  else if (/\b(toda semana|semanal(mente)?)\b/i.test(resto)) { recorrencia = "SEMANAL"; stripRe(/\b(toda semana|semanal(mente)?)\b/i); }
  else if (/\b(todo m[eê]s|mensal(mente)?)\b/i.test(resto)) { recorrencia = "MENSAL"; stripRe(/\b(todo m[eê]s|mensal(mente)?)\b/i); }
  else if (/\b(todo dia|di[aá]ri(a|amente)|recorrente)\b/i.test(resto)) { recorrencia = "DIARIA"; stripRe(/\b(todo dia|di[aá]ri(a|amente)|recorrente)\b/i); }
  const mPor = resto.match(/\bpor\s+(\d{1,3})\s*(dias?|semanas?|m[eê]s(?:es)?|vezes|x)\b/i);
  if (mPor) { porQtd = +mPor[1]; porUnidade = mPor[2].toLowerCase(); stripRe(new RegExp(mPor[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")); if (!recorrencia) recorrencia = "DIARIA"; }
  // Forma "recorrente 30 dias" (sem "por"): só quando já há recorrência, para não
  // confundir com um número qualquer do título.
  if (recorrencia && !mPor) {
    const mBare = resto.match(/\b(\d{1,3})\s*(dias?|semanas?|m[eê]s(?:es)?)\b/i);
    if (mBare) { porQtd = +mBare[1]; porUnidade = mBare[2].toLowerCase(); stripRe(new RegExp(mBare[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")); }
  }
  const mAte = resto.match(/\bat[eé]\s+(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/i);
  if (mAte) {
    const yy = mAte[3] ? (mAte[3].length === 2 ? 2000 + +mAte[3] : +mAte[3]) : agora.getFullYear();
    recFimData = new Date(yy, +mAte[2] - 1, +mAte[1], 23, 59, 59);
    stripRe(new RegExp(mAte[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    if (!recorrencia) recorrencia = "DIARIA";
  }
  stripRe(/\ba partir d[eo]\s+/i); // só o prefixo; a data em si é pega adiante

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

  // Fim da recorrência: "até <data>" > "por N <unidade>" > padrão 3 meses.
  let recorrenciaFim: Date | null = null;
  if (recorrencia) {
    const passo: Record<string, number> = { DIARIA: 1, SEMANAL: 7, QUINZENAL: 14 };
    if (recFimData) {
      recorrenciaFim = recFimData;
    } else if (porQtd && porUnidade) {
      const b = new Date(inicio);
      if (/vezes|^x$/.test(porUnidade)) {            // N ocorrências
        if (recorrencia === "MENSAL") b.setMonth(b.getMonth() + (porQtd - 1));
        else b.setDate(b.getDate() + (porQtd - 1) * (passo[recorrencia] || 1));
      } else if (/semana/.test(porUnidade)) b.setDate(b.getDate() + porQtd * 7);
      else if (/m[eê]s/.test(porUnidade)) b.setMonth(b.getMonth() + porQtd);
      else b.setDate(b.getDate() + porQtd);          // dias
      recorrenciaFim = b;
    } else {
      const b = new Date(inicio); b.setMonth(b.getMonth() + 3); recorrenciaFim = b; // padrão 3 meses
    }
  }

  return { titulo, inicio, fim, diaTodo, recorrencia, recorrenciaFim };
}

// ── Parser do comando de CUSTO (despesa → conta a pagar) ──────────────────────
//
// No mesmo espírito do parser de evento: a pessoa manda uma linha e vira um
// lançamento no Financeiro (contas_pagar). Ex.:
//   "Custo: Energia 350,00 vence 10/09"
//   "Despesa Almoço 45"
//   "Conta: Internet R$ 100 vence amanhã"
// Descrição = o texto que sobra; valor em formato BR; vencimento opcional (padrão hoje).

type ParsedCusto = { descricao: string; valor: number; vencimento: Date };

// Interpreta um valor monetário em formato BR (e tolera o ponto-decimal en):
//   "R$ 1.250,00" → 1250.00 | "350,50" → 350.5 | "1.250" → 1250 | "3.50" → 3.5 | "1500" → 1500
function extrairValorBR(s: string): { valor: number; matchStr: string; index: number } | null {
  const re = /(r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+,\d{1,2}|\d+(?:\.\d{1,2})?|\d+)/ig;
  const todos = Array.from(s.matchAll(re));
  if (!todos.length) return null;
  // O valor costuma vir DEPOIS da descrição, que pode ter números soltos
  // ("Sala 2 aluguel 1500"). Preferimos, nesta ordem: o que tem "R$", o que
  // tem separador decimal/milhar, senão o último número da linha.
  const m = todos.find(x => x[1]) || todos.find(x => /[.,]/.test(x[2])) || todos[todos.length - 1];
  const raw = m[2];
  let valor: number;
  if (raw.includes(".") && raw.includes(",")) {
    valor = parseFloat(raw.replace(/\./g, "").replace(",", "."));      // 1.250,00
  } else if (raw.includes(",")) {
    valor = parseFloat(raw.replace(",", "."));                          // 350,50
  } else if (raw.includes(".")) {
    const parts = raw.split(".");
    const ultimo = parts[parts.length - 1];
    // Vários pontos, ou último grupo de 3 dígitos → separador de milhar (1.250 = 1250).
    // Último grupo de 1–2 dígitos → ponto decimal en (3.50 = 3.5).
    valor = (parts.length > 2 || ultimo.length === 3)
      ? parseFloat(raw.replace(/\./g, ""))
      : parseFloat(raw);
  } else {
    valor = parseFloat(raw);
  }
  if (isNaN(valor) || valor <= 0) return null;
  return { valor, matchStr: m[0], index: m.index ?? s.indexOf(m[0]) };
}

export function parseComandoCusto(texto: string, agora: Date): ParsedCusto | "sem_valor" | null {
  const t = (texto || "").trim();
  const mKey = t.match(/^\s*(custo|despesa|gasto|conta)\b[:\-–]?\s*/i);
  if (!mKey) return null; // não é comando de custo
  let resto = t.slice(mKey[0].length).trim();
  if (!resto) return "sem_valor";

  // ── Vencimento ── (antes do valor, para o dd/mm não ser lido como valor)
  resto = resto.replace(/\bvenc(?:e|er|imento|endo)?\b(?:\s+(?:em|no|dia|ate|at[eé]))?\s*/i, " ");
  let vencimento = new Date(agora); vencimento.setHours(23, 59, 59, 0);
  const low = resto.toLowerCase();
  if (/\bdepois de amanh[aã]/.test(low)) {
    vencimento.setDate(vencimento.getDate() + 2); resto = resto.replace(/depois de amanh[aã]/i, " ");
  } else if (/\bamanh[aã]/.test(low)) {
    vencimento.setDate(vencimento.getDate() + 1); resto = resto.replace(/amanh[aã]/i, " ");
  } else if (/\bhoje\b/.test(low)) {
    resto = resto.replace(/\bhoje\b/i, " ");
  } else {
    const mData = resto.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/); // dd/mm (sem "." p/ não pegar 1.250)
    if (mData) {
      const dia = +mData[1], mes = +mData[2] - 1;
      const ano = mData[3] ? (mData[3].length === 2 ? 2000 + +mData[3] : +mData[3]) : agora.getFullYear();
      if (mes >= 0 && mes <= 11 && dia >= 1 && dia <= 31) {
        const d = new Date(ano, mes, dia, 23, 59, 59, 0);
        if (!isNaN(d.getTime())) { vencimento = d; resto = resto.replace(mData[0], " "); }
      }
    }
  }

  // ── Valor ──
  const v = extrairValorBR(resto);
  if (!v) return "sem_valor";
  resto = resto.slice(0, v.index) + " " + resto.slice(v.index + v.matchStr.length);

  // ── Descrição ── (o que sobra, sem "R$"/"reais" e pontuação solta)
  let descricao = resto
    .replace(/\br\$/ig, " ")
    .replace(/\breais?\b/ig, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,;:\-–]+|[\s,;:\-–]+$/g, "")
    .trim();
  if (!descricao) descricao = "Despesa";

  return { descricao, valor: v.valor, vencimento };
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

  constructor(private prisma: PrismaService, private wa: WhatsAppService, private auth: AuthService) {}

  private fmtData(d: Date): string {
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  // Identifica o usuário DONO daquele chat: primeiro pelo LID vinculado, depois
  // (só quando o chat é @s.whatsapp.net) pelo telefone cadastrado — assim o
  // caso "mandar para si mesmo" com número próprio ainda funciona sem vínculo.
  private async identificar(remoteJid: string): Promise<{ id: string; organizationId: string; nome: string; telefone: string | null } | null> {
    const idPart = remoteJid.split("@")[0];
    const byLid = await this.prisma.userProfile.findFirst({
      where: { whatsappLid: idPart } as any,
      select: { whatsapp: true, user: { select: { id: true, organizationId: true, ativo: true, nome: true } } },
    });
    if (byLid?.user?.ativo) return { ...byLid.user, telefone: byLid.whatsapp };
    if (remoteJid.endsWith("@s.whatsapp.net")) {
      const perfis = await this.prisma.userProfile.findMany({
        where: { NOT: { whatsapp: null } },
        select: { whatsapp: true, user: { select: { id: true, organizationId: true, ativo: true, nome: true } } },
      });
      const p = perfis.find(x => x.user?.ativo && telefoneBate(idPart, x.whatsapp));
      if (p?.user) return { ...p.user, telefone: p.whatsapp };
    }
    return null;
  }

  // Responde à pessoa. O Evolution v1.8.2 NÃO envia para "@lid" (400 exists:false),
  // então respondemos pelo TELEFONE cadastrado (chega na mesma conversa). Sem
  // telefone, caímos no jid cru (best-effort, pode falhar em @lid).
  private async responder(remoteJid: string, telefone: string | null, orgId: string | null, inst: string, msg: string) {
    if (telefone && orgId) { await this.wa.sendMessageForOrg(orgId, telefone, msg).catch(() => {}); return; }
    if (telefone) { await this.wa.sendMessage(telefone, msg, inst).catch(() => {}); return; }
    await this.wa.sendToJid(remoteJid, msg, inst).catch(() => {});
  }

  // "VINCULAR <código>" — liga aquele chat (LID/telefone) à conta cujo código bate.
  private async vincular(remoteJid: string, codigo: string, inst: string) {
    const idPart = remoteJid.split("@")[0];
    const users = await this.prisma.user.findMany({
      where: { ativo: true },
      select: { id: true, nome: true, organizationId: true, profile: { select: { whatsapp: true } } },
    });
    const alvo = users.find(u => codigoVinculoWhatsapp(u.id) === codigo);
    if (!alvo) {
      await this.wa.sendToJid(remoteJid, "🤖 Código inválido. Confira o código em *Perfil → Criar evento pelo WhatsApp* no sistema.", inst).catch(() => {});
      return;
    }
    await this.prisma.userProfile.upsert({
      where: { userId: alvo.id },
      update: { whatsappLid: idPart } as any,
      create: { userId: alvo.id, whatsappLid: idPart } as any,
    });
    this.logger.log(`WhatsApp vinculado: user=${alvo.id} lid=${idPart}`);
    const tel = alvo.profile?.whatsapp ?? null;
    await this.responder(remoteJid, tel, alvo.organizationId, inst,
      `✅ *WhatsApp vinculado à conta de ${alvo.nome}!*`);
    // Tutorial logo em seguida (2º envio).
    await this.responder(remoteJid, tel, alvo.organizationId, inst, TUTORIAL_WHATSAPP);
  }

  // "INDICACAO <código>" — o próprio usuário (já vinculado) diz que veio pela
  // indicação de alguém. Registra o vínculo e manda a mensagem de ativação.
  private async registrarIndicacaoWhats(remoteJid: string, codigo: string, inst: string) {
    const user = await this.identificar(remoteJid);
    if (!user) {
      await this.wa.sendToJid(remoteJid,
        "🤖 Para registrar a indicação, primeiro vincule o seu WhatsApp: envie *VINCULAR <seu código>* (o código aparece no seu Perfil → Criar evento pelo WhatsApp).", inst).catch(() => {});
      return;
    }
    const nome = await registrarIndicacao(this.prisma, codigo, user.id).catch(() => null);
    if (!nome) {
      await this.wa.sendToJid(remoteJid,
        "🤖 Não consegui registrar essa indicação. Confira o código (ex.: *INDICACAO ORK-XXXXXX*) — pode ser inválido, o seu próprio código, ou você já registrou uma indicação antes.", inst).catch(() => {});
      return;
    }
    this.logger.log(`Indicação via WhatsApp: indicado=${user.id} por="${nome}"`);
    await this.wa.sendToJid(remoteJid, montarMensagemAtivacao(nome, codigoIndicacao(user.id)), inst).catch(() => {});
  }

  // Valor em R$ formatado (1250.5 → "1.250,50").
  private fmtValor(v: number): string {
    return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // "Custo: <descrição> <valor> [vence <data>]" — cria uma conta a pagar no
  // Financeiro. DIFERENTE do evento (que qualquer um cria): o Financeiro é
  // sensível, então só registra quem tem acesso ao módulo.
  private async registrarCusto(remoteJid: string, parsed: ParsedCusto, inst: string) {
    const user = await this.identificar(remoteJid);
    if (!user) {
      await this.wa.sendToJid(remoteJid,
        "🤖 Seu WhatsApp ainda não está vinculado a uma conta. No sistema, abra *Perfil → Criar evento pelo WhatsApp* e envie aqui o código mostrado (ex.: *VINCULAR ABC123*).", inst).catch(() => {});
      return;
    }

    // Gate de permissão: precisa poder gerenciar o Financeiro (mesma exigência
    // do endpoint que cria contas a pagar na tela).
    const perms = await this.auth.resolvePermissions(user.id).catch(() => [] as string[]);
    const podeFinanceiro = perms.includes("*") || perms.includes("financeiro:gerenciar");
    if (!podeFinanceiro) {
      await this.responder(remoteJid, user.telefone, user.organizationId, inst,
        "🤖 Você não tem acesso ao *Financeiro* para registrar custos. Fale com o administrador.");
      return;
    }

    // Número sequencial legível por organização (WA-0001, WA-0002, …). Não há
    // constraint de unicidade em `numero`; a colisão em envio duplicado é inócua.
    const jaCriados = await (this.prisma as any).contaPagar.count({
      where: { organizationId: user.organizationId, numero: { startsWith: "WA-" } },
    }).catch(() => 0);
    const numero = "WA-" + String(jaCriados + 1).padStart(4, "0");

    await (this.prisma as any).contaPagar.create({
      data: {
        organizationId: user.organizationId,
        fornecedorNome: parsed.descricao,
        numero,
        tipo: "DESPESA",
        dataEmissao: new Date(),
        dataVencto: parsed.vencimento,
        dataVenctoReal: parsed.vencimento,
        valorOriginal: parsed.valor,
        valorAVencerNominal: parsed.valor,
        historico: `WhatsApp: ${parsed.descricao}`,
        observacao: `Registrado via WhatsApp por ${user.nome}`,
      },
    });
    this.logger.log(`Custo criado via WhatsApp: user=${user.id} "${parsed.descricao}" R$${parsed.valor} venc=${parsed.vencimento.toISOString()} num=${numero}`);

    await this.responder(remoteJid, user.telefone, user.organizationId, inst,
      `✅ Custo registrado no Financeiro:\n\n💸 *${parsed.descricao}*\n💰 R$ ${this.fmtValor(parsed.valor)}\n📅 Vence ${parsed.vencimento.toLocaleDateString("pt-BR")}`);
  }

  async processar(body: any): Promise<void> {
    // Evolution v1.8.2 — evento messages.upsert
    const data = Array.isArray(body?.data) ? body.data[0] : body?.data;
    const key = data?.key || {};
    const remoteJid: string = key?.remoteJid || "";
    // Responder SEMPRE pela instância que RECEBEU a mensagem (vem no payload como
    // owner/instance). O default do serviço é "orkestri", que está desconectada —
    // usar ele fazia a confirmação falhar com 500 "Connection Closed".
    const inst: string = data?.owner || body?.instance || "orkestri-default";
    if (!remoteJid || remoteJid.includes("@g.us")) return; // grupo — ignora
    const texto: string = (
      data?.message?.conversation ||
      data?.message?.extendedTextMessage?.text ||
      data?.message?.ephemeralMessage?.message?.extendedTextMessage?.text || ""
    ).trim();

    this.logger.log(`inbound jid=${remoteJid} fromMe=${key?.fromMe} texto="${texto.slice(0, 50)}"`);
    if (!texto) return;

    // ── Vínculo? "VINCULAR <código>" ──
    const mVinc = texto.match(/^vincular\s+([a-z0-9]{4,10})$/i);
    if (mVinc) { await this.vincular(remoteJid, mVinc[1].toUpperCase(), inst); return; }

    // ── Indicação? "INDICACAO ORK-XXXX" ou só "ORK-XXXX" (código sempre tem ORK-). ──
    let codInd: string | null = null;
    const mIndKey = texto.match(/^(?:indica[çc][aã]o|indicado(?: por)?|vim por)\s+(.+)$/i);
    if (mIndKey) codInd = mIndKey[1].trim();
    else if (/^ORK-?[a-z0-9]{4,10}$/i.test(texto)) codInd = texto.trim();
    if (codInd) { await this.registrarIndicacaoWhats(remoteJid, codInd, inst); return; }

    // ── Comando de custo? "Custo: ... <valor> [vence <data>]" ──
    const custo = parseComandoCusto(texto, new Date());
    if (custo === "sem_valor") {
      await this.wa.sendToJid(remoteJid,
        "🤖 Não consegui identificar o valor da despesa. Envie assim:\n\n*Custo: Energia 350,00 vence 10/09*\n\nA data é opcional (padrão hoje).", inst).catch(() => {});
      return;
    }
    if (custo) { await this.registrarCusto(remoteJid, custo, inst); return; }

    // ── Comando de evento? ──
    const parsed = parseComandoEvento(texto, new Date());
    if (parsed === null) return; // não é comando — ignora em silêncio

    // ── Identifica a conta dona deste WhatsApp ──
    const user = await this.identificar(remoteJid);
    if (!user) {
      await this.wa.sendToJid(remoteJid,
        "🤖 Seu WhatsApp ainda não está vinculado a uma conta. No sistema, abra *Perfil → Criar evento pelo WhatsApp* e envie aqui o código mostrado (ex.: *VINCULAR ABC123*).", inst).catch(() => {});
      return;
    }

    if (parsed === "sem_data_hora") {
      await this.responder(remoteJid, user.telefone, user.organizationId, inst,
        "🤖 Não consegui identificar a data/hora. Envie assim:\n\n*Evento: Reunião com cliente 27/08 14:00*\n\nTambém vale _hoje_, _amanhã_ e horários como _9h_ ou _14:30_.");
      return;
    }

    // Cria o evento na agenda da PESSOA que enviou
    await this.prisma.event.create({
      data: {
        titulo: parsed.titulo,
        inicio: parsed.inicio,
        fim: parsed.fim,
        tipo: "COMPROMISSO" as any,
        cor: "#22d3ee",
        diaTodo: parsed.diaTodo,
        recorrencia: parsed.recorrencia as any,
        recorrenciaFim: parsed.recorrenciaFim,
        userId: user.id,
        criadoPorId: user.id,
        organizationId: user.organizationId,
      } as any,
    });
    this.logger.log(`Evento criado via WhatsApp: user=${user.id} "${parsed.titulo}" ${parsed.inicio.toISOString()} rec=${parsed.recorrencia || "-"}`);

    const quando = parsed.diaTodo
      ? parsed.inicio.toLocaleDateString("pt-BR") + " (dia todo)"
      : this.fmtData(parsed.inicio) + (parsed.fim ? ` – ${this.fmtData(parsed.fim)}` : "");
    let msg = `✅ Evento criado na sua agenda:\n\n🗓️ *${parsed.titulo}*\n🕐 ${quando}`;
    if (parsed.recorrencia) {
      const fimTxt = parsed.recorrenciaFim ? parsed.recorrenciaFim.toLocaleDateString("pt-BR") : "";
      msg += `\n🔁 ${RECOR_LABEL[parsed.recorrencia] || parsed.recorrencia}` + (fimTxt ? ` até ${fimTxt}` : "");
    }
    await this.responder(remoteJid, user.telefone, user.organizationId, inst, msg);
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
  imports: [NotificationsModule, AuthModule],
  controllers: [WhatsappInboundController],
  providers: [WhatsappInboundService],
})
export class WhatsappInboundModule {}
