import Link from "next/link";
import { KeyRound, Building2, Eye, ScrollText } from "lucide-react";
import { PageHero } from "@/components/sections/page-hero";
import { Section, SectionHeader } from "@/components/ui/section";
import { CTA } from "@/components/sections/cta";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { PLANO } from "@/config/plano";
import { buildMetadata } from "@/lib/seo";

/**
 * Página de segurança.
 *
 * Até 03/11/2026 a palavra LGPD aparecia uma vez no site, como um marcador
 * técnico em `/technology`. Quem vai entregar a agenda e os gastos a uma
 * assistente de IA no WhatsApp não encontrava nada que respondesse "e os meus
 * dados?".
 *
 * 🔴 **O que NÃO pode entrar nesta página**, por mais que o concorrente use:
 *
 *   - "WhatsApp Business API oficial" e o selo da Meta. A nossa integração é
 *     pela Evolution API. O selo não é nosso para exibir.
 *   - "Open Finance" e conexão bancária somente leitura. Não existe conexão
 *     com banco aqui: gasto é o que a pessoa conta.
 *   - "Criptografia de ponta a ponta" como se a mensagem fosse ilegível para
 *     nós. Ela é cifrada entre o celular e o WhatsApp; chegando à conversa do
 *     Orkiestri, o sistema lê o que a pessoa escreveu — é assim que ele
 *     responde. Dizer o contrário seria mentira, e é exatamente o tipo de
 *     frase que destrói a confiança quando alguém descobre.
 *
 * Cada afirmação daqui foi conferida no código: bcrypt em `auth.service.ts`,
 * TOTP em `twofa.module.ts`, trilha em `modules/audit`, escopo por
 * organização em `modules/rbac` e nos módulos de gastos e projetos.
 */

export const metadata = buildMetadata({
  title: "Segurança",
  description:
    "Onde os seus dados ficam, quem enxerga o quê e o que a Aurélia nunca pede. Escrito sem promessa que o sistema não cumpre.",
  path: "/seguranca",
  keywords: ["segurança Orkiestri", "LGPD", "privacidade", "dados"],
});

const pilares = [
  {
    icon: KeyRound,
    titulo: "O acesso é seu, e só seu.",
    paragrafos: [
      "A sua senha nunca é guardada como você a escreveu: fica cifrada com bcrypt, um algoritmo feito para ser lento de propósito, o que torna inviável descobrir a senha a partir do que está salvo. Nem a nossa equipe consegue lê-la.",
      "Você pode ligar a verificação em duas etapas com um aplicativo autenticador — o mesmo TOTP do Google Authenticator ou do Authy. Depois disso, a senha sozinha não entra.",
      "Quem administra a organização define a política de senha que o resto da equipe precisa seguir: tamanho mínimo e exigências de composição.",
    ],
  },
  {
    icon: Building2,
    titulo: "Cada organização vive separada.",
    paragrafos: [
      "Todo registro do sistema carrega a organização a que pertence, e toda consulta é filtrada por ela. Não existe tela que mostre dado de duas organizações ao mesmo tempo, nem para quem administra a plataforma.",
      "Quando você se cadastra pelo WhatsApp sem ter empresa, a sua conta nasce numa organização própria, com o seu nome. Ela é sua e não se mistura com nenhuma outra.",
    ],
  },
  {
    icon: Eye,
    titulo: "Quem vê o quê é decidido antes.",
    paragrafos: [
      "O acesso é por papel: cada pessoa recebe as permissões do que ela precisa usar, e o que está fora delas não aparece. Isso vale para o site e vale para a conversa — o menu da Aurélia é montado a partir das suas permissões, então um módulo que não é seu não aparece nem se você perguntar por ele escrevendo.",
      "Os seus gastos pessoais são seus. Eles ficam presos ao seu usuário, e não ao da organização: ninguém da equipe vê o que você lançou como gasto pessoal, nem quem administra.",
      "As contas da empresa são outra coisa, e vivem atrás da permissão de quem cuida do financeiro.",
    ],
  },
  {
    icon: ScrollText,
    titulo: "O que acontece na conta fica registrado.",
    paragrafos: [
      "O sistema mantém uma trilha de auditoria do que foi feito, por quem e quando. Ela existe para que uma dúvida sobre um registro tenha resposta — e não a memória de alguém.",
      "O tráfego entre o seu navegador e o Orkiestri é cifrado por HTTPS, e o mesmo vale para o aplicativo.",
    ],
  },
];

/**
 * O que a conversa é, e o que ela não é.
 *
 * O ponto delicado da página. Ver o comentário do topo sobre criptografia.
 */
const conversa = [
  {
    titulo: "A Aurélia nunca pede a sua senha.",
    texto:
      "Nenhum trabalho dela depende disso. Ela também não pede código de banco, token nem número de cartão. Se alguém pedir qualquer uma dessas coisas em nome do Orkiestri, não somos nós — e vale nos avisar.",
  },
  {
    titulo: "Não existe conexão com o seu banco.",
    texto:
      "O Orkiestri não lê o seu extrato, não vê o seu saldo e não acessa a sua fatura. O que o sistema sabe dos seus gastos é o que você escreveu na conversa. Também não movimentamos valor nenhum: não pagamos conta, não transferimos e não fazemos Pix.",
  },
  {
    titulo: "Ela lê o que você manda para ela, e nada além.",
    texto:
      "Sendo honesto sobre o que a criptografia do WhatsApp faz: ela protege a mensagem no caminho entre o seu celular e a conversa, de modo que ninguém no meio consiga ler. Chegando à conversa do Orkiestri, o sistema lê o que você escreveu — é assim que ele entende o pedido e responde. O que ele não alcança são as suas outras conversas, os seus contatos e o resto do seu telefone.",
  },
  {
    titulo: "Vincular o WhatsApp é um ato seu.",
    texto:
      "Para ligar um número a uma conta que já existe, você gera um código dentro do seu Perfil e manda esse código na conversa. Sem ele, um número qualquer não vira acesso à sua conta.",
  },
];

const perguntas = [
  {
    q: "O Orkiestri pode movimentar o meu dinheiro?",
    a: "Não, e não é promessa: a capacidade não existe no sistema. Não há conexão bancária, não há pagamento e não há transferência. O financeiro do Orkiestri anota o que você contou e lembra do que vence. Pagar continua sendo você, dentro do seu banco.",
  },
  {
    q: "Vocês leem as minhas mensagens?",
    a: "O sistema processa a mensagem que você manda para a conversa do Orkiestri, porque é assim que ele entende o pedido e responde. Isso não alcança as suas outras conversas, os seus contatos nem qualquer coisa fora dessa conversa. A equipe acessa conteúdo de conta quando você pede suporte sobre um caso específico.",
  },
  {
    q: "Os meus gastos aparecem para a minha equipe?",
    a: "Não. O gasto pessoal fica preso ao seu usuário e não ao da organização — nem quem administra a conta enxerga. O que é da empresa vive no Orçamento, atrás da permissão de quem cuida dele.",
  },
  {
    q: "Como eu protejo melhor a minha conta?",
    a: "Ligue a verificação em duas etapas no seu Perfil, usando um aplicativo autenticador. A partir daí, saber a senha deixa de ser suficiente para entrar.",
  },
  {
    q: "Quem administra a organização vê tudo?",
    a: "Vê o que as permissões dela alcançam, que é bastante no que diz respeito à empresa — e não alcança o gasto pessoal de ninguém. Administrar a organização não dá acesso a dado de outra organização em nenhuma hipótese.",
  },
  {
    q: "E se eu perder o celular?",
    a: "A conversa com a Aurélia é uma conversa de WhatsApp: ela segue o seu número, e bloquear a linha com a operadora interrompe o acesso a ela. No site, troque a senha e, se tiver a verificação em duas etapas ligada, quem estiver com o aparelho ainda precisa do segundo fator.",
  },
  {
    q: "Posso apagar os meus dados?",
    a: "Pode. Fale com a gente pelo mesmo WhatsApp ou por contato@orkiestri.com e a exclusão é tratada conforme a LGPD. A política de privacidade descreve o tratamento, as bases legais e os seus direitos.",
  },
  {
    q: "Vocês são uma conta oficial verificada pela Meta?",
    a: "Não vamos dizer que sim só porque soa bem: a nossa integração com o WhatsApp é por API, sem o selo de verificação da Meta no perfil. Confira sempre que o número é o que aparece aqui no site antes de mandar qualquer informação.",
  },
];

export default function SegurancaPage() {
  return (
    <>
      <PageHero
        eyebrow="Segurança"
        title="Onde os seus dados ficam, e quem enxerga o quê."
        description="Esta página explica como cada proteção funciona, o que o sistema alcança e o que ele não alcança. Está escrita sem nenhuma promessa que o Orkiestri não cumpra hoje — inclusive onde seria mais confortável exagerar."
        breadcrumb={[{ label: "Segurança", href: "/seguranca" }]}
      />

      {/* ── Os pilares ─────────────────────────────────────────────────── */}
      <Section className="pt-4 md:pt-6">
        <div className="flex flex-col gap-4">
          {pilares.map((p) => (
            <article
              key={p.titulo}
              className="premium-surface rounded-(--radius-card) p-6 md:p-9"
              data-spotlight
            >
              <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14">
                <div className="flex flex-col gap-4">
                  <p.icon className="text-flame-soft" size={26} aria-hidden />
                  <h2 className="text-[1.25rem] font-semibold leading-snug text-chalk md:text-[1.5rem]">
                    {p.titulo}
                  </h2>
                </div>
                <div className="flex flex-col gap-4">
                  {p.paragrafos.map((t, i) => (
                    <p
                      key={i}
                      className="max-w-[62ch] text-[0.9375rem] leading-[1.7] text-chalk-dim"
                    >
                      {t}
                    </p>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* ── A conversa ─────────────────────────────────────────────────── */}
      <Section muted>
        <SectionHeader
          title="Sobre a conversa no WhatsApp."
          description="A parte em que é mais fácil exagerar, escrita do jeito que é."
        />
        <div className="mt-12 grid gap-px overflow-hidden rounded-(--radius-card) border border-white/[0.09] bg-white/[0.06] md:grid-cols-2">
          {conversa.map((c) => (
            <div key={c.titulo} className="flex flex-col gap-3 bg-ink-raise p-6 md:p-8">
              <h3 className="text-[1.0625rem] font-semibold leading-snug text-chalk">
                {c.titulo}
              </h3>
              <p className="text-sm leading-[1.7] text-chalk-dim">{c.texto}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 max-w-[62ch] text-sm leading-relaxed text-chalk-faint">
          A Aurélia também diz, na página dela,{" "}
          <Link
            href="/aurelia"
            className="text-flame-soft underline decoration-flame/40 underline-offset-4"
          >
            tudo o que ela não faz
          </Link>
          .
        </p>
      </Section>

      {/* ── Dúvidas ────────────────────────────────────────────────────── */}
      <Section>
        <div className="grid gap-9 md:grid-cols-[.7fr_1.3fr] lg:gap-20">
          <div>
            <h2 className="font-display text-3xl font-semibold leading-tight text-chalk md:text-4xl">
              O que perguntam
              <br />
              antes de confiar.
            </h2>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-chalk-dim">
              Se a sua pergunta não está aqui, mande pelo mesmo WhatsApp — ou
              leia a{" "}
              <Link
                href="/privacy"
                className="text-flame-soft underline decoration-flame/40 underline-offset-4"
              >
                política de privacidade
              </Link>
              .
            </p>
          </div>
          <Accordion type="single" collapsible className="space-y-3">
            {perguntas.map((item, i) => (
              <AccordionItem
                key={i}
                value={`seg-${i}`}
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
        title="Comece quando estiver confortável."
        text={`${PLANO.testeDias} dias de teste, sem cartão. A Aurélia guia o cadastro pelo WhatsApp e pede só nome, CPF, e-mail e o nome da organização.`}
        acaoLabel={`Começar o teste de ${PLANO.testeDias} dias`}
      />
    </>
  );
}
