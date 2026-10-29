import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { Container } from "@/components/ui/container";
import { VideoBackdrop } from "@/components/ui/video-backdrop";
import { Reveal } from "@/components/animations/reveal";

/** Final CTA — reused across pages (doc 05). */
export function CTA({
  title,
  text,
  intent = "trial",
}: {
  title?: string;
  text?: string;
  intent?: "trial" | "project";
}) {
  return (
    <section className="py-20 md:py-28">
      <Container>
        <Reveal className="relative overflow-hidden rounded-(--radius-image) bg-ink px-8 py-16 text-center md:px-16 md:py-20">
          <VideoBackdrop src="/media/light-streaks.mp4" opacity={0.22} />
          {/* Véu sobre o vídeo: mantém o contraste do texto em AA */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-ink/55"
          />
          <div
            aria-hidden
            className="site-warm-surface pointer-events-none absolute inset-0"
          />
          <div className="relative mx-auto flex max-w-2xl flex-col items-center">
            <h2 className="text-[2rem] font-bold text-white md:text-[2.75rem]">
              {title ??
                (intent === "project"
                  ? "Qual problema seu próximo software precisa resolver?"
                  : "Seu Orkiestri começa com uma conversa.")}
            </h2>
            <p className="mt-4 text-lg text-chalk-dim">
              {text ??
                (intent === "project"
                  ? "Conte o contexto, as pessoas envolvidas e o que você quer melhorar. Vamos conversar sobre o caminho para construir."
                  : "A Aurélia guia seu cadastro no sistema Orkiestri pelo WhatsApp. Os recursos disponíveis seguem o plano e as permissões da conta.")}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {intent === "trial" ? (
                <WhatsAppButton />
              ) : (
                <Button asChild size="lg">
                  <Link href="/contact?interest=project#contato">
                    Conversar sobre meu projeto
                  </Link>
                </Button>
              )}
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
