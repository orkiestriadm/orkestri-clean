import { PageHero } from "@/components/sections/page-hero";
import { Container } from "@/components/ui/container";
import { Prose } from "@/components/ui/prose";
import { buildMetadata } from "@/lib/seo";
import { siteConfig } from "@/config/site";

export const metadata = buildMetadata({
  title: "Termos de Uso",
  description:
    "Termos e condições de uso do website institucional da Orkiestri.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Termos de Uso"
        description="Ao acessar este website, você concorda com os termos e condições descritos abaixo."
        breadcrumb={[{ label: "Termos de Uso", href: "/terms" }]}
      />
      <Container className="pb-24">
        <Prose>
          <p>Última atualização: 2026.</p>

          <h2>1. Aceitação</h2>
          <p>
            O uso deste website implica a aceitação integral destes termos. Caso
            não concorde, recomendamos que não utilize o site.
          </p>

          <h2>2. Uso do conteúdo</h2>
          <p>
            Todo o conteúdo — textos, marcas, logotipos e materiais — pertence à{" "}
            {siteConfig.legalName} ou a seus licenciadores, sendo protegido por
            leis de propriedade intelectual. É vedada a reprodução sem
            autorização prévia.
          </p>

          <h2>3. Uso adequado</h2>
          <p>Você concorda em não:</p>
          <ul>
            <li>Utilizar o site para fins ilícitos ou não autorizados;</li>
            <li>Tentar comprometer a segurança ou a disponibilidade do serviço;</li>
            <li>Reproduzir ou distribuir conteúdo sem autorização.</li>
          </ul>

          <h2>4. Limitação de responsabilidade</h2>
          <p>
            O website é fornecido &quot;no estado em que se encontra&quot;. A
            {" "}
            {siteConfig.legalName} empenha-se em manter as informações corretas e
            atualizadas, mas não garante ausência de erros ou disponibilidade
            ininterrupta.
          </p>

          <h2>5. Links externos</h2>
          <p>
            Este site pode conter links para sites de terceiros. Não nos
            responsabilizamos pelo conteúdo ou pelas práticas de privacidade
            desses sites.
          </p>

          <h2>6. Alterações</h2>
          <p>
            Estes termos podem ser atualizados a qualquer momento. A versão
            vigente estará sempre disponível nesta página.
          </p>

          <h2>7. Contato</h2>
          <p>
            Em caso de dúvidas, entre em contato pelo e-mail{" "}
            <a href={`mailto:${siteConfig.contact.email}`}>
              {siteConfig.contact.email}
            </a>
            .
          </p>
        </Prose>
      </Container>
    </>
  );
}
