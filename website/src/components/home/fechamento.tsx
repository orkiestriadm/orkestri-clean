import { Container } from "@/components/ui/container";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";

/**
 * Fechamento da página — o segundo e último lugar onde o verde aparece.
 *
 * Um link de contato convive ao lado, em texto: quem não usa WhatsApp
 * precisa de um caminho, mas ele não pode ter a mesma força do botão, senão
 * a página volta a ter duas saídas concorrendo (que era o problema do hero
 * com três botões).
 */
export function Fechamento() {
  return (
    <section className="ink-grain relative isolate overflow-hidden bg-ink py-24 md:py-32">

      <Container className="relative">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h2 className="font-display text-[2rem] font-bold leading-[1.08] tracking-[-0.03em] text-chalk [font-stretch:110%] md:text-[2.75rem]">
            Sua próxima semana pode ser mais leve.
          </h2>
          <p className="mt-5 max-w-[46ch] text-[1.0625rem] leading-[1.65] text-chalk-dim">
            Crie sua conta no Orkiestri pelo WhatsApp. A Aurélia guia o cadastro
            e ajuda você a começar a usar os recursos do sistema.
          </p>

          <WhatsAppButton className="mt-10" />
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-chalk-dim">
            Uma conta no Orkiestri. Os recursos disponíveis seguem o plano e as
            permissões da sua conta.
          </p>

          <p className="mt-6 text-sm text-chalk-faint">
            Prefere conversar antes?{" "}
            <a
              href="/contact"
              className="underline decoration-white/25 underline-offset-4 transition-colors hover:text-chalk hover:decoration-white/60"
            >
              Fale com um especialista
            </a>
            .
          </p>
        </div>
      </Container>
    </section>
  );
}
