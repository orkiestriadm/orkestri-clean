import Link from "next/link";
import { PageHero } from "@/components/sections/page-hero";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Blog",
  description:
    "Conteúdos sobre tecnologia, gestão, inteligência artificial, cloud e transformação digital.",
  path: "/blog",
});

const categories = ["Tecnologia", "Gestão", "IA", "Cloud", "Negócios"];

export default function BlogPage() {
  return (
    <>
      <PageHero
        eyebrow="Blog"
        title="Ideias sobre tecnologia e crescimento."
        description="Conteúdos sobre tecnologia, gestão, inteligência artificial, cloud e transformação digital. Estamos preparando nossos primeiros artigos."
        breadcrumb={[{ label: "Blog", href: "/blog" }]}
      />

      <Section>
        <div className="flex flex-wrap justify-center gap-3">
          {categories.map((c) => (
            <span
              key={c}
              className="rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-600"
            >
              {c}
            </span>
          ))}
        </div>

        <div className="mx-auto mt-16 max-w-xl rounded-[--radius-card] border border-gray-200 bg-gray-50 p-10 text-center">
          <h2 className="text-2xl font-semibold text-dark">Em breve</h2>
          <p className="mt-3 text-gray-600">
            Estamos construindo um espaço de conteúdo técnico e de negócios. Quer
            ser avisado quando publicarmos? Fale com a gente.
          </p>
          <div className="mt-6 flex justify-center">
            <Button asChild>
              <Link href="/contact">Quero ser avisado</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
