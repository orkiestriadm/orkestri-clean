"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Check, CheckCheck } from "lucide-react";
import { DEMO, type DemoPasso } from "@/config/aurelia";
import { Celular } from "@/components/ui/celular";
import { ChatHeader, ChatComposer } from "@/components/ui/whatsapp";
import { cn } from "@/lib/utils";

type Linha = { de: "voce" | "aurelia"; texto: string[]; id: string };

const ESPERA_MS = 900;

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
    const thread = fim.current?.parentElement;
    thread?.scrollTo({ top: thread.scrollHeight, behavior: reduzir ? "auto" : "smooth" });
  }, [linhas, digitando, reduzir]);

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-16">
      {/* ── Os pedidos ─────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-base font-semibold text-chalk">
          Toque num pedido.
        </h3>
        <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-chalk-dim">
          São pedidos que a Aurélia entende de verdade. A resposta ao lado é
          uma amostra do formato — aqui nada é enviado nem salvo.
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
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

      {/* ── A conversa, dentro do celular (mesmo padrão claro do Hero) ── */}
      <Celular largura={320}>
        <div className="wa-screen wa-light">
          <ChatHeader />
          <div className="wa-thread">
            <span className="wa-date">Hoje</span>
            {linhas.map((l) => (
              <div
                key={l.id}
                className={cn(
                  "wa-bubble wa-enter",
                  l.de === "voce"
                    ? "wa-sent"
                    : "wa-received",
                )}
              >
                {l.texto.map((t, i) => (
                  <p key={i} className={i > 0 ? "mt-1" : undefined}>
                    {negrito(t)}
                  </p>
                ))}
                <small>
                  09:41{" "}
                  {l.de === "voce" ? (
                    <CheckCheck size={13} aria-hidden />
                  ) : (
                    <Check size={13} aria-hidden />
                  )}
                </small>
              </div>
            ))}

            {digitando && (
              <div
                className="wa-bubble wa-received"
                aria-live="polite"
              >
                <span className="sr-only">A Aurélia está respondendo</span>
                <span className="flex gap-1 py-1" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-current opacity-50 motion-safe:animate-pulse"
                      style={{ animationDelay: `${i * 140}ms` }}
                    />
                  ))}
                </span>
              </div>
            )}
            <div ref={fim} />
          </div>

          <ChatComposer />
        </div>
      </Celular>
    </div>
  );
}

function negrito(texto: string) {
  return texto.split(/(\*[^*]+\*)/g).map((parte, i) =>
    parte.startsWith("*") && parte.endsWith("*") && parte.length > 2 ? (
      <strong key={i} className="font-semibold text-current">
        {parte.slice(1, -1)}
      </strong>
    ) : (
      <span key={i}>{parte}</span>
    ),
  );
}
