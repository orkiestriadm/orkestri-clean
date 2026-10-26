"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { X, ChevronDown, MessageCircle } from "lucide-react";
import { Logo } from "./logo";
import { WHATSAPP_CADASTRO } from "@/config/site";
import { products } from "@/config/products";
import { services } from "@/config/services";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";

const staticLinks = [
  { label: "Empresa", href: "/company" },
  { label: "Tecnologia", href: "/technology" },
  { label: "Cases", href: "/cases" },
  { label: "Blog", href: "/blog" },
  { label: "Contato", href: "/contact" },
];

/** Mobile drawer — slides from the right (doc 08 — drawer). */
export function MobileNav({ onClose }: { onClose: () => void }) {
  const [section, setSection] = useState<"products" | "services" | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        /* Gaveta escura: a home é escura e abrir o menu nela devolvia um
           clarão branco. Sob as páginas claras ela continua legível, como
           qualquer folha escura sobre fundo claro. */
        className="absolute right-0 top-0 flex h-full w-[min(88vw,380px)] flex-col border-l border-white/[0.08] bg-ink"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/[0.08] px-6">
          <Logo tone="light" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-chalk hover:bg-white/[0.06]"
          >
            <X className="h-6 w-6" aria-hidden />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-4">
          <Collapsible
            label="Produtos"
            open={section === "products"}
            onToggle={() =>
              setSection(section === "products" ? null : "products")
            }
          >
            <Link
              href="/products/orkiestri-one"
              onClick={onClose}
              className="block rounded-lg px-3 py-2 text-sm font-semibold text-flame-soft"
            >
              Orkiestri One →
            </Link>
            {products.map((p) => (
              <Link
                key={p.slug}
                href={`/products/${p.slug}`}
                onClick={onClose}
                className="block rounded-lg px-3 py-2 text-sm text-chalk-dim hover:bg-white/[0.05] hover:text-chalk"
              >
                {p.name}
              </Link>
            ))}
          </Collapsible>

          <Collapsible
            label="Soluções"
            open={section === "services"}
            onToggle={() =>
              setSection(section === "services" ? null : "services")
            }
          >
            {services.map((s) => (
              <Link
                key={s.slug}
                href={`/services/${s.slug}`}
                onClick={onClose}
                className="block rounded-lg px-3 py-2 text-sm text-chalk-dim hover:bg-white/[0.05] hover:text-chalk"
              >
                {s.name}
              </Link>
            ))}
          </Collapsible>

          {staticLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={onClose}
              className="block rounded-lg px-3 py-3 text-base font-medium text-chalk hover:bg-white/[0.05]"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-2 border-t border-white/[0.08] p-4">
          {/* Único caminho de cadastro, aqui como em todo o resto do site. */}
          <a
            href={WHATSAPP_CADASTRO}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-(--radius-button) bg-signal font-semibold text-[#06281A] transition-colors hover:bg-signal-hover"
          >
            <MessageCircle className="h-5 w-5" aria-hidden />
            Criar minha conta no WhatsApp
          </a>
          <a
            href="/entrar"
            onClick={onClose}
            className="inline-flex h-[52px] w-full items-center justify-center rounded-(--radius-button) border border-white/[0.12] font-medium text-chalk transition-colors hover:bg-white/[0.05]"
          >
            Entrar
          </a>
        </div>
      </motion.aside>
    </div>
  );
}

function Collapsible({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/[0.06] pb-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-3 text-base font-medium text-chalk hover:bg-white/[0.05]"
        aria-expanded={open}
      >
        {label}
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && <div className="pb-1 pl-2">{children}</div>}
    </div>
  );
}
