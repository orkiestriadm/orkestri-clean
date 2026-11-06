import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  MessageCircle,
  Sun,
  Wallet,
} from "lucide-react";
import { PageHero } from "@/components/sections/page-hero";
import { Section } from "@/components/ui/section";
import { CopyCommand } from "@/components/ui/copy-command";
import { CTA } from "@/components/sections/cta";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Guias para usar a Aurélia",
  description:
    "Comandos e primeiros passos para organizar agenda, consultar sua rotina e registrar gastos com a Aurélia no WhatsApp.",
  path: "/blog",
});

const guides = [
  {
    icon: MessageCircle,
    title: "Comece pelo cadastro",
    text: "O comando inicia seu cadastro no sistema Orkiestri. Confira seus dados antes de confirmar a criação da conta.",
    commands: ["CADASTRO"],
    href: "/demo",
    link: "Entender o cadastro",
  },
  {
    icon: CalendarDays,
    title: "Marque e consulte compromissos",
    text: "Informe o compromisso, o dia e o horário na mensagem. Para ver seus eventos, peça a lista numerada.",
    commands: ["Evento: médico amanhã 14h", "meus compromissos"],
    href: "/products/one-space",
    link: "Conhecer a agenda",
  },
  {
    icon: Sun,
    title: "Encontre o ritmo do seu dia",
    text: "Consulte sua rotina agora ou peça as opções de resumo diário. O envio automático depende da sua escolha de ativação e horário.",
    commands: ["meu dia", "rotina"],
    href: "/products/one-space",
    link: "Ver recursos da agenda",
  },
  {
    icon: Wallet,
    title: "Registre seus gastos pessoais",
    text: "Informe o valor e a forma de pagamento. O Financeiro depende do plano e das permissões da conta.",
    commands: ["Gasto: mercado 150 no crédito", "quanto gastei esse mês"],
    href: "/products/one-finance",
    link: "Conhecer contas e gastos",
  },
];

export default function GuidesPage() {
  return (
    <>
      <PageHero
        eyebrow="Guias de uso"
        title="Primeiros passos. Sem adivinhação."
        description="Escolha o que você quer fazer, copie o comando e envie na conversa com a Aurélia. Os exemplos não são executados por esta página."
        breadcrumb={[{ label: "Guias de uso", href: "/blog" }]}
      />
      <Section className="pt-4 md:pt-6">
        <div className="grid gap-5 md:grid-cols-2">
          {guides.map((guide) => (
            <article
              key={guide.title}
              className="premium-surface rounded-3xl p-6 md:p-8"
              data-spotlight
            >
              <guide.icon size={25} className="text-flame-soft" aria-hidden />
              <h2 className="mt-5 text-xl font-semibold text-chalk">
                {guide.title}
              </h2>
              <p className="mb-5 mt-3 text-sm leading-relaxed text-chalk-dim">
                {guide.text}
              </p>
              <div className="space-y-3">
                {guide.commands.map((command) => (
                  <CopyCommand key={command} command={command} />
                ))}
              </div>
              <Link
                className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-flame-soft"
                href={guide.href}
              >
                {guide.link}
                <ArrowUpRight size={15} aria-hidden />
              </Link>
            </article>
          ))}
        </div>
        <div className="mt-8 rounded-2xl border border-white/10 bg-panel p-6">
          <h2 className="text-xl font-semibold text-chalk">
            Você já tinha uma conta?
          </h2>
          <p className="mt-3 leading-relaxed text-chalk-dim">
            Se ainda precisar vincular seu WhatsApp, abra o Perfil no sistema e
            siga a opção de criação de evento pelo WhatsApp, usando o código
            exibido na sua própria conta. Quem acabou de fazer o cadastro na
            conversa deve seguir as boas-vindas da Aurélia.
          </p>
          <a
            href="/recuperar-senha"
            className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-flame-soft"
          >
            Preciso definir ou recuperar minha senha →
          </a>
        </div>
      </Section>
      <CTA />
    </>
  );
}
