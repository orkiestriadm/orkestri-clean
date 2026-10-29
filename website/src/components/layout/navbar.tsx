"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { ChevronDown, Menu, MessageCircle } from "lucide-react";
import { Logo } from "./logo";
import { ProductsMenu, ServicesMenu } from "./mega-menu";
import { MobileNav } from "./mobile-nav";
import { WHATSAPP_CADASTRO } from "@/config/site";
import { cn } from "@/lib/utils";

const simpleLinks = [
  { label: "Empresa", href: "/company" },
  { label: "Tecnologia", href: "/technology" },
  { label: "Como funciona", href: "/demo" },
];

/**
 * Cabeçalho fixo.
 *
 * O site inteiro é escuro desde 26/10/2026. Até então só a home era, e este
 * componente carregava duas peles decididas pela rota — some aqui o ramo
 * claro inteiro, que virou código morto no mesmo dia.
 */
export function Navbar() {
  const pathname = usePathname();
  const naHome = pathname === "/";
  /* Só a home começa com o cabeçalho transparente, porque lá ele fica sobre
     um hero alto. Nas páginas internas ele já nasce sólido: assim o conteúdo
     nunca passa por baixo de um cabeçalho invisível enquanto o JavaScript
     ainda não rodou — e o estado inicial bate com o servidor, porque a rota
     é a mesma dos dois lados. */
  const [scrolled, setScrolled] = useState(!naHome);
  const [openMenu, setOpenMenu] = useState<"products" | "services" | null>(
    null,
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    /* A home abre transparente; as páginas internas usam a superfície sólida. */
    const onScroll = () => setScrolled(window.scrollY > (naHome ? 420 : 12));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [naHome]);

  const linkDeTexto =
    "whitespace-nowrap rounded-lg px-3.5 py-2 text-[0.9375rem] font-medium text-chalk-dim transition-colors hover:text-chalk";

  return (
    <header
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpenMenu(null);
      }}
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-all duration-300",
        scrolled
          ? "site-warm-surface border-b border-white/[0.08] bg-ink/80 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="container-content flex h-20 items-center justify-between">
        <Logo tone="light" />

        <nav
          aria-label="Navegação principal"
          className="hidden items-center gap-1 xl:flex"
          onMouseLeave={() => setOpenMenu(null)}
        >
          <MenuTrigger
            label="Produtos"
            open={openMenu === "products"}
            onOpen={() => setOpenMenu("products")}
            onToggle={() =>
              setOpenMenu(openMenu === "products" ? null : "products")
            }
          >
            <ProductsMenu onNavigate={() => setOpenMenu(null)} />
          </MenuTrigger>
          <MenuTrigger
            label="Soluções"
            open={openMenu === "services"}
            onOpen={() => setOpenMenu("services")}
            onToggle={() =>
              setOpenMenu(openMenu === "services" ? null : "services")
            }
          >
            <ServicesMenu onNavigate={() => setOpenMenu(null)} />
          </MenuTrigger>
          {simpleLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "relative",
                linkDeTexto,
                pathname === l.href && "nav-active",
              )}
              aria-current={pathname === l.href ? "page" : undefined}
              onMouseEnter={() => setOpenMenu(null)}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 xl:flex">
          <a href="/login" className={linkDeTexto}>
            Entrar
          </a>
          {/* O cadastro do site inteiro passa por aqui. */}
          <a
            href={WHATSAPP_CADASTRO}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-(--radius-button) bg-signal px-4",
              "text-[0.9375rem] font-semibold text-[#06281A]",
              "transition-all duration-200 ease-(--ease-out-quart) hover:bg-signal-hover",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
            )}
          >
            <MessageCircle className="h-[18px] w-[18px]" aria-hidden />
            Cadastre-se é gratuito!
          </a>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-chalk xl:hidden"
          aria-label="Abrir menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-6 w-6" aria-hidden />
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && <MobileNav onClose={() => setMobileOpen(false)} />}
      </AnimatePresence>
    </header>
  );
}

function MenuTrigger({
  label,
  open,
  onOpen,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onOpen: () => void;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative" onMouseEnter={onOpen}>
      <button
        type="button"
        className={cn(
          "inline-flex cursor-pointer items-center gap-1 rounded-lg px-3.5 py-2 text-[0.9375rem] font-medium transition-colors",
          open ? "text-chalk" : "text-chalk-dim hover:text-chalk",
        )}
        aria-expanded={open}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) onToggle();
        }}
      >
        {label}
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <AnimatePresence>
        {open && (
          <div className="absolute left-1/2 top-full -translate-x-1/2 pt-3">
            {children}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
