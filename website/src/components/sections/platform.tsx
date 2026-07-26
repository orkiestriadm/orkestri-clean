import Link from "next/link";
import { ArrowRight, Boxes, Zap, BrainCircuit, Plug } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/animations/reveal";

const pillars = [
  { icon: Boxes, label: "Modular", text: "Aplicações independentes, uma base." },
  { icon: Zap, label: "Automação", text: "Fluxos e aprovações sem esforço." },
  { icon: BrainCircuit, label: "IA nativa", text: "Inteligência em toda a plataforma." },
  { icon: Plug, label: "Integração", text: "API First, aberta e conectável." },
];

/** Orkiestri One — Business Operating System highlight (doc 05). */
export function Platform() {
  return (
    <section className="bg-dark py-20 text-white md:py-28">
      <Container>
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">
              Orkiestri One
            </span>
            <h2 className="mt-4 text-[2rem] font-bold md:text-[2.75rem]">
              O sistema operacional da sua empresa.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-gray-300">
              Uma plataforma empresarial modular que reúne gestão, automação,
              inteligência artificial e integrações em uma única experiência. Em
              vez de dezenas de sistemas desconectados, sua empresa opera em um
              ambiente único, consistente e preparado para crescer.
            </p>
            <div className="mt-8">
              <Button asChild size="lg">
                <Link href="/products/orkiestri-one">
                  Conhecer a Plataforma
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </Link>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="grid grid-cols-2 gap-4">
              {pillars.map((p) => {
                const Icon = p.icon;
                return (
                  <div
                    key={p.label}
                    className="rounded-[--radius-card] border border-white/10 bg-white/[0.03] p-6"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="mt-4 text-lg font-semibold text-white">
                      {p.label}
                    </h3>
                    <p className="mt-1 text-sm text-gray-400">{p.text}</p>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
