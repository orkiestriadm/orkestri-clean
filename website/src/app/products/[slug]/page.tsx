import { notFound } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { Check, Sparkles, Plug, ArrowRight } from "lucide-react";
import { PageHero } from "@/components/sections/page-hero";
import { IconTile } from "@/components/ui/icon-tile";
import { Screenshot } from "@/components/ui/screenshot";
import { Container } from "@/components/ui/container";
import { Section, SectionHeader } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { TrialButton } from "@/components/trial/trial-button";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "@/components/cards/product-card";
import { Reveal } from "@/components/animations/reveal";
import { CTA } from "@/components/sections/cta";
import { products, getProduct } from "@/config/products";
import { buildMetadata } from "@/lib/seo";
import { siteConfig } from "@/config/site";

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return buildMetadata({ title: "Produto" });
  return buildMetadata({
    title: `${product.name} — ${product.category}`,
    description: product.description,
    path: `/products/${product.slug}`,
  });
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const related = products.filter((p) => p.slug !== product.slug).slice(0, 3);

  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `Orkiestri ${product.name}`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: product.description,
    publisher: { "@type": "Organization", name: siteConfig.name },
  };

  return (
    <>
      <Script
        id={`product-schema-${product.slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <PageHero
        eyebrow={product.comingSoon ? `${product.category} · Em breve` : product.category}
        title={product.name}
        description={product.description}
        breadcrumb={[
          { label: "Produtos", href: "/products" },
          { label: product.name, href: `/products/${product.slug}` },
        ]}
      >
        {product.comingSoon ? (
          <div className="flex flex-col items-start gap-4">
            <p className="rounded-(--radius-card) border border-gray-200 bg-gray-50 px-5 py-4 text-[0.9375rem] text-gray-600">
              Este módulo está em desenvolvimento. Fale com nosso time para
              acompanhar o lançamento ou avaliar uma solução sob medida enquanto
              isso.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/contact">Falar com especialista</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/products/orkiestri-one">Ver a plataforma</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <TrialButton size="lg">Solicitar demonstração</TrialButton>
            <Button asChild variant="secondary" size="lg">
              <Link href="/products/orkiestri-one">Ver a plataforma</Link>
            </Button>
          </div>
        )}
      </PageHero>

      {/* Captura real do módulo (doc 06: imagens reais, nunca mockups) */}
      {product.screenshot && (
        <Container className="pb-4">
          <Reveal>
            <Screenshot {...product.screenshot} />
          </Reveal>
        </Container>
      )}

      {/* Features */}
      <Section>
        <SectionHeader
          align="left"
          eyebrow="Recursos"
          title={`Tudo o que o ${product.name} entrega.`}
        />
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {product.features.map((f, i) => (
            <Reveal key={f} delay={(i % 3) * 0.04}>
              <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-hover">
                  <Check className="h-4 w-4" aria-hidden />
                </span>
                <span className="font-medium text-dark">{f}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* AI + Integrations */}
      <Section muted>
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-(--radius-card) border border-gray-200 bg-white p-8">
            <IconTile icon={Sparkles} />
            <h3 className="mt-5 text-xl font-semibold text-dark">
              Inteligência Artificial
            </h3>
            <p className="mt-2 text-gray-500">
              Capacidades de IA nativas, presentes durante o uso.
            </p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {product.ai.map((a) => (
                <li key={a}>
                  <Badge variant="primary">{a}</Badge>
                </li>
              ))}
            </ul>
          </div>

          {product.integrations && product.integrations.length > 0 && (
            <div className="rounded-(--radius-card) border border-gray-200 bg-white p-8">
              <IconTile icon={Plug} tone="dark" />
              <h3 className="mt-5 text-xl font-semibold text-dark">
                Integrações
              </h3>
              <p className="mt-2 text-gray-500">
                Conecte com as ferramentas que você já usa.
              </p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {product.integrations.map((it) => (
                  <li key={it}>
                    <Badge variant="outline">{it}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Section>

      {/* Related */}
      <Section>
        <div className="flex items-end justify-between gap-4">
          <SectionHeader
            align="left"
            eyebrow="Ecossistema"
            title="Melhor ainda em conjunto."
          />
          <Button asChild variant="ghost" className="hidden shrink-0 sm:inline-flex">
            <Link href="/products">
              Ver todos
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </Section>

      <CTA />
    </>
  );
}
