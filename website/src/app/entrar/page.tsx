"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/layout/logo";

const DESTINO = "/login";
/** Marca que a abertura já rolou nesta aba — quem entra todo dia não repete. */
const CHAVE_SESSAO = "orkiestri:intro-vista";
/** Espera máxima por buffer. Passou disso, o login vale mais que a animação. */
const PACIENCIA_BUFFER_MS = 2500;
/** Folga sobre a duração do vídeo, caso o evento "ended" não dispare. */
const FOLGA_APOS_FIM_MS = 1500;

/**
 * Abertura em vídeo antes da tela de login.
 *
 * A animação é passagem, não pedágio: erro, autoplay barrado, buffer lento ou
 * `prefers-reduced-motion` levam direto ao login, e o botão de pular fica
 * sempre à mão. O /login é pré-carregado enquanto o vídeo roda.
 *
 * Só toca quando há buffer suficiente (`canplaythrough`) — começar antes disso
 * fazia a animação engasgar. E aparece uma vez por sessão: encanta na primeira
 * visita sem virar pedágio para quem usa o sistema todo dia.
 */
export default function EntrarPage() {
  const video = useRef<HTMLVideoElement>(null);
  const jaSeguiu = useRef(false);
  const temporizadores = useRef<number[]>([]);
  const comecou = useRef(false);
  const [tocando, setTocando] = useState(false);

  const seguir = useCallback(() => {
    if (jaSeguiu.current) return;
    jaSeguiu.current = true;
    temporizadores.current.forEach(window.clearTimeout);
    window.location.assign(DESTINO);
  }, []);

  useEffect(() => {
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let jaViu = false;
    try {
      jaViu = sessionStorage.getItem(CHAVE_SESSAO) === "1";
      sessionStorage.setItem(CHAVE_SESSAO, "1");
    } catch {
      /* modo privado/armazenamento bloqueado: apenas exibe a abertura */
    }

    if (reduzir || jaViu) {
      seguir();
      return;
    }

    const el = video.current;
    if (!el) return;

    // Só toca com buffer suficiente para ir até o fim sem engasgar.
    const tocarQuandoPronto = () => {
      el.play().catch(seguir); // autoplay barrado: não faz sentido segurar
    };
    if (el.readyState >= 4) tocarQuandoPronto();
    else el.addEventListener("canplaythrough", tocarQuandoPronto, { once: true });

    // Rede 1: buffer demorou demais.
    temporizadores.current.push(
      window.setTimeout(() => {
        if (!comecou.current) seguir();
      }, PACIENCIA_BUFFER_MS)
    );

    // Rede 2: teto pela duração real, medida quando os metadados chegam.
    const agendarTeto = () => {
      const ms = (el.duration || 10) * 1000 + FOLGA_APOS_FIM_MS;
      temporizadores.current.push(window.setTimeout(seguir, ms));
    };
    if (el.readyState >= 1) agendarTeto();
    else el.addEventListener("loadedmetadata", agendarTeto, { once: true });

    const limpar = temporizadores.current;
    return () => {
      limpar.forEach(window.clearTimeout);
      el.removeEventListener("canplaythrough", tocarQuandoPronto);
      el.removeEventListener("loadedmetadata", agendarTeto);
    };
  }, [seguir]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#08090c] text-white">
      {/* Aquece o destino enquanto a animação roda */}
      <link rel="prefetch" href={DESTINO} as="document" />

      <video
        ref={video}
        src="/media/globe-intro.mp4"
        muted
        playsInline
        preload="auto"
        aria-hidden
        onPlaying={() => {
          comecou.current = true;
          setTocando(true);
        }}
        onEnded={seguir}
        onError={seguir}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
          tocando ? "opacity-100" : "opacity-0"
        }`}
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

      <div className="relative mt-auto p-8 text-center md:p-12">
        <p className="text-sm text-white/50">Preparando seu acesso…</p>
      </div>

      {/* Rota acessível sem JavaScript */}
      <noscript>
        <a href={DESTINO} className="absolute inset-0 z-10" aria-label="Ir para o login" />
      </noscript>
    </div>
  );
}
