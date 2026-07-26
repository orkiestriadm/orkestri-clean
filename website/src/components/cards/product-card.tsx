import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { IconTile } from "@/components/ui/icon-tile";
import type { Product } from "@/types";

/** Product card — icon, name, category, tagline, hover lift (doc 07). */
export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex h-full flex-col rounded-[--radius-card] border border-gray-200 bg-white p-6 transition-all duration-200 ease-[--ease-out-quart] hover:-translate-y-1 hover:border-primary/40 hover:shadow-soft motion-reduce:hover:translate-y-0"
    >
      <div className="flex items-center justify-between">
        <IconTile
          icon={product.icon}
          className="transition-transform duration-200 group-hover:scale-105 motion-reduce:group-hover:scale-100"
        />
        <ArrowRight
          className="h-5 w-5 -translate-x-1 text-gray-300 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:text-primary group-hover:opacity-100"
          aria-hidden
        />
      </div>
      <span className="mt-5 text-xs font-semibold uppercase tracking-wider text-gray-400">
        {product.category}
      </span>
      <h3 className="mt-1 text-xl font-semibold text-dark">{product.name}</h3>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-gray-500">
        {product.tagline}
      </p>
    </Link>
  );
}
