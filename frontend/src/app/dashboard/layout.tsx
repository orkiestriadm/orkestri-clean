"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { authApi } from "@/lib/api";
import { recoverSession } from "@/lib/session-recovery";
import Sidebar from "@/components/layout/Sidebar";
import AlertBanner from "@/components/ui/AlertBanner";
import { useNotifications } from "@/lib/useNotifications";
import CommandPalette from "@/components/ui/CommandPalette";

function NotificationInitializer() {
  useNotifications();
  return null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(o => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const failed = (err: any) => {
      const status = err?.response?.status;
      const code = err?.response?.data?.code;
      if (status === 401 && code !== "BILLING_SUSPENDED") {
        void recoverSession();
      } else if (code !== "BILLING_SUSPENDED" && code !== "PRIMEIRO_ACESSO") {
        setLoadError(true);
      }
    };
    if (!user) {
      const fallback = setTimeout(() => { setLoadError(true); }, 12000);
      authApi.me()
        .then(u => { clearTimeout(fallback); useAuthStore.setState({ user: u }); setReady(true); })
        .catch(err => { clearTimeout(fallback); failed(err); });
      return () => clearTimeout(fallback);
    } else {
      setReady(true);
      // Sempre atualiza permissões em background para evitar sidebar desatualizado
      authApi.me()
        .then(u => { useAuthStore.setState({ user: u }); })
        .catch(failed);
    }
  }, []);

  // Fecha sidebar ao navegar (mobile)
  useEffect(() => { setSidebarOpen(false); }, [children]);

  // Escuta evento global disparado pelo Topbar
  useEffect(() => {
    const handler = () => setSidebarOpen(o => !o);
    window.addEventListener('toggle-sidebar', handler);
    return () => window.removeEventListener('toggle-sidebar', handler);
  }, []);

  if (!ready && loadError) return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg-primary)] px-6 text-center text-[var(--text-primary)]">
      <p role="alert">Não foi possível carregar sua sessão. Tente novamente.</p>
      <button className="rounded-lg border border-[var(--border-subtle)] px-4 py-2" onClick={() => window.location.reload()}>Tentar novamente</button>
      <button className="underline" onClick={() => { void recoverSession(); }}>Voltar ao login</button>
    </main>
  );

  if (!ready) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg-primary)" }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div className="app-shell">
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, backgroundImage:"linear-gradient(var(--grid-line) 1px,transparent 1px),linear-gradient(90deg,var(--grid-line) 1px,transparent 1px)", backgroundSize:"48px 48px" }} />
      <NotificationInitializer />
      <AlertBanner />

      {/* Desktop sidebar */}
      <div className="sidebar-desktop">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div className="sidebar-mobile-overlay" onClick={() => setSidebarOpen(false)} />
          <div className="sidebar-mobile">
            <Sidebar />
          </div>
        </>
      )}

      <main className="main-area" style={{ position:"relative", zIndex:1 }}>
        {children}
      </main>

      {cmdOpen && <CommandPalette onClose={() => setCmdOpen(false)} />}
    </div>
  );
}