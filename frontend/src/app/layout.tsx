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
        {/* Anti-FOUC: landing page sempre dark; restante respeita localStorage */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('orkestri-theme-v2');var p=window.location.pathname;if(p==='/'||p===''){document.documentElement.setAttribute('data-theme','dark');}else{document.documentElement.setAttribute('data-theme',(t==='dark'||t==='light')?t:'light');}}catch(e){document.documentElement.setAttribute('data-theme','light');}})();` }} />
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
