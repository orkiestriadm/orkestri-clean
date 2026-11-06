"use client";

import { useState } from "react";
import { Mic } from "lucide-react";
import { Faixa, Cabecalho } from "./ui";
import Image from "next/image";
import { negrito } from "@/components/aurelia/markup";
import { DIA } from "@/config/aurelia";
import { cn } from "@/lib/utils";

const FOTOS_DIA: Record<string, { src: string; alt: string }> = {
  manha: {
    src: "/media/rotina-aurelia.webp",
    alt: "Empreendedora conferindo o resumo da manhã no celular em um café",
  },
  audio: {
    src: "/media/rotina-audio.jpg",
    alt: "Profissional enviando um áudio rápido no caminho para uma reunião",
  },
  gasto: {
    src: "/media/rotina-gasto.jpg",
    alt: "Profissional registrando o almoço pelo celular na mesa do restaurante",
  },
  lembrete: {
    src: "/media/rotina-lembrete.jpg",
    alt: "Profissional recebendo o aviso de compromisso no consultório",
  },
  chamado: {
    src: "/media/rotina-chamado.jpg",
    alt: "Gestor abrindo um chamado para a equipe pelo celular no escritório",
  },
  noite: {
    src: "/media/rotina-noite.jpg",
    alt: "Pessoa registrando uma anotação à noite em casa pelo celular",
  },
};

export function DiaNormal() {
  const [ativo, setAtivo] = useState(DIA[0].id);
  const momento = DIA.find((m) => m.id === ativo) ?? DIA[0];
  const foto = FOTOS_DIA[momento.id] ?? FOTOS_DIA.manha;

  return (
    <Faixa id="um-dia" tom="ink">
      <Cabecalho
        titulo="Um dia normal. Só que nada ficou com você."
        texto="Seis momentos de um dia comum e o que acontece em cada um deles pela conversa. Três você provoca; três chegam sem você pedir."
      />

      <div className="mt-12 grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        {/* ── Os momentos ───────────────────────────────────────────────── */}
        <ol className="divide-y divide-white/10">
          {DIA.map((m) => {
            const selecionado = m.id === momento.id;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setAtivo(m.id)}
                  aria-pressed={selecionado}
                  aria-controls="dia-conversa"
                  className={cn(
                    "group grid w-full cursor-pointer grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-4 border-l-2 py-5 pl-5 pr-2 text-left transition-colors duration-200",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flame",
                    selecionado
                      ? "border-flame"
                      : "border-white/[0.09] hover:border-white/25",
                  )}
                >
                  <span
                    className={cn(
                      "pt-0.5 font-mono text-sm tabular-nums transition-colors",
                      selecionado ? "text-flame-soft" : "text-chalk-faint",
                    )}
                  >
                    {m.hora}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block text-[1.0625rem] font-semibold leading-snug transition-colors",
                        selecionado ? "text-chalk" : "text-chalk-dim group-hover:text-chalk",
                      )}
                    >
                      {m.titulo}
                    </span>
                    {selecionado && (
                      <>
                        <span className="mt-2.5 block text-sm leading-relaxed text-chalk-dim">
                          {m.texto}
                        </span>
                        <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="section-kicker">{m.modulo}</span>
                          {m.inicio === "aurelia" && (
                            <span className="rounded-full border border-flame/40 bg-flame/10 px-2.5 py-0.5 text-[0.6875rem] font-medium text-ember">
                              ela avisa sozinha
                            </span>
                          )}
                        </span>
                      </>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* ── A conversa e a pessoa daquele momento ─────────────────────── */}
        <div className="w-full">
          <div className="day-scene">
            <Image
              key={foto.src}
              src={foto.src}
              alt={foto.alt}
              fill
              unoptimized
              sizes="(min-width: 1024px) 48vw, 95vw"
              className="object-cover transition-opacity duration-300"
            />
            <div
              key={momento.id}
              id="dia-conversa"
              aria-live="polite"
              className="day-messages"
            >
              {momento.conversa.map((l, i) => (
                <div
                  key={momento.id + i}
                  className={cn(
                    "wa-bubble wa-enter",
                    l.de === "voce"
                      ? "wa-sent"
                      : "wa-received",
                  )}
                >
                  {l.audio && (
                    <span className="mb-1.5 flex items-center gap-2 text-xs opacity-75">
                      <Mic size={13} aria-hidden />
                      Áudio · 0:06
                    </span>
                  )}
                  {l.texto.map((t, j) => (
                    <p key={j} className={j > 0 ? "mt-1" : undefined}>
                      {negrito(t)}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Faixa>
  );
}
