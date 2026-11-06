'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import {
  Headset, Calculator, Receipt, FolderKanban, CalendarDays, BookOpen,
} from 'lucide-react'

// Espelho do menu do sistema — a fonte da verdade é `@/lib/modules` → NAV.
// Esta lista já anunciou Relatórios e um Financeiro com "contratos e receitas",
// nenhum dos dois existindo. Ao mexer no NAV, mexa aqui.
const MODULES = [
  {
    icon: CalendarDays,
    name: 'Agenda',
    description: 'Seus compromissos num lugar só, com lembrete no WhatsApp antes da hora.',
    color: '#fbbf24',
    gradient: 'from-amber-500/20 to-amber-600/5',
    border: 'rgba(251,191,36,0.2)',
  },
  {
    icon: Receipt,
    name: 'Meus Gastos',
    description: 'Anote o gasto por mensagem, inclusive parcelado, e receba o resumo da semana no domingo.',
    color: '#22d3ee',
    gradient: 'from-cyan-500/20 to-cyan-600/5',
    border: 'rgba(34,211,238,0.2)',
  },
  {
    icon: Headset,
    name: 'Chamados',
    description: 'O pedido vira um chamado com número, prazo e responsável — e avisa antes do prazo estourar.',
    color: '#60a5fa',
    gradient: 'from-blue-500/20 to-blue-600/5',
    border: 'rgba(96,165,250,0.2)',
  },
  {
    icon: FolderKanban,
    name: 'Projetos',
    description: 'O quadro com as tarefas, quem ficou com cada uma e a linha do tempo dos prazos.',
    color: '#a78bfa',
    gradient: 'from-violet-500/20 to-violet-600/5',
    border: 'rgba(167,139,250,0.2)',
  },
  {
    icon: Calculator,
    name: 'Orçamento',
    description: 'O que foi planejado e o que de fato saiu, mês a mês, por centro de custo.',
    color: '#34d399',
    gradient: 'from-emerald-500/20 to-emerald-600/5',
    border: 'rgba(52,211,153,0.2)',
  },
  {
    icon: BookOpen,
    name: 'Conhecimento',
    description: 'As orientações escritas uma vez, para não responder a mesma pergunta toda semana.',
    color: '#f472b6',
    gradient: 'from-pink-500/20 to-pink-600/5',
    border: 'rgba(244,114,182,0.2)',
  },
]

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
}
const item = {
  hidden: { opacity: 0, scale: 0.94, y: 16 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
}

export default function ModulesSection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-8%' })

  return (
    <section id="modulos" ref={ref} className="relative py-12 lg:py-16 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[var(--bg-secondary)]/50" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(167,139,250,0.25)] to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(167,139,250,0.12)] to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-[700px] h-[600px] bg-violet-600/10 blur-[140px] rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-cyan-500/7 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgba(167,139,250,0.2)] bg-[rgba(167,139,250,0.07)] text-[var(--accent-violet)] text-xs font-medium mb-4">
            Módulos do sistema
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--text-primary)] mb-4">
            HUB Operacional Corporativo,<br className="hidden sm:block" /> em um único ecossistema!
          </h2>
          <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto">
            Cada módulo é profundo, completo e integrado nativamente com os demais — sem plug-ins, sem fricção.
          </p>
        </motion.div>

        {/* Grid */}
        <motion.div
          variants={container}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {MODULES.map(mod => {
            const Icon = mod.icon
            return (
              <motion.div
                key={mod.name}
                variants={item}
                className="lp-card group relative rounded-2xl border border-[rgba(255,255,255,0.07)] backdrop-blur-md p-6 hover:-translate-y-1.5 hover:border-[rgba(167,139,250,0.3)] transition-all duration-300 cursor-default overflow-hidden hover:shadow-[0_0_40px_rgba(124,58,237,0.09)]"
              >
                {/* Gradient overlay on hover */}
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-b ${mod.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                {/* Top edge glow — subtle always, bright on hover */}
                <div className="absolute top-0 left-0 right-0 h-px opacity-20 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: `linear-gradient(90deg, transparent, ${mod.color}70, transparent)` }} />

                <div className="relative">
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
                    style={{ background: `${mod.color}18`, boxShadow: `0 0 0 1px ${mod.color}30` }}>
                    <Icon size={22} style={{ color: mod.color }} />
                  </div>

                  <h3 className="font-display font-bold text-[var(--text-primary)] text-lg mb-2">
                    {mod.name}
                  </h3>
                  <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                    {mod.description}
                  </p>

                  {/* Arrow hint */}
                  <div className="mt-4 flex items-center gap-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ color: mod.color }}>
                    Explorar módulo
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
