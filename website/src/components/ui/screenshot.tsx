"use client";

import { useRef, type MouseEvent } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Imagem de produto em card premium, ampliável em galeria.
 *
 * Segue `image-style.md` (glassmorphism, soft reflections, premium shadows,
 * hover scale + translateY) empilhando efeitos discretos:
 *   1. malha de luz quente atrás do card — a marca vazando para o fundo;
 *   2. trama de pontos, que dá textura técnica sem competir com a imagem;
 *   3. borda em gradiente, acendendo no laranja da marca no topo;
 *   4. holofote que acompanha o cursor sobre a superfície;
 *   5. reflexo curto, que assenta o card no fundo.
 *
 * Clicar abre a captura em tela cheia, onde é possível alternar entre
 * "caber na tela" e tamanho real — necessário porque a interface do produto
 * tem texto miúdo que se perde na miniatura.
 *
 * O Dialog do Radix cuida de foco preso, Esc e semântica ARIA.
 *
 * width/height obrigatórios: reservam o espaço e evitam layout shift (CLS).
 */
export function Screenshot({
  src,
  alt,
  width,
  height,
  priority = false,
  zoomOnHover = true,
  uniform = false,
  className,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  /** Desligue dentro de contêineres com rolagem: a ampliação transbordaria. */
  zoomOnHover?: boolean;
  /**
   * Enquadra em 16:9, como pede o image-style.md. As capturas variam de 1,5 a
   * 2,9 de proporção; sem isto, cada uma teria uma altura, e lado a lado o
   * conjunto fica desalinhado. O fundo branco esconde as faixas, porque as
   * telas do produto também são brancas.
   */
  uniform?: boolean;
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
    <Dialog.Root>
      <figure onMouseMove={trackPointer} className={cn("group relative", className)}>
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

        <Dialog.Trigger asChild>
          <button
            type="button"
            aria-label={`Ampliar imagem: ${alt}`}
            className={cn(
              "relative block w-full cursor-zoom-in rounded-[25px] p-px text-left",
              /* Borda neutra e discreta, no espírito do doc 06 ("border fina").
                 O contorno em gradiente laranja marcava demais o retângulo e
                 competia com a própria tela do produto. */
              "bg-gray-200/60",
              "shadow-soft transition-[transform,box-shadow] duration-[280ms] ease-[--ease-out-quart]",
              "group-hover:shadow-soft-lg",
              "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary",
              /* O `transform` fica no estilo inline e só lê variáveis; as classes
                 abaixo apenas trocam essas variáveis. Assim o hover e o
                 prefers-reduced-motion funcionam sem disputar a propriedade. */
              "[--lift:0px] [--zoom:1]",
              zoomOnHover
                ? "group-hover:[--lift:-10px] group-hover:[--zoom:1.07]"
                : "group-hover:[--lift:-4px]",
              "motion-reduce:[--lift:0px] motion-reduce:[--zoom:1] motion-reduce:transition-none"
            )}
            style={
              {
                transform: "translateY(var(--lift,0px)) scale(var(--zoom,1))",
              } as React.CSSProperties
            }
          >
            {/* Superfície do card */}
            <div
              ref={surface}
              className="relative overflow-hidden rounded-[24px] bg-white"
            >
              {/* Fio de luz na borda superior — acabamento de vidro */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-white to-transparent"
              />

              <div
                className={cn(
                  "relative",
                  uniform && "aspect-[16/9] w-full bg-white"
                )}
              >
                <Image
                  src={src}
                  alt={alt}
                  width={width}
                  height={height}
                  priority={priority}
                  /* Capturas de interface são densas em texto miúdo: o padrão
                     (q=75) borra as letras e um `sizes` estreito faria o
                     navegador escolher um candidato pequeno demais. */
                  quality={92}
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 95vw, 1280px"
                  className={cn(
                    uniform ? "h-full w-full object-contain" : "h-auto w-full"
                  )}
                />
              </div>

              {/* Dissolve a base no branco da seção: sem isto a aresta do card
                  desenha um risco separando a imagem do conteúdo abaixo. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16 bg-gradient-to-t from-white via-white/70 to-transparent"
              />

              {/* Holofote seguindo o cursor */}
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-0 z-10 opacity-0 mix-blend-soft-light",
                  "transition-opacity duration-300 group-hover:opacity-100 motion-reduce:hidden",
                  "bg-[radial-gradient(260px_circle_at_var(--mx,50%)_var(--my,50%),rgba(255,255,255,0.9),transparent_65%)]"
                )}
              />

              {/* Dica de ampliação — aparece no hover */}
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute bottom-4 right-4 z-20 inline-flex items-center gap-1.5",
                  "rounded-full border border-white/15 bg-dark/75 px-3 py-1.5 text-xs font-medium text-white",
                  "opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100"
                )}
              >
                <ZoomIn className="h-3.5 w-3.5" />
                Ampliar
              </span>
            </div>
          </button>
        </Dialog.Trigger>

        {/* 5. Reflexo — assenta o card no fundo */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none mx-auto mt-2 h-12 w-[85%] rounded-[50%] blur-2xl",
            "bg-[radial-gradient(50%_100%_at_50%_0%,rgba(15,23,42,0.22),transparent_72%)]",
            "transition-all duration-[280ms] group-hover:w-[92%] group-hover:opacity-80"
          )}
        />
      </figure>

      {/* ── Galeria em tela cheia ─────────────────────────────────────────── */}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-dark/85 backdrop-blur-md data-[state=closed]:opacity-0 data-[state=open]:opacity-100 transition-opacity duration-200" />
        <Dialog.Content
          className={cn(
            "fixed inset-0 z-[100] flex flex-col outline-none",
            "data-[state=open]:animate-none"
          )}
        >
          <Dialog.Title className="sr-only">{alt}</Dialog.Title>

          {/* Barra de ações — só o fechar. A imagem já abre grande, então o
              alternador de tamanho virava um passo extra sem ganho. */}
          <div className="flex shrink-0 items-center justify-between gap-4 px-4 py-3 md:px-6">
            <p className="line-clamp-1 text-sm text-white/70">{alt}</p>
            <Dialog.Close
              aria-label="Fechar"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <X className="h-5 w-5" aria-hidden />
            </Dialog.Close>
          </div>

          {/* Palco — a imagem ocupa toda a área livre; se for maior que a tela,
              a rolagem permite percorrer os detalhes. */}
          <div className="flex-1 overflow-auto px-4 pb-6 md:px-6">
            <div className="mx-auto w-fit overflow-hidden rounded-[20px] border border-white/10 shadow-soft-lg">
              <Image
                src={src}
                alt={alt}
                width={width}
                height={height}
                quality={95}
                sizes="100vw"
                className="h-auto w-auto max-w-none"
              />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
