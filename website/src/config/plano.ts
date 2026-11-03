/**
 * O plano público, num lugar só.
 *
 * Espelha o sistema, e não material de marketing:
 *   - `backend/src/modules/auth/trial-renovacao.ts` → `VALOR_MENSALIDADE`
 *     (1190 centavos) e `VALOR_MENSALIDADE_LABEL` ("R$ 11,90");
 *   - `backend/src/modules/auth/auth.service.ts` → `TRIAL_DIAS = 7`;
 *   - o mesmo arquivo de renovação → `RENOVACAO_PRAZO_APOS_VENCER_MS`, os 15
 *     dias em que a conta ainda pode ser retomada depois de vencer.
 *
 * O valor vive numa constante porque preço escrito à mão no meio do texto é o
 * que envelhece primeiro: o site passa a anunciar um número que o checkout não
 * cobra, e ninguém percebe até alguém reclamar na conversa.
 */
export const PLANO = {
  /** Como o valor é escrito em toda a interface. */
  precoLabel: "R$ 11,90",
  /** Em centavos, igual ao backend. */
  precoCentavos: 1190,
  /** Para o JSON-LD, que exige número e não texto. */
  precoNumero: 11.9,
  /** Dias de teste antes da primeira cobrança. */
  testeDias: 7,
  /** Depois de vencer, a conta ainda pode ser retomada por este prazo. */
  retomadaDias: 15,

  /* ── Plano anual ────────────────────────────────────────────────────────
     🔴 `anualAtivo` é FALSE de propósito, e só deve virar true no dia em que
     o backend souber cobrar um ano.

     Hoje ele não sabe: `modules/assinatura/mercadopago.ts` cria o preapproval
     com `frequency: 1, frequency_type: "months"`, e `trial-renovacao.ts` só
     conhece `VALOR_MENSALIDADE` e `somarUmMes`. Publicar a oferta anual antes
     disso levaria a pessoa a escolher o anual e receber a cobrança mensal —
     é a mesma armadilha que fez o site anunciar contas a pagar depois de o
     módulo sair do sistema.

     A tela está pronta: ligar a chave publica o comparativo inteiro. */
  anualAtivo: false,
  anualLabel: "R$ 119,90",
  anualCentavos: 11990,
  anualNumero: 119.9,
  /** 119,90 ÷ 12, arredondado — o número que a pessoa compara com o mensal. */
  anualPorMesLabel: "R$ 9,99",
  /** 11,90 × 12 = 142,80, que é o preço cheio de doze meses avulsos. */
  anualCheioLabel: "R$ 142,80",
  /** 142,80 − 119,90. */
  anualEconomiaLabel: "R$ 22,90",
} as const;
