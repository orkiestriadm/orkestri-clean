"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { ChevronDown, Menu, MessageCircle } from "lucide-react";
import { Logo } from "./logo";
import { ProductsMenu, CompanyMenu } from "./mega-menu";
import { MobileNav } from "./mobile-nav";
import { FaixaTeste } from "./faixa-teste";
import { WHATSAPP_CADASTRO } from "@/config/site";
import { cn } from "@/lib/utils";

const simpleLinks = [
  /* "Planos" vem primeiro entre os links de texto (03/11/2026): era a única
     pergunta que o site inteiro não respondia, e quem procura preço procura
     no cabeçalho antes de rolar a página. */
  { label: "Aurélia", href: "/aurelia" },
  { label: "Planos", href: "/planos" },
  { label: "Tecnologia", href: "/technology" },
];

/**
 * Cabeçalho fixo em cápsula flutuante (`glass-header`).
 *
 * Inspirado na barra flutuante do Meu Assessor: uma pílula centralizada com
 * cantos arredondados (`rounded-full`), efeito de vidro (`backdrop-blur-[20px]`)
 * e borda translúcida, que acompanha o usuário durante toda a rolagem.
 */
export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState<"products" | "company" | null>(
    null,
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const linkDeTexto =
    "whitespace-nowrap rounded-full px-3.5 py-2 text-[0.9rem] font-normal text-chalk-dim transition-colors duration-200 hover:bg-white/[0.05] hover:text-chalk";

  return (
    <header
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpenMenu(null);
      }}
      className="pointer-events-none fixed inset-x-0 top-0 z-40"
    >
      {/* A faixa de oferta mora DENTRO do cabeçalho fixo, e não solta acima
          dele: assim ela não rola para fora da tela, e o espaço que os heróis
          reservam (`--faixa-h`) continua valendo depois da rolagem. */}
      <div className="pointer-events-auto">
        <FaixaTeste />
      </div>

      <div className="px-3 pt-3 sm:px-5 sm:pt-4">
        <div
          className={cn(
            "pointer-events-auto mx-auto flex h-[60px] w-full max-w-[1280px] items-center justify-between rounded-full border pl-5 pr-2.5 transition-all duration-300 sm:pl-7 sm:pr-3",
            scrolled
              ? "border-white/[0.12] bg-[#121318]/80 shadow-[0_18px_44px_-16px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-2xl"
              : "border-white/[0.09] bg-[#1e1e1e]/35 shadow-[0_12px_34px_-16px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-[20px]",
          )}
        >
          <Logo tone="light" />

          <nav
            aria-label="Navegação principal"
            className="hidden items-center gap-1 xl:flex"
            onMouseLeave={() => setOpenMenu(null)}
          >
            <MenuTrigger
              label="Funcionalidades"
              open={openMenu === "products"}
              onOpen={() => setOpenMenu("products")}
              onToggle={() =>
                setOpenMenu(openMenu === "products" ? null : "products")
              }
            >
              <ProductsMenu onNavigate={() => setOpenMenu(null)} />
            </MenuTrigger>
            <MenuTrigger
              label="Quem somos"
              open={openMenu === "company"}
              onOpen={() => setOpenMenu("company")}
              onToggle={() =>
                setOpenMenu(openMenu === "company" ? null : "company")
              }
            >
              <CompanyMenu onNavigate={() => setOpenMenu(null)} />
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
                "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full bg-signal px-5",
                "text-[0.875rem] font-semibold text-[#06281A]",
                "transition-all duration-200 ease-(--ease-out-quart) hover:bg-signal-hover",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
              )}
            >
              <MessageCircle className="h-[17px] w-[17px]" aria-hidden />
              Teste grátis
            </a>
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-chalk transition-colors hover:bg-white/[0.06] xl:hidden"
            aria-label="Abrir menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
        </div>
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
          "inline-flex cursor-pointer items-center gap-1 rounded-full px-3.5 py-2 text-[0.9rem] font-normal transition-colors duration-200",
          open
            ? "bg-white/[0.07] text-chalk"
            : "text-chalk-dim hover:bg-white/[0.05] hover:text-chalk",
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
