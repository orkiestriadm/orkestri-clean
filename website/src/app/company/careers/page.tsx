import Link from "next/link";
import { Rocket, Heart, GraduationCap, Globe } from "lucide-react";
import { PageHero } from "@/components/sections/page-hero";
import { IconTile } from "@/components/ui/icon-tile";
import { Section, SectionHeader } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/animations/reveal";
import { buildMetadata } from "@/lib/seo";
import { siteConfig } from "@/config/site";

export const metadata = buildMetadata({
  title: "Carreiras",
  description:
    "Construa o futuro das operações empresariais com a Orkiestri. Valorizamos qualidade, elegância e obsessão por experiência do usuário.",
  path: "/company/careers",
});

const perks = [
  { icon: Rocket, title: "Projetos desafiadores", text: "Engenharia de verdade, do discovery ao deploy." },
  { icon: Heart, title: "Qualidade acima de tudo", text: "Preferimos soluções elegantes a atalhos." },
  { icon: GraduationCap, title: "Evolução contínua", text: "Aprendizado constante e tecnologias modernas." },
  { icon: Globe, title: "Impacto real", text: "Software que transforma empresas de verdade." },
];

export default function CareersPage() {
  return (
    <>
      <PageHero
        eyebrow="Carreiras"
        title="Construa o futuro das operações empresariais."
        description="Somos obcecados por experiência do usuário e acreditamos que software bem construído melhora empresas — e empresas melhores transformam pessoas."
        breadcrumb={[
          { label: "Empresa", href: "/company" },
          { label: "Carreiras", href: "/company/careers" },
        ]}
      />

      <Section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {perks.map((p, i) => {
            const Icon = p.icon;
            return (
              <Reveal key={p.title} delay={(i % 4) * 0.05}>
                <div className="h-full rounded-[--radius-card] border border-gray-200 bg-white p-6">
                  <IconTile icon={Icon} />
                  <h3 className="mt-5 text-lg font-semibold text-dark">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-[0.9375rem] text-gray-500">{p.text}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Section>

      <Section muted>
        <SectionHeader
          eyebrow="Vagas"
          title="Ainda não temos vagas abertas."
          description="Mas estamos sempre em busca de pessoas excepcionais. Envie seu perfil e entraremos em contato quando surgir uma oportunidade."
        />
        <div className="mt-8 flex justify-center">
          <Button asChild size="lg">
            <Link href={`mailto:${siteConfig.contact.email}?subject=Candidatura`}>
              Enviar meu perfil
            </Link>
          </Button>
        </div>
      </Section>
    </>
  );
}
