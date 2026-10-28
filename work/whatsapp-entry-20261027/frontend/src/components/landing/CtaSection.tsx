'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Calendar } from 'lucide-react'

function scrollTo(href: string) {
  const el = document.querySelector(href)
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - 80
  window.scrollTo({ top, behavior: 'smooth' })
}

export default function CtaSection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10%' })

  return (
    <section ref={ref} className="relative py-12 lg:py-16 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-3xl overflow-hidden"
        >
          {/* Background gradient */}
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-900/80 via-[#0c0820] to-[#06060f]" />
            {/* Grid */}
            <div className="absolute inset-0 opacity-[0.04]"
              style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
            {/* Orbs */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/25 blur-[80px] rounded-full" />
            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-cyan-500/15 blur-[60px] rounded-full" />
            {/* Top glow line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/50 to-transparent" />
          </div>

          <div className="relative z-10 px-8 sm:px-12 lg:px-20 py-16 sm:py-20 lg:py-24 text-center">
            {/* Tag */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] text-white/70 text-xs font-medium mb-6"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse" />
              Comece agora
            </motion.div>

            {/* Headline */}
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="font-display text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-[1.08] tracking-tight mb-6 max-w-3xl mx-auto"
            >
              Transforme sua operação
              <br />
              <span className="bg-gradient-to-r from-violet-300 via-violet-200 to-cyan-300 bg-clip-text text-transparent">
                com o Orkiestri.
              </span>
            </motion.h2>

            {/* Sub */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.25, duration: 0.6 }}
              className="text-white/60 text-lg lg:text-xl max-w-2xl mx-auto mb-10"
            >
              Centralize sua Operação, Projetos, Demandas e Financeiro em uma plataforma enterprise moderna.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.35, duration: 0.5 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <button
                onClick={() => {
                  /* Analytics: dispare evento "demo_request" aqui */
                  scrollTo('#contato')
                }}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-violet-700 font-semibold text-sm hover:bg-violet-50 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:-translate-y-0.5 active:translate-y-0"
              >
                <Calendar size={16} />
                Solicitar demonstração
              </button>

              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-white/20 text-white font-medium text-sm hover:bg-white/10 hover:border-white/30 transition-all"
              >
                Entrar no sistema <ArrowRight size={15} />
              </Link>
            </motion.div>

            {/* Guarantee */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="mt-8 text-xs text-white/40"
            >
              Sem fidelidade mínima · Onboarding dedicado · Suporte incluso
            </motion.p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
