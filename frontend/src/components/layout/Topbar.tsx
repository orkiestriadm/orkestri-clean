"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Focus, Search } from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import PasswordRequests from "@/components/ui/PasswordRequests";
import NotificationBell from "@/components/ui/NotificationBell";
import FocusMode from "@/components/ui/FocusMode";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";

const TITLES: Record<string, { label: string; desc: string }> = {
  "/dashboard":                        { label: "Visão Geral",    desc: "Resumo de atividades" },
  "/dashboard/executivo":              { label: "Executivo",      desc: "KPIs consolidados" },
  "/dashboard/agenda":                 { label: "Agenda",         desc: "Eventos e compromissos" },
  "/dashboard/projetos":               { label: "Projetos",       desc: "Planner e tarefas" },
  "/dashboard/keep":                   { label: "Keep",           desc: "Notas e tasks diárias" },
  "/dashboard/relatorios":             { label: "Relatórios",     desc: "Analytics e métricas" },
  "/dashboard/gantt":                  { label: "Linha do Tempo", desc: "Visualização de projetos" },
  "/dashboard/chamados":               { label: "Chamados",       desc: "Service Desk" },
  "/dashboard/apontamentos":           { label: "Horas",          desc: "Apontamento de horas" },
  "/dashboard/csat":                   { label: "CSAT",           desc: "Pesquisa de satisfação" },
  "/dashboard/conhecimento":           { label: "Conhecimento",   desc: "Base de artigos" },
  "/dashboard/ativos":                 { label: "Ativos",         desc: "Gestão de equipamentos" },
  "/dashboard/clientes":               { label: "Clientes",       desc: "CRM" },
  "/dashboard/contratos":              { label: "Contratos",      desc: "Gestão comercial" },
  "/dashboard/faturas":                { label: "Faturas",        desc: "Cobranças e pagamentos" },
  "/dashboard/orcamento":              { label: "Orçamento",      desc: "CAPEX / OPEX" },
  "/dashboard/automacoes":             { label: "Automações",     desc: "Regras e integrações" },
  "/dashboard/cadastros":              { label: "Usuários",       desc: "Gestão de acessos" },
  "/dashboard/cadastros/fornecedores": { label: "Fornecedores",   desc: "Gestão de fornecedores" },
  "/dashboard/usuarios":               { label: "Usuários",       desc: "Gestão de acessos" },
  "/dashboard/configuracoes":          { label: "Configurações",  desc: "Alertas, sons e notificações" },
  "/dashboard/whatsapp-config":        { label: "WhatsApp",       desc: "Notificações via WhatsApp" },
  "/dashboard/historico":              { label: "Histórico",      desc: "Registro de atividades" },
  "/dashboard/perfil":                 { label: "Meu Perfil",     desc: "Configurações pessoais" },
};

export default function Topbar({ children }: { children?: React.ReactNode }) {
  const path = usePathname();
  const { user } = useAuthStore();
  const meta = TITLES[path] || { label: "Orkestri", desc: "" };
  const dateStr = new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
  const [focusOpen, setFocusOpen] = useState(false);
  const [exitingImpersonation, setExitingImpersonation] = useState(false);

  const exitImpersonation = async () => {
    setExitingImpersonation(true);
    try {
      await api.post("/superadmin/exit-impersonation");
      // Reload the app so the auth guard re-fetches /auth/me with the restored SA token
      window.location.href = "/dashboard/superadmin";
    } catch { setExitingImpersonation(false); }
  };

  return (
    <>
      {user?.impersonating && (
        <div style={{ background: "rgba(251,146,60,0.12)", borderBottom: "1px solid rgba(251,146,60,0.35)", padding: "6px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ color: "#fb923c", fontFamily: "var(--font-mono)" }}>
            Você está administrando: <strong>{user.impersonatingOrgName}</strong>
          </span>
          <button
            onClick={exitImpersonation}
            disabled={exitingImpersonation}
            style={{ fontSize: 11, padding: "3px 12px", borderRadius: 6, border: "1px solid rgba(251,146,60,0.5)", background: "transparent", color: "#fb923c", cursor: "pointer", fontFamily: "var(--font-mono)" }}
          >
            {exitingImpersonation ? "Saindo..." : "Sair da organização"}
          </button>
        </div>
      )}
      <header className="h-14 min-h-[56px] flex items-center justify-between px-6 border-b border-border bg-background/50 backdrop-blur-xl relative z-10">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            className="mobile-menu-btn md:hidden flex items-center justify-center w-8 h-8 rounded-md bg-transparent border border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={() => document.getElementById("sidebar-toggle")?.click()}
            aria-label="Menu"
          >
            <Menu size={16} />
          </button>
          <div>
            <h1 className="font-display text-[15px] font-bold text-foreground">{meta.label}</h1>
            {meta.desc && <p className="text-[11px] text-muted-foreground font-mono tracking-wide leading-none mt-0.5">{meta.desc}</p>}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {children}

          {/* Ctrl+K hint */}
          <button
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground transition-colors text-[11px]"
            onClick={() => { const e = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }); window.dispatchEvent(e); }}
            title="Pesquisa global (Ctrl+K)"
          >
            <Search size={12} />
            <span className="font-mono">Ctrl+K</span>
          </button>

          <button
            className="flex items-center justify-center w-8 h-8 rounded-md bg-transparent border border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            title="Modo Foco"
            onClick={() => setFocusOpen(true)}
          >
            <Focus size={15} />
          </button>
          
          <PasswordRequests />
          <NotificationBell />
          <ThemeToggle />
          
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-background/50 border border-border ml-1 hidden sm:flex">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse" />
            <span className="text-[11px] text-muted-foreground font-mono">{dateStr}</span>
          </div>
        </div>
      </header>
      
      {focusOpen && <FocusMode onClose={() => setFocusOpen(false)} />}
    </>
  );
}