import { Container } from "@/components/ui/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";

/** Inner-page hero — eyebrow, title, description, optional breadcrumb. */
export function PageHero({
  eyebrow,
  title,
  description,
  breadcrumb,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumb?: { label: string; href: string }[];
  children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden pt-32 pb-16 md:pt-40 md:pb-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(249,115,22,0.05),transparent_55%)]"
      />
      <Container>
        {breadcrumb && <Breadcrumb items={breadcrumb} className="mb-6" />}
        <div className="max-w-3xl">
          {eyebrow && (
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">
              {eyebrow}
            </span>
          )}
          <h1 className="mt-4 text-[2.5rem] font-bold leading-[1.08] tracking-tight text-dark sm:text-[3.25rem]">
            {title}
          </h1>
          {description && (
            <p className="mt-6 text-lg leading-relaxed text-gray-600">
              {description}
            </p>
          )}
          {children && <div className="mt-8">{children}</div>}
        </div>
      </Container>
    </section>
  );
}
