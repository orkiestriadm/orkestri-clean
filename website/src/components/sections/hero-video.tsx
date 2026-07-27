"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Vitrine do produto no hero.
 *
 * O vídeo tem fundo claro próprio, então as bordas são esfumaçadas por máscara
 * (`media-feather`) em vez de recortadas — recortar painéis de vidro exigiria
 * rotoscopia, cara e frágil, enquanto a máscara funde na página a custo zero.
 *
 * O movimento acompanha a rolagem via scroll-driven animation (`media-parallax`,
 * em globals.css): roda no compositor, sem listener de scroll nem trabalho por
 * quadro. Onde o navegador não suporta, a imagem apenas fica parada.
 *
 * Peso: o poster (11 KB) aparece de imediato e responde pelo LCP; o vídeo
 * (677 KB) entra depois, sem segurar a primeira pintura.
 */
export function HeroVideo({ className }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // O atributo autoplay sozinho não é confiável: mesmo mudo, parte dos
    // navegadores deixa o vídeo parado até um play() explícito.
    ref.current?.play().catch(() => {});
  }, []);

  return (
    <div className={cn("media-parallax", className)}>
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
        className="media-feather h-auto w-full select-none"
      />
    </div>
  );
}
