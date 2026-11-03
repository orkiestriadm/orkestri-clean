"use client";

import { useState } from "react";
import { Mic } from "lucide-react";
import { Faixa, Cabecalho } from "./ui";
import { Celular } from "@/components/ui/celular";
import { negrito } from "@/components/aurelia/markup";
import { DIA } from "@/config/aurelia";
import { cn } from "@/lib/utils";

/**
 * Um dia normal.
 *
 * A seção mais forte da página do concorrente não lista funcionalidade: conta
 * um dia e mostra o que acontece em cada hora. Vende rotina — e rotina é o
 * que o Orkiestri faz.
 *
 * Três decisões:
 *
 *   1. **Os horários estão em ordem de relógio**, e não de importância. A
 *      ordem é a informação: a pessoa reconhece o próprio dia na lista antes
 *      de ler qualquer descrição.
 *   2. **Metade dos momentos a Aurélia começa sozinha** — o resumo da manhã e
 *      o lembrete de uma hora. É o que separa este produto de um bloco de
 *      notas, então os dois ganham destaque próprio no rótulo ("ela avisa").
 *   3. **A conversa aparece dentro do celular**, como toda amostra do site
 *      desde 03/11. Sem estado vazio: a seção abre com o primeiro momento já
 *      escolhido, porque é o primeiro quadro que alguém que só passa os olhos
 *      vai ver.
 */
export function DiaNormal() {
  const [ativo, setAtivo] = useState(DIA[0].id);
  const momento = DIA.find((m) => m.id === ativo) ?? DIA[0];

  return (
    <Faixa id="um-dia" tom="ink">
      <Cabecalho
        titulo="Um dia normal. Só que nada ficou com você."
        texto="Seis momentos de um dia comum e o que acontece em cada um deles pela conversa. Três você provoca; três chegam sem você pedir."
      />

      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.78fr)] lg:gap-16">
        {/* ── Os momentos ───────────────────────────────────────────────── */}
        <ol className="flex flex-col">
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
                    {/* O texto longo só aparece no momento escolhido: com os
                        seis abertos a coluna vira um muro e a linha do tempo
                        deixa de ser lida como uma sequência de horas. */}
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

        {/* ── A conversa daquele momento ────────────────────────────────── */}
        <div className="lg:sticky lg:top-32 lg:self-start">
          <Celular largura={340}>
            <div className="hairline flex items-center gap-3 border-b bg-panel px-5 pb-3.5">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-flame/20 text-sm font-semibold text-ember"
                aria-hidden
              >
                A
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-chalk">Aurélia</p>
                <p className="font-mono text-xs text-chalk-faint tabular-nums">
                  {momento.hora}
                </p>
              </div>
            </div>

            <div
              id="dia-conversa"
              aria-live="polite"
              className="flex min-h-[15rem] flex-col gap-2.5 p-5"
            >
              {momento.conversa.map((l, i) => (
                <div
                  key={momento.id + i}
                  className={cn(
                    "max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    l.de === "voce"
                      ? "self-end bg-signal/15 text-chalk"
                      : "hairline self-start border bg-panel text-chalk",
                  )}
                >
                  {l.audio && (
                    <span className="mb-1.5 flex items-center gap-2 text-xs text-chalk-faint">
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
          </Celular>
        </div>
      </div>
    </Faixa>
  );
}
