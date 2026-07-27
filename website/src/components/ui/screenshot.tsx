import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Captura real da plataforma dentro de uma moldura discreta.
 * Doc 06 exige imagens reais — nunca mockups genéricos.
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
    <figure
      className={cn(
        "overflow-hidden rounded-[--radius-image] border border-gray-200 bg-white shadow-soft-lg",
        className
      )}
    >
      {/* Barra superior — dá contexto de "aplicação" sem imitar um navegador real */}
      <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50/80 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-gray-200" />
        <span className="h-2.5 w-2.5 rounded-full bg-gray-200" />
        <span className="h-2.5 w-2.5 rounded-full bg-gray-200" />
        <span className="ml-3 select-none text-[11px] font-medium text-gray-400">
          Orkiestri One
        </span>
      </div>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        /* Capturas de interface são densas em texto miúdo: o padrão (q=75)
           borra as letras e o `sizes` estreito fazia o navegador escolher um
           candidato pequeno demais. Pede um recorte grande e alta qualidade. */
        quality={92}
        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 95vw, 1280px"
        className="h-auto w-full"
      />
    </figure>
  );
}
