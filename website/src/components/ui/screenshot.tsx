import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Imagem de produto em card premium.
 *
 * Segue `image-style.md`: cantos de 24px, borda fina, sombra suave que
 * intensifica no hover, scale(1.04) + translateY(-4px) em 250ms. A moldura
 * imitando janela de navegador saiu — o guia pede ausência de ruído visual.
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
    <figure className={cn("group", className)}>
      <div
        className={cn(
          "overflow-hidden rounded-[24px] border border-gray-200/70 bg-white",
          "shadow-soft transition-[transform,box-shadow] duration-[250ms] ease-[--ease-out-quart]",
          "group-hover:-translate-y-1 group-hover:scale-[1.04] group-hover:shadow-soft-lg",
          "motion-reduce:transition-none motion-reduce:group-hover:transform-none"
        )}
      >
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
    </figure>
  );
}
