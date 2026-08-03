import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Zap,
  BrainCircuit,
  Plug,
  ShieldCheck,
  BarChart3,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { Reveal } from "@/components/animations/reveal";
import { products } from "@/config/products";

/**
 * Orkiestri One — Business Operating System highlight (doc 05).
 * Bento layout: one lead cell + supporting capability cells.
 */
export function Platform() {
  return (
    <section className="relative overflow-hidden bg-dark py-20 text-white md:py-28">
      {/* Warm glow — subtle depth on the dark surface (doc 06: gradientes suaves). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute -top-32 left-1/4 h-[420px] w-[620px] rounded-full bg-primary/[0.14] blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[320px] w-[420px] rounded-full bg-[#fb923c]/[0.08] blur-[100px]" />
      </div>

      <Container className="relative">
        <Reveal className="max-w-3xl">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">
            Orkiestri One
          </span>
          <h2 className="mt-4 text-[2rem] font-bold tracking-[-0.03em] md:text-[3rem] text-white">
            O sistema operacional da sua empresa.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-gray-300">
            Uma plataforma empresarial modular que reúne gestão, automação,
            inteligência artificial e integrações em uma única experiência. Em
            vez de dezenas de sistemas desconectados, sua empresa opera em um
            ambiente único, consistente e preparado para crescer.
          </p>
        </Reveal>

        {/* Bento grid */}
        <div className="mt-14 grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {/* Lead cell — the platform itself */}
          <Reveal className="md:col-span-2 lg:col-span-2 lg:row-span-2">
            <div className="flex h-full flex-col justify-between rounded-(--radius-card) border border-primary/20 bg-gradient-to-br from-primary/[0.07] to-primary/[0.02] p-8">
              <div>
                <IconTile icon={Boxes} size="lg" tone="on-dark" />
                <h3 className="mt-6 text-2xl font-semibold text-white">
                  Uma base. Todas as aplicações.
                </h3>
                <p className="mt-3 leading-relaxed text-gray-400">
                  {products.length} aplicações compartilham o mesmo login,
                  permissões, dados e experiência. Ative apenas o que a sua
                  operação precisa — a plataforma cresce junto.
                </p>
              </div>
              <div className="mt-8 flex flex-wrap gap-2">
                {products.slice(0, 6).map((p) => (
                  <span
                    key={p.slug}
                    className="rounded-full border border-primary/20 bg-primary/[0.04] px-3 py-1.5 text-xs font-medium text-gray-300"
                  >
                    {p.name}
                  </span>
                ))}
                <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                  +{products.length - 6}
                </span>
              </div>
            </div>
          </Reveal>

          <BentoCell
            icon={BrainCircuit}
            title="IA nativa"
            text="Copilotos, OCR e busca semântica presentes durante o uso — não como módulo separado."
            delay={0.05}
          />
          <BentoCell
            icon={Zap}
            title="Automação"
            text="Fluxos, aprovações e eventos que eliminam o trabalho repetitivo."
            delay={0.1}
          />
          <BentoCell
            icon={Plug}
            title="API First"
            text="REST, webhooks e integrações com Microsoft 365, SAP, TOTVS e mais."
            delay={0.15}
          />
          <BentoCell
            icon={BarChart3}
            title="Analytics"
            text="Todos os módulos alimentam uma camada única de indicadores."
            delay={0.2}
          />

          {/* Wide cell — security */}
          <Reveal delay={0.25} className="md:col-span-3 lg:col-span-4">
            <div className="flex flex-col items-start justify-between gap-6 rounded-(--radius-card) border border-primary/20 bg-primary/[0.03] p-8 md:flex-row md:items-center">
              <div className="flex items-start gap-5">
                <IconTile icon={ShieldCheck} size="lg" tone="on-dark" />
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    Segurança de nível corporativo
                  </h3>
                  <p className="mt-2 max-w-xl text-gray-400">
                    Autenticação multifator, criptografia, permissões granulares,
                    logs de auditoria e conformidade com a LGPD.
                  </p>
                </div>
              </div>
              <Button asChild size="lg" className="shrink-0">
                <Link href="/products/orkiestri-one">
                  Conhecer a Plataforma
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

function BentoCell({
  icon,
  title,
  text,
  delay,
}: {
  icon: React.ComponentProps<typeof IconTile>["icon"];
  title: string;
  text: string;
  delay: number;
}) {
  return (
    <Reveal delay={delay}>
      <div className="h-full rounded-(--radius-card) border border-primary/20 bg-primary/[0.03] p-6 transition-colors duration-200 hover:border-primary/40 hover:bg-primary/[0.08]">
        <IconTile icon={icon} tone="on-dark" />
        <h3 className="mt-5 text-lg font-semibold text-white">{title}</h3>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-gray-400">
          {text}
        </p>
      </div>
    </Reveal>
  );
}
