"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Vídeo decorativo de fundo para seções escuras.
 *
 * Só entra em cena quando não atrapalha:
 * - respeita `prefers-reduced-motion` (doc 08);
 * - não carrega em telas pequenas, onde custaria banda sem ganho;
 * - monta apenas depois da hidratação, para ficar fora do caminho do LCP.
 *
 * Sempre mudo e em loop — o doc 06 veta vídeo com autoplay disputando a
 * atenção do conteúdo, então aqui ele é textura, nunca protagonista.
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
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const motionOk = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const wideEnough = window.matchMedia("(min-width: 768px)");
    const decide = () => setEnabled(motionOk.matches && wideEnough.matches);

    decide();
    motionOk.addEventListener("change", decide);
    wideEnough.addEventListener("change", decide);
    return () => {
      motionOk.removeEventListener("change", decide);
      wideEnough.removeEventListener("change", decide);
    };
  }, []);

  if (!enabled) return null;

  return (
    <video
      src={src}
      autoPlay
      muted
      loop
      playsInline
      preload="none"
      aria-hidden
      tabIndex={-1}
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full object-cover",
        className
      )}
      style={{ opacity }}
    />
  );
}
