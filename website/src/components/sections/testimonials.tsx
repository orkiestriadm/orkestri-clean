import { Section, SectionHeader } from "@/components/ui/section";
import { Reveal } from "@/components/animations/reveal";

/**
 * Testimonials — real cases to be added (doc 05).
 * Placeholder content clearly generic until client quotes are provided.
 */
const testimonials = [
  {
    quote:
      "Centralizamos operações que viviam em planilhas e e-mails. A visão unificada mudou a forma como tomamos decisões.",
    author: "Diretor de Operações",
    company: "Setor de Logística",
  },
  {
    quote:
      "A integração entre os módulos eliminou retrabalho e nos deu indicadores em tempo real que não tínhamos antes.",
    author: "Gerente de TI",
    company: "Concessionária",
  },
  {
    quote:
      "Da Software Factory ao Orkiestri One, tivemos um parceiro de tecnologia que evoluiu junto com a nossa operação.",
    author: "CEO",
    company: "Indústria",
  },
];

export function Testimonials() {
  return (
    <Section>
      <SectionHeader
        eyebrow="Cases"
        title="Resultados construídos através da tecnologia."
        description="Cada projeto representa uma oportunidade de transformar operações, reduzir custos e aumentar produtividade."
      />
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {testimonials.map((t, i) => (
          <Reveal key={i} delay={(i % 3) * 0.05}>
            <figure className="flex h-full flex-col rounded-[--radius-card] border border-gray-200 bg-white p-8">
              <blockquote className="flex-1 text-lg leading-relaxed text-dark">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-6 border-t border-gray-100 pt-4">
                <span className="block font-semibold text-dark">
                  {t.author}
                </span>
                <span className="text-sm text-gray-500">{t.company}</span>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
