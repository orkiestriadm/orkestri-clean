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
     🔴 `anualAtivo` continua FALSE, e o motivo MUDOU em 03/11/2026.

     O backend já sabe cobrar um ano: o plano virou dado da cobrança, o
     preapproval aceita frequência de doze meses, a Aurélia oferece a opção 3
     e `aplicarPagamentoConfirmado` concede doze meses em vez de um. São 572
     testes passando, incluindo o par que trava o erro caro — um pagamento
     anual não pode conceder um mês, nem um mensal conceder doze.

     O que falta é PUBLICAR esse backend. Enquanto a produção rodar a API sem
     o plano anual, ligar esta chave faz a pessoa escolher o anual e receber
     cobrança mensal — exatamente o que a chave existe para impedir.

     🔴 E o risco aqui é concreto, não teórico: este site já foi publicado
     sozinho quatro vezes em 03/11, sem tocar na API. Um deploy só do
     `website/` com a chave ligada quebra a promessa na hora.

     REGRA: virar true SOMENTE no mesmo release que publica a API com o plano
     anual, e conferindo a `/api/health` depois. */
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
