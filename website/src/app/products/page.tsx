import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/sections/page-hero";
import { Section, SectionHeader } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { ProductsGrid } from "@/components/sections/products-grid";
import { Container } from "@/components/ui/container";
import { CTA } from "@/components/sections/cta";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Produtos",
  description:
    "Conheça o ecossistema Orkiestri One e descubra como cada aplicação contribui para uma operação mais integrada.",
  path: "/products",
});

export default function ProductsPage() {
  return (
    <>
      <PageHero
        eyebrow="Produtos"
        title="Uma plataforma. Múltiplas possibilidades."
        description="Conheça o ecossistema Orkiestri One e descubra como cada aplicação contribui para uma operação mais integrada."
        breadcrumb={[{ label: "Produtos", href: "/products" }]}
      />

      <Container>
        <Link
          href="/products/orkiestri-one"
          className="group flex flex-col items-start justify-between gap-6 rounded-(--radius-image) bg-dark p-8 text-white md:flex-row md:items-center md:p-12"
        >
          <div>
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">
              Plataforma
            </span>
            <h2 className="mt-2 text-2xl font-bold md:text-3xl">
              Orkiestri One — o Business Operating System
            </h2>
            <p className="mt-2 max-w-xl text-gray-300">
              Todas as aplicações compartilham a mesma base, login e experiência.
              Ative apenas os módulos necessários.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-(--radius-button) bg-primary px-6 py-3 font-medium text-white transition-transform group-hover:scale-[1.03] motion-reduce:group-hover:scale-100">
            Conhecer a plataforma
            <ArrowRight className="h-5 w-5" aria-hidden />
          </span>
        </Link>
      </Container>

      <Section>
        <SectionHeader
          eyebrow="Aplicações"
          title="Aplicações desenvolvidas para trabalhar juntas."
          description="Cada módulo resolve um problema específico. Podem ser adquiridos individualmente ou como parte da plataforma completa."
        />
        <div className="mt-12">
          <ProductsGrid />
        </div>
      </Section>

      <div className="flex justify-center pb-4">
        <Button asChild variant="secondary" size="lg">
          <Link href="/services">Conheça também nossas soluções</Link>
        </Button>
      </div>

      <CTA />
    </>
  );
}
