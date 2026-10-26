import Link from "next/link";
import { PageHero } from "@/components/sections/page-hero";
import { Section, SectionHeader } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { ProductsGrid } from "@/components/sections/products-grid";
import { Container } from "@/components/ui/container";
import { CTA } from "@/components/sections/cta";
import { products } from "@/config/products";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Produtos",
  description:
    "As aplicações do Orkiestri One: chamados, conhecimento, projetos, agenda, financeiro e administração, sob o mesmo login.",
  path: "/products",
});

export default function ProductsPage() {
  return (
    <>
      <PageHero
        eyebrow="Produtos"
        /* "Uma plataforma. Múltiplas possibilidades." dizia respeito a
           qualquer software do mundo. O título agora diz o que a pessoa vai
           encontrar aqui. */
        title={`${products.length} aplicações que dividem o mesmo login.`}
        description="Chamados, conhecimento, projetos, agenda, financeiro e administração. Você ativa o que a operação usa; o resto não atrapalha a tela de ninguém."
        breadcrumb={[{ label: "Produtos", href: "/products" }]}
      />

      <Container className="pt-16 md:pt-20">
        {/* Faixa da plataforma: é o ÚNICO elemento desta página com fundo
            próprio e botão sólido, porque é a única coisa aqui que não é um
            item de lista — é o guarda-chuva de todos eles. */}
        <Link
          href="/products/orkiestri-one"
          className="hairline edge-light group flex flex-col items-start justify-between gap-7 rounded-(--radius-image) border bg-panel p-8 transition-colors hover:border-white/15 md:flex-row md:items-center md:p-12"
        >
          <div>
            <span className="text-[0.8125rem] font-medium text-flame-soft">
              A plataforma
            </span>
            <h2 className="mt-2 font-display text-[1.5rem] font-bold tracking-[-0.03em] text-chalk [font-stretch:106%] md:text-[2rem]">
              Orkiestri One
            </h2>
            <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-chalk-dim">
              Um login, um banco de dados, as mesmas permissões. As aplicações
              não se integram — elas já nascem no mesmo lugar.
            </p>
          </div>
          <span className="inline-flex h-[52px] shrink-0 items-center rounded-(--radius-button) bg-primary px-6 font-semibold text-[#1b0c02] transition-transform duration-200 ease-(--ease-out-quart) group-hover:scale-[1.03] motion-reduce:group-hover:scale-100">
            Conhecer a plataforma
          </span>
        </Link>
      </Container>

      <Section>
        <SectionHeader
          title="Cada uma resolve um problema que existe."
          description="Esta lista é espelho do sistema: um módulo só entra aqui depois de existir lá dentro. Podem ser contratados em conjunto ou por departamento."
        />
        <div className="mt-12">
          <ProductsGrid />
        </div>
      </Section>

      <div className="flex justify-center pb-4">
        <Button asChild variant="secondary" size="lg">
          <Link href="/services">Conheça também nossas soluções</Link>
        </Button>
      </div>

      <CTA />
    </>
  );
}
