import { Check } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui/section";
import { Reveal } from "@/components/animations/reveal";
import { differentials } from "@/config/content";

/** Diferenciais — "Muito além de um software" (doc 05). */
export function Differentials() {
  return (
    <Section>
      <SectionHeader
        eyebrow="Diferenciais"
        title="Muito além de um software."
        description="Cada detalhe da plataforma foi pensado para representar o nível de engenharia de uma empresa de software moderna."
      />
      <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2">
        {differentials.map((d, i) => (
          <Reveal key={d} delay={(i % 2) * 0.05}>
            <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-hover">
                <Check className="h-4 w-4" aria-hidden />
              </span>
              <span className="font-medium text-dark">{d}</span>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
