"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, CalendarDays, Layers, StickyNote, MessageCircle,
  Building2, GanttChart, BarChart2, Users, History, Settings, LogOut,
  Headphones, PiggyBank, Truck, BookOpen, Package, Zap, Clock, FileText,
  SmilePlus, TrendingUp, UserCircle, Receipt, ChevronRight, Shield,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import UserStatus from "@/components/ui/UserStatus";
import { cn } from "@/lib/utils";
import { OrkestriLogo } from "@/components/ui/logo";

type NavItem  = { href: string; label: string; icon: any; permission: string | null };
type NavGroup = { id: string; label: string | null; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    id: "pinned", label: null,
    items: [
      { href: "/dashboard",            label: "Visão Geral", icon: LayoutDashboard, permission: null },
      { href: "/dashboard/executivo",  label: "Executivo",   icon: TrendingUp,      permission: null },
      { href: "/dashboard/relatorios", label: "Relatórios",  icon: BarChart2,       permission: "relatorios:ver" },
    ],
  },
  {
    id: "servicedesk", label: "Service Desk",
    items: [
      { href: "/dashboard/chamados",     label: "Chamados",     icon: Headphones, permission: "chamados:ver" },
      { href: "/dashboard/apontamentos", label: "Horas",        icon: Clock,      permission: "chamados:ver" },
      { href: "/dashboard/csat",         label: "CSAT",         icon: SmilePlus,  permission: "chamados:ver" },
      { href: "/dashboard/conhecimento", label: "Conhecimento", icon: BookOpen,   permission: "conhecimento:ver" },
    ],
  },
  {
    id: "operacoes", label: "Operações",
    items: [
      { href: "/dashboard/projetos", label: "Projetos",       icon: Layers,      permission: "projetos:ver" },
      { href: "/dashboard/gantt",    label: "Linha do Tempo", icon: GanttChart,  permission: "gantt:ver" },
      { href: "/dashboard/agenda",   label: "Agenda",         icon: CalendarDays,permission: "agenda:ver" },
      { href: "/dashboard/ativos",   label: "Ativos",         icon: Package,     permission: "ativos:ver" },
      { href: "/dashboard/keep",     label: "Keep",           icon: StickyNote,  permission: "keep:ver" },
    ],
  },
  {
    id: "crm", label: "CRM",
    items: [
      { href: "/dashboard/clientes",  label: "Clientes",  icon: Building2, permission: "crm:ver" },
      { href: "/dashboard/contratos", label: "Contratos", icon: FileText,  permission: "crm:ver" },
      { href: "/dashboard/faturas",   label: "Faturas",   icon: Receipt,   permission: "crm:ver" },
      { href: "/dashboard/orcamento", label: "Orçamento", icon: PiggyBank, permission: "orcamento:ver" },
    ],
  },
  {
    id: "admin", label: "Admin",
    items: [
      { href: "/dashboard/cadastros",              label: "Usuários",      icon: Users,         permission: "usuarios:ver" },
      { href: "/dashboard/cadastros/fornecedores", label: "Fornecedores",  icon: Truck,         permission: "fornecedores:ver" },
      { href: "/dashboard/automacoes",             label: "Automações",    icon: Zap,           permission: "automacoes:ver" },
      { href: "/dashboard/whatsapp-config",        label: "WhatsApp",      icon: MessageCircle, permission: "whatsapp:ver" },
      { href: "/dashboard/historico",              label: "Histórico",     icon: History,       permission: "historico:ver" },
      { href: "/dashboard/configuracoes",          label: "Configurações", icon: Settings,      permission: "configuracoes:ver" },
    ],
  },
];

function isActive(href: string, path: string) {
  return href === path || (href !== "/dashboard" && path.startsWith(href));
}

function groupHasActive(group: NavGroup, path: string) {
  return group.items.some(i => isActive(i.href, path));
}

function NavLink({ item, path }: { item: NavItem; path: string }) {
  const active = isActive(item.href, path);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all duration-150 group relative",
        active
          ? "text-primary bg-primary/10 font-medium"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <Icon size={15} className={cn(
        "flex-shrink-0 transition-colors",
        active ? "text-primary" : "text-muted-foreground/60 group-hover:text-accent-foreground"
      )} />
      <span className="truncate">{item.label}</span>
      {active && <span className="absolute right-3 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_var(--primary)]" />}
    </Link>
  );
}

export default function Sidebar() {
  const path     = usePathname();
  const router   = useRouter();
  const { user, logout } = useAuthStore();
  const [loggingOut, setLoggingOut] = useState(false);

  // Auto-expand group containing current route; default others closed
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of NAV) {
      if (!g.label) continue;
      init[g.id] = groupHasActive(g, path);
    }
    return init;
  });

  const toggle = (id: string) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const can = (permission: string | null) => {
    if (!permission || user?.isMaster) return true;
    const perms: string[] = user?.permissions || [];
    return perms.includes("*") || perms.includes(permission);
  };

  const initials = (user?.nome || "U").split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
  const handleLogout = async () => { setLoggingOut(true); await logout(); router.replace("/login"); };

  return (
    <aside className="w-[var(--sidebar-w)] min-w-[var(--sidebar-w)] h-screen flex flex-col bg-card border-r border-border relative z-10 transition-colors">

      {/* Logo */}
      <div className="px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <OrkestriLogo size={32} />
          <div>
            <div className="font-display text-base font-extrabold text-foreground tracking-tight leading-tight">Orkiestri</div>
            <div className="text-[9px] text-muted-foreground font-mono tracking-[0.12em] uppercase leading-none mt-0.5">Orquestramento v1.0</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">

        {user?.isMaster && (
          <div className="mb-1">
            <div className="px-3 py-1.5 text-[10px] font-mono tracking-[0.1em] uppercase font-semibold text-violet-400/70 mb-0.5">Super Admin</div>
            <NavLink item={{ href: "/dashboard/superadmin", label: "Organizações", icon: Shield, permission: null }} path={path} />
          </div>
        )}

        {NAV.map(group => {
          const visible = group.items.filter(i => can(i.permission));
          if (!visible.length) return null;

          // Pinned items — flat, no header
          if (!group.label) {
            return (
              <div key={group.id} className="space-y-0.5 mb-3 pb-3 border-b border-border">
                {visible.map(item => <NavLink key={item.href} item={item} path={path} />)}
              </div>
            );
          }

          const open   = expanded[group.id] ?? false;
          const active = groupHasActive(group, path);

          return (
            <div key={group.id} className="mb-1">
              <button
                onClick={() => toggle(group.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-1.5 rounded-md text-[10px] font-mono tracking-[0.1em] uppercase font-semibold transition-colors mb-0.5",
                  active ? "text-primary" : "text-muted-foreground/60 hover:text-muted-foreground"
                )}
              >
                {group.label}
                <ChevronRight
                  size={11}
                  className={cn("transition-transform duration-200 flex-shrink-0", open && "rotate-90")}
                />
              </button>

              {open && (
                <div className="space-y-0.5 mb-2">
                  {visible.map(item => <NavLink key={item.href} item={item} path={path} />)}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-border flex-shrink-0">
        <div className="p-3 rounded-lg bg-accent/50 border border-border mb-2">
          <div className="flex items-center gap-3 mb-3">
            <Link
              href="/dashboard/perfil"
              className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/40 to-cyan-400/30 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary hover:border-primary/60 transition-colors flex-shrink-0"
            >
              {initials}
            </Link>
            <div className="min-w-0 flex-1">
              <Link href="/dashboard/perfil" className="text-xs font-medium text-foreground truncate hover:text-primary transition-colors block">
                {user?.nome || "Usuário"}
              </Link>
              <div className={cn("text-[10px] font-mono mt-0.5", user?.isMaster ? "text-primary font-semibold" : "text-muted-foreground")}>
                {user?.isMaster ? "MASTER" : "MEMBRO"}
              </div>
            </div>
            <Link href="/dashboard/perfil" title="Meu perfil" className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0">
              <UserCircle size={16} />
            </Link>
          </div>
          <UserStatus />
        </div>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center justify-start gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive border border-transparent transition-colors disabled:opacity-50"
        >
          <LogOut size={15} />
          {loggingOut ? "Saindo..." : "Sair do sistema"}
        </button>
        <p className="text-[10px] text-muted-foreground/50 text-center mt-2 leading-tight">© Orkiestri — Todos os direitos reservados</p>
      </div>
    </aside>
  );
}
