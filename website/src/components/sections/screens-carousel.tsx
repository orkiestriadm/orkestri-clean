"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Screenshot } from "@/components/ui/screenshot";
import { products } from "@/config/products";
import { cn } from "@/lib/utils";

/**
 * Carrossel das telas da plataforma.
 *
 * Todas as capturas são enquadradas em 16:9 (`uniform`), como pede o
 * image-style.md — elas variam de 1,5 a 2,9 de proporção e, sem o
 * enquadramento, cada slide teria uma altura diferente.
 *
 * Os controles flutuam sobre a imagem, translúcidos com desfoque: assim o
 * conjunto ocupa a altura da própria tela, sem a faixa de comandos empurrando
 * o conteúdo para baixo. Ficam fora do card — dentro dele seriam botões
 * aninhados, já que o card inteiro abre a galeria.
 *
 * O avanço é sempre do usuário — setas, indicadores, arrastar ou teclado. O
 * doc 06 veta carrossel automático: girar sozinho rouba a atenção de quem lê.
 *
 * A rolagem é nativa, com `scroll-snap`, então arrasto e inércia saem de
 * graça; ao JavaScript resta mover para um índice e saber qual slide está
 * visível, este via IntersectionObserver — sem listener de scroll.
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
      { root: t, threshold: 0.6 },
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

  const seta =
    "pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full " +
    "border border-white/40 bg-white/70 text-dark shadow-soft backdrop-blur-md " +
    "transition-all hover:bg-white hover:text-primary " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
    "disabled:pointer-events-none disabled:opacity-0";

  return (
    <div
      className="relative"
      role="group"
      aria-roledescription="carrossel"
      aria-label="Telas da plataforma Orkiestri One"
      onKeyDown={navegarPorTeclado}
    >
      {/* Área da imagem: as sobreposições se posicionam por ela, não pelo
          bloco inteiro — senão as setas centralizariam contando a legenda. */}
      <div className="relative">
        {/* Trilho */}
        <ul
          ref={trilho}
          tabIndex={0}
          className={cn(
            "flex snap-x snap-mandatory gap-6 overflow-x-auto",
            // Esconde a barra: a navegação é pelos controles, e a barra
            // atravessaria o card.
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
              <Screenshot {...p.screenshot!} uniform zoomOnHover={false} />
            </li>
          ))}
        </ul>

        {/* ── Controles sobre a imagem ─────────────────────────────────────── */}

        {/* Identificação do módulo */}
        <div className="pointer-events-none absolute left-4 top-4 z-10 sm:left-6 sm:top-6">
          <span className="inline-flex flex-col rounded-2xl border border-white/40 bg-white/70 px-4 py-2.5 shadow-soft backdrop-blur-md">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primary">
              {tela.category}
            </span>
            <span className="text-sm font-semibold text-dark">{tela.name}</span>
          </span>
        </div>

        {/* Setas nas laterais */}
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-10 flex items-center justify-between px-4 sm:px-6">
          <button
            type="button"
            onClick={() => irPara(Math.max(atual - 1, 0))}
            disabled={atual === 0}
            aria-label="Tela anterior"
            className={seta}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => irPara(Math.min(atual + 1, telas.length - 1))}
            disabled={atual === telas.length - 1}
            aria-label="Próxima tela"
            className={seta}
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {/* Indicadores na base */}
        <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 sm:bottom-6">
          <ul className="flex items-center gap-2 rounded-full border border-white/40 bg-white/70 px-3.5 py-2.5 shadow-soft backdrop-blur-md">
            {telas.map((p, i) => (
              <li key={p.slug}>
                <button
                  type="button"
                  onClick={() => irPara(i)}
                  aria-label={`Ir para ${p.name}`}
                  aria-current={i === atual}
                  className={cn(
                    "block h-1.5 rounded-full transition-all duration-200",
                    i === atual
                      ? "w-6 bg-primary"
                      : "w-1.5 bg-dark/25 hover:bg-dark/45",
                  )}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Descrição do módulo, fora da imagem para não competir com a tela */}
      <p className="mt-6 text-center text-[0.9375rem] text-gray-500">
        {tela.tagline}
      </p>

      {/* Anuncia a troca para leitores de tela sem roubar o foco */}
      <p aria-live="polite" className="sr-only">
        {`Tela ${atual + 1} de ${telas.length}: ${tela.name}`}
      </p>
    </div>
  );
}
