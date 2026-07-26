import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/animations/reveal";

/** Final CTA — reused across pages (doc 05). */
export function CTA({
  title = "Pronto para transformar sua operação?",
  text = "Vamos conversar sobre como a tecnologia pode simplificar processos e acelerar o crescimento da sua empresa.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <section className="py-20 md:py-28">
      <Container>
        <Reveal className="relative overflow-hidden rounded-[--radius-image] bg-dark px-8 py-16 text-center md:px-16 md:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(249,115,22,0.18),transparent_60%)]"
          />
          <div className="relative mx-auto flex max-w-2xl flex-col items-center">
            <h2 className="text-[2rem] font-bold text-white md:text-[2.75rem]">
              {title}
            </h2>
            <p className="mt-4 text-lg text-gray-300">{text}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/demo">Solicitar demonstração</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-white/30"
              >
                <Link href="/contact">Falar com um especialista</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
