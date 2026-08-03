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
