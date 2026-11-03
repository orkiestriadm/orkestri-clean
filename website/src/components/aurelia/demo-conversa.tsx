"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Check, CheckCheck } from "lucide-react";
import { DEMO, type DemoPasso } from "@/config/aurelia";
import { cn } from "@/lib/utils";

/**
 * Demonstração clicável da conversa.
 *
 * O site mostrava prints estáticos com "clique para ampliar": a pessoa via o
 * produto, mas não experimentava nada antes de entregar CPF e e-mail. Aqui ela
 * toca num pedido e vê a resposta acontecer.
 *
 * 🔴 **Nada é enviado.** O roteiro vive em `config/aurelia.ts` e a página diz
 * isso em voz alta, duas vezes. O que é verdade é o comportamento: todo pedido
 * daqui é um que a Aurélia entende de fato, e a resposta tem o formato que ela
 * devolve.
 *
 * Três cuidados de implementação:
 *
 *   1. **Começa cheio.** A conversa já abre com um pedido respondido. Um
 *      mockup vazio esperando clique não mostra nada a quem só passa os olhos
 *      — e é o primeiro quadro que vai parar na miniatura.
 *   2. **O timer é cancelado no desmonte e a cada novo clique**, senão duas
 *      respostas disputam a mesma lista e a conversa sai fora de ordem.
 *   3. **`prefers-reduced-motion` zera a espera.** Quem pediu menos movimento
 *      recebe a resposta na hora, sem o "digitando".
 */

type Linha = { de: "voce" | "aurelia"; texto: string[]; id: string };

const ESPERA_MS = 900;

/** A conversa já nasce com este pedido respondido. Ver o cuidado 1 acima. */
const INICIAL: DemoPasso = DEMO[0];

export function DemoConversa() {
  const reduzir = useReducedMotion();
  const [linhas, setLinhas] = useState<Linha[]>([
    { de: "voce", texto: [INICIAL.pedido], id: INICIAL.id + "-p" },
    { de: "aurelia", texto: INICIAL.resposta, id: INICIAL.id + "-r" },
  ]);
  const [digitando, setDigitando] = useState(false);
  const [ativo, setAtivo] = useState(INICIAL.id);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fim = useRef<HTMLDivElement | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const pedir = useCallback(
    (passo: DemoPasso) => {
      if (timer.current) clearTimeout(timer.current);
      setAtivo(passo.id);
      setLinhas((atual) => {
        /* A conversa não cresce para sempre: além de quatro trocas a coluna
           vira uma barra de rolagem interminável dentro da página. */
        const recente = atual.slice(-6);
        return [
          ...recente,
          { de: "voce", texto: [passo.pedido], id: passo.id + "-p-" + Date.now() },
        ];
      });
      setDigitando(true);
      timer.current = setTimeout(
        () => {
          setDigitando(false);
          setLinhas((atual) => [
            ...atual,
            {
              de: "aurelia",
              texto: passo.resposta,
              id: passo.id + "-r-" + Date.now(),
            },
          ]);
        },
        reduzir ? 0 : ESPERA_MS,
      );
    },
    [reduzir],
  );

  useEffect(() => {
    fim.current?.scrollIntoView({
      block: "nearest",
      behavior: reduzir ? "auto" : "smooth",
    });
  }, [linhas, digitando, reduzir]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-14">
      {/* ── Os pedidos ─────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-base font-semibold text-chalk">
          Toque num pedido.
        </h3>
        <p className="mt-2 max-w-[44ch] text-sm leading-relaxed text-chalk-dim">
          São pedidos que a Aurélia entende de verdade. A resposta ao lado é
          uma amostra do formato — aqui nada é enviado nem salvo.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {DEMO.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => pedir(d)}
              aria-pressed={ativo === d.id}
              className={cn(
                "cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-200",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flame",
                ativo === d.id
                  ? "border-flame/60 bg-flame/15 text-ember"
                  : "border-white/[0.12] bg-panel/50 text-chalk-dim hover:border-white/25 hover:text-chalk",
              )}
            >
              {d.chip}
            </button>
          ))}
        </div>
      </div>

      {/* ── A conversa ─────────────────────────────────────────────────── */}
      <div className="hairline overflow-hidden rounded-(--radius-image) border bg-ink">
        <div className="hairline flex items-center gap-3 border-b bg-panel px-5 py-3.5">
          <span
            className="grid h-9 w-9 place-items-center rounded-full bg-flame/20 text-sm font-semibold text-ember"
            aria-hidden
          >
            A
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-chalk">Aurélia</p>
            <p className="text-xs text-chalk-faint">Orkiestri · demonstração</p>
          </div>
        </div>

        <div className="flex max-h-[26rem] min-h-[20rem] flex-col gap-2.5 overflow-y-auto p-5">
          {linhas.map((l) => (
            <div
              key={l.id}
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                l.de === "voce"
                  ? "self-end bg-signal/15 text-chalk"
                  : "hairline self-start border bg-panel text-chalk",
              )}
            >
              {l.texto.map((t, i) => (
                <p key={i} className={i > 0 ? "mt-1" : undefined}>
                  {negrito(t)}
                </p>
              ))}
              <span className="mt-1 flex justify-end text-chalk-faint">
                {l.de === "voce" ? (
                  <CheckCheck size={14} aria-hidden />
                ) : (
                  <Check size={14} aria-hidden />
                )}
              </span>
            </div>
          ))}

          {digitando && (
            <div
              className="hairline self-start rounded-2xl border bg-panel px-4 py-3"
              aria-live="polite"
            >
              <span className="sr-only">A Aurélia está respondendo</span>
              <span className="flex gap-1" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-chalk-faint motion-safe:animate-pulse"
                    style={{ animationDelay: `${i * 140}ms` }}
                  />
                ))}
              </span>
            </div>
          )}
          <div ref={fim} />
        </div>

        <p className="hairline border-t px-5 py-3 text-xs leading-relaxed text-chalk-faint">
          Demonstração. Nenhuma mensagem é enviada e nenhum dado é salvo.
        </p>
      </div>
    </div>
  );
}

/**
 * O `*negrito*` do WhatsApp, resolvido sem biblioteca.
 *
 * O roteiro é escrito na mesma marcação que a Aurélia usa de verdade, então
 * a amostra sai com a mesma cara da conversa real.
 */
function negrito(texto: string) {
  return texto.split(/(\*[^*]+\*)/g).map((parte, i) =>
    parte.startsWith("*") && parte.endsWith("*") && parte.length > 2 ? (
      <strong key={i} className="font-semibold text-chalk">
        {parte.slice(1, -1)}
      </strong>
    ) : (
      <span key={i}>{parte}</span>
    ),
  );
}
