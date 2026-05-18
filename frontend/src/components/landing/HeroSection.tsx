'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, ChevronRight, TrendingUp, Bell, CheckCircle2 } from 'lucide-react'

function scrollTo(href: string) {
  const el = document.querySelector(href)
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - 80
  window.scrollTo({ top, behavior: 'smooth' })
}

/* ── Dashboard Mockup ── */
function DashboardMockup() {
  const metrics = [
    { label: 'Chamados abertos', value: '248', color: '#a78bfa', pct: '↓ 12%' },
    { label: 'Projetos ativos', value: '18', color: '#22d3ee', pct: '↑ 4' },
    { label: 'Fornecedores', value: '94', color: '#34d399', pct: '↑ 8%' },
  ]
  const activities = [
    { label: 'Projeto Expansão Alpha', tag: 'Projetos', status: 'Em andamento' },
    { label: 'Chamado #1.034 — TI', tag: 'Suporte', status: 'Aguardando' },
    { label: 'Fornecedor Avaliado', tag: 'Fornecedores', status: 'Concluído' },
    { label: 'Orçamento Q2 aprovado', tag: 'Financeiro', status: 'Aprovado' },
  ]

  const statusColor: Record<string, string> = {
    'Em andamento': '#a78bfa',
    'Aguardando': '#fbbf24',
    'Concluído': '#34d399',
    'Aprovado': '#22d3ee',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full max-w-[580px] mx-auto lg:mx-0"
    >
      {/* Glow behind */}
      <div className="absolute -inset-6 bg-gradient-to-br from-violet-600/20 via-violet-500/5 to-cyan-500/10 rounded-3xl blur-3xl pointer-events-none" />

      {/* Floating badge — TrendingUp */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.1, duration: 0.5 }}
        className="absolute -top-4 -right-2 sm:right-4 z-20 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0c0c22]/95 border border-[rgba(52,211,153,0.3)] backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
      >
        <TrendingUp size={14} className="text-[#34d399]" />
        <span className="text-xs font-medium text-[#34d399]">↑ 24% eficiência operacional</span>
      </motion.div>

      {/* Floating notification */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.3, duration: 0.5 }}
        className="absolute -bottom-4 -left-2 sm:left-4 z-20 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0c0c22]/95 border border-[rgba(167,139,250,0.25)] backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
      >
        <Bell size={12} className="text-[var(--accent-violet)]" />
        <span className="text-xs text-[var(--text-secondary)]">Novo chamado criado</span>
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-violet)] animate-pulse" />
      </motion.div>

      {/* App window */}
      <div className="relative rounded-2xl border border-[rgba(162,130,255,0.18)] bg-[#0a0a1e] overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.7)]">

        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[rgba(162,130,255,0.1)] bg-[#06060f]">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
          </div>
          <span className="flex-1 text-center text-[10px] text-[var(--text-muted)] font-mono">
            orkiestri.com/dashboard
          </span>
        </div>

        {/* App layout */}
        <div className="flex" style={{ minHeight: 340 }}>

          {/* Sidebar */}
          <div className="w-10 sm:w-14 border-r border-[rgba(162,130,255,0.08)] flex flex-col items-center py-3 gap-3 bg-[#07071a] shrink-0">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center mb-1">
              <span className="text-white text-[8px] font-bold">O</span>
            </div>
            {['⌂','◫','◉','⬡','▤','◈'].map((icon, i) => (
              <div key={i} className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] transition-colors ${i === 0 ? 'bg-[rgba(167,139,250,0.15)] text-[var(--accent-violet)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
                {icon}
              </div>
            ))}
          </div>

          {/* Main content */}
          <div className="flex-1 p-3 sm:p-4 overflow-hidden">

            {/* Topbar */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[10px] text-[var(--text-muted)]">Painel Geral</div>
                <div className="text-xs sm:text-sm font-display font-semibold text-[var(--text-primary)]">Bem-vindo, Guilherme</div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white text-[9px] font-bold">G</div>
              </div>
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {metrics.map((m, i) => (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + i * 0.12, duration: 0.4 }}
                  className="rounded-xl border border-[rgba(162,130,255,0.1)] bg-[rgba(12,12,34,0.6)] p-2 sm:p-2.5"
                >
                  <div className="text-[8px] sm:text-[9px] text-[var(--text-muted)] mb-1 truncate">{m.label}</div>
                  <div className="text-sm sm:text-base font-display font-bold" style={{ color: m.color }}>{m.value}</div>
                  <div className="text-[8px] mt-0.5" style={{ color: m.color, opacity: 0.7 }}>{m.pct}</div>
                </motion.div>
              ))}
            </div>

            {/* Activity list */}
            <div className="rounded-xl border border-[rgba(162,130,255,0.1)] bg-[rgba(12,12,34,0.4)] overflow-hidden">
              <div className="px-3 py-2 border-b border-[rgba(162,130,255,0.08)]">
                <span className="text-[9px] sm:text-[10px] font-medium text-[var(--text-secondary)]">Atividades Recentes</span>
              </div>
              {activities.map((a, i) => (
                <motion.div
                  key={a.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 + i * 0.1, duration: 0.3 }}
                  className="flex items-center gap-2 px-3 py-2 border-b border-[rgba(162,130,255,0.05)] last:border-0"
                >
                  <CheckCircle2 size={10} style={{ color: statusColor[a.status], flexShrink: 0 }} />
                  <span className="flex-1 text-[9px] sm:text-[10px] text-[var(--text-secondary)] truncate">{a.label}</span>
                  <span className="text-[7px] sm:text-[8px] px-1.5 py-0.5 rounded-full border shrink-0"
                    style={{ color: statusColor[a.status], borderColor: `${statusColor[a.status]}40`, background: `${statusColor[a.status]}10` }}>
                    {a.status}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/* ── Hero Section ── */
export default function HeroSection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true })

  return (
    <section ref={ref} className="relative min-h-screen flex items-center overflow-hidden pt-20">

      {/* Background layers */}
      <div className="absolute inset-0 pointer-events-none select-none">
        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.035]"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(162,130,255,1) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
        {/* Orb violet */}
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-violet-600/10 blur-[120px] animate-pulse" style={{ animationDuration: '6s' }} />
        {/* Orb cyan */}
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-cyan-500/8 blur-[100px] animate-pulse" style={{ animationDuration: '8s', animationDelay: '2s' }} />
        {/* Gradient bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[var(--bg-primary)] to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-12 lg:py-0">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left — Text */}
          <div className="text-center lg:text-left">
            {/* Tag */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgba(167,139,250,0.25)] bg-[rgba(167,139,250,0.08)] text-[var(--accent-violet)] text-xs font-medium mb-6"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-violet)] animate-pulse" />
              Plataforma Enterprise · 2025
            </motion.div>

            {/* H1 */}
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="font-display text-4xl sm:text-5xl lg:text-6xl xl:text-[64px] font-bold leading-[1.08] tracking-tight text-[var(--text-primary)] mb-6"
            >
              Profundidade{' '}
              <span className="relative">
                <span className="bg-gradient-to-r from-violet-400 via-violet-300 to-cyan-400 bg-clip-text text-transparent">
                  corporativa
                </span>
              </span>
              {' '}com experiência{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                moderna.
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="text-[var(--text-secondary)] text-lg lg:text-xl leading-relaxed max-w-xl mx-auto lg:mx-0 mb-8"
            >
              Centralize CRM, projetos, fornecedores, financeiro e operações em uma plataforma única — integrada, fluida e construída para escalar.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start"
            >
              <button
                onClick={() => {
                  /* Analytics: dispare evento "demo_request" aqui */
                  scrollTo('#contato')
                }}
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white font-medium hover:from-violet-500 hover:to-violet-400 transition-all shadow-[0_0_24px_rgba(124,58,237,0.45)] hover:shadow-[0_0_36px_rgba(124,58,237,0.65)] hover:-translate-y-0.5 active:translate-y-0 text-sm"
              >
                Solicitar demonstração <ArrowRight size={16} />
              </button>

              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-[rgba(162,130,255,0.22)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[rgba(162,130,255,0.4)] hover:bg-[rgba(167,139,250,0.05)] transition-all text-sm"
              >
                Entrar no sistema <ChevronRight size={16} />
              </Link>
            </motion.div>

            {/* Social proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex items-center gap-4 mt-8 justify-center lg:justify-start"
            >
              <div className="flex -space-x-2">
                {['G','T','R','M'].map((l, i) => (
                  <div key={i} className="w-7 h-7 rounded-full border-2 border-[#06060f] bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white text-[9px] font-bold">
                    {l}
                  </div>
                ))}
              </div>
              <div className="text-sm text-[var(--text-muted)]">
                <span className="text-[var(--text-secondary)] font-medium">+120 empresas</span> já centralizam sua operação
              </div>
            </motion.div>
          </div>

          {/* Right — Mockup */}
          <div className="flex justify-center lg:justify-end">
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  )
}
