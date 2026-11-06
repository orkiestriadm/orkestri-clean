import type { Metadata, Viewport } from "next";
import "../styles/globals.css";
import { ThemeProvider } from "@/lib/theme";
import dynamic from "next/dynamic";
import { MARCA, ICONE_APP, DESCRICAO_CURTA } from "@/lib/marca";

const ToastContainer = dynamic(() => import("@/components/ui/ToastContainer"), { ssr: false });
const RegistroPWA = dynamic(() => import("@/components/RegistroPWA"), { ssr: false });

export const metadata: Metadata = {
  // Crase, não aspas: com aspas a interpolação vira texto literal e a aba
  // exibia "${MARCA} One" para o usuário.
  title: { default: `${MARCA} One`, template: `%s · ${MARCA} One` },
  description: `${MARCA} One — ${DESCRICAO_CURTA}`,
  robots: { index: false, follow: false },
  // O `<link rel="manifest">` o Next põe sozinho, por causa de `app/manifest.ts`.
  icons: {
    icon: ICONE_APP || "/icon-192.png",
    // O iOS ignora o manifest na hora de escolher o ícone da tela de início:
    // ou tem apple-touch-icon, ou ele tira um retrato da página.
    apple: ICONE_APP || "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: `${MARCA} One`,
    // "black", e não "black-translucent": o translúcido joga o conteúdo para
    // debaixo do relógio e da bateria, e a barra superior do sistema some atrás.
    statusBarStyle: "black",
  },
};

/**
 * Cor da barra do aplicativo instalado. Fixa no escuro porque é o tema padrão
 * do sistema, e o claro é escolha guardada no navegador de cada pessoa —
 * que o servidor não tem como consultar ao montar a página.
 */
export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Anti-FOUC: default dark mode */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('orkestri-theme-v3');document.documentElement.setAttribute('data-theme',(t==='light')?'light':'dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();` }} />
      </head>
      <body>
        <ThemeProvider>
          {children}
          <ToastContainer />
          <RegistroPWA />
        </ThemeProvider>
      </body>
    </html>
  );
}
