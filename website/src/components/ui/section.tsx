import { cn } from "@/lib/utils";
import { Container } from "./container";

/**
 * Section — alternates white / very-light-gray backgrounds (doc 06).
 * Generous vertical rhythm.
 */
export function Section({
  className,
  containerClassName,
  muted = false,
  as: Tag = "section",
  id,
  children,
}: {
  className?: string;
  containerClassName?: string;
  muted?: boolean;
  as?: React.ElementType;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <Tag
      id={id}
      className={cn(
        "py-20 md:py-28",
        muted && "bg-gray-50",
        className
      )}
    >
      <Container className={containerClassName}>{children}</Container>
    </Tag>
  );
}

/** Section eyebrow + title + description block (reused across pages). */
export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "mx-auto max-w-2xl text-center items-center",
        className
      )}
    >
      {eyebrow && (
        <span className="text-sm font-semibold uppercase tracking-wider text-primary">
          {eyebrow}
        </span>
      )}
      <h2 className="text-[2rem] md:text-[2.75rem] font-bold text-dark">
        {title}
      </h2>
      {description && (
        <p className="text-lg text-gray-600 leading-relaxed">{description}</p>
      )}
    </div>
  );
}
