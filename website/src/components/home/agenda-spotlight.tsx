import {
  ArrowRight,
  BellRing,
  CalendarDays,
  MessageSquareText,
  Play,
} from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Notebook } from "@/components/ui/notebook";
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
        <div className="mt-10">
          {agenda?.screenshot && (
            <Notebook tela={agenda.screenshot} />
          )}
        </div>
        <p className="mt-4 text-xs">
          Tela real do sistema em modo escuro, com dados fictícios de
          demonstração.
        </p>
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

        {/* Chamada de destaque para o vídeo tutorial em /products/one-space#tutorial */}
        <Link
          href="/products/one-space#tutorial"
          className="group mt-10 flex flex-col justify-between gap-5 rounded-2xl border border-flame/35 bg-gradient-to-r from-[#1c130e]/95 via-[#17161d]/95 to-[#121318]/95 p-6 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,196,138,0.16)] transition-all duration-200 hover:border-flame/70 sm:flex-row sm:items-center md:p-7"
        >
          <div className="flex items-start gap-4 sm:items-center">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-flame text-white shadow-[0_0_24px_rgba(255,106,26,0.55)] transition-transform duration-200 group-hover:scale-105">
              <Play size={20} className="ml-0.5 fill-current" aria-hidden />
            </span>
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-flame-soft">
                Vídeo tutorial passo a passo · 1m46s
              </span>
              <h3 className="mt-1 text-lg font-semibold text-chalk">
                Quer ver funcionando na prática? Assista à explicação completa da agenda.
              </h3>
              <p className="mt-1 text-sm text-chalk-dim">
                Veja os 8 passos reais desde a mensagem no WhatsApp até o evento salvo no painel e o lembrete automático.
              </p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-flame px-5 py-2.5 text-sm font-semibold text-white transition-colors group-hover:bg-flame-soft sm:self-center">
            Assistir tutorial
            <ArrowRight
              size={16}
              className="transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </Link>
      </Container>
    </section>
  );
}
