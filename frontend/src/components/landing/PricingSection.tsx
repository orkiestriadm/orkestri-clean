'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Check, ArrowRight, Zap } from 'lucide-react'

function scrollTo(href: string) {
  const el = document.querySelector(href)
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - 80
  window.scrollTo({ top, behavior: 'smooth' })
}

const PLANS = [
  {
    name: 'Starter',
    desc: 'Para equipes que estão começando a centralizar sua operação.',
    price: 'Sob consulta',
    priceNote: 'Entre em contato para detalhes',
    highlight: false,
    badge: null as string | null,
    color: '#a78bfa',
    features: [
      'Até 15 usuários',
      'CRM e pipeline de clientes',
      'Gestão de chamados (Service Desk)',
      'Projetos e tarefas',
      'Agenda integrada',
      'Relatórios básicos',
      'Suporte por e-mail',
    ],
    cta: 'Solicitar acesso',
  },
  {
    name: 'Business',
    desc: 'Para empresas que precisam de gestão completa e automações inteligentes.',
    price: 'Sob consulta',
    priceNote: 'Plano mais completo',
    highlight: true,
    badge: 'Mais popular',
    color: '#7c3aed',
    features: [
      'Usuários ilimitados',
      'CRM avançado + contratos e faturas',
      'CAPEX / OPEX completo',
      'Gestão de fornecedores',
      'Automações e workflows',
      'Notificações via WhatsApp',
      'Dashboards executivos',
      'CSAT e métricas de SLA',
      'Suporte prioritário',
    ],
    cta: 'Solicitar demonstração',
  },
  {
    name: 'Enterprise',
    desc: 'Para grandes operações com requisitos avançados de segurança e escala.',
    price: 'Personalizado',
    priceNote: 'Proposta sob medida',
    highlight: false,
    badge: null as string | null,
    color: '#22d3ee',
    features: [
      'Tudo do Business',
      'Multi-tenant isolado',
      'SSO / SAML / LDAP',
      'API completa + webhooks',
      'SLA garantido 99,9%',
      'Onboarding dedicado',
      'Gerente de conta exclusivo',
      'Contrato personalizado',
    ],
    cta: 'Falar com o time',
  },
]

export default function PricingSection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-8%' })

  return (
    <section ref={ref} id="planos" className="relative py-24 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(167,139,250,0.2)] to-transparent" />
        <div className="absolute top-1/2 left-0 w-[700px] h-[700px] bg-violet-600/5 blur-[140px] rounded-full -translate-y-1/2" />
        <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-cyan-500/5 blur-[120px] rounded-full -translate-y-1/2" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgba(167,139,250,0.2)] bg-[rgba(167,139,250,0.07)] text-[var(--accent-violet)] text-xs font-medium mb-4">
            <Zap size={12} /> Planos e preços
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--text-primary)] mb-4 leading-[1.1]">
            Crescimento sem limite,
            <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              {' '}custo sob controle.
            </span>
          </h2>
          <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto leading-relaxed">
            Escolha o plano ideal para sua operação. Todos incluem onboarding dedicado e suporte especializado.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 items-center">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 36 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1 + i * 0.12, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              className={`relative rounded-2xl border flex flex-col transition-all duration-300 ${
                plan.highlight
                  ? 'bg-gradient-to-b from-[rgba(124,58,237,0.14)] to-[rgba(10,10,28,0.9)] border-[rgba(124,58,237,0.45)] shadow-[0_0_60px_rgba(124,58,237,0.12),0_0_0_1px_rgba(124,58,237,0.15)] scale-[1.02] lg:scale-105'
                  : 'bg-[rgba(10,10,28,0.6)] border-[rgba(162,130,255,0.1)] backdrop-blur-sm hover:border-[rgba(162,130,255,0.25)] hover:-translate-y-1'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-violet-600 to-violet-500 text-white text-[11px] font-semibold shadow-[0_0_20px_rgba(124,58,237,0.5)] whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="p-7 pb-5">
                <div className="mb-5 pt-1">
                  <h3 className="font-display font-bold text-xl text-[var(--text-primary)] mb-1.5">{plan.name}</h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{plan.desc}</p>
                </div>

                <div className="pb-5 mb-5 border-b border-[rgba(162,130,255,0.1)]">
                  <div className="font-display font-bold text-2xl text-[var(--text-primary)]">{plan.price}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">{plan.priceNote}</div>
                </div>

                <ul className="flex flex-col gap-3 mb-7">
                  {plan.features.map(feat => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)]">
                      <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: `${plan.color}18`, border: `1px solid ${plan.color}35` }}>
                        <Check size={9} style={{ color: plan.color }} strokeWidth={2.5} />
                      </div>
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="px-7 pb-7 mt-auto">
                <button
                  onClick={() => scrollTo('#contato')}
                  className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    plan.highlight
                      ? 'bg-gradient-to-r from-violet-600 to-violet-500 text-white hover:from-violet-500 hover:to-violet-400 shadow-[0_0_20px_rgba(124,58,237,0.4)] hover:shadow-[0_0_32px_rgba(124,58,237,0.6)] hover:-translate-y-0.5 active:translate-y-0'
                      : 'border border-[rgba(162,130,255,0.22)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[rgba(162,130,255,0.4)] hover:bg-[rgba(167,139,250,0.06)]'
                  }`}
                >
                  {plan.cta} <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.65, duration: 0.5 }}
          className="text-center text-xs text-[var(--text-muted)] mt-10"
        >
          Sem taxa de implantação · Onboarding incluído · Suporte durante todo o contrato
        </motion.p>
      </div>
    </section>
  )
}
