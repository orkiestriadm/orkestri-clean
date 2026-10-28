"use client";
import { useEffect, useState } from "react";
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
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [attempt, setAttempt] = useState(0);
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
    const controller = new AbortController();
    setReady(false);
    setSessionError("");
    authApi.me({ timeout: 10000, silent: true, signal: controller.signal })
      .then(u => {
        if (controller.signal.aborted) return;
        useAuthStore.setState({ user: u });
        setReady(true);
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        if (err?.response?.status === 401) {
          useAuthStore.setState({ user: null, token: null });
          setSessionError("Sua sessão terminou. Entre novamente para continuar.");
        } else {
          setSessionError("Não foi possível verificar seu acesso. Tente novamente em instantes.");
        }
      });
    return () => controller.abort();
  }, [attempt]);

  // Fecha sidebar ao navegar (mobile)
  useEffect(() => { setSidebarOpen(false); }, [children]);

  // Escuta evento global disparado pelo Topbar
  useEffect(() => {
    const handler = () => setSidebarOpen(o => !o);
    window.addEventListener('toggle-sidebar', handler);
    return () => window.removeEventListener('toggle-sidebar', handler);
  }, []);

  if (!ready) return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", gap:20, padding:24, alignItems:"center", justifyContent:"center", background:"var(--bg-primary)" }}>
      {sessionError ? <>
        <p role="alert" style={{ textAlign:"center" }}>{sessionError}</p>
        <button type="button" onClick={() => setAttempt(n => n + 1)} style={{ padding:"12px 20px", borderRadius:12, background:"#7c3aed", color:"white" }}>Tentar novamente</button>
      </> : <>
        <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>
        <p role="status">Verificando seu acesso…</p>
      </>}
      <a href="/login" style={{ textDecoration:"underline", padding:12 }}>Ir para o login</a>
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
