import {
  ArrowUpRight,
  BellRing,
  CalendarDays,
  MessageSquareText,
} from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Screenshot } from "@/components/ui/screenshot";
import { products } from "@/config/products";

export function AgendaSpotlight() {
  const agenda = products.find((product) => product.slug === "one-space");
  return (
    <section className="agenda-editorial py-16 md:py-24" id="sua-agenda">
      <Container>
        <div className="grid gap-7 md:grid-cols-[1.1fr_.9fr] md:items-end">
          <div>
            <p className="section-kicker">
              Uma conversa por fora. Tudo organizado por dentro.
            </p>
            <h2 className="mt-4 max-w-2xl font-display text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-[1.08] tracking-[-.035em]">
              Sua semana ganha
              <br />
              um lugar para acontecer.
            </h2>
          </div>
          <p className="max-w-md leading-relaxed">
            O WhatsApp é o caminho rápido. A agenda no site é a visão completa:
            compromissos, horários e o que vem pela frente.
          </p>
        </div>
        <div className="agenda-frame mt-10">
          {agenda?.screenshot && (
            <Screenshot
              {...agenda.screenshot}
              reflection={false}
              zoomOnHover={false}
            />
          )}
        </div>
        <p className="mt-4 text-xs">Tela real do sistema em modo escuro, com dados fictícios de demonstração.</p>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {[
            {
              icon: MessageSquareText,
              title: "Você escreve",
              text: "Registre um compromisso pelo WhatsApp.",
            },
            {
              icon: CalendarDays,
              title: "Você acompanha",
              text: "Veja os eventos organizados na agenda.",
            },
            {
              icon: BellRing,
              title: "A Aurélia lembra",
              text: "Receba avisos antes do horário marcado.",
            },
          ].map((item) => (
            <div key={item.title} className="editorial-benefit">
              <item.icon size={20} aria-hidden />
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </div>
          ))}
        </div>
        <Link
          href="/products/one-space"
          className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline underline-offset-4"
        >
          Explore a agenda <ArrowUpRight size={16} aria-hidden />
        </Link>
      </Container>
    </section>
  );
}
