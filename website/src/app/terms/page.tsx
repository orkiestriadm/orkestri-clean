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
        description="As regras de uso do site e da conta do Orkiestri, incluindo o atendimento pelo WhatsApp."
        breadcrumb={[{ label: "Termos de Uso", href: "/terms" }]}
      />
      <Container className="pb-24">
        <Prose>
          <p>Última atualização: 2026.</p>

          <h2>1. Aceitação</h2>
          <p>
O uso deste site e do sistema Orkiestri implica a aceitação integral
            destes termos. Caso não concorde, recomendamos que não os utilize.
          </p>

          <h2>2. Uso do conteúdo</h2>
          <p>
            Todo o conteúdo — textos, marcas, logotipos e materiais — pertence à{" "}
            {siteConfig.legalName} ou a seus licenciadores, sendo protegido por
            leis de propriedade intelectual. É vedada a reprodução sem
            autorização prévia.
          </p>

          <h2>3. A sua conta e o WhatsApp</h2>
          <p>
            O cadastro e parte do uso do Orkiestri acontecem em uma conversa de
            WhatsApp, a partir do número que você utilizar. Esse número passa a
            identificar a sua conta, e quem tiver acesso a ele poderá registrar
            e consultar informações em seu nome — trate-o com o mesmo cuidado
            de uma senha.
          </p>
          <p>
            Os avisos enviados por WhatsApp são relativos ao que você mesmo
            registrou. O resumo semanal de gastos pode ser desligado
            respondendo <strong>parar resumo</strong>; os demais avisos são
            configuráveis dentro do sistema.
          </p>
          <p>
            O WhatsApp é um serviço de terceiro, sujeito aos termos e à
            disponibilidade da Meta. A entrega de uma mensagem depende dele, e
            por isso não substitui a sua própria conferência de prazos
            críticos.
          </p>

          <h2>4. Uso adequado</h2>
          <p>Você concorda em não:</p>
          <ul>
            <li>Utilizar o site ou o sistema para fins ilícitos ou não autorizados;</li>
            <li>Tentar comprometer a segurança ou a disponibilidade do serviço;</li>
            <li>Reproduzir ou distribuir conteúdo sem autorização.</li>
          </ul>

          <h2>5. Limitação de responsabilidade</h2>
          <p>
            O site e o sistema são fornecidos &quot;no estado em que se encontram&quot;. A
            {" "}
            {siteConfig.legalName} empenha-se em manter as informações corretas e
            atualizadas, mas não garante ausência de erros ou disponibilidade
            ininterrupta.
          </p>

          <h2>6. Links externos</h2>
          <p>
            Este site pode conter links para sites de terceiros. Não nos
            responsabilizamos pelo conteúdo ou pelas práticas de privacidade
            desses sites.
          </p>

          <h2>7. Alterações</h2>
          <p>
            Estes termos podem ser atualizados a qualquer momento. A versão
            vigente estará sempre disponível nesta página.
          </p>

          <h2>8. Contato</h2>
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
