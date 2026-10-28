import Link from "next/link";
import { PageHero } from "@/components/sections/page-hero";
import { Section, SectionHeader } from "@/components/ui/section";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { AureliaDemo } from "@/components/home/aurelia-demo";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Como fazer seu cadastro no Orkiestri",
  description:
    "Faça seu cadastro no sistema Orkiestri pelo WhatsApp. A Aurélia pergunta seus dados, uma informação por vez, e orienta seu primeiro acesso.",
  path: "/demo",
});

export default function DemoPage() {
  return (
    <>
      <PageHero
        eyebrow="Como funciona"
        title="Uma conversa para criar sua conta no Orkiestri."
        description="O botão prepara a mensagem CADASTRO: abra o WhatsApp, envie e responda às perguntas da Aurélia. Ela pede nome completo, CPF, e-mail e empresa, uma informação por vez."
        breadcrumb={[{ label: "Como funciona", href: "/demo" }]}
      >
        <WhatsAppButton />
      </PageHero>
      <AureliaDemo />
      <Section>
        <SectionHeader
          align="left"
          title="Você também pode entrar pelo site."
          description="Depois do cadastro confirmado, escolha como prefere usar o Orkiestri."
        />
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-panel p-6">
            <h3 className="text-xl font-semibold text-chalk">
              Seu primeiro acesso
            </h3>
            <p className="mt-3 leading-relaxed text-chalk-dim">
              Abra a recuperação de senha, escolha receber o código pelo
              WhatsApp e informe o mesmo número usado no cadastro. Confira o
              código na página, crie sua senha e entre no Orkiestri.
            </p>
            <a
              className="mt-5 inline-flex min-h-11 items-center font-medium text-flame-soft underline underline-offset-4"
              href="/recuperar-senha"
            >
              Definir minha senha →
            </a>
          </article>
          <article className="rounded-2xl border border-white/10 bg-panel p-6">
            <h3 className="text-xl font-semibold text-chalk">
              Uma conta para o sistema
            </h3>
            <p className="mt-3 leading-relaxed text-chalk-dim">
              Seu cadastro é no Orkiestri, não em uma agenda isolada. Os
              recursos disponíveis respeitam o plano e as permissões da conta.
              Envie menu à Aurélia para conhecer o que você pode usar.
            </p>
            <Link
              className="mt-5 inline-flex min-h-11 items-center font-medium text-flame-soft underline underline-offset-4"
              href="/contact"
            >
              Tirar uma dúvida →
            </Link>
          </article>
        </div>
        <p className="mt-8 text-sm leading-relaxed text-chalk-dim">
          Já tem uma conta?{" "}
          <a href="/login" className="text-chalk underline underline-offset-4">
            Entre diretamente.
          </a>{" "}
          Convites recebidos por WhatsApp têm suas próprias opções e condições.
          No site, envie CADASTRO para iniciar o cadastro geral, sem precisar de
          um convite.
        </p>
      </Section>
    </>
  );
}
