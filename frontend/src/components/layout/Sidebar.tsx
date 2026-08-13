"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ChevronDown, Star } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { authApi } from "@/lib/api";
import UserStatus from "@/components/ui/UserStatus";
import { cn } from "@/lib/utils";
import { NAV, canAccessGroup, canAccessItemLevel, type NavGroup, type NavItem as NavItemT } from "@/lib/modules";
import { BrandLogo } from "@/components/ui/logo";
import { MARCA, LOGO_ARQUIVO, LOGO_ARQUIVO_CLARO } from "@/lib/marca";

const ALL_ITEMS: NavItemT[] = NAV.flatMap(g => g.items);

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
  item: NavItemT;
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
        "group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 ease-out relative",
        active
          ? "text-[var(--sidebar-active-text)] bg-[var(--sidebar-active-bg)]"
          : "text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-hi)] hover:bg-[var(--sidebar-hover)]"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-[var(--sidebar-active-text)] rounded-r-full" />
      )}
      <Icon
        size={16}
        strokeWidth={active ? 2.5 : 2}
        className={cn(
          "shrink-0 transition-colors duration-200",
          active
            ? "text-[var(--sidebar-active-text)]"
            : "text-[var(--text-muted)] group-hover:text-[var(--sidebar-text-hi)]"
        )}
      />
      <span className="truncate flex-1">{item.label}</span>
      {onToggleFav && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFav(item.href); }}
          className={cn(
            "shrink-0 transition-all duration-200 rounded p-1 hover:scale-110",
            isFav
              ? "opacity-100 text-amber-500"
              : "opacity-0 group-hover:opacity-60 text-[var(--sidebar-text)] hover:text-amber-500"
          )}
          title={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <Star size={12} fill={isFav ? "currentColor" : "none"} strokeWidth={isFav ? 0 : 2} />
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

  // Busca permissões frescas do servidor sempre que o sidebar monta
  // Evita que o store Zustand (in-memory) mostre permissões desatualizadas
  const [freshPerms, setFreshPerms] = useState<string[] | null>(null);
  useEffect(() => {
    authApi.me()
      .then(u => {
        setFreshPerms(u.permissions);
        useAuthStore.setState({ user: u });
      })
      .catch(() => {});
  }, []);

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    let saved: Record<string, boolean> = {};
    if (typeof window !== "undefined") {
      try { saved = JSON.parse(localStorage.getItem("orkestri-sidebar-expanded") || "{}"); } catch {}
    }
    const init: Record<string, boolean> = {};
    for (const g of NAV) {
      if (!g.produto) continue;
      // Se há estado salvo usa ele; caso contrário expande grupo ativo ou "projects"/"finance"
      if (g.id in saved) {
        init[g.id] = saved[g.id];
      } else {
        init[g.id] = groupHasActive(g, path) || g.id === "projects" || g.id === "finance";
      }
    }
    return init;
  });

  const toggle = (id: string) => setExpanded(e => {
    const next = { ...e, [id]: !e[id] };
    try { localStorage.setItem("orkestri-sidebar-expanded", JSON.stringify(next)); } catch {}
    return next;
  });

  const can = (permission: string | string[] | null) => {
    if (!permission || user?.isMaster) return true;
    // freshPerms: permissões buscadas direto da API ao montar (evita store desatualizado)
    const perms: string[] = freshPerms ?? user?.permissions ?? [];
    if (perms.includes("*")) return true;
    // Lista = OU: basta uma. Ver canAccessModule em lib/modules.
    const exigidas = Array.isArray(permission) ? permission : [permission];
    return exigidas.some(p => perms.includes(p));
  };

  const initials = (user?.nome || "U").split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    router.replace("/login");
  };

  // O nível também vale aqui: quem tinha o Sobre fixado antes da restrição
  // continuaria com o atalho no menu, que é o mesmo que não ter restringido.
  const favItems = ALL_ITEMS.filter(
    item => isFavorite(item.href) && canAccessItemLevel(user, item) && can(item.permission),
  );

  return (
    <aside className="sidebar">
      {/* ── Logo ── */}
      {/* A marca vem do AMBIENTE, nunca do código.
          Aqui já esteve escrito `logo-ttbr-colorida.png` direto no JSX, com um
          comentário pedindo para não replicar. O pedido não se sustentou: em
          09/08/2026 uma sincronização trouxe a árvore de homologação para o git
          e a marca do cliente foi junto — produção passou a exibir a logo da
          Triunfo Transbrasiliana no menu. Comentário não impede cópia; caminho
          vindo de variável, sim.
          Sem logotipo configurado (produção), cai no símbolo do produto. */}
      <div className="flex items-center justify-center h-16 border-b border-[var(--sidebar-border)] shrink-0 px-4">
        {LOGO_ARQUIVO ? (
          <>
            {/* Duas variantes porque o menu acompanha o tema: logotipo branco
                sobre fundo claro fica invisível. */}
            <img src={LOGO_ARQUIVO_CLARO} alt={MARCA} className="h-8 w-auto block dark:hidden object-contain" />
            <img src={LOGO_ARQUIVO}       alt={MARCA} className="h-8 w-auto hidden dark:block object-contain" />
          </>
        ) : (
          <BrandLogo size="sm" />
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1 scrollbar-thin">

        {/* ── Favoritos ── */}
        <div className="pb-4 mb-2 border-b border-[var(--sidebar-border)]">
          <div className="px-3 py-1 text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-1 flex items-center gap-1.5">
            <Star size={12} />
            Favoritos
          </div>
          {favItems.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-[var(--sidebar-text)] opacity-60 leading-relaxed italic">
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
          // Grupo restrito (SA / admin da org) só aparece para quem tem o nível.
          if (!canAccessGroup(user, group)) return null;
          const visible = group.items.filter(i => canAccessItemLevel(user, i) && can(i.permission));
          if (!visible.length) return null;

          if (!group.produto) {
            return (
              <div key={group.id} className="pb-4 mb-2 border-b border-[var(--sidebar-border)] space-y-0.5">
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
          const GroupIcon = group.icon;

          return (
            <div key={group.id} className="mb-1">
              <button
                onClick={() => toggle(group.id)}
                className={cn(
                  "group/head w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200",
                  !active && "hover:bg-[var(--sidebar-hover)]"
                )}
              >
                {/* Ícone do produto + nome (marca) + descritor em português */}
                <span className="flex items-center gap-2 min-w-0">
                  <GroupIcon
                    size={15}
                    className={cn(
                      "shrink-0 transition-all duration-200 group-hover/head:scale-110",
                      active
                        ? "text-[var(--sidebar-active-text)]"
                        : "text-[var(--text-muted)] group-hover/head:text-[var(--sidebar-text-hi)]"
                    )}
                  />
                  <span className="flex items-baseline gap-1.5 min-w-0">
                    <span className={cn(
                      "text-[13px] font-semibold tracking-tight transition-colors duration-200",
                      active
                        ? "text-[var(--sidebar-active-text)]"
                        : "text-[var(--sidebar-text-hi)]"
                    )}>
                      {group.produto}
                    </span>
                    <span className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)] truncate">
                      {group.descritor}
                    </span>
                  </span>
                </span>
                <ChevronDown
                  size={12}
                  className={cn(
                    "transition-transform duration-200 shrink-0",
                    active ? "text-[var(--sidebar-active-text)]" : "text-[var(--text-muted)]",
                    open && "rotate-180"
                  )}
                />
              </button>

              <div className={cn(
                "overflow-hidden transition-all duration-300 ease-in-out",
                open ? "max-h-96 opacity-100 mt-1" : "max-h-0 opacity-0"
              )}>
                <div className="space-y-0.5 pb-2">
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
      <div className="px-4 py-4 border-t border-[var(--sidebar-border)] shrink-0 bg-[var(--sidebar-bg)]">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-[12px] bg-[var(--bg-primary)] border border-transparent mb-3 hover:bg-[var(--bg-hover)] transition-all cursor-pointer">
          <Link href="/dashboard/perfil" className="relative shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500/10 to-cyan-500/10 border border-[var(--border-subtle)] flex items-center justify-center text-[11px] font-bold text-[var(--sidebar-text-hi)]">
              {initials}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-[var(--sidebar-bg)]" />
          </Link>
          <div className="flex-1 min-w-0">
            <Link href="/dashboard/perfil" className="text-[13px] font-semibold text-[var(--sidebar-text-hi)] block truncate">
              {user?.nome?.split(" ")[0] || "Usuário"}
            </Link>
            <div className={cn(
              "text-[9px] uppercase tracking-widest font-mono font-medium",
              user?.isMaster ? "text-[var(--sidebar-active-text)]" : "text-[var(--text-muted)]"
            )}>
              {user?.isMaster ? "Master" : "Membro"}
            </div>
          </div>
        </div>

        <UserStatus />

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold text-[var(--sidebar-text)] hover:text-red-500 hover:bg-red-500/[0.04] transition-all disabled:opacity-50 mt-2"
        >
          <LogOut size={13} />
          {loggingOut ? "Saindo..." : "Sair do sistema"}
        </button>
      </div>
    </aside>
  );
}
