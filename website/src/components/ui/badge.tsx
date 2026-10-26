import { cn } from "@/lib/utils";

/** Badge — pill, discreta (doc 06 / 07). Radius 999px. */
export function Badge({
  className,
  children,
  variant = "default",
}: {
  className?: string;
  children: React.ReactNode;
  variant?: "default" | "primary" | "outline";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium",
        variant === "default" && "bg-white/[0.06] text-chalk-dim",
        variant === "primary" && "bg-flame/10 text-flame",
        variant === "outline" && "border border-white/[0.08] bg-panel text-chalk-dim",
        className
      )}
    >
      {children}
    </span>
  );
}
