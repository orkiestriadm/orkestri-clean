import React from "react";

export function OrkestriIcon({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="ok-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="55%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#C026D3" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="28" fill="url(#ok-grad)" />
      <g stroke="white" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <circle cx="44" cy="60" r="18" />
        <path d="M 72 36 L 72 78" />
        <path d="M 91 46 L 72 60 L 91 76" />
      </g>
    </svg>
  );
}

/** Alias mantido para compatibilidade com imports existentes */
export const OrkestriLogo = OrkestriIcon;

type BrandSize = "sm" | "md" | "lg" | "xl" | "xxl";

const SIZE: Record<BrandSize, { icon: number; text: string; gap: string }> = {
  sm:  { icon: 26, text: "text-[15px]", gap: "gap-2" },
  md:  { icon: 30, text: "text-[17px]", gap: "gap-2.5" },
  lg:  { icon: 36, text: "text-[20px]", gap: "gap-3" },
  xl:  { icon: 52, text: "text-[28px]", gap: "gap-3.5" },
  xxl: { icon: 68, text: "text-[36px]", gap: "gap-4" },
};

export function BrandLogo({
  size = "md",
  className = "",
}: {
  size?: BrandSize;
  className?: string;
}) {
  const s = SIZE[size];
  return (
    <span className={`inline-flex items-center ${s.gap} ${className}`}>
      <OrkestriIcon size={s.icon} />
      <span
        className={`font-display font-bold tracking-tight text-white leading-none ${s.text}`}
        style={{ letterSpacing: "-0.02em" }}
      >
        Orkiestri
      </span>
    </span>
  );
}
