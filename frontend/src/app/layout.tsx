import type { Metadata } from "next";
import "../styles/globals.css";
import { ThemeProvider } from "@/lib/theme";
import dynamic from "next/dynamic";

const ToastContainer = dynamic(() => import("@/components/ui/ToastContainer"), { ssr: false });

export const metadata: Metadata = { title: "Orkestri", description: "Sistema de Organizacao de Demandas" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark">
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