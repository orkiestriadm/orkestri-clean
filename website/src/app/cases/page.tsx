import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  NotebookPen,
  KanbanSquare,
  Headset,
} from "lucide-react";
import { PageHero } from "@/components/sections/page-hero";
import { Section } from "@/components/ui/section";
import { CTA } from "@/components/sections/cta";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Possibilidades de uso",
  description:
    "Conheça formas de aplicar os recursos do Orkiestri à agenda, às anotações, aos projetos e ao atendimento.",
  path: "/cases",
});
const uses = [
  {
    icon: CalendarDays,
    label: "Compromissos",
    title: "Uma agenda que acompanha quem está sempre em movimento.",
    text: "Registre um compromisso pelo WhatsApp, consulte os eventos e acompanhe a semana na plataforma. Os lembretes ajudam a lembrar do que vem pela frente.",
    href: "/products/one-space",
    example: "Evento: reunião amanhã 9h",
  },
  {
    icon: NotebookPen,
    label: "Vida pessoal",
    title: "Uma ideia encontra lugar antes de se perder.",
    text: "Use uma mensagem para guardar uma anotação no Keep. Consulte os recursos disponíveis para a sua conta sem misturar informações pessoais com as da organização.",
    href: "/products/one-space",
    example: "Nota: comprar material para a reunião",
  },
  {
    icon: KanbanSquare,
    label: "Trabalho em equipe",
    title: "O projeto continua organizado depois da primeira mensagem.",
    text: "Inicie o projeto no contexto da empresa e consulte suas tarefas pelo WhatsApp. Prazos, responsáveis e etapas continuam na plataforma.",
    href: "/products/one-projects",
    example: "Projeto: reforma da loja",
  },
  {
    icon: Headset,
    label: "Atendimento",
    title: "Um pedido deixa de depender da memória de alguém.",
    text: "Registre o chamado e acompanhe o atendimento com histórico e responsáveis. O acesso aos recursos segue o plano e as permissões da organização.",
    href: "/products/one-desk",
    example: "Chamado: a impressora não liga",
  },
];
export default function UsesPage() {
  return (
    <>
      <PageHero
        eyebrow="Possibilidades de uso"
        title="Um produto. Diferentes rotinas."
        description="Explore situações em que os recursos do Orkiestri podem ajudar. Comece pela sua necessidade e conheça o módulo correspondente."
        breadcrumb={[{ label: "Possibilidades de uso", href: "/cases" }]}
      />
      <Section className="pt-4 md:pt-6">
        <div className="grid gap-5 md:grid-cols-2">
          {uses.map((use) => (
            <Link
              key={use.label}
              href={use.href}
              className="premium-surface group rounded-3xl p-7 transition-transform hover:-translate-y-1 motion-reduce:hover:translate-y-0"
              data-spotlight
            >
              <div className="flex items-center justify-between">
                <use.icon className="text-flame-soft" size={26} aria-hidden />
                <ArrowUpRight
                  className="text-chalk-faint transition-colors group-hover:text-flame-soft"
                  size={18}
                  aria-hidden
                />
              </div>
              <p className="section-kicker mt-7">{use.label}</p>
              <h2 className="mt-3 text-2xl font-semibold leading-tight text-chalk">
                {use.title}
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-chalk-dim">
                {use.text}
              </p>
              <p className="mt-6 rounded-xl border border-white/10 bg-ink/60 p-4 font-mono text-xs leading-relaxed text-ember">
                {use.example}
              </p>
              <span className="mt-5 inline-block text-sm font-medium text-flame-soft">
                Conhecer os recursos →
              </span>
            </Link>
          ))}
        </div>
      </Section>
      <CTA />
    </>
  );
}
