"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Screenshot } from "@/components/ui/screenshot";
import { products } from "@/config/products";
import { cn } from "@/lib/utils";

/**
 * Carrossel das telas da plataforma.
 *
 * O avanço é sempre do usuário — setas, indicadores, arrastar ou teclado. O
 * doc 06 veta carrossel automático, e com razão: girar sozinho rouba a atenção
 * de quem está lendo.
 *
 * A rolagem é nativa, com `scroll-snap`. Sai de graça o arrasto no touch, a
 * inércia e o encaixe; ao JavaScript resta apenas mover para um índice e
 * saber qual slide está visível — este último via IntersectionObserver, que
 * não paga o custo de um listener de scroll.
 *
 * Cada slide reaproveita o card de captura, então continua valendo abrir a
 * imagem em tela cheia para ver detalhes.
 */
export function ScreensCarousel() {
  const telas = products.filter((p) => p.screenshot);
  const trilho = useRef<HTMLUListElement>(null);
  const [atual, setAtual] = useState(0);

  const irPara = useCallback((i: number) => {
    const slide = trilho.current?.children[i] as HTMLElement | undefined;
    // `scrollIntoView` em vez de calcular a partir de offsetLeft: aquele valor
    // é relativo ao ancestral posicionado, o que dá margem a erro conforme o
    // layout ao redor muda. `block: "nearest"` impede que a página role na
    // vertical junto.
    slide?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, []);

  // Qual slide está à vista — sem listener de scroll.
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
      { root: t, threshold: 0.6 }
    );
    Array.from(t.children).forEach((c) => obs.observe(c));
    return () => obs.disconnect();
  }, [telas.length]);

  const navegarPorTeclado = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      irPara(Math.min(atual + 1, telas.length - 1));
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      irPara(Math.max(atual - 1, 0));
    }
  };

  if (telas.length === 0) return null;
  const tela = telas[atual];

  return (
    <div
      className="relative"
      role="group"
      aria-roledescription="carrossel"
      aria-label="Telas da plataforma Orkiestri One"
      onKeyDown={navegarPorTeclado}
    >
      {/* Trilho */}
      <ul
        ref={trilho}
        tabIndex={0}
        className={cn(
          "flex snap-x snap-mandatory gap-6 overflow-x-auto pb-2",
          // Esconde a barra: a navegação é pelos controles, e a barra
          // atravessaria o card.
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        )}
      >
        {telas.map((p, i) => (
          <li
            key={p.slug}
            className="w-full shrink-0 snap-center"
            aria-label={`${i + 1} de ${telas.length}: ${p.name}`}
          >
            <Screenshot {...p.screenshot!} zoomOnHover={false} />
          </li>
        ))}
      </ul>

      {/* Legenda do slide à vista */}
      <div className="mt-6 flex flex-col items-center gap-1 text-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">
          {tela.category}
        </span>
        <p className="text-lg font-semibold text-dark">{tela.name}</p>
        <p className="max-w-md text-[0.9375rem] text-gray-500">{tela.tagline}</p>
      </div>

      {/* Controles */}
      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => irPara(Math.max(atual - 1, 0))}
          disabled={atual === 0}
          aria-label="Tela anterior"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-dark transition-colors hover:border-primary hover:text-primary disabled:opacity-35 disabled:hover:border-gray-200 disabled:hover:text-dark"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>

        <ul className="flex items-center gap-2">
          {telas.map((p, i) => (
            <li key={p.slug}>
              <button
                type="button"
                onClick={() => irPara(i)}
                aria-label={`Ir para ${p.name}`}
                aria-current={i === atual}
                className={cn(
                  "block h-2 rounded-full transition-all duration-200",
                  i === atual
                    ? "w-6 bg-primary"
                    : "w-2 bg-gray-300 hover:bg-gray-400"
                )}
              />
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => irPara(Math.min(atual + 1, telas.length - 1))}
          disabled={atual === telas.length - 1}
          aria-label="Próxima tela"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-dark transition-colors hover:border-primary hover:text-primary disabled:opacity-35 disabled:hover:border-gray-200 disabled:hover:text-dark"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {/* Anuncia a troca para leitores de tela sem roubar o foco */}
      <p aria-live="polite" className="sr-only">
        {`Tela ${atual + 1} de ${telas.length}: ${tela.name}`}
      </p>
    </div>
  );
}
