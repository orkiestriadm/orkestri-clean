'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import {
  LayoutGrid, DollarSign, Truck, Users,
  TrendingUp, ShieldCheck, Zap, GitBranch,
} from 'lucide-react'

type Benefit = {
  icon: any
  title: string
  description: string
  color: string
  glow: string
  tags?: string[]
  stats?: { label: string; value: string }[]
}

const BENEFITS: Benefit[] = [
  {
    icon: LayoutGrid,
    title: 'Centralização operacional',
    description: 'Reúna chamados, projetos, clientes, fornecedores e financeiro em um único ambiente integrado e auditável. Elimine silos de informação para sempre.',
    color: '#a78bfa',
    glow: 'rgba(167,139,250,0.2)',
    tags: ['CRM', 'Projetos', 'Chamados', 'Financeiro', 'Fornecedores'],
  },
  {
    icon: DollarSign,
    title: 'CAPEX / OPEX',
    description: 'Controle total de orçamentos, ciclos financeiros e centros de custo com rastreabilidade completa.',
    color: '#34d399',
    glow: 'rgba(52,211,153,0.18)',
  },
  {
    icon: ShieldCheck,
    title: 'Segurança enterprise',
    description: 'Multi-tenant isolado, JWT com refresh, permissões granulares e proteção OWASP nativa.',
    color: '#34d399',
    glow: 'rgba(52,211,153,0.18)',
  },
  {
    icon: Users,
    title: 'CRM corporativo',
    description: 'Pipeline de clientes, histórico de relacionamento, contratos e comunicação integrados. Escale o relacionamento sem perder nenhum detalhe.',
    color: '#22d3ee',
    glow: 'rgba(34,211,238,0.18)',
    stats: [
      { label: 'Clientes', value: '340+' },
      { label: 'Contratos', value: '128' },
      { label: 'NPS', value: '4.9★' },
    ],
  },
  {
    icon: Truck,
    title: 'Controle de fornecedores',
    description: 'Gestão de cadeia de suprimentos, homologação, avaliação e histórico de compras.',
    color: '#fbbf24',
    glow: 'rgba(251,191,36,0.18)',
  },
  {
    icon: GitBranch,
    title: 'Rastreabilidade total',
    description: 'Trilha de auditoria completa — quem fez, quando e o quê, para cada ação no sistema.',
    color: '#a78bfa',
    glow: 'rgba(167,139,250,0.18)',
  },
  {
    icon: TrendingUp,
    title: 'Escalabilidade real',
    description: 'Arquitetura preparada para crescer com sua empresa, sem refatorações ou migrações forçadas.',
    color: '#22d3ee',
    glow: 'rgba(34,211,238,0.18)',
  },
  {
    icon: Zap,
    title: 'Automação operacional',
    description: 'Fluxos automáticos de aprovação, notificações e gatilhos — menos trabalho manual, mais resultado.',
    color: '#fbbf24',
    glow: 'rgba(251,191,36,0.18)',
  },
]

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
}

const itemAnim = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}

function SmallCard({ benefit, index, wide }: { benefit: Benefit; index: number; wide?: boolean }) {
  const Icon = benefit.icon
  return (
    <motion.div
      variants={itemAnim}
      className={`group relative rounded-2xl overflow-hidden cursor-default transition-all duration-300 hover:-translate-y-1.5${wide ? ' lg:col-span-2' : ''}`}
      style={{
        background: `linear-gradient(160deg, ${benefit.color}07 0%, rgba(7,7,18,0.96) 55%)`,
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent, ${benefit.color}90, transparent)` }}
      />

      {/* Corner glow blob */}
      <div
        className="absolute -top-8 -left-8 w-32 h-32 rounded-full pointer-events-none opacity-40"
        style={{ background: `radial-gradient(circle, ${benefit.glow}, transparent 70%)` }}
      />

      {/* Corner index */}
      <div
        className="absolute top-4 right-5 text-[10px] font-mono tabular-nums select-none"
        style={{ color: benefit.color, opacity: 0.22 }}
      >
        {String(index + 1).padStart(2, '0')}
      </div>

      {/* Hover: inner border glow */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: `inset 0 0 0 1px ${benefit.color}28` }}
      />

      {/* Hover: radial sweep */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 20% 0%, ${benefit.glow}, transparent 60%)` }}
      />

      <div className="relative p-6">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
          style={{ background: `${benefit.color}18`, border: `1px solid ${benefit.color}35` }}
        >
          <Icon size={20} style={{ color: benefit.color }} />
        </div>

        <h3 className="font-display font-semibold text-white mb-2 text-[15px] leading-snug">
          {benefit.title}
        </h3>
        <p className="text-[rgba(235,235,245,0.48)] text-[13px] leading-relaxed">
          {benefit.description}
        </p>
      </div>
    </motion.div>
  )
}

function LargeCard({ benefit }: { benefit: Benefit }) {
  const Icon = benefit.icon
  return (
    <motion.div
      variants={itemAnim}
      className="group relative lg:col-span-2 rounded-2xl overflow-hidden cursor-default transition-all duration-300 hover:-translate-y-1.5"
      style={{
        background: `linear-gradient(135deg, ${benefit.color}09 0%, rgba(7,7,18,0.96) 50%)`,
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{ background: `linear-gradient(90deg, ${benefit.color}90, transparent)` }}
      />

      {/* Top-right corner glow */}
      <div
        className="absolute -top-16 -right-16 w-64 h-64 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${benefit.glow}, transparent 65%)`, opacity: 0.6 }}
      />

      {/* Hover: radial sweep */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 30% 0%, ${benefit.glow}, transparent 55%)` }}
      />

      {/* Hover: inner border glow */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: `inset 0 0 0 1px ${benefit.color}35` }}
      />

      <div className="relative p-7 sm:p-8">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
          style={{ background: `${benefit.color}18`, border: `1px solid ${benefit.color}38` }}
        >
          <Icon size={22} style={{ color: benefit.color }} />
        </div>

        <h3 className="font-display font-bold text-white mb-2.5 text-[18px] leading-snug">
          {benefit.title}
        </h3>
        <p className="text-[rgba(235,235,245,0.48)] text-[13px] leading-relaxed max-w-md">
          {benefit.description}
        </p>

        {benefit.tags && (
          <div className="flex flex-wrap gap-2 mt-5">
            {benefit.tags.map(tag => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-full text-[10px] font-mono"
                style={{
                  background: `${benefit.color}10`,
                  border: `1px solid ${benefit.color}22`,
                  color: `${benefit.color}cc`,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {benefit.stats && (
          <div className="grid grid-cols-3 gap-3 mt-5">
            {benefit.stats.map(stat => (
              <div
                key={stat.label}
                className="rounded-xl p-3 text-center"
                style={{
                  background: `${benefit.color}08`,
                  border: `1px solid ${benefit.color}1a`,
                }}
              >
                <div className="font-display font-bold text-[15px]" style={{ color: benefit.color }}>
                  {stat.value}
                </div>
                <div className="text-[10px] text-[rgba(235,235,245,0.32)] mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default function BenefitsSection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-8%' })

  return (
    <section id="beneficios" ref={ref} className="landing-dark relative py-24 lg:py-32 overflow-hidden">
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(167,139,250,0.3)] to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(167,139,250,0.15)] to-transparent" />
        <div className="absolute top-1/2 right-0 w-[600px] h-[600px] bg-violet-600/5 blur-[130px] rounded-full -translate-y-1/2" />
        <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-cyan-500/[0.04] blur-[100px] rounded-full -translate-y-1/2" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgba(167,139,250,0.2)] bg-[rgba(167,139,250,0.07)] text-[#a78bfa] text-xs font-medium mb-4">
            Por que Orkiestri
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 leading-[1.1]">
            Tudo que uma operação
            <br className="hidden sm:block" /> corporativa precisa
          </h2>
          <p className="text-[rgba(235,235,245,0.52)] text-lg max-w-2xl mx-auto leading-relaxed">
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
          {/* Row 1: [large 2col] [small] [small] */}
          <LargeCard benefit={BENEFITS[0]} />
          <SmallCard benefit={BENEFITS[1]} index={1} />
          <SmallCard benefit={BENEFITS[2]} index={2} />

          {/* Row 2: [small] [small] [large 2col] */}
          <SmallCard benefit={BENEFITS[4]} index={4} />
          <SmallCard benefit={BENEFITS[5]} index={5} />
          <LargeCard benefit={BENEFITS[3]} />

          {/* Row 3: [medium 2col] [medium 2col] */}
          <SmallCard benefit={BENEFITS[6]} index={6} wide />
          <SmallCard benefit={BENEFITS[7]} index={7} wide />
        </motion.div>
      </div>
    </section>
  )
}
