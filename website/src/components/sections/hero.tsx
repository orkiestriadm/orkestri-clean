import Link from "next/link";
import { ArrowDown, Check, MoveUpRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { AureliaSignature } from "@/components/home/aurelia-signature";

export function Hero() {
  return (
    <section className="hero-modern relative isolate overflow-hidden bg-ink pb-10 pt-28 md:pb-14 md:pt-36">
      <Container>
        <div className="grid items-center gap-8 md:grid-cols-[1.05fr_.95fr] lg:gap-14">
          <div className="hero-enter relative z-10">
            <p className="section-kicker mb-6 inline-flex items-center gap-3">
              <span className="h-px w-7 bg-flame/70" aria-hidden />
              Sua rotina, no ritmo certo.
            </p>
            <h1 className="max-w-[13ch] font-display text-[clamp(2.75rem,5.5vw,5.1rem)] font-semibold leading-[1.02] tracking-[-.055em] text-chalk">
              <span className="hero-highlight">Aurélia.</span>
              <br />
              Sua rotina
              <br />
              em harmonia.
            </h1>
            <p className="mt-6 max-w-[42ch] text-base leading-[1.75] text-chalk-dim lg:text-lg">
              A assistente virtual do Orkiestri que{" "}
              <strong className="font-medium text-chalk">
                orquestra seus compromissos pelo WhatsApp.
              </strong>{" "}
              Você manda uma mensagem. Ela ajuda a organizar, consultar e
              lembrar.
            </p>
            <div className="mt-7 flex flex-col items-start gap-3">
              <WhatsAppButton />
              <a
                href="#aurelia"
                className="inline-flex min-h-11 items-center gap-3 text-sm font-medium text-chalk-dim transition-colors hover:text-chalk"
              >
                Conheça a Aurélia <ArrowDown size={16} aria-hidden />
              </a>
            </div>
            <p className="mt-2 max-w-md text-xs leading-relaxed text-chalk-dim">
              Cadastro gratuito no Orkiestri. A Aurélia guia você pelo WhatsApp,
              uma pergunta por vez.
            </p>
          </div>
          <div className="hero-enter min-w-0">
            <AureliaSignature />
          </div>
        </div>
        <div className="mt-8 flex flex-col justify-between gap-5 pt-6 md:mt-12 md:flex-row md:items-center">
          <ul className="flex flex-wrap gap-x-6 gap-y-3 text-xs text-chalk-dim">
            {[
              "No WhatsApp que você já usa",
              "Agenda acessível pelo site",
              "Cadastro guiado pela Aurélia",
            ].map((text) => (
              <li key={text} className="flex items-center gap-2">
                <Check size={14} className="text-flame-soft" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
          <Link
            href="/services"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 text-xs text-chalk-faint transition-colors hover:text-chalk"
          >
            Software para sua empresa <MoveUpRight size={13} aria-hidden />
          </Link>
        </div>
      </Container>
    </section>
  );
}
