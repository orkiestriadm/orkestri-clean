import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { IconTile } from "@/components/ui/icon-tile";
import type { Product } from "@/types";

/** Product card — icon, name, category, tagline, hover lift (doc 07). */
export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex h-full flex-col rounded-(--radius-card) border border-white/[0.08] bg-panel p-6 transition-all duration-200 ease-(--ease-out-quart) hover:-translate-y-1 hover:border-flame/40 hover:shadow-soft motion-reduce:hover:translate-y-0"
    >
      <div className="flex items-center justify-between">
        <IconTile
          icon={product.icon}
          className="transition-transform duration-200 group-hover:scale-105 motion-reduce:group-hover:scale-100"
        />
        <ArrowRight
          className="h-5 w-5 -translate-x-1 text-chalk-faint opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:text-flame-soft group-hover:opacity-100"
          aria-hidden
        />
      </div>
      <span className="mt-5 flex items-center gap-2 text-[0.75rem] font-medium text-chalk-faint">
        {product.category}
        {product.comingSoon && (
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[0.6875rem] font-semibold normal-case tracking-normal text-chalk-dim">
            Em breve
          </span>
        )}
      </span>
      <h3 className="mt-1 text-xl font-semibold text-chalk">{product.name}</h3>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-chalk-dim">
        {product.tagline}
      </p>
    </Link>
  );
}
