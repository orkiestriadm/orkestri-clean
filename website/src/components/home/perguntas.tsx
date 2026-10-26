import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Faixa, Cabecalho, LinkTexto } from "./ui";
import type { FaqItem } from "@/types";

/**
 * FAQ da home, no escuro.
 *
 * Reaproveita o Accordion compartilhado — a mecânica (um aberto por vez,
 * teclado, aria) já está resolvida lá e não vale duplicar. O componente
 * nasceu com cores claras fixas, então cada parte recebe a sua classe de
 * escuro por `className`; o `cn` resolve o conflito a favor da última.
 */
export function Perguntas({ items }: { items: FaqItem[] }) {
  return (
    <Faixa id="duvidas" tom="raise">
      <Cabecalho
        titulo="Perguntas frequentes"
        texto="O que mais perguntam antes de começar."
        acao={<LinkTexto href="/contact">Falar com um especialista</LinkTexto>}
      />

      <div className="mt-12 max-w-3xl">
        <Accordion type="single" collapsible>
          {items.map((item, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="border-white/[0.09]"
            >
              <AccordionTrigger className="text-chalk hover:text-flame-soft">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-chalk-dim">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Faixa>
  );
}
