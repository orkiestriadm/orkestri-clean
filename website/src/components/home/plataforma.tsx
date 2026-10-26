import Link from "next/link";
import { BrainCircuit, Zap, Plug, BarChart3, ShieldCheck } from "lucide-react";
import { Faixa, Cabecalho, LinkTexto } from "./ui";
import { products } from "@/config/products";
import { cn } from "@/lib/utils";

/**
 * Orkiestri One — a plataforma, as aplicações e o que elas compartilham.
 *
 * Esta seção substitui três que existiam separadas (Plataforma, Produtos e
 * Diferenciais) e diziam a mesma coisa de três maneiras. Juntas em uma só, o
 * argumento fica inteiro: uma base, as aplicações, quatro capacidades que
 * valem para todas.
 *
 * As aplicações entram como LISTA, não como cartões iguais. Cartões iguais
 * com a mesma borda e a mesma sombra não criam hierarquia nenhuma — tudo pesa
 * igual, então nada pesa. A lista deixa o nome do módulo carregar o peso.
 */

const capacidades = [
  {
    icone: BrainCircuit,
    titulo: "IA nativa",
    texto:
      "Copilotos, OCR e busca semântica durante o uso, não como módulo à parte.",
  },
  {
    icone: Zap,
    titulo: "Automação",
    texto: "Fluxos, aprovações e eventos no lugar do trabalho repetitivo.",
  },
  {
    icone: Plug,
    titulo: "API aberta",
    texto: "REST, webhooks e integração com Microsoft 365, SAP e TOTVS.",
  },
  {
    icone: BarChart3,
    titulo: "Indicadores",
    texto: "Todos os módulos alimentam a mesma camada de análise.",
  },
];

export function Plataforma() {
  return (
    <Faixa id="plataforma" tom="raise">
      <Cabecalho
        titulo="Uma base. Seis aplicações."
        texto="Em vez de sistemas desconectados que não se falam, um ambiente só: o mesmo login, as mesmas permissões, os mesmos dados. Você ativa o que a operação usa, e a plataforma cresce junto."
        acao={
          <LinkTexto href="/products/orkiestri-one">
            Conhecer a plataforma
          </LinkTexto>
        }
      />

      {/* ── As aplicações ───────────────────────────────────────────
          Grade de fios: cada célula se separa das vizinhas por uma linha de
          1px, como uma tabela. É um desenho de engenharia, não de catálogo —
          e combina com o que o produto é. */}
      <ul className="mt-14 grid gap-px overflow-hidden rounded-(--radius-card) bg-white/[0.07] sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => {
          const Icone = p.icon;
          return (
            <li key={p.slug} className="bg-ink-raise">
              <Link
                href={`/products/${p.slug}`}
                className={cn(
                  "group flex h-full items-start gap-4 p-6 transition-colors duration-200",
                  "hover:bg-panel focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-flame",
                )}
              >
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-flame/10 text-flame-soft ring-1 ring-inset ring-flame/20 transition-colors duration-200 group-hover:bg-flame/20">
                  <Icone className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-chalk">{p.name}</span>
                    {p.comingSoon && (
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[0.6875rem] font-medium text-chalk-faint">
                        Em breve
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-[0.9375rem] leading-relaxed text-chalk-dim">
                    {p.tagline}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* ── O que vale para todas ────────────────────────────────────────
          Sem cartão: um fio em cima de cada bloco já diz que são quatro
          itens de um mesmo conjunto. A borda completa só acrescentaria
          desenho. */}
      <div className="mt-16 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {capacidades.map((c) => {
          const Icone = c.icone;
          return (
            <div key={c.titulo} className="border-t border-white/[0.09] pt-5">
              <Icone className="h-5 w-5 text-flame-soft" aria-hidden />
              <h3 className="mt-4 font-semibold text-chalk">{c.titulo}</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-chalk-dim">
                {c.texto}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-12 flex items-start gap-3 text-[0.9375rem] leading-relaxed text-chalk-dim">
        <ShieldCheck
          className="mt-0.5 h-5 w-5 shrink-0 text-chalk-faint"
          aria-hidden
        />
        <span>
          Autenticação multifator, criptografia, permissões granulares, trilha
          de auditoria e conformidade com a LGPD — em todos os módulos, não
          como item de plano superior.
        </span>
      </p>
    </Faixa>
  );
}
