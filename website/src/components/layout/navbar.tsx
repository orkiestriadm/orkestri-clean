"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { ChevronDown, Menu } from "lucide-react";
import { Logo } from "./logo";
import { ProductsMenu, ServicesMenu } from "./mega-menu";
import { MobileNav } from "./mobile-nav";
import { Button } from "@/components/ui/button";
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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-all duration-300",
        scrolled
          ? "border-b border-gray-200 bg-white/80 backdrop-blur-lg"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <div className="container-content flex h-20 items-center justify-between">
        <Logo />

        {/* Desktop nav */}
        <nav
          className="hidden items-center gap-1 lg:flex"
          onMouseLeave={() => setOpenMenu(null)}
        >
          <MenuTrigger
            label="Produtos"
            open={openMenu === "products"}
            onOpen={() => setOpenMenu("products")}
          >
            <ProductsMenu onNavigate={() => setOpenMenu(null)} />
          </MenuTrigger>
          <MenuTrigger
            label="Soluções"
            open={openMenu === "services"}
            onOpen={() => setOpenMenu("services")}
          >
            <ServicesMenu onNavigate={() => setOpenMenu(null)} />
          </MenuTrigger>
          {simpleLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="relative rounded-lg px-3.5 py-2 text-[0.9375rem] font-medium text-gray-700 transition-colors hover:text-primary"
              onMouseEnter={() => setOpenMenu(null)}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <a
            href="/login"
            className="rounded-lg px-3.5 py-2 text-[0.9375rem] font-medium text-gray-700 transition-colors hover:text-primary"
          >
            Entrar
          </a>
          <Button asChild size="sm">
            <Link href="/demo">Solicitar demonstração</Link>
          </Button>
        </div>

        {/* Mobile trigger */}
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-dark lg:hidden"
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
  children,
}: {
  label: string;
  open: boolean;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative" onMouseEnter={onOpen}>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 rounded-lg px-3.5 py-2 text-[0.9375rem] font-medium transition-colors",
          open ? "text-primary" : "text-gray-700 hover:text-primary"
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
