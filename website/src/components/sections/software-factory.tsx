import Link from "next/link";
import { Section, SectionHeader } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/animations/reveal";
import { softwareFactoryProcess } from "@/config/content";

/** Software Factory — process timeline (doc 04 / 05). */
export function SoftwareFactory() {
  return (
    <Section muted>
      <SectionHeader
        eyebrow="Software Factory"
        title="Software desenvolvido para o seu negócio."
        description="Cada empresa possui desafios únicos. Desenvolvemos aplicações personalizadas que se integram perfeitamente ao seu ambiente tecnológico."
      />

      <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {softwareFactoryProcess.map((step, i) => (
          <Reveal key={step.title} delay={(i % 4) * 0.05} as="li">
            <div className="h-full rounded-[--radius-card] border border-gray-200 bg-white p-6">
              <span className="text-sm font-bold text-primary">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 text-lg font-semibold text-dark">
                {step.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
                {step.description}
              </p>
            </div>
          </Reveal>
        ))}
      </ol>

      <div className="mt-12 flex justify-center">
        <Button asChild size="lg">
          <Link href="/demo">Solicitar um projeto</Link>
        </Button>
      </div>
    </Section>
  );
}
