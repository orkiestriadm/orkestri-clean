import type { Metadata } from "next";
import "../styles/globals.css";
import { ThemeProvider } from "@/lib/theme";
import dynamic from "next/dynamic";

const ToastContainer = dynamic(() => import("@/components/ui/ToastContainer"), { ssr: false });

export const metadata: Metadata = { title: "Orkiestri", description: "Sistema de Organizacao de Demandas" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Anti-FOUC: set data-theme before React hydrates */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var m=window.matchMedia('(pointer:coarse)').matches;var t=m?(localStorage.getItem('orkestri-theme')||(window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light')):'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();` }} />
      </head>
      <body>
        <ThemeProvider>
          <div className="noise-overlay" />
          {children}
          <ToastContainer />
        </ThemeProvider>
      </body>
    </html>
  );
}
