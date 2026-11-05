"use client";

import { useRef, useState } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

const PASSOS = [
  { n: "01", titulo: "Comece pelo WhatsApp", tempo: 0, label: "0:00" },
  { n: "02", titulo: "Dê um nome ao compromisso", tempo: 17, label: "0:17" },
  { n: "03", titulo: "Informe o dia e o horário", tempo: 27, label: "0:27" },
  { n: "04", titulo: "Quanto tempo vai durar?", tempo: 36, label: "0:36" },
  { n: "05", titulo: "Confira antes de salvar", tempo: 49, label: "0:49" },
  { n: "06", titulo: "Abra a agenda no aplicativo", tempo: 66, label: "1:06" },
  { n: "07", titulo: "Confira o evento na plataforma", tempo: 76, label: "1:16" },
  { n: "08", titulo: "Receba o aviso no WhatsApp", tempo: 90, label: "1:30" },
];

export function TutorialVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
    } else {
      v.pause();
    }
  };

  const jumpTo = (index: number, seconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = seconds;
    setActiveStep(index);
    v.play();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const restart = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    setActiveStep(0);
    v.play();
  };

  return (
    <section
      id="tutorial"
      className="scroll-mt-28 py-10 md:py-14"
      aria-labelledby="tutorial-heading"
    >
      <div className="premium-surface overflow-hidden rounded-(--radius-image) border border-white/[0.1] bg-panel p-6 shadow-soft-lg md:p-10">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="section-kicker inline-flex items-center gap-2.5">
              <span className="inline-block h-2 w-2 rounded-full bg-flame" aria-hidden />
              Tutorial passo a passo · 1m46s com áudio
            </p>
            <h2
              id="tutorial-heading"
              className="mt-3 font-display text-[1.875rem] font-bold leading-[1.08] tracking-[-0.03em] text-chalk [font-stretch:108%] md:text-[2.5rem]"
            >
              Veja na prática como marcar um compromisso pelo WhatsApp.
            </h2>
          </div>
          <p className="max-w-[46ch] text-[0.98rem] leading-relaxed text-chalk-dim">
            Em 8 passos curtos, acompanhe desde o envio da mensagem no WhatsApp
            até o evento salvo na agenda do site e o lembrete automático antes
            do horário.
          </p>
        </div>

        {/* Player de vídeo */}
        <div className="relative mt-8 overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0c0e12] shadow-[0_28px_70px_-24px_rgba(0,0,0,0.9)]">
          <video
            ref={videoRef}
            src="/media/tutorial-agenda.mp4#t=0.5"
            preload="metadata"
            playsInline
            controls={playing}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onTimeUpdate={(e) => {
              const t = e.currentTarget.currentTime;
              for (let i = PASSOS.length - 1; i >= 0; i--) {
                if (t >= PASSOS[i].tempo) {
                  if (activeStep !== i) setActiveStep(i);
                  break;
                }
              }
            }}
            className="aspect-video w-full cursor-pointer object-cover"
            onClick={() => {
              if (!playing) togglePlay();
            }}
          >
            Seu navegador não suporta a reprodução de vídeo.
          </video>

          {/* Overlay de Play quando pausado no início */}
          {!playing && (
            <button
              type="button"
              onClick={togglePlay}
              aria-label="Reproduzir vídeo tutorial com áudio"
              className="group absolute inset-0 flex cursor-pointer flex-col items-center justify-center bg-black/35 backdrop-blur-[2px] transition-all duration-300 hover:bg-black/20"
            >
              <span className="flex h-20 w-20 items-center justify-center rounded-full border border-flame-soft/50 bg-flame text-white shadow-[0_0_50px_rgba(255,106,26,0.65)] transition-transform duration-300 group-hover:scale-108">
                <Play className="ml-1 h-8 w-8 fill-current" aria-hidden />
              </span>
              <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/[0.15] bg-[#0e1016]/90 px-4 py-2 text-xs font-semibold tracking-wide text-chalk shadow-lg">
                Assistir explicação completa (1m46s)
              </span>
            </button>
          )}
        </div>

        {/* Barra de controle rápido + capítulos clicáveis */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-flame px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-flame-soft"
            >
              {playing ? (
                <>
                  <Pause className="h-3.5 w-3.5" aria-hidden />
                  Pausar vídeo
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
                  Reproduzir tutorial
                </>
              )}
            </button>
            <button
              type="button"
              onClick={restart}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-chalk-dim transition-colors hover:bg-white/[0.08] hover:text-chalk"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Reiniciar
            </button>
            <button
              type="button"
              onClick={toggleMute}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-chalk-dim transition-colors hover:bg-white/[0.08] hover:text-chalk"
            >
              {muted ? (
                <>
                  <VolumeX className="h-3.5 w-3.5 text-flame-soft" aria-hidden />
                  Ativar som
                </>
              ) : (
                <>
                  <Volume2 className="h-3.5 w-3.5 text-flame-soft" aria-hidden />
                  Som ligado
                </>
              )}
            </button>
          </div>
          <span className="text-xs text-chalk-faint">
            Clique em qualquer etapa abaixo para pular direto para o trecho:
          </span>
        </div>

        <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {PASSOS.map((p, idx) => {
            const ativo = activeStep === idx;
            return (
              <button
                key={p.n}
                type="button"
                onClick={() => jumpTo(idx, p.tempo)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-all duration-200",
                  ativo
                    ? "border-flame/60 bg-flame/[0.12] text-chalk shadow-[inset_0_1px_0_rgba(255,138,61,0.25)]"
                    : "border-white/[0.07] bg-ink/60 text-chalk-dim hover:border-white/[0.16] hover:bg-white/[0.04] hover:text-chalk",
                )}
              >
                <div className="min-w-0">
                  <span className="block font-mono text-[0.7rem] font-semibold text-flame-soft">
                    PASSO {p.n}
                  </span>
                  <span className="mt-0.5 block truncate text-xs font-medium">
                    {p.titulo}
                  </span>
                </div>
                <span className="shrink-0 rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-[0.68rem] text-chalk-faint">
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
