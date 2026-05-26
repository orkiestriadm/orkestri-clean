'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { ArrowUpRight, HelpCircle, ShieldCheck, Zap, GitBranch } from 'lucide-react'

export default function UnderstandSection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10%' })

  return (
    <section ref={ref} className="relative py-24 lg:py-32 overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 pointer-events-none select-none">
        {/* Subtle top/bottom borders */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(167,139,250,0.25)] to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(167,139,250,0.12)] to-transparent" />
        
        {/* Glow effects */}
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-violet-600/5 blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left - Context and CTA */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-7 text-center lg:text-left"
          >
            {/* Tag */}
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgba(167,139,250,0.2)] bg-[rgba(167,139,250,0.07)] text-[var(--accent-violet)] text-xs font-semibold mb-6">
              <HelpCircle size={13} />
              Apresentação Detalhada
            </span>

            {/* Title */}
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-[var(--text-primary)] leading-[1.1] mb-6">
              Entenda melhor o{' '}
              <span className="bg-gradient-to-r from-violet-400 via-violet-300 to-cyan-400 bg-clip-text text-transparent">
                Orkiestri
              </span>
            </h2>

            {/* Description */}
            <p className="text-[var(--text-secondary)] text-lg leading-relaxed mb-8 max-w-2xl mx-auto lg:mx-0">
              Substitua o caos de dezenas de ferramentas desconectadas. Conheça detalhadamente nossa proposta de valor, arquitetura SaaS, roadmap de desenvolvimento e como unificamos sua operação em um único ecossistema inteligente.
            </p>

            {/* Premium stand-out CTA Button */}
            <div className="inline-block relative group">
              {/* Outer pulsing glow */}
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-cyan-500 via-violet-600 to-fuchsia-500 opacity-75 blur-lg group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse" />
              
              <a
                href="/entenda-orkiestri.html"
                target="_blank"
                rel="noopener noreferrer"
                className="relative inline-flex items-center justify-center gap-3 px-10 py-5 rounded-xl bg-[#090918] text-white font-bold text-base border border-violet-500/30 hover:border-cyan-400/50 hover:text-cyan-200 transition-all duration-300 overflow-hidden"
              >
                {/* Shiny layer inside button */}
                <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 via-cyan-500/10 to-violet-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <span>Ver Apresentação Operacional</span>
                <ArrowUpRight size={18} className="text-cyan-400 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
              </a>
            </div>

            <p className="mt-4 text-xs text-[var(--text-muted)]">
              Documentação interativa · Abre em uma nova aba
            </p>
          </motion.div>

          {/* Right - Interactive Teaser Card */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-5"
          >
            <div className="lp-card relative rounded-3xl border border-[rgba(255,255,255,0.07)] bg-[rgba(10,10,24,0.4)] backdrop-blur-md p-8 overflow-hidden shadow-2xl">
              {/* Card border shine */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-6 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                O que você vai explorar lá:
              </h3>

              <div className="space-y-6">
                {/* Teaser 1 */}
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-violet-600/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                    <Zap size={14} className="text-violet-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--text-primary)]">Cenário Legado vs Orkiestri</h4>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">Como resolvemos a descentralização de Jira, Movidesk, Excel e Planner.</p>
                  </div>
                </div>

                {/* Teaser 2 */}
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-cyan-600/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                    <GitBranch size={14} className="text-cyan-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--text-primary)]">Fluxo Operacional Inteligente</h4>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">A integração em tempo real entre chamados, projetos e indicadores.</p>
                  </div>
                </div>

                {/* Teaser 3 */}
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-[#34d399]/10 border border-[#34d399]/20 flex items-center justify-center shrink-0">
                    <ShieldCheck size={14} className="text-[#34d399]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--text-primary)]">Arquitetura SaaS Enterprise</h4>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">Detalhes sobre isolamento Multi-Tenant, RBAC e faturamento recorrente.</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
