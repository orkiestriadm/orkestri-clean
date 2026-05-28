'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Check, Sparkles, TrendingDown, XCircle, CheckCircle2 } from 'lucide-react'

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
    <section ref={ref} className="relative py-12 lg:py-16 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(167,139,250,0.25)] to-transparent" />
        <div className="absolute top-1/4 left-0 w-[700px] h-[700px] bg-violet-600/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-1/4 right-0 w-[500px] h-[500px] bg-cyan-500/7 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10"
        >
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1 + i * 0.1, duration: 0.5 }}
              className="lp-card rounded-2xl border border-[rgba(255,255,255,0.07)] backdrop-blur-md p-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            >
              <div className="font-display font-bold text-3xl sm:text-4xl mb-1" style={{ color: stat.color }}>
                {stat.value}
              </div>
              <div className="text-[var(--text-muted)] text-sm">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Main content — two columns */}
        <div className="grid lg:grid-cols-2 gap-10 items-center">

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
            <div className="lp-card-sm rounded-2xl border border-[rgba(255,255,255,0.07)] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
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
                  className="lp-card-sm flex items-start gap-3 p-4 rounded-xl border border-[rgba(255,255,255,0.05)] hover:border-[rgba(167,139,250,0.22)] transition-all duration-200 hover:-translate-x-0 hover:shadow-[0_0_20px_rgba(124,58,237,0.06)]"
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

        {/* ── ROI Block ── */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12"
        >
          {/* Header */}
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgba(52,211,153,0.2)] bg-[rgba(52,211,153,0.06)] text-[#34d399] text-xs font-medium mb-5">
              <TrendingDown size={12} /> Análise de Economia
            </span>
            <h3 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-[var(--text-primary)] mb-3">
              Quanto você gasta hoje com sistemas separados?
            </h3>
            <p className="text-[var(--text-secondary)] text-base max-w-2xl mx-auto">
              Uma equipe de 5 pessoas utilizando as ferramentas tradicionais de mercado paga, em média, isso por mês:
            </p>
          </div>

          {/* Comparison cards */}
          <div className="grid lg:grid-cols-2 gap-6 mb-6">

            {/* Legacy stack */}
            <div className="lp-card rounded-2xl border border-[rgba(239,68,68,0.15)] p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-red-500/5 blur-3xl rounded-full pointer-events-none" />
              <h4 className="text-sm font-bold text-red-400 mb-5 flex items-center gap-2">
                <XCircle size={16} />
                Custo da Stack Fragmentada — 5 agentes
              </h4>
              <div className="space-y-3 mb-5">
                {[
                  { nome: 'Sistema de Gestão de Projetos', valor: 'R$ 1.300' },
                  { nome: 'Sistema de Gestão de Chamados', valor: 'R$ 700' },
                  { nome: 'Suite de Produtividade (E-mail, Agenda, Tarefas)', valor: 'R$ 850' },
                  { nome: 'Plataforma de Analytics e BI', valor: 'R$ 350' },
                  { nome: 'Sistema de Gestão de Inventário', valor: 'R$ 700' },
                ].map((item) => (
                  <div key={item.nome} className="flex items-center justify-between border-b border-[rgba(255,255,255,0.05)] pb-3">
                    <span className="text-[var(--text-secondary)] text-xs pr-4">{item.nome}</span>
                    <span className="text-red-400 font-bold text-sm font-mono shrink-0">{item.valor}<span className="text-[var(--text-muted)] font-normal text-xs">/mês</span></span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.15)] rounded-xl px-4 py-3">
                <span className="text-[var(--text-primary)] text-sm font-semibold">Total mensal</span>
                <span className="text-red-400 font-extrabold text-xl font-mono">R$ 3.900<span className="text-[var(--text-muted)] font-normal text-xs">/mês</span></span>
              </div>
              <p className="text-right text-[var(--text-muted)] text-xs mt-2 font-mono">= R$ 46.800 por ano</p>
            </div>

            {/* Orkiestri */}
            <div className="lp-card rounded-2xl border border-[rgba(52,211,153,0.15)] p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 blur-3xl rounded-full pointer-events-none" />
              <h4 className="text-sm font-bold text-[#34d399] mb-5 flex items-center gap-2">
                <CheckCircle2 size={16} />
                Orkiestri Business Cloud — 5 usuários, tudo incluso
              </h4>
              <div className="flex flex-col items-center justify-center py-5 mb-5">
                <span className="font-display text-5xl font-extrabold text-[var(--text-primary)]">
                  R$ 99<span className="text-2xl">,90</span>
                </span>
                <span className="text-[var(--text-muted)] text-sm mt-1">por mês · todos os módulos</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {[
                  'Service Desk com SLA',
                  'Gestão de Projetos',
                  'Agenda Corporativa',
                  'CRM integrado',
                  'Dashboards em tempo real',
                  'WhatsApp integrado',
                ].map((f) => (
                  <div key={f} className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                    <Check size={11} className="text-[#34d399] shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between bg-[rgba(52,211,153,0.08)] border border-[rgba(52,211,153,0.15)] rounded-xl px-4 py-3">
                <span className="text-[var(--text-primary)] text-sm font-semibold">Total mensal</span>
                <span className="text-[#34d399] font-extrabold text-xl font-mono">R$ 99<span className="text-sm">,90</span><span className="text-[var(--text-muted)] font-normal text-xs">/mês</span></span>
              </div>
              <p className="text-right text-[var(--text-muted)] text-xs mt-2 font-mono">= R$ 1.198,80 por ano</p>
            </div>
          </div>

          {/* Savings banner */}
          <div className="relative rounded-2xl overflow-hidden border border-[rgba(52,211,153,0.2)] bg-gradient-to-r from-[rgba(52,211,153,0.05)] via-[rgba(52,211,153,0.08)] to-[rgba(52,211,153,0.05)] px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[rgba(52,211,153,0.12)] border border-[rgba(52,211,153,0.2)] flex items-center justify-center shrink-0">
                <TrendingDown size={22} className="text-[#34d399]" />
              </div>
              <div>
                <p className="text-[var(--text-primary)] font-semibold text-base">Economia anual estimada contratando o Orkiestri</p>
                <p className="text-[var(--text-muted)] text-xs mt-0.5">Comparado à manutenção de 5 sistemas separados para uma equipe de 5 agentes</p>
              </div>
            </div>
            <div className="text-center sm:text-right shrink-0">
              <p className="font-display text-4xl font-extrabold text-[#34d399]">R$ 45.601</p>
              <p className="text-[#34d399] text-sm font-semibold opacity-80">~97% de redução de custos ao ano</p>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  )
}
