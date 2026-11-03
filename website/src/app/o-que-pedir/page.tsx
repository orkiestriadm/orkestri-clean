import Link from "next/link";
import { Mic, Paperclip, ListOrdered } from "lucide-react";
import { PageHero } from "@/components/sections/page-hero";
import { Section, SectionHeader } from "@/components/ui/section";
import { CTA } from "@/components/sections/cta";
import { DemoConversa } from "@/components/aurelia/demo-conversa";
import { ParedePedidos } from "@/components/aurelia/parede-pedidos";
import { TOTAL_PEDIDOS } from "@/config/aurelia";
import { PLANO } from "@/config/plano";
import { buildMetadata } from "@/lib/seo";

/**
 * O que dá para pedir.
 *
 * O site tinha oito comandos escritos em caixa de código, o que ensina a
 * coisa errada: parece que existe uma sintaxe. Esta página mostra a frase
 * solta, em quantidade, porque é a quantidade que prova que não há comando
 * para decorar.
 *
 * Todo pedido publicado aqui sai de `config/aurelia.ts`, onde está anotado
 * qual parser do backend o interpreta. Antes de acrescentar uma frase, abra o
 * parser: publicar um pedido que a Aurélia não entende faz a pessoa tentar,
 * falhar e parar de tentar.
 */

export const metadata = buildMetadata({
  title: "O que pedir",
  description: `${TOTAL_PEDIDOS} pedidos que a Aurélia entende, escritos do jeito que a frase sai. Toque num deles e veja a resposta.`,
  path: "/o-que-pedir",
  keywords: [
    "comandos Aurélia",
    "o que pedir no WhatsApp",
    "Orkiestri WhatsApp",
  ],
});

const outrosJeitos = [
  {
    icon: Mic,
    titulo: "Áudio de até 30 segundos",
    texto:
      "Mande falando. A Aurélia transcreve e trata igual ao texto — vale para qualquer pedido desta página.",
  },
  {
    icon: Paperclip,
    titulo: "Foto ou PDF de até 5 MB",
    texto:
      "JPEG, PNG, WebP ou PDF. O arquivo fica anexado ao registro e você encontra depois pelo site.",
  },
  {
    icon: ListOrdered,
    titulo: "O menu numerado",
    texto:
      "Mande “menu” e escolha pelo número. Ela pergunta um campo por vez, e “voltar” existe em toda etapa.",
  },
];

export default function OQuePedirPage() {
  return (
    <>
      <PageHero
        eyebrow="O que pedir"
        title="Você escreve. Ela entende."
        description={`Não existe comando para decorar. Estes são ${TOTAL_PEDIDOS} pedidos que a Aurélia entende hoje, escritos do jeito que a frase sai da sua cabeça — por texto, por áudio ou pelo menu.`}
        breadcrumb={[{ label: "O que pedir", href: "/o-que-pedir" }]}
      />

      {/* ── Experimente ────────────────────────────────────────────────── */}
      <Section className="pt-4 md:pt-6">
        <DemoConversa />
      </Section>

      {/* ── A parede ───────────────────────────────────────────────────── */}
      <Section muted>
        <SectionHeader
          title="A parede de pedidos."
          description="Agrupados pelo assunto que cuida deles. Você vê apenas as mesas liberadas para a sua conta — o resto nem aparece quando você pergunta."
        />
        <div className="mt-12">
          <ParedePedidos />
        </div>
      </Section>

      {/* ── Outros jeitos ──────────────────────────────────────────────── */}
      <Section>
        <SectionHeader
          title="Nem sempre dá para escrever."
          description="Os mesmos pedidos funcionam por áudio, por arquivo e pelo menu numerado."
        />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {outrosJeitos.map((o) => (
            <div
              key={o.titulo}
              className="premium-surface flex flex-col gap-3 rounded-(--radius-card) p-6"
              data-spotlight
            >
              <o.icon className="text-flame-soft" size={24} aria-hidden />
              <h3 className="mt-2 text-lg font-semibold leading-tight text-chalk">
                {o.titulo}
              </h3>
              <p className="text-sm leading-relaxed text-chalk-dim">{o.texto}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 max-w-[62ch] text-sm leading-relaxed text-chalk-faint">
          Quer saber quem é a Aurélia e onde ela para?{" "}
          <Link
            href="/aurelia"
            className="text-flame-soft underline decoration-flame/40 underline-offset-4"
          >
            Ela conta na página dela.
          </Link>
        </p>
      </Section>

      <CTA
        title="Mande o seu primeiro pedido."
        text={`O cadastro é na mesma conversa, com a Aurélia guiando. ${PLANO.testeDias} dias de teste, sem cartão.`}
        acaoLabel={`Começar o teste de ${PLANO.testeDias} dias`}
      />
    </>
  );
}
