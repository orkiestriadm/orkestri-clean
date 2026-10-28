import Script from "next/script";
import { Hero } from "@/components/sections/hero";
import { Plataforma } from "@/components/home/plataforma";
import { AureliaShowcase } from "@/components/home/aurelia-showcase";
import { AgendaSpotlight } from "@/components/home/agenda-spotlight";
import { AureliaDemo } from "@/components/home/aurelia-demo";
import { Perguntas } from "@/components/home/perguntas";
import { Fechamento } from "@/components/home/fechamento";
import { homeFaq } from "@/config/content";
import { buildMetadata, softwareApplicationSchema } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/",
  keywords: [
    "organizar agenda pelo whatsapp",
    "lembrete de compromisso no whatsapp",
    "controle de gastos por mensagem",
    "contas a pagar whatsapp",
    "anotações e tarefas",
    "Orkiestri",
  ],
});

/**
 * Home: teste da agenda → demonstração → benefícios → outros módulos → dúvidas.
 *
 * A página tinha catorze seções e quase 12.000px de altura; a maior parte
 * repetia o mesmo argumento em formatos diferentes, e três blocos inteiros
 * (números, depoimentos e logos de clientes) eram conteúdo inventado. Agora
 * A demonstração da Aurélia precede os demais módulos para explicar o teste.
 *
 * Serviços e tecnologias têm páginas próprias, acessíveis pelo menu.
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
      <AureliaShowcase />
      <AgendaSpotlight />
      <Plataforma />
      <AureliaDemo />
      <Perguntas items={homeFaq} />
      <Fechamento />
    </>
  );
}
