"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Search, Focus, CalendarClock } from "lucide-react";
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
  "/dashboard/capacity":               { label: "Capacidade",     desc: "Consumo operacional vs capacidade nominal" },
  "/dashboard/aprovacoes":             { label: "Aprovações",     desc: "Workflows de aprovação hierárquica" },
  "/dashboard/automacoes":             { label: "Automações",     desc: "Regras e integrações" },
  "/dashboard/cadastros":              { label: "Cadastros",      desc: "Usuários, clientes e organizações" },
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
        <div className="flex items-center justify-between px-5 py-2 text-[12px] font-mono border-b shrink-0 bg-amber-500/[0.04] border-amber-500/20 text-amber-600 dark:text-amber-400">
          <span>Administrando: <strong className="font-semibold">{user.impersonatingOrgName}</strong></span>
          <button onClick={exitImpersonation} disabled={exitingImpersonation}
            className="text-[11px] px-3 py-1 rounded-md border border-amber-500/30 transition-colors hover:bg-amber-500/10">
            {exitingImpersonation ? "Saindo..." : "Sair da organização"}
          </button>
        </div>
      )}

      <header className="h-[60px] min-h-[60px] flex items-center justify-between px-6 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/80 backdrop-blur-xl relative z-40 shrink-0 transition-colors duration-300">
        <div className="flex items-center gap-4">
          <button className="mobile-menu-btn" onClick={() => document.getElementById("sidebar-toggle")?.click()} aria-label="Menu">
            <Menu size={16} />
          </button>
          <div>
            <h1 className="font-display text-[16px] font-bold text-[var(--text-primary)] leading-tight tracking-tight">{meta.label}</h1>
            {meta.desc && <p className="text-[11px] text-[var(--text-muted)] font-mono leading-none mt-1 tracking-wide">{meta.desc}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {children}
          <button
            className="hidden sm:flex items-center gap-2 h-[34px] px-3 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-medium)] shadow-premium-sm transition-all text-[12px] font-medium group"
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))}>
            <Search size={13} className="text-[var(--text-faint)] group-hover:text-[var(--text-primary)] transition-colors" />
            <span>Buscar</span>
            <kbd className="ml-2 text-[9px] px-1.5 py-0.5 rounded border border-[var(--border-subtle)] font-mono bg-[var(--bg-hover)] hidden md:inline">⌘K</kbd>
          </button>
          
          <div className="w-[1px] h-4 bg-[var(--border-subtle)] mx-1 hidden sm:block" />

          <button
            className="btn-icon"
            title="Modo Foco" onClick={() => setFocusOpen(true)}>
            <Focus size={15} />
          </button>
          <PasswordRequests />
          <NotificationBell />
          <ThemeToggle />
          
          <div className="hidden sm:flex items-center gap-2 h-[34px] px-3 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-secondary)] ml-1 shadow-premium-sm">
            <CalendarClock size={13} className="text-emerald-500" />
            <span className="text-[11px] font-mono text-[var(--text-muted)]">
              {new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
            </span>
          </div>
        </div>
      </header>

      {focusOpen && <FocusMode onClose={() => setFocusOpen(false)} />}
    </>
  );
}
