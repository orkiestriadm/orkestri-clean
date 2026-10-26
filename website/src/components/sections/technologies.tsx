import { Section, SectionHeader } from "@/components/ui/section";
import { technologies } from "@/config/content";

/** Technologies — modern stack (doc 04 / 05). */
export function Technologies() {
  return (
    <Section muted>
      <SectionHeader
        eyebrow="Tecnologia"
        title="Construído com tecnologias modernas."
        description="Utilizamos arquiteturas escaláveis e tecnologias amplamente adotadas pelo mercado para garantir performance, segurança e evolução contínua."
      />
      <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
        {technologies.map((t) => (
          <span
            key={t}
            className="rounded-full border border-white/[0.08] bg-panel px-5 py-2.5 text-sm font-medium text-chalk-dim"
          >
            {t}
          </span>
        ))}
      </div>
    </Section>
  );
}
