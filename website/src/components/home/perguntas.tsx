import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Faixa, LinkTexto } from "./ui";
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
      <div className="grid gap-9 md:grid-cols-[.7fr_1.3fr] lg:gap-20">
        <div>
          <p className="section-kicker">Tudo às claras</p>
          <h2 className="mt-4 font-display text-3xl font-semibold leading-tight text-chalk md:text-4xl">
            Antes de começar,
            <br />
            tire suas dúvidas.
          </h2>
          <p className="my-5 max-w-xs text-sm leading-relaxed text-chalk-dim">
            Como funciona o cadastro, o que entra no teste e o que acontece
            depois dele.
          </p>
          <LinkTexto href="/contact">Falar com um especialista</LinkTexto>
        </div>
        <div>
          <Accordion type="single" collapsible className="space-y-3">
            {items.map((item, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="rounded-2xl border border-white/[0.09] bg-panel/40 px-5 data-[state=open]:bg-panel"
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
      </div>
    </Faixa>
  );
}
