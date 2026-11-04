import Link from "next/link";
import Image from "next/image";
import { PageHero } from "@/components/sections/page-hero";
import { Section } from "@/components/ui/section";
import { Notebook } from "@/components/ui/notebook";
import { CTA } from "@/components/sections/cta";
import { products } from "@/config/products";
import { CAPACIDADES, PARA_QUEM } from "@/config/aurelia";
import { PLANO } from "@/config/plano";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Quem somos",
  description: "Conheça a origem do Orkiestri, os princípios da equipe e o papel da Aurélia na organização da rotina.",
  path: "/company",
});

const principios = [
  ["Simplicidade", "Quem está a caminho de uma reunião pode mandar um áudio. A Aurélia entende o pedido e apresenta os detalhes para conferir."],
  ["Autonomia", "Antes de salvar um compromisso, você pode corrigir a data ou o horário. É a sua agenda, inclusive quando a Aurélia ajuda a preenchê-la."],
  ["Transparência", "Você pode consultar o preço, o que cada aplicação faz e como funcionam as permissões antes de começar o teste."],
];

const numeros = [
  [products.length, "aplicações no catálogo", "/products"],
  [CAPACIDADES.length, "funcionalidades explicadas", "/funcionalidades"],
  [PARA_QUEM.length, "rotinas de exemplo", "/#para-quem"],
  [PLANO.testeDias, "dias para experimentar", "/planos"],
] as const;

export default function CompanyPage() {
  const agenda = products.find(p => p.slug === "one-space")?.screenshot;
  return <>
    <PageHero eyebrow="Quem somos" title="O Orkiestri nasceu no meio do expediente."
      description="Quando os pedidos de uma equipe ficam espalhados entre conversas, é fácil perder de vista quem ficou de fazer o quê. Foi desse problema de organização que nasceu o Orkiestri."
      breadcrumb={[{ label: "Quem somos", href: "/company" }]} />

    <Section id="fundador" muted>
      <div className="grid gap-8 border-t border-white/15 pt-8 md:grid-cols-[.8fr_1.2fr]">
        <figure className="max-w-sm">
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-panel">
            <Image src="/media/guilherme-landcast.webp" alt="Guilherme Rodrigues, fundador do Orkiestri" width={290} height={362} unoptimized className="h-full w-full object-cover" />
          </div>
          <figcaption className="mt-2 text-xs text-chalk-faint">Retrato da divulgação do Land Cast · Land IT</figcaption>
        </figure>
        <div>
          <p className="section-kicker">O fundador</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight">Guilherme Rodrigues</h2>
          <a className="mt-4 inline-block text-sm text-flame-soft underline underline-offset-4" href="https://www.linkedin.com/in/guilhermeluisrodrigues/">Perfil no LinkedIn</a>
        <div className="mt-6 max-w-prose space-y-4 leading-relaxed text-chalk-dim">
          <p>O Orkiestri nasceu de uma dificuldade que Guilherme vivia na gestão de operações de TI. Para acompanhar o trabalho da equipe, precisava juntar pedidos, prazos e decisões espalhados por diferentes lugares. Ele começou a desenvolver a plataforma por conta própria para resolver esse problema.</p>
          <p>Ele desenhou os módulos, desenvolveu a aplicação e colocou a plataforma no ar na AWS. Ao longo desse trabalho, reuniu gestão de operações, desenvolvimento de software e inteligência artificial em um produto que ele próprio queria usar.</p>
          <p>No Land Cast, Guilherme compartilhou sua experiência à frente de operações de infraestrutura que precisam funcionar 24 horas por dia. O episódio aborda liderança de equipes, eficiência e como decidir onde a tecnologia pode reduzir o esforço da operação.</p>
          <a className="block text-sm text-flame-soft underline underline-offset-4" href="https://pt.linkedin.com/posts/landitlandit_infraestrutura-cr%C3%ADtica-n%C3%A3o-permite-improviso-activity-7488970250676527104-o4Dl">Conheça o episódio do Land Cast</a>
          <a className="inline-block text-sm text-flame-soft underline underline-offset-4" href="https://pt.linkedin.com/posts/guilhermeluisrodrigues_orkiestri-plataforma-corporativa-de-gest%C3%A3o-activity-7463391370746130432-3RWd">Leia o relato de Guilherme sobre a criação do Orkiestri</a>
        </div>
        </div>
      </div>
    </Section>

    <Section id="origem">
      <div className="grid items-center gap-10 lg:grid-cols-[.8fr_1.2fr]">
        <div>
          <p className="section-kicker">A origem</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">O que ficou combinado naquela conversa?</h2>
          <p className="mt-6 max-w-prose leading-relaxed text-chalk-dim">Essa pergunta aparece tanto na volta de uma visita a um cliente quanto em casa, quando alguém tenta lembrar a data de uma consulta. Queríamos poder registrar o combinado ali mesmo, enquanto o assunto ainda estava fresco.</p>
          <p className="mt-4 max-w-prose leading-relaxed text-chalk-dim">Hoje, você pode dizer à Aurélia quando será a visita. Ela confirma os detalhes pelo WhatsApp, o compromisso aparece na agenda e o lembrete chega antes da hora.</p>
        </div>
        {agenda && <figure><Notebook tela={agenda} /><figcaption className="mt-3 text-center text-xs text-chalk-faint">A agenda do Orkiestri com compromissos de demonstração.</figcaption></figure>}
      </div>
    </Section>

    <Section muted id="principios">
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <p className="section-kicker">Nossos princípios</p>
          <h2 className="mt-4 max-w-lg text-4xl font-semibold tracking-tight md:text-6xl">O sistema lembra. Você decide.</h2>
        </div>
        <dl className="divide-y divide-white/15 border-y border-white/15">
          {principios.map(([titulo, texto]) => <div key={titulo} className="py-5">
            <dt className="text-lg font-semibold">{titulo}</dt>
            <dd className="mt-2 leading-relaxed text-chalk-dim">{texto}</dd>
          </div>)}
        </dl>
      </div>
    </Section>

    <Section id="em-numeros">
      <p className="section-kicker">O produto em números</p>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">O que você pode explorar hoje</h2>
      <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-4">
        {numeros.map(([valor, legenda, href]) => <Link key={href} href={href} className="group border-t border-white/20 py-5">
          <span className="block text-5xl font-semibold tabular-nums text-flame-soft">{valor}</span>
          <span className="mt-3 block text-sm text-chalk-dim group-hover:underline">{legenda} →</span>
        </Link>)}
      </div>
      <Link className="mt-8 inline-block text-sm text-flame-soft underline underline-offset-4" href="/company/careers">Trabalhe conosco</Link>
    </Section>

    <CTA title="Qual é o próximo compromisso da sua semana?" text="Experimente marcar esse compromisso com a Aurélia pelo WhatsApp e depois abra a agenda para conferir." />
  </>;
}
