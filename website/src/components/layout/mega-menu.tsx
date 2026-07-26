"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { products } from "@/config/products";
import { services } from "@/config/services";
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
      className="w-[720px] rounded-[--radius-card] border border-gray-200 bg-white p-3 shadow-soft-lg"
    >
      <div className="grid grid-cols-2 gap-1">
        <Link
          href="/products/orkiestri-one"
          onClick={onNavigate}
          className="col-span-2 flex items-center justify-between rounded-2xl bg-dark p-5 text-white transition-transform hover:scale-[1.01] motion-reduce:hover:scale-100"
        >
          <span>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Plataforma
            </span>
            <span className="mt-1 block text-lg font-semibold">
              Orkiestri One
            </span>
            <span className="text-sm text-gray-300">
              O Business Operating System da sua empresa.
            </span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        </Link>

        {products.map((p) => {
          const Icon = p.icon;
          return (
            <Link
              key={p.slug}
              href={`/products/${p.slug}`}
              onClick={onNavigate}
              className="group flex items-start gap-3 rounded-2xl p-3 transition-colors hover:bg-gray-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-hover">
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-dark group-hover:text-primary">
                  {p.name}
                </span>
                <span className="block truncate text-xs text-gray-500">
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
      className="w-[380px] rounded-[--radius-card] border border-gray-200 bg-white p-3 shadow-soft-lg"
    >
      <div className="flex flex-col gap-1">
        {services.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.slug}
              href={`/services/${s.slug}`}
              onClick={onNavigate}
              className="group flex items-start gap-3 rounded-2xl p-3 transition-colors hover:bg-gray-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-hover">
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-dark group-hover:text-primary">
                  {s.name}
                </span>
                <span className="block text-xs text-gray-500">{s.tagline}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}
