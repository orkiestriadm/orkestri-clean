import { PageHero } from "@/components/sections/page-hero";
import { Section } from "@/components/ui/section";
import { DemoForm } from "@/components/forms/demo-form";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Como começar",
  description:
    "O que acontece depois que você manda a primeira mensagem: o cadastro na conversa, o menu da Aurélia e os comandos de cada módulo.",
  path: "/demo",
});

/**
 * Como começar.
 *
 * Era "Solicitar Demonstração", com um formulário e quatro promessas
 * genéricas ("demonstração guiada", "sem compromisso"). Não fazia sentido:
 * desde 26/10/2026 o cadastro acontece numa conversa de WhatsApp, e quem
 * chega aqui quer saber o que vai acontecer nessa conversa — não marcar
 * reunião.
 *
 * ⚠️ O menu abaixo é o texto REAL que a Aurélia envia, copiado de
 * `montarMenuAjuda()` em
 * `backend/src/modules/agenda/whatsapp-inbound.module.ts`. Os emojis fazem
 * parte da mensagem, não são ícones de interface — por isso ficam. Se o menu
 * mudar lá, muda aqui.
 *
 * Os números são FIXOS por módulo: quem não tem acesso ao Financeiro não vê
 * o "1", mas o "3" continua sendo o Keep. Quem decorou um número continua
 * certo.
 */

const menuAurelia = `😊 Oi, Guilherme! Eu sou a Aurélia, sua ajudante do Orkiestri aqui no WhatsApp.
Com qual módulo você quer a minha ajuda? É só responder o número:

💸 Para Financeiro: responda 1
🗓️ Para Agenda: responda 2
📝 Para Keep: responda 3
📁 Para Projetos: responda 4
🎧 Para Chamados: responda 5
📚 Para Conhecimento: responda 6
📖 Para ver TUDO de uma vez: responda 7
👋 Para encerrar nossa conversa: responda 0`;

const passos = [
  {
    n: "01",
    titulo: "Você manda a primeira mensagem",
    texto:
      "Diga que quer criar sua conta. A Aurélia faz as perguntas do cadastro ali mesmo, na conversa.",
  },
  {
    n: "02",
    titulo: "A conta nasce pronta",
    texto:
      "Com os módulos já ligados e uma senha que você troca por um código enviado ao seu e-mail, antes do primeiro login.",
  },
  {
    n: "03",
    titulo: "Você manda “ajuda” quando quiser",
    texto:
      "Ela responde com o menu ao lado e ensina o passo a passo do módulo que você escolher. Também vai um guia em PDF logo depois do cadastro.",
  },
  {
    n: "04",
    titulo: "A partir daí, ela te procura",
    texto:
      "Lembrete de compromisso, resumo de gastos no domingo, aviso de prazo. Você não precisa lembrar de abrir nada.",
  },
];

export default function DemoPage() {
  return (
    <>
      <PageHero
        eyebrow="Como começar"
        title="O que acontece depois da primeira mensagem."
        description="Não há formulário para preencher nem reunião para marcar. O cadastro inteiro acontece numa conversa de WhatsApp, e em poucos minutos a conta está de pé."
        breadcrumb={[{ label: "Como começar", href: "/demo" }]}
      >
        <WhatsAppButton />
      </PageHero>

      <Section>
        <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-20">
          {/* Os quatro passos. A numeração se justifica: é sequência de
              verdade, nesta ordem. */}
          <ol className="flex flex-col">
            {passos.map((p) => (
              <li
                key={p.n}
                className="relative border-t border-white/[0.09] py-6 first:border-t-0 first:pt-0"
              >
                <span className="font-mono text-[0.8125rem] tabular-nums text-flame-soft">
                  {p.n}
                </span>
                <h2 className="mt-2 font-semibold text-chalk">{p.titulo}</h2>
                <p className="mt-1.5 max-w-[52ch] text-[0.9375rem] leading-relaxed text-chalk-dim">
                  {p.texto}
                </p>
              </li>
            ))}
          </ol>

          {/* O menu, reproduzido como chega. */}
          <div>
            <p className="text-[0.8125rem] font-medium text-chalk-faint">
              O menu que ela manda quando você escreve “ajuda”
            </p>
            <div className="hairline edge-light mt-4 rounded-(--radius-card) border bg-panel p-5">
              <pre className="whitespace-pre-wrap font-sans text-[0.9375rem] leading-relaxed text-chalk-dim">
                {menuAurelia}
              </pre>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-chalk-faint">
              Aparece só o que você pode usar: quem não tem acesso ao
              Financeiro não vê o <span className="font-mono">1</span>. Os
              números não se renumeram — o <span className="font-mono">3</span>{" "}
              é sempre o Keep.
            </p>
          </div>
        </div>
      </Section>

      {/* O formulário continua, mas como SEGUNDA opção: quem prefere falar
          com uma pessoa antes de criar a conta. */}
      <Section muted>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div>
            <h2 className="font-display text-[1.75rem] font-bold tracking-[-0.03em] text-chalk md:text-[2.25rem]">
              Prefere que alguém te mostre?
            </h2>
            <p className="mt-4 max-w-[46ch] text-[1.0625rem] leading-[1.65] text-chalk-dim">
              Se você quer ver as telas com alguém do lado antes de criar a
              conta, deixe seu contato. Respondemos em até um dia útil.
            </p>
          </div>
          <DemoForm />
        </div>
      </Section>

    </>
  );
}
