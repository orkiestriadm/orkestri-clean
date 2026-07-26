"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { X, ChevronDown } from "lucide-react";
import { Logo } from "./logo";
import { Button } from "@/components/ui/button";
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
        className="absolute inset-0 bg-dark/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        className="absolute right-0 top-0 flex h-full w-[min(88vw,380px)] flex-col bg-white shadow-soft-lg"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
      >
        <div className="flex h-20 items-center justify-between border-b border-gray-200 px-6">
          <Logo />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-dark hover:bg-gray-100"
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
              className="block rounded-lg px-3 py-2 text-sm font-semibold text-primary"
            >
              Orkiestri One →
            </Link>
            {products.map((p) => (
              <Link
                key={p.slug}
                href={`/products/${p.slug}`}
                onClick={onClose}
                className="block rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                {p.name}
              </Link>
            ))}
          </Collapsible>

          <Collapsible
            label="Serviços"
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
                className="block rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
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
              className="block rounded-lg px-3 py-3 text-base font-medium text-dark hover:bg-gray-50"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-2 border-t border-gray-200 p-4">
          <Button asChild className="w-full">
            <Link href="/demo" onClick={onClose}>
              Solicitar demonstração
            </Link>
          </Button>
          <a
            href="/login"
            onClick={onClose}
            className="inline-flex h-[52px] w-full items-center justify-center rounded-[--radius-button] border border-gray-200 bg-white font-medium text-dark transition-colors hover:bg-gray-50"
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
    <div className="border-b border-gray-100 pb-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-base font-medium text-dark hover:bg-gray-50"
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
