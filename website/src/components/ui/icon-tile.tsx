import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "primary" | "dark" | "on-dark";
type Size = "sm" | "md" | "lg";

const sizes: Record<Size, { box: string; icon: string }> = {
  sm: { box: "h-9 w-9 rounded-[10px]", icon: "h-[18px] w-[18px]" },
  md: { box: "h-11 w-11 rounded-xl", icon: "h-5 w-5" },
  lg: { box: "h-14 w-14 rounded-2xl", icon: "h-6 w-6" },
};

/**
 * Os três tons existiam para um site claro: `primary` era o ladrilho laranja
 * de destaque, `dark` o neutro e `on-dark` a versão para as poucas seções
 * escuras. Com o site inteiro escuro (26/10/2026), `dark` — um gradiente
 * azul-marinho — sumia no fundo, e a mesma página acabava com ladrilho
 * laranja numa seção e um quadrado invisível na outra.
 *
 * Agora há dois papéis de verdade: `primary` destaca, `dark` e `on-dark`
 * são o ladrilho discreto. Mantidos os três nomes porque dez arquivos os
 * passam.
 */
const ladrilhoDiscreto =
  "bg-flame/10 text-flame-soft ring-1 ring-inset ring-flame/20";

const tones: Record<Tone, string> = {
  /* Laranja sólido com aresta de luz: o único que "acende". */
  primary:
    "bg-gradient-to-br from-primary to-flame-soft text-[#1b0c02] shadow-[0_2px_10px_rgba(255,106,26,0.3),inset_0_1px_0_rgba(255,255,255,0.3)]",
  dark: ladrilhoDiscreto,
  "on-dark": ladrilhoDiscreto,
};

/**
 * Squircle icon tile with gradient fill and a subtle inner highlight.
 * Single source of truth for the icon surface used across cards and sections.
 */
export function IconTile({
  icon: Icon,
  size = "md",
  tone = "primary",
  className,
}: {
  icon: LucideIcon;
  size?: Size;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        sizes[size].box,
        tones[tone],
        className
      )}
    >
      <Icon className={sizes[size].icon} aria-hidden />
    </span>
  );
}
