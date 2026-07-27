"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { HeroVideo } from "./hero-video";
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
    /* No desktop a seção ocupa a altura útil da janela (descontado o cabeçalho
       fixo) e centraliza o conteúdo — antes o bloco assentava acima do meio e
       sobrava uma faixa branca embaixo. `svh` em vez de `vh` para não pular
       quando a barra do navegador móvel recolhe. */
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-36 md:pb-24 lg:flex lg:min-h-[calc(100svh-5rem)] lg:items-center lg:py-20">
      {/* Soft background accent (doc 06 — gradientes suaves) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-primary/[0.09] blur-[120px]" />
        <div className="absolute right-0 top-40 h-[380px] w-[520px] rounded-full bg-[#fb923c]/[0.07] blur-[110px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(249,115,22,0.06),transparent_55%)]" />
      </div>

      {/* Vitrine à direita, atrás do texto e fora do fluxo, para o conteúdo
          respirar sem disputar espaço.

          Ela se alinha a uma faixa centrada — não à borda da seção. Ancorada em
          `right-0` da seção, numa tela larga a vitrine fugia para o canto: o
          texto ficava de um lado, o vídeo do outro e um vão no meio, além de o
          painel da direita ser cortado pela borda. Presa a esta faixa, ela
          acompanha o mesmo eixo do conteúdo em qualquer largura. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden lg:block"
      >
        <div className="mx-auto flex h-full w-full max-w-[--container-max] justify-end">
          <div className="h-full w-[58%] xl:w-[56%]">
            <HeroVideo fill />
          </div>
        </div>
      </div>

      <Container className="relative">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_0.85fr]">
          {/* Left */}
          <div className="flex flex-col items-start">
            {/* A manchete abre a seção. O selo que havia aqui saiu: repetia o
                que a chamada já diz e dava ao topo um ar de template. */}
            <motion.h1
              {...item(1)}
              className="text-[2rem] font-bold leading-[1.06] tracking-[-0.035em] text-dark sm:text-[2.5rem] lg:text-[2.875rem] xl:text-[3.25rem]"
            >
              Nós não desenvolvemos apenas software.{" "}
              <span className="text-gradient-primary">
                Construímos vantagem competitiva
              </span>
              .
            </motion.h1>

            <motion.p
              {...item(2)}
              className="mt-6 max-w-xl text-lg leading-relaxed text-gray-600"
            >
              Desenvolvemos plataformas empresariais, soluções com Inteligência
              Artificial capazes de reduzir custos operacionais, acelerar
              processos e preparar empresas para crescerem com eficiência,
              inovação e segurança.
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

          {/* No mobile a vitrine entra no fluxo, abaixo do texto — sobreposta
              à esquerda ela roubaria a leitura. */}
          <motion.div
            className="lg:hidden"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.3 }}
          >
            <HeroVideo />
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
