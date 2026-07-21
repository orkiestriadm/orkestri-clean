import type { Metadata } from "next";
import "../styles/globals.css";
import { ThemeProvider } from "@/lib/theme";
import dynamic from "next/dynamic";

const ToastContainer = dynamic(() => import("@/components/ui/ToastContainer"), { ssr: false });

export const metadata: Metadata = { title: "HUB", description: "HUB Operacional - Triunfo TBR" };

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
        </ThemeProvider>
      </body>
    </html>
  );
}
