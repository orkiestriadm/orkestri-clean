import { cn } from "@/lib/utils";

/** Content container — max 1280px, responsive padding (doc 06 — Layout). */
export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("container-content", className)}>{children}</div>;
}
