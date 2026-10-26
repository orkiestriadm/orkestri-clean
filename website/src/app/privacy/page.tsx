import { PageHero } from "@/components/sections/page-hero";
import { Container } from "@/components/ui/container";
import { Prose } from "@/components/ui/prose";
import { buildMetadata } from "@/lib/seo";
import { siteConfig } from "@/config/site";

export const metadata = buildMetadata({
  title: "Política de Privacidade",
  description:
    "O que a Orkiestri coleta no site, no WhatsApp e no sistema, e o que faz com cada coisa, em conformidade com a LGPD.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Política de Privacidade"
        description="O que coletamos no site, na conversa de WhatsApp e no sistema — e o que fazemos com cada coisa."
        breadcrumb={[{ label: "Política de Privacidade", href: "/privacy" }]}
      />
      <Container className="pb-24">
        <Prose>
          <p>Última atualização: 2026.</p>

          <h2>1. Quem somos</h2>
          <p>
            A {siteConfig.legalName} é a empresa responsável
            pelo tratamento dos dados pessoais coletados através deste website.
          </p>

          <h2>2. Dados que coletamos no site</h2>
          <p>Podemos coletar as seguintes informações:</p>
          <ul>
            <li>Dados de contato fornecidos em formulários (nome, empresa, e-mail, telefone e mensagem);</li>
            <li>Dados de navegação e uso do site, por meio de cookies e ferramentas de analytics;</li>
            <li>Informações necessárias para responder a solicitações comerciais e de suporte.</li>
          </ul>

          <h2>3. Dados que coletamos no WhatsApp e no sistema</h2>
          <p>
            O cadastro no Orkiestri acontece em uma conversa de WhatsApp. Nessa
            conversa e no uso do sistema, tratamos:
          </p>
          <ul>
            <li>
              <strong>Seu número de WhatsApp</strong>, que é a chave usada para
              ligar a conversa à sua conta e para enviar os avisos;
            </li>
            <li>
              <strong>As respostas do cadastro</strong> — nome, CPF, e-mail e
              empresa —, usadas para criar a conta e evitar duplicidade;
            </li>
            <li>
              <strong>O conteúdo que você registra</strong>: compromissos,
              anotações, projetos, tarefas, chamados, gastos pessoais, contas a
              pagar e orçamento.
            </li>
          </ul>
          <p>
            <strong>Não armazenamos o texto das mensagens que você envia.</strong>{" "}
            Elas são interpretadas para executar o comando, e o que fica
            registrado é o resultado — o compromisso criado, o gasto lançado —,
            não a conversa.
          </p>
          <p>
            Gastos pessoais são visíveis <strong>apenas para você</strong>,
            inclusive em relação a quem administra a conta da sua empresa.
            Contas a pagar e orçamento são dados da organização e seguem as
            permissões definidas pelo administrador.
          </p>

          <h2>4. Avisos pelo WhatsApp</h2>
          <p>
            Enviamos avisos relacionados ao que você mesmo registrou: lembretes
            de compromisso, prazos de chamados e um resumo semanal de gastos. O
            resumo semanal pode ser desligado a qualquer momento respondendo{" "}
            <strong>parar resumo</strong> na própria conversa. Os demais avisos
            podem ser configurados, módulo a módulo, dentro do sistema. Não
            enviamos publicidade por WhatsApp.
          </p>

          <h2>5. Como utilizamos os dados</h2>
          <p>Utilizamos os dados para:</p>
          <ul>
            <li>Criar e manter a sua conta, e executar o que você registra;</li>
            <li>Enviar os avisos que você configurou;</li>
            <li>Responder solicitações de contato e suporte;</li>
            
            <li>Melhorar a experiência e a performance do website;</li>
            <li>Cumprir obrigações legais e regulatórias.</li>
          </ul>

          <h2>6. Compartilhamento</h2>
          <p>
            Não vendemos dados pessoais. O compartilhamento ocorre apenas com
            provedores que apoiam a operação do serviço, sempre sob obrigações de
            confidencialidade, ou quando exigido por lei.
          </p>

          <h2>7. Seus direitos (LGPD)</h2>
          <p>
            Você pode solicitar acesso, correção, portabilidade, anonimização ou
            exclusão dos seus dados, bem como revogar consentimentos. Para exercer
            seus direitos, entre em contato pelo e-mail{" "}
            <a href={`mailto:${siteConfig.contact.email}`}>
              {siteConfig.contact.email}
            </a>
            .
          </p>

          <h2>8. Segurança</h2>
          <p>
            Adotamos medidas técnicas e organizacionais para proteger os dados
            contra acessos não autorizados, perda ou alteração indevida.
          </p>

          <h2>9. Contato</h2>
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
