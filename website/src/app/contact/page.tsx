import { Mail, Linkedin } from "lucide-react";
import { PageHero } from "@/components/sections/page-hero";
import { Container } from "@/components/ui/container";
import { ContactForm } from "@/components/forms/contact-form";
import { buildMetadata } from "@/lib/seo";
import { siteConfig } from "@/config/site";

export const metadata = buildMetadata({
  title: "Contato",
  description:
    "Fale com um especialista da Orkiestri. Nossa equipe está pronta para entender seus desafios e apresentar a melhor solução para sua empresa.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contato"
        title="Vamos construir algo extraordinário juntos."
        description="Nossa equipe está pronta para entender seus desafios e apresentar a melhor solução para sua empresa."
        breadcrumb={[{ label: "Contato", href: "/contact" }]}
      />
      <Container className="pb-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-xl font-semibold text-dark">
                Fale diretamente
              </h2>
              <p className="mt-2 text-gray-600">
                Prefere outro canal? Estamos por aqui.
              </p>
            </div>
            <a
              href={`mailto:${siteConfig.contact.email}`}
              className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-primary/40"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary-hover">
                <Mail className="h-5 w-5" aria-hidden />
              </span>
              <span>
                <span className="block text-sm text-gray-400">E-mail</span>
                <span className="font-medium text-dark">
                  {siteConfig.contact.email}
                </span>
              </span>
            </a>
            <a
              href={siteConfig.social.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-primary/40"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary-hover">
                <Linkedin className="h-5 w-5" aria-hidden />
              </span>
              <span>
                <span className="block text-sm text-gray-400">LinkedIn</span>
                <span className="font-medium text-dark">/orkiestri</span>
              </span>
            </a>
          </div>

          <ContactForm endpoint="/api/contact" />
        </div>
      </Container>
    </>
  );
}
