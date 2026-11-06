import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PLANO } from "@/config/plano";

/**
 * A faixa acima do cabeçalho.
 *
 * O site não tinha nenhum elemento que respondesse "por que hoje?". Esta
 * faixa responde com o que é verdade o ano inteiro — o teste de
 * {PLANO.testeDias} dias e o preço — em vez de uma contagem regressiva
 * inventada. Quando houver campanha de verdade, é aqui que ela entra, e o
 * texto volta ao de sempre quando ela acabar.
 *
 * 🔴 **A altura vive em `--faixa-h`, no globals.css.** O cabeçalho é `fixed`,
 * então os dois heróis (`sections/hero.tsx` e `sections/page-hero.tsx`)
 * reservam espaço somando essa variável ao padding de topo. Mudar a altura
 * aqui sem mudar a variável faz o conteúdo passar por baixo do cabeçalho.
 */
export function FaixaTeste() {
  return (
    <div className="h-(--faixa-h) border-b border-white/[0.07] bg-[#120b06]">
      <div className="container-content flex h-full items-center justify-center gap-x-2.5 gap-y-0 text-[0.8125rem] leading-none">
        <span className="truncate text-chalk-dim">
          <strong className="font-semibold text-ember">
            {PLANO.testeDias} dias de teste
          </strong>
          <span className="hidden sm:inline">
            {" "}
            — sem cartão. Depois, {PLANO.precoLabel} por mês com tudo liberado.
          </span>
        </span>
        <Link
          href="/planos"
          className="group inline-flex shrink-0 items-center gap-1 font-semibold text-chalk underline decoration-white/25 decoration-1 underline-offset-4 transition-colors hover:text-ember hover:decoration-ember/60"
        >
          Ver o plano
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
            aria-hidden
          />
        </Link>
      </div>
    </div>
  );
}
