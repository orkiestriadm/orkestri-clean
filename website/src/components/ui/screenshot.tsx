import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Imagem de produto em card premium.
 *
 * Segue `image-style.md`: card de 24px, borda fina, profundidade por gradiente
 * e sombra premium, com hover de scale(1.04) + translateY(-4px) em 250ms.
 *
 * A profundidade vem de três camadas discretas, nunca de um efeito só forte:
 *   1. halo quente atrás do card (a cor da marca "vazando" para o fundo);
 *   2. fio de luz na borda superior, que dá o acabamento de vidro;
 *   3. reflexo curto abaixo, sugerido por gradiente — sem duplicar a imagem.
 *
 * width/height obrigatórios: reservam o espaço e evitam layout shift (CLS).
 */
export function Screenshot({
  src,
  alt,
  width,
  height,
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
}) {
  return (
    <figure className={cn("group relative", className)}>
      {/* 1. Halo quente — respira junto com o hover */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -inset-x-6 -bottom-4 -top-2 rounded-[44px] blur-2xl",
          "bg-[radial-gradient(60%_60%_at_50%_50%,rgba(249,115,22,0.16),transparent_70%)]",
          "opacity-60 transition-opacity duration-[400ms] group-hover:opacity-100"
        )}
      />

      {/* 2. Card */}
      <div
        className={cn(
          "relative overflow-hidden rounded-[24px] border border-gray-200/70 bg-white",
          "shadow-soft transition-[transform,box-shadow] duration-[250ms] ease-[--ease-out-quart]",
          "group-hover:-translate-y-1 group-hover:scale-[1.04] group-hover:shadow-soft-lg",
          "motion-reduce:transition-none motion-reduce:group-hover:transform-none"
        )}
      >
        {/* Fio de luz na borda superior — acabamento de vidro */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent"
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
      </div>

      {/* 3. Reflexo sugerido — some rápido, só assenta o card no fundo */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none mx-auto h-10 w-[88%] rounded-[50%] blur-xl",
          "bg-[radial-gradient(50%_100%_at_50%_0%,rgba(15,23,42,0.14),transparent_70%)]",
          "transition-opacity duration-[250ms] group-hover:opacity-70"
        )}
      />
    </figure>
  );
}
