import { PageHero } from "@/components/sections/page-hero";
import { Section } from "@/components/ui/section";
import { ServicesGrid } from "@/components/sections/services-grid";
import { SoftwareFactory } from "@/components/sections/software-factory";
import { CTA } from "@/components/sections/cta";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Serviços",
  description:
    "Da estratégia ao desenvolvimento. Atuamos em todas as etapas da transformação digital, desde a concepção até a evolução contínua da solução.",
  path: "/services",
});

export default function ServicesPage() {
  return (
    <>
      <PageHero
        eyebrow="Serviços"
        title="Da estratégia ao desenvolvimento."
        description="Nossa equipe atua em todas as etapas da transformação digital, desde a concepção até a evolução contínua da solução."
        breadcrumb={[{ label: "Serviços", href: "/services" }]}
      />
      <Section>
        <ServicesGrid />
      </Section>
      <SoftwareFactory />
      <CTA />
    </>
  );
}
