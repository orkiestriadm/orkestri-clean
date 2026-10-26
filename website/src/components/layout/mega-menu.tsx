"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { products } from "@/config/products";
import { services } from "@/config/services";
import { IconTile } from "@/components/ui/icon-tile";
import { EASE_OUT } from "@/lib/motion";

const panel: Variants = {
  hidden: { opacity: 0, scale: 0.98, y: 6 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.18, ease: EASE_OUT },
  },
};

/** Products mega menu — 3-col grid of app cards (doc 07). */
export function ProductsMenu({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <motion.div
      variants={panel}
      initial="hidden"
      animate="show"
      className="w-[720px] rounded-(--radius-card) border border-white/[0.08] bg-panel p-3 shadow-soft-lg"
    >
      <div className="grid grid-cols-2 gap-1">
        <Link
          href="/products/orkiestri-one"
          onClick={onNavigate}
          className="col-span-2 flex items-center justify-between rounded-2xl bg-ink p-5 text-white transition-transform hover:scale-[1.01] motion-reduce:hover:scale-100"
        >
          <span>
            <span className="text-[0.75rem] font-medium text-flame-soft">
              Plataforma
            </span>
            <span className="mt-1 block text-lg font-semibold">
              Orkiestri One
            </span>
            <span className="text-sm text-chalk-faint">
              O Business Operating System da sua empresa.
            </span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-flame-soft" aria-hidden />
        </Link>

        {products.map((p) => {
          const Icon = p.icon;
          return (
            <Link
              key={p.slug}
              href={`/products/${p.slug}`}
              onClick={onNavigate}
              className="group flex items-start gap-3 rounded-2xl p-3 transition-colors hover:bg-white/[0.05]"
            >
              <IconTile icon={Icon} size="sm" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-chalk group-hover:text-flame-soft">
                  {p.name}
                </span>
                <span className="block truncate text-xs text-chalk-dim">
                  {p.category}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}

/** Services mega menu — single column list (doc 07). */
export function ServicesMenu({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <motion.div
      variants={panel}
      initial="hidden"
      animate="show"
      className="w-[380px] rounded-(--radius-card) border border-white/[0.08] bg-panel p-3 shadow-soft-lg"
    >
      <div className="flex flex-col gap-1">
        {services.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.slug}
              href={`/services/${s.slug}`}
              onClick={onNavigate}
              className="group flex items-start gap-3 rounded-2xl p-3 transition-colors hover:bg-white/[0.05]"
            >
              <IconTile icon={Icon} size="sm" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-chalk group-hover:text-flame-soft">
                  {s.name}
                </span>
                <span className="block text-xs text-chalk-dim">{s.tagline}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}
