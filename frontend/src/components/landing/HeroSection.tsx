'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, ChevronRight, TrendingUp, Bell, CheckCircle2, Zap, BarChart3 } from 'lucide-react'

function scrollTo(href: string) {
  const el = document.querySelector(href)
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - 80
  window.scrollTo({ top, behavior: 'smooth' })
}

/* ── Mini sparkline SVG ── */
function Sparkline({ color, data }: { color: string; data: number[] }) {
  const w = 64, h = 24, pad = 2
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2)
      const y = h - pad - ((v - min) / range) * (h - pad * 2)
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <polyline points={points} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ── Dashboard Mockup ── */
function DashboardMockup() {
  const metrics = [
    { label: 'Chamados', value: '248', trend: '↓ 12%', color: '#a78bfa', sparkData: [30, 45, 38, 52, 41, 35, 28] },
    { label: 'Projetos', value: '18', trend: '↑ 4', color: '#22d3ee', sparkData: [10, 12, 11, 14, 15, 16, 18] },
    { label: 'Fornecedores', value: '94', trend: '↑ 8%', color: '#34d399', sparkData: [75, 78, 80, 85, 88, 90, 94] },
    { label: 'CSAT Score', value: '4.9', trend: '↑ 0.2', color: '#fbbf24', sparkData: [4.5, 4.6, 4.7, 4.7, 4.8, 4.8, 4.9] },
  ]

  const activities = [
    { label: 'Projeto Expansão Alpha', tag: 'Projetos', status: 'Em andamento', color: '#a78bfa' },
    { label: 'Chamado #1.034 — TI', tag: 'Suporte', status: 'Aguardando', color: '#fbbf24' },
    { label: 'Fornecedor Delta avaliado', tag: 'Fornecedores', status: 'Concluído', color: '#34d399' },
    { label: 'Orçamento Q2 aprovado', tag: 'Financeiro', status: 'Aprovado', color: '#22d3ee' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 44, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full max-w-[620px] mx-auto lg:mx-0"
    >
      {/* Ambient glow */}
      <div className="absolute -inset-8 bg-gradient-to-br from-violet-600/18 via-violet-500/4 to-cyan-500/10 rounded-3xl blur-3xl pointer-events-none" />

      {/* Floating badge top-right */}
      <motion.div
        initial={{ opacity: 0, x: 20, y: -10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 1.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="absolute -top-5 right-2 sm:right-6 z-20 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#080820]/95 border border-[rgba(52,211,153,0.35)] backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
      >
        <TrendingUp size={13} className="text-[#34d399]" />
        <span className="text-[11px] font-semibold text-[#34d399]">↑ 24% eficiência operacional</span>
      </motion.div>

      {/* Floating notification bottom-left */}
      <motion.div
        initial={{ opacity: 0, x: -20, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 1.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="absolute -bottom-5 left-2 sm:left-6 z-20 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#080820]/95 border border-[rgba(167,139,250,0.28)] backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
      >
        <div className="w-5 h-5 rounded-lg bg-violet-600/20 flex items-center justify-center shrink-0">
          <Bell size={10} className="text-[#a78bfa]" />
        </div>
        <div>
          <div className="text-[10px] text-[rgba(167,139,250,0.9)] font-medium leading-none">Novo chamado criado via WhatsApp</div>
          <div className="text-[9px] text-[rgba(255,255,255,0.3)] mt-0.5">agora mesmo</div>
        </div>
        <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] animate-pulse shrink-0" />
      </motion.div>

      {/* App window */}
      <div className="relative rounded-2xl border border-[rgba(162,130,255,0.2)] bg-[#08081e] overflow-hidden shadow-[0_28px_90px_rgba(0,0,0,0.75),0_0_0_1px_rgba(162,130,255,0.08)]">

        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[rgba(162,130,255,0.1)] bg-[#05051a]">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="flex-1 mx-3">
            <div className="max-w-[180px] mx-auto flex items-center gap-2 bg-[rgba(255,255,255,0.04)] rounded px-2.5 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
              <span className="text-[9px] text-[rgba(255,255,255,0.25)] font-mono">orkiestri.com/dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 rounded bg-[rgba(255,255,255,0.04)] flex items-center justify-center">
              <BarChart3 size={9} className="text-[rgba(255,255,255,0.2)]" />
            </div>
            <div className="w-5 h-5 rounded bg-[rgba(255,255,255,0.04)] flex items-center justify-center">
              <Zap size={9} className="text-[rgba(255,255,255,0.2)]" />
            </div>
          </div>
        </div>

        {/* App layout */}
        <div className="flex" style={{ minHeight: 360 }}>

          {/* Mini sidebar */}
          <div className="w-11 sm:w-14 border-r border-[rgba(162,130,255,0.07)] flex flex-col items-center py-3 gap-2.5 bg-[#06061a] shrink-0">
            <div className="w-6 h-6 rounded-[7px] bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center mb-1 shadow-[0_0_10px_rgba(124,58,237,0.4)]">
              <span className="text-white text-[8px] font-bold">O</span>
            </div>
            {['⌂', '◫', '◉', '⬡', '▤', '◈', '⊞'].map((icon, i) => (
              <div key={i} className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] transition-colors ${i === 0 ? 'bg-[rgba(167,139,250,0.15)] text-[#a78bfa]' : 'text-[rgba(255,255,255,0.2)]'}`}>
                {icon}
              </div>
            ))}
          </div>

          {/* Main content */}
          <div className="flex-1 p-3 sm:p-4 overflow-hidden min-w-0">

            {/* Topbar */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[9px] text-[rgba(255,255,255,0.2)] font-mono uppercase tracking-wider">Painel Geral</div>
                <div className="text-xs sm:text-sm font-display font-semibold text-[rgba(255,255,255,0.85)]">Bom dia, Guilherme</div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-[rgba(52,211,153,0.1)] border border-[rgba(52,211,153,0.2)]">
                  <span className="w-1 h-1 rounded-full bg-[#34d399] animate-pulse" />
                  <span className="text-[9px] text-[#34d399] font-mono">Ao vivo</span>
                </div>
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white text-[9px] font-bold shadow-[0_0_8px_rgba(124,58,237,0.4)]">G</div>
              </div>
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {metrics.map((m, i) => (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.65 + i * 0.1, duration: 0.4 }}
                  className="rounded-xl border border-[rgba(162,130,255,0.1)] bg-[rgba(12,12,36,0.7)] p-2.5"
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="text-[8px] sm:text-[9px] text-[rgba(255,255,255,0.3)] truncate pr-1">{m.label}</div>
                    <Sparkline color={m.color} data={m.sparkData} />
                  </div>
                  <div className="text-sm sm:text-base font-display font-bold" style={{ color: m.color }}>{m.value}</div>
                  <div className="text-[8px] mt-0.5 font-mono" style={{ color: m.color, opacity: 0.7 }}>{m.trend}</div>
                </motion.div>
              ))}
            </div>

            {/* Activity list */}
            <div className="rounded-xl border border-[rgba(162,130,255,0.1)] bg-[rgba(10,10,30,0.5)] overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[rgba(162,130,255,0.07)]">
                <span className="text-[9px] sm:text-[10px] font-display font-semibold text-[rgba(255,255,255,0.5)]">Atividades Recentes</span>
                <span className="text-[8px] text-[rgba(167,139,250,0.6)] font-mono">ver todas →</span>
              </div>
              {activities.map((a, i) => (
                <motion.div
                  key={a.label}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.85 + i * 0.09, duration: 0.3 }}
                  className="flex items-center gap-2 px-3 py-2 border-b border-[rgba(162,130,255,0.05)] last:border-0 hover:bg-[rgba(167,139,250,0.03)] transition-colors"
                >
                  <CheckCircle2 size={9} style={{ color: a.color, flexShrink: 0 }} />
                  <span className="flex-1 text-[9px] sm:text-[10px] text-[rgba(255,255,255,0.45)] truncate">{a.label}</span>
                  <span className="text-[7px] sm:text-[8px] px-1.5 py-0.5 rounded-full border shrink-0 font-mono"
                    style={{ color: a.color, borderColor: `${a.color}35`, background: `${a.color}10` }}>
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
        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.032]"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(162,130,255,1) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
        {/* Primary orb */}
        <div className="absolute top-1/4 left-1/4 w-[700px] h-[700px] rounded-full bg-violet-600/10 blur-[130px]" style={{ animation: 'pulse 8s ease-in-out infinite' }} />
        {/* Cyan orb */}
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-cyan-500/7 blur-[110px]" style={{ animation: 'pulse 10s ease-in-out infinite', animationDelay: '3s' }} />
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#070711] to-transparent" />
        {/* Top corner accent */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/5 blur-[80px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-12 lg:py-0">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left — Text */}
          <div className="text-center lg:text-left">

            {/* Pill tag */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgba(167,139,250,0.28)] bg-[rgba(167,139,250,0.08)] text-[#a78bfa] text-xs font-medium mb-6"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] animate-pulse" />
              Plataforma Enterprise · 2025
            </motion.div>

            {/* H1 */}
            <motion.h1
              initial={{ opacity: 0, y: 28 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.75, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="font-display text-4xl sm:text-5xl lg:text-6xl xl:text-[66px] font-bold leading-[1.07] tracking-tight text-[var(--text-primary)] mb-6"
            >
              Profundidade{' '}
              <span className="bg-gradient-to-r from-violet-400 via-violet-300 to-fuchsia-400 bg-clip-text text-transparent">
                corporativa
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
              transition={{ duration: 0.6, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="text-[var(--text-secondary)] text-lg lg:text-xl leading-relaxed max-w-xl mx-auto lg:mx-0 mb-8"
            >
              Centralize CRM, projetos, fornecedores, financeiro e operações em uma plataforma única — integrada, fluida e construída para escalar.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.28 }}
              className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start"
            >
              <button
                onClick={() => scrollTo('#contato')}
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white font-semibold hover:from-violet-500 hover:to-violet-400 transition-all shadow-[0_0_28px_rgba(124,58,237,0.5)] hover:shadow-[0_0_40px_rgba(124,58,237,0.7)] hover:-translate-y-0.5 active:translate-y-0 text-sm"
              >
                Solicitar demonstração <ArrowRight size={15} />
              </button>

              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-[rgba(162,130,255,0.22)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[rgba(162,130,255,0.45)] hover:bg-[rgba(167,139,250,0.05)] transition-all text-sm"
              >
                Entrar no sistema <ChevronRight size={15} />
              </Link>
            </motion.div>

            {/* Social proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ duration: 0.7, delay: 0.48 }}
              className="flex flex-col sm:flex-row items-center gap-5 mt-10 justify-center lg:justify-start"
            >
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {['G', 'T', 'R', 'M', 'A'].map((l, i) => (
                    <div key={i} className="w-7 h-7 rounded-full border-2 border-[#07071a] bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white text-[9px] font-bold">
                      {l}
                    </div>
                  ))}
                </div>
                <div className="text-sm text-[var(--text-muted)]">
                  <span className="text-[var(--text-secondary)] font-medium">+120 empresas</span> já centralizam sua operação
                </div>
              </div>
              <div className="hidden sm:block w-px h-6 bg-[rgba(162,130,255,0.1)]" />
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill="#fbbf24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                  ))}
                </div>
                <span className="text-sm text-[var(--text-muted)]">4,9 / 5 satisfação</span>
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
