"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";
import { Container } from "@/components/ui/container";
import { stats } from "@/config/content";

/** Stats band — counters animate once on view (doc 04 / 08). */
export function Stats() {
  return (
    <section className="border-y border-gray-100 bg-gray-50 py-16">
      <Container>
        <dl className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center text-center">
              <dt className="sr-only">{s.label}</dt>
              <dd className="text-[2.5rem] font-bold tracking-tight text-dark md:text-[3rem]">
                <Counter value={s.value} suffix={s.suffix} />
              </dd>
              <p className="mt-1 text-sm font-medium text-gray-500">{s.label}</p>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}

function Counter({ value, suffix }: { value: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const numeric = parseFloat(value.replace(",", "."));
  const isNumber = !Number.isNaN(numeric);
  const decimals = value.includes(",") ? 1 : 0;
  const [display, setDisplay] = useState(isNumber && !reduce ? "0" : value);

  useEffect(() => {
    if (!inView || !isNumber || reduce) {
      setDisplay(value);
      return;
    }
    const duration = 1200;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const current = numeric * eased;
      setDisplay(
        current.toLocaleString("pt-BR", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      );
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, isNumber, numeric, decimals, reduce, value]);

  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  );
}
