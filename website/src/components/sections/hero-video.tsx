"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Vitrine do produto no hero.
 *
 * Transparência: MP4 não carrega canal alfa, então o fundo claro do vídeo é
 * apagado por `mix-blend-mode: multiply` — sobre o branco da página, o creme
 * some e restam os painéis. Custa nada e funciona em todos os navegadores,
 * ao contrário de WebM com alfa (sem Safari) ou de recortar por rotoscopia.
 *
 * Movimento: acompanha a rolagem via scroll-driven animation (`media-parallax`,
 * em globals.css). Roda no compositor — sem listener de scroll nem trabalho por
 * quadro. Onde não há suporte, fica parado; sob prefers-reduced-motion, nem é
 * aplicado.
 *
 * Peso: o poster (11 KB) pinta de imediato e responde pelo LCP; o vídeo
 * (677 KB) entra depois, sem segurar a primeira pintura.
 */
export function HeroVideo({
  fill = false,
  className,
}: {
  /** Preenche a altura do contêiner, para uso como vitrine lateral. */
  fill?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Só a variante visível toca. Existem duas no DOM (desktop e mobile) e
    // decodificar a que está em display:none seria gasto puro de CPU.
    // offsetWidth zera com display:none — e, ao contrário de offsetParent,
    // não se confunde com ancestrais transformados.
    if (el.offsetWidth === 0) return;
    // O atributo autoplay sozinho não é confiável: mesmo mudo, parte dos
    // navegadores deixa o vídeo parado até um play() explícito.
    el.play().catch(() => {});
  }, []);

  return (
    <div
      className={cn(
        "media-parallax relative",
        fill ? "h-full w-full" : "",
        className
      )}
    >
      <video
        ref={ref}
        src="/media/telas.mp4"
        poster="/media/telas-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label="Telas do Orkiestri One: orçamento, chamados, abastecimentos e projetos"
        className={cn(
          "select-none mix-blend-multiply",
          fill
            ? "h-full w-full object-cover object-center"
            : "media-feather h-auto w-full"
        )}
      />

      {fill && (
        <>
          {/* Dissolve a borda esquerda no fundo, para o vídeo não terminar em
              linha reta sobre a coluna de texto. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-white via-white/60 to-transparent"
          />
          {/* Suaviza topo e base contra o limite da seção. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white to-transparent"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent"
          />
        </>
      )}
    </div>
  );
}
