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
        // Centraliza sem esticar: o elemento fica com a altura natural do
        // vídeo. Se ele fosse esticado (h-full + object-contain), sobrariam
        // faixas vazias e as bordas reais do vídeo cairiam no meio do
        // elemento, onde a máscara ainda é opaca — era o que desenhava as
        // linhas em cima e embaixo.
        fill ? "flex h-full w-full items-center" : "",
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
            ? // Altura natural (16:9), sem esticar: assim as bordas do vídeo
              // coincidem com as do elemento e a máscara dissolve todas elas.
              "hero-side-mask h-auto w-full"
            : "media-feather h-auto w-full"
        )}
      />
    </div>
  );
}
