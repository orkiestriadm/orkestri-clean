'use client'

import { useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useInView } from 'framer-motion'
import { Check, ArrowRight, Zap, Shield, Sparkles } from 'lucide-react'

function scrollTo(href: string) {
  const el = document.querySelector(href)
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - 80
  window.scrollTo({ top, behavior: 'smooth' })
}

const PLANS = [
  {
    name: 'Business Cloud',
    planKey: 'business_cloud',
    desc: 'Ideal para pequenas operações que precisam centralizar tarefas, chamados, projetos e gestão operacional em um único sistema.',
    price: 'R$ 99,90',
    pricePeriod: '/mês',
    adminUsers: '1 usuário',
    operationalUsers: '5 usuários',
    totalUsers: '6 usuários',
    isEnterprise: false,
    highlight: false,
    badge: null as string | null,
    color: '#a78bfa',
    colorRgb: '167, 139, 250',
    features: [
      'Gestão de chamados (Service Desk)',
      'Projetos e tarefas',
      'Agenda integrada',
      'Dashboards executivos',
      'Gestão operacional',
      'Controle orçamentário',
      'Workflows',
      'Suporte por e-mail',
    ],
    cta: 'Contrate Aqui!',
  },
  {
    name: 'Business Plus',
    planKey: 'business_plus',
    desc: 'Ideal para empresas em crescimento que precisam de automações, governança operacional e maior controle corporativo.',
    price: 'R$ 199,90',
    pricePeriod: '/mês',
    adminUsers: '2 usuários',
    operationalUsers: '10 usuários',
    totalUsers: '12 usuários',
    isEnterprise: false,
    highlight: true,
    badge: 'Mais popular',
    color: '#7c3aed',
    colorRgb: '124, 58, 237',
    features: [
      'Todas as funcionalidades do Business Cloud',
      'Automações e workflows avançados',
      'Gestão de contratos',
      'Gestão de fornecedores',
      'Indicadores SLA',
      'Métricas operacionais',
      'Notificações via WhatsApp',
      'Suporte prioritário',
    ],
    cta: 'Contrate Aqui!',
  },
  {
    name: 'Enterprise',
    planKey: 'enterprise',
    desc: 'Ideal para grandes operações que exigem escalabilidade, segurança avançada e ambiente corporativo personalizado.',
    price: 'à consultar',
    pricePeriod: '/mês',
    adminUsers: 'Configurável',
    operationalUsers: 'Configurável',
    totalUsers: 'Personalizado',
    isEnterprise: true,
    highlight: false,
    badge: null as string | null,
    color: '#22d3ee',
    colorRgb: '34, 211, 238',
    features: [
      'Tudo do Business Plus',
      'Multi-tenant isolado',
      'API completa + Webhooks',
      'SSO / SAML / LDAP',
      'Ambiente dedicado',
      'SLA corporativo',
      'Onboarding dedicado',
      'Gerente de conta exclusivo',
      'Contrato personalizado',
    ],
    cta: 'Falar com especialista',
  },
]

export default function PricingSection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-8%' })
  const router = useRouter()

  return (
    <section ref={ref} id="planos" className="relative py-10 lg:py-14 overflow-hidden">
      {/* Background radial highlights */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(167,139,250,0.25)] to-transparent" />
        <div className="absolute top-1/2 left-0 w-[700px] h-[700px] bg-violet-600/10 blur-[140px] rounded-full -translate-y-1/2" />
        <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-cyan-500/7 blur-[120px] rounded-full -translate-y-1/2" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-10"
        >
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgba(167,139,250,0.2)] bg-[rgba(167,139,250,0.07)] text-[var(--accent-violet)] text-xs font-semibold mb-4">
            <Zap size={12} className="text-violet-400" /> Planos e preços
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

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 items-stretch pt-4">
          {PLANS.map((plan, i) => {
            const isHighlight = plan.highlight
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 36 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.1 + i * 0.12, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col h-full relative"
              >
                {/* Wrapper que lida com o tamanho e efeitos de hover de forma independente do Framer Motion */}
                <div
                  className={`group/card relative flex flex-col h-full w-full transition-all duration-300 ease-out ${isHighlight
                      ? 'scale-[1.04] hover:scale-[1.06] hover:-translate-y-2 z-10'
                      : 'hover:scale-[1.01] hover:-translate-y-1 z-0'
                    }`}
                >
                  {/* Efeito Glow Pulsante do Botão para o card Mais Popular */}
                  {isHighlight && (
                    <div className="absolute -inset-1.5 rounded-[32px] bg-gradient-to-r from-cyan-500 via-violet-600 to-fuchsia-500 opacity-75 blur-xl group-hover/card:opacity-100 transition duration-1000 group-hover/card:duration-200 animate-pulse z-0" />
                  )}

                  {/* Card Container principal (SEM overflow-hidden para não cortar a etiqueta) */}
                  <div
                    className={`relative z-10 rounded-3xl border flex flex-col h-full w-full transition-all duration-300 ease-out ${isHighlight
                        ? 'bg-[#090918] text-white border-violet-500/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:border-[var(--accent-violet)] shadow-premium-sm hover:shadow-[0_20px_50px_rgba(167,139,250,0.15)]'
                      }`}
                  >
                    {/* Shiny layer inside card on hover */}
                    {isHighlight && (
                      <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 via-cyan-500/10 to-violet-600/10 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 pointer-events-none rounded-3xl" />
                    )}

                    {/* Top border shine effect for non-highlighted cards */}
                    {!isHighlight && (
                      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(167,139,250,0.4)] to-transparent opacity-20 group-hover/card:opacity-80 transition-opacity duration-300" />
                    )}

                    {/* Popular badge */}
                    {plan.badge && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-violet-600 to-violet-500 text-white text-[11px] font-bold shadow-[0_0_20px_rgba(124,58,237,0.5)] whitespace-nowrap uppercase tracking-wider">
                          <Sparkles size={10} className="animate-spin" style={{ animationDuration: '3s' }} />
                          {plan.badge}
                        </span>
                      </div>
                    )}

                    {/* Card Header (Title & Description) */}
                    <div className="p-6 pb-0">
                      <div className="pt-1">
                        <h3 className={`font-display font-bold text-xl mb-1.5 transition-colors ${isHighlight ? 'text-white' : 'text-[var(--text-primary)] group-hover/card:text-[var(--accent-violet)]'
                          }`}>
                          {plan.name}
                        </h3>
                        <p className={`text-xs leading-relaxed min-h-[48px] ${isHighlight ? 'text-slate-300' : 'text-[var(--text-secondary)]'
                          }`}>
                          {plan.desc}
                        </p>
                      </div>

                      {/* Users Limits block - Standardized Height */}
                      {plan.isEnterprise ? (
                        <div className={`mt-4 px-4 py-3 rounded-xl border flex flex-col justify-center min-h-[70px] relative overflow-hidden transition-colors ${isHighlight
                            ? 'bg-white/[0.02] border-white/5 group-hover/card:border-cyan-500/20'
                            : 'bg-[var(--bg-primary)] border-[var(--border-subtle)] group-hover/card:border-[var(--accent-violet)]/20'
                          }`}>
                          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300" />
                          <div className="text-xs font-bold text-cyan-400 mb-0.5 flex items-center gap-1.5">
                            <Shield size={12} />
                            Usuários Configuráveis
                          </div>
                          <div className={`text-[11px] leading-relaxed ${isHighlight ? 'text-slate-400' : 'text-[var(--text-secondary)]'
                            }`}>
                            Estrutura customizada sob medida de acordo com a necessidade.
                          </div>
                        </div>
                      ) : (
                        <div className={`mt-4 px-4 py-2.5 rounded-xl border flex flex-col gap-1 min-h-[70px] transition-colors ${isHighlight
                            ? 'bg-white/[0.02] border-white/5 group-hover/card:border-violet-500/20'
                            : 'bg-[var(--bg-primary)] border-[var(--border-subtle)] group-hover/card:border-[var(--accent-violet)]/20'
                          }`}>
                          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                            <span>Administradores</span>
                            <span className={`font-semibold ${isHighlight ? 'text-white' : 'text-[var(--text-primary)]'}`}>{plan.adminUsers}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                            <span>Usuários Operacionais</span>
                            <span className={`font-semibold ${isHighlight ? 'text-white' : 'text-[var(--text-primary)]'}`}>{plan.operationalUsers}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs border-t border-[var(--border-subtle)] pt-1.5 mt-0.5 text-[var(--text-secondary)] font-medium">
                            <span>Total de Usuários</span>
                            <span className="font-bold text-cyan-400 group-hover/card:text-cyan-300 transition-colors">{plan.totalUsers}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card Body (Price & Feature Checklist) */}
                    <div className="p-6 pt-5 flex-grow flex flex-col justify-between">
                      {/* Price Section */}
                      <div className="pb-4 mb-4 border-b border-[var(--border-subtle)]">
                        {plan.isEnterprise ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-bold font-display" style={{ color: plan.color }}>
                              à consultar
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-baseline">
                            <span className={`text-3xl md:text-4xl font-extrabold tracking-tight font-display ${isHighlight ? 'text-white' : 'text-[var(--text-primary)]'
                              }`}>{plan.price}</span>
                            <span className={`ml-1.5 text-xs font-medium ${isHighlight ? 'text-slate-400' : 'text-[var(--text-secondary)]'
                              }`}>{plan.pricePeriod}</span>
                          </div>
                        )}
                      </div>

                      {/* Features list */}
                      <ul className="flex flex-col gap-2 mb-5 flex-grow">
                        {plan.features.map(feat => (
                          <li key={feat} className={`flex items-start gap-2.5 text-xs ${isHighlight ? 'text-slate-300' : 'text-[var(--text-secondary)]'
                            }`}>
                            <div
                              className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors"
                              style={{
                                background: `rgba(${plan.colorRgb}, 0.08)`,
                                border: `1px solid rgba(${plan.colorRgb}, 0.25)`
                              }}
                            >
                              <Check size={10} style={{ color: plan.color }} strokeWidth={3} />
                            </div>
                            <span className="leading-snug">{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Card Footer (CTA Button) */}
                    <div className="px-6 pb-6 mt-auto">
                      <button
                        onClick={() => {
                          if (plan.isEnterprise) {
                            scrollTo('#contato')
                          } else {
                            router.push(`/signup?plano=${plan.planKey}`)
                          }
                        }}
                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${isHighlight
                            ? 'bg-gradient-to-r from-violet-600 to-violet-500 text-white hover:from-violet-500 hover:to-violet-400 shadow-[0_4px_20px_rgba(124,58,237,0.35)] hover:shadow-[0_8px_30px_rgba(124,58,237,0.55)] hover:-translate-y-0.5 active:translate-y-0'
                            : 'border border-[rgba(162,130,255,0.35)] text-[var(--text-primary)] hover:text-white hover:border-[var(--accent-violet)] hover:bg-[var(--accent-violet)] hover:-translate-y-0.5 active:translate-y-0 shadow-premium-sm'
                          }`}
                      >
                        <span>{plan.cta}</span>
                        <ArrowRight size={14} className="transition-transform duration-200 group-hover/card:translate-x-0.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Support disclaimer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.65, duration: 0.5 }}
          className="text-center text-xs text-[var(--text-muted)] mt-12"
        >
          · Onboarding incluído · Suporte durante todo o contrato
        </motion.p>
      </div>
    </section>
  )
}
