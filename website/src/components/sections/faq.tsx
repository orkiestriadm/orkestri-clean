import Link from "next/link";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Section, SectionHeader } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import type { FaqItem } from "@/types";

/** FAQ accordion section — reused (doc 07). */
export function FAQ({
  items,
  eyebrow = "FAQ",
  title = "Perguntas frequentes",
}: {
  items: FaqItem[];
  eyebrow?: string;
  title?: string;
}) {
  return (
    <Section muted>
      <SectionHeader eyebrow={eyebrow} title={title} />
      <div className="mx-auto mt-12 max-w-3xl rounded-(--radius-card) border border-gray-200 bg-white px-6 md:px-8">
        <Accordion type="single" collapsible>
          {items.map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent>{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
      <div className="mt-10 flex justify-center">
        <Button asChild variant="secondary">
          <Link href="/contact">Ainda tem dúvidas? Fale conosco</Link>
        </Button>
      </div>
    </Section>
  );
}
