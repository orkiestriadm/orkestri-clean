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

// Mensagem padrão de "ainda não vinculado", reaproveitada em vários comandos.
const NAO_VINCULADO =
  "🤖 Seu WhatsApp ainda não está vinculado a uma conta. No sistema, abra *Perfil → Criar evento pelo WhatsApp* e envie aqui o código mostrado (ex.: *VINCULAR ABC123*).";

// ── Comando /ajuda ──────────────────────────────────────────────────────────
//
// Passo a passo pensado para ser seguido por qualquer pessoa — de uma criança
// a um idoso: linguagem simples, um passo por linha, e um exemplo pronto para
// copiar. A parte de dinheiro (Financeiro) só aparece para quem tem acesso, para
// não confundir quem não usa.

function primeiroNome(nome: string): string {
  return (nome || "").trim().split(/\s+/)[0] || "";
}

// Mensagem de ajuda para quem AINDA NÃO vinculou o WhatsApp: o primeiro passo é
// justamente se apresentar ao sistema.
const AJUDA_VINCULAR =
  "😊 *Oi! Eu sou o ajudante do Orkiestri aqui no WhatsApp.*\n\n" +
  "Antes de começar, eu preciso saber quem é você. É rapidinho, e você faz só uma vez:\n\n" +
  "1️⃣ Abra o Orkiestri no computador ou no celular.\n" +
  "2️⃣ Toque no seu *Perfil*.\n" +
  "3️⃣ Procure *Criar evento pelo WhatsApp*. Vai aparecer um *código* (letras e números).\n" +
  "4️⃣ Copie esse código e me mande aqui assim:\n" +
  "👉 *VINCULAR* e o seu código\n" +
  "     (por exemplo: *VINCULAR ABC123*)\n\n" +
  "Assim que fizer isso, eu te ensino todo o resto. 😉";

// Monta o passo a passo mostrando SÓ o que a pessoa pode fazer (pelas permissões
// dela). Assim quem entrou para testar só o Financeiro não vê instruções de
// agenda, e vice-versa.
function montarAjuda(temAgenda: boolean, temGastos: boolean, nome: string): string {
  const nm = primeiroNome(nome);
  let m =
    (nm ? `😊 *Oi, ${nm}!*` : "😊 *Oi!*") +
    " Eu sou o ajudante do Orkiestri aqui no WhatsApp.\n" +
    "É só me mandar uma mensagem. Veja como, bem devagar:\n\n";
  if (temAgenda) {
    m +=
      "🗓️ *PARA MARCAR UM COMPROMISSO*\n" +
      "Escreva a palavra *Evento* e depois diga o quê, o dia e a hora.\n" +
      "Copie a linha abaixo e me mande:\n" +
      "👉 *Evento: Médico amanhã 14h*\n\n" +
      "Pronto! Eu marco na sua agenda e te aviso aqui. ✅\n\n";
  }
  if (temGastos) {
    m +=
      "💸 *PARA ANOTAR UM GASTO*\n" +
      "Diga o que você gastou e quanto — e, se quiser, como pagou.\n" +
      "Copie a linha abaixo e me mande:\n" +
      "👉 *Gasto: Mercado 150 no crédito*\n\n" +
      "Comprou parcelado? *Gasto: TV 2400 crédito 12x*\n" +
      "Errou? Mande *apagar* (tira o último) ou *corrige o último pra 150*. ✅\n\n" +
      "📊 *PARA VER QUANTO GASTOU*\n" +
      "Mande: *Relatório: quanto gastei esse mês*\n" +
      "(dá para pedir por *crédito*, *débito* ou *no total*)\n\n";
    if (!temAgenda) {
      m += "✨ *Mais fácil ainda:* pode mandar só *Mercado 150 crédito* que eu já entendo.\n\n";
    }
  }
  if (!temAgenda && !temGastos) {
    m += "Peça ao administrador para liberar a *Agenda* ou o *Financeiro* para você aproveitar tudo por aqui. 😉\n\n";
  }
  m +=
    "📌 *DICAS FÁCEIS*\n" +
    "• Pode escrever *hoje*, *ontem* ou *amanhã*.\n" +
    "• O dia pode ser *10/09*.\n\n" +
    "❓ Quer ver este passo a passo de novo? É só mandar *ajuda*. 😉";
  return m;
}

// Boas-vindas logo após vincular: o mesmo passo a passo, com uma saudação de
// "tudo pronto" e a dica de indicação.
function montarBoasVindas(temAgenda: boolean, temGastos: boolean, nome: string): string {
  return "🎉 *Tudo pronto!*\n\n" + montarAjuda(temAgenda, temGastos, nome) +
    "\n\n🎁 Veio por indicação de alguém? Envie o código dele assim: *INDICACAO ORK-XXXXXX*";
}

// Permissões → o que a pessoa pode fazer pelo WhatsApp. Agenda é base (quase todo
// mundo tem); Gastos exige acesso de gerenciar o Financeiro (o mesmo do trial one-finance).
function podeAgenda(perms: string[]): boolean { return perms.includes("*") || perms.includes("agenda:criar"); }
function podeGastos(perms: string[]): boolean { return perms.includes("*") || perms.includes("financeiro:gerenciar"); }

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

export type FormaPagamento = "CREDITO" | "DEBITO" | "PIX" | "DINHEIRO" | "BOLETO" | "NAO_INFORMADO";

export const FORMA_LABEL: Record<FormaPagamento, string> = {
  CREDITO: "crédito", DEBITO: "débito", PIX: "pix", DINHEIRO: "dinheiro", BOLETO: "boleto", NAO_INFORMADO: "não informada",
};

export type ParsedGasto = {
  descricao: string; valor: number; formaPagamento: FormaPagamento;
  parcelas: number; valorParcela: number | null; dataGasto: Date; categoria: string | null;
};

// Categoria automática por palavra-chave — simples, sem IA. Só um empurrão; a
// pessoa ajusta na tela depois se quiser.
const CATEGORIAS: Array<[RegExp, string]> = [
  [/\b(combust[ií]vel|gasolina|[aá]lcool|etanol|diesel|abastec)/i, "Combustível"],
  [/\b(mercado|supermercado|feira|hortifruti|a[çc]ougue)/i, "Mercado"],
  [/\b(almo[çc]o|jantar|janta|lanche|restaurante|comida|padaria|caf[eé]|pizza|ifood|bar)/i, "Alimentação"],
  [/\b(uber|99|t[aá]xi|[oô]nibus|metr[oô]|passagem|estacionamento|ped[aá]gio)/i, "Transporte"],
  [/\b(farm[aá]cia|rem[eé]dio|m[eé]dico|consulta|exame|hospital|dentista)/i, "Saúde"],
  [/\b(academia|gym|crossfit|personal)/i, "Academia"],
  [/\b(luz|energia|[aá]gua|internet|telefone|celular|conta de)/i, "Contas"],
  [/\b(roupa|cal[çc]a|camisa|t[eê]nis|sapato|vestido|loja)/i, "Roupas"],
  [/\b(netflix|spotify|assinatura|prime|hbo|disney)/i, "Assinaturas"],
  [/\b(escola|faculdade|curso|livro|material escolar)/i, "Educação"],
];
function categoriaDe(texto: string): string | null {
  for (const [re, cat] of CATEGORIAS) if (re.test(texto)) return cat;
  return null;
}

// ── Parser do comando de GASTO (despesa pessoal → tabela `gastos`) ────────────
//
// A pessoa manda uma linha e vira um gasto DELA (só ela vê). Ex.:
//   "Gasto: Combustível 200 crédito à vista"
//   "Gasto: TV 2400 crédito 12x 10/09"
//   "Gastei 45 no mercado no débito"
// Extrai descrição + valor (BR) + forma de pagamento + parcelas + data (padrão hoje).
// `exigePrefixo=false` aceita o texto cru (usado só para quem tem apenas Gastos).
export function parseComandoGasto(texto: string, agora: Date, exigePrefixo = true): ParsedGasto | "sem_valor" | null {
  const t = (texto || "").trim();
  const mKey = t.match(/^\s*(gastos?|gastei|despesa|comprei|paguei)\b[:\-–]?\s*/i);
  let resto: string;
  if (mKey) resto = t.slice(mKey[0].length).trim();
  else if (exigePrefixo) return null;   // sem palavra-chave e exigindo prefixo → não é comando
  else resto = t;                        // modo sem prefixo (usuário só-Gastos)
  if (!resto) return exigePrefixo ? "sem_valor" : null;

  // ── Forma de pagamento ── (débito antes de crédito; "cartão" sozinho = crédito)
  let forma: FormaPagamento = "NAO_INFORMADO";
  const formas: Array<[RegExp, FormaPagamento]> = [
    [/\b(cart[aã]o de d[eé]bito|d[eé]bito)\b/i, "DEBITO"],
    [/\b(cart[aã]o de cr[eé]dito|cr[eé]dito|no cart[aã]o|cart[aã]o)\b/i, "CREDITO"],
    [/\bpix\b/i, "PIX"],
    [/\b(dinheiro|esp[eé]cie|em m[aã]os)\b/i, "DINHEIRO"],
    [/\bboleto\b/i, "BOLETO"],
  ];
  for (const [re, f] of formas) { if (re.test(resto)) { forma = f; resto = resto.replace(re, " "); break; } }

  // ── Parcelas ── ("12x", "em 12 vezes", "parcelado em 12"; "à vista" = 1).
  // Antes do valor, para o "12" de "12x" não ser lido como valor.
  let parcelas = 1;
  const mParc = resto.match(/\b(?:em\s+)?(\d{1,2})\s*(?:x|vezes)\b/i)
             || resto.match(/\bparcelad[oa]\s+em\s+(\d{1,2})\b/i);
  if (mParc) { parcelas = Math.max(1, +mParc[1]); resto = resto.replace(mParc[0], " "); }
  // "à vista": sem \b antes do "à" — é não-ASCII e não forma boundary (igual "amanhã").
  resto = resto.replace(/(?:^|\s)[àa]\s*vista\b/ig, " ").replace(/\bavista\b/ig, " ");

  // ── Data do gasto ── (padrão hoje; aceita ontem/anteontem/amanhã/dd/mm)
  let dataGasto = new Date(agora); dataGasto.setHours(12, 0, 0, 0);
  const low = resto.toLowerCase();
  if (/\banteontem\b/.test(low)) { dataGasto.setDate(dataGasto.getDate() - 2); resto = resto.replace(/anteontem/i, " "); }
  else if (/\bontem\b/.test(low)) { dataGasto.setDate(dataGasto.getDate() - 1); resto = resto.replace(/ontem/i, " "); }
  else if (/\bhoje\b/.test(low)) { resto = resto.replace(/hoje/i, " "); }
  else if (/\bamanh[aã]/.test(low)) { dataGasto.setDate(dataGasto.getDate() + 1); resto = resto.replace(/amanh[aã]/i, " "); }
  else {
    const mData = resto.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/); // dd/mm (sem "." p/ não pegar 1.250)
    if (mData) {
      const dia = +mData[1], mes = +mData[2] - 1;
      const ano = mData[3] ? (mData[3].length === 2 ? 2000 + +mData[3] : +mData[3]) : agora.getFullYear();
      if (mes >= 0 && mes <= 11 && dia >= 1 && dia <= 31) {
        const d = new Date(ano, mes, dia, 12, 0, 0, 0);
        if (!isNaN(d.getTime())) { dataGasto = d; resto = resto.replace(mData[0], " "); }
      }
    }
  }

  // ── Valor ── (por último: parcelas e data já saíram, sobra o total)
  const v = extrairValorBR(resto);
  if (!v) return exigePrefixo ? "sem_valor" : null;
  resto = resto.slice(0, v.index) + " " + resto.slice(v.index + v.matchStr.length);

  // Categoria a partir do que sobrou (ainda com as palavras da descrição).
  const categoria = categoriaDe(resto);

  // ── Descrição ── (limpa "R$"/"reais" e conectores soltos no começo/fim)
  let descricao = resto
    .replace(/\br\$/ig, " ")
    .replace(/\breais?\b/ig, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  descricao = descricao
    .replace(/^(no|na|de|do|da|em|com|pra|para|por)\s+/i, "")
    .replace(/\s+(no|na|de|do|da|em|com|pra|para|por)$/i, "")
    .replace(/^[\s,;:\-–]+|[\s,;:\-–]+$/g, "")
    .trim();
  if (/^(no|na|de|do|da|em|com|pra|para|por)$/i.test(descricao)) descricao = ""; // sobrou só um conector
  if (!descricao) descricao = "Gasto";

  const valorParcela = parcelas > 1 ? Math.round((v.valor / parcelas) * 100) / 100 : null;
  return { descricao, valor: v.valor, formaPagamento: forma, parcelas, valorParcela, dataGasto, categoria };
}

// ── Parser do comando de RELATÓRIO (consulta de gastos) ───────────────────────
//
//   "Relatório: quanto gastei esse mês"
//   "Relatório no crédito esse mês"
//   "Quanto gastei essa semana no débito"
// Reconhece período (padrão: este mês) e forma de pagamento (padrão: total).
export type ParsedRelatorio = { inicio: Date; fim: Date; label: string; forma: FormaPagamento | "TOTAL" };

export function parseComandoRelatorio(texto: string, agora: Date): ParsedRelatorio | null {
  const t = (texto || "").trim();
  const ehRelatorio = /^\s*\/?(relat[oó]rio|resumo)\b/i.test(t) || /\bquanto\s+(eu\s+)?gast(?:ei|o)\b/i.test(t);
  if (!ehRelatorio) return null;
  const low = t.toLowerCase();

  const y = agora.getFullYear(), mo = agora.getMonth(), d = agora.getDate();
  let inicio: Date, fim: Date, label: string;
  if (/\bhoje\b/.test(low)) {
    inicio = new Date(y, mo, d, 0, 0, 0, 0); fim = new Date(y, mo, d, 23, 59, 59, 999); label = "hoje";
  } else if (/\bontem\b/.test(low)) {
    const on = new Date(y, mo, d - 1);
    inicio = new Date(on.getFullYear(), on.getMonth(), on.getDate(), 0, 0, 0, 0);
    fim = new Date(on.getFullYear(), on.getMonth(), on.getDate(), 23, 59, 59, 999); label = "ontem";
  } else if (/\bsemana\b/.test(low)) {
    const ini = new Date(y, mo, d - 6);
    inicio = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate(), 0, 0, 0, 0);
    fim = new Date(y, mo, d, 23, 59, 59, 999); label = "últimos 7 dias";
  } else if (/\bm[eê]s passado\b/.test(low)) {
    inicio = new Date(y, mo - 1, 1, 0, 0, 0, 0); fim = new Date(y, mo, 0, 23, 59, 59, 999); label = "mês passado";
  } else {
    inicio = new Date(y, mo, 1, 0, 0, 0, 0); fim = new Date(y, mo + 1, 0, 23, 59, 59, 999); label = "este mês";
  }

  let forma: FormaPagamento | "TOTAL" = "TOTAL";
  if (/\bd[eé]bito\b/.test(low)) forma = "DEBITO";
  else if (/\bcr[eé]dito\b|\bcart[aã]o\b/.test(low)) forma = "CREDITO";
  else if (/\bpix\b/.test(low)) forma = "PIX";
  else if (/\b(dinheiro|esp[eé]cie)\b/.test(low)) forma = "DINHEIRO";
  else if (/\bboleto\b/.test(low)) forma = "BOLETO";

  return { inicio, fim, label, forma };
}

// Detecta forma de pagamento num texto (sem remover) — usado na correção.
function detectarForma(s: string): FormaPagamento | null {
  const formas: Array<[RegExp, FormaPagamento]> = [
    [/\b(cart[aã]o de d[eé]bito|d[eé]bito)\b/i, "DEBITO"],
    [/\b(cart[aã]o de cr[eé]dito|cr[eé]dito|no cart[aã]o|cart[aã]o)\b/i, "CREDITO"],
    [/\bpix\b/i, "PIX"],
    [/\b(dinheiro|esp[eé]cie|em m[aã]os)\b/i, "DINHEIRO"],
    [/\bboleto\b/i, "BOLETO"],
  ];
  for (const [re, f] of formas) if (re.test(s)) return f;
  return null;
}

// ── Parser do comando de CORREÇÃO (mexe no ÚLTIMO gasto) ──────────────────────
//
//   "Corrige o último para 150"  → muda o valor
//   "O último foi no pix"        → muda a forma
//   "Na verdade foi ontem"       → muda a data
//   "Muda a categoria pra saúde" → muda a categoria
// Só age se reconhecer a intenção de correção E pelo menos um campo a mudar.
export type ParsedCorrecao = { valor?: number; forma?: FormaPagamento; dataGasto?: Date; categoria?: string };

export function parseComandoCorrigir(texto: string, agora: Date): ParsedCorrecao | null {
  const t = (texto || "").trim();
  // Não interpretar comandos explícitos (novo gasto, evento, relatório) como correção.
  if (/^\s*(gastos?|gastei|despesa|comprei|paguei|evento|agenda|agendar|compromisso|marcar|relat[oó]rio|resumo)\b/i.test(t)) return null;
  // Exige um sinal claro de correção. Sem \b antes de "último" — o "ú" é não-ASCII
  // e não forma boundary (mesma pegadinha de "amanhã"/"à vista").
  const intenc = /\b(corrig\w*|na verdade|era\s+pra)\b/i.test(t) || /[uú]ltim[oa]s?/i.test(t);
  if (!intenc) return null;

  const mud: ParsedCorrecao = {};

  const forma = detectarForma(t);
  if (forma) mud.forma = forma;

  const low = t.toLowerCase();
  if (/\banteontem\b/.test(low)) { const d = new Date(agora); d.setDate(d.getDate() - 2); d.setHours(12, 0, 0, 0); mud.dataGasto = d; }
  else if (/\bontem\b/.test(low)) { const d = new Date(agora); d.setDate(d.getDate() - 1); d.setHours(12, 0, 0, 0); mud.dataGasto = d; }
  else if (/\bhoje\b/.test(low)) { const d = new Date(agora); d.setHours(12, 0, 0, 0); mud.dataGasto = d; }
  else {
    const mData = t.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
    if (mData) {
      const dia = +mData[1], mes = +mData[2] - 1;
      const ano = mData[3] ? (mData[3].length === 2 ? 2000 + +mData[3] : +mData[3]) : agora.getFullYear();
      if (mes >= 0 && mes <= 11 && dia >= 1 && dia <= 31) {
        const d = new Date(ano, mes, dia, 12, 0, 0, 0);
        if (!isNaN(d.getTime())) mud.dataGasto = d;
      }
    }
  }

  const mCat = t.match(/categoria\b.*?(?:\bpra\b|\bpara\b|\bde\b|\bé\b|\beh\b|:)\s*([a-zà-ú]{3,})/i);
  if (mCat) mud.categoria = mCat[1].trim().replace(/^\w/, c => c.toUpperCase());

  // Valor: só quando não é uma linha de data pura. extrairValorBR pega o número.
  const semData = mud.dataGasto ? t.replace(/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/, " ") : t;
  const v = extrairValorBR(semData);
  if (v) mud.valor = v.valor;

  return Object.keys(mud).length ? mud : null;
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
    // Tutorial logo em seguida (2º envio), mostrando SÓ o que a conta pode fazer.
    const perms = await this.auth.resolvePermissions(alvo.id).catch(() => [] as string[]);
    await this.responder(remoteJid, tel, alvo.organizationId, inst,
      montarBoasVindas(podeAgenda(perms), podeGastos(perms), alvo.nome));
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

  // "/ajuda" (ou "ajuda"/"menu") — manda o passo a passo de uso pelo WhatsApp.
  // Funciona mesmo sem vínculo (é justamente quem mais precisa de ajuda). Quem
  // não está vinculado recebe o passo a passo para se conectar; quem está,
  // recebe o tutorial — com a parte de Financeiro só se tiver acesso.
  private async enviarAjuda(remoteJid: string, inst: string) {
    const user = await this.identificar(remoteJid);
    if (!user) {
      await this.wa.sendToJid(remoteJid, AJUDA_VINCULAR, inst).catch(() => {});
      return;
    }
    const perms = await this.auth.resolvePermissions(user.id).catch(() => [] as string[]);
    await this.responder(remoteJid, user.telefone, user.organizationId, inst,
      montarAjuda(podeAgenda(perms), podeGastos(perms), user.nome));
  }

  // Valor em R$ formatado (1250.5 → "1.250,50").
  private fmtValor(v: number): string {
    return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private podeGastosUser(perms: string[]): boolean { return podeGastos(perms); }

  // "Gasto: <descrição> <valor> [forma] [parcelas] [data]" — cria um gasto PESSOAL.
  // Identifica a conta e delega para criarGasto (que faz o gate e a gravação).
  private async registrarGasto(remoteJid: string, parsed: ParsedGasto, textoOriginal: string, inst: string) {
    const user = await this.identificar(remoteJid);
    if (!user) { await this.wa.sendToJid(remoteJid, NAO_VINCULADO, inst).catch(() => {}); return; }
    await this.criarGasto(user, parsed, textoOriginal, remoteJid, inst);
  }

  // Grava o gasto do usuário (só ele vê) e confirma. Gate: precisa poder gerenciar
  // o Financeiro (o trial one-finance já tem). Chamado tanto pelo comando com
  // prefixo quanto pelo texto cru de quem só usa Gastos.
  private async criarGasto(
    user: { id: string; organizationId: string; nome: string; telefone: string | null },
    parsed: ParsedGasto, textoOriginal: string, remoteJid: string, inst: string,
  ) {
    const perms = await this.auth.resolvePermissions(user.id).catch(() => [] as string[]);
    if (!this.podeGastosUser(perms)) {
      await this.responder(remoteJid, user.telefone, user.organizationId, inst,
        "🤖 Você ainda não tem acesso para anotar gastos. Fale com o administrador.");
      return;
    }

    await (this.prisma as any).gasto.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        descricao: parsed.descricao,
        categoria: parsed.categoria,
        valor: parsed.valor,
        formaPagamento: parsed.formaPagamento,
        parcelas: parsed.parcelas,
        valorParcela: parsed.valorParcela,
        dataGasto: parsed.dataGasto,
        origem: "WHATSAPP",
        mensagemOriginal: (textoOriginal || "").slice(0, 500),
      },
    });
    this.logger.log(`Gasto criado via WhatsApp: user=${user.id} "${parsed.descricao}" R$${parsed.valor} ${parsed.formaPagamento} ${parsed.parcelas}x`);

    const cat = parsed.categoria ? `  _(${parsed.categoria})_` : "";
    const formaTxt = FORMA_LABEL[parsed.formaPagamento];
    const formaCap = formaTxt.charAt(0).toUpperCase() + formaTxt.slice(1);
    const parcTxt = parsed.parcelas > 1 && parsed.valorParcela != null
      ? `${parsed.parcelas}x de R$ ${this.fmtValor(parsed.valorParcela)}`
      : "à vista";
    await this.responder(remoteJid, user.telefone, user.organizationId, inst,
      `✅ Gasto anotado:\n\n` +
      `💸 *${parsed.descricao}*${cat}\n` +
      `💰 R$ ${this.fmtValor(parsed.valor)}\n` +
      `💳 ${formaCap} · ${parcTxt}\n` +
      `📅 ${parsed.dataGasto.toLocaleDateString("pt-BR")}\n\n` +
      `↩️ Errei? Responda *apagar* que eu removo este.`);
  }

  // "apagar" / "errei" — remove o ÚLTIMO gasto da pessoa (desfazer simples).
  private async apagarUltimoGasto(remoteJid: string, inst: string) {
    const user = await this.identificar(remoteJid);
    if (!user) { await this.wa.sendToJid(remoteJid, NAO_VINCULADO, inst).catch(() => {}); return; }
    const ultimo = await (this.prisma as any).gasto.findFirst({
      where: { organizationId: user.organizationId, userId: user.id },
      orderBy: { criadoEm: "desc" },
    }).catch(() => null);
    if (!ultimo) {
      await this.responder(remoteJid, user.telefone, user.organizationId, inst,
        "🤖 Não achei nenhum gasto seu para apagar.");
      return;
    }
    await (this.prisma as any).gasto.delete({ where: { id: ultimo.id } }).catch(() => {});
    this.logger.log(`Gasto apagado via WhatsApp: user=${user.id} id=${ultimo.id}`);
    await this.responder(remoteJid, user.telefone, user.organizationId, inst,
      `🗑️ Apaguei o último gasto: *${ultimo.descricao}* — R$ ${this.fmtValor(Number(ultimo.valor))}.`);
  }

  // "Corrige o último pra 150" / "o último foi no pix" — ajusta o ÚLTIMO gasto.
  private async corrigirUltimoGasto(remoteJid: string, mud: ParsedCorrecao, inst: string) {
    const user = await this.identificar(remoteJid);
    if (!user) { await this.wa.sendToJid(remoteJid, NAO_VINCULADO, inst).catch(() => {}); return; }
    const perms = await this.auth.resolvePermissions(user.id).catch(() => [] as string[]);
    if (!this.podeGastosUser(perms)) {
      await this.responder(remoteJid, user.telefone, user.organizationId, inst,
        "🤖 Você ainda não tem acesso para mexer nos gastos. Fale com o administrador.");
      return;
    }
    const ultimo = await (this.prisma as any).gasto.findFirst({
      where: { organizationId: user.organizationId, userId: user.id },
      orderBy: { criadoEm: "desc" },
    }).catch(() => null);
    if (!ultimo) {
      await this.responder(remoteJid, user.telefone, user.organizationId, inst, "🤖 Não achei nenhum gasto seu para corrigir.");
      return;
    }

    const data: any = {};
    if (mud.valor != null) {
      data.valor = mud.valor;
      data.valorParcela = ultimo.parcelas > 1 ? Math.round((mud.valor / ultimo.parcelas) * 100) / 100 : null;
    }
    if (mud.forma) data.formaPagamento = mud.forma;
    if (mud.dataGasto) data.dataGasto = mud.dataGasto;
    if (mud.categoria) data.categoria = mud.categoria;

    await (this.prisma as any).gasto.update({ where: { id: ultimo.id }, data }).catch(() => {});
    this.logger.log(`Gasto corrigido via WhatsApp: user=${user.id} id=${ultimo.id} ${JSON.stringify(mud)}`);

    const g = { ...ultimo, ...data };
    const forma = FORMA_LABEL[g.formaPagamento] || g.formaPagamento;
    await this.responder(remoteJid, user.telefone, user.organizationId, inst,
      `✅ Corrigido: *${g.descricao}*\n💰 R$ ${this.fmtValor(Number(g.valor))}\n💳 ${forma.charAt(0).toUpperCase() + forma.slice(1)}\n📅 ${new Date(g.dataGasto).toLocaleDateString("pt-BR")}`);
  }

  // "Relatório: quanto gastei ..." — soma os gastos DA PESSOA no período/forma.
  private async gerarRelatorioWhats(remoteJid: string, rel: ParsedRelatorio, inst: string) {
    const user = await this.identificar(remoteJid);
    if (!user) { await this.wa.sendToJid(remoteJid, NAO_VINCULADO, inst).catch(() => {}); return; }
    const perms = await this.auth.resolvePermissions(user.id).catch(() => [] as string[]);
    if (!this.podeGastosUser(perms)) {
      await this.responder(remoteJid, user.telefone, user.organizationId, inst,
        "🤖 Você ainda não tem acesso aos gastos. Fale com o administrador.");
      return;
    }

    const where: any = {
      organizationId: user.organizationId, userId: user.id,
      dataGasto: { gte: rel.inicio, lte: rel.fim },
      ...(rel.forma !== "TOTAL" ? { formaPagamento: rel.forma } : {}),
    };
    const itens = await (this.prisma as any).gasto.findMany({ where, orderBy: { dataGasto: "asc" } }).catch(() => [] as any[]);

    const tituloForma = rel.forma !== "TOTAL" ? ` no ${FORMA_LABEL[rel.forma]}` : "";
    if (!itens.length) {
      await this.responder(remoteJid, user.telefone, user.organizationId, inst,
        `📊 *Seus gastos — ${rel.label}${tituloForma}*\n\nVocê ainda não anotou nada nesse período. 🙂`);
      return;
    }

    let total = 0;
    const porForma = new Map<string, number>();
    for (const g of itens) {
      const v = Number(g.valor || 0); total += v;
      porForma.set(g.formaPagamento, (porForma.get(g.formaPagamento) || 0) + v);
    }

    // Lista ITEM POR ITEM (com teto, para não estourar a mensagem do WhatsApp).
    const LIMITE = 20;
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const linhasItens = itens.slice(0, LIMITE).map((g: any) => {
      const forma = FORMA_LABEL[g.formaPagamento] || g.formaPagamento;
      const extra = g.parcelas > 1 ? `, ${g.parcelas}x` : "";
      const dia = new Date(g.dataGasto).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      return `• ${dia}  ${g.descricao} — R$ ${this.fmtValor(Number(g.valor || 0))} _(${forma}${extra})_`;
    });
    const maisTxt = itens.length > LIMITE ? `\n_…e mais ${itens.length - LIMITE} lançamento(s)._` : "";

    let msg = `📊 *Seus gastos — ${rel.label}${tituloForma}*\n\n` + linhasItens.join("\n") + maisTxt + "\n";

    // Quebra por forma de pagamento só quando é TOTAL e há mais de uma forma.
    if (rel.forma === "TOTAL" && porForma.size > 1) {
      const ordem: FormaPagamento[] = ["CREDITO", "DEBITO", "PIX", "DINHEIRO", "BOLETO", "NAO_INFORMADO"];
      msg += "\n" + ordem.filter(f => porForma.has(f))
        .map(f => `${cap(FORMA_LABEL[f])}: R$ ${this.fmtValor(porForma.get(f)!)}`).join("\n") + "\n";
    }
    msg += `━━━━━━━━━━\n*Total: R$ ${this.fmtValor(total)}*  _(${itens.length} ${itens.length === 1 ? "lançamento" : "lançamentos"})_`;

    await this.responder(remoteJid, user.telefone, user.organizationId, inst, msg);
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

    // ── Ajuda? "/ajuda", "ajuda", "menu" — passo a passo de uso pelo WhatsApp ──
    if (/^\/?(ajuda|help|menu)\s*[?!.]*$/i.test(texto)) { await this.enviarAjuda(remoteJid, inst); return; }

    // ── Vínculo? "VINCULAR <código>" ──
    const mVinc = texto.match(/^vincular\s+([a-z0-9]{4,10})$/i);
    if (mVinc) { await this.vincular(remoteJid, mVinc[1].toUpperCase(), inst); return; }

    // ── Indicação? "INDICACAO ORK-XXXX" ou só "ORK-XXXX" (código sempre tem ORK-). ──
    let codInd: string | null = null;
    const mIndKey = texto.match(/^(?:indica[çc][aã]o|indicado(?: por)?|vim por)\s+(.+)$/i);
    if (mIndKey) codInd = mIndKey[1].trim();
    else if (/^ORK-?[a-z0-9]{4,10}$/i.test(texto)) codInd = texto.trim();
    if (codInd) { await this.registrarIndicacaoWhats(remoteJid, codInd, inst); return; }

    // ── Relatório? "Relatório: quanto gastei ..." ──
    const rel = parseComandoRelatorio(texto, new Date());
    if (rel) { await this.gerarRelatorioWhats(remoteJid, rel, inst); return; }

    // ── Apagar o último gasto? "apagar" / "errei" ──
    if (/^\/?(apagar|apaga|desfazer|errei)\b[.!]*$/i.test(texto)) { await this.apagarUltimoGasto(remoteJid, inst); return; }

    // ── Corrigir o último gasto? "corrige o último pra 150" / "foi no pix" ──
    const correcao = parseComandoCorrigir(texto, new Date());
    if (correcao) { await this.corrigirUltimoGasto(remoteJid, correcao, inst); return; }

    // ── Comando de gasto? "Gasto: Mercado 150 crédito 12x" ──
    const gasto = parseComandoGasto(texto, new Date(), true);
    if (gasto === "sem_valor") {
      await this.wa.sendToJid(remoteJid,
        "🤖 Não consegui identificar o valor do gasto. Envie assim:\n\n*Gasto: Mercado 150 no crédito*\n\nSe for parcelado: *Gasto: TV 2400 crédito 12x*.", inst).catch(() => {});
      return;
    }
    if (gasto) { await this.registrarGasto(remoteJid, gasto, texto, inst); return; }

    // ── Comando de evento? ──
    const parsed = parseComandoEvento(texto, new Date());
    if (parsed !== null) {
      // ── Identifica a conta dona deste WhatsApp ──
      const user = await this.identificar(remoteJid);
      if (!user) { await this.wa.sendToJid(remoteJid, NAO_VINCULADO, inst).catch(() => {}); return; }

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
      return;
    }

    // ── Nada casou explicitamente. Última chance: quem SÓ tem Gastos (e não a
    //    agenda) pode mandar o gasto SEM a palavra "Gasto:" — ex.: "Mercado 150
    //    crédito". Só tentamos se houver número no texto, para não bater no banco
    //    a cada "bom dia". ──
    if (!/\d/.test(texto)) return;
    const dono = await this.identificar(remoteJid);
    if (!dono) return;
    const perms = await this.auth.resolvePermissions(dono.id).catch(() => [] as string[]);
    if (podeGastos(perms) && !podeAgenda(perms)) {
      const gastoCru = parseComandoGasto(texto, new Date(), false);
      if (gastoCru && gastoCru !== "sem_valor") {
        await this.criarGasto(dono, gastoCru, texto, remoteJid, inst);
      }
    }
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
