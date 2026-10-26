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
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {/* A luz vem de baixo aqui, ao contrário do hero: a página abre com a
            claridade no alto e fecha com ela subindo do rodapé. */}
        <div className="absolute -bottom-56 left-1/2 h-[520px] w-[860px] -translate-x-1/2 rounded-full bg-flame/[0.12] blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_50%_100%,transparent,var(--color-ink)_80%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.09] to-transparent" />
      </div>

      <Container className="relative">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h2 className="font-display text-[2rem] font-bold leading-[1.08] tracking-[-0.03em] text-chalk [font-stretch:110%] md:text-[2.75rem]">
            A sua conta começa com uma mensagem.
          </h2>
          <p className="mt-5 max-w-[46ch] text-[1.0625rem] leading-[1.65] text-chalk-dim">
            Você manda, a Aurélia faz as perguntas do cadastro e devolve a
            empresa criada com os módulos ligados. Sem formulário, sem esperar
            aprovação.
          </p>

          <WhatsAppButton className="mt-10" />

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
