"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, CalendarDays, Layers, StickyNote, MessageCircle,
  Building2, GanttChart, BarChart2, Users, History, Settings, LogOut,
  Headphones, PiggyBank, Truck, BookOpen, Package, Zap, Clock, FileText,
  SmilePlus, TrendingUp, UserCircle, Receipt, ChevronDown, Shield,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import UserStatus from "@/components/ui/UserStatus";
import { cn } from "@/lib/utils";

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
      { href: "/dashboard/chamados",     label: "Chamados",     icon: Headphones,   permission: "chamados:ver" },
      { href: "/dashboard/apontamentos", label: "Horas",        icon: Clock,        permission: "chamados:ver" },
      { href: "/dashboard/csat",         label: "CSAT",         icon: SmilePlus,    permission: "chamados:ver" },
      { href: "/dashboard/conhecimento", label: "Conhecimento", icon: BookOpen,     permission: "conhecimento:ver" },
    ],
  },
  {
    id: "operacoes", label: "Operações",
    items: [
      { href: "/dashboard/projetos", label: "Projetos",       icon: Layers,       permission: "projetos:ver" },
      { href: "/dashboard/gantt",    label: "Linha do Tempo", icon: GanttChart,   permission: "gantt:ver" },
      { href: "/dashboard/agenda",   label: "Agenda",         icon: CalendarDays, permission: "agenda:ver" },
      { href: "/dashboard/ativos",   label: "Ativos",         icon: Package,      permission: "ativos:ver" },
      { href: "/dashboard/keep",     label: "Keep",           icon: StickyNote,   permission: "keep:ver" },
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

function NavItem({ item, path }: { item: NavItem; path: string }) {
  const active = isActive(item.href, path);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-2.5 px-3 py-[7px] rounded-[8px] text-[13px] font-medium transition-all duration-150 relative",
        active
          ? "text-violet-400 bg-violet-500/10"
          : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-violet-500 rounded-r-full" />
      )}
      <Icon
        size={14}
        className={cn(
          "shrink-0 transition-colors",
          active ? "text-violet-400" : "text-white/25 group-hover:text-white/50"
        )}
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [loggingOut, setLoggingOut] = useState(false);

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
  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    router.replace("/login");
  };

  return (
    <aside className="sidebar">
      {/* ── Logo ── */}
      <div className="flex items-center justify-center h-14 border-b border-white/[0.04] shrink-0 px-4">
        <img src="/logo-orkiestri-dark.png" alt="Logo Orkiestri" className="h-10 w-auto object-contain mix-blend-screen" />
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5">

        {/* Super admin item */}
        {user?.isMaster && (
          <div className="mb-3 pb-3 border-b border-white/[0.04]">
            <div className="px-3 py-1 text-[10px] font-mono tracking-[0.12em] uppercase text-violet-500/50 mb-0.5">Super Admin</div>
            <NavItem item={{ href: "/dashboard/superadmin", label: "Organizações", icon: Shield, permission: null }} path={path} />
          </div>
        )}

        {NAV.map(group => {
          const visible = group.items.filter(i => can(i.permission));
          if (!visible.length) return null;

          if (!group.label) {
            return (
              <div key={group.id} className="pb-3 mb-1 border-b border-white/[0.04] space-y-0.5">
                {visible.map(item => <NavItem key={item.href} item={item} path={path} />)}
              </div>
            );
          }

          const open   = expanded[group.id] ?? false;
          const active = groupHasActive(group, path);

          return (
            <div key={group.id} className="mb-0.5">
              <button
                onClick={() => toggle(group.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-[7px] rounded-[8px] text-[10px] font-mono tracking-[0.1em] uppercase font-semibold transition-all duration-150 group",
                  active ? "text-violet-400/80" : "text-white/20 hover:text-white/40 hover:bg-white/[0.03]"
                )}
              >
                {group.label}
                <ChevronDown
                  size={10}
                  className={cn("transition-transform duration-200 shrink-0", open && "rotate-180")}
                />
              </button>

              <div className={cn(
                "overflow-hidden transition-all duration-200 ease-in-out",
                open ? "max-h-96 opacity-100 mt-0.5" : "max-h-0 opacity-0"
              )}>
                <div className="space-y-0.5 pb-1">
                  {visible.map(item => <NavItem key={item.href} item={item} path={path} />)}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── User footer ── */}
      <div className="px-2.5 py-3 border-t border-white/[0.04] shrink-0">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] bg-white/[0.03] border border-white/[0.05] mb-2 group hover:bg-white/[0.05] transition-colors">
          <Link href="/dashboard/perfil" className="relative shrink-0">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500/50 to-violet-700/50 border border-violet-500/30 flex items-center justify-center text-[11px] font-bold text-violet-300">
              {initials}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-[#0d0d1c]" />
          </Link>
          <div className="flex-1 min-w-0">
            <Link href="/dashboard/perfil" className="text-[12px] font-semibold text-white/70 hover:text-white transition-colors block truncate">
              {user?.nome?.split(" ")[0] || "Usuário"}
            </Link>
            <div className={cn(
              "text-[9px] font-mono uppercase tracking-wider",
              user?.isMaster ? "text-violet-400/70" : "text-white/25"
            )}>
              {user?.isMaster ? "Master" : "Membro"}
            </div>
          </div>
          <Link href="/dashboard/perfil" className="text-white/20 hover:text-white/50 transition-colors">
            <UserCircle size={14} />
          </Link>
        </div>

        <UserStatus />

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-[8px] text-[12px] font-medium text-white/25 hover:text-red-400/80 hover:bg-red-500/[0.06] transition-all disabled:opacity-40 mt-1"
        >
          <LogOut size={13} />
          {loggingOut ? "Saindo..." : "Sair do sistema"}
        </button>
      </div>
    </aside>
  );
}
