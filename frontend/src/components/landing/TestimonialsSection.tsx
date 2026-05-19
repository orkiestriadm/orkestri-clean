'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Star, Quote } from 'lucide-react'

const TESTIMONIALS = [
  {
    name: 'Carolina Mendes',
    role: 'Diretora de Operações',
    company: 'TechCorp Brasil',
    avatar: 'CM',
    gradient: 'from-violet-500 to-violet-700',
    rating: 5,
    text: 'O Orkiestri mudou completamente como gerenciamos nossa operação. Em menos de uma semana estávamos totalmente adaptados — nunca tivemos isso com nenhum outro sistema enterprise.',
  },
  {
    name: 'Rafael Santos',
    role: 'CFO',
    company: 'Grupo Meridian',
    avatar: 'RS',
    gradient: 'from-cyan-500 to-cyan-700',
    rating: 5,
    text: 'O controle financeiro que conseguimos com o módulo CAPEX/OPEX é impressionante. Visibilidade total dos orçamentos, ciclos de aprovação e relatórios — tudo em um lugar.',
  },
  {
    name: 'Ana Paula Ferreira',
    role: 'Gerente de TI',
    company: 'Indústrias Forte',
    avatar: 'AF',
    gradient: 'from-emerald-500 to-emerald-700',
    rating: 5,
    text: 'A segurança multi-tenant e o controle de permissões nos deu a confiança necessária para adotar o sistema em toda a empresa. A equipe de TI adorou a arquitetura limpa.',
  },
]

export default function TestimonialsSection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-8%' })

  return (
    <section ref={ref} className="relative py-24 lg:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[var(--bg-secondary)]/50" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(167,139,250,0.25)] to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(167,139,250,0.12)] to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-violet-600/8 blur-[150px] rounded-full" />
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
            O que dizem nossos clientes
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--text-primary)] mb-4">
            Empresas que confiam
            <br className="hidden sm:block" /> no Orkiestri
          </h2>
          <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto">
            Resultados reais de quem já centralizou a operação com a nossa plataforma.
          </p>
        </motion.div>

        {/* Testimonial cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1 + i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="lp-card group relative rounded-2xl border border-[rgba(255,255,255,0.07)] backdrop-blur-md p-7 hover:border-[rgba(167,139,250,0.28)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_0_40px_rgba(124,58,237,0.08)] flex flex-col overflow-hidden"
            >
              {/* Top edge highlight */}
              <div className="absolute top-0 left-0 right-0 h-px opacity-20 group-hover:opacity-80 transition-opacity duration-300 bg-gradient-to-r from-transparent via-[rgba(167,139,250,0.8)] to-transparent" />

              {/* Quote icon */}
              <Quote size={28} className="text-[rgba(167,139,250,0.2)] mb-4 shrink-0" />

              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} size={14} className="text-[#fbbf24]" fill="#fbbf24" />
                ))}
              </div>

              {/* Text */}
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed flex-1 mb-6">
                &ldquo;{t.text}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3 pt-5 border-t border-[rgba(162,130,255,0.08)]">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.gradient} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                  {t.avatar}
                </div>
                <div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">{t.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">{t.role} · {t.company}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom social proof */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-12 text-center"
        >
          <div className="lp-card-sm inline-flex items-center gap-6 px-8 py-4 rounded-2xl border border-[rgba(255,255,255,0.07)] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
            <div className="text-center">
              <div className="font-display font-bold text-2xl text-[var(--accent-violet)]">4,9</div>
              <div className="text-xs text-[var(--text-muted)] mt-0.5">Nota média</div>
            </div>
            <div className="w-px h-8 bg-[rgba(162,130,255,0.1)]" />
            <div className="text-center">
              <div className="font-display font-bold text-2xl text-[#34d399]">+120</div>
              <div className="text-xs text-[var(--text-muted)] mt-0.5">Empresas ativas</div>
            </div>
            <div className="w-px h-8 bg-[rgba(162,130,255,0.1)]" />
            <div className="text-center">
              <div className="font-display font-bold text-2xl text-[#22d3ee]">98%</div>
              <div className="text-xs text-[var(--text-muted)] mt-0.5">Satisfação</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
