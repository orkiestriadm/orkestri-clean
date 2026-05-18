'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Check, Sparkles } from 'lucide-react'

const STATS = [
  { value: '< 1 dia', label: 'de curva de aprendizado', color: '#a78bfa' },
  { value: '99,9%', label: 'de disponibilidade SLA', color: '#34d399' },
  { value: '8x', label: 'mais rápido que ERPs legados', color: '#22d3ee' },
  { value: '100%', label: 'white-label e customizável', color: '#fbbf24' },
]

const FEATURES = [
  'UX moderna, intuitiva e responsiva em qualquer dispositivo',
  'Multi-tenant nativo — isolamento total por organização',
  'Permissões granulares com controle por perfil e módulo',
  'Integração com WhatsApp para notificações operacionais',
  'Auditoria completa com trilha de todas as ações do sistema',
  'API aberta para integração com ferramentas externas',
  'Suporte a múltiplos idiomas e fusos horários',
  'Implantação guiada com onboarding dedicado',
]

export default function DifferentialsSection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-8%' })

  return (
    <section ref={ref} className="relative py-24 lg:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(167,139,250,0.2)] to-transparent" />
        <div className="absolute top-1/4 left-0 w-[600px] h-[600px] bg-violet-600/5 blur-[140px] rounded-full" />
        <div className="absolute bottom-1/4 right-0 w-[400px] h-[400px] bg-cyan-500/5 blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-20"
        >
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1 + i * 0.1, duration: 0.5 }}
              className="rounded-2xl border border-[rgba(162,130,255,0.12)] bg-[rgba(12,12,34,0.6)] backdrop-blur-sm p-6 text-center"
            >
              <div className="font-display font-bold text-3xl sm:text-4xl mb-1" style={{ color: stat.color }}>
                {stat.value}
              </div>
              <div className="text-[var(--text-muted)] text-sm">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Main content — two columns */}
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left — text */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgba(167,139,250,0.2)] bg-[rgba(167,139,250,0.07)] text-[var(--accent-violet)] text-xs font-medium mb-6">
              <Sparkles size={12} /> Diferenciais
            </span>

            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--text-primary)] mb-6 leading-[1.1]">
              Profundidade corporativa
              <br />
              <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                com experiência moderna.
              </span>
            </h2>

            <p className="text-[var(--text-secondary)] text-lg leading-relaxed mb-8">
              O Orkiestri foi construído do zero para empresas que exigem profundidade operacional mas não abrem mão de uma experiência premium — sem a complexidade desnecessária dos ERPs tradicionais.
            </p>

            {/* Compare table */}
            <div className="rounded-2xl border border-[rgba(162,130,255,0.12)] bg-[rgba(12,12,34,0.5)] overflow-hidden">
              <div className="grid grid-cols-3 px-4 py-2.5 border-b border-[rgba(162,130,255,0.08)] text-[11px] text-[var(--text-muted)] font-medium">
                <span>Característica</span>
                <span className="text-center text-[var(--accent-violet)]">Orkiestri</span>
                <span className="text-center">ERP legado</span>
              </div>
              {[
                ['UX moderna','✓','✗'],
                ['Mobile nativo','✓','✗'],
                ['Implantação rápida','✓','✗'],
                ['Custo acessível','✓','✗'],
                ['Multi-tenant','✓','Parcial'],
                ['API aberta','✓','Pago extra'],
              ].map(([feat, ork, leg]) => (
                <div key={feat} className="grid grid-cols-3 px-4 py-2.5 border-b border-[rgba(162,130,255,0.05)] last:border-0 text-sm items-center">
                  <span className="text-[var(--text-secondary)] text-xs">{feat}</span>
                  <span className="text-center text-[#34d399] font-bold">{ork}</span>
                  <span className="text-center text-[var(--text-muted)] text-xs">{leg}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right — feature list */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="grid gap-3">
              {FEATURES.map((feat, i) => (
                <motion.div
                  key={feat}
                  initial={{ opacity: 0, x: 20 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.35 + i * 0.06, duration: 0.4 }}
                  className="flex items-start gap-3 p-4 rounded-xl border border-[rgba(162,130,255,0.08)] bg-[rgba(12,12,34,0.4)] hover:border-[rgba(162,130,255,0.2)] hover:bg-[rgba(167,139,250,0.04)] transition-all duration-200"
                >
                  <div className="w-5 h-5 rounded-full bg-[rgba(52,211,153,0.15)] border border-[rgba(52,211,153,0.3)] flex items-center justify-center shrink-0 mt-0.5">
                    <Check size={11} className="text-[#34d399]" />
                  </div>
                  <span className="text-[var(--text-secondary)] text-sm leading-relaxed">{feat}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
