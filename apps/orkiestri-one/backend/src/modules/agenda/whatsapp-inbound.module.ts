import { WhatsappRotinaService, comandoRotina } from "./whatsapp-rotina.service";
import { WhatsappOperacaoController } from "./whatsapp-operacao.controller";
import { WhatsappMediaService, WhatsappAnexosController } from "./whatsapp-media.service";
import { WhatsappContextoService, contextoSolicitado, comandoEmpresarial } from "./whatsapp-contexto.service";
import { WhatsappEquipeService } from "./whatsapp-equipe.service";
import { WhatsappLinguagemService } from "./whatsapp-linguagem.service";
import { dataTarefa } from "./whatsapp-rotina-datas";
import { identificarExecucao, acaoUtil, abrirMensagem } from "./whatsapp-execucao";
import { WhatsappInicioService } from "../cadastro-whatsapp/whatsapp-inicio.service";
import { executarMensagemUmaVez, executarComRecibo } from "./whatsapp-recibos";
import { MARCA } from "../../common/marca";
import {
  Module, Controller, Post, Body, Query, Headers, HttpCode, HttpStatus, Logger, Injectable, ServiceUnavailableException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { WhatsAppService } from "../notifications/whatsapp.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuthModule } from "../auth/auth.module";
import { AuthService } from "../auth/auth.service";
import { registrarIndicacao, montarMensagemAtivacao, codigoIndicacao } from "../referral/referral.helpers";
import { ReferralModule, ReferralService } from "../referral/referral.module";
import {
  interpretarRespostaRenovacao, podeRenovar, codigoRenovacao, produtoLabel, faseDaConta, avisoDoCicloAtual,
  proximaValidade, LEMBRETE_ANTECEDENCIA_MS, RespostaRenovacao,
  montarRespostaEfetivou, montarRespostaRenovouMes, montarRespostaRecusou,
  RESPOSTA_JA_RENOVADO, RESPOSTA_PRAZO_ENCERRADO, RESPOSTA_CODIGO_INVALIDO, RESPOSTA_NAO_IDENTIFICADO,
} from "../auth/trial-renovacao";
import { createHash } from "crypto";
import { CadastroWhatsappModule, CadastroWhatsappService, pareceInteresseEmCadastro } from "../cadastro-whatsapp/cadastro-whatsapp.module";

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
  `😊 *Oi! Eu sou o ajudante do ${MARCA} aqui no WhatsApp.*\n\n` +
  "Antes de começar, eu preciso saber quem é você. É rapidinho, e você faz só uma vez:\n\n" +
  `1️⃣ Abra o ${MARCA} no computador ou no celular.\n` +
  "2️⃣ Toque no seu *Perfil*.\n" +
  "3️⃣ Procure *Criar evento pelo WhatsApp*. Vai aparecer um *código* (letras e números).\n" +
  "4️⃣ Copie esse código e me mande aqui assim:\n" +
  "👉 *VINCULAR* e o seu código\n" +
  "     (por exemplo: *VINCULAR ABC123*)\n\n" +
  "Assim que fizer isso, eu te ensino todo o resto. 😉";

// A assistente do WhatsApp tem nome: "Aurélia". O /ajuda abre um menuzinho
// ("Financeiro: 1, Agenda: 2, encerrar: 0") e, conforme a escolha, ela manda o
// passo a passo SÓ daquele módulo. Mostra apenas o que a pessoa pode usar.
// Rodapé quando a pessoa chegou pelo MENU (tem os dois módulos): oferece voltar.
const RODAPE_MENU = "\n\n🔙 Para voltar ao menu principal, responda *9*.\n0️⃣ Para encerrar nossa conversa, responda *0*.";
// Rodapé simples (quem tem só um módulo — não há menu para voltar).
const RODAPE_SIMPLES = "\n\n❓ Quer ver de novo? É só mandar *ajuda*. 😉";

// Guia em PDF enviado logo após vincular. O arquivo é empacotado na imagem
// (COPY assets no Dockerfile); em produção o WORKDIR é /app → /app/assets/…
const GUIA_PDF_PATH = require("path").join(process.cwd(), "assets", "guia-whatsapp.pdf");
const GUIA_PDF_NOME = `Guia-${MARCA}-WhatsApp.pdf`;
const GUIA_PDF_LEGENDA = "📖 Preparei um guia rápido pra você começar — é só seguir o passo a passo. Qualquer dúvida, mande *ajuda*. 🧡";

// Saudação da Aurélia + menu de módulos.
/**
 * Menu da Aurélia.
 *
 * Mostra SÓ o que a pessoa pode usar: um número que ela não tem acesso não
 * aparece, para a lista não prometer o que não entrega. Os números são fixos
 * por módulo (1 = Financeiro, 2 = Agenda, …) e não se renumeram conforme o
 * que aparece — assim quem decorou "3 é Keep" continua certo mesmo que o
 * Financeiro suma da lista dele.
 */
function montarMenuAjuda(acessos: AcessosWhats, nome: string): string {
  const nm = primeiroNome(nome);
  let m =
    (nm ? `😊 *Oi, ${nm}!*` : "😊 *Oi!*") +
    ` Eu sou a *Aurélia*, sua ajudante do ${MARCA} aqui no WhatsApp.\n` +
    "Com qual módulo você quer a minha ajuda? É só responder o número:\n\n";
  if (acessos.gastos)       m += "💸 Para *Financeiro*: responda *1*\n";
  if (acessos.agenda)       m += "🗓️ Para *Agenda*: responda *2*\n";
  if (acessos.keep)         m += "📝 Para *Keep*: responda *3*\n";
  if (acessos.projetos)     m += "📁 Para *Projetos*: responda *4*\n";
  if (acessos.chamados)     m += "🎧 Para *Chamados*: responda *5*\n";
  if (acessos.conhecimento) m += "📚 Para *Conhecimento*: responda *6*\n";
  m += "📖 Para ver *TUDO de uma vez*: responda *7*\n";
  m += "👋 Para encerrar nossa conversa: responda *0*";
  m += "\n\n☀️ Para consultar seu dia: *meu dia*. Para escolher o resumo automático: *rotina*.\n📝 Para criar tarefa: *tarefa: comprar material amanhã*.";
  return m;
}

/** O que a pessoa pode usar pelo WhatsApp, resolvido uma vez por mensagem. */
type AcessosWhats = {
  agenda: boolean; gastos: boolean; keep: boolean;
  projetos: boolean; chamados: boolean; conhecimento: boolean;
};

function acessosDe(perms: string[]): AcessosWhats {
  return {
    agenda: podeAgenda(perms), gastos: podeGastos(perms), keep: podeKeep(perms),
    projetos: podeProjetos(perms), chamados: podeChamados(perms), conhecimento: podeConhecimento(perms),
  };
}

// Passo a passo do FINANCEIRO (gastos pessoais + contas a pagar).
function ajudaFinanceiro(temAgenda: boolean): string {
  let m =
    "💸 *FINANCEIRO*\n\n" +
    "*ANOTAR UM GASTO SEU*\n" +
    "👉 *Gasto: Mercado 150 no crédito*\n" +
    "Parcelado? *Gasto: TV 2400 crédito 12x*\n" +
    "Errou? *apagar* (tira o último) ou *corrige o último pra 150*\n\n" +
    "*VER QUANTO GASTOU*\n" +
    "👉 *Relatório: quanto gastei esse mês*\n" +
    "(dá para pedir por *crédito*, *débito* ou *no total*)\n\n" +
    "Para contas a pagar da organização, envie *empresa*.\n\n";
  if (!temAgenda) {
    m += "✨ *Mais fácil ainda:* pode mandar só *Mercado 150 crédito* que eu já entendo.\n\n";
  }
  m +=
    "📌 *DICAS*\n" +
    "• Pode escrever *hoje*, *ontem* ou *amanhã*.\n" +
    "• O dia pode ser *10/09*.";
  return m;
}

// Passo a passo da AGENDA (criar, listar e excluir).
function ajudaAgenda(): string {
  return (
    "🗓️ *AGENDA*\n\n" +
    "*MARCAR UM COMPROMISSO*\n" +
    "👉 *Evento: Médico amanhã 14h*\n" +
    "Que se repete? *Evento: Reunião toda semana 9h*\n\n" +
    "*VER E DESMARCAR*\n" +
    "👉 *meus compromissos* — lista numerada\n" +
    "👉 *excluir compromisso 2* — apaga o número 2 da lista\n\n" +
    "📌 *DICAS*\n" +
    "• Pode escrever *hoje*, *ontem* ou *amanhã*.\n" +
    "• O dia pode ser *10/09*; a hora, *9h* ou *14:30*."
  );
}

// Passo a passo do KEEP (anotar, listar e excluir).
function ajudaKeep(): string {
  return (
    "📝 *KEEP*\n\n" +
    "*ANOTAR*\n" +
    "👉 *Nota: comprar pilha para o controle*\n\n" +
    "*VER E APAGAR*\n" +
    "👉 *minhas notas* — lista numerada\n" +
    "👉 *excluir nota 1* — manda para a lixeira (dá para recuperar)\n\n" +
    "📌 *DICA*\n" +
    "• A anotação fica só para você."
  );
}

// Passo a passo de PROJETOS (criar, listar, tarefas).
function ajudaProjetos(): string {
  return (
    "📁 *PROJETOS*\n\n" +
    "*CRIAR*\n" +
    "👉 *Projeto: Reforma da loja*\n\n" +
    "*ACOMPANHAR*\n" +
    "👉 *projetos* — os em andamento, com o quanto já avançou\n" +
    "👉 *minhas tarefas* — as que estão com você, em aberto\n\n" +
    "📌 *DICA*\n" +
    "• Prazo, responsável e etapas continuam na tela; aqui é o essencial."
  );
}

// Passo a passo de CHAMADOS (abrir e acompanhar).
function ajudaChamados(): string {
  return (
    "🎧 *CHAMADOS*\n\n" +
    "*PEDIR AJUDA*\n" +
    "👉 *Chamado: a impressora da recepção não liga*\n" +
    "Eu abro na hora e te mando o número.\n\n" +
    "*ACOMPANHAR*\n" +
    "👉 *meus chamados* — os seus, em aberto\n\n" +
    "📌 *DICA*\n" +
    "• Quanto mais detalhe, mais rápido alguém resolve."
  );
}

// Passo a passo de CONHECIMENTO (buscar artigo).
function ajudaConhecimento(): string {
  return (
    "📚 *CONHECIMENTO*\n\n" +
    "*PROCURAR UMA RESPOSTA*\n" +
    "👉 *Buscar: como configurar a VPN*\n" +
    "Eu procuro nos artigos publicados e te mando o que achar.\n\n" +
    "📌 *DICA*\n" +
    "• Menos palavras acha mais: tente *VPN* em vez da frase toda."
  );
}

/**
 * TUDO numa mensagem só, para quem responde *7* no menu.
 *
 * Existe porque o menu entrega um módulo por vez, e quem está aprendendo quer
 * ver o conjunto — ou guardar uma mensagem só para consultar depois. Mostra
 * apenas o que a pessoa pode usar: um comando que ela não tem acesso não
 * aparece, para a lista não ensinar o que vai ser recusado.
 */
function ajudaCompleta(a: AcessosWhats, nome: string): string {
  const nm = primeiroNome(nome);
  const partes: string[] = [];
  if (a.agenda) partes.push(ajudaAgenda());
  if (a.gastos) partes.push(ajudaFinanceiro(a.agenda));
  if (a.keep) partes.push(ajudaKeep());
  if (a.projetos) partes.push(ajudaProjetos());
  if (a.chamados) partes.push(ajudaChamados());
  if (a.conhecimento) partes.push(ajudaConhecimento());
  if (!partes.length) {
    return "Peça ao administrador para liberar os módulos para você aproveitar tudo por aqui. 😉";
  }
  return (
    (nm ? `📖 *${nm}, aqui está tudo o que dá para fazer por mensagem:*` : "📖 *Tudo o que dá para fazer por mensagem:*") +
    "\n\n" + partes.join("\n\n────────\n\n")
  );
}

// Boas-vindas logo após vincular: a Aurélia se apresenta e já mostra o passo a
// passo de tudo que a pessoa pode fazer (sem menu — é o primeiro contato).
function montarBoasVindas(acessos: AcessosWhats, nome: string): string {
  const nm = primeiroNome(nome);
  let m = "🎉 *Tudo pronto!*\n\n" +
    (nm ? `😊 *Oi, ${nm}!* ` : "😊 ") +
    `Eu sou a *Aurélia*, sua ajudante do ${MARCA} aqui no WhatsApp.\n\n`;
  const partes: string[] = [];
  if (acessos.agenda)       partes.push(ajudaAgenda());
  if (acessos.gastos)       partes.push(ajudaFinanceiro(acessos.agenda));
  if (acessos.keep)         partes.push(ajudaKeep());
  if (acessos.projetos)     partes.push(ajudaProjetos());
  if (acessos.chamados)     partes.push(ajudaChamados());
  if (acessos.conhecimento) partes.push(ajudaConhecimento());
  if (!partes.length) {
    partes.push("Peça ao administrador para liberar os módulos para você aproveitar tudo por aqui. 😉");
  }
  m += partes.join("\n\n────────\n\n") + RODAPE_SIMPLES +
    "\n\n🎁 Veio por indicação de alguém? Envie o código dele assim: *INDICACAO ORK-XXXXXX*";
  return m;
}

// Permissões → o que a pessoa pode fazer pelo WhatsApp. Agenda é base (quase todo
// mundo tem); Gastos exige acesso de gerenciar o Financeiro (o mesmo do trial one-finance).
function podeAgenda(perms: string[]): boolean { return perms.includes("*") || perms.includes("agenda:criar"); }
function podeGastos(perms: string[]): boolean {
  return perms.includes("*") || perms.includes("gastos:registrar") || perms.includes("financeiro:gerenciar");
}

function podeKeep(perms: string[]): boolean { return perms.includes("*") || perms.includes("keep:criar"); }
function podeProjetos(perms: string[]): boolean { return perms.includes("*") || perms.includes("projetos:ver"); }
function podeChamados(perms: string[]): boolean { return perms.includes("*") || perms.includes("chamados:criar"); }
function podeConhecimento(perms: string[]): boolean { return perms.includes("*") || perms.includes("conhecimento:ver"); }

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
  } else if (/\bontem\b/.test(low)) {
    const d = new Date(agora); d.setDate(d.getDate() - 1);
    ano = d.getFullYear(); mes = d.getMonth(); dia = d.getDate(); temData = true;
    resto = resto.replace(/\bontem\b/i, " ");
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
  if (isNaN(inicio.getTime()) || inicio.getFullYear() !== ano || inicio.getMonth() !== mes || inicio.getDate() !== dia) return "sem_data_hora";
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

  // Estado leve do menu da Aurélia: lembra que a pessoa mandou "ajuda" e está
  // escolhendo o módulo (1/2/0). Em memória, com validade curta — se o processo
  // reiniciar, é só mandar "ajuda" de novo. Chave = remoteJid.
  private readonly menuAte = new Map<string, number>();
  private static readonly MENU_TTL_MS = 10 * 60 * 1000;
  private abrirMenu(jid: string) { this.menuAte.set(jid, Date.now() + WhatsappInboundService.MENU_TTL_MS); }
  private noMenu(jid: string): boolean {
    const t = this.menuAte.get(jid);
    if (!t) return false;
    if (t < Date.now()) { this.menuAte.delete(jid); return false; }
    return true;
  }
  private fecharMenu(jid: string) { this.menuAte.delete(jid); }

  constructor(
    private prisma: PrismaService, private wa: WhatsAppService, private auth: AuthService,
    private referral: ReferralService,
    private cadastroWhats: CadastroWhatsappService,
    private inicio: WhatsappInicioService,
    private rotina: WhatsappRotinaService,
    private contexto: WhatsappContextoService,
    private equipe: WhatsappEquipeService,
    private linguagem: WhatsappLinguagemService,
    private media: WhatsappMediaService,
  ) {}

  private fmtData(d: Date): string {
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  // Identifica o usuário DONO daquele chat: primeiro pelo LID vinculado, depois
  // (só quando o chat é @s.whatsapp.net) pelo telefone cadastrado — assim o
  // caso "mandar para si mesmo" com número próprio ainda funciona sem vínculo.
  // `jidAlternativo`: o Evolution v2 pode mandar, junto do "@lid", o jid com o
  // telefone (key.remoteJidAlt / key.senderPn). Quando vem, também serve para
  // achar a conta pelo número cadastrado. Por ora só a renovação do teste passa.
  private async identificar(remoteJid: string, jidAlternativo?: string): Promise<{ id: string; organizationId: string; nome: string; telefone: string | null } | null> {
    const idPart = remoteJid.split("@")[0];
    const byLid = await this.prisma.userProfile.findMany({
      where: { whatsappLid: idPart } as any,
      select: { whatsapp: true, user: { select: { id: true, organizationId: true, ativo: true, bloqueado: true, nome: true } } },
    });
    if (byLid.length > 1) return null;
    if (byLid[0]?.user?.ativo && !byLid[0].user.bloqueado) return { ...byLid[0].user, telefone: byLid[0].whatsapp };
    if (byLid.length) return null;
    const jidTelefone = remoteJid.endsWith("@s.whatsapp.net") ? remoteJid
      : jidAlternativo?.endsWith("@s.whatsapp.net") ? jidAlternativo : null;
    if (jidTelefone) {
      const tel = jidTelefone.split("@")[0];
      const perfis = await this.prisma.userProfile.findMany({
        where: { NOT: { whatsapp: null } },
        select: { whatsapp: true, user: { select: { id: true, organizationId: true, ativo: true, bloqueado: true, nome: true } } },
      });
      const matches = perfis.filter(x => telefoneBate(tel, x.whatsapp));
      const p = matches.length === 1 && matches[0].user?.ativo && !matches[0].user.bloqueado ? matches[0] : null;
      if (p?.user) return { ...p.user, telefone: p.whatsapp };
    }
    return null;
  }

  // ── Renovação pelo WhatsApp (resposta ao aviso de "vence amanhã") ────────────
  //
  // Vale para o fim do TESTE (o "1" efetiva a conta e abre o primeiro mês) e
  // para o fim de cada MÊS pago (o "1" soma mais um mês). Devolve true quando a
  // mensagem era mesmo sobre a renovação e já foi respondida. "1"/"2" soltos só
  // contam para quem recebeu o aviso do vencimento atual — para qualquer outra
  // pessoa seguem o fluxo normal (menu, gasto etc.).
  private async tratarRenovacao(remoteJid: string, jidAlt: string, resp: RespostaRenovacao & { soNumero: boolean }, inst: string): Promise<boolean> {
    const campos = {
      id: true, nome: true, email: true, organizationId: true, isTrial: true, trialExpiraEm: true, trialModulo: true,
      assinaturaEm: true, assinaturaValidaAte: true, trialLembreteEm: true,
      trialRenovacaoResposta: true, trialRenovacaoRespostaEm: true, profile: { select: { whatsapp: true } },
    } as any;
    const agora = new Date();
    const renovouAgoraPouco = (u: any) =>
      u.trialRenovacaoResposta === "RENOVOU" && u.trialRenovacaoRespostaEm &&
      new Date(u.trialRenovacaoRespostaEm).getTime() > agora.getTime() - 3 * 24 * 60 * 60 * 1000;

    let alvo: any = null;
    if (resp.codigo) {
      // O código veio no aviso: identifica a conta sem depender do número e já
      // liga este chat a ela (como o VINCULAR), para as próximas mensagens.
      const contas = await this.prisma.user.findMany({ where: { isTrial: true, ativo: true } as any, select: campos });
      alvo = (contas as any[]).find(u => codigoRenovacao(u.id) === resp.codigo) || null;
      if (!alvo) { await this.wa.sendToJid(remoteJid, RESPOSTA_CODIGO_INVALIDO, inst).catch(() => {}); return true; }
      if (remoteJid.endsWith("@lid")) {
        await this.prisma.userProfile.upsert({
          where: { userId: alvo.id },
          update: { whatsappLid: remoteJid.split("@")[0] } as any,
          create: { userId: alvo.id, whatsappLid: remoteJid.split("@")[0] } as any,
        }).catch(() => {});
      }
    } else {
      const quem = await this.identificar(remoteJid, jidAlt);
      if (!quem) {
        if (resp.soNumero) {
          // Número solto de alguém que não reconhecemos: só orienta se saiu aviso
          // nos últimos dias (é quase certo que seja um deles).
          const recente = await this.prisma.user.count({
            where: { isTrial: true, trialLembreteEm: { gte: new Date(agora.getTime() - 3 * 24 * 60 * 60 * 1000) } } as any,
          });
          if (!recente) return false;
        }
        await this.wa.sendToJid(remoteJid, RESPOSTA_NAO_IDENTIFICADO, inst).catch(() => {});
        return true;
      }
      alvo = await this.prisma.user.findUnique({ where: { id: quem.id }, select: campos });
      if (!alvo?.isTrial) return false;
    }

    const tel: string | null = alvo.profile?.whatsapp ?? null;
    const falar = (msg: string) => this.responder(remoteJid, tel, alvo.organizationId, inst, msg);
    const contato = `${alvo.email}${tel ? ` · WhatsApp ${tel}` : ""}`;
    const produto = produtoLabel(alvo.trialModulo);

    const f = faseDaConta(alvo);
    if (!f) {
      // Efetivada antes da mensalidade existir: fora do ciclo, a equipe cuida.
      if (resp.soNumero) return false;
      if (alvo.assinaturaEm) { await falar(RESPOSTA_JA_RENOVADO); return true; }
      return false;
    }
    const avisoAtual = avisoDoCicloAtual(alvo);
    if (resp.soNumero && !avisoAtual) {
      // "1" repetido depois de já ter renovado: confirma em vez de ficar mudo.
      if (renovouAgoraPouco(alvo)) { await falar(RESPOSTA_JA_RENOVADO); return true; }
      return false; // não recebeu o aviso deste vencimento
    }

    if (resp.opcao === "RECUSAR") {
      await this.prisma.user.update({
        where: { id: alvo.id },
        data: { trialRenovacaoResposta: "RECUSOU", trialRenovacaoRespostaEm: agora } as any,
      });
      const vencido = f.limite.getTime() < agora.getTime();
      await falar(montarRespostaRecusou({ fase: f.fase, nome: alvo.nome, limite: f.limite, vencido, codigo: codigoRenovacao(alvo.id) }));
      await this.auth.notificarEquipeTrial(alvo.id, f.fase === "TESTE" ? "trial_recusou" : "assinatura_recusou",
        f.fase === "TESTE" ? "Teste: não quer continuar" : "Mensalidade: não quer renovar",
        `${contato} respondeu 2 (não quer continuar o ${produto}).`).catch(() => {});
      this.logger.log(`Renovação recusada pelo WhatsApp (${f.fase}): user=${alvo.id}`);
      return true;
    }

    if (!podeRenovar(alvo, agora)) {
      await falar(RESPOSTA_PRAZO_ENCERRADO);
      await this.auth.notificarEquipeTrial(alvo.id, "renovacao_fora_prazo",
        "Pediu renovação fora do prazo",
        `${contato} pediu para renovar pelo WhatsApp, mas o acesso venceu há mais de 15 dias. Fale com a pessoa para liberar.`).catch(() => {});
      return true;
    }

    if (f.fase === "TESTE") {
      // Reserva atômica: dois "1" seguidos não efetivam (nem geram comissão) duas vezes.
      const validaAte = proximaValidade(f.limite, agora);
      const reserva = await this.prisma.user.updateMany({
        where: { id: alvo.id, assinaturaEm: null } as any,
        data: {
          assinaturaEm: agora, assinaturaValidaAte: validaAte, trialAvisadoSuporte: false,
          trialRenovacaoResposta: "RENOVOU", trialRenovacaoRespostaEm: agora,
        } as any,
      });
      if (reserva.count === 0) { await falar(RESPOSTA_JA_RENOVADO); return true; }
      // Mesma efetivação do painel de Indicações: valor da assinatura + comissão do indicador.
      await this.referral.efetivar(alvo.id).catch((e: any) =>
        this.logger.error(`Efetivação pelo WhatsApp gravou a assinatura mas falhou no restante (user=${alvo.id}): ${e?.message || e}`));
      await falar(montarRespostaEfetivou({ nome: alvo.nome }));
      await this.auth.notificarEquipeTrial(alvo.id, "trial_renovou",
        "Teste efetivado pelo WhatsApp — combinar pagamento",
        `${contato} respondeu 1 e efetivou o ${produto} (R$ 27,00 por mês, 1º mês até ${validaAte.toLocaleDateString("pt-BR")}). Fale com a pessoa para combinar o pagamento.`).catch(() => {});
      this.logger.log(`Trial efetivado pelo WhatsApp: user=${alvo.id}`);
      return true;
    }

    // MENSAL. Só renova perto do vencimento (ou já vencido): reenviar o código no
    // meio do mês não pode ir somando meses sem querer.
    if (!avisoAtual && f.limite.getTime() - agora.getTime() > LEMBRETE_ANTECEDENCIA_MS) {
      await falar(RESPOSTA_JA_RENOVADO);
      return true;
    }
    const validaAte = proximaValidade(f.limite, agora);
    const reserva = await this.prisma.user.updateMany({
      where: { id: alvo.id, assinaturaValidaAte: f.limite } as any,
      data: {
        assinaturaValidaAte: validaAte, trialAvisadoSuporte: false,
        trialRenovacaoResposta: "RENOVOU", trialRenovacaoRespostaEm: agora,
      } as any,
    });
    if (reserva.count === 0) { await falar(RESPOSTA_JA_RENOVADO); return true; }
    await falar(montarRespostaRenovouMes({ nome: alvo.nome, modulo: alvo.trialModulo, validaAte }));
    await this.auth.notificarEquipeTrial(alvo.id, "assinatura_renovou",
      "Mensalidade renovada pelo WhatsApp — cobrar",
      `${contato} respondeu 1 e renovou o ${produto} por mais um mês (R$ 27,00, até ${validaAte.toLocaleDateString("pt-BR")}). Fale com a pessoa para o pagamento.`).catch(() => {});
    this.logger.log(`Mensalidade renovada pelo WhatsApp: user=${alvo.id} até ${validaAte.toISOString()}`);
    return true;
  }

  // Responde à pessoa. O Evolution v1.8.2 NÃO envia para "@lid" (400 exists:false),
  // então respondemos pelo TELEFONE cadastrado (chega na mesma conversa). Sem
  // telefone, caímos no jid cru (best-effort, pode falhar em @lid).
  private async responder(remoteJid: string, telefone: string | null, orgId: string | null, inst: string, msg: string) {
    // Responde pela instância compartilhada que recebeu esta conversa.
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
    this.logger.log(`WhatsApp vinculado: user=${alvo.id}`);
    const tel = alvo.profile?.whatsapp ?? null;
    await this.responder(remoteJid, tel, alvo.organizationId, inst,
      `✅ *WhatsApp vinculado à conta de ${alvo.nome}!*`);
    // Tutorial logo em seguida (2º envio), mostrando SÓ o que a conta pode fazer.
    const perms = await this.auth.resolvePermissions(alvo.id).catch(() => [] as string[]);
    await this.responder(remoteJid, tel, alvo.organizationId, inst,
      montarBoasVindas(acessosDe(perms), alvo.nome));
    // 3º envio: o guia em PDF. Best-effort — se falhar, não atrapalha o vínculo.
    // Vai para o telefone quando houver; senão tenta o jid cru (pode falhar no LID).
    await this.wa.sendDocumentFile(tel || remoteJid, GUIA_PDF_PATH, GUIA_PDF_NOME, GUIA_PDF_LEGENDA, inst).catch(() => {});
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
    this.logger.log(`Indicação via WhatsApp: indicado=${user.id}`);
    await this.wa.sendToJid(remoteJid, montarMensagemAtivacao(nome, codigoIndicacao(user.id)), inst).catch(() => {});
  }

  // "/ajuda" (ou "ajuda"/"menu") — a Aurélia se apresenta. Se a pessoa tem os
  // DOIS módulos, mostra o menu (Financeiro: 1, Agenda: 2, encerrar: 0) e passa a
  // aguardar a escolha. Com um módulo só, manda direto o passo a passo dele.
  // Funciona mesmo sem vínculo (é justamente quem mais precisa de ajuda).
  private async enviarAjuda(remoteJid: string, inst: string) {
    const user = await this.identificar(remoteJid);
    if (!user) {
      this.fecharMenu(remoteJid);
      await this.wa.sendToJid(remoteJid, AJUDA_VINCULAR, inst).catch(() => {});
      return;
    }
    const perms = await this.auth.resolvePermissions(user.id).catch(() => [] as string[]);
    const a = acessosDe(perms);
    // O menu pessoal não oferece operações da organização.
    a.projetos = false; a.chamados = false; a.conhecimento = false;
    const quantos = Object.values(a).filter(Boolean).length;

    if (quantos > 1) {
      this.abrirMenu(remoteJid);
      await this.responder(remoteJid, user.telefone, user.organizationId, inst,
        this.contexto.mensagem("PESSOAL") + "\n\n" + montarMenuAjuda(a, user.nome));
      return;
    }

    // Um módulo só (ou nenhum): sem menu — a Aurélia já entrega o tutorial,
    // porque um menu de uma opção é uma pergunta sem escolha.
    this.fecharMenu(remoteJid);
    const nm = primeiroNome(user.nome);
    const saud = (nm ? `😊 *Oi, ${nm}!* ` : "😊 ") +
      `Eu sou a *Aurélia*, sua ajudante do ${MARCA} aqui no WhatsApp.\n\n`;
    let corpo: string;
    if (a.gastos)            corpo = ajudaFinanceiro(a.agenda) + RODAPE_SIMPLES;
    else if (a.agenda)       corpo = ajudaAgenda() + RODAPE_SIMPLES;
    else if (a.keep)         corpo = ajudaKeep() + RODAPE_SIMPLES;
    else if (a.projetos)     corpo = ajudaProjetos() + RODAPE_SIMPLES;
    else if (a.chamados)     corpo = ajudaChamados() + RODAPE_SIMPLES;
    else if (a.conhecimento) corpo = ajudaConhecimento() + RODAPE_SIMPLES;
    else corpo = "Peça ao administrador para liberar os módulos para você aproveitar tudo por aqui. 😉";
    await this.responder(remoteJid, user.telefone, user.organizationId, inst, saud + corpo);
  }

  // Resposta ao menu: 1 Financeiro, 2 Agenda, 3 Keep, 4 Projetos, 5 Chamados,
  // 6 Conhecimento, 9 voltar, 0 encerrar.
  private async responderMenu(remoteJid: string, opcao: string, inst: string) {
    const user = await this.identificar(remoteJid);
    if (!user) {
      this.fecharMenu(remoteJid);
      await this.wa.sendToJid(remoteJid, NAO_VINCULADO, inst).catch(() => {});
      return;
    }
    const perms = await this.auth.resolvePermissions(user.id).catch(() => [] as string[]);
    const a = acessosDe(perms);
    const diz = (m: string) => this.responder(remoteJid, user.telefone, user.organizationId, inst, m);
    a.projetos = false; a.chamados = false; a.conhecimento = false;

    if (opcao === "0") {
      this.fecharMenu(remoteJid);
      await diz("👋 Combinado! Encerrei nossa conversa. Quando precisar, é só mandar *ajuda*. 😊");
      return;
    }
    if (opcao === "9") {
      this.abrirMenu(remoteJid);
      await diz(montarMenuAjuda(a, user.nome));
      return;
    }

    // Número → módulo. O menu segue aberto para o "9" (voltar).
    const porOpcao: Record<string, { pode: boolean; texto: () => string }> = {
      "1": { pode: a.gastos,       texto: () => ajudaFinanceiro(a.agenda) },
      "2": { pode: a.agenda,       texto: () => ajudaAgenda() },
      "3": { pode: a.keep,         texto: () => ajudaKeep() },
      "4": { pode: a.projetos,     texto: () => ajudaProjetos() },
      "5": { pode: a.chamados,     texto: () => ajudaChamados() },
      "6": { pode: a.conhecimento, texto: () => ajudaConhecimento() },
      // 7 = tudo numa mensagem so. Sempre disponivel: mesmo quem tem um
      // modulo so pode querer guardar a referencia inteira.
      "7": { pode: true,            texto: () => ajudaCompleta(a, user.nome) },
    };
    const escolha = porOpcao[opcao];
    if (escolha?.pode) {
      this.abrirMenu(remoteJid);
      await diz(escolha.texto() + RODAPE_MENU);
      return;
    }

    // Número inválido ou de módulo que ela não tem: reexplica com as opções
    // QUE ELA TEM, em vez de repetir uma lista fixa que pode não bater.
    const disponiveis: string[] = [];
    if (a.gastos)       disponiveis.push("*1* Financeiro");
    if (a.agenda)       disponiveis.push("*2* Agenda");
    if (a.keep)         disponiveis.push("*3* Keep");
    if (a.projetos)     disponiveis.push("*4* Projetos");
    if (a.chamados)     disponiveis.push("*5* Chamados");
    if (a.conhecimento) disponiveis.push("*6* Conhecimento");
    disponiveis.push("*7* ver tudo");
    await diz(
      "🤖 Não entendi. Responda " +
      (disponiveis.length ? disponiveis.join(", ") + " ou *0* para encerrar." : "*0* para encerrar.")
    );
  }

  // ── Data solta "10/11" ou "10/11/2026" para os comandos que pedem prazo ──
  //
  // Sem ano, assume o próximo: "vence 10/01" em dezembro é janeiro que vem,
  // não janeiro que passou.
  private parseDataCurta(txt: string): Date | null {
    const m = (txt || "").match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
    if (!m) return null;
    const dia = Number(m[1]), mes = Number(m[2]);
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
    const agora = new Date();
    const ano = m[3] ? Number(m[3].length === 2 ? "20" + m[3] : m[3]) : agora.getFullYear();
    const d = new Date(ano, mes - 1, dia, 12, 0, 0);
    if (!m[3] && d.getTime() < agora.getTime() - 86400000) d.setFullYear(ano + 1);
    return d;
  }

  // ── Agenda: listar e excluir ────────────────────────────────────────────

  /**
   * Próximos compromissos, numerados.
   *
   * O número é a posição NESTA lista, e é o que "excluir compromisso 2" usa.
   * A ordenação é sempre a mesma (início crescente), então o número 2 de agora
   * é o número 2 do comando seguinte — desde que nada entre no meio. Por isso
   * a exclusão confirma o título do que apagou: se a lista mudou, a pessoa vê
   * que apagou outra coisa.
   */
  private async listarCompromissos(remoteJid: string, inst: string) {
    const user = await this.identificar(remoteJid);
    if (!user) { await this.wa.sendToJid(remoteJid, NAO_VINCULADO, inst).catch(() => {}); return; }
    const eventos = await this.proximosEventos(user.id);
    if (!eventos.length) {
      await this.responder(remoteJid, user.telefone, user.organizationId, inst,
        "🗓️ Você não tem compromissos marcados. Para criar, mande *Evento: Médico amanhã 14h*.");
      return;
    }
    const linhas = eventos.map((e: any, i: number) => `${i + 1}. *${e.titulo}* — ${this.fmtData(e.inicio)}`);
    await this.responder(remoteJid, user.telefone, user.organizationId, inst,
      "🗓️ *Seus próximos compromissos:*\n\n" + linhas.join("\n") +
      "\n\n_Para apagar um, mande *excluir compromisso 1* (o número da lista)._");
  }

  private async proximosEventos(userId: string) {
    return (this.prisma as any).event.findMany({
      where: { userId, inicio: { gte: new Date(Date.now() - 3600_000) } },
      orderBy: { inicio: "asc" }, take: 10,
      select: { id: true, titulo: true, inicio: true },
    });
  }

  private async excluirCompromisso(remoteJid: string, posicao: number, inst: string) {
    const user = await this.identificar(remoteJid);
    if (!user) { await this.wa.sendToJid(remoteJid, NAO_VINCULADO, inst).catch(() => {}); return; }
    const eventos = await this.proximosEventos(user.id);
    const alvo = eventos[posicao - 1];
    if (!alvo) {
      await this.responder(remoteJid, user.telefone, user.organizationId, inst,
        `🗓️ Não achei o compromisso ${posicao}. Mande *meus compromissos* para ver a lista numerada.`);
      return;
    }
    await (this.prisma as any).event.delete({ where: { id: alvo.id } });
    await this.responder(remoteJid, user.telefone, user.organizationId, inst,
      `🗑️ Apaguei *${alvo.titulo}* (${this.fmtData(alvo.inicio)}). ✅`);
  }

  // ── Keep: excluir ───────────────────────────────────────────────────────

  private async excluirNota(remoteJid: string, posicao: number, inst: string) {
    const user = await this.identificar(remoteJid);
    if (!user) { await this.wa.sendToJid(remoteJid, NAO_VINCULADO, inst).catch(() => {}); return; }
    const notas = await (this.prisma as any).note.findMany({
      where: { userId: user.id, arquivado: false, lixeira: false },
      orderBy: { criadoEm: "desc" }, take: 10,
      select: { id: true, titulo: true },
    });
    const alvo = notas[posicao - 1];
    if (!alvo) {
      await this.responder(remoteJid, user.telefone, user.organizationId, inst,
        `📝 Não achei a anotação ${posicao}. Mande *minhas notas* para ver a lista numerada.`);
      return;
    }
    // Vai para a lixeira, não some: anotação apagada pelo número errado ainda
    // dá para recuperar na tela.
    await (this.prisma as any).note.update({ where: { id: alvo.id }, data: { lixeira: true } });
    await this.responder(remoteJid, user.telefone, user.organizationId, inst,
      `🗑️ Mandei *${alvo.titulo}* para a lixeira. Dá para recuperar no Keep. ✅`);
  }

  // ── Projetos: criar ─────────────────────────────────────────────────────

  private async criarProjeto(remoteJid: string, texto: string, inst: string) {
    const user = await this.identificar(remoteJid);
    if (!user) { await this.wa.sendToJid(remoteJid, NAO_VINCULADO, inst).catch(() => {}); return; }
    const perms = await this.auth.resolvePermissions(user.id).catch(() => [] as string[]);
    if (!(perms.includes("*") || perms.includes("projetos:criar"))) {
      await this.responder(remoteJid, user.telefone, user.organizationId, inst,
        "📁 Você não tem acesso para criar projeto. Fale com quem administra o sistema.");
      return;
    }
    const titulo = texto.trim();
    if (titulo.length < 3) {
      await this.responder(remoteJid, user.telefone, user.organizationId, inst,
        "📁 Me diga o nome do projeto, assim: *Projeto: Reforma da loja*");
      return;
    }
    const proj = await (this.prisma as any).project.create({
      data: {
        id: require("crypto").randomUUID(),
        organizationId: user.organizationId, criadoPorId: user.id,
        titulo, status: "PLANEJAMENTO",
      },
      select: { titulo: true },
    });
    await this.responder(remoteJid, user.telefone, user.organizationId, inst,
      `📁 Criei o projeto *${proj.titulo}*, em planejamento.\n\nPara ver todos, mande *projetos*. ✅`);
  }

  // ── Finance: contas a pagar ─────────────────────────────────────────────

  private async criarConta(remoteJid: string, texto: string, inst: string) {
    const user = await this.identificar(remoteJid);
    if (!user) { await this.wa.sendToJid(remoteJid, NAO_VINCULADO, inst).catch(() => {}); return; }
    const perms = await this.auth.resolvePermissions(user.id).catch(() => [] as string[]);
    if (!(perms.includes("*") || perms.includes("financeiro:gerenciar"))) {
      await this.responder(remoteJid, user.telefone, user.organizationId, inst,
        "💰 Você não tem acesso para lançar contas. Fale com quem administra o sistema.");
      return;
    }
    const bruto = texto.trim();

    // A DATA sai PRIMEIRO, e só depois o valor.
    //
    // Invertido, "Conta: Energia 350 vence 10/11" virava uma conta de R$ 11:
    // o extrator de valor BR encontrava o "11" de "10/11" antes de chegar ao
    // 350, e o "350" sobrava no nome do fornecedor. Tirar a data da frase
    // antes de procurar dinheiro resolve na raiz.
    const mVence = bruto.match(/\b(?:vence|venc|vencimento|para)\s+(\S+)/i);
    const vencimento = mVence ? this.parseDataCurta(mVence[1]) : null;
    const semData = bruto.replace(/\b(?:vence|venc|vencimento|para)\s+\S+/i, " ").trim();

    const valorInfo = extrairValorBR(semData);
    if (!valorInfo) {
      await this.responder(remoteJid, user.telefone, user.organizationId, inst,
        "💰 Faltou o valor. Mande assim: *Conta: Energia 350 vence 10/11*");
      return;
    }
    // O que sobra depois de tirar a data e o valor é o nome de quem recebe.
    const fornecedor = (semData.slice(0, valorInfo.index) + " " + semData.slice(valorInfo.index + valorInfo.matchStr.length))
      .replace(/\s+/g, " ").trim();
    if (!fornecedor) {
      await this.responder(remoteJid, user.telefone, user.organizationId, inst,
        "💰 Faltou dizer de quem é a conta. Mande assim: *Conta: Energia 350 vence 10/11*");
      return;
    }
    await (this.prisma as any).contaPagar.create({
      data: {
        id: require("crypto").randomUUID(),
        organizationId: user.organizationId,
        fornecedorNome: fornecedor,
        // `numero` e `tipo` são obrigatórios no modelo, que nasceu para
        // importação de ERP. Lançamento pelo WhatsApp não tem nota fiscal: o
        // número é gerado e o tipo marca a origem, para dar para separar
        // depois o que veio da importação do que foi lançado à mão.
        numero: "WA-" + Date.now().toString(36).toUpperCase(),
        tipo: "MANUAL",
        valorOriginal: valorInfo.valor,
        dataVencto: vencimento, dataVenctoReal: vencimento,
        dataEmissao: new Date(),
      },
    });
    const quando = vencimento ? ` com vencimento em ${this.fmtData(vencimento)}` : " sem data de vencimento";
    await this.responder(remoteJid, user.telefone, user.organizationId, inst,
      `💰 Lancei *${fornecedor}* de R$ ${this.fmtValor(valorInfo.valor)}${quando}.\n\nPara ver todas, mande *contas a pagar*. ✅`);
  }

  private async listarContas(remoteJid: string, inst: string) {
    const user = await this.identificar(remoteJid);
    if (!user) { await this.wa.sendToJid(remoteJid, NAO_VINCULADO, inst).catch(() => {}); return; }
    const contas = await (this.prisma as any).contaPagar.findMany({
      where: { organizationId: user.organizationId, dataPagamento: null },
      orderBy: { dataVenctoReal: "asc" }, take: 10,
      select: { fornecedorNome: true, valorOriginal: true, dataVenctoReal: true },
    });
    if (!contas.length) {
      await this.responder(remoteJid, user.telefone, user.organizationId, inst,
        "💰 Não há contas em aberto. 🎉");
      return;
    }
    const hoje = new Date();
    const linhas = contas.map((c: any, i: number) => {
      const v = Number(c.valorOriginal || 0);
      const venc = c.dataVenctoReal ? new Date(c.dataVenctoReal) : null;
      const atrasada = venc && venc < hoje ? " ⚠️" : "";
      const quando = venc ? ` — ${this.fmtData(venc)}` : "";
      return `${i + 1}. *${c.fornecedorNome}* R$ ${this.fmtValor(v)}${quando}${atrasada}`;
    });
    await this.responder(remoteJid, user.telefone, user.organizationId, inst,
      "💰 *Contas em aberto:*\n\n" + linhas.join("\n") + "\n\n_⚠️ = já venceu._");
  }

  private async relatorioContas(remoteJid: string, inst: string) {
    const user = await this.identificar(remoteJid);
    if (!user) { await this.wa.sendToJid(remoteJid, NAO_VINCULADO, inst).catch(() => {}); return; }
    const abertas = await (this.prisma as any).contaPagar.findMany({
      where: { organizationId: user.organizationId, dataPagamento: null },
      select: { valorOriginal: true, dataVenctoReal: true },
    });
    if (!abertas.length) {
      await this.responder(remoteJid, user.telefone, user.organizationId, inst,
        "📊 Não há contas em aberto para somar. 🎉");
      return;
    }
    const hoje = new Date();
    const em30 = new Date(Date.now() + 30 * 86400000);
    let total = 0, vencido = 0, proximo = 0, nVencido = 0, nProximo = 0;
    for (const c of abertas) {
      const v = Number(c.valorOriginal || 0);
      total += v;
      const d = c.dataVenctoReal ? new Date(c.dataVenctoReal) : null;
      if (d && d < hoje) { vencido += v; nVencido++; }
      else if (d && d <= em30) { proximo += v; nProximo++; }
    }
    await this.responder(remoteJid, user.telefone, user.organizationId, inst,
      "📊 *Contas a pagar*\n\n" +
      `Em aberto: *R$ ${this.fmtValor(total)}* (${abertas.length} conta(s))\n` +
      `Já venceu: *R$ ${this.fmtValor(vencido)}* (${nVencido})\n` +
      `Vence em 30 dias: *R$ ${this.fmtValor(proximo)}* (${nProximo})`);
  }

  // ── Keep ────────────────────────────────────────────────────────────────


  private async criarNota(remoteJid: string, texto: string, inst: string) {
    const user = await this.identificar(remoteJid);
    if (!user) { await this.wa.sendToJid(remoteJid, NAO_VINCULADO, inst).catch(() => {}); return; }
    const conteudo = texto.trim();
    if (!conteudo) {
      await this.responder(remoteJid, user.telefone, user.organizationId, inst,
        "📝 Me diga o que anotar, assim: *Nota: comprar pilha*");
      return;
    }
    // Título = primeira linha curta; o resto vira conteúdo. Quem manda uma
    // frase só fica com ela no título, que é como a nota aparece na tela.
    const primeiraLinha = conteudo.split(/\n/)[0];
    const titulo = primeiraLinha.length <= 60 ? primeiraLinha : primeiraLinha.slice(0, 57) + "...";
    await (this.prisma as any).note.create({
      data: {
        id: require("crypto").randomUUID(),
        organizationId: user.organizationId, userId: user.id,
        titulo, conteudo,
      },
    });
    await this.responder(remoteJid, user.telefone, user.organizationId, inst,
      `📝 Anotei: *${titulo}*\n\nEstá no seu Keep. ✅`);
  }

  private async listarNotas(remoteJid: string, inst: string) {
    const user = await this.identificar(remoteJid);
    if (!user) { await this.wa.sendToJid(remoteJid, NAO_VINCULADO, inst).catch(() => {}); return; }
    const notas = await (this.prisma as any).note.findMany({
      where: { userId: user.id, arquivado: false, lixeira: false },
      orderBy: { criadoEm: "desc" }, take: 5,
      select: { titulo: true, criadoEm: true },
    });
    if (!notas.length) {
      await this.responder(remoteJid, user.telefone, user.organizationId, inst,
        "📝 Você ainda não tem anotações. Mande *Nota: alguma coisa* para criar a primeira.");
      return;
    }
    const linhas = notas.map((x: any) => `• ${x.titulo || "(sem título)"} — ${this.fmtData(x.criadoEm)}`);
    await this.responder(remoteJid, user.telefone, user.organizationId, inst,
      "📝 *Suas últimas anotações:*\n\n" + linhas.join("\n"));
  }

  // ── Projetos ────────────────────────────────────────────────────────────

  private async listarProjetos(remoteJid: string, inst: string) {
    const user = await this.identificar(remoteJid);
    if (!user) { await this.wa.sendToJid(remoteJid, NAO_VINCULADO, inst).catch(() => {}); return; }
    const projetos = await (this.prisma as any).project.findMany({
      where: { organizationId: user.organizationId, concluidoEm: null },
      orderBy: { atualizadoEm: "desc" }, take: 8,
      select: { titulo: true, status: true, progressoPct: true, dataFim: true },
    });
    if (!projetos.length) {
      await this.responder(remoteJid, user.telefone, user.organizationId, inst,
        "📁 Não há projetos em andamento por aqui.");
      return;
    }
    const linhas = projetos.map((x: any) => {
      const prazo = x.dataFim ? ` — entrega ${this.fmtData(x.dataFim)}` : "";
      return `• *${x.titulo}* — ${x.progressoPct || 0}%${prazo}`;
    });
    await this.responder(remoteJid, user.telefone, user.organizationId, inst,
      "📁 *Projetos em andamento:*\n\n" + linhas.join("\n"));
  }

  private async listarMinhasTarefas(remoteJid: string, inst: string) {
    const user = await this.identificar(remoteJid);
    if (!user) { await this.wa.sendToJid(remoteJid, NAO_VINCULADO, inst).catch(() => {}); return; }
    const tarefas = await (this.prisma as any).task.findMany({
      where: { assigneeId: user.id, status: { not: "CONCLUIDA" } },
      orderBy: [{ dataVencimento: "asc" }, { criadoEm: "desc" }], take: 8,
      select: { titulo: true, dataVencimento: true, project: { select: { titulo: true } } },
    });
    if (!tarefas.length) {
      await this.responder(remoteJid, user.telefone, user.organizationId, inst,
        "✅ Você não tem tarefas em aberto. Aproveite! 😄");
      return;
    }
    const linhas = tarefas.map((x: any) => {
      const quando = x.dataVencimento ? ` — vence ${this.fmtData(x.dataVencimento)}` : "";
      const proj = x.project?.titulo ? ` (${x.project.titulo})` : "";
      return `• ${x.titulo}${proj}${quando}`;
    });
    await this.responder(remoteJid, user.telefone, user.organizationId, inst,
      "📋 *Suas tarefas em aberto:*\n\n" + linhas.join("\n"));
  }

  // ── Chamados ────────────────────────────────────────────────────────────

  private async abrirChamado(remoteJid: string, texto: string, inst: string) {
    const user = await this.identificar(remoteJid);
    if (!user) { await this.wa.sendToJid(remoteJid, NAO_VINCULADO, inst).catch(() => {}); return; }
    const descricao = texto.trim();
    if (descricao.length < 5) {
      await this.responder(remoteJid, user.telefone, user.organizationId, inst,
        "🎧 Me conte o que está acontecendo, assim: *Chamado: a impressora não liga*");
      return;
    }
    const primeiraLinha = descricao.split(/\n/)[0];
    const titulo = primeiraLinha.length <= 80 ? primeiraLinha : primeiraLinha.slice(0, 77) + "...";
    const ch = await (this.prisma as any).chamado.create({
      data: {
        id: require("crypto").randomUUID(),
        organizationId: user.organizationId,
        titulo, descricao, solicitanteId: user.id,
        status: "aberto", prioridade: "media",
      },
      select: { numero: true, titulo: true },
    });
    await this.responder(remoteJid, user.telefone, user.organizationId, inst,
      `🎧 Abri o chamado *#${ch.numero}*\n*${ch.titulo}*\n\nJá está na fila. Para acompanhar, mande *meus chamados*. ✅`);
  }

  private async listarMeusChamados(remoteJid: string, inst: string) {
    const user = await this.identificar(remoteJid);
    if (!user) { await this.wa.sendToJid(remoteJid, NAO_VINCULADO, inst).catch(() => {}); return; }
    const lista = await (this.prisma as any).chamado.findMany({
      where: { solicitanteId: user.id, status: { notIn: ["resolvido", "fechado"] } },
      orderBy: { criadoEm: "desc" }, take: 8,
      select: { numero: true, titulo: true, status: true },
    });
    if (!lista.length) {
      await this.responder(remoteJid, user.telefone, user.organizationId, inst,
        "🎧 Você não tem chamados em aberto. Para abrir um, mande *Chamado: o que está acontecendo*.");
      return;
    }
    const rotulo: Record<string, string> = {
      aberto: "na fila", em_atendimento: "em atendimento", aguardando: "aguardando você",
    };
    const linhas = lista.map((x: any) => `• *#${x.numero}* ${x.titulo} — ${rotulo[x.status] || x.status}`);
    await this.responder(remoteJid, user.telefone, user.organizationId, inst,
      "🎧 *Seus chamados em aberto:*\n\n" + linhas.join("\n"));
  }

  // ── Conhecimento ────────────────────────────────────────────────────────

  private async buscarConhecimento(remoteJid: string, termo: string, inst: string) {
    const user = await this.identificar(remoteJid);
    if (!user) { await this.wa.sendToJid(remoteJid, NAO_VINCULADO, inst).catch(() => {}); return; }
    const q = termo.trim();
    if (q.length < 2) {
      await this.responder(remoteJid, user.telefone, user.organizationId, inst,
        "📚 Me diga o que procurar, assim: *Buscar: VPN*");
      return;
    }
    // Só artigos PUBLICADOS: rascunho é trabalho em andamento de alguém, não
    // resposta para quem perguntou.
    const artigos = await (this.prisma as any).artigoConhecimento.findMany({
      where: {
        organizationId: user.organizationId, status: "publicado",
        OR: [
          { titulo: { contains: q, mode: "insensitive" } },
          { resumo: { contains: q, mode: "insensitive" } },
          { conteudo: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { visualizacoes: "desc" }, take: 5,
      select: { titulo: true, resumo: true },
    });
    if (!artigos.length) {
      await this.responder(remoteJid, user.telefone, user.organizationId, inst,
        `📚 Não achei nada sobre *${q}*.\n\nTente menos palavras — *VPN* costuma achar mais que a frase inteira.`);
      return;
    }
    const linhas = artigos.map((x: any) => {
      const r = x.resumo ? `\n  _${String(x.resumo).slice(0, 90)}_` : "";
      return `• *${x.titulo}*${r}`;
    });
    await this.responder(remoteJid, user.telefone, user.organizationId, inst,
      `📚 *Sobre "${q}" eu achei:*\n\n` + linhas.join("\n\n") +
      "\n\nOs artigos completos estão em *Conhecimento*, no sistema.");
  }

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
    acaoUtil("GASTO_REGISTRADO");
    this.logger.log(`Gasto criado via WhatsApp: user=${user.id}`);

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

    // Alerta de orçamento (só se este gasto CRUZOU 80% ou 100% da meta da categoria).
    await this.alertaMeta(user, parsed.categoria, parsed.valor, remoteJid, inst).catch(() => {});
  }

  private async alertaMeta(
    user: { id: string; organizationId: string; telefone: string | null },
    categoria: string | null, valor: number, remoteJid: string, inst: string,
  ) {
    if (!categoria) return;
    const meta = await (this.prisma as any).metaGasto.findFirst({
      where: { organizationId: user.organizationId, userId: user.id, categoria },
    }).catch(() => null);
    if (!meta) return;
    const limite = Number(meta.limiteMensal);
    if (limite <= 0) return;
    const agora = new Date();
    const mes0 = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
    const mesFim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59, 999);
    const agg = await (this.prisma as any).gasto.aggregate({
      where: { organizationId: user.organizationId, userId: user.id, categoria, dataGasto: { gte: mes0, lte: mesFim } },
      _sum: { valor: true },
    }).catch(() => null);
    const total = Number(agg?._sum?.valor || 0);
    const antes = total - valor;
    let msg: string | null = null;
    if (antes < limite && total >= limite) {
      msg = `🔴 *Orçamento de ${categoria} estourado!*\nJá são R$ ${this.fmtValor(total)} de R$ ${this.fmtValor(limite)} este mês.`;
    } else if (antes < limite * 0.8 && total >= limite * 0.8) {
      msg = `🟠 *${categoria}: você já usou ${Math.round((total / limite) * 100)}% do orçamento.*\nR$ ${this.fmtValor(total)} de R$ ${this.fmtValor(limite)} este mês.`;
    }
    if (msg) await this.responder(remoteJid, user.telefone, user.organizationId, inst, msg);
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

  // "parar resumo" / "voltar resumo" — liga/desliga o resumo semanal de gastos.
  private async configurarResumo(remoteJid: string, desligar: boolean, inst: string) {
    const user = await this.identificar(remoteJid);
    if (!user) { await this.wa.sendToJid(remoteJid, NAO_VINCULADO, inst).catch(() => {}); return; }
    await this.prisma.userProfile.update({
      where: { userId: user.id }, data: { resumoGastosOff: desligar } as any,
    }).catch(() => {});
    await this.responder(remoteJid, user.telefone, user.organizationId, inst,
      desligar
        ? "🔕 Ok! Não te mando mais o resumo semanal de gastos. Para voltar, é só mandar *voltar resumo*."
        : "🔔 Pronto! Volto a te mandar o resumo semanal de gastos.");
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
    this.logger.log(`Gasto corrigido via WhatsApp: user=${user.id} id=${ultimo.id}`);

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

  private async tratarInicio(remoteJid: string, inst: string, texto: string): Promise<boolean> {
    const normal=texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    const acesso=/^(acesso|recuperar acesso|minha conta)$/.test(normal);
    const abrir=/^(comecar|primeiros passos|organizar)$/.test(normal);
    if (!acesso && !abrir && !await this.inicio.temFluxo(remoteJid,inst)) return false;
    const user=await this.identificar(remoteJid);
    if (!user) {
      await this.wa.sendToJid(remoteJid,"Para começar, envie *cadastro*. Se já tem conta, vincule seu WhatsApp pelo código do seu Perfil.",inst);
      return true;
    }
    if (acesso) { await this.inicio.enviarAcesso(user.id,inst); return true; }
    if (abrir) await this.prisma.$executeRaw`DELETE FROM whatsapp_previas WHERE user_id=${user.id} AND instancia=${inst} AND conversa=${remoteJid}`;
    const perms=await this.auth.resolvePermissions(user.id).catch(()=>[] as string[]);
    return this.inicio.fluxo(user,remoteJid,inst,texto,perms,(tipo,dados)=>{
      if(tipo === "evento") {
        const p=parseComandoEvento("Evento: Compromisso "+dados.resposta,new Date());
        if(!p || p === "sem_data_hora" || p.recorrencia) return null;
        const registro={titulo:dados.titulo,inicio:p.inicio.toISOString(),fim:p.fim?.toISOString()||null,diaTodo:p.diaTodo};
        const quando=p.diaTodo?p.inicio.toLocaleDateString("pt-BR")+" (dia todo)":p.inicio.toLocaleString("pt-BR");
        return {tipo,resumo:"🗓️ *"+dados.titulo+"*\n"+quando,registro};
      }
      const p=parseComandoGasto("Gasto: "+dados.valor+" "+dados.resposta,new Date());
      if(!p || p === "sem_valor") return null;
      return {tipo,resumo:"💸 *"+dados.titulo+"*\nR$ "+this.fmtValor(p.valor)+" · "+FORMA_LABEL[p.formaPagamento]+"\n"+p.dataGasto.toLocaleDateString("pt-BR"),
        registro:{...p,descricao:dados.titulo,dataGasto:p.dataGasto.toISOString()}};
    },async acao=>{
      const atuais=await this.auth.resolvePermissions(user.id).catch(()=>[] as string[]);
      if(acao.tipo === "gasto") {
        await this.criarGasto(user,{...acao.registro,dataGasto:new Date(acao.registro.dataGasto)},"Passo a passo pelo WhatsApp",remoteJid,inst);
        return;
      }
      if(!podeAgenda(atuais)) { await this.responder(remoteJid,user.telefone,user.organizationId,inst,"Seu acesso à Agenda mudou. Envie *menu* para continuar.");return; }
      const p=acao.registro;
      await this.prisma.event.create({data:{...p,tipo:"COMPROMISSO" as any,cor:"#22d3ee",userId:user.id,criadoPorId:user.id,organizationId:user.organizationId} as any});
      acaoUtil("COMPROMISSO_CRIADO");
      await this.responder(remoteJid,user.telefone,user.organizationId,inst,"✅ Compromisso criado: *"+p.titulo+"*\n"+new Date(p.inicio).toLocaleString("pt-BR")+"\nEnvie *compromissos* para consultar ou *começar* para organizar outro item.");
    });
  }

  async processar(body: any): Promise<void> {
    const mensagens = Array.isArray(body?.data) ? body.data : [body?.data];
    for (const data of mensagens) {
      const key = data?.key;
      if (typeof key?.id !== "string" || !key.id || typeof key?.remoteJid !== "string" || !key.remoteJid) {
        this.logger.warn("Mensagem ignorada: identificador ausente.");
        continue;
      }
      if (key.fromMe || key.remoteJid.includes("@g.us")) continue;
      const instancia = data?.owner || body?.instance || "orkestri-default";
      if (typeof instancia !== "string") continue;
      const resultado = await executarMensagemUmaVez(this.prisma,
        { instancia, conversa: key.remoteJid, mensagemId: key.id },
        () => this.processarMensagem({ ...body, data }), { instance: instancia, data });
      if (resultado === "revisar") this.logger.error("Mensagem requer revisão: " + key.id);
    }
  }

  async reprocessarSeguro(recibo: any): Promise<void> {
    const body = abrirMensagem(recibo.payload_protegido);
    const key = body?.data?.key;
    if (key?.id !== recibo.mensagem_id || key?.remoteJid !== recibo.conversa || body?.instance !== recibo.instancia || key?.fromMe) throw new Error("Recibo inválido");
    const user = await this.identificar(recibo.conversa);
    if (!user || user.id !== recibo.user_id || user.organizationId !== recibo.organization_id) throw new Error("Identidade mudou");
    if (await this.contexto.obter(user, recibo.instancia, recibo.conversa) !== recibo.contexto) throw new Error("Contexto mudou");
    await executarComRecibo(this.prisma, { instancia: recibo.instancia, conversa: recibo.conversa, mensagemId: recibo.mensagem_id }, () => this.processarMensagem(body));
  }

  private async processarMensagem(body: any): Promise<void> {
    // Evolution v1.8.2 — evento messages.upsert
    const data = Array.isArray(body?.data) ? body.data[0] : body?.data;
    const key = data?.key || {};
    const remoteJid: string = key?.remoteJid || "";
    // Responder SEMPRE pela instância que RECEBEU a mensagem (vem no payload como
    // owner/instance). O default do serviço é "orkestri", que está desconectada —
    // usar ele fazia a confirmação falhar com 500 "Connection Closed".
    const inst: string = data?.owner || body?.instance || "orkestri-default";
    if (!remoteJid || remoteJid.includes("@g.us")) return; // grupo — ignora
    let texto: string = (
      data?.message?.conversation ||
      data?.message?.extendedTextMessage?.text ||
      data?.message?.ephemeralMessage?.message?.extendedTextMessage?.text || ""
    ).trim();

    this.logger.log(`inbound fromMe=${!!key?.fromMe} caracteres=${texto.length}`);
    let forcarPrevia = false;
    const usuarioEntrada = await this.identificar(remoteJid);
    if (usuarioEntrada) {
      const atual = await this.contexto.obter(usuarioEntrada, inst, remoteJid);
      await identificarExecucao(usuarioEntrada, atual);
      const media = await this.media.tratar(data, usuarioEntrada, inst, remoteJid, atual);
      if (media.consumido) return;
      if (media.transcricao) {
        if (await this.contexto.obter(usuarioEntrada, inst, remoteJid) !== atual) {
          await this.wa.sendToJid(remoteJid,"O contexto mudou enquanto o áudio era transcrito. Envie novamente no contexto desejado.",inst); return;
        }
        texto = media.transcricao; forcarPrevia = true;
      }
    } else if (!texto && data?.message) {
      await this.wa.sendToJid(remoteJid,"Para enviar áudio ou anexos, primeiro cadastre ou vincule sua conta. Envie *cadastro* para começar.",inst);
    }
    if (!texto) return;

    // ── Cadastro em andamento? ANTES de tudo. ─────────────────────────────────
    //
    // Quem está preenchendo o formulário ainda NÃO é usuário: `identificar()`
    // devolveria null e a pessoa receberia "você não está vinculado" no meio do
    // próprio cadastro. Pior, o e-mail que ela mandou cairia nos parsers de
    // evento e de gasto, que responderiam "não entendi".
    //
    // Por isso este bloco vem primeiro, e não depois dos comandos: enquanto a
    // conversa de cadastro está aberta, TODA mensagem daquele número é resposta
    // de formulário. Só mensagem que CHEGOU — um texto enviado pelo próprio
    // número do bot (fromMe) não responde formulário de ninguém.
    if (!key?.fromMe) {
      try {
        const numero = remoteJid.split("@")[0];
        const cadastro = await this.cadastroWhats.conversaAberta(numero);
        if (cadastro) {
          if (await this.cadastroWhats.tratarResposta(cadastro, texto, inst)) return;
        } else if (pareceInteresseEmCadastro(texto)) {
          // Chegou querendo se cadastrar e nao tem conversa aberta. O servico
          // decide se abre: devolve false quando o numero JA tem conta, e ai a
          // mensagem segue para os comandos normais — quem ja e cliente
          // escrevendo "quero criar uma conta" quase sempre quer outra coisa.
          if (await this.cadastroWhats.iniciarPeloChat(numero, inst)) return;
        }
      } catch (e: any) {
        // Falha aqui não pode engolir a mensagem de quem JÁ é usuário: segue
        // para os comandos normais em vez de deixar a pessoa sem resposta.
        this.logger.warn(`cadastro-whatsapp: ${e?.message || e}`);
      }
    }

    const usuarioContexto = usuarioEntrada;
    if (usuarioContexto) {
      const solicitado = forcarPrevia ? null : contextoSolicitado(texto);
      if (solicitado) {
        await this.contexto.trocar(usuarioContexto, inst, remoteJid, solicitado);
        this.fecharMenu(remoteJid);
        await this.wa.sendToJid(remoteJid, this.contexto.mensagem(solicitado) + "\nRascunhos anteriores cancelados. Envie *menu* para continuar.", inst);
        return;
      }
      const atual = await this.contexto.obter(usuarioContexto, inst, remoteJid);
      await identificarExecucao(usuarioContexto, atual);
      if (atual === "PESSOAL") {
        const inicioAberto = await this.inicio.temFluxo(remoteJid, inst);
        if (inicioAberto && forcarPrevia) {
          await this.wa.sendToJid(remoteJid,"Você está preenchendo um registro passo a passo. Responda por texto ou envie *cancelar* antes de iniciar uma ação por áudio.",inst); return;
        }
        if (!inicioAberto) {
        const linguagem = await this.linguagem.tratar(usuarioContexto.id, inst, remoteJid, texto, comando => {
          if (comando.length > 1000 || /[\r\n]/.test(comando)) return null;
          const agora = new Date();
          const dataBR = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
          if (/^tarefa:/i.test(comando)) {
            const p = dataTarefa(comando.replace(/^tarefa:\s*/i, ""), agora);
            if (!p) return null;
            const dia = p.dia.split("-").reverse().join("/");
            return { comando: `tarefa: ${p.titulo} ${dia}`, resumo: `Tarefa: *${p.titulo}*\nData: ${dia}` };
          }
          if (/^Evento:/i.test(comando)) {
            if (!/(?:hoje|amanh[aã]|\d{1,2}\/\d{1,2})/i.test(comando)) return null;
            const p = parseComandoEvento(comando, agora);
            if (!p || p === "sem_data_hora" || p.recorrencia) return null;
            const quando = dataBR(p.inicio) + (p.diaTodo ? "" : " " + p.inicio.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }));
            return { comando: `Evento: ${p.titulo} ${quando}`, resumo: `Compromisso: *${p.titulo}*\nQuando: ${quando}${p.diaTodo ? " (dia todo)" : ""}` };
          }
          const valores = comando.replace(/\d{1,2}\/\d{1,2}(?:\/\d{4})?/g, "").replace(/\d{1,2}\s*(?:x|vezes)\b/gi, "").match(/\d[\d.,]*/g);
          if (valores?.length !== 1) return null;
          const p = parseComandoGasto(comando, agora, true);
          if (!p || p === "sem_valor" || !Number.isFinite(p.valor) || p.valor <= 0) return null;
          const forma = { PIX: "pix", CREDITO: "crédito", DEBITO: "débito", DINHEIRO: "dinheiro", BOLETO: "boleto", NAO_INFORMADO: "" }[p.formaPagamento];
          return { comando: `Gasto: ${p.descricao} R$ ${p.valor.toFixed(2).replace(".", ",")} ${forma} ${p.parcelas}x ${dataBR(p.dataGasto)}`,
            resumo: `Gasto: *${p.descricao}*\nValor total: R$ ${p.valor.toFixed(2).replace(".", ",")}\nPagamento: ${forma || "não informado"} · ${p.parcelas} parcela(s)\nData: ${dataBR(p.dataGasto)}` };
        }, forcarPrevia);
        if (linguagem.consumido) return;
        if (linguagem.comando) texto = linguagem.comando;
        }
        const nota = /^(?:\/?(?:nota|anota|lembrete)|(?:minhas\s+)?notas?\b|(?:excluir|apagar|remover)\s+(?:a\s+)?(?:nota|anota))/i.test(texto);
        if (nota) {
          const p = await this.auth.resolvePermissions(usuarioContexto.id);
          const required = /^(?:excluir|apagar|remover)/i.test(texto) ? "keep:deletar"
            : /^(?:minhas\s+)?notas?[.!?]*$/i.test(texto) ? "keep:ver" : "keep:criar";
          if (!p.includes("*") && !p.includes(required)) {
            await this.wa.sendToJid(remoteJid, "🔒 Sua conta não tem permissão para esta operação no Keep.", inst); return;
          }
        }
      }
      if (/^contexto[.!?]*$/i.test(texto)) {
        await this.wa.sendToJid(remoteJid, this.contexto.mensagem(atual), inst); return;
      }
      if (atual === "PESSOAL" && comandoEmpresarial(texto)) {
        await this.wa.sendToJid(remoteJid, "👤 Você está no *contexto pessoal*. Envie *empresa* e repita o comando para trabalhar na sua organização.", inst); return;
      }
      if (atual === "EMPRESA") {
        if (await this.equipe.tratar(usuarioContexto, inst, remoteJid, texto)) return;
        if (/^(?:oi|olá|ola|ajuda|menu|voltar|9|7)[.!?]*$/i.test(texto)) {
          await this.wa.sendToJid(remoteJid, this.contexto.mensagem(atual) + "\n\n*projetos* — seus projetos\n*projeto: Nome* — criar projeto\n*meus chamados* — acompanhar chamados\n*contas a pagar* — consultar contas\n*conta: Energia 350 vence 10/11* — lançar conta\n\nAs operações exigem as permissões do sistema.", inst); return;
        }
        const neutro = /^(?:acesso|vincular\s|renovar\s|indica|ork-|0$)/i.test(texto);
        if (!neutro && !comandoEmpresarial(texto)) {
          await this.wa.sendToJid(remoteJid, "🏢 Você está no *contexto empresa*. Para agenda, gastos, notas e tarefas pessoais, envie *pessoal*. Para os comandos da organização, envie *menu*.", inst); return;
        }
        if (!neutro) {
          const p = await this.auth.resolvePermissions(usuarioContexto.id);
          const necessario = /conta/i.test(texto) ? "financeiro:ver"
            : /^(?:buscar|procurar|pesquisar|busca)/i.test(texto) ? "conhecimento:ver"
            : /(?:chamado|ticket|suporte)/i.test(texto) ? "chamados:ver" : "projetos:ver";
          if (!p.includes("*") && !p.includes(necessario)) {
            await this.wa.sendToJid(remoteJid, "🔒 Sua conta não tem permissão para consultar este módulo da empresa.", inst); return;
          }
        }
      }
    }

    if (comandoRotina(texto)) {
      const user=await this.identificar(remoteJid);
      if (!user) { await this.wa.sendToJid(remoteJid,"Primeiro envie *cadastro* ou vincule sua conta pelo Perfil para usar sua rotina.",inst); return; }
      await this.rotina.tratar(user.id,inst,texto);
      return;
    }

    if (!key?.fromMe && await this.tratarInicio(remoteJid,inst,texto)) return;

    // Cadastro, rascunhos e confirmações já tiveram prioridade. Fora deles,
    // encerrar e voltar ao menu funcionam mesmo após o estado ter expirado.
    if (/^\/?0\s*[?!.]*$/.test(texto)) {
      this.fecharMenu(remoteJid);
      const msg = "👋 Combinado! Encerrei nossa conversa. Para voltar, envie *menu* ou *9*.";
      if (usuarioEntrada) await this.responder(remoteJid,usuarioEntrada.telefone,usuarioEntrada.organizationId,inst,msg);
      else await this.wa.sendToJid(remoteJid,msg,inst);
      return;
    }

    // ── Ajuda? "ajuda"/"menu"/"voltar (ao menu)" — a Aurélia abre o menu de módulos.
    //    "voltar"/"menu" funcionam mesmo depois do estado expirar. ──
    if (/^\/?(9|oi|ol[aá]|bom dia|boa tarde|boa noite|ajuda|help|menu(?: principal)?|voltar(?: ao menu(?: principal)?)?)\s*[?!.]*$/i.test(texto)) {
      await this.enviarAjuda(remoteJid, inst);
      return;
    }

    // ── Resposta ao menu da Aurélia (1/2/9/0)? Só interpretamos como escolha quando
    //    o menu está aberto para esta conversa — senão um "1" solto seria roubado.
    //    9 = voltar ao menu principal; 0 = encerrar. ──
    if (this.noMenu(remoteJid) && /^\/?[0-9]\s*[?!.]*$/.test(texto)) {
      await this.responderMenu(remoteJid, texto.replace(/\D/g, ""), inst);
      return;
    }

    // ── Resposta ao aviso de fim do teste? "1" (renovar) / "2" (não) / "RENOVAR <código>" ──
    //    Só mensagem que CHEGOU: um "1" digitado no celular do bot, na conversa
    //    com a pessoa (fromMe), não pode efetivar a conta dela.
    const renov = key?.fromMe ? null : interpretarRespostaRenovacao(texto);
    if (renov) {
      const jidAlt: string = key?.remoteJidAlt || key?.senderPn || "";
      if (await this.tratarRenovacao(remoteJid, jidAlt, renov, inst)) return;
    }

    if (/^\d+(?:[.,]\d+)?$/.test(texto)) {
      const msg = "Para usar as opções, envie *menu* e escolha um número. Para registrar um gasto, informe a descrição e o valor, por exemplo: *Gasto: Mercado 50 pix*.";
      if (usuarioEntrada) await this.responder(remoteJid,usuarioEntrada.telefone,usuarioEntrada.organizationId,inst,msg);
      else await this.wa.sendToJid(remoteJid,NAO_VINCULADO,inst);
      return;
    }

    // ── Ligar/desligar o resumo semanal de gastos ──
    const mResumo = texto.match(/^\/?(parar|desligar|cancelar|voltar|ligar|ativar)\s+(?:o\s+)?resumo\b/i);
    if (mResumo) { await this.configurarResumo(remoteJid, /^(parar|desligar|cancelar)/i.test(mResumo[1]), inst); return; }

    // ── Vínculo? "VINCULAR <código>" ──
    const mVinc = texto.match(/^vincular\s+([a-z0-9]{4,10})$/i);
    if (mVinc) { await this.vincular(remoteJid, mVinc[1].toUpperCase(), inst); return; }

    // ── Indicação? "INDICACAO ORK-XXXX" ou só "ORK-XXXX" (código sempre tem ORK-). ──
    let codInd: string | null = null;
    const mIndKey = texto.match(/^(?:indica[çc][aã]o|indicado(?: por)?|vim por)\s+(.+)$/i);
    if (mIndKey) codInd = mIndKey[1].trim();
    else if (/^ORK-?[a-z0-9]{4,10}$/i.test(texto)) codInd = texto.trim();
    if (codInd) { await this.registrarIndicacaoWhats(remoteJid, codInd, inst); return; }

    // ── Comandos dos módulos que entraram em 20/10/2026 ──────────────────
    //
    // Ficam ANTES do relatório e dos parsers de gasto/evento porque todos
    // exigem uma palavra-chave explícita no começo ("Nota:", "Chamado:",
    // "Buscar:"), enquanto aqueles tentam adivinhar pelo formato do texto.
    // Invertida a ordem, "Nota: gastei 50 no mercado" viraria despesa.

    // Keep
    const mNota = texto.match(/^\/?(?:nota|anota(?:r|ção|cao)?|lembrete)\s*[:\-]?\s*([\s\S]+)$/i);
    if (mNota) { await this.criarNota(remoteJid, mNota[1], inst); return; }
    if (/^\/?(?:minhas\s+)?notas?\b[.!?]*$/i.test(texto)) { await this.listarNotas(remoteJid, inst); return; }

    // Agenda: listar e excluir (criar é o parseComandoEvento, mais abaixo)
    if (/^\/?(?:meus\s+)?compromissos?\b[.!?]*$/i.test(texto) || /^\/?(?:minha\s+)?agenda\b[.!?]*$/i.test(texto)) {
      await this.listarCompromissos(remoteJid, inst); return;
    }
    const mDelEvento = texto.match(/^\/?(?:excluir|apagar|cancelar|remover)\s+(?:o\s+)?(?:compromisso|evento)\s+(\d{1,2})\b/i);
    if (mDelEvento) { await this.excluirCompromisso(remoteJid, Number(mDelEvento[1]), inst); return; }

    // Keep: excluir
    const mDelNota = texto.match(/^\/?(?:excluir|apagar|remover)\s+(?:a\s+)?(?:nota|anota[çc][ãa]o)\s+(\d{1,2})\b/i);
    if (mDelNota) { await this.excluirNota(remoteJid, Number(mDelNota[1]), inst); return; }

    // Projetos
    const mProj = texto.match(/^\/?(?:projeto|novo projeto|criar projeto)\s*[:\-]\s*([\s\S]+)$/i);
    if (mProj) { await this.criarProjeto(remoteJid, mProj[1], inst); return; }
    if (/^\/?(?:meus\s+)?projetos?\b[.!?]*$/i.test(texto)) { await this.listarProjetos(remoteJid, inst); return; }
    if (/^\/?(?:minhas\s+)?tarefas?\b[.!?]*$/i.test(texto)) { await this.listarMinhasTarefas(remoteJid, inst); return; }

    // Finance: contas a pagar. O relatório vem ANTES da criação, senão
    // "relatório de contas" cairia no parser de criar conta.
    if (/^\/?(?:relat[óo]rio|resumo)\s+(?:de\s+)?contas?\b[.!?]*$/i.test(texto)) { await this.relatorioContas(remoteJid, inst); return; }
    if (/^\/?contas?(?:\s+a\s+pagar)?\b[.!?]*$/i.test(texto)) { await this.listarContas(remoteJid, inst); return; }
    const mConta = texto.match(/^\/?(?:conta|nova conta|lan[çc]ar conta)\s*[:\-]\s*([\s\S]+)$/i);
    if (mConta) { await this.criarConta(remoteJid, mConta[1], inst); return; }

    // Chamados
    const mCham = texto.match(/^\/?(?:chamado|abrir chamado|suporte|ticket)\s*[:\-]?\s*([\s\S]+)$/i);
    if (mCham) { await this.abrirChamado(remoteJid, mCham[1], inst); return; }
    if (/^\/?(?:meus\s+)?chamados?\b[.!?]*$/i.test(texto)) { await this.listarMeusChamados(remoteJid, inst); return; }

    // Conhecimento
    const mBusca = texto.match(/^\/?(?:buscar|procurar|pesquisar|busca)\s*[:\-]?\s*([\s\S]+)$/i);
    if (mBusca) { await this.buscarConhecimento(remoteJid, mBusca[1], inst); return; }

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

      const perms = await this.auth.resolvePermissions(user.id).catch(() => [] as string[]);
      if (!podeAgenda(perms)) {
        await this.responder(remoteJid, user.telefone, user.organizationId, inst,
          "🔒 Sua conta não tem permissão para criar eventos. Peça ao administrador acesso à *Agenda*.");
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
      acaoUtil("COMPROMISSO_CRIADO");
      this.logger.log(`Evento criado via WhatsApp: user=${user.id}`);

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

    // ── Nada casou explicitamente. Última chance: gasto SEM a palavra "Gasto:"
    //    (ex.: "Mercado 150 crédito"). Só tentamos se houver número no texto, para
    //    não bater no banco a cada "bom dia". ──
    if (!/\d/.test(texto)) {
      if (usuarioEntrada) await this.responder(remoteJid,usuarioEntrada.telefone,usuarioEntrada.organizationId,inst,
        "🤖 Não entendi essa mensagem. Envie *menu* ou *9* para ver as opções disponíveis.");
      return;
    }
    const dono = await this.identificar(remoteJid);
    if (!dono) return;
    const perms = await this.auth.resolvePermissions(dono.id).catch(() => [] as string[]);
    if (!podeGastos(perms)) return; // sem Financeiro, não há o que fazer aqui

    const gastoCru = parseComandoGasto(texto, new Date(), false);
    const ehGasto = gastoCru && gastoCru !== "sem_valor";

    if (!podeAgenda(perms)) {
      // Só-Gastos: atalho total — qualquer texto com valor vira gasto.
      if (ehGasto) await this.criarGasto(dono, gastoCru as ParsedGasto, texto, remoteJid, inst);
      return;
    }

    // Tem os DOIS módulos: como o evento SEMPRE exige a palavra "Evento", um texto
    // sem palavra-chave só pode ser gasto ou conversa fiada. Anotamos direto quando
    // há sinal claro de gasto (forma de pagamento reconhecida: pix, cartão, crédito,
    // débito, dinheiro, boleto). Se for ambíguo (número solto), respondemos uma dica
    // em vez de ficar mudo.
    if (ehGasto && (gastoCru as ParsedGasto).formaPagamento !== "NAO_INFORMADO") {
      await this.criarGasto(dono, gastoCru as ParsedGasto, texto, remoteJid, inst);
      return;
    }
    await this.responder(remoteJid, dono.telefone, dono.organizationId, inst,
      "🤖 Não entendi. 💸 Para anotar um gasto: *Gasto: Cartão Nubank 400 pix*.\n🗓️ Para um compromisso: *Evento: Médico amanhã 14h*.\nOu mande *ajuda*.");
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
    try { await this.svc.processar(body); } catch { this.logger.error("Persistência de entrada indisponível."); throw new ServiceUnavailableException("Tente novamente"); }
    return { received: true };
  }
}

@Module({
  imports: [NotificationsModule, AuthModule, ReferralModule, CadastroWhatsappModule],
  controllers: [WhatsappInboundController, WhatsappOperacaoController, WhatsappAnexosController],
  providers: [WhatsappInboundService, { provide: "WHATSAPP_INBOUND", useExisting: WhatsappInboundService }, WhatsappRotinaService, WhatsappContextoService, WhatsappEquipeService, WhatsappLinguagemService, WhatsappMediaService],
})
export class WhatsappInboundModule {}
