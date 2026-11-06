"use client";

import { useState } from "react";
import Link from "next/link";
import { MESAS, TOTAL_PEDIDOS } from "@/config/aurelia";
import { cn } from "@/lib/utils";

/**
 * A parede de pedidos.
 *
 * O site publicava oito comandos em formato de código, o que faz parecer que
 * existe uma sintaxe para decorar. Existe o contrário: a Aurélia entende a
 * frase do jeito que ela sai. A parede mostra isso pela quantidade — ler
 * quarenta frases diferentes convence mais do que a afirmação "entende
 * linguagem natural".
 *
 * Os pedidos vêm de `config/aurelia.ts`, onde cada um está amarrado ao parser
 * que o interpreta. Nenhuma frase é inventada para encher a parede.
 *
 * O filtro é estado de tela e não vai para a URL: quem compartilha a página
 * quer mostrar a parede, não o recorte em que estava.
 */
export function ParedePedidos() {
  const [mesa, setMesa] = useState<string>("todas");
  const visiveis = mesa === "todas" ? MESAS : MESAS.filter((m) => m.id === mesa);

  return (
    <div>
      {/* ── Filtros ────────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Filtrar pedidos por assunto"
      >
        <Botao ativo={mesa === "todas"} onClick={() => setMesa("todas")}>
          Tudo
          <span className="ml-2 text-xs text-chalk-faint">{TOTAL_PEDIDOS}</span>
        </Botao>
        {MESAS.map((m) => (
          <Botao
            key={m.id}
            ativo={mesa === m.id}
            onClick={() => setMesa(m.id)}
          >
            {m.titulo}
            <span className="ml-2 text-xs text-chalk-faint">
              {m.pedidos.length}
            </span>
          </Botao>
        ))}
      </div>

      {/* ── As mesas ───────────────────────────────────────────────────── */}
      <div className="mt-12 flex flex-col gap-14">
        {visiveis.map((m) => (
          <section key={m.id} aria-labelledby={`mesa-${m.id}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="flex items-center gap-3">
                <m.icon className="shrink-0 text-flame-soft" size={22} aria-hidden />
                <h3
                  id={`mesa-${m.id}`}
                  className="text-xl font-semibold text-chalk"
                >
                  {m.titulo}
                </h3>
                <span className="section-kicker">{m.modulo}</span>
              </div>
              <Link
                href={m.href}
                className="text-sm font-medium text-flame-soft underline decoration-flame/40 decoration-1 underline-offset-4 transition-colors hover:text-ember"
              >
                Conhecer o módulo
              </Link>
            </div>

            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {m.pedidos.map((p) => (
                <li
                  key={p.texto}
                  className="hairline flex items-start justify-between gap-4 rounded-2xl border bg-panel/40 px-4 py-3.5"
                >
                  <span className="min-w-0 text-[0.9375rem] leading-[1.5] text-chalk">
                    {p.texto}
                  </span>
                  <span className="shrink-0 pt-0.5 font-mono text-[0.6875rem] text-chalk-faint tabular-nums">
                    {p.hora}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function Botao({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-200",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flame",
        ativo
          ? "border-flame/60 bg-flame/15 text-ember"
          : "border-white/[0.12] bg-panel/50 text-chalk-dim hover:border-white/25 hover:text-chalk",
      )}
    >
      {children}
    </button>
  );
}
