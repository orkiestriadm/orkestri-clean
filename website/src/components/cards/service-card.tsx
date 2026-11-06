import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { IconTile } from "@/components/ui/icon-tile";
import type { Service } from "@/types";

/** Service card — icon, title, description, hover lift (doc 07). */
export function ServiceCard({ service }: { service: Service }) {
  return (
    <Link
      href={`/services/${service.slug}`}
      data-spotlight
      className="premium-surface group flex h-full flex-col rounded-(--radius-card) p-7 transition-all duration-200 ease-(--ease-out-quart) hover:-translate-y-1 hover:border-flame/40 motion-reduce:hover:translate-y-0 focus-visible:border-flame/60"
    >
      <IconTile
        icon={service.icon}
        size="lg"
        tone="dark"
        className="transition-transform duration-200 group-hover:scale-105 motion-reduce:group-hover:scale-100"
      />
      <h3 className="mt-6 flex items-center gap-1.5 text-xl font-semibold text-chalk">
        {service.name}
        <ArrowUpRight
          className="h-4 w-4 text-chalk-faint transition-colors group-hover:text-flame-soft"
          aria-hidden
        />
      </h3>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-chalk-dim">
        {service.description}
      </p>
    </Link>
  );
}
