import { createHash } from "crypto";
import { MARCA } from "../../common/marca";

// Renovação do acesso pelo WhatsApp — do teste de 7 dias e, depois, da
// mensalidade.
//
// Antes do fim da gratuidade a Aurélia avisa três vezes (3 dias, 1 dia e no
// próprio dia) com duas opções (1 = continuar, 2 = não quero). O "1" NÃO libera
// mais o acesso: ele devolve a cobrança de R$ 11,90 — link do cartão, que
// renova sozinho, e Pix para quem prefere pagar mês a mês. O mês só entra
// quando o Mercado Pago confirma o pagamento.
//
// Quem já está no cartão (renovação automática) não recebe aviso nenhum: o MP
// cobra e o webhook estica o acesso. Só ouve a Aurélia se a cobrança falhar.
//
// Sem pagamento, o login bloqueia quando vence, e dá para retomar por 15 dias.
//
// Aqui ficam só as regras e os textos, sem banco nem WhatsApp, para serem
// testáveis.

/** Antecedência do primeiro aviso, em dias de calendário. */
export const MARCOS_AVISO = [3, 1, 0] as const;

/** Antecedência máxima do aviso — usada para varrer candidatos no banco. */
export const LEMBRETE_ANTECEDENCIA_MS = 4 * 24 * 60 * 60 * 1000;

/** Depois de vencer, a pessoa ainda pode responder "1" por este prazo. */
export const RENOVACAO_PRAZO_APOS_VENCER_MS = 15 * 24 * 60 * 60 * 1000;

/** Valor da mensalidade, em centavos. Todos os módulos inclusos. */
export const VALOR_MENSALIDADE = 1190;

/** O valor escrito, num lugar só: mudar o preço não pode deixar texto velho. */
export const VALOR_MENSALIDADE_LABEL = "R$ 11,90";

/** Prazo do Pix antes de expirar. Curto o bastante para não virar fila eterna. */
export const PIX_VALIDADE_MS = 3 * 24 * 60 * 60 * 1000;

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

// O token do link de pagamento fica em `assinatura/checkout-token.ts`: ele
// precisa ser REVERSÍVEL (o servidor tem de saber de quem é o link sem varrer a
// tabela), e isso é outra natureza de código do que os hashes daqui.

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

/** Mês de referência da cobrança, "AAAA-MM", no fuso de quem paga. */
export function cicloDe(d: Date): string {
  return diaBRT(d).slice(0, 7); // "AAAA-MM-DD" → "AAAA-MM"
}

export type ContaRenovavel = {
  isTrial: boolean;
  trialExpiraEm: Date | null;
  assinaturaEm: Date | null;
  assinaturaValidaAte: Date | null;
  trialLembreteEm: Date | null;
  trialRenovacaoResposta?: string | null;
  trialRenovacaoRespostaEm?: Date | null;
  /// No cartão o MP cobra sozinho: a Aurélia não pede nada por WhatsApp.
  assinaturaRenovacaoAuto?: boolean;
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

/** O login deve barrar: venceu o teste (sem pagar) ou venceu o mês pago. */
export function acessoVencido(u: ContaRenovavel, agora: Date): boolean {
  const f = faseDaConta(u);
  return !!f && f.limite.getTime() < agora.getTime();
}

/** Dia no fuso de São Paulo, "AAAA-MM-DD" — para contar dias de calendário. */
function diaBRT(d: Date): string {
  // en-CA formata como AAAA-MM-DD, que é o que queremos comparar.
  return new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/**
 * Quantos dias de CALENDÁRIO faltam, no fuso de São Paulo. Contar em dias de
 * calendário (e não em horas) é o que faz "falta 1 dia" querer dizer "vence
 * amanhã" para quem lê, independente da hora em que o aviso sai.
 */
export function diasRestantes(limite: Date, agora: Date): number {
  const a = Date.parse(diaBRT(agora) + "T00:00:00Z");
  const b = Date.parse(diaBRT(limite) + "T00:00:00Z");
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

/**
 * Qual aviso cabe AGORA (3, 1, 0 dias) — ou null se hoje não é dia de avisar.
 * Quem está no cartão não recebe: o MP cobra sozinho.
 *
 * Não ter marco para "faltam 2 dias" é de propósito: três avisos num ciclo de
 * sete dias já é o limite do que não vira importunação.
 */
export function marcoDoAviso(u: ContaRenovavel, agora: Date): number | null {
  const f = faseDaConta(u);
  if (!f || u.assinaturaRenovacaoAuto) return null;
  // Já venceu: o aviso de "vence hoje" chegaria depois do fato. Quem está
  // vencido ouve outra coisa (a cobrança, ou o bloqueio no login).
  if (f.limite.getTime() <= agora.getTime()) return null;
  const dias = diasRestantes(f.limite, agora);
  return (MARCOS_AVISO as readonly number[]).includes(dias) ? dias : null;
}

/** Ainda dá para retomar: não venceu ou venceu há menos de 15 dias. */
export function podeRenovar(u: ContaRenovavel, agora: Date): boolean {
  const f = faseDaConta(u);
  return !!f && f.limite.getTime() + RENOVACAO_PRAZO_APOS_VENCER_MS > agora.getTime();
}

/**
 * O último aviso é do vencimento ATUAL? Serve para decidir se um "1" solto é
 * resposta ao aviso ou se é o "1" do menu da Aurélia. Aviso mandado dentro da
 * janela dos avisos deste limite conta; mais antigo é de um ciclo que já passou.
 */
export function avisoDoCicloAtual(u: ContaRenovavel): boolean {
  const f = faseDaConta(u);
  if (!f || !u.trialLembreteEm) return false;
  const maiorMarco = Math.max(...MARCOS_AVISO) + 1;
  return new Date(u.trialLembreteEm).getTime() >= f.limite.getTime() - maiorMarco * 24 * 60 * 60 * 1000;
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
  const m = t.match(/^\/?(renovar|quero renovar|renova[çc][aã]o|pagar)(?:\s+([a-z0-9]{6}))?\s*[?!.]*$/i);
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

/** Título do aviso conforme o quanto falta — o mesmo texto para 3, 1 e 0 dias
 * soaria automático demais na terceira vez. */
function tituloAviso(fase: Fase, marco: number): string {
  const oQue = fase === "TESTE" ? "teste" : "mensalidade";
  if (marco === 0) return fase === "TESTE" ? `⏳ *Hoje é o último dia do seu teste*` : `⏳ *Sua mensalidade vence hoje*`;
  if (marco === 1) return fase === "TESTE" ? `⏳ *Seu teste termina amanhã*` : `⏳ *Sua mensalidade vence amanhã*`;
  return `⏳ *Faltam ${marco} dias para o seu ${oQue} ${fase === "TESTE" ? "acabar" : "vencer"}*`;
}

export function montarLembrete(p: {
  fase: Fase; nome: string; modulo: string | null; limite: Date; codigo: string; marco: number;
  urlCheckout?: string;
}): string {
  const produto = produtoLabel(p.modulo);
  // Quem não quer conversa paga direto; quem quer, responde 1.
  const atalho = p.urlCheckout ? `Ou pague agora, sem responder nada:\n${p.urlCheckout}\n\n` : "";
  const rodape = `_Se o 1 não for reconhecido, envie: RENOVAR ${p.codigo}_`;
  const quando = fmtQuando(p.limite);
  if (p.fase === "TESTE") {
    return (
      `${tituloAviso("TESTE", p.marco)}\n\n` +
      `Olá, *${nomeCadastro(p.nome)}*! Aqui é a Aurélia, do ${MARCA}. Seus 7 dias de teste do *${produto}* acabam em *${quando}*.\n\n` +
      `Quer continuar? São *${VALOR_MENSALIDADE_LABEL} por mês*, com todos os módulos liberados.\n\n` +
      `*1* — Quero continuar\n` +
      `*2* — Não, obrigado\n\n` + atalho + rodape
    );
  }
  return (
    `${tituloAviso("MENSAL", p.marco)}\n\n` +
    `Olá, *${nomeCadastro(p.nome)}*! Aqui é a Aurélia, do ${MARCA}. Seu acesso ao *${produto}* vale até *${quando}*.\n\n` +
    `Quer seguir por mais um mês? São *${VALOR_MENSALIDADE_LABEL}*.\n\n` +
    `*1* — Quero renovar\n` +
    `*2* — Não, encerrar\n\n` + atalho + rodape
  );
}

/**
 * Resposta ao "1": a cobrança. Não promete acesso — o acesso vem quando o
 * pagamento cai. O Pix vai numa mensagem separada (`montarPixCopiaECola`),
 * porque código no meio de texto corrido não se copia no celular.
 */
export function montarCobranca(p: {
  nome: string; modulo: string | null; urlCheckout: string; temPix: boolean;
}): string {
  const pix = p.temPix
    ? `*Pix* — paga um mês de cada vez. O código vem na mensagem seguinte. 👇\n\n`
    : `*Pix* — se preferir pagar um mês de cada vez, escolha Pix na mesma página.\n\n`;
  return (
    `💳 *Falta só o pagamento*\n\n` +
    `São *${VALOR_MENSALIDADE_LABEL}* pelo próximo mês, ${nomeCadastro(p.nome)}. Escolha como pagar:\n\n` +
    `*Cartão* — renova sozinho todo mês, você não precisa lembrar:\n${p.urlCheckout}\n\n` +
    pix +
    `Assim que o pagamento cair, eu te aviso aqui e seu acesso segue liberado.`
  );
}

/** O copia-e-cola do Pix, sozinho na mensagem, para dar um toque e copiar. */
export function montarPixCopiaECola(codigo: string): string {
  return codigo;
}

/** Confirmação depois que o Mercado Pago aprovou o pagamento. */
export function montarPagamentoConfirmado(p: { nome: string; modulo: string | null; validaAte: Date; renovacaoAuto: boolean }): string {
  const fecho = p.renovacaoAuto
    ? `A renovação é automática no cartão — não precisa fazer nada no mês que vem.`
    : `No mês que vem eu te aviso de novo por aqui.`;
  return (
    `✅ *Pagamento confirmado!*\n\n` +
    `Seu acesso ao *${produtoLabel(p.modulo)}* está liberado até *${fmtDia(p.validaAte)}*, ${nomeCadastro(p.nome)}. ${fecho}\n\n` +
    `Qualquer coisa, é só me chamar aqui. 🧡`
  );
}

/** Cobrança no cartão que não passou — o MP tenta de novo, mas é melhor avisar. */
export function montarCobrancaFalhou(p: { nome: string; limite: Date; urlCheckout: string }): string {
  return (
    `⚠️ *Não conseguimos cobrar no seu cartão*\n\n` +
    `Olá, ${nomeCadastro(p.nome)}! A cobrança de *${VALOR_MENSALIDADE_LABEL}* não passou. ` +
    `Seu acesso vale até *${fmtDia(p.limite)}*.\n\n` +
    `Dá para trocar o cartão ou pagar no Pix aqui:\n${p.urlCheckout}`
  );
}

// Não há texto de "o Pix venceu": ninguém o dispararia. O prazo do Pix é do
// Mercado Pago, e um Pix expirado simplesmente deixa de contar como cobrança
// aberta — o "1" seguinte gera outro. Texto escrito sem quem o envie é promessa
// que o sistema não cumpre.

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
export const RESPOSTA_COBRANCA_PENDENTE =
  "🤖 A cobrança deste mês já está aberta — é só pagar no link ou no Pix que eu mandei aqui. Assim que cair, eu te aviso.";
export const RESPOSTA_PAGAMENTO_INDISPONIVEL =
  "🤖 Não consegui abrir o pagamento agora — o problema é do nosso lado. Nossa equipe já foi avisada e vai falar com você por aqui.";
export const RESPOSTA_PRAZO_ENCERRADO =
  "🤖 O prazo para renovar pelo WhatsApp já passou. Nossa equipe vai falar com você por aqui para liberar o acesso.";
export const RESPOSTA_CODIGO_INVALIDO =
  "🤖 Não encontrei esse código. Confira o código que veio no aviso de vencimento (ex.: *RENOVAR ABC123*).";
export const RESPOSTA_NAO_IDENTIFICADO =
  "🤖 Não reconheci o seu número. Se você está respondendo ao aviso de vencimento, envie *RENOVAR* seguido do código que está no fim da mensagem (ex.: *RENOVAR ABC123*).";
