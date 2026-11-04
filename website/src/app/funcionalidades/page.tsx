import { ModulosEmAcao } from "@/components/home/modulos-em-acao";
import Link from "next/link";
import { PageHero } from "@/components/sections/page-hero";
import { Section } from "@/components/ui/section";
import { CTA } from "@/components/sections/cta";
import { Catalogo } from "@/components/aurelia/catalogo";
import { CAPACIDADES } from "@/config/aurelia";
import { PLANO } from "@/config/plano";
import { buildMetadata } from "@/lib/seo";

/**
 * O catálogo completo.
 *
 * Existe porque seis cards de uma linha não descrevem um produto com seis
 * aplicações em produção. Aqui cada capacidade tem um bloco, e a pessoa pode
 * ler a página inteira e continuar achando coisa que não sabia.
 *
 * Mantém a regra do catálogo de produtos: só entra aqui o que existe no
 * sistema. A lista vive em `config/aurelia.ts`.
 */

export const metadata = buildMetadata({
  title: "Funcionalidades",
  description: `${CAPACIDADES.length} funcionalidades do Orkiestri, uma por vez: agenda, gastos, anotações, tarefas, projetos, chamados e conhecimento, tudo pelo WhatsApp.`,
  path: "/funcionalidades",
  keywords: [
    "funcionalidades Orkiestri",
    "o que o Orkiestri faz",
    "recursos WhatsApp",
  ],
});

export default function FuncionalidadesPage() {
  return (
    <>
      <PageHero
        eyebrow="Funcionalidades"
        title="Tudo o que o sistema faz, uma coisa por vez."
        description={`São ${CAPACIDADES.length} funcionalidades. Escolha um assunto nos filtros ou leia na ordem, do primeiro pedido na conversa até o que fica guardado no site. Nada aqui é promessa de versão futura: se está nesta página, existe hoje.`}
        breadcrumb={[{ label: "Funcionalidades", href: "/funcionalidades" }]}
      />

      <Section className="pt-4 md:pt-6">
        <ModulosEmAcao />
        <Catalogo />
      </Section>

      <Section muted className="py-14 md:py-16">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-16">
          <h2 className="font-display text-[1.5rem] font-bold leading-[1.15] tracking-[-0.03em] text-chalk [font-stretch:108%] md:text-[1.875rem]">
            O que não está aqui, não existe ainda.
          </h2>
          <p className="text-[1.0625rem] leading-[1.65] text-chalk-dim">
            Não há conexão com o seu banco, não emitimos nota fiscal e a
            Aurélia não fala com outras pessoas por você.{" "}
            <Link
              href="/aurelia"
              className="text-flame-soft underline decoration-flame/40 underline-offset-4"
            >
              Ela mesma explica onde para
            </Link>
            , e a{" "}
            <Link
              href="/seguranca"
              className="text-flame-soft underline decoration-flame/40 underline-offset-4"
            >
              página de segurança
            </Link>{" "}
            conta onde os seus dados ficam.
          </p>
        </div>
      </Section>

      <CTA
        title={`${CAPACIDADES.length} funcionalidades, uma conversa só.`}
        text={`A Aurélia guia o seu cadastro pelo WhatsApp. ${PLANO.testeDias} dias de teste, sem cartão, com tudo liberado.`}
        acaoLabel={`Começar o teste de ${PLANO.testeDias} dias`}
      />
    </>
  );
}
