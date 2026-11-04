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
  description: "Conheça a história do Orkiestri, a trajetória do fundador Guilherme Rodrigues e o propósito de simplificar a rotina com tecnologia acessível.",
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
    <PageHero
      eyebrow="Quem somos"
      title="Uma história de tecnologia, propósito e empreendedorismo."
      description="Da experiência de transformar realidades com tecnologia ao desafio de criar uma solução simples e acessível para todos."
      breadcrumb={[{ label: "Quem somos", href: "/company" }]}
    />

    <Section id="fundador" muted>
      <div className="grid items-start gap-10 border-t border-white/15 pt-10 md:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] lg:gap-14">
        <figure className="mx-auto w-full max-w-sm md:sticky md:top-28">
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-panel shadow-soft-lg">
            <Image src="/media/guilherme-rodrigues.jpg" alt="Guilherme Rodrigues, fundador do Orkiestri" width={896} height={1152} unoptimized className="h-full w-full object-cover" />
          </div>
          <div className="mt-4 flex items-center justify-between px-1">
            <div>
              <p className="text-base font-semibold text-chalk">Guilherme Rodrigues</p>
              <p className="text-xs text-chalk-faint">Fundador do Orkiestri</p>
            </div>
            <a
              className="text-xs font-medium text-flame-soft underline underline-offset-4 hover:text-ember"
              href="https://www.linkedin.com/in/guilhermeluisrodrigues/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Perfil no LinkedIn
            </a>
          </div>
        </figure>

        <div className="min-w-0">
          <p className="section-kicker">O fundador · Guilherme Rodrigues</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-chalk md:text-4xl">
            Da experiência de transformar realidades com tecnologia ao desafio de criar uma solução acessível para todos.
          </h2>

          <div className="mt-6 max-w-[68ch] space-y-4 text-[0.975rem] leading-relaxed text-chalk-dim">
            <p>
              Sou profissional de Tecnologia da Informação há mais de 20 anos e, ao longo da minha trajetória, tive o privilégio de participar de projetos que vão muito além da implementação de sistemas. São iniciativas que impactaram diretamente a vida das pessoas: da inclusão digital que levou internet Wi-Fi gratuita a uma cidade de 50 mil habitantes, à informatização completa de um hospital regional no interior de São Paulo que antes operava inteiramente em papel, até a atuação estratégica em tecnologia para concessionárias de rodovias, cuidando da segurança e da mobilidade de milhares de usuários.
            </p>
            <p>
              Em todos esses projetos sempre houve um ponto em comum: <strong className="font-medium text-chalk">a tecnologia conectada ao propósito de melhorar a vida das pessoas</strong>. Ao mesmo tempo, vivi na pele um desafio que acompanhou toda a minha carreira — a dificuldade de organizar compromissos, demandas, projetos e finanças sem precisar contratar e aprender a usar várias plataformas caras e desconectadas.
            </p>
            <blockquote className="my-5 border-l-2 border-flame pl-4 text-base font-medium italic text-chalk">
              “Por que organizar a própria vida, os compromissos, os projetos e as finanças precisa ser algo tão complexo e caro?”
            </blockquote>
            <p>
              Foi dessa necessidade real que nasceu o <strong className="font-medium text-chalk">Orkiestri</strong>: uma plataforma que reúne agenda, gestão de compromissos, demandas, projetos, lembretes e controle financeiro em um único ambiente — com a simplicidade de estar integrada diretamente ao <strong className="font-medium text-chalk">WhatsApp</strong>, a ferramenta que já faz parte do dia a dia de milhões de brasileiros.
            </p>
            <p>
              Mais do que desenvolver um software, meu objetivo com o Orkiestri é democratizar o acesso à organização pessoal, profissional e financeira — para que uma pessoa comum, uma família, um profissional autônomo, um pequeno empreendedor ou uma empresa possam administrar melhor seu tempo e suas responsabilidades de forma simples e acessível.
            </p>
            <p className="pt-2 text-base font-semibold text-flame-soft">
              Tecnologia para organizar. Simplicidade para transformar. Acessibilidade para todos.
            </p>
          </div>
        </div>
      </div>
    </Section>

    <Section id="origem">
      <div className="grid items-center gap-10 lg:grid-cols-[.85fr_1.15fr] lg:gap-14">
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
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
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
