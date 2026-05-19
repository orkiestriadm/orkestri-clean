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
    description: 'Reúna chamados, projetos, clientes, fornecedores e financeiro em um único ambiente integrado e auditável.',
    color: '#a78bfa',
    glow: 'rgba(167,139,250,0.16)',
    size: 'large',
  },
  {
    icon: DollarSign,
    title: 'CAPEX / OPEX',
    description: 'Controle total de orçamentos, ciclos financeiros e centros de custo com rastreabilidade completa.',
    color: '#34d399',
    glow: 'rgba(52,211,153,0.16)',
    size: 'small',
  },
  {
    icon: ShieldCheck,
    title: 'Segurança enterprise',
    description: 'Multi-tenant isolado, JWT com refresh, permissões granulares e proteção OWASP nativa.',
    color: '#34d399',
    glow: 'rgba(52,211,153,0.16)',
    size: 'small',
  },
  {
    icon: Users,
    title: 'CRM corporativo',
    description: 'Pipeline de clientes, histórico de relacionamento, contratos e comunicação em uma só plataforma para escalar o relacionamento.',
    color: '#22d3ee',
    glow: 'rgba(34,211,238,0.16)',
    size: 'large',
  },
  {
    icon: Truck,
    title: 'Controle de fornecedores',
    description: 'Gestão de cadeia de suprimentos, homologação, avaliação e histórico de compras.',
    color: '#fbbf24',
    glow: 'rgba(251,191,36,0.16)',
    size: 'small',
  },
  {
    icon: GitBranch,
    title: 'Rastreabilidade total',
    description: 'Trilha de auditoria completa — quem fez, quando e o quê, para cada ação no sistema.',
    color: '#a78bfa',
    glow: 'rgba(167,139,250,0.16)',
    size: 'small',
  },
  {
    icon: TrendingUp,
    title: 'Escalabilidade real',
    description: 'Arquitetura preparada para crescer com sua empresa, sem refatorações ou migrações forçadas.',
    color: '#22d3ee',
    glow: 'rgba(34,211,238,0.16)',
    size: 'small',
  },
  {
    icon: Zap,
    title: 'Automação operacional',
    description: 'Fluxos automáticos de aprovação, notificações e gatilhos — menos trabalho manual, mais resultado.',
    color: '#fbbf24',
    glow: 'rgba(251,191,36,0.16)',
    size: 'small',
  },
]

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
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
        <div className="absolute top-1/2 right-0 w-[600px] h-[600px] bg-violet-600/5 blur-[130px] rounded-full -translate-y-1/2" />
        <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-cyan-500/4 blur-[100px] rounded-full -translate-y-1/2" />
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
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--text-primary)] mb-4 leading-[1.1]">
            Tudo que uma operação
            <br className="hidden sm:block" />
            {' '}corporativa precisa
          </h2>
          <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto leading-relaxed">
            Funcionalidades profundas, UX moderna e arquitetura enterprise — sem os trade-offs dos sistemas legados.
          </p>
        </motion.div>

        {/* Bento grid */}
        <motion.div
          variants={container}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {/* Row 1: large + 2 small */}
          <motion.div
            variants={item}
            className="group relative lg:col-span-2 rounded-2xl border border-[rgba(162,130,255,0.1)] bg-[rgba(10,10,30,0.7)] backdrop-blur-sm p-7 hover:border-[rgba(167,139,250,0.28)] transition-all duration-300 hover:-translate-y-1 cursor-default overflow-hidden"
          >
            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(167,139,250,0.14), transparent 65%)' }} />
            <div className="relative">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 border"
                style={{ background: 'rgba(167,139,250,0.12)', borderColor: 'rgba(167,139,250,0.28)' }}>
                <LayoutGrid size={20} style={{ color: '#a78bfa' }} />
              </div>
              <h3 className="font-display font-bold text-[var(--text-primary)] mb-2 text-[17px]">Centralização operacional</h3>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed max-w-sm">
                Reúna chamados, projetos, clientes, fornecedores e financeiro em um único ambiente integrado e auditável. Elimine silos de informação para sempre.
              </p>
              <div className="flex flex-wrap gap-2 mt-5">
                {['CRM', 'Projetos', 'Chamados', 'Financeiro', 'Fornecedores'].map(tag => (
                  <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[rgba(167,139,250,0.08)] border border-[rgba(167,139,250,0.15)] text-[rgba(167,139,250,0.8)]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>

          {[BENEFITS[1], BENEFITS[2]].map(benefit => {
            const Icon = benefit.icon
            return (
              <motion.div
                key={benefit.title}
                variants={item}
                className="group relative rounded-2xl border border-[rgba(162,130,255,0.1)] bg-[rgba(10,10,30,0.7)] backdrop-blur-sm p-6 hover:border-[rgba(162,130,255,0.28)] transition-all duration-300 hover:-translate-y-1 cursor-default overflow-hidden"
              >
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{ background: `radial-gradient(ellipse at 50% 0%, ${benefit.glow}, transparent 65%)` }} />
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 border"
                    style={{ background: `${benefit.color}12`, borderColor: `${benefit.color}28` }}>
                    <Icon size={18} style={{ color: benefit.color }} />
                  </div>
                  <h3 className="font-display font-semibold text-[var(--text-primary)] mb-2 text-[15px]">{benefit.title}</h3>
                  <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{benefit.description}</p>
                </div>
              </motion.div>
            )
          })}

          {/* Row 2: 2 small + large */}
          {[BENEFITS[4], BENEFITS[5]].map(benefit => {
            const Icon = benefit.icon
            return (
              <motion.div
                key={benefit.title}
                variants={item}
                className="group relative rounded-2xl border border-[rgba(162,130,255,0.1)] bg-[rgba(10,10,30,0.7)] backdrop-blur-sm p-6 hover:border-[rgba(162,130,255,0.28)] transition-all duration-300 hover:-translate-y-1 cursor-default overflow-hidden"
              >
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{ background: `radial-gradient(ellipse at 50% 0%, ${benefit.glow}, transparent 65%)` }} />
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 border"
                    style={{ background: `${benefit.color}12`, borderColor: `${benefit.color}28` }}>
                    <Icon size={18} style={{ color: benefit.color }} />
                  </div>
                  <h3 className="font-display font-semibold text-[var(--text-primary)] mb-2 text-[15px]">{benefit.title}</h3>
                  <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{benefit.description}</p>
                </div>
              </motion.div>
            )
          })}

          <motion.div
            variants={item}
            className="group relative lg:col-span-2 rounded-2xl border border-[rgba(162,130,255,0.1)] bg-[rgba(10,10,30,0.7)] backdrop-blur-sm p-7 hover:border-[rgba(34,211,238,0.28)] transition-all duration-300 hover:-translate-y-1 cursor-default overflow-hidden"
          >
            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(34,211,238,0.12), transparent 65%)' }} />
            <div className="relative">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 border"
                style={{ background: 'rgba(34,211,238,0.12)', borderColor: 'rgba(34,211,238,0.28)' }}>
                <Users size={20} style={{ color: '#22d3ee' }} />
              </div>
              <h3 className="font-display font-bold text-[var(--text-primary)] mb-2 text-[17px]">CRM corporativo</h3>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed max-w-sm">
                Pipeline de clientes, histórico de relacionamento, contratos e comunicação integrados. Escale o relacionamento com seus clientes sem perder nenhum detalhe.
              </p>
              <div className="grid grid-cols-3 gap-2 mt-5">
                {[
                  { label: 'Clientes', value: '340+' },
                  { label: 'Contratos', value: '128' },
                  { label: 'NPS', value: '4.9★' },
                ].map(stat => (
                  <div key={stat.label} className="rounded-xl p-2.5 border border-[rgba(34,211,238,0.14)] bg-[rgba(34,211,238,0.05)] text-center">
                    <div className="font-display font-bold text-sm text-[#22d3ee]">{stat.value}</div>
                    <div className="text-[9px] text-[var(--text-muted)] mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Last row: remaining small cards */}
          {[BENEFITS[6], BENEFITS[7]].map(benefit => {
            const Icon = benefit.icon
            return (
              <motion.div
                key={benefit.title}
                variants={item}
                className="group relative rounded-2xl border border-[rgba(162,130,255,0.1)] bg-[rgba(10,10,30,0.7)] backdrop-blur-sm p-6 hover:border-[rgba(162,130,255,0.28)] transition-all duration-300 hover:-translate-y-1 cursor-default overflow-hidden"
              >
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{ background: `radial-gradient(ellipse at 50% 0%, ${benefit.glow}, transparent 65%)` }} />
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 border"
                    style={{ background: `${benefit.color}12`, borderColor: `${benefit.color}28` }}>
                    <Icon size={18} style={{ color: benefit.color }} />
                  </div>
                  <h3 className="font-display font-semibold text-[var(--text-primary)] mb-2 text-[15px]">{benefit.title}</h3>
                  <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{benefit.description}</p>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
