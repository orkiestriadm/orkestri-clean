import { createHash } from "crypto";
import { MARCA } from "../../common/marca";

// Renovação do acesso pelo WhatsApp — do teste de 7 dias e, depois, da
// mensalidade.
//
// Faltando um dia para o acesso vencer, a Aurélia manda um aviso com duas
// opções (1 = continuar, 2 = não quero). No TESTE, o "1" efetiva a conta na
// própria organização default — a mesma efetivação do painel de Indicações
// (R$ 27 + comissão do indicador, se houver) — e libera um mês. Na MENSALIDADE,
// o "1" libera mais um mês (a comissão é só da primeira efetivação). Sem
// resposta, o login bloqueia quando vence, e o "1" ainda vale por 15 dias.
//
// Aqui ficam só as regras e os textos, sem banco nem WhatsApp, para serem
// testáveis.

/** Antecedência do aviso: entra na fila quando faltam até 24 h. */
export const LEMBRETE_ANTECEDENCIA_MS = 24 * 60 * 60 * 1000;

/** Depois de vencer, a pessoa ainda pode responder "1" por este prazo. */
export const RENOVACAO_PRAZO_APOS_VENCER_MS = 15 * 24 * 60 * 60 * 1000;

/** Valor da mensalidade, em centavos (o mesmo do painel de Indicações). */
export const VALOR_MENSALIDADE = 2700;

export const PRODUTO_LABEL: Record<string, string> = {
  "one-desk": `${MARCA} One Desk`,
  "one-projects": `${MARCA} One Projects`,
  "one-space": `${MARCA} One Space`,
  "one-fleet": `${MARCA} One Fleet`,
  "one-assets": `${MARCA} One Assets`,
  "one-finance": `${MARCA} One Finance`,
  "one-budget": `${MARCA} One Budget`,
  "one-crm": `${MARCA} One CRM`,
  "one-observe": `${MARCA} One Observe`,
  "one-flow": `${MARCA} One Flow`,
  "one-core": `${MARCA} One Core`,
};

export const produtoLabel = (modulo: string | null | undefined) =>
  (modulo && PRODUTO_LABEL[modulo]) || MARCA;

/**
 * Código que vai no rodapé do aviso. Serve de reserva quando o WhatsApp entrega
 * a resposta por um LID que ainda não está ligado a nenhuma conta: "RENOVAR
 * <código>" identifica a conta sem depender do número. Salt próprio para não
 * coincidir com o código de vínculo nem com o de indicação.
 */
export function codigoRenovacao(userId: string): string {
  const secret = process.env.WHATSAPP_INBOUND_SECRET || process.env.JWT_SECRET || "orkiestri";
  return createHash("sha256").update(userId + "|renovacao|" + secret).digest("hex").slice(0, 6).toUpperCase();
}

/** Mesmo dia do mês seguinte; 31/01 vira 28 (ou 29)/02, não 03/03. */
export function somarUmMes(d: Date): Date {
  const r = new Date(d);
  const dia = r.getDate();
  r.setDate(1);
  r.setMonth(r.getMonth() + 1);
  const ultimo = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(dia, ultimo));
  return r;
}

/**
 * Até quando vale o próximo mês pago: conta a partir do fim do período atual
 * se ele ainda não acabou (quem renova na véspera não perde o dia que falta);
 * se já venceu, conta a partir de agora.
 */
export function proximaValidade(limiteAtual: Date | null, agora: Date): Date {
  const base = limiteAtual && new Date(limiteAtual).getTime() > agora.getTime() ? new Date(limiteAtual) : agora;
  return somarUmMes(base);
}

export type ContaRenovavel = {
  isTrial: boolean;
  trialExpiraEm: Date | null;
  assinaturaEm: Date | null;
  assinaturaValidaAte: Date | null;
  trialLembreteEm: Date | null;
  trialRenovacaoResposta?: string | null;
  trialRenovacaoRespostaEm?: Date | null;
};

export type Fase = "TESTE" | "MENSAL";

/**
 * Em que fase a conta está e qual é a data que vence.
 * - TESTE: ainda não efetivada; vence em `trialExpiraEm`.
 * - MENSAL: efetivada; vence em `assinaturaValidaAte`.
 * Efetivada ANTES da mensalidade existir (sem `assinaturaValidaAte`) fica fora
 * do ciclo: não recebe aviso nem bloqueia — a equipe cuida à mão.
 */
export function faseDaConta(u: ContaRenovavel): { fase: Fase; limite: Date } | null {
  if (!u.isTrial) return null;
  if (!u.assinaturaEm) return u.trialExpiraEm ? { fase: "TESTE", limite: new Date(u.trialExpiraEm) } : null;
  return u.assinaturaValidaAte ? { fase: "MENSAL", limite: new Date(u.assinaturaValidaAte) } : null;
}

/** O login deve barrar: venceu o teste (sem efetivar) ou venceu o mês pago. */
export function acessoVencido(u: ContaRenovavel, agora: Date): boolean {
  const f = faseDaConta(u);
  return !!f && f.limite.getTime() < agora.getTime();
}

/**
 * O último aviso é do vencimento ATUAL? Um único campo (`trialLembreteEm`)
 * serve a todos os ciclos: aviso mandado até 48 h antes do limite de agora é
 * deste ciclo; mais antigo que isso é de um ciclo que já foi renovado.
 */
export function avisoDoCicloAtual(u: ContaRenovavel): boolean {
  const f = faseDaConta(u);
  if (!f || !u.trialLembreteEm) return false;
  return new Date(u.trialLembreteEm).getTime() >= f.limite.getTime() - 2 * LEMBRETE_ANTECEDENCIA_MS;
}

/** O aviso sai uma vez por ciclo, quando faltam até 24 h para vencer. */
export function precisaLembrete(u: ContaRenovavel, agora: Date): boolean {
  const f = faseDaConta(u);
  if (!f || avisoDoCicloAtual(u)) return false;
  const falta = f.limite.getTime() - agora.getTime();
  return falta > 0 && falta <= LEMBRETE_ANTECEDENCIA_MS;
}

/** Ainda dá para renovar: não venceu ou venceu há menos de 15 dias. */
export function podeRenovar(u: ContaRenovavel, agora: Date): boolean {
  const f = faseDaConta(u);
  return !!f && f.limite.getTime() + RENOVACAO_PRAZO_APOS_VENCER_MS > agora.getTime();
}

export type RespostaRenovacao = { opcao: "RENOVAR" | "RECUSAR"; codigo: string | null };

/**
 * Lê a resposta ao aviso. `soNumero` indica se a mensagem foi só "1"/"2" — esse
 * formato só é tratado como renovação quando a pessoa recebeu o aviso (quem
 * decide é o chamador), para não roubar o "1" do menu da Aurélia.
 */
export function interpretarRespostaRenovacao(texto: string): (RespostaRenovacao & { soNumero: boolean }) | null {
  const t = (texto || "").trim();
  if (/^\/?1\s*[?!.]*$/.test(t)) return { opcao: "RENOVAR", codigo: null, soNumero: true };
  if (/^\/?2\s*[?!.]*$/.test(t)) return { opcao: "RECUSAR", codigo: null, soNumero: true };
  const m = t.match(/^\/?(renovar|quero renovar|renova[çc][aã]o)(?:\s+([a-z0-9]{6}))?\s*[?!.]*$/i);
  if (m) return { opcao: "RENOVAR", codigo: m[2] ? m[2].toUpperCase() : null, soNumero: false };
  return null;
}

const fmtQuando = (d: Date) =>
  new Date(d).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  }).replace(", ", " às ");

const fmtDia = (d: Date) =>
  new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

// Nome como está no cadastro (no acesso de teste, é o começo do e-mail).
const nomeCadastro = (nome: string) => (nome || "").trim();

export function montarLembrete(p: { fase: Fase; nome: string; modulo: string | null; limite: Date; codigo: string }): string {
  const produto = produtoLabel(p.modulo);
  const rodape = `_Se o 1 não for reconhecido, envie: RENOVAR ${p.codigo}_`;
  if (p.fase === "TESTE") {
    return (
      `⏳ *Seu teste termina amanhã*\n\n` +
      `Olá, *${nomeCadastro(p.nome)}*! Aqui é a Aurélia, do ${MARCA}. Seus 7 dias de teste do *${produto}* acabam em *${fmtQuando(p.limite)}*.\n\n` +
      `Quer continuar usando? Responda com o número:\n\n` +
      `*1* — Sim, quero continuar (R$ 27,00 por mês)\n` +
      `*2* — Não, obrigado\n\n` + rodape
    );
  }
  return (
    `⏳ *Sua mensalidade vence amanhã*\n\n` +
    `Olá, *${nomeCadastro(p.nome)}*! Aqui é a Aurélia, do ${MARCA}. Sua assinatura do *${produto}* vale até *${fmtQuando(p.limite)}*.\n\n` +
    `Quer renovar por mais um mês? Responda com o número:\n\n` +
    `*1* — Sim, renovar (R$ 27,00 por mês)\n` +
    `*2* — Não, encerrar\n\n` + rodape
  );
}

/** Resposta ao "1" no fim do TESTE (texto aprovado pelo usuário em 14/09/2026). */
export function montarRespostaEfetivou(p: { nome: string }): string {
  return (
    `✅ *Você acaba de ter seu acesso efetivado!*\n\n` +
    `Não se preocupe com o pagamento de imediato: nossa equipe entrará em contato e vai apresentar as opções.\n\n` +
    `Enquanto isso, desfrute do nosso sistema e aproveite para conhecer outros módulos que vão te ajudar a orquestrar a vida.\n\n` +
    `Valeu, ${nomeCadastro(p.nome)}!`
  );
}

/** Resposta ao "1" no fim de um MÊS pago. */
export function montarRespostaRenovouMes(p: { nome: string; modulo: string | null; validaAte: Date }): string {
  return (
    `✅ *Assinatura renovada!*\n\n` +
    `Seu acesso ao *${produtoLabel(p.modulo)}* segue liberado até *${fmtDia(p.validaAte)}*. ` +
    `Nossa equipe entrará em contato com as opções de pagamento da mensalidade.\n\n` +
    `Valeu, ${nomeCadastro(p.nome)}!`
  );
}

export function montarRespostaRecusou(p: { fase: Fase; nome: string; limite: Date; vencido: boolean; codigo: string }): string {
  const oQue = p.fase === "TESTE" ? "Obrigado por testar o " + MARCA + ". 🙏" : "Obrigado por ter usado o " + MARCA + ". 🙏";
  const sujeito = p.fase === "TESTE" ? "Seu teste" : "Sua assinatura";
  const quando = p.vencido ? "já terminou" : `vale até *${fmtQuando(p.limite)}*`;
  return (
    `Tudo bem, ${nomeCadastro(p.nome)}! ${oQue}\n\n` +
    `${sujeito} ${quando}. Se mudar de ideia, é só responder *1* ou enviar *RENOVAR ${p.codigo}* aqui.`
  );
}

export const RESPOSTA_JA_RENOVADO = "✅ Seu acesso já está renovado — não precisa fazer mais nada. Qualquer dúvida, é só chamar.";
export const RESPOSTA_PRAZO_ENCERRADO =
  "🤖 O prazo para renovar pelo WhatsApp já passou. Nossa equipe vai falar com você por aqui para liberar o acesso.";
export const RESPOSTA_CODIGO_INVALIDO =
  "🤖 Não encontrei esse código. Confira o código que veio no aviso de vencimento (ex.: *RENOVAR ABC123*).";
export const RESPOSTA_NAO_IDENTIFICADO =
  "🤖 Não reconheci o seu número. Se você está respondendo ao aviso de vencimento, envie *RENOVAR* seguido do código que está no fim da mensagem (ex.: *RENOVAR ABC123*).";
