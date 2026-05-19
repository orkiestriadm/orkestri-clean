"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, CalendarDays, Layers, StickyNote, MessageCircle,
  Building2, GanttChart, BarChart2, Users, History, Settings, LogOut,
  Headphones, PiggyBank, Truck, BookOpen, Package, Zap, Clock, FileText,
  SmilePlus, TrendingUp, UserCircle, Receipt, ChevronDown, Shield, Star,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import UserStatus from "@/components/ui/UserStatus";
import { BrandLogo } from "@/components/ui/logo";
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

const SUPERADMIN_ITEM: NavItem = { href: "/dashboard/superadmin", label: "Organizações", icon: Shield, permission: null };
const ALL_ITEMS: NavItem[] = [SUPERADMIN_ITEM, ...NAV.flatMap(g => g.items)];

function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("orkestri-favorites");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const toggleFavorite = (href: string) => {
    setFavorites(prev => {
      const next = prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href];
      localStorage.setItem("orkestri-favorites", JSON.stringify(next));
      return next;
    });
  };

  return { favorites, toggleFavorite, isFavorite: (href: string) => favorites.includes(href) };
}

function isActive(href: string, path: string) {
  return href === path || (href !== "/dashboard" && path.startsWith(href));
}
function groupHasActive(group: NavGroup, path: string) {
  return group.items.some(i => isActive(i.href, path));
}

function NavItem({ item, path, isFav, onToggleFav }: {
  item: NavItem;
  path: string;
  isFav?: boolean;
  onToggleFav?: (href: string) => void;
}) {
  const active = isActive(item.href, path);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-2.5 px-3 py-[7px] rounded-[8px] text-[13px] font-medium transition-all duration-150 relative",
        active
          ? "text-[var(--sidebar-active-text)] bg-[var(--sidebar-active-bg)]"
          : "text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-hi)] hover:bg-[var(--sidebar-hover)]"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-[var(--sidebar-active-text)] rounded-r-full" />
      )}
      <Icon
        size={14}
        className={cn(
          "shrink-0 transition-colors",
          active
            ? "text-[var(--sidebar-active-text)]"
            : "text-[var(--sidebar-text)] group-hover:text-[var(--sidebar-text-hi)]"
        )}
      />
      <span className="truncate flex-1">{item.label}</span>
      {onToggleFav && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFav(item.href); }}
          className={cn(
            "shrink-0 transition-all duration-150 rounded p-0.5 hover:scale-110",
            isFav
              ? "opacity-100 text-[var(--sidebar-active-text)]"
              : "opacity-0 group-hover:opacity-50 text-[var(--sidebar-text)]"
          )}
          title={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <Star size={10} fill={isFav ? "currentColor" : "none"} />
        </button>
      )}
    </Link>
  );
}

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [loggingOut, setLoggingOut] = useState(false);
  const { favorites, toggleFavorite, isFavorite } = useFavorites();

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

  const favItems = ALL_ITEMS.filter(item => isFavorite(item.href) && can(item.permission));

  return (
    <aside className="sidebar">
      {/* ── Logo ── */}
      <div className="flex items-center justify-center h-14 border-b border-[var(--sidebar-border)] shrink-0 px-4">
        <BrandLogo size="sm" />
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5">

        {/* Super admin item */}
        {user?.isMaster && (
          <div className="mb-3 pb-3 border-b border-[var(--sidebar-border)]">
            <div className="px-3 py-1 text-[10px] font-mono tracking-[0.12em] uppercase mb-0.5" style={{ color: "var(--sidebar-active-text)", opacity: 0.5 }}>
              Super Admin
            </div>
            <NavItem
              item={SUPERADMIN_ITEM}
              path={path}
              isFav={isFavorite(SUPERADMIN_ITEM.href)}
              onToggleFav={toggleFavorite}
            />
          </div>
        )}

        {/* ── Favoritos ── */}
        <div className="pb-3 mb-1 border-b border-[var(--sidebar-border)]">
          <div className="px-3 py-1 text-[10px] font-mono tracking-[0.12em] uppercase text-[var(--sidebar-text)] mb-0.5 flex items-center gap-1.5">
            <Star size={9} />
            Favoritos
          </div>
          {favItems.length === 0 ? (
            <div className="px-3 py-1.5 text-[11px] text-[var(--sidebar-text)] opacity-60 leading-relaxed">
              Fixe módulos com ★ para acesso rápido
            </div>
          ) : (
            <div className="space-y-0.5">
              {favItems.map(item => (
                <NavItem
                  key={item.href}
                  item={item}
                  path={path}
                  isFav
                  onToggleFav={toggleFavorite}
                />
              ))}
            </div>
          )}
        </div>

        {NAV.map(group => {
          const visible = group.items.filter(i => can(i.permission));
          if (!visible.length) return null;

          if (!group.label) {
            return (
              <div key={group.id} className="pb-3 mb-1 border-b border-[var(--sidebar-border)] space-y-0.5">
                {visible.map(item => (
                  <NavItem
                    key={item.href}
                    item={item}
                    path={path}
                    isFav={isFavorite(item.href)}
                    onToggleFav={toggleFavorite}
                  />
                ))}
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
                  "w-full flex items-center justify-between px-3 py-[7px] rounded-[8px] text-[10px] font-mono tracking-[0.1em] uppercase font-semibold transition-all duration-150",
                  active
                    ? "text-[var(--sidebar-active-text)]"
                    : "text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-hi)] hover:bg-[var(--sidebar-hover)]"
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
                  {visible.map(item => (
                    <NavItem
                      key={item.href}
                      item={item}
                      path={path}
                      isFav={isFavorite(item.href)}
                      onToggleFav={toggleFavorite}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── User footer ── */}
      <div className="px-2.5 py-3 border-t border-[var(--sidebar-border)] shrink-0">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] bg-[var(--sidebar-hover)] border border-[var(--sidebar-border)] mb-2 hover:opacity-80 transition-opacity">
          <Link href="/dashboard/perfil" className="relative shrink-0">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500/50 to-violet-700/50 border border-violet-500/30 flex items-center justify-center text-[11px] font-bold text-violet-300">
              {initials}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border-2 border-[var(--sidebar-bg)]" />
          </Link>
          <div className="flex-1 min-w-0">
            <Link href="/dashboard/perfil" className="text-[12px] font-semibold text-[var(--sidebar-text-hi)] hover:opacity-80 transition-opacity block truncate">
              {user?.nome?.split(" ")[0] || "Usuário"}
            </Link>
            <div className={cn(
              "text-[9px] font-mono uppercase tracking-wider",
              user?.isMaster ? "text-[var(--sidebar-active-text)] opacity-70" : "text-[var(--sidebar-text)]"
            )}>
              {user?.isMaster ? "Master" : "Membro"}
            </div>
          </div>
          <Link href="/dashboard/perfil" className="text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-hi)] transition-colors">
            <UserCircle size={14} />
          </Link>
        </div>

        <UserStatus />

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-[8px] text-[12px] font-medium text-[var(--sidebar-text)] hover:text-red-400 hover:bg-red-500/[0.06] transition-all disabled:opacity-40 mt-1"
        >
          <LogOut size={13} />
          {loggingOut ? "Saindo..." : "Sair do sistema"}
        </button>
      </div>
    </aside>
  );
}
