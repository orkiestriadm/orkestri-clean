"use client";

import { useRef, type MouseEvent } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Imagem de produto em card premium.
 *
 * Segue `image-style.md` (glassmorphism, soft reflections, premium shadows,
 * hover scale + translateY em 250ms) empilhando efeitos discretos:
 *   1. malha de luz quente atrás do card — a marca vazando para o fundo;
 *   2. trama de pontos, que dá textura técnica sem competir com a imagem;
 *   3. borda em gradiente, acendendo no laranja da marca no topo;
 *   4. perspectiva: o card nasce levemente inclinado e se endireita no hover;
 *   5. holofote que acompanha o cursor sobre a superfície;
 *   6. reflexo curto, que assenta o card no fundo.
 *
 * `tilt` controla a inclinação. Nas páginas de produto a captura precisa ser
 * lida, então usa-se um valor baixo; no hero, onde a imagem é sobretudo
 * vitrine, vale um ângulo maior.
 *
 * width/height obrigatórios: reservam o espaço e evitam layout shift (CLS).
 */
export function Screenshot({
  src,
  alt,
  width,
  height,
  priority = false,
  tilt = 4,
  className,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  /** Graus de rotação em X quando em repouso. 0 desliga a perspectiva. */
  tilt?: number;
  className?: string;
}) {
  const surface = useRef<HTMLDivElement>(null);

  /* Holofote: guarda a posição do cursor em variáveis CSS. Fica só no CSS,
     sem estado React — nada de re-render a cada pixel de movimento. */
  const trackPointer = (e: MouseEvent<HTMLElement>) => {
    const el = surface.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  return (
    <figure
      onMouseMove={trackPointer}
      className={cn("group relative [perspective:1600px]", className)}
    >
      {/* 1. Malha de luz quente */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -inset-x-10 -bottom-8 -top-6 rounded-[56px] blur-3xl",
          "bg-[radial-gradient(45%_55%_at_25%_25%,rgba(249,115,22,0.38),transparent_70%),radial-gradient(45%_55%_at_78%_65%,rgba(251,146,60,0.30),transparent_70%)]",
          "opacity-70 transition-opacity duration-500 group-hover:opacity-100"
        )}
      />

      {/* 2. Trama de pontos — textura técnica, some nas bordas */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-6 -inset-y-4 opacity-[0.18] [mask-image:radial-gradient(ellipse_at_center,#000_35%,transparent_75%)]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(15,23,42,0.5) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      {/* 3. Borda em gradiente (1px) envolvendo o card */}
      <div
        className={cn(
          "relative rounded-[25px] p-px",
          "bg-[linear-gradient(160deg,rgba(249,115,22,0.55),rgba(229,231,235,0.9)_38%,rgba(229,231,235,0.7))]",
          "shadow-soft transition-[transform,box-shadow] duration-[280ms] ease-[--ease-out-quart]",
          "group-hover:shadow-soft-lg",
          /* A inclinação sai de uma variável para que o hover e o
             prefers-reduced-motion apenas a zerem — evita disputa de
             `transform` entre classe utilitária e estilo inline. */
          "[transform:perspective(1600px)_rotateX(var(--tilt))_translateY(var(--lift,0px))_scale(var(--zoom,1))]",
          "[--lift:0px] [--zoom:1] group-hover:[--tilt:0deg] group-hover:[--lift:-8px] group-hover:[--zoom:1.03]",
          "motion-reduce:[--tilt:0deg] motion-reduce:[--lift:0px] motion-reduce:[--zoom:1] motion-reduce:transition-none"
        )}
        style={{ "--tilt": `${tilt}deg` } as React.CSSProperties}
      >
        {/* 4. Superfície do card */}
        <div
          ref={surface}
          className="relative overflow-hidden rounded-[24px] bg-white"
        >
          {/* Fio de luz na borda superior — acabamento de vidro */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-white to-transparent"
          />

          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            priority={priority}
            /* Capturas de interface são densas em texto miúdo: o padrão (q=75)
               borra as letras e um `sizes` estreito faria o navegador escolher
               um candidato pequeno demais. */
            quality={92}
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 95vw, 1280px"
            className="h-auto w-full"
          />

          {/* 5. Holofote seguindo o cursor */}
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 z-10 opacity-0 mix-blend-soft-light",
              "transition-opacity duration-300 group-hover:opacity-100 motion-reduce:hidden",
              "bg-[radial-gradient(260px_circle_at_var(--mx,50%)_var(--my,50%),rgba(255,255,255,0.9),transparent_65%)]"
            )}
          />
        </div>
      </div>

      {/* 6. Reflexo — assenta o card no fundo */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none mx-auto mt-2 h-12 w-[85%] rounded-[50%] blur-2xl",
          "bg-[radial-gradient(50%_100%_at_50%_0%,rgba(15,23,42,0.22),transparent_72%)]",
          "transition-all duration-[280ms] group-hover:w-[92%] group-hover:opacity-80"
        )}
      />
    </figure>
  );
}
