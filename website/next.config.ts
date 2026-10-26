import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  // Namespaced assets so the site can share the orkiestri.com origin with the
  // existing platform (both are Next.js apps and would otherwise collide on
  // /_next/). nginx routes /_site/ to this container.
  assetPrefix: "/_site",
  images: {
    formats: ["image/avif", "image/webp"],
    // O assetPrefix NÃO se aplica ao endpoint do otimizador. Sem isto o
    // <img> pede /_next/image, que o nginx entrega à plataforma (dona de
    // /_next/) e a imagem quebra. Namespaceia junto com o resto do site.
    path: "/_site/_next/image",
  },
  /**
   * Produtos que o site anunciou até 26/10/2026 e que não existem mais no
   * sistema (a redução de escopo de 19/10 removeu Fleet, Assets, Relations,
   * Supply e companhia; Budget e Flow viraram telas de Finance e Service).
   *
   * Redirecionamento, e não 404: essas URLs estavam no sitemap e podem ter
   * sido indexadas ou guardadas. 307 porque a decisão de produto pode mudar —
   * um 301 ficaria no cache do navegador de quem já visitou.
   */
  async redirects() {
    const descontinuados = [
      "one-fleet",
      "one-assets",
      "one-crm",
      "one-supply",
      "one-observe",
      "one-budget",
      "one-flow",
    ];
    return descontinuados.map((slug) => ({
      source: `/products/${slug}`,
      destination: "/products",
      permanent: false,
    }));
  },

  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
    ];
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
