"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { products } from "@/config/products";
import { cn } from "@/lib/utils";

/**
 * Carrossel das telas da plataforma, em cards de história.
 *
 * O formato segue a referência trazida pelo cliente (seção em carrossel da
 * home da microsoft.com): um card por módulo, texto à esquerda e imagem à
 * direita, com fio de borda e sem sombra. Três regras sustentam o resultado e
 * não devem ser afrouxadas:
 *
 *   1. Pouco texto. Título curto, UMA frase, UM botão. O card é grande e o
 *      conteúdo é mínimo — o vazio é parte do desenho. Um parágrafo a mais
 *      transforma isto em outra coisa.
 *   2. A imagem não sangra. Entra com respiro em volta, para ler como
 *      conteúdo do card e não como fundo dele.
 *   3. O botão fica ancorado na base. Assim o CTA cai na mesma altura em
 *      todos os cards, independentemente do tamanho do texto.
 *
 * Os controles ficam FORA do card, embaixo à esquerda — com texto e imagem
 * dividindo o card, sobrepô-los à imagem cobriria conteúdo.
 *
 * A navegação é manual, como na referência e como pede o doc 06, que veta
 * carrossel automático: quem lê decide quando avançar.
 *
 * A rolagem é nativa com `scroll-snap`, então arrasto e inércia saem de
 * graça; ao JavaScript resta mover para um índice e saber qual card está
 * visível, este via IntersectionObserver — sem listener de scroll.
 */
export function ScreensCarousel() {
  const telas = products.filter((p) => p.screenshot);
  const trilho = useRef<HTMLUListElement>(null);
  const [atual, setAtual] = useState(0);

  const irPara = useCallback((i: number) => {
    const card = trilho.current?.children[i] as HTMLElement | undefined;
    // `scrollIntoView` em vez de calcular por offsetLeft: aquele valor é
    // relativo ao ancestral posicionado e erra conforme o layout muda.
    // `block: "nearest"` impede a página de rolar na vertical junto.
    card?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, []);

  // Qual card está à vista — sem listener de scroll.
  useEffect(() => {
    const t = trilho.current;
    if (!t) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visivel) return;
        const i = Array.from(t.children).indexOf(visivel.target);
        if (i >= 0) setAtual(i);
      },
      { root: t, threshold: 0.6 },
    );
    Array.from(t.children).forEach((c) => obs.observe(c));
    return () => obs.disconnect();
  }, [telas.length]);

  const navegarPorTeclado = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      irPara((atual + 1) % telas.length);
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      irPara((atual - 1 + telas.length) % telas.length);
    }
  };

  if (telas.length === 0) return null;

  const seta =
    "inline-flex h-12 w-12 items-center justify-center rounded-full border border-gray-300 " +
    "text-dark transition-colors hover:border-dark hover:bg-gray-50 " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

  return (
    <div
      role="group"
      aria-roledescription="carrossel"
      aria-label="Telas da plataforma Orkiestri One"
      onKeyDown={navegarPorTeclado}
    >
      <ul
        ref={trilho}
        tabIndex={0}
        className={cn(
          "flex snap-x snap-mandatory gap-5 overflow-x-auto",
          // Esconde a barra: a navegação é pelos controles.
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary",
        )}
      >
        {telas.map((p, i) => (
          <li
            key={p.slug}
            className="w-full shrink-0 snap-center"
            aria-label={`${i + 1} de ${telas.length}: ${p.name}`}
          >
            {/* Fio de borda, sem sombra: o card é calmo, não flutua. */}
            <article className="h-full rounded-3xl border border-gray-200 bg-white p-6 md:p-8 lg:p-10">
              <div className="grid items-stretch gap-8 lg:grid-cols-2 lg:gap-12">
                {/* Texto. O botão vai para a base via `mt-auto`, de modo que
                    o CTA caia na mesma altura em todos os cards. */}
                <div className="flex flex-col lg:py-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                    {p.category}
                  </span>
                  <h3 className="mt-3 text-[1.75rem] font-semibold tracking-[-0.02em] text-dark lg:text-[2rem]">
                    {p.name}
                  </h3>
                  <p className="mt-4 max-w-md text-[1.0625rem] leading-relaxed text-gray-600">
                    {p.tagline}
                  </p>
                  <div className="mt-8 lg:mt-auto lg:pt-10">
                    <Button asChild>
                      <Link href={`/products/${p.slug}`}>Saiba mais</Link>
                    </Button>
                  </div>
                </div>

                {/* Imagem, inserida com respiro — não sangra até a borda. */}
                <div className="overflow-hidden rounded-2xl bg-gray-50">
                  <div className="relative aspect-[16/10] w-full">
                    <Image
                      src={p.screenshot!.src}
                      alt={p.screenshot!.alt}
                      fill
                      /* Capturas de interface são densas em texto miúdo: o
                         padrão (q=75) borra as letras. */
                      quality={92}
                      sizes="(max-width: 1024px) 100vw, 640px"
                      className="object-contain object-center"
                    />
                  </div>
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>

      {/* Controles fora do card, embaixo à esquerda. */}
      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={() => irPara((atual - 1 + telas.length) % telas.length)}
          aria-label="Tela anterior"
          className={seta}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => irPara((atual + 1) % telas.length)}
          aria-label="Próxima tela"
          className={seta}
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
        <span className="ml-2 text-sm tabular-nums text-gray-400">
          {atual + 1} / {telas.length}
        </span>
      </div>

      {/* Anuncia a troca para leitores de tela sem roubar o foco */}
      <p aria-live="polite" className="sr-only">
        {`Tela ${atual + 1} de ${telas.length}: ${telas[atual].name}`}
      </p>
    </div>
  );
}
