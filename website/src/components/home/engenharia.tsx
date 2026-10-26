import Link from "next/link";
import { Faixa, Cabecalho, LinkTexto } from "./ui";
import { services } from "@/config/services";
import { softwareFactoryProcess } from "@/config/content";

/**
 * A Orkiestri como empresa de engenharia.
 *
 * Reúne três seções que viviam separadas na home — "Quem Somos", "Soluções"
 * e "Software Factory" — e repetiam o mesmo argumento em três alturas
 * diferentes da página. Juntas, contam uma coisa só: além do produto, existe
 * um time que constrói sob medida, e este é o caminho que ele percorre.
 */
export function Engenharia() {
  return (
    <Faixa id="engenharia" tom="raise">
      <Cabecalho
        titulo="Antes de ser um produto, a Orkiestri é uma fábrica de software."
        texto="O Orkiestri One nasceu de projetos sob medida para operações reais. O mesmo time que o mantém desenvolve aplicações, integra sistemas legados e sustenta ambientes em nuvem para outras empresas."
        acao={<LinkTexto href="/company">Conhecer a Orkiestri</LinkTexto>}
      />

      {/* ── As seis frentes ──────────────────────────────────────────────
          Lista de duas colunas em vez de seis cartões: são serviços
          equivalentes, sem um mais importante que o outro, e a lista diz
          isso melhor do que seis caixas idênticas. */}
      <ul className="mt-14 grid gap-x-16 sm:grid-cols-2">
        {services.map((s) => (
          <li key={s.slug} className="border-b border-white/[0.09]">
            <Link
              href={`/services/${s.slug}`}
              className="group flex items-baseline justify-between gap-6 py-5 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flame"
            >
              <span className="font-semibold text-chalk transition-colors group-hover:text-flame-soft">
                {s.name}
              </span>
              <span className="text-right text-[0.9375rem] text-chalk-dim">
                {s.tagline}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* ── O processo ───────────────────────────────────────────────────
          Aqui a numeração se justifica: as sete etapas acontecem NESTA
          ordem. É sequência de verdade, não decoração — por isso o número
          fica, enquanto saiu de todo o resto da página.

          A linha que atravessa o topo amarra as etapas como uma régua de
          tempo; sem ela, seriam sete blocos soltos. */}
      <div className="mt-20">
        <h3 className="font-display text-xl font-semibold tracking-[-0.02em] text-chalk">
          Como um projeto anda, do primeiro dia ao suporte
        </h3>
        <ol className="mt-8 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {softwareFactoryProcess.map((etapa, i) => (
            <li key={etapa.title} className="relative border-t border-white/[0.09] pt-5">
              {/* Marca de etapa sobre o fio: ancora o número na régua. */}
              <span
                aria-hidden
                className="absolute -top-px left-0 h-px w-8 bg-flame"
              />
              <span className="font-mono text-[0.8125rem] tabular-nums text-flame-soft">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h4 className="mt-2 font-semibold text-chalk">{etapa.title}</h4>
              <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-chalk-dim">
                {etapa.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </Faixa>
  );
}
