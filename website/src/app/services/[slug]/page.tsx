import { notFound } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { Check, ArrowRight } from "lucide-react";
import { PageHero } from "@/components/sections/page-hero";
import { Section, SectionHeader } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { ServiceCard } from "@/components/cards/service-card";
import { Reveal } from "@/components/animations/reveal";
import { CTA } from "@/components/sections/cta";
import { services, getService } from "@/config/services";
import { buildMetadata } from "@/lib/seo";
import { siteConfig } from "@/config/site";

export function generateStaticParams() {
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) return buildMetadata({ title: "Serviço" });
  return buildMetadata({
    title: service.name,
    description: service.description,
    path: `/services/${service.slug}`,
  });
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) notFound();

  const related = services.filter((s) => s.slug !== service.slug).slice(0, 3);

  const schema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    description: service.description,
    provider: { "@type": "Organization", name: siteConfig.name },
  };

  return (
    <>
      <Script
        id={`service-schema-${service.slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <PageHero
        eyebrow={service.tagline}
        title={service.name}
        description={service.description}
        breadcrumb={[
          { label: "Serviços", href: "/services" },
          { label: service.name, href: `/services/${service.slug}` },
        ]}
      >
        <Button asChild size="lg">
          <Link href="/demo">Solicitar um projeto</Link>
        </Button>
      </PageHero>

      <Section>
        <SectionHeader align="left" eyebrow="O que entregamos" title="Destaques" />
        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {service.highlights.map((h, i) => (
            <Reveal key={h} delay={(i % 2) * 0.05}>
              <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-hover">
                  <Check className="h-4 w-4" aria-hidden />
                </span>
                <span className="font-medium text-dark">{h}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section muted>
        <div className="flex items-end justify-between gap-4">
          <SectionHeader
            align="left"
            eyebrow="Serviços"
            title="Outros serviços"
          />
          <Button asChild variant="ghost" className="hidden shrink-0 sm:inline-flex">
            <Link href="/services">
              Ver todos
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {related.map((s) => (
            <ServiceCard key={s.slug} service={s} />
          ))}
        </div>
      </Section>

      <CTA />
    </>
  );
}
