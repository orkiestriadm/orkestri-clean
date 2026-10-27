import Link from "next/link";
import { PageHero } from "@/components/sections/page-hero";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Blog",
  description:
    "Ainda não há artigos publicados. Quando houver, serão sobre como organizar a própria rotina sem depender de disciplina.",
  path: "/blog",
});

/**
 * Blog.
 *
 * ⚠️ Esta página não tem artigo nenhum, e o desenho assume isso em vez de
 * disfarçar. Até 26/10/2026 ela exibia cinco pílulas de categoria
 * ("Tecnologia", "Gestão", "IA", "Cloud", "Negócios") como se houvesse um
 * acervo por trás — taxonomia prometida sobre zero conteúdo, e ainda no
 * vocabulário corporativo que saiu do resto do site.
 *
 * Quando o primeiro artigo existir, esta página vira uma lista. Até lá, ela
 * diz o que vai ter e oferece uma coisa só para fazer.
 */

/* Os assuntos são uma INTENÇÃO declarada, não um índice. O texto diz isso
   com todas as letras, para ninguém procurar o que não está lá. */
const assuntos = [
  "Como a gente construiu o cadastro inteiro dentro de uma conversa de WhatsApp",
  "Por que lembrete de uma hora antes funciona e notificação no ato não",
  "O que aprendemos medindo uso real antes de remover um módulo",
];

export default function BlogPage() {
  return (
    <>
      <PageHero
        eyebrow="Blog"
        title="Ainda não publicamos nada."
        description="Preferimos uma página honesta a três artigos escritos para preencher espaço. Quando houver o primeiro, ele vai estar aqui."
        breadcrumb={[{ label: "Blog", href: "/blog" }]}
      />

      <Section>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-20">
          <div>
            <h2 className="font-display text-[1.5rem] font-bold tracking-[-0.03em] text-chalk md:text-[1.875rem]">
              O que pretendemos escrever
            </h2>
            <ul className="mt-8 flex flex-col">
              {assuntos.map((a) => (
                <li
                  key={a}
                  className="border-t border-white/[0.09] py-5 text-[1.0625rem] leading-relaxed text-chalk-dim"
                >
                  {a}
                </li>
              ))}
            </ul>
          </div>

          <div className="hairline edge-light flex flex-col items-start rounded-(--radius-card) border bg-panel p-8">
            <h2 className="font-semibold text-chalk">
              Quer saber quando sair o primeiro?
            </h2>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-chalk-dim">
              Deixe seu contato e a gente avisa. Sem lista de e-mail, sem
              newsletter semanal — só quando houver artigo.
            </p>
            <Button asChild className="mt-7">
              <Link href="/contact">Quero ser avisado</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
