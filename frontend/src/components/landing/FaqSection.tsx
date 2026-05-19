'use client'

import { useState, useRef } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { ChevronDown, MessageCircle } from 'lucide-react'
import Link from 'next/link'

const FAQS = [
  {
    q: 'Quanto tempo leva a implantação do Orkiestri?',
    a: 'A maioria dos clientes está operacional em menos de 24 horas. Nosso onboarding guiado inclui configuração inicial, importação de dados, treinamento da equipe e acompanhamento durante os primeiros dias — sem necessidade de envolver sua equipe de TI.',
  },
  {
    q: 'O Orkiestri funciona para empresas de todos os tamanhos?',
    a: 'Sim. Atendemos desde equipes de 5 pessoas até corporações com centenas de usuários. A arquitetura multi-tenant garante que cada organização tenha seu ambiente completamente isolado, com dados separados e configurações independentes.',
  },
  {
    q: 'Como funciona a segurança e o isolamento dos dados?',
    a: 'Cada organização opera em um tenant completamente isolado — sem compartilhamento de dados entre clientes. Utilizamos JWT com rotação automática, controle granular de permissões por perfil e módulo, e proteção nativa contra as principais vulnerabilidades OWASP.',
  },
  {
    q: 'Posso integrar o Orkiestri com outros sistemas?',
    a: 'Sim. O Orkiestri oferece API REST documentada e suporte a webhooks para integração com ERPs, CRMs, ferramentas de BI e plataformas de comunicação. Integrações com WhatsApp já estão disponíveis nativamente, com notificações automáticas para chamados, aprovações e eventos operacionais.',
  },
  {
    q: 'Como funciona o suporte ao cliente?',
    a: 'Todos os planos incluem suporte especializado. Os planos Business e Enterprise têm SLA garantido e acesso a um gerente de conta dedicado. O suporte é realizado via chat, e-mail e WhatsApp em horário comercial estendido, com times técnicos que conhecem profundamente o produto.',
  },
  {
    q: 'É possível personalizar o Orkiestri para o nosso negócio?',
    a: 'Absolutamente. O Orkiestri é altamente configurável — permissões granulares, campos customizados, workflows sob medida, identidade visual white-label e módulos ativáveis por perfil. A maioria das personalizações não exige código e pode ser feita diretamente pelo painel de configurações.',
  },
]

function FaqItem({ q, a, i, inView }: { q: string; a: string; i: number; inView: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: i * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="border-b border-[rgba(162,130,255,0.08)] last:border-0"
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-4 py-5 text-left group"
        aria-expanded={open}
      >
        <span className={`font-display font-semibold text-[15px] leading-snug transition-colors duration-200 ${
          open ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
        }`}>
          {q}
        </span>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 transition-all duration-200 ${
            open
              ? 'bg-[rgba(167,139,250,0.12)] border-[rgba(167,139,250,0.35)] text-[var(--accent-violet)]'
              : 'border-[rgba(162,130,255,0.14)] text-[var(--text-muted)] group-hover:border-[rgba(162,130,255,0.28)] group-hover:text-[var(--text-secondary)]'
          }`}
        >
          <ChevronDown size={14} strokeWidth={2} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="text-[var(--text-secondary)] text-sm leading-relaxed pb-5 max-w-3xl pr-11">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function FaqSection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-8%' })

  return (
    <section ref={ref} className="relative py-24 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(167,139,250,0.22)] to-transparent" />
        <div className="absolute top-1/2 left-0 w-[600px] h-[600px] bg-violet-600/8 blur-[140px] rounded-full -translate-y-1/2" />
        <div className="absolute bottom-1/3 right-0 w-[500px] h-[500px] bg-cyan-500/6 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-14"
        >
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgba(167,139,250,0.2)] bg-[rgba(167,139,250,0.07)] text-[var(--accent-violet)] text-xs font-medium mb-4">
            FAQ
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--text-primary)] mb-4">
            Perguntas frequentes
          </h2>
          <p className="text-[var(--text-secondary)] text-lg max-w-xl mx-auto">
            Tudo que você precisa saber antes de começar.
          </p>
        </motion.div>

        {inView && (
          <div className="lp-card rounded-2xl border border-[rgba(255,255,255,0.07)] backdrop-blur-md px-7 sm:px-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_4px_40px_rgba(0,0,0,0.24)]">
            {FAQS.map((faq, i) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} i={i} inView={inView} />
            ))}
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="mt-10 text-center"
        >
          <p className="text-sm text-[var(--text-muted)] mb-4">Tem mais dúvidas? Fale com nosso time.</p>
          <Link
            href="#contato"
            onClick={e => { e.preventDefault(); const el = document.querySelector('#contato'); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' }) }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[rgba(162,130,255,0.2)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[rgba(162,130,255,0.4)] hover:bg-[rgba(167,139,250,0.05)] transition-all"
          >
            <MessageCircle size={14} className="text-[var(--accent-violet)]" />
            Entrar em contato
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
