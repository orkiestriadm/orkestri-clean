"use client";

import { useEffect, useRef } from "react";

/**
 * Holofote que segue o ponteiro.
 *
 * Uma luz fraca acompanha o cursor pelo topo da página. Não informa nada —
 * serve para o escuro reagir ao visitante em vez de ser um fundo parado, e
 * é discreto o bastante para ninguém reparar conscientemente.
 *
 * Três cuidados que fazem a diferença entre efeito e peso morto:
 *
 *   1. **Só com apontador fino.** Em celular não há cursor, e um listener de
 *      movimento ali seria bateria gasta por nada.
 *   2. **Sem `setState`.** As coordenadas vão direto para variáveis CSS no
 *      próprio nó; um state por pixel de mouse re-renderizaria a árvore do
 *      hero dezenas de vezes por segundo.
 *   3. **Uma leitura por quadro.** O handler só agenda um
 *      `requestAnimationFrame`; sem isso, um mouse rápido dispara centenas
 *      de escritas de estilo entre dois quadros, que o navegador descarta.
 */
export function Holofote({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let quadro = 0;
    let x = 0;
    let y = 0;

    const pintar = () => {
      quadro = 0;
      const caixa = el.getBoundingClientRect();
      el.style.setProperty("--holofote-x", `${x - caixa.left}px`);
      el.style.setProperty("--holofote-y", `${y - caixa.top}px`);
    };

    const aoMover = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!quadro) quadro = requestAnimationFrame(pintar);
    };

    window.addEventListener("pointermove", aoMover, { passive: true });
    return () => {
      window.removeEventListener("pointermove", aoMover);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className={`holofote pointer-events-none absolute inset-0 ${className ?? ""}`}
    />
  );
}
