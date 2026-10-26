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
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { ScreensCarousel } from "@/components/sections/screens-carousel";
import { ProductsGrid } from "@/components/sections/products-grid";
import { Reveal } from "@/components/animations/reveal";
import { CTA } from "@/components/sections/cta";
import { buildMetadata, softwareApplicationSchema } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Orkiestri One",
  description:
    "Agenda, contas, projetos, pedidos e procedimentos sob o mesmo login — e todos avisando no seu WhatsApp na hora em que ainda dá tempo.",
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
        title="Tudo o que você precisa lembrar, num lugar só."
        description="Seis aplicações que dividem o mesmo login e o mesmo banco de dados. Você liga as que usa; cada uma sabe te achar no WhatsApp quando chega a hora."
        breadcrumb={[
          { label: "Produtos", href: "/products" },
          { label: "Orkiestri One", href: "/products/orkiestri-one" },
        ]}
      >
        <div className="flex flex-wrap gap-3">
          <WhatsAppButton />
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
          <span className="text-[0.8125rem] font-medium text-flame-soft">
            O conceito
          </span>
          <h2 className="mt-4 text-[2rem] font-bold text-chalk md:text-[2.75rem]">
            Não é um ERP. É o lugar onde a sua semana cabe.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-chalk-dim">
            ERP existe para a empresa fechar o mês. Este existe para você não
            perder a reunião das duas, não esquecer a conta que vence dia 10 e
            não ser cobrado de novo por um procedimento que já escreveu. As
            telas são as mesmas para uma pessoa e para um time — muda só quem
            recebe o aviso.
          </p>
        </div>
      </Section>

      {/* Architecture layers */}
      <Section muted>
        <SectionHeader
          eyebrow="Arquitetura"
          title="Uma base só, para não repetir cadastro."
          description="Login, permissões, avisos e histórico são os mesmos em todas as aplicações. Você cadastra uma pessoa uma vez e ela existe no sistema inteiro."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {layers.map((l, i) => {
            const Icon = l.icon;
            return (
              <Reveal key={l.title} delay={(i % 3) * 0.05}>
                <div className="h-full rounded-(--radius-card) border border-white/[0.08] bg-panel p-6">
                  <IconTile icon={Icon} />
                  <h3 className="mt-5 text-lg font-semibold text-chalk">
                    {l.title}
                  </h3>
                  <p className="mt-2 text-[0.9375rem] text-chalk-dim">{l.text}</p>
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
          title="Ligue só o que você usa."
          description="Dá para começar só com a agenda e os gastos. O que você não liga não aparece na sua tela, e dá para ligar depois sem recomeçar nada."
        />
        <div className="mt-12">
          <ProductsGrid />
        </div>
      </Section>

      {/* Benefits */}
      <Section muted>
        <SectionHeader eyebrow="Benefícios" title="O que muda no seu dia." />
        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2">
          {benefits.map((b, i) => (
            <Reveal key={b} delay={(i % 2) * 0.05}>
              <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-panel px-5 py-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-flame/10 text-flame">
                  <Check className="h-4 w-4" aria-hidden />
                </span>
                <span className="font-medium text-chalk">{b}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <CTA
        title="Comece pela agenda. O resto vem quando precisar."
        text="A conta nasce numa conversa de WhatsApp, com os módulos já ligados."
      />
    </>
  );
}
