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
    glow: 'rgba(167,139,250,0.16)',
    tags: ['CRM', 'Projetos', 'Chamados', 'Financeiro', 'Fornecedores'],
  },
  {
    icon: DollarSign,
    title: 'CAPEX / OPEX',
    description: 'Controle total de orçamentos, ciclos financeiros e centros de custo com rastreabilidade completa.',
    color: '#34d399',
    glow: 'rgba(52,211,153,0.14)',
  },
  {
    icon: ShieldCheck,
    title: 'Segurança enterprise',
    description: 'Multi-tenant isolado, JWT com refresh, permissões granulares e proteção OWASP nativa.',
    color: '#34d399',
    glow: 'rgba(52,211,153,0.14)',
  },
  {
    icon: Users,
    title: 'CRM corporativo',
    description: 'Pipeline de clientes, histórico de relacionamento, contratos e comunicação integrados. Escale o relacionamento sem perder nenhum detalhe.',
    color: '#22d3ee',
    glow: 'rgba(34,211,238,0.14)',
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
    glow: 'rgba(251,191,36,0.14)',
  },
  {
    icon: GitBranch,
    title: 'Rastreabilidade total',
    description: 'Trilha de auditoria completa — quem fez, quando e o quê, para cada ação no sistema.',
    color: '#a78bfa',
    glow: 'rgba(167,139,250,0.14)',
  },
  {
    icon: TrendingUp,
    title: 'Escalabilidade real',
    description: 'Arquitetura preparada para crescer com sua empresa, sem refatorações ou migrações forçadas.',
    color: '#22d3ee',
    glow: 'rgba(34,211,238,0.14)',
  },
  {
    icon: Zap,
    title: 'Automação operacional',
    description: 'Fluxos automáticos de aprovação, notificações e gatilhos — menos trabalho manual, mais resultado.',
    color: '#fbbf24',
    glow: 'rgba(251,191,36,0.14)',
  },
]

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
}

const itemAnim = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}

/* ── Small card — padrão da landing (1 col) ── */
function SmallCard({ benefit, index, wide }: { benefit: Benefit; index: number; wide?: boolean }) {
  const Icon = benefit.icon
  return (
    <motion.div
      variants={itemAnim}
      className={`lp-card group relative rounded-2xl border border-[rgba(162,130,255,0.1)] backdrop-blur-sm p-6 overflow-hidden cursor-default transition-all duration-300 hover:-translate-y-1.5 hover:border-[rgba(162,130,255,0.28)]${wide ? ' lg:col-span-2' : ''}`}
    >
      {/* Linha de acento no topo — cor do card */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent, ${benefit.color}70, transparent)` }}
      />

      {/* Glow ambiente no canto */}
      <div
        className="absolute -top-10 -left-10 w-36 h-36 rounded-full pointer-events-none opacity-50"
        style={{ background: `radial-gradient(circle, ${benefit.glow}, transparent 70%)` }}
      />

      {/* Hover: sweep radial */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 20% 0%, ${benefit.glow}, transparent 60%)` }}
      />

      {/* Hover: borda interna colorida */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: `inset 0 0 0 1px ${benefit.color}22` }}
      />

      {/* Número de índice decorativo */}
      <div
        className="absolute top-4 right-5 text-[10px] font-mono tabular-nums select-none pointer-events-none"
        style={{ color: benefit.color, opacity: 0.2 }}
      >
        {String(index + 1).padStart(2, '0')}
      </div>

      <div className="relative">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
          style={{ background: `${benefit.color}18`, border: `1px solid ${benefit.color}30` }}
        >
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
}

/* ── Large card — destaque (2 cols) ── */
function LargeCard({ benefit }: { benefit: Benefit }) {
  const Icon = benefit.icon
  return (
    <motion.div
      variants={itemAnim}
      className="lp-card group relative lg:col-span-2 rounded-2xl border border-[rgba(162,130,255,0.1)] backdrop-blur-sm p-7 overflow-hidden cursor-default transition-all duration-300 hover:-translate-y-1.5 hover:border-[rgba(162,130,255,0.28)]"
    >
      {/* Linha de acento no topo — cor do card */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{ background: `linear-gradient(90deg, ${benefit.color}80, transparent 60%)` }}
      />

      {/* Glow no canto superior direito */}
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${benefit.glow}, transparent 65%)`, opacity: 0.7 }}
      />

      {/* Hover: sweep radial */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 30% 0%, ${benefit.glow}, transparent 55%)` }}
      />

      {/* Hover: borda interna colorida */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: `inset 0 0 0 1px ${benefit.color}28` }}
      />

      <div className="relative">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
          style={{ background: `${benefit.color}18`, border: `1px solid ${benefit.color}30` }}
        >
          <Icon size={20} style={{ color: benefit.color }} />
        </div>

        <h3 className="font-display font-bold text-[var(--text-primary)] mb-2 text-[17px] leading-snug">
          {benefit.title}
        </h3>
        <p className="text-[var(--text-secondary)] text-sm leading-relaxed max-w-sm">
          {benefit.description}
        </p>

        {benefit.tags && (
          <div className="flex flex-wrap gap-2 mt-5">
            {benefit.tags.map(tag => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full text-[10px] font-mono"
                style={{
                  background: `${benefit.color}10`,
                  border: `1px solid ${benefit.color}20`,
                  color: `${benefit.color}cc`,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {benefit.stats && (
          <div className="grid grid-cols-3 gap-2 mt-5">
            {benefit.stats.map(stat => (
              <div
                key={stat.label}
                className="rounded-xl p-2.5 border text-center"
                style={{
                  background: `${benefit.color}08`,
                  borderColor: `${benefit.color}18`,
                }}
              >
                <div className="font-display font-bold text-sm" style={{ color: benefit.color }}>
                  {stat.value}
                </div>
                <div className="text-[9px] text-[var(--text-muted)] mt-0.5">{stat.label}</div>
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
      {/* Background */}
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
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgba(167,139,250,0.2)] bg-[rgba(167,139,250,0.07)] text-[var(--accent-violet)] text-xs font-medium mb-4">
            Por que Orkiestri
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--text-primary)] mb-4 leading-[1.1]">
            Tudo que uma operação
            <br className="hidden sm:block" /> corporativa precisa
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
          {/* Linha 1: [large 2col] [small] [small] */}
          <LargeCard benefit={BENEFITS[0]} />
          <SmallCard benefit={BENEFITS[1]} index={1} />
          <SmallCard benefit={BENEFITS[2]} index={2} />

          {/* Linha 2: [small] [small] [large 2col] */}
          <SmallCard benefit={BENEFITS[4]} index={4} />
          <SmallCard benefit={BENEFITS[5]} index={5} />
          <LargeCard benefit={BENEFITS[3]} />

          {/* Linha 3: [medium 2col] [medium 2col] — sem cards orphãos */}
          <SmallCard benefit={BENEFITS[6]} index={6} wide />
          <SmallCard benefit={BENEFITS[7]} index={7} wide />
        </motion.div>
      </div>
    </section>
  )
}
