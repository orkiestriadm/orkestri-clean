import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "primary" | "dark" | "on-dark";
type Size = "sm" | "md" | "lg";

const sizes: Record<Size, { box: string; icon: string }> = {
  sm: { box: "h-9 w-9 rounded-[10px]", icon: "h-[18px] w-[18px]" },
  md: { box: "h-11 w-11 rounded-xl", icon: "h-5 w-5" },
  lg: { box: "h-14 w-14 rounded-2xl", icon: "h-6 w-6" },
};

const tones: Record<Tone, string> = {
  // Warm gradient tile — the signature accent surface.
  primary:
    "bg-gradient-to-br from-primary to-[#fb923c] text-white shadow-[0_2px_8px_rgba(249,115,22,0.25),inset_0_1px_0_rgba(255,255,255,0.25)]",
  dark: "bg-gradient-to-br from-dark to-dark-soft text-white shadow-[0_2px_8px_rgba(15,23,42,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]",
  // For use inside dark sections.
  "on-dark":
    "bg-primary/15 text-primary ring-1 ring-inset ring-primary/20",
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
