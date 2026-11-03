import Link from "next/link";
import { Mic, Paperclip, ListOrdered, Type, X } from "lucide-react";
import { PageHero } from "@/components/sections/page-hero";
import { Section, SectionHeader } from "@/components/ui/section";
import { CTA } from "@/components/sections/cta";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { AureliaCapture } from "@/components/home/aurelia-capture";
import { Reveal } from "@/components/animations/reveal";
import { MESAS } from "@/config/aurelia";
import { PLANO } from "@/config/plano";
import { buildMetadata } from "@/lib/seo";

/**
 * A página da Aurélia.
 *
 * Ela é o ativo de marca mais forte do produto e, até 03/11/2026, aparecia
 * no hero da home e sumia: sem cargo, sem página própria, sem voz. Um nome
 * que ninguém consegue explicar não vira lembrança.
 *
 * Duas decisões ao escrever:
 *
 *   1. **Primeira pessoa.** Ela fala, e não a empresa falando sobre ela. É o
 *      mesmo registro da conversa real no WhatsApp, que é onde a pessoa vai
 *      encontrá-la depois.
 *   2. **O "o que eu não faço" é a parte mais importante da página.** Quem
 *      entrega agenda e gastos a uma assistente de IA quer saber onde ela
 *      para. Dizer o limite em voz alta vale mais do que mais uma lista de
 *      capacidades — e nos impede de prometer conexão bancária, emissão de
 *      nota ou qualquer coisa que o sistema não faz.
 */

export const metadata = buildMetadata({
  title: "Aurélia",
  description:
    "A assistente do Orkiestri no WhatsApp: marca compromissos, anota gastos, abre tarefas e avisa antes da hora. Conheça o que ela faz e onde ela para.",
  path: "/aurelia",
  keywords: ["Aurélia", "assistente WhatsApp", "assistente de IA", "Orkiestri"],
});

/** O que ela faz, em primeira pessoa. Cada linha espelha uma mesa real. */
const oQueFaco = [
  {
    titulo: "Eu marco e eu lembro.",
    texto:
      "Você me diz o compromisso do jeito que a frase sai — “marcar dentista quinta 15h” — e eu crio, confirmo por escrito e aviso quatro vezes antes: uma hora antes, aos quinze minutos, aos cinco e na hora que começa.",
  },
  {
    titulo: "Eu anoto o que você gastou.",
    texto:
      "“gastei 87 na farmácia” vira lançamento com valor, categoria e forma de pagamento. Reconheço débito, crédito, Pix, dinheiro e boleto, e desdobro “em 6x de 95” nas seis parcelas.",
  },
  {
    titulo: "Eu guardo o que não pode se perder.",
    texto:
      "A anotação solta, a tarefa com prazo, o projeto que começou numa frase, a conta que vence dia 10. Cada coisa no lugar certo, e tudo de volta quando você perguntar.",
  },
  {
    titulo: "Eu abro o seu pedido e acompanho.",
    texto:
      "“Chamado: a impressora não liga” entra com histórico e responsável. E quando você precisa de uma orientação que alguém já escreveu, eu procuro na base da sua organização.",
  },
  {
    titulo: "Eu conto como foi o seu dia.",
    texto:
      "“meu dia” responde na hora. Se preferir receber sozinho, “ativar resumo diário 08:00” — e “dias úteis” no fim pula o fim de semana.",
  },
  {
    titulo: "Eu faço o seu cadastro.",
    texto:
      "Sou a porta de entrada do Orkiestri. Pergunto nome, CPF, e-mail e o nome da organização, uma informação por vez, e a conta nasce com os primeiros registros já guiados por mim.",
  },
];

/**
 * O limite, dito em voz alta.
 *
 * Nenhuma destas linhas é retórica: são as coisas que o sistema realmente não
 * faz hoje. Se alguma passar a existir, ela sai daqui — e só então pode
 * aparecer no catálogo.
 */
const oQueNaoFaco = [
  {
    titulo: "Eu não movimento o seu dinheiro.",
    texto:
      "Não pago conta, não transfiro, não faço Pix. Eu anoto o que você gastou e lembro do que vence. Pagar continua sendo você, no seu banco.",
  },
  {
    titulo: "Eu não leio o seu banco.",
    texto:
      "Não existe conexão bancária aqui. Nada do seu extrato, do seu saldo ou da sua fatura chega até mim: o que eu sei dos seus gastos é o que você me contou.",
  },
  {
    titulo: "Eu nunca peço a sua senha.",
    texto:
      "Nenhum trabalho meu depende dela. Se alguém pedir a sua senha, um código do banco ou um token em nome do Orkiestri, não sou eu.",
  },
  {
    titulo: "Eu não falo com outras pessoas por você.",
    texto:
      "Eu não mando recado, não cobro ninguém e não marco horário com terceiros. A conversa é entre nós dois.",
  },
  {
    titulo: "Eu não emito nota fiscal.",
    texto:
      "Nem nota, nem boleto, nem documento com valor fiscal. Esse trabalho não é meu e eu prefiro dizer antes de você precisar.",
  },
  {
    titulo: "Eu não invento resposta.",
    texto:
      "Se eu não entendi o pedido, eu pergunto. Se o que você procura não está na sua conta, eu digo que não achei — em vez de devolver um número que parece certo.",
  },
];

/** Como falar com ela. Tudo verificado em `whatsapp-media.service.ts`. */
const comoFalar = [
  {
    icon: Type,
    titulo: "Texto",
    texto:
      "Escreva como escreveria para uma pessoa. Não existe comando para decorar, e maiúscula e acento não fazem diferença.",
  },
  {
    icon: Mic,
    titulo: "Áudio",
    texto:
      "Até trinta segundos. Eu transcrevo e trato igual ao texto — serve para o pedido que aparece no meio da rua.",
  },
  {
    icon: Paperclip,
    titulo: "Arquivo",
    texto:
      "PDF e imagem em JPEG, PNG ou WebP, até 5 MB. O arquivo fica anexado ao registro e você encontra depois pelo site.",
  },
  {
    icon: ListOrdered,
    titulo: "Menu",
    texto:
      "Se preferir escolher a escrever, mande “menu”. Eu pergunto um campo por vez, e “voltar” existe em toda etapa.",
  },
];

export default function AureliaPage() {
  return (
    <>
      <PageHero
        eyebrow="Aurélia"
        title="Eu te aviso antes, não depois."
        description="Sou a Aurélia, a assistente do Orkiestri. Trabalho dentro do WhatsApp que você já usa: marco os seus compromissos, anoto os seus gastos, guardo o que não pode se perder e aviso na hora em que ainda dá tempo."
        breadcrumb={[{ label: "Aurélia", href: "/aurelia" }]}
      >
        <div className="flex flex-col items-start gap-3">
          <WhatsAppButton>Falar com a Aurélia</WhatsAppButton>
          <p className="text-sm text-chalk-faint">
            {PLANO.testeDias} dias de teste, sem cartão.
          </p>
        </div>
      </PageHero>

      {/* ── A ficha ──────────────────────────────────────────────────────
          Faz o papel do cabeçalho de currículo: diz em dez segundos quem ela
          é, onde atende e com o que trabalha. */}
      <Section className="pt-4 md:pt-6">
        <Reveal className="premium-surface rounded-(--radius-image) p-7 md:p-10" data-spotlight>
          <div className="grid gap-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <p className="section-kicker">Assistente do Orkiestri</p>
              <h2 className="mt-4 font-display text-[1.875rem] font-bold leading-[1.1] tracking-[-0.03em] text-chalk [font-stretch:108%] md:text-[2.25rem]">
                Aurélia
              </h2>
              <p className="mt-5 max-w-[48ch] text-[1.0625rem] leading-[1.65] text-chalk-dim">
                Eu não sou um aplicativo novo para você instalar. Sou uma
                conversa no WhatsApp que já está no seu celular, e tudo o que
                você me manda aparece organizado no site quando você quiser a
                visão da semana inteira.
              </p>
              <p className="mt-4 max-w-[48ch] text-[1.0625rem] leading-[1.65] text-chalk-dim">
                Trabalho em português, a qualquer hora, e respeito o que a sua
                conta pode ver. Se um módulo não é seu, ele não aparece quando
                você me pergunta — nem no menu, nem escrevendo.
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-7 self-start">
              {[
                { t: "Onde eu atendo", d: "WhatsApp, na conversa oficial do Orkiestri" },
                { t: "Horário", d: "Qualquer hora, todo dia" },
                { t: "Como você me fala", d: "Texto, áudio de até 30s, foto ou PDF" },
                { t: "Com o que eu trabalho", d: "Agenda, gastos, anotações, tarefas, projetos, chamados e conhecimento" },
              ].map((i) => (
                <div key={i.t}>
                  <dt className="text-xs uppercase tracking-[0.12em] text-chalk-faint">
                    {i.t}
                  </dt>
                  <dd className="mt-2 text-[0.9375rem] leading-[1.5] text-chalk">
                    {i.d}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
      </Section>

      {/* ── O que eu faço ───────────────────────────────────────────────── */}
      <Section muted>
        <SectionHeader
          title="O que eu faço."
          description="Seis coisas, nas minhas palavras. Cada uma corresponde a um pedido que você pode mandar hoje."
        />
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {oQueFaco.map((i) => (
            <div
              key={i.titulo}
              className="premium-surface flex flex-col gap-3 rounded-(--radius-card) p-6"
              data-spotlight
            >
              <h3 className="text-[1.0625rem] font-semibold leading-snug text-chalk">
                {i.titulo}
              </h3>
              <p className="text-sm leading-relaxed text-chalk-dim">{i.texto}</p>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <Link
            href="/o-que-pedir"
            className="inline-flex text-[0.9375rem] font-semibold text-flame-soft underline decoration-flame/40 decoration-1 underline-offset-[6px] transition-colors duration-200 hover:text-ember hover:decoration-ember/70"
          >
            Ver tudo o que dá para me pedir
          </Link>
        </div>
      </Section>

      {/* ── O que eu NÃO faço ───────────────────────────────────────────
          A seção mais importante da página. Ver o comentário do topo. */}
      <Section>
        <SectionHeader
          title="O que eu não faço."
          description="Dito antes de você precisar. Se um dia alguma dessas coisas passar a existir, ela sai daqui — e só então entra no catálogo."
        />
        <div className="mt-12 grid gap-px overflow-hidden rounded-(--radius-card) border border-white/[0.09] bg-white/[0.06] md:grid-cols-2 lg:grid-cols-3">
          {oQueNaoFaco.map((i) => (
            <div key={i.titulo} className="flex flex-col gap-3 bg-ink p-6">
              <X className="text-chalk-faint" size={20} aria-hidden />
              <h3 className="text-[1.0625rem] font-semibold leading-snug text-chalk">
                {i.titulo}
              </h3>
              <p className="text-sm leading-relaxed text-chalk-dim">{i.texto}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 max-w-[62ch] text-sm leading-relaxed text-chalk-faint">
          Quer entender onde os seus dados ficam e quem enxerga o quê?{" "}
          <Link href="/seguranca" className="text-flame-soft underline decoration-flame/40 underline-offset-4">
            A página de segurança explica.
          </Link>
        </p>
      </Section>

      {/* ── Como falar comigo + captura real ───────────────────────────── */}
      <Section muted>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:gap-20">
          <div>
            <h2 className="font-display text-[1.875rem] font-bold leading-[1.1] tracking-[-0.03em] text-chalk [font-stretch:108%] md:text-[2.5rem]">
              Como falar comigo.
            </h2>
            <p className="mt-5 max-w-[50ch] text-[1.0625rem] leading-[1.65] text-chalk-dim">
              Quatro jeitos, e nenhum deles pede que você aprenda nada. O da
              direita é um print de verdade de uma conversa de teste.
            </p>
            <div className="mt-10 flex flex-col gap-6">
              {comoFalar.map((c) => (
                <div key={c.titulo} className="flex items-start gap-4">
                  <c.icon
                    className="mt-0.5 shrink-0 text-flame-soft"
                    size={20}
                    aria-hidden
                  />
                  <div>
                    <h3 className="text-base font-semibold text-chalk">
                      {c.titulo}
                    </h3>
                    <p className="mt-1.5 max-w-[44ch] text-sm leading-relaxed text-chalk-dim">
                      {c.texto}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <AureliaCapture index={0} />
        </div>
      </Section>

      {/* ── Onde eu trabalho ────────────────────────────────────────────── */}
      <Section>
        <SectionHeader
          title="Onde eu trabalho."
          description="As mesas que eu atendo pela conversa. Cada uma corresponde a uma aplicação do sistema, e você só enxerga as que a sua conta tem."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MESAS.filter((m) => m.id !== "conta").map((m) => (
            <Link
              key={m.id}
              href={m.href}
              className="premium-surface group flex flex-col gap-3 rounded-(--radius-card) p-6 transition-transform hover:-translate-y-1 motion-reduce:hover:translate-y-0"
              data-spotlight
            >
              <m.icon className="text-flame-soft" size={24} aria-hidden />
              <p className="section-kicker mt-2">{m.modulo}</p>
              <h3 className="text-lg font-semibold leading-tight text-chalk">
                {m.titulo}
              </h3>
              <p className="text-sm leading-relaxed text-chalk-dim">
                {m.pedidos.length} pedidos que eu entendo nesta mesa.
              </p>
            </Link>
          ))}
        </div>
      </Section>

      <CTA
        title="Me manda a primeira mensagem."
        text={`Eu guio o seu cadastro pelo WhatsApp, uma pergunta por vez. São ${PLANO.testeDias} dias de teste, sem cartão.`}
        acaoLabel="Falar com a Aurélia"
      />
    </>
  );
}
