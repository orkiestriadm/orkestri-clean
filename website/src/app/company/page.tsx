import Link from "next/link";
import {
  Sparkles,
  ShieldCheck,
  Gauge,
  Layers,
  Eye,
  Lightbulb,
  Users,
  TrendingUp,
} from "lucide-react";
import { PageHero } from "@/components/sections/page-hero";
import { IconTile } from "@/components/ui/icon-tile";
import { Section, SectionHeader } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Stats } from "@/components/sections/stats";
import { Reveal } from "@/components/animations/reveal";
import { CTA } from "@/components/sections/cta";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Empresa",
  description:
    "A Orkiestri é uma Enterprise Software Company. Acreditamos que grandes empresas precisam de plataformas sólidas, escaláveis e preparadas para evoluir continuamente.",
  path: "/company",
});

const values = [
  { icon: Sparkles, title: "Simplicidade", text: "Tecnologia deve simplificar. Nunca complicar." },
  { icon: Layers, title: "Qualidade", text: "Cada linha de código deve refletir excelência." },
  { icon: ShieldCheck, title: "Segurança", text: "Confiança é construída diariamente." },
  { icon: TrendingUp, title: "Escalabilidade", text: "Construímos soluções preparadas para crescer." },
  { icon: Gauge, title: "Performance", text: "Velocidade é experiência. Experiência gera confiança." },
  { icon: Eye, title: "Transparência", text: "Relacionamentos duradouros nascem de honestidade." },
  { icon: Lightbulb, title: "Inovação", text: "Estamos em constante evolução." },
  { icon: Users, title: "Foco no Cliente", text: "Toda decisão começa pelo problema do cliente." },
];

export default function CompanyPage() {
  return (
    <>
      <PageHero
        eyebrow="Empresa"
        title="Tecnologia construída para durar."
        description="Acreditamos que grandes empresas precisam de plataformas sólidas, escaláveis e preparadas para evoluir continuamente. Nossa missão é desenvolver soluções capazes de acompanhar esse crescimento."
        breadcrumb={[{ label: "Empresa", href: "/company" }]}
      />

      {/* Mission / Vision */}
      <Section>
        <div className="grid gap-6 lg:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-(--radius-card) border border-gray-200 bg-white p-8">
              <span className="text-sm font-semibold uppercase tracking-wider text-primary">
                Missão
              </span>
              <p className="mt-4 text-xl font-medium leading-relaxed text-dark">
                Transformar processos empresariais em operações inteligentes
                através da tecnologia — aumentando produtividade, reduzindo
                desperdícios e criando novas oportunidades de crescimento.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="h-full rounded-(--radius-card) border border-gray-200 bg-white p-8">
              <span className="text-sm font-semibold uppercase tracking-wider text-primary">
                Visão
              </span>
              <p className="mt-4 text-xl font-medium leading-relaxed text-dark">
                Ser reconhecida como uma das principais empresas brasileiras de
                software corporativo — referência em inovação, experiência do
                usuário e inteligência aplicada aos negócios.
              </p>
            </div>
          </Reveal>
        </div>
      </Section>

      <Stats />

      {/* Values */}
      <Section muted>
        <SectionHeader
          eyebrow="Valores"
          title="Princípios que guiam cada decisão."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((v, i) => {
            const Icon = v.icon;
            return (
              <Reveal key={v.title} delay={(i % 4) * 0.05}>
                <div className="h-full rounded-(--radius-card) border border-gray-200 bg-white p-6">
                  <IconTile icon={Icon} />
                  <h3 className="mt-5 text-lg font-semibold text-dark">
                    {v.title}
                  </h3>
                  <p className="mt-2 text-[0.9375rem] text-gray-500">{v.text}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Section>

      {/* Manifesto */}
      <Section>
        <Reveal className="mx-auto max-w-3xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">
            Manifesto
          </span>
          <p className="mt-6 text-[1.75rem] font-semibold leading-snug text-dark md:text-[2.25rem]">
            Empresas deveriam investir seu tempo crescendo. Não apagando
            incêndios, conciliando planilhas ou movimentando informações entre
            sistemas. Tecnologia deve trabalhar para as pessoas — não o
            contrário.
          </p>
          <div className="mt-8 flex justify-center">
            <Button asChild size="lg">
              <Link href="/company/careers">Trabalhe conosco</Link>
            </Button>
          </div>
        </Reveal>
      </Section>

      <CTA />
    </>
  );
}
