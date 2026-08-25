import Link from "next/link";
import Script from "next/script";
import {
  Boxes,
  Zap,
  BrainCircuit,
  BarChart3,
  Plug,
  ShieldCheck,
  Check,
} from "lucide-react";
import { PageHero } from "@/components/sections/page-hero";
import { IconTile } from "@/components/ui/icon-tile";
import { Section, SectionHeader } from "@/components/ui/section";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { TrialButton } from "@/components/trial/trial-button";
import { ScreensCarousel } from "@/components/sections/screens-carousel";
import { ProductsGrid } from "@/components/sections/products-grid";
import { Reveal } from "@/components/animations/reveal";
import { CTA } from "@/components/sections/cta";
import { buildMetadata, softwareApplicationSchema } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Orkiestri One — Business Operating System",
  description:
    "O Orkiestri One é um Business Operating System: uma plataforma empresarial modular que conecta pessoas, processos, informações e tecnologia em um único ambiente.",
  path: "/products/orkiestri-one",
});

const layers = [
  { icon: Boxes, title: "Core Platform", text: "Identidade, autenticação, permissões e integrações." },
  { icon: Zap, title: "Automation Engine", text: "Fluxos, eventos, aprovações e notificações." },
  { icon: BrainCircuit, title: "Artificial Intelligence", text: "Copilotos, OCR, busca e análise — nativos." },
  { icon: BarChart3, title: "Analytics", text: "Dashboards, KPIs e Business Intelligence." },
  { icon: Plug, title: "Integration Layer", text: "API REST, webhooks, filas e mensageria." },
  { icon: ShieldCheck, title: "Security", text: "MFA, criptografia, auditoria e LGPD." },
];

const benefits = [
  "Centralização das operações",
  "Redução de retrabalho",
  "Automação de processos",
  "Visão unificada",
  "Melhor tomada de decisão",
  "Experiência consistente",
  "Integração entre departamentos",
  "Evolução contínua",
];

export default function OrkiestriOnePage() {
  return (
    <>
      <Script
        id="platform-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationSchema()),
        }}
      />

      <PageHero
        eyebrow="Orkiestri One"
        title="O sistema operacional da sua empresa."
        description="Uma plataforma empresarial modular que reúne gestão, automação, inteligência artificial e integrações em uma única experiência. Uma empresa. Uma plataforma. Um login. Uma experiência."
        breadcrumb={[
          { label: "Produtos", href: "/products" },
          { label: "Orkiestri One", href: "/products/orkiestri-one" },
        ]}
      >
        <div className="flex flex-wrap gap-3">
          <TrialButton size="lg">Solicitar demonstração</TrialButton>
          <Button asChild variant="secondary" size="lg">
            <Link href="#aplicacoes">Ver aplicações</Link>
          </Button>
        </div>
      </PageHero>

      <Container className="pb-8">
        <Reveal>
          <ScreensCarousel />
        </Reveal>
      </Container>

      {/* Concept */}
      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">
            O conceito
          </span>
          <h2 className="mt-4 text-[2rem] font-bold text-dark md:text-[2.75rem]">
            Não é um ERP. Não é um CRM. É um Business Operating System.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            Assim como um sistema operacional conecta hardware e aplicativos, o
            Orkiestri One conecta todos os processos da empresa. Ele funciona
            como uma camada central que organiza toda a operação corporativa —
            substituindo dezenas de ferramentas isoladas por uma única
            experiência integrada.
          </p>
        </div>
      </Section>

      {/* Architecture layers */}
      <Section muted>
        <SectionHeader
          eyebrow="Arquitetura"
          title="Uma base tecnológica compartilhada."
          description="Cada aplicação compartilha a mesma fundação — segurança, IA, automação e analytics — garantindo consistência e escala."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {layers.map((l, i) => {
            const Icon = l.icon;
            return (
              <Reveal key={l.title} delay={(i % 3) * 0.05}>
                <div className="h-full rounded-(--radius-card) border border-gray-200 bg-white p-6">
                  <IconTile icon={Icon} />
                  <h3 className="mt-5 text-lg font-semibold text-dark">
                    {l.title}
                  </h3>
                  <p className="mt-2 text-[0.9375rem] text-gray-500">{l.text}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Section>

      {/* Apps */}
      <Section id="aplicacoes">
        <SectionHeader
          eyebrow="Aplicações"
          title="Ative apenas o que sua empresa precisa."
          description="Cada aplicação pode ser adquirida individualmente ou como parte da plataforma completa. A plataforma cresce conforme a empresa evolui."
        />
        <div className="mt-12">
          <ProductsGrid />
        </div>
      </Section>

      {/* Benefits */}
      <Section muted>
        <SectionHeader eyebrow="Benefícios" title="O que muda na sua operação." />
        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2">
          {benefits.map((b, i) => (
            <Reveal key={b} delay={(i % 2) * 0.05}>
              <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-hover">
                  <Check className="h-4 w-4" aria-hidden />
                </span>
                <span className="font-medium text-dark">{b}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <CTA
        title="Uma nova forma de operar sua empresa."
        text="One Platform. Infinite Business. Vamos mostrar como o Orkiestri One conecta toda a sua operação."
      />
    </>
  );
}
