'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Target, Zap, TrendingUp } from 'lucide-react'

const STEPS = [
  {
    number: '01',
    icon: Target,
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.1)',
    border: 'rgba(167,139,250,0.25)',
    glow: 'rgba(167,139,250,0.18)',
    title: 'Centralize operações',
    desc: 'Unifique CRM, chamados, projetos, fornecedores e financeiro em um único ambiente integrado e auditável. Elimine planilhas e sistemas fragmentados de uma vez.',
    tag: 'Setup em < 24h',
  },
  {
    number: '02',
    icon: Zap,
    color: '#22d3ee',
    bg: 'rgba(34,211,238,0.1)',
    border: 'rgba(34,211,238,0.25)',
    glow: 'rgba(34,211,238,0.18)',
    title: 'Automatize processos',
    desc: 'Configure regras de aprovação, alertas automáticos e fluxos de trabalho sem código. Notificações via WhatsApp, escalas de atendimento e gatilhos operacionais.',
    tag: 'Zero código',
  },
  {
    number: '03',
    icon: TrendingUp,
    color: '#34d399',
    bg: 'rgba(52,211,153,0.1)',
    border: 'rgba(52,211,153,0.25)',
    glow: 'rgba(52,211,153,0.18)',
    title: 'Escale a gestão',
    desc: 'Dashboards executivos, KPIs em tempo real e analytics avançado com CSAT, SLA e CAPEX/OPEX para decisões baseadas em dados em qualquer escala.',
    tag: 'Insights em tempo real',
  },
]

export default function StepsSection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-8%' })

  return (
    <section ref={ref} id="plataforma" className="relative py-24 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[rgba(13,13,28,0.4)]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(167,139,250,0.2)] to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(167,139,250,0.1)] to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-violet-600/4 blur-[140px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-16 lg:mb-20"
        >
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgba(167,139,250,0.2)] bg-[rgba(167,139,250,0.07)] text-[var(--accent-violet)] text-xs font-medium mb-4">
            Como funciona
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--text-primary)] mb-4 leading-[1.1]">
            Do caos à clareza
            <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-violet-400 via-violet-300 to-cyan-400 bg-clip-text text-transparent">
              {' '}em 3 etapas.
            </span>
          </h2>
          <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto leading-relaxed">
            Sem integração complexa, sem meses de implantação. Do onboarding ao primeiro insight executivo em menos de uma semana.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 relative">
          {/* Connecting line desktop */}
          <div className="absolute top-[76px] left-[calc(16.67%+52px)] right-[calc(16.67%+52px)] h-px hidden lg:block"
            style={{ background: 'linear-gradient(90deg, rgba(167,139,250,0.4) 0%, rgba(34,211,238,0.4) 50%, rgba(52,211,153,0.4) 100%)' }} />

          {STEPS.map((step, i) => {
            const Icon = step.icon
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 36 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.12 + i * 0.15, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                className="group relative rounded-2xl border bg-[rgba(10,10,30,0.7)] backdrop-blur-sm p-8 transition-all duration-300 hover:-translate-y-1.5 cursor-default"
                style={{ borderColor: `${step.color}22` }}
              >
                {/* Hover glow */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{ background: `radial-gradient(ellipse at 50% 0%, ${step.glow}, transparent 65%)` }} />

                {/* Icon + number */}
                <div className="relative flex items-start justify-between mb-6">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110"
                    style={{ background: step.bg, borderColor: step.border }}>
                    <Icon size={22} style={{ color: step.color }} />
                  </div>
                  <span className="font-display font-black text-5xl leading-none select-none tabular-nums"
                    style={{ color: `${step.color}1a` }}>{step.number}</span>
                </div>

                {/* Tag pill */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold mb-4"
                  style={{ background: step.bg, color: step.color, border: `1px solid ${step.border}` }}>
                  <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: step.color }} />
                  {step.tag}
                </div>

                <h3 className="font-display font-bold text-[20px] text-[var(--text-primary)] mb-3 leading-snug">
                  {step.title}
                </h3>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                  {step.desc}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
