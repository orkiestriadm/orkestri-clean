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
  { label: "Cases", href: "/cases" },
  { label: "Blog", href: "/blog" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState<"products" | "services" | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  /* Só a home é escura (26/10/2026). As demais páginas seguem claras, então
     o cabeçalho troca de pele pela rota em vez de ter um tema global — que
     exigiria reescrever as outras trinta páginas. */
  const escuro = usePathname() === "/";

  useEffect(() => {
    /* Na home o cabeçalho só vira sólido depois que o botão verde do hero
       sai de vista: enquanto ele está na tela, repetir o CTA aqui em cima
       seria o mesmo verde duas vezes na mesma dobra. */
    const onScroll = () => setScrolled(window.scrollY > (escuro ? 420 : 12));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [escuro]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-all duration-300",
        !scrolled && "border-b border-transparent bg-transparent",
        scrolled &&
          (escuro
            ? "border-b border-white/[0.08] bg-ink/80 backdrop-blur-xl"
            : "border-b border-gray-200 bg-white/80 backdrop-blur-lg"),
      )}
    >
      <div className="container-content flex h-20 items-center justify-between">
        <Logo tone={escuro ? "light" : "dark"} />

        {/* Desktop nav */}
        <nav
          className="hidden items-center gap-1 lg:flex"
          onMouseLeave={() => setOpenMenu(null)}
        >
          <MenuTrigger
            label="Produtos"
            escuro={escuro}
            open={openMenu === "products"}
            onOpen={() => setOpenMenu("products")}
          >
            <ProductsMenu onNavigate={() => setOpenMenu(null)} />
          </MenuTrigger>
          <MenuTrigger
            label="Soluções"
            escuro={escuro}
            open={openMenu === "services"}
            onOpen={() => setOpenMenu("services")}
          >
            <ServicesMenu onNavigate={() => setOpenMenu(null)} />
          </MenuTrigger>
          {simpleLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "relative rounded-lg px-3.5 py-2 text-[0.9375rem] font-medium transition-colors",
                escuro
                  ? "text-chalk-dim hover:text-chalk"
                  : "text-gray-700 hover:text-primary",
              )}
              onMouseEnter={() => setOpenMenu(null)}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <a
            href="/entrar"
            className={cn(
              "rounded-lg px-3.5 py-2 text-[0.9375rem] font-medium transition-colors",
              escuro
                ? "text-chalk-dim hover:text-chalk"
                : "text-gray-700 hover:text-primary",
            )}
          >
            Entrar
          </a>
          {/* O cadastro do site inteiro passa por aqui. Na home ele entra só
              depois que o botão do hero sai de vista (ver `scrolled` acima);
              nas outras páginas está sempre presente, porque lá não há hero
              verde nenhum. */}
          <a
            href={WHATSAPP_CADASTRO}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-(--radius-button) bg-signal px-4",
              "text-[0.9375rem] font-semibold text-[#06281A]",
              "transition-all duration-200 ease-(--ease-out-quart) hover:bg-signal-hover",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
              escuro && !scrolled && "pointer-events-none opacity-0",
            )}
            aria-hidden={escuro && !scrolled}
            tabIndex={escuro && !scrolled ? -1 : undefined}
          >
            <MessageCircle className="h-[18px] w-[18px]" aria-hidden />
            Criar conta
          </a>
        </div>

        {/* Mobile trigger */}
        <button
          type="button"
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-lg lg:hidden",
            escuro ? "text-chalk" : "text-dark",
          )}
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
  escuro,
  open,
  onOpen,
  children,
}: {
  label: string;
  escuro: boolean;
  open: boolean;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative" onMouseEnter={onOpen}>
      <button
        type="button"
        className={cn(
          "inline-flex cursor-pointer items-center gap-1 rounded-lg px-3.5 py-2 text-[0.9375rem] font-medium transition-colors",
          escuro
            ? open
              ? "text-chalk"
              : "text-chalk-dim hover:text-chalk"
            : open
              ? "text-primary"
              : "text-gray-700 hover:text-primary",
        )}
        aria-expanded={open}
      >
        {label}
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            open && "rotate-180"
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
