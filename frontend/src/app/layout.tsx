import type { Metadata } from "next";
import "../styles/globals.css";
import { ThemeProvider } from "@/lib/theme";
import dynamic from "next/dynamic";
import { MARCA } from "@/lib/marca";

const ToastContainer = dynamic(() => import("@/components/ui/ToastContainer"), { ssr: false });

export const metadata: Metadata = {
  // Crase, não aspas: com aspas a interpolação vira texto literal e a aba
  // exibia "${MARCA} One" para o usuário.
  title: { default: `${MARCA} One`, template: `%s · ${MARCA} One` },
  description: `${MARCA} One — o Business Operating System da sua empresa.`,
  robots: { index: false, follow: false },
};

/**
 * Cor de destaque do ambiente, embutida no build (NEXT_PUBLIC_*).
 *
 * Laranja é o padrão do produto (produção). Homologação usa vermelho, pelo build
 * arg `NEXT_PUBLIC_ACENTO=vermelho` do compose de lá. Antes de 11/09/2026 o
 * vermelho existia só no disco do servidor e um deploy pelo git o apagou sem
 * erro nenhum — o usuário é que percebeu na tela.
 */
const ACENTO = process.env.NEXT_PUBLIC_ACENTO?.trim() === "vermelho" ? "vermelho" : "laranja";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-acento={ACENTO}>
      <head>
        {/* Anti-FOUC: default dark mode */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('orkestri-theme-v3');document.documentElement.setAttribute('data-theme',(t==='light')?'light':'dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();` }} />
      </head>
      <body>
        <ThemeProvider>
          {children}
          <ToastContainer />
        </ThemeProvider>
      </body>
    </html>
  );
}
