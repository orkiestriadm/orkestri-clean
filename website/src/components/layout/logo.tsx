import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Orkiestri wordmark. Minimal, geometric mark + type.
 * The mark evokes "orchestration" — concentric nodes converging.
 */
export function Logo({
  className,
  tone = "dark",
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  return (
    <Link
      href="/"
      aria-label="Orkiestri — página inicial"
      className={cn("inline-flex items-center gap-2.5", className)}
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        aria-hidden
        className="shrink-0"
      >
        <rect width="28" height="28" rx="7" fill="#F97316" />
        <circle cx="14" cy="14" r="3" fill="white" />
        <circle
          cx="14"
          cy="14"
          r="7"
          stroke="white"
          strokeWidth="1.75"
          strokeOpacity="0.55"
        />
        <circle cx="14" cy="5.5" r="1.6" fill="white" />
        <circle cx="22.5" cy="14" r="1.6" fill="white" />
        <circle cx="5.5" cy="14" r="1.6" fill="white" />
      </svg>
      <span
        className={cn(
          "text-xl font-bold tracking-tight",
          tone === "dark" ? "text-dark" : "text-white"
        )}
      >
        Orkiestri
      </span>
    </Link>
  );
}
