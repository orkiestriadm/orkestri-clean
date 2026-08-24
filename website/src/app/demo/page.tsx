import { Check } from "lucide-react";
import { PageHero } from "@/components/sections/page-hero";
import { Container } from "@/components/ui/container";
import { DemoForm } from "@/components/forms/demo-form";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Solicitar Demonstração",
  description:
    "Solicite uma demonstração do Orkiestri One e descubra como centralizar operações, automatizar processos e acelerar resultados.",
  path: "/demo",
});

const benefits = [
  "Demonstração guiada pela nossa equipe",
  "Foco nos desafios da sua operação",
  "Sem compromisso",
  "Resposta em até 1 dia útil",
];

export default function DemoPage() {
  return (
    <>
      <PageHero
        eyebrow="Demonstração"
        title="Veja o Orkiestri One em ação."
        description="Conte-nos sobre a sua operação e prepararemos uma demonstração focada nos seus desafios reais."
        breadcrumb={[{ label: "Demonstração", href: "/demo" }]}
      />
      <Container className="pb-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <ul className="flex flex-col gap-4">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-hover">
                  <Check className="h-4 w-4" aria-hidden />
                </span>
                <span className="text-gray-600">{b}</span>
              </li>
            ))}
          </ul>
          <DemoForm />
        </div>
      </Container>
    </>
  );
}
