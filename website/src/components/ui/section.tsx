import { cn } from "@/lib/utils";
import { Container } from "./container";

/**
 * Section — alternates white / very-light-gray backgrounds (doc 06).
 * Generous vertical rhythm.
 */
export function Section({
  className,
  containerClassName,
  muted = false,
  as: Tag = "section",
  id,
  children,
}: {
  className?: string;
  containerClassName?: string;
  muted?: boolean;
  as?: React.ElementType;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <Tag
      id={id}
      className={cn(
        "py-20 md:py-28",
        muted && "bg-ink-raise",
        className
      )}
    >
      <Container className={containerClassName}>{children}</Container>
    </Tag>
  );
}

/**
 * Cabeçalho de seção.
 *
 * O rótulo em caixa alta acima do título SAIU (26/10/2026). O site tinha um
 * em cada seção de cada página — `PRODUTOS`, `PLATAFORMA`, `APLICAÇÕES`,
 * `VALORES`, `SOLUÇÕES`… — sempre dizendo o que o título logo abaixo já
 * dizia. É o adereço que mais faz uma página parecer montada em template.
 * A prop continua aceita porque quinze páginas a passam; ela simplesmente
 * não desenha mais nada.
 *
 * O alinhamento padrão virou à ESQUERDA, em duas colunas quando há texto de
 * apoio: título e descrição centrados num bloco estreito dão à página um ar
 * de slide de apresentação.
 */
export function SectionHeader({
  title,
  description,
  align = "left",
  className,
}: {
  /** Aceito e ignorado — ver o comentário acima. */
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  className?: string;
}) {
  const tituloEl = (
    <h2 className="font-display text-[1.875rem] font-bold leading-[1.1] tracking-[-0.03em] text-chalk [font-stretch:108%] md:text-[2.5rem]">
      {title}
    </h2>
  );

  if (align === "center") {
    return (
      <div className={cn("mx-auto flex max-w-2xl flex-col items-center gap-5 text-center", className)}>
        {tituloEl}
        {description && (
          <p className="text-[1.0625rem] leading-[1.65] text-chalk-dim">
            {description}
          </p>
        )}
      </div>
    );
  }

  if (!description) return <div className={className}>{tituloEl}</div>;

  return (
    <div
      className={cn(
        "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-16",
        className,
      )}
    >
      {tituloEl}
      <p className="text-[1.0625rem] leading-[1.65] text-chalk-dim lg:pt-1.5">
        {description}
      </p>
    </div>
  );
}
