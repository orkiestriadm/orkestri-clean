"use client";

import { useState } from "react";
import { CAPACIDADES, GRUPOS_CAPACIDADE } from "@/config/aurelia";
import { cn } from "@/lib/utils";

/**
 * O catálogo de funcionalidades.
 *
 * O site descrevia o produto em seis cards de uma linha cada, e um sistema com
 * seis aplicações em produção parecia menor do que é. Aqui cada capacidade
 * ganha um bloco: título em frase inteira, explicação e, quando existe, o
 * exemplo de conversa que comprova.
 *
 * A regra do catálogo de produtos vale aqui igual: **só entra o que existe no
 * sistema**. A lista vive em `config/aurelia.ts`, montada a partir dos parsers
 * do backend.
 */
export function Catalogo() {
  const [grupo, setGrupo] = useState<string>("todos");
  const visiveis =
    grupo === "todos"
      ? CAPACIDADES
      : CAPACIDADES.filter((c) => c.grupo === grupo);

  return (
    <div>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Filtrar funcionalidades por assunto"
      >
        <Botao ativo={grupo === "todos"} onClick={() => setGrupo("todos")}>
          Tudo
          <span className="ml-2 text-xs text-chalk-faint">
            {CAPACIDADES.length}
          </span>
        </Botao>
        {GRUPOS_CAPACIDADE.map((g) => (
          <Botao key={g} ativo={grupo === g} onClick={() => setGrupo(g)}>
            {g}
            <span className="ml-2 text-xs text-chalk-faint">
              {CAPACIDADES.filter((c) => c.grupo === g).length}
            </span>
          </Botao>
        ))}
      </div>

      <div className="mt-12 flex flex-col gap-4">
        {visiveis.map((c) => (
          <article
            key={c.titulo}
            className="premium-surface rounded-(--radius-card) p-6 md:p-8"
            data-spotlight
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-12">
              <div>
                <p className="section-kicker">{c.grupo}</p>
                <h3 className="mt-3 text-[1.25rem] font-semibold leading-snug text-chalk md:text-[1.4375rem]">
                  {c.titulo}
                </h3>
                <p className="mt-4 max-w-[58ch] text-[0.9375rem] leading-[1.65] text-chalk-dim">
                  {c.texto}
                </p>
              </div>

              {/* O exemplo é opcional de propósito: nem toda capacidade tem
                  uma troca curta que a demonstre, e inventar uma só para
                  preencher a coluna seria encenação. */}
              {c.exemplo && (
                <div className="hairline flex flex-col gap-2.5 self-start rounded-2xl border bg-ink/60 p-4">
                  <p className="max-w-[90%] self-end rounded-2xl bg-signal/15 px-3.5 py-2 text-sm leading-relaxed text-chalk">
                    {c.exemplo.pergunta}
                  </p>
                  <p className="hairline max-w-[90%] self-start rounded-2xl border bg-panel px-3.5 py-2 text-sm leading-relaxed text-chalk-dim">
                    {c.exemplo.resposta}
                  </p>
                </div>
              )}
            </div>
          </article>
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
