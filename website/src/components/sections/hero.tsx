"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { DashboardPreview } from "./dashboard-preview";
import { EASE_OUT } from "@/lib/motion";

const indicators = ["99.9% Uptime", "Cloud Native", "AI Ready", "API First"];

export function Hero() {
  const reduce = useReducedMotion();

  const item = (i: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.4,
      ease: EASE_OUT,
      delay: 0.05 + i * 0.06,
    },
  });

  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28">
      {/* Soft background accent (doc 06 — gradientes suaves) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(249,115,22,0.05),transparent_55%)]" />
      </div>

      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          {/* Left */}
          <div className="flex flex-col items-start">
            <motion.span {...item(0)}>
              <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-600 shadow-soft">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                Conheça o Orkiestri One
              </span>
            </motion.span>

            <motion.h1
              {...item(1)}
              className="mt-6 text-[2.75rem] font-bold leading-[1.05] tracking-tight text-dark sm:text-[3.5rem] lg:text-[4.25rem]"
            >
              Technology that <span className="text-gradient-primary">organizes businesses</span>.
            </motion.h1>

            <motion.p
              {...item(2)}
              className="mt-6 max-w-xl text-lg leading-relaxed text-gray-600"
            >
              Desenvolvemos plataformas empresariais, soluções em Inteligência
              Artificial e softwares sob medida para empresas que desejam crescer
              com eficiência, inovação e segurança.
            </motion.p>

            <motion.div {...item(3)} className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/products/orkiestri-one">
                  Conhecer o Orkiestri One
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/demo">Solicitar demonstração</Link>
              </Button>
            </motion.div>

            <motion.ul
              {...item(4)}
              className="mt-10 flex flex-wrap gap-x-6 gap-y-3"
            >
              {indicators.map((ind) => (
                <li
                  key={ind}
                  className="flex items-center gap-2 text-sm font-medium text-gray-500"
                >
                  <Check className="h-4 w-4 text-primary" aria-hidden />
                  {ind}
                </li>
              ))}
            </motion.ul>
          </div>

          {/* Right — dashboard */}
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.3 }}
          >
            <DashboardPreview />
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
