import type { LucideIcon } from "lucide-react";
import { IconTile } from "@/components/ui/icon-tile";

/** Feature card — icon, title, description (doc 07). */
export function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full flex-col rounded-[--radius-card] border border-gray-200 bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-soft motion-reduce:hover:translate-y-0">
      <IconTile icon={icon} />
      <h3 className="mt-5 text-lg font-semibold text-dark">{title}</h3>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-gray-500">
        {description}
      </p>
    </div>
  );
}
