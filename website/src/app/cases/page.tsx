import { PageHero } from "@/components/sections/page-hero";
import { Section } from "@/components/ui/section";
import { Testimonials } from "@/components/sections/testimonials";
import { CTA } from "@/components/sections/cta";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Cases",
  description:
    "Resultados construídos através da tecnologia. Cada projeto representa uma oportunidade de transformar operações, reduzir custos e aumentar produtividade.",
  path: "/cases",
});

const segments = [
  "Logística", "Concessionárias", "Transportes", "Indústria",
  "Agronegócio", "Saúde", "Educação", "Construção",
  "Energia", "Serviços", "Tecnologia", "Órgãos Públicos",
];

export default function CasesPage() {
  return (
    <>
      <PageHero
        eyebrow="Cases"
        title="Resultados construídos através da tecnologia."
        description="Cada projeto representa uma oportunidade de transformar operações, reduzir custos e aumentar produtividade. Estamos preparando nossos estudos de caso — em breve, aqui."
        breadcrumb={[{ label: "Cases", href: "/cases" }]}
      />

      <Testimonials />

      <Section muted>
        <p className="text-center text-sm font-semibold uppercase tracking-wider text-primary">
          Segmentos atendidos
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {segments.map((s) => (
            <span
              key={s}
              className="rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-600"
            >
              {s}
            </span>
          ))}
        </div>
      </Section>

      <CTA
        title="Quer ser o próximo case?"
        text="Vamos conversar sobre como transformar a sua operação em um resultado mensurável."
      />
    </>
  );
}
