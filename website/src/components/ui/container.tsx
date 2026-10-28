import { cn } from "@/lib/utils";

/** Content container — max 1280px, responsive padding (doc 06 — Layout). */
export function Container({
  className,
  children,
  id,
}: {
  className?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return <div id={id} className={cn("container-content", className)}>{children}</div>;
}
