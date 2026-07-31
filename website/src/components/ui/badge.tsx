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
        variant === "default" && "bg-gray-100 text-gray-700",
        variant === "primary" && "bg-primary-soft text-primary-hover",
        variant === "outline" && "border border-gray-200 bg-white text-gray-600",
        className
      )}
    >
      {children}
    </span>
  );
}
