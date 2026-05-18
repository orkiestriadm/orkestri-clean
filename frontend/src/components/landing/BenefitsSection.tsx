'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import {
  LayoutGrid, DollarSign, Truck, Users,
  TrendingUp, ShieldCheck, Zap, GitBranch,
} from 'lucide-react'

const BENEFITS = [
  {
    icon: LayoutGrid,
    title: 'Centralização operacional',
    description: 'Reúna chamados, projetos, clientes, fornecedores e financeiro em um único ambiente integrado.',
    color: '#a78bfa',
    glow: 'rgba(167,139,250,0.15)',
  },
  {
    icon: DollarSign,
    title: 'Gestão CAPEX / OPEX',
    description: 'Controle total de orçamentos, ciclos financeiros e centros de custo com rastreabilidade completa.',
    color: '#34d399',
    glow: 'rgba(52,211,153,0.15)',
  },
  {
    icon: Users,
    title: 'CRM corporativo',
    description: 'Pipeline de clientes, histórico de relacionamento, contratos e comunicação em uma só plataforma.',
    color: '#22d3ee',
    glow: 'rgba(34,211,238,0.15)',
  },
  {
    icon: Truck,
    title: 'Controle de fornecedores',
    description: 'Gestão de cadeia de suprimentos, homologação, avaliação de performance e histórico de compras.',
    color: '#fbbf24',
    glow: 'rgba(251,191,36,0.15)',
  },
  {
    icon: GitBranch,
    title: 'Rastreabilidade total',
    description: 'Trilha de auditoria completa para cada ação no sistema — quem fez, quando e o quê.',
    color: '#a78bfa',
    glow: 'rgba(167,139,250,0.15)',
  },
  {
    icon: ShieldCheck,
    title: 'Segurança enterprise',
    description: 'Multi-tenant isolado, JWT com refresh, permissões granulares e proteção OWASP nativa.',
    color: '#34d399',
    glow: 'rgba(52,211,153,0.15)',
  },
  {
    icon: TrendingUp,
    title: 'Escalabilidade real',
    description: 'Arquitetura preparada para crescer com sua empresa, sem refatorações ou migrações forçadas.',
    color: '#22d3ee',
    glow: 'rgba(34,211,238,0.15)',
  },
  {
    icon: Zap,
    title: 'Automação operacional',
    description: 'Fluxos automáticos de aprovação, notificações e gatilhos — menos trabalho manual, mais resultado.',
    color: '#fbbf24',
    glow: 'rgba(251,191,36,0.15)',
  },
]

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const item = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}

export default function BenefitsSection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-8%' })

  return (
    <section id="beneficios" ref={ref} className="relative py-24 lg:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(167,139,250,0.3)] to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(167,139,250,0.15)] to-transparent" />
        <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-violet-600/5 blur-[120px] rounded-full" />
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
            Por que Orkiestri
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--text-primary)] mb-4">
            Tudo que uma operação
            <br className="hidden sm:block" /> corporativa precisa
          </h2>
          <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto">
            Funcionalidades profundas, UX moderna e arquitetura enterprise — sem os trade-offs dos sistemas legados.
          </p>
        </motion.div>

        {/* Grid */}
        <motion.div
          variants={container}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {BENEFITS.map(benefit => {
            const Icon = benefit.icon
            return (
              <motion.div
                key={benefit.title}
                variants={item}
                className="group relative rounded-2xl border border-[rgba(162,130,255,0.1)] bg-[rgba(12,12,34,0.6)] backdrop-blur-sm p-6 hover:border-[rgba(162,130,255,0.25)] transition-all duration-300 hover:-translate-y-1 cursor-default"
                style={{ ['--glow' as string]: benefit.glow }}
              >
                {/* Hover glow */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: `radial-gradient(circle at 50% 0%, ${benefit.glow}, transparent 70%)` }} />

                <div className="relative">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 border"
                    style={{ background: `${benefit.color}15`, borderColor: `${benefit.color}30` }}>
                    <Icon size={18} style={{ color: benefit.color }} />
                  </div>

                  <h3 className="font-display font-semibold text-[var(--text-primary)] mb-2 text-[15px] leading-snug">
                    {benefit.title}
                  </h3>
                  <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
