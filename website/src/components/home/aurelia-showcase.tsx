"use client";

import { useState } from "react";
import { Container } from "@/components/ui/container";
import { aureliaCaptures } from "@/config/aurelia-captures";
import { AureliaCapture } from "./aurelia-capture";

export function AureliaGallery({ id, kicker, title, description }: {
  id: string; kicker: string; title: string; description: string;
}) {
  const [active, setActive] = useState(0);
  return (
    <section id={id} className="relative scroll-mt-24 overflow-hidden bg-ink-raise py-16 md:py-24">
      <Container>
        <div className="grid items-center gap-10 md:grid-cols-2 lg:gap-16">
          <div>
            <p className="section-kicker">{kicker}</p>
            <h2 className="mt-4 max-w-xl font-display text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-[1.08] tracking-[-.035em] text-chalk">{title}</h2>
            <p className="mt-5 max-w-lg leading-relaxed text-chalk-dim">{description}</p>
            <div className="mt-8 flex flex-col gap-3" role="group" aria-label="Etapas da conversa">
              {aureliaCaptures.map((item, index) => {
                const isSelected = active === index;
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={isSelected}
                    aria-controls={id + "-capture"}
                    onClick={() => setActive(index)}
                    className={
                      "flex flex-col gap-1.5 rounded-2xl border px-5 py-4 text-left transition-colors " +
                      (isSelected
                        ? "border-flame/50 bg-flame/[0.08] text-chalk"
                        : "border-white/10 bg-panel text-chalk-dim hover:border-white/25")
                    }
                  >
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-sm text-flame-soft">0{index + 1}</span>
                      <span className="font-semibold">{item.label}</span>
                    </span>
                    {isSelected && (
                      <span className="pl-7 text-sm leading-relaxed text-chalk-dim">
                        {item.description}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div id={id + "-capture"} className="min-w-0 flex flex-col items-center justify-center" aria-live="polite" aria-atomic="true">
            <AureliaCapture index={active} />
          </div>
        </div>
      </Container>
    </section>
  );
}

export function AureliaShowcase() {
  return <AureliaGallery id="aurelia" kicker="Veja a Aurélia em ação" title="A conversa é de verdade. A organização também."
    description="Acompanhe a demonstração no WhatsApp: do menu ao compromisso salvo, até a chegada do lembrete automático." />;
}
