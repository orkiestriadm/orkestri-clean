"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Search, Focus } from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import PasswordRequests from "@/components/ui/PasswordRequests";
import NotificationBell from "@/components/ui/NotificationBell";
import FocusMode from "@/components/ui/FocusMode";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";

const TITLES: Record<string, { label: string; desc: string }> = {
  "/dashboard":                        { label: "Visão Geral",    desc: "Resumo operacional" },
  "/dashboard/executivo":              { label: "Executivo",      desc: "KPIs consolidados" },
  "/dashboard/agenda":                 { label: "Agenda",         desc: "Eventos e compromissos" },
  "/dashboard/projetos":               { label: "Projetos",       desc: "Planner e Kanban" },
  "/dashboard/keep":                   { label: "Keep",           desc: "Tasks e notas diárias" },
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
  "/dashboard/configuracoes":          { label: "Configurações",  desc: "Preferências do sistema" },
  "/dashboard/whatsapp-config":        { label: "WhatsApp",       desc: "Notificações via WhatsApp" },
  "/dashboard/historico":              { label: "Histórico",      desc: "Auditoria de atividades" },
  "/dashboard/perfil":                 { label: "Meu Perfil",     desc: "Configurações pessoais" },
};

export default function Topbar({ children }: { children?: React.ReactNode }) {
  const path = usePathname();
  const { user } = useAuthStore();
  const meta = TITLES[path] || { label: "Orkiestri", desc: "" };
  const [focusOpen, setFocusOpen] = useState(false);
  const [exitingImpersonation, setExitingImpersonation] = useState(false);

  const exitImpersonation = async () => {
    setExitingImpersonation(true);
    try {
      await api.post("/superadmin/exit-impersonation");
      window.location.href = "/dashboard/superadmin";
    } catch { setExitingImpersonation(false); }
  };

  return (
    <>
      {user?.impersonating && (
        <div className="flex items-center justify-between px-5 py-1.5 text-[12px] font-mono border-b shrink-0"
          style={{ background: "rgba(251,146,60,0.06)", borderColor: "rgba(251,146,60,0.18)", color: "#fb923c" }}>
          <span>Administrando: <strong>{user.impersonatingOrgName}</strong></span>
          <button onClick={exitImpersonation} disabled={exitingImpersonation}
            className="text-[11px] px-3 py-1 rounded-md border transition-colors hover:bg-orange-500/10"
            style={{ borderColor: "rgba(251,146,60,0.3)" }}>
            {exitingImpersonation ? "Saindo..." : "Sair da organização"}
          </button>
        </div>
      )}

      <header className="h-14 min-h-[56px] flex items-center justify-between px-5 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)] relative z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button className="mobile-menu-btn" onClick={() => document.getElementById("sidebar-toggle")?.click()} aria-label="Menu">
            <Menu size={15} />
          </button>
          <div>
            <h1 className="font-display text-[14px] font-bold text-[var(--text-primary)] leading-tight">{meta.label}</h1>
            {meta.desc && <p className="text-[10px] text-[var(--text-muted)] font-mono leading-none mt-0.5 tracking-wide">{meta.desc}</p>}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {children}
          <button
            className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-glass)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-medium)] transition-all text-[11px] font-mono"
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))}>
            <Search size={11} />
            <span>Buscar</span>
            <kbd className="ml-1 text-[9px] opacity-50 hidden md:inline">Ctrl+K</kbd>
          </button>
          <button
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border-subtle)] bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-medium)] transition-all"
            title="Modo Foco" onClick={() => setFocusOpen(true)}>
            <Focus size={14} />
          </button>
          <PasswordRequests />
          <NotificationBell />
          <ThemeToggle />
          <div className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-glass)] ml-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              {new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
            </span>
          </div>
        </div>
      </header>

      {focusOpen && <FocusMode onClose={() => setFocusOpen(false)} />}
    </>
  );
}
