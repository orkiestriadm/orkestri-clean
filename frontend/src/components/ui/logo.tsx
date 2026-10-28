import React from "react";

/**
 * Marca da Triunfo Transbrasiliana usada no sidebar e nas paginas de auth.
 * - Light theme: logo colorida (texto preto sobre fundo claro)
 * - Dark theme:  logo branca (texto branco sobre fundo escuro)
 * Alternancia feita por CSS em globals.css via [data-theme="dark"].
 */

type BrandSize = "sm" | "md" | "lg" | "xl" | "xxl";

const HEIGHT: Record<BrandSize, number> = {
  sm: 24, md: 32, lg: 40, xl: 56, xxl: 72,
};

export function BrandLogo({
  size = "md",
  className = "",
}: {
  size?: BrandSize;
  className?: string;
}) {
  const h = HEIGHT[size];
  return (
    <span className={`inline-flex items-center ${className}`} aria-label="Triunfo Transbrasiliana">
      <img
        src="/branding/logo-ttbr-colorida.png"
        alt="Triunfo Transbrasiliana"
        className="brand-light"
        style={{ height: h, width: "auto" }}
      />
      <img
        src="/branding/logo-ttbr-branca.png"
        alt="Triunfo Transbrasiliana"
        className="brand-dark"
        style={{ height: h, width: "auto" }}
      />
    </span>
  );
}

/**
 * Aliases mantidos por compatibilidade com imports legados.
 * Renderizam a mesma logo da Triunfo.
 */
export const OrkestriIcon = ({ size = 32, className = "" }: { size?: number; className?: string }) => (
  <span className={`inline-flex items-center ${className}`} aria-label="Triunfo Transbrasiliana">
    <img
      src="/branding/logo-ttbr-colorida.png"
      alt="Triunfo Transbrasiliana"
      className="brand-light"
      style={{ height: size, width: "auto" }}
    />
    <img
      src="/branding/logo-ttbr-branca.png"
      alt="Triunfo Transbrasiliana"
      className="brand-dark"
      style={{ height: size, width: "auto" }}
    />
  </span>
);
export const OrkestriLogo = OrkestriIcon;
