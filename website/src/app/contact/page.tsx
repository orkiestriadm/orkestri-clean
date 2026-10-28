import { Mail, Linkedin } from "lucide-react";
import { PageHero } from "@/components/sections/page-hero";
import { IconTile } from "@/components/ui/icon-tile";
import { Container } from "@/components/ui/container";
import { ContactForm } from "@/components/forms/contact-form";
import { buildMetadata } from "@/lib/seo";
import { siteConfig } from "@/config/site";
import { getService } from "@/config/services";

export const metadata = buildMetadata({
  title: "Contato",
  description:
    "Fale com um especialista da Orkiestri. Nossa equipe está pronta para entender seus desafios e apresentar a melhor solução para sua empresa.",
  path: "/contact",
});

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ service?: string; interest?: string }> }) {
  const query = await searchParams;
  const service = query.service ? getService(query.service) : undefined;
  const project = Boolean(service) || query.interest === "project";
  return (
    <>
      <PageHero
        eyebrow="Contato"
        title={project ? "Vamos conversar sobre seu projeto." : "O que você precisa resolver?"}
        description={service ? `Conte o que você precisa em ${service.name.toLowerCase()}. Sua solicitação já vai com esse contexto.` : "Tire uma dúvida sobre o produto, peça ajuda com sua conta ou conte sua ideia de software sob medida."}
        breadcrumb={[{ label: "Contato", href: "/contact" }]}
      />
      <Container className="scroll-mt-24 pb-24" id="contato">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-xl font-semibold text-chalk">
                Fale diretamente
              </h2>
              <p className="mt-2 text-chalk-dim">
                Prefere outro canal? Estamos por aqui.
              </p>
            </div>
            <a
              href={`mailto:${siteConfig.contact.email}`}
              className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-panel p-5 transition-colors hover:border-flame/40"
            >
              <IconTile icon={Mail} />
              <span>
                <span className="block text-sm text-chalk-faint">E-mail</span>
                <span className="font-medium text-chalk">
                  {siteConfig.contact.email}
                </span>
              </span>
            </a>
            <a
              href={siteConfig.social.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-panel p-5 transition-colors hover:border-flame/40"
            >
              <IconTile icon={Linkedin} />
              <span>
                <span className="block text-sm text-chalk-faint">LinkedIn</span>
                <span className="font-medium text-chalk">/orkiestri</span>
              </span>
            </a>
          </div>

          <ContactForm initialInterest={project ? "project" : "product"} service={service?.name} />
        </div>
      </Container>
    </>
  );
}
