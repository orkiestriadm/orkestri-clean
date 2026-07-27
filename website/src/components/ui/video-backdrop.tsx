import { cn } from "@/lib/utils";

/**
 * Vídeo decorativo de fundo para seções escuras.
 *
 * Renderiza no servidor e usa só CSS para se proteger — sem depender de
 * hidratação, que é justamente onde a versão anterior falhava:
 * - `hidden md:block` mantém fora de telas pequenas (não baixa o arquivo,
 *   porque `display:none` impede a carga);
 * - `motion-reduce:hidden` respeita prefers-reduced-motion (doc 08).
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
  return (
    <video
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
