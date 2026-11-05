import Link from "next/link";
import { Check, MoveUpRight, Play } from "lucide-react";
import { Container } from "@/components/ui/container";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { AureliaSignature } from "@/components/home/aurelia-signature";

export function Hero() {
  /* O padding de topo soma `--faixa-h`: o cabeçalho é `fixed` e leva a faixa
     de oferta dentro dele (ver `layout/faixa-teste.tsx`). */
  return (
    <section className="hero-modern relative isolate overflow-hidden bg-ink pb-10 pt-[calc(7rem+var(--faixa-h))] md:pb-14 md:pt-[calc(9rem+var(--faixa-h))]">
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
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <WhatsAppButton />
              <Link
                href="/products/one-space#tutorial"
                className="group inline-flex min-h-[52px] items-center gap-3 rounded-(--radius-button) border border-flame/40 bg-flame/[0.09] px-5 py-3 text-sm font-semibold text-chalk shadow-[inset_0_1px_0_rgba(255,196,138,0.18)] transition-all duration-200 hover:border-flame hover:bg-flame/[0.16] hover:text-white"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-flame text-white shadow-[0_0_16px_rgba(255,106,26,0.6)] transition-transform duration-200 group-hover:scale-105">
                  <Play size={13} className="ml-0.5 fill-current" aria-hidden />
                </span>
                <span>
                  Ver vídeo de como funciona{" "}
                  <span className="font-normal text-ember">(1m46s)</span>
                </span>
              </Link>
            </div>
            <p className="mt-3 max-w-md text-xs leading-relaxed text-chalk-dim">
              {/* Era "Cadastro gratuito no Orkiestri". Com o preço publicado
                  em /planos, o hero precisa dizer o que acontece depois do
                  teste — descobrir a cobrança só no sétimo dia é o jeito mais
                  rápido de perder a confiança na hora de pagar. */}
              Sete dias de teste, sem cartão. Depois, R$ 11,90 por mês. A
              Aurélia guia você pelo WhatsApp, uma pergunta por vez.
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
