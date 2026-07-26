import Link from "next/link";
import Script from "next/script";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/sections/hero";
import { LogoCloud } from "@/components/sections/logo-cloud";
import { Section, SectionHeader } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { ServicesGrid } from "@/components/sections/services-grid";
import { Platform } from "@/components/sections/platform";
import { ProductsGrid } from "@/components/sections/products-grid";
import { AISection } from "@/components/sections/ai-section";
import { SoftwareFactory } from "@/components/sections/software-factory";
import { Stats } from "@/components/sections/stats";
import { Differentials } from "@/components/sections/differentials";
import { Technologies } from "@/components/sections/technologies";
import { Testimonials } from "@/components/sections/testimonials";
import { FAQ } from "@/components/sections/faq";
import { CTA } from "@/components/sections/cta";
import { Reveal } from "@/components/animations/reveal";
import { homeFaq } from "@/config/content";
import { buildMetadata, softwareApplicationSchema } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/",
  keywords: [
    "software empresarial",
    "plataforma empresarial",
    "business operating system",
    "software sob medida",
    "inteligência artificial",
    "Orkiestri One",
  ],
});

export default function HomePage() {
  return (
    <>
      <Script
        id="software-app-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationSchema()),
        }}
      />

      <Hero />
      <LogoCloud />

      {/* Quem Somos */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">
              Quem Somos
            </span>
            <h2 className="mt-4 text-[2rem] font-bold text-dark md:text-[2.75rem]">
              Construindo tecnologia para empresas que querem evoluir.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="flex flex-col gap-4 text-lg leading-relaxed text-gray-600">
              <p>
                A Orkiestri é uma Enterprise Software Company especializada no
                desenvolvimento de plataformas corporativas, softwares sob medida
                e soluções baseadas em Inteligência Artificial.
              </p>
              <p>
                Nossa missão é simplificar operações complexas através de
                tecnologia moderna, escalável e preparada para o futuro. Criamos
                produtos que evoluem junto com nossos clientes.
              </p>
              <Button asChild variant="ghost" className="w-fit px-0 hover:bg-transparent hover:text-primary">
                <Link href="/company">
                  Conheça nossa história
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* Serviços */}
      <Section muted>
        <SectionHeader
          eyebrow="Serviços"
          title="Tecnologia para cada etapa da sua transformação digital."
          description="Unimos estratégia, engenharia e inovação para desenvolver soluções completas que impulsionam o crescimento das empresas."
        />
        <div className="mt-12">
          <ServicesGrid />
        </div>
      </Section>

      <Platform />

      {/* Produtos */}
      <Section>
        <SectionHeader
          eyebrow="Produtos"
          title="Aplicações desenvolvidas para trabalhar juntas."
          description="Cada módulo resolve um problema específico. Juntos, formam um ecossistema completo para gestão empresarial."
        />
        <div className="mt-12">
          <ProductsGrid />
        </div>
        <div className="mt-10 flex justify-center">
          <Button asChild variant="secondary" size="lg">
            <Link href="/products">Ver todos os produtos</Link>
          </Button>
        </div>
      </Section>

      <AISection />
      <SoftwareFactory />
      <Stats />
      <Differentials />
      <Technologies />
      <Testimonials />
      <FAQ items={homeFaq} />
      <CTA />
    </>
  );
}
