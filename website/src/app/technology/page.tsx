import {
  Boxes,
  Cloud,
  ShieldCheck,
  Plug,
  Webhook,
  Gauge,
  TrendingUp,
  Activity,
  BrainCircuit,
} from "lucide-react";
import { PageHero } from "@/components/sections/page-hero";
import { Section } from "@/components/ui/section";
import { Technologies } from "@/components/sections/technologies";
import { Reveal } from "@/components/animations/reveal";
import { CTA } from "@/components/sections/cta";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Tecnologia",
  description:
    "Arquiteturas escaláveis e tecnologias modernas para garantir performance, segurança e evolução contínua. Cloud First, API First, AI Ready, Security by Design.",
  path: "/technology",
});

const pillars = [
  { icon: Boxes, title: "Arquitetura", text: "Clean Architecture, modular e componentizada, preparada para os próximos dez anos." },
  { icon: Cloud, title: "Cloud", text: "Cloud Native sobre AWS, Azure e Google Cloud, com escalabilidade horizontal." },
  { icon: ShieldCheck, title: "Segurança", text: "Security by Design: MFA, criptografia, permissões granulares e conformidade com a LGPD." },
  { icon: Plug, title: "Integrações", text: "Conexão com Microsoft 365, Google Workspace, SAP, TOTVS, Oracle e mais." },
  { icon: Webhook, title: "API", text: "API First com REST, webhooks e versionamento semântico." },
  { icon: Gauge, title: "Performance", text: "Server Components, streaming, cache e otimização contínua." },
  { icon: TrendingUp, title: "Escalabilidade", text: "Multiempresa, multifilial e multiunidade por padrão." },
  { icon: Activity, title: "Observabilidade", text: "Logs, métricas e alertas para operar com confiança." },
  { icon: BrainCircuit, title: "Inteligência Artificial", text: "IA nativa: agentes, OCR, RAG e automações inteligentes." },
];

export default function TechnologyPage() {
  return (
    <>
      <PageHero
        eyebrow="Tecnologia"
        title="Engenharia preparada para os próximos dez anos."
        description="Utilizamos arquiteturas escaláveis e tecnologias amplamente adotadas pelo mercado para garantir performance, segurança e evolução contínua."
        breadcrumb={[{ label: "Tecnologia", href: "/technology" }]}
      />

      <Section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((p, i) => {
            const Icon = p.icon;
            return (
              <Reveal key={p.title} delay={(i % 3) * 0.05}>
                <div className="h-full rounded-[--radius-card] border border-gray-200 bg-white p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-dark text-white">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
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

      <Technologies />
      <CTA />
    </>
  );
}
