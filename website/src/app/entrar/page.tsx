"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/layout/logo";

const DESTINO = "/login";
/** Teto de espera. Se o vídeo travar ou demorar, ninguém fica preso aqui. */
const ESPERA_MAXIMA_MS = 9000;
/** Se o vídeo não começar a tocar até aqui, seguimos direto. */
const PACIENCIA_INICIAL_MS = 2000;

/**
 * Abertura antes da tela de login.
 *
 * O vídeo é uma passagem, não um pedágio: em qualquer imprevisto — erro,
 * demora para carregar, `prefers-reduced-motion` — o usuário vai direto para
 * o login. O botão de pular fica visível o tempo todo, e o /login é
 * pré-carregado enquanto a animação roda, para a troca ser imediata.
 */
export default function EntrarPage() {
  const video = useRef<HTMLVideoElement>(null);
  const jaSeguiu = useRef(false);
  const [comecou, setComecou] = useState(false);

  const seguir = useCallback(() => {
    if (jaSeguiu.current) return;
    jaSeguiu.current = true;
    window.location.assign(DESTINO);
  }, []);

  useEffect(() => {
    // Quem pediu menos animação não deve esperar por uma.
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduzir) {
      seguir();
      return;
    }

    const el = video.current;
    el?.play().catch(() => seguir()); // autoplay barrado: não faz sentido segurar

    // Duas redes de segurança: uma para o vídeo que nunca começa,
    // outra para o que começa e não termina.
    const semInicio = window.setTimeout(() => {
      if (!jaSeguiu.current && (video.current?.currentTime ?? 0) === 0) seguir();
    }, PACIENCIA_INICIAL_MS);
    const tetoGeral = window.setTimeout(seguir, ESPERA_MAXIMA_MS);

    return () => {
      window.clearTimeout(semInicio);
      window.clearTimeout(tetoGeral);
    };
  }, [seguir]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#08090c] text-white">
      {/* Aquece o destino enquanto a animação roda */}
      <link rel="prefetch" href={DESTINO} as="document" />

      {/* Vídeo */}
      <video
        ref={video}
        src="/media/globe-intro.mp4"
        muted
        playsInline
        preload="auto"
        aria-hidden
        onPlaying={() => setComecou(true)}
        onEnded={seguir}
        onError={seguir}
        className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-700 data-[visivel=true]:opacity-100"
        data-visivel={comecou}
      />

      {/* Véu: mantém o texto legível sobre qualquer quadro do vídeo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_35%,rgba(8,9,12,0.75)_100%)]"
      />

      {/* Topo — marca e pular */}
      <div className="relative flex items-center justify-between p-6 md:p-8">
        <Logo tone="light" />
        <button
          type="button"
          onClick={seguir}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f97316]"
        >
          Pular
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* Base — mensagem de contexto */}
      <div className="relative mt-auto p-8 text-center md:p-12">
        <p
          className={`text-sm text-white/50 transition-opacity duration-500 ${
            comecou ? "opacity-100" : "opacity-0"
          }`}
        >
          Preparando seu acesso…
        </p>
      </div>

      {/* Rota acessível sem JavaScript */}
      <noscript>
        <a href={DESTINO} className="absolute inset-0 z-10" aria-label="Ir para o login" />
      </noscript>
    </div>
  );
}
