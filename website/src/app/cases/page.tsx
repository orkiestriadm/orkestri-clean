import { PageHero } from "@/components/sections/page-hero";
import { Section } from "@/components/ui/section";
import { CTA } from "@/components/sections/cta";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Cases",
  description:
    "Estudos de caso em preparação. Enquanto isso, veja onde o Orkiestri One se encaixa e fale com quem construiu a plataforma.",
  path: "/cases",
});

/**
 * Cases.
 *
 * ⚠️ Esta página NÃO tem depoimento nem logo de cliente, e isso é
 * deliberado. Até 26/10/2026 ela exibia três depoimentos — "Diretor de
 * Operações / Setor de Logística" e parecidos — que eram **inventados**,
 * logo abaixo de um texto dizendo que os estudos de caso viriam "em breve".
 * A contradição estava na mesma dobra.
 *
 * A faixa de baixo também dizia "Segmentos atendidos" e listava doze
 * setores, sem um cliente em nenhum deles. Virou "onde a plataforma se
 * encaixa", que é uma afirmação sobre o produto e se sustenta.
 *
 * Quando houver case real, com nome e número que o cliente autorize, ele
 * entra aqui. Antes disso, não.
 */

/* Afirmação sobre o PRODUTO, não sobre carteira de clientes: estes são os
   contextos em que os módulos que existem hoje resolvem o problema. */
const encaixes = [
  {
    titulo: "Quem atende chamado interno",
    texto:
      "TI, Facilities e Administrativo que hoje recebem pedido por e-mail e WhatsApp solto, sem fila, sem SLA e sem histórico.",
  },
  {
    titulo: "Quem repete a mesma resposta",
    texto:
      "Times que explicam o mesmo procedimento toda semana e precisam dele escrito, achável e citável dentro do chamado.",
  },
  {
    titulo: "Quem toca projeto sem ferramenta",
    texto:
      "Operações que controlam entregas em planilha e perdem prazo por não enxergar o que depende do quê.",
  },
  {
    titulo: "Quem precisa do orçamento à vista",
    texto:
      "Financeiro e diretoria que só descobrem o desvio no fim do mês, quando já não dá para corrigir.",
  },
];

export default function CasesPage() {
  return (
    <>
      <PageHero
        eyebrow="Cases"
        title="Os estudos de caso estão sendo preparados."
        description="Preferimos publicar resultado com nome, número e autorização do cliente a encher esta página de depoimento genérico. Enquanto isso, abaixo está onde a plataforma se encaixa hoje."
        breadcrumb={[{ label: "Cases", href: "/cases" }]}
      />

      <Section>
        <h2 className="font-display text-[1.75rem] font-bold tracking-[-0.03em] text-chalk md:text-[2.25rem]">
          Onde o Orkiestri One se encaixa
        </h2>
        <ul className="mt-12 grid gap-px overflow-hidden rounded-(--radius-card) bg-white/[0.07] sm:grid-cols-2">
          {encaixes.map((e) => (
            <li key={e.titulo} className="bg-ink p-7">
              <h3 className="font-semibold text-chalk">{e.titulo}</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-chalk-dim">
                {e.texto}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <CTA
        title="Quer ser o primeiro case publicado?"
        text="Fale com quem construiu a plataforma e veja se ela resolve o seu problema antes de decidir."
      />
    </>
  );
}
