"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Container } from "@/components/ui/container";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { products } from "@/config/products";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";

/**
 * Hero da home — escuro, com as telas reais do sistema.
 *
 * Três decisões sustentam esta seção e não devem ser afrouxadas:
 *
 *   1. UM botão. O cadastro acontece pelo WhatsApp e só por lá (decisão do
 *      cliente, 26/10/2026). Qualquer outro botão aqui disputa com ele e o
 *      enfraquece — era o que acontecia antes, com três lado a lado.
 *   2. O verde aparece UMA vez na página inteira. Não é enfeite: diz que o
 *      clique sai do site e abre uma conversa. Usá-lo em outro lugar
 *      destrói essa leitura.
 *   3. A trilha de módulos embaixo é o convite a vasculhar. Ela troca a tela
 *      sem sair da dobra — quem chega descobre o tamanho do sistema antes de
 *      rolar um pixel.
 *
 * O número do WhatsApp é o mesmo a que a instância do Evolution está
 * conectada em produção; apontando para outro, a Aurélia nunca vê a mensagem.
 */

/* Só os módulos com captura real entram na trilha. Anunciar um módulo e
   mostrar um retângulo vazio é pior do que não anunciar. */
const modulos = products.filter((p) => p.screenshot);

export function Hero() {
  const reduce = useReducedMotion();
  const [ativo, setAtivo] = useState(0);
  const tela = modulos[ativo];

  /* Entrada orquestrada: a manchete, o texto, o botão e a tela chegam em
     cascata uma única vez. É o ÚNICO movimento não pedido da página — as
     seções abaixo não repetem fade-up, que é o que faz uma página parecer
     gerada. */
  const entrada = (i: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: EASE_OUT, delay: 0.06 * i },
  });

  return (
    <section className="ink-grain relative isolate overflow-hidden bg-ink pt-28 pb-16 md:pt-32 lg:pt-36 lg:pb-20">
      {/* A luz.
          Uma fonte só, assimétrica, alta e à esquerda — a de duas fontes
          largas que havia aqui tingia a página inteira de marrom: laranja
          difuso sobre preto neutro vira ocre, e o "quase preto" desaparece.
          Agora o glow é menor, mais fraco e fica contido no alto; a vinheta
          abaixo devolve o preto às bordas, que é o que faz o laranja ler
          como LUZ em vez de tinta de fundo. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 -top-64 h-[560px] w-[680px] rounded-full bg-flame/[0.10] blur-[130px]" />
        {/* Vinheta: escurece as quatro bordas por cima do glow. */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_38%_28%,transparent,var(--color-ink)_78%)]" />
        {/* Fio de horizonte: separa o hero do que vem abaixo sem borda dura. */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <Container className="relative z-10">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:gap-16">
          {/* ── Texto ─────────────────────────────────────────────────── */}
          <div className="flex flex-col items-start">
            <motion.h1
              {...entrada(0)}
              className="font-display text-[2.5rem] font-bold leading-[1.02] tracking-[-0.035em] text-chalk [font-stretch:112%] sm:text-[3.25rem] lg:text-[3.5rem] xl:text-[3.9rem]"
            >
              Seis aplicações, um login, uma operação só.
            </motion.h1>

            <motion.p
              {...entrada(1)}
              className="mt-7 max-w-[52ch] text-[1.0625rem] leading-[1.65] text-chalk-dim"
            >
              {/* Esta lista tem de bater com `config/products.ts`, que por sua
                  vez espelha o `NAV` do sistema. Até 26/10/2026 ela citava
                  "frota" e "ativos", removidos da produção em 19/10. */}
              Chamados, conhecimento, projetos, agenda, financeiro e orçamento
              no mesmo sistema — com inteligência artificial e automação onde o
              trabalho acontece. Você ativa só os módulos que a sua operação
              usa.
            </motion.p>

            <motion.div {...entrada(2)} className="mt-9">
              <WhatsAppButton />
              <p className="mt-4 text-sm leading-relaxed text-chalk-faint">
                A conversa cria a empresa e libera os módulos. Sem formulário.
              </p>
            </motion.div>
          </div>

          {/* ── Tela ──────────────────────────────────────────────────── */}
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.22 }}
            /* A tela ultrapassa a margem direita e sai da janela. Não é
               descuido: contida, ela virava uma figura educada ao lado do
               texto; sangrando, diz que há mais sistema do que cabe na tela —
               que é exatamente o convite a ir ver. */
            className="relative lg:-mr-12 xl:-mr-24 2xl:-mr-40"
          >
            {/* Brilho SOB a moldura, não atrás dela: atrás, o laranja vazava
                por cima da captura e a deixava amarelada e sem contraste.
                Embaixo, lê como a luz que a tela joga na mesa. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-8 -bottom-6 -z-10 h-40 rounded-full bg-flame/20 blur-[60px]"
            />
            <Moldura tela={tela} />
          </motion.div>
        </div>

        {/* ── Trilha de módulos ──────────────────────────────────────── */}
        <motion.div {...entrada(4)} className="mt-14 lg:mt-16">
          <Trilha ativo={ativo} onEscolher={setAtivo} />
        </motion.div>
      </Container>
    </section>
  );
}

/** Moldura da captura: fio de luz e respiro de 8px em volta da tela. */
function Moldura({ tela }: { tela: (typeof modulos)[number] }) {
  /* As capturas não têm o mesmo tamanho: vão de 920px a 2200px de largura.
     Ampliar todas no mesmo fator deixaria as pequenas borradas — a de Frota
     (920px) já entra quase no tamanho natural. Só as grandes sobram pixel
     para recortar, e são essas que ganham o zoom. */
  const grande = (tela.screenshot!.width ?? 0) >= 1600;

  return (
    <div className="hairline edge-light relative rounded-[22px] border bg-panel p-2">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[15px] bg-ink-raise lg:aspect-[16/11]">
        {/* `key` força o cruzamento de imagens na troca: sem ele o React
            reaproveita o nó e a tela nova aparece de estalo. */}
        <Image
          key={tela.slug}
          src={tela.screenshot!.src}
          alt={tela.screenshot!.alt}
          fill
          priority
          /* Captura de interface é densa em texto miúdo; o padrão (q=75)
             borra as letras e a tela passa a parecer de baixa qualidade. */
          quality={92}
          sizes="(max-width: 1024px) 100vw, 1100px"
          /* A tela inteira reduzida a 600px fica ilegível e lê como borrão
             cinza — pior do que não mostrar. Ampliada e ancorada no canto
             superior esquerdo, aparece um PEDAÇO em tamanho legível: dá para
             ler os rótulos, e é isso que prova que o sistema existe. */
          className={cn(
            "animate-[fade-in_.45s_ease-out] object-cover object-left-top",
            grande && "origin-top-left scale-[1.45]",
          )}
        />
        {/* O corte à direita e embaixo fica duro; este véu dissolve a aresta
            para dentro do painel. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,transparent_72%,rgba(7,8,11,0.55)),linear-gradient(to_bottom,transparent_74%,rgba(7,8,11,0.5))]"
        />
      </div>
    </div>
  );
}

/** Seletor de módulo. Tabs de verdade: setas do teclado navegam. */
function Trilha({
  ativo,
  onEscolher,
}: {
  ativo: number;
  onEscolher: (i: number) => void;
}) {
  const mover = (e: React.KeyboardEvent, i: number) => {
    const destino =
      e.key === "ArrowRight"
        ? (i + 1) % modulos.length
        : e.key === "ArrowLeft"
          ? (i - 1 + modulos.length) % modulos.length
          : null;
    if (destino === null) return;
    e.preventDefault();
    onEscolher(destino);
    (
      document.getElementById(`modulo-${destino}`) as HTMLButtonElement | null
    )?.focus();
  };

  return (
    <div className="border-t border-white/[0.07] pt-6">
      <p className="text-sm text-chalk-faint">
        As telas são do sistema em operação. Escolha um módulo:
      </p>
      <div
        role="tablist"
        aria-label="Módulos do Orkiestri One"
        /* Rola na horizontal no celular; a barra fica escondida porque a
           própria lista já indica que há mais à direita pelo corte. */
        className="mt-4 flex gap-x-7 gap-y-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:flex-wrap lg:overflow-visible [&::-webkit-scrollbar]:hidden"
      >
        {modulos.map((p, i) => {
          const selecionado = i === ativo;
          return (
            <button
              key={p.slug}
              id={`modulo-${i}`}
              type="button"
              role="tab"
              aria-selected={selecionado}
              tabIndex={selecionado ? 0 : -1}
              onClick={() => onEscolher(i)}
              onKeyDown={(e) => mover(e, i)}
              className={cn(
                "relative shrink-0 cursor-pointer whitespace-nowrap pb-2 text-[0.9375rem] font-medium transition-colors duration-200",
                "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-flame",
                selecionado
                  ? "text-chalk"
                  : "text-chalk-faint hover:text-chalk-dim",
              )}
            >
              {/* O nome da marca se repete em todos os módulos; na trilha só
                  o que distingue um módulo do outro ajuda a escolher. */}
              {p.name.replace("Orkiestri ", "")}
              {selecionado && (
                <motion.span
                  layoutId="modulo-ativo"
                  className="absolute inset-x-0 -bottom-px h-px bg-flame shadow-[0_0_12px_2px_rgba(255,106,26,0.6)]"
                  transition={{ duration: 0.25, ease: EASE_OUT }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
