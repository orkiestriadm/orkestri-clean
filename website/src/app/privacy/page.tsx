import { PageHero } from "@/components/sections/page-hero";
import { Container } from "@/components/ui/container";
import { Prose } from "@/components/ui/prose";
import { buildMetadata } from "@/lib/seo";
import { siteConfig } from "@/config/site";

export const metadata = buildMetadata({
  title: "Política de Privacidade",
  description:
    "Como a Orkiestri coleta, utiliza e protege os dados pessoais, em conformidade com a LGPD.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Política de Privacidade"
        description="Sua privacidade é importante para nós. Esta política explica como tratamos dados pessoais, em conformidade com a LGPD."
        breadcrumb={[{ label: "Política de Privacidade", href: "/privacy" }]}
      />
      <Container className="pb-24">
        <Prose>
          <p>Última atualização: 2026.</p>

          <h2>1. Quem somos</h2>
          <p>
            A {siteConfig.legalName} é uma Enterprise Software Company responsável
            pelo tratamento dos dados pessoais coletados através deste website.
          </p>

          <h2>2. Dados que coletamos</h2>
          <p>Podemos coletar as seguintes informações:</p>
          <ul>
            <li>Dados de contato fornecidos em formulários (nome, empresa, e-mail, telefone e mensagem);</li>
            <li>Dados de navegação e uso do site, por meio de cookies e ferramentas de analytics;</li>
            <li>Informações necessárias para responder a solicitações comerciais e de suporte.</li>
          </ul>

          <h2>3. Como utilizamos os dados</h2>
          <p>Utilizamos os dados para:</p>
          <ul>
            <li>Responder solicitações de contato e demonstração;</li>
            <li>Apresentar produtos, serviços e conteúdos relevantes;</li>
            <li>Melhorar a experiência e a performance do website;</li>
            <li>Cumprir obrigações legais e regulatórias.</li>
          </ul>

          <h2>4. Compartilhamento</h2>
          <p>
            Não vendemos dados pessoais. O compartilhamento ocorre apenas com
            provedores que apoiam a operação do serviço, sempre sob obrigações de
            confidencialidade, ou quando exigido por lei.
          </p>

          <h2>5. Seus direitos (LGPD)</h2>
          <p>
            Você pode solicitar acesso, correção, portabilidade, anonimização ou
            exclusão dos seus dados, bem como revogar consentimentos. Para exercer
            seus direitos, entre em contato pelo e-mail{" "}
            <a href={`mailto:${siteConfig.contact.email}`}>
              {siteConfig.contact.email}
            </a>
            .
          </p>

          <h2>6. Segurança</h2>
          <p>
            Adotamos medidas técnicas e organizacionais para proteger os dados
            contra acessos não autorizados, perda ou alteração indevida.
          </p>

          <h2>7. Contato</h2>
          <p>
            Dúvidas sobre esta política podem ser encaminhadas para{" "}
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
