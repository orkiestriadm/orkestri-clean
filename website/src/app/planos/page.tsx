import Link from "next/link";
import { Check, CreditCard, QrCode, MessageCircle } from "lucide-react";
import { PageHero } from "@/components/sections/page-hero";
import { Section, SectionHeader } from "@/components/ui/section";
import { CTA } from "@/components/sections/cta";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { Reveal } from "@/components/animations/reveal";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { products } from "@/config/products";
import { PLANO } from "@/config/plano";
import { siteConfig } from "@/config/site";
import { buildMetadata } from "@/lib/seo";

/**
 * Página de planos.
 *
 * Existe porque até 03/11/2026 o site não dizia em lugar nenhum quanto o
 * produto custa — o visitante só descobria a mensalidade na conversa com a
 * Aurélia, no sétimo dia, depois de já ter cadastrado CPF e e-mail. Descobrir
 * o preço depois do cadastro é o jeito mais rápido de perder a confiança
 * exatamente no momento de pagar.
 *
 * Três regras ao mexer nesta página:
 *
 *   1. **O número sai de `config/plano.ts`**, que espelha o backend. Preço
 *      escrito à mão no meio do parágrafo é o que envelhece primeiro.
 *   2. **A lista de aplicações sai de `config/products.ts`**, pela mesma regra
 *      do catálogo: só entra no site o que existe no sistema.
 *   3. **Nada de "usuários ilimitados" nem de comparação de planos.** A
 *      cobrança é por conta e existe um plano só; inventar uma tabela de
 *      pacotes seria vender uma escolha que o produto não oferece.
 */

export const metadata = buildMetadata({
  title: "Planos",
  description: `Um plano só: ${PLANO.precoLabel} por mês, com as seis aplicações liberadas. Comece por ${PLANO.testeDias} dias de teste, sem cartão.`,
  path: "/planos",
  keywords: [
    "preço Orkiestri",
    "quanto custa Orkiestri",
    "plano Orkiestri",
    "teste grátis",
  ],
});

/** O que entra no plano. Cada linha corresponde a algo que o sistema faz. */
const incluso = [
  "As seis aplicações, liberadas desde o primeiro dia",
  "A Aurélia no WhatsApp, para marcar, anotar e consultar",
  "Lembrete antes da hora: uma hora antes, aos quinze, aos cinco e na hora",
  "Agenda no site e no WhatsApp, sincronizada com o Outlook",
  "Gastos e compras parceladas, com resumo semanal no WhatsApp",
  "Projetos, tarefas, chamados e base de conhecimento",
  "Pagamento no cartão, que renova sozinho, ou no Pix, mês a mês",
  "Cancelamento quando quiser, pela mesma conversa",
];

/**
 * Do cadastro à primeira cobrança.
 *
 * É uma sequência de verdade — os marcos de aviso estão em
 * `trial-renovacao.ts` (`MARCOS_AVISO = [3, 1, 0]`) —, então a numeração aqui
 * é informação, e não enfeite.
 */
const etapas = [
  {
    marco: "Hoje",
    titulo: "Você se cadastra pela conversa.",
    texto:
      "A Aurélia pergunta nome, CPF, e-mail e o nome da organização, uma informação por vez. Se você não tem empresa, usa o seu próprio nome. Não pedimos cartão para começar.",
  },
  {
    marco: `Dias 1 a ${PLANO.testeDias}`,
    titulo: "O teste roda inteiro, sem parte bloqueada.",
    texto:
      "Nenhuma aplicação fica de fora durante o teste. O que você registrar nesses dias continua lá depois — o teste não é uma conta separada que some no fim.",
  },
  {
    marco: "Dias 4, 6 e 7",
    titulo: "A Aurélia avisa antes de acabar.",
    texto:
      "Três avisos na conversa: faltando três dias, faltando um e no próprio dia. Responder 1 continua; responder 2 encerra, e nenhuma cobrança é gerada.",
  },
  {
    marco: `Dia ${PLANO.testeDias}`,
    titulo: `Continuando, a mensalidade é de ${PLANO.precoLabel}.`,
    texto:
      "Chegam as duas formas de pagar: o link do cartão, que renova sozinho todo mês, e o Pix, para quem prefere decidir mês a mês. O acesso segue assim que o pagamento é confirmado.",
  },
];

const formas = [
  {
    icon: CreditCard,
    titulo: "Cartão",
    texto:
      "Renova sozinho no Mercado Pago. A Aurélia não volta a cobrar nada — você só ouve falar dela se a cobrança falhar.",
  },
  {
    icon: QrCode,
    titulo: "Pix",
    texto:
      "Um mês por vez. O código vale três dias e a Aurélia manda o próximo quando chegar a hora.",
  },
  {
    icon: MessageCircle,
    titulo: "Pela conversa",
    texto:
      "Cobrança, troca de forma de pagamento e cancelamento acontecem no mesmo WhatsApp em que você usa o produto.",
  },
];

const perguntas = [
  {
    q: "Preciso de cartão para começar?",
    a: `Não. O cadastro pela conversa cria o acesso de ${PLANO.testeDias} dias sem pedir cartão nenhum. A cobrança só aparece quando o teste chega ao fim, e só se você responder que quer continuar.`,
  },
  {
    q: "O que acontece quando os sete dias acabam?",
    a: `A Aurélia avisa três vezes antes: faltando três dias, faltando um e no dia. Se você responder 1, ela manda a cobrança de ${PLANO.precoLabel}. Se responder 2, ou simplesmente não responder, nada é cobrado e o acesso para no vencimento.`,
  },
  {
    q: "E se eu deixar vencer e quiser voltar depois?",
    a: `O login bloqueia no dia do vencimento, mas o que você registrou continua guardado por mais ${PLANO.retomadaDias} dias. Dentro desse prazo, é só pagar na mesma conversa e o acesso volta como estava.`,
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Pode, e sem formulário. No Pix, basta não pagar o mês seguinte. No cartão, peça o cancelamento na conversa e a renovação automática é desligada — o acesso fica até o fim do mês já pago.",
  },
  {
    q: "Existe plano por módulo, ou algum recurso que custa à parte?",
    a: "Não. Existe um plano só, e ele vem com as seis aplicações. Você liga na sua tela as que usa e as outras não atrapalham, mas nenhuma delas é cobrada separadamente.",
  },
  {
    q: "O preço sobe depois do primeiro mês?",
    a: `Não existe preço de entrada aqui: ${PLANO.precoLabel} é o valor do primeiro mês e dos seguintes. Se um dia o valor mudar, você fica sabendo antes, na conversa, e decide com a cobrança na mão.`,
  },
  {
    q: "Quero colocar mais gente na mesma conta. Como fica?",
    a: "A mensalidade é por conta. Para uma equipe ou uma família na mesma organização, fale com a gente antes de cadastrar cada um por fora — assim combinamos o formato certo.",
  },
  {
    q: "Serve se eu não tenho empresa?",
    a: "Serve. O cadastro pede o nome de uma organização porque o sistema guarda tudo dentro de uma, mas pode ser o seu próprio nome. A agenda, as contas e as anotações funcionam igual.",
  },
  {
    q: "Preciso instalar alguma coisa?",
    a: "Não. Você usa pelo WhatsApp que já está no seu celular, e o site abre no navegador quando quiser a visão completa da semana ou do mês.",
  },
];

/**
 * JSON-LD com o preço.
 *
 * `softwareApplicationSchema` em `lib/seo.ts` declara a oferta sem valor,
 * porque até agora o site não tinha preço publicado. Aqui a oferta sai
 * completa, que é o que permite ao buscador mostrar o valor no resultado.
 */
const schema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Orkiestri One",
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Web, WhatsApp",
  publisher: { "@type": "Organization", name: siteConfig.name },
  offers: {
    "@type": "Offer",
    price: PLANO.precoNumero,
    priceCurrency: "BRL",
    url: `${siteConfig.url}/planos`,
    availability: "https://schema.org/InStock",
  },
};

export default function PlanosPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <PageHero
        eyebrow="Planos"
        title={`Um plano. ${PLANO.precoLabel} por mês.`}
        description={`Comece por ${PLANO.testeDias} dias de teste, sem cartão. Depois é ${PLANO.precoLabel} por mês, com as seis aplicações liberadas — não existe plano por módulo nem recurso cobrado à parte.`}
        breadcrumb={[{ label: "Planos", href: "/planos" }]}
      />

      {/* ── O card ────────────────────────────────────────────────────────
          Um card só, sem coluna de comparação ao lado. Tabela de três planos
          existe para empurrar o do meio; aqui não há do meio. */}
      <Section className="pt-4 md:pt-6">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
          <Reveal className="premium-surface rounded-(--radius-image) p-7 md:p-10" data-spotlight>
            <p className="section-kicker">Orkiestri completo</p>

            <div className="mt-6 flex flex-wrap items-end gap-x-3 gap-y-1">
              <span className="font-display text-[3.25rem] font-bold leading-none tracking-[-0.04em] text-chalk [font-stretch:108%] md:text-[4rem]">
                {PLANO.precoLabel}
              </span>
              <span className="pb-2 text-[1.0625rem] text-chalk-dim">
                por mês
              </span>
            </div>

            <p className="mt-4 text-[1.0625rem] leading-[1.6] text-chalk-dim">
              Os {PLANO.testeDias} primeiros dias são de teste e não são
              cobrados. A primeira cobrança só existe se você disser que quer
              continuar.
            </p>

            <ul className="mt-8 flex flex-col gap-3.5">
              {incluso.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check
                    className="mt-1 shrink-0 text-flame-soft"
                    size={18}
                    aria-hidden
                  />
                  <span className="text-[0.9375rem] leading-[1.55] text-chalk">
                    {item}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-9 flex flex-col items-start gap-3">
              <WhatsAppButton>
                Começar o teste de {PLANO.testeDias} dias
              </WhatsAppButton>
              <p className="text-sm leading-relaxed text-chalk-faint">
                Sem cartão para começar. A Aurélia faz o cadastro pelo
                WhatsApp, uma pergunta por vez.
              </p>
            </div>
          </Reveal>

          {/* ── A explicação ao lado do card ───────────────────────────────
              O card responde "quanto"; esta coluna responde "por que assim",
              que é a objeção real de quem está acostumado a escolher pacote. */}
          <div className="flex flex-col gap-10 lg:pt-4">
            <div>
              <h2 className="font-display text-[1.5rem] font-bold leading-[1.15] tracking-[-0.03em] text-chalk [font-stretch:108%] md:text-[1.875rem]">
                Por que um plano só.
              </h2>
              <p className="mt-4 max-w-[46ch] text-[1.0625rem] leading-[1.65] text-chalk-dim">
                Dividir o produto em pacotes obrigaria você a adivinhar, no
                primeiro dia, de que parte vai precisar no terceiro mês. Quem
                entra pela agenda costuma acabar usando as contas; quem entra
                pelas contas acaba abrindo o primeiro projeto. Por isso tudo
                vem junto, e você liga na sua tela só o que usa.
              </p>
            </div>

            <div className="flex flex-col gap-5">
              {formas.map((f) => (
                <div key={f.titulo} className="flex items-start gap-4">
                  <f.icon
                    className="mt-0.5 shrink-0 text-flame-soft"
                    size={20}
                    aria-hidden
                  />
                  <div>
                    <h3 className="text-base font-semibold text-chalk">
                      {f.titulo}
                    </h3>
                    <p className="mt-1.5 max-w-[42ch] text-sm leading-relaxed text-chalk-dim">
                      {f.texto}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── A linha do tempo da cobrança ───────────────────────────────── */}
      <Section muted>
        <SectionHeader
          title="Do cadastro à primeira cobrança."
          description={`O que acontece em cada dia dos ${PLANO.testeDias}, escrito antes de você começar. Nenhuma cobrança aparece sem aviso na conversa.`}
        />
        <ol className="mt-12 grid gap-px overflow-hidden rounded-(--radius-card) border border-white/[0.09] bg-white/[0.06] md:grid-cols-2 lg:grid-cols-4">
          {etapas.map((e, i) => (
            <li key={e.titulo} className="flex flex-col gap-3 bg-ink-raise p-6">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-xs text-flame-soft">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-xs uppercase tracking-[0.12em] text-chalk-faint">
                  {e.marco}
                </span>
              </div>
              <h3 className="text-[1.0625rem] font-semibold leading-snug text-chalk">
                {e.titulo}
              </h3>
              <p className="text-sm leading-relaxed text-chalk-dim">{e.texto}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 max-w-[62ch] text-sm leading-relaxed text-chalk-faint">
          Sem pagamento, o login bloqueia no dia do vencimento e o que você
          registrou fica guardado por mais {PLANO.retomadaDias} dias. Dentro
          desse prazo, pagar na conversa devolve o acesso como estava.
        </p>
      </Section>

      {/* ── O que vem no plano ──────────────────────────────────────────
          Lista tirada de `config/products.ts`, para não existir aqui uma
          segunda versão do catálogo que possa divergir do sistema. */}
      <Section>
        <SectionHeader
          title="As seis aplicações vêm juntas."
          description="Nenhuma delas é vendida à parte. Você ativa na sua conta as que usa, e as outras não aparecem na sua tela."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Link
              key={p.slug}
              href={`/products/${p.slug}`}
              className="premium-surface group flex flex-col gap-3 rounded-(--radius-card) p-6 transition-transform hover:-translate-y-1 motion-reduce:hover:translate-y-0"
              data-spotlight
            >
              <p.icon className="text-flame-soft" size={24} aria-hidden />
              <p className="section-kicker mt-2">{p.category}</p>
              <h3 className="text-lg font-semibold leading-tight text-chalk">
                {p.name}
              </h3>
              <p className="text-sm leading-relaxed text-chalk-dim">
                {p.tagline}
              </p>
            </Link>
          ))}
        </div>
      </Section>

      {/* ── Dúvidas de compra ───────────────────────────────────────────
          São objeções, não dúvidas técnicas: o que acontece com o meu
          dinheiro, o que acontece se eu parar, o que acontece se eu voltar. */}
      <Section muted>
        <div className="grid gap-9 md:grid-cols-[.7fr_1.3fr] lg:gap-20">
          <div>
            <h2 className="font-display text-3xl font-semibold leading-tight text-chalk md:text-4xl">
              Antes de pagar,
              <br />
              tire suas dúvidas.
            </h2>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-chalk-dim">
              O que entra no teste, o que acontece quando ele acaba e como
              parar, se você decidir parar.
            </p>
          </div>
          <Accordion type="single" collapsible className="space-y-3">
            {perguntas.map((item, i) => (
              <AccordionItem
                key={i}
                value={`plano-${i}`}
                className="rounded-2xl border border-white/[0.09] bg-panel/40 px-5 data-[state=open]:bg-panel"
              >
                <AccordionTrigger className="text-chalk hover:text-flame-soft">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-chalk-dim">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Section>

      <CTA
        title={`Comece pelos ${PLANO.testeDias} dias de teste.`}
        text={`A Aurélia guia seu cadastro pelo WhatsApp. Depois do teste, ${PLANO.precoLabel} por mês, com tudo liberado.`}
        acaoLabel={`Começar o teste de ${PLANO.testeDias} dias`}
      />
    </>
  );
}
