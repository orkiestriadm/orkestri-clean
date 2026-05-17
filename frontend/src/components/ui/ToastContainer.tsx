"use client";
import { Toaster } from "sonner";
import { useTheme } from "next-themes"; // Caso você use next-themes, ou apenas force o tema

export default function ToastContainer() {
  // A classe toaster vai se adaptar ao tema automaticamente se o data-theme="dark" estiver presente
  return (
    <Toaster 
      position="top-right" 
      toastOptions={{
        className: "font-body border-border",
        style: {
          background: "var(--bg-card)",
          color: "var(--text-primary)",
          borderColor: "var(--border-subtle)",
          backdropFilter: "blur(16px)"
        }
      }}
    />
  );
}
