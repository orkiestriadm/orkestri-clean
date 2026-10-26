import { cn } from "@/lib/utils";

/** Long-form legal / article content with controlled measure. */
export function Prose({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto max-w-3xl text-chalk-dim",
        "[&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-chalk",
        "[&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-chalk",
        "[&_p]:mt-4 [&_p]:leading-relaxed",
        "[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-2",
        "[&_a]:text-flame-soft [&_a]:underline",
        className
      )}
    >
      {children}
    </div>
  );
}
