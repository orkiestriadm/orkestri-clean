"use client";

import { useState } from "react";
import { Container } from "@/components/ui/container";
import { aureliaCaptures } from "@/config/aurelia-captures";
import { AureliaCapture } from "./aurelia-capture";

export function AureliaGallery({ id, kicker, title, description }: {
  id: string; kicker: string; title: string; description: string;
}) {
  const [active, setActive] = useState(0);
  const capture = aureliaCaptures[active];
  return (
    <section id={id} className="relative scroll-mt-24 overflow-hidden bg-ink-raise py-16 md:py-24">
      <Container>
        <div className="grid items-center gap-10 md:grid-cols-2 lg:gap-20">
          <div>
            <p className="section-kicker">{kicker}</p>
            <h2 className="mt-4 max-w-xl font-display text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-[1.08] tracking-[-.035em] text-chalk">{title}</h2>
            <p className="mt-5 max-w-lg leading-relaxed text-chalk-dim">{description}</p>
            <div className="mt-8 flex flex-col gap-3" role="group" aria-label="Etapas reais da conversa">
              {aureliaCaptures.map((item, index) => (
                <button key={item.key} type="button" aria-pressed={active === index} aria-controls={id + "-capture"}
                  onClick={() => setActive(index)}
                  className={"flex min-h-16 items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-colors " + (active === index ? "border-flame/50 bg-flame/[0.07] text-chalk" : "border-white/10 bg-panel text-chalk-dim hover:border-white/25")}>
                  <span className="font-mono text-sm text-flame-soft">0{index + 1}</span>
                  <span className="font-semibold">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div id={id + "-capture"} className="min-w-0 rounded-[28px] border border-white/10 bg-ink p-5 sm:p-8" aria-live="polite" aria-atomic="true">
            <h3 className="mb-3 text-lg font-semibold text-chalk">{capture.title}</h3>
            <p className="mb-7 text-sm leading-relaxed text-chalk-dim">{capture.description}</p>
            <AureliaCapture index={active} />
          </div>
        </div>
      </Container>
    </section>
  );
}

export function AureliaShowcase() {
  return <AureliaGallery id="aurelia" kicker="Veja a Aurélia em ação" title="A conversa é de verdade. A organização também."
    description="Explore prints reais do WhatsApp: do menu ao compromisso salvo, até a chegada do lembrete automático." />;
}
