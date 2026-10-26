import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
import Script from "next/script";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { buildMetadata, organizationSchema } from "@/lib/seo";
import { siteConfig } from "@/config/site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

/**
 * Manchetes. Archivo é variável nos dois eixos; pedimos `wdth` para poder
 * abrir a largura só nos títulos — é o que distingue a manchete do texto
 * corrido, já que ambos são grotescas.
 */
const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-archivo",
  axes: ["wdth"],
});

export const metadata: Metadata = {
  ...buildMetadata(),
  metadataBase: new URL(siteConfig.url),
};

export const viewport: Viewport = {
  themeColor: "#07080b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${archivo.variable}`}>
      <body>
        <Script
          id="organization-schema"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema()),
          }}
        />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[1000] focus:rounded-lg focus:bg-panel focus:px-4 focus:py-2 focus:text-chalk"
        >
          Pular para o conteúdo
        </a>
        <Navbar />
        <main id="main">{children}</main>
        <Footer />
        {/* O <TrialModal> saiu daqui em 26/10/2026: o cadastro passou a ser
            só pelo WhatsApp e nenhum botão do site o abria mais — montado,
            seria peso morto em toda página. Os arquivos de
            `components/trial/` e a rota `/api/demo` ficaram no lugar, caso o
            formulário volte. */}
      </body>
    </html>
  );
}
