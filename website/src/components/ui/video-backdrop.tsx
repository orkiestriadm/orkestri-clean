"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Vídeo decorativo de fundo para seções escuras.
 *
 * O elemento é sempre renderizado (inclusive no HTML do servidor) e as
 * proteções ficam em CSS — nada depende de estado para o vídeo existir:
 * - `hidden md:block` mantém fora de telas pequenas (com `display:none` o
 *   navegador não baixa o arquivo);
 * - `motion-reduce:hidden` respeita prefers-reduced-motion (doc 08).
 *
 * O efeito abaixo só dá um empurrão no play: o atributo `autoplay` sozinho
 * não é confiável — mesmo mudo, alguns navegadores deixam o vídeo pausado.
 * Se a política de autoplay recusar, a seção continua íntegra sem o vídeo.
 *
 * Sempre mudo e em loop — o doc 06 veta vídeo disputando atenção com o
 * conteúdo, então aqui ele é textura, nunca protagonista.
 */
export function VideoBackdrop({
  src,
  className,
  opacity = 0.18,
}: {
  src: string;
  className?: string;
  opacity?: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Sem checagem de visibilidade: `offsetParent` é null para elementos
    // absolutos sob ancestrais transformados, e a guarda acabava impedindo o
    // play justamente onde ele era necessário. Quando o CSS esconde o vídeo,
    // o próprio navegador já não renderiza nem baixa o arquivo.
    ref.current?.play().catch(() => {});
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden
      tabIndex={-1}
      className={cn(
        "pointer-events-none absolute inset-0 hidden h-full w-full object-cover md:block motion-reduce:hidden",
        className
      )}
      style={{ opacity }}
    />
  );
}
