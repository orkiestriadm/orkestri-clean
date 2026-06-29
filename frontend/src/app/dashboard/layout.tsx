"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { authApi } from "@/lib/api";
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
    if (!user) {
      const fallback = setTimeout(() => { router.replace("/login"); }, 12000);
      authApi.me()
        .then(u => { clearTimeout(fallback); useAuthStore.setState({ user: u }); setReady(true); })
        .catch(() => { clearTimeout(fallback); router.replace("/login"); });
      return () => clearTimeout(fallback);
    } else {
      setReady(true);
      // Sempre atualiza permissões em background para evitar sidebar desatualizado
      authApi.me()
        .then(u => { useAuthStore.setState({ user: u }); })
        .catch(() => { router.replace("/login"); });
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