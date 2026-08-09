import React from "react";
import { MARCA } from "@/lib/marca";

/**
 * Símbolo da marca — mesmo desenho do site institucional (orkiestri.com),
 * para sistema e site compartilharem a mesma identidade.
 * Vetorial: nítido em qualquer DPI e sem depender de arquivo estático.
 */
export function OrkestriIcon({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      <rect width="28" height="28" rx="7" fill="#F97316" />
      <circle cx="14" cy="14" r="3" fill="white" />
      <circle cx="14" cy="14" r="7" stroke="white" strokeWidth="1.75" strokeOpacity="0.55" />
      <circle cx="14" cy="5.5" r="1.6" fill="white" />
      <circle cx="22.5" cy="14" r="1.6" fill="white" />
      <circle cx="5.5" cy="14" r="1.6" fill="white" />
    </svg>
  );
}

/** Alias mantido para compatibilidade com imports existentes */
export const OrkestriLogo = OrkestriIcon;

type BrandSize = "sm" | "md" | "lg" | "xl" | "xxl";

const SIZE: Record<BrandSize, { icon: number; text: string; gap: string }> = {
  sm:  { icon: 30, text: "text-[17px]", gap: "gap-2" },
  md:  { icon: 36, text: "text-[20px]", gap: "gap-2.5" },
  lg:  { icon: 42, text: "text-[24px]", gap: "gap-3" },
  xl:  { icon: 58, text: "text-[32px]", gap: "gap-3.5" },
  xxl: { icon: 76, text: "text-[41px]", gap: "gap-4" },
};

export function BrandLogo({
  size = "md",
  tone = "auto",
  className = "",
}: {
  size?: BrandSize;
  /** "light" força o wordmark branco (uso sobre fundo escuro). */
  tone?: "auto" | "light";
  className?: string;
}) {
  const s = SIZE[size];
  return (
    <span className={`inline-flex items-center ${s.gap} ${className}`}>
      <OrkestriIcon size={s.icon} />
      <span
        className={`font-display font-bold tracking-tight leading-none ${s.text} ${
          tone === "light" ? "text-white" : "text-[var(--text-primary)]"
        }`}
        style={{ letterSpacing: "-0.02em" }}
      >{MARCA}</span>
    </span>
  );
}
