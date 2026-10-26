import Script from "next/script";
import { Hero } from "@/components/sections/hero";
import { Plataforma } from "@/components/home/plataforma";
import { Aurelia } from "@/components/home/aurelia";
import { Engenharia } from "@/components/home/engenharia";
import { Tecnologias } from "@/components/home/tecnologias";
import { Perguntas } from "@/components/home/perguntas";
import { Fechamento } from "@/components/home/fechamento";
import { homeFaq } from "@/config/content";
import { buildMetadata, softwareApplicationSchema } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/",
  keywords: [
    "software empresarial",
    "plataforma empresarial",
    "business operating system",
    "software sob medida",
    "inteligência artificial",
    "Orkiestri One",
  ],
});

/**
 * Home — única página escura do site (26/10/2026).
 *
 * A página tinha catorze seções e quase 12.000px de altura; a maior parte
 * repetia o mesmo argumento em formatos diferentes, e três blocos inteiros
 * (números, depoimentos e logos de clientes) eram conteúdo inventado. Agora
 * são sete seções, nesta ordem, cada uma com um trabalho só:
 *
 *   1. Hero ......... o que é, e a porta de entrada
 *   2. Plataforma ... as doze aplicações e o que compartilham
 *   3. WhatsApp ..... o que o sistema faz por mensagem
 *   4. Engenharia ... quem constrói, e como
 *   5. Tecnologias .. com o quê
 *   6. Perguntas .... as objeções
 *   7. Fechamento ... a mesma porta, de novo
 *
 * O cadastro acontece pelo WhatsApp e SÓ por lá. Se algum dia voltar um
 * segundo caminho de cadastro à página, ele tira força deste — foi o que
 * aconteceu com os três botões que o hero tinha.
 */
export default function HomePage() {
  return (
    <>
      <Script
        id="software-app-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationSchema()),
        }}
      />

      <Hero />
      <Plataforma />
      <Aurelia />
      <Engenharia />
      <Tecnologias />
      <Perguntas items={homeFaq} />
      <Fechamento />
    </>
  );
}
