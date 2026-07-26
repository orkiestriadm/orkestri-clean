import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Service } from "@/types";

/** Service card — icon, title, description, hover lift (doc 07). */
export function ServiceCard({ service }: { service: Service }) {
  const Icon = service.icon;
  return (
    <Link
      href={`/services/${service.slug}`}
      className="group flex h-full flex-col rounded-[--radius-card] border border-gray-200 bg-white p-8 transition-all duration-200 ease-[--ease-out-quart] hover:-translate-y-1 hover:border-primary/40 hover:shadow-soft motion-reduce:hover:translate-y-0"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-dark text-white transition-transform duration-200 group-hover:scale-105 motion-reduce:group-hover:scale-100">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="mt-6 flex items-center gap-1.5 text-xl font-semibold text-dark">
        {service.name}
        <ArrowUpRight
          className="h-4 w-4 text-gray-300 transition-colors group-hover:text-primary"
          aria-hidden
        />
      </h3>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-gray-500">
        {service.description}
      </p>
    </Link>
  );
}
