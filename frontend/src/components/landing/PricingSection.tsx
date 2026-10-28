'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { ArrowRight, Zap, CalendarDays, FolderKanban, Headphones, BookOpen, Wallet, Settings } from 'lucide-react'
import { whatsappUrl } from './WhatsAppButton'

/*
  Um preço só: R$ 11,90 por mês, por conta, com o sistema inteiro dentro.

  Aqui havia três planos por organização (Business Cloud a R$ 99,90, Business
  Plus a R$ 199,90 e um Enterprise "à consultar"), e cada botão levava a
  `/signup?plano=...`. Nenhum dos três existe mais: a rota de cadastro foi
  desligada (hoje `/signup` só redireciona para `/`, e o endpoint responde 410)
  e a cobrança passou a ser por conta, pelo Mercado Pago.

  A entrada de cliente é o teste de 7 dias, que começa por uma conversa no
  WhatsApp — o mesmo número do botão flutuante, daí o `whatsappUrl` importado
  em vez de um link montado à mão.
*/

const PRECO = 'R$ 11,90'
const PERIODO = '/mês por conta'

const TRIAL_URL = whatsappUrl('Olá! Quero testar o Orkiestri por 7 dias.')

/* Espelha os produtos de `src/lib/modules.tsx` — não anunciar o que não está no ar. */
const MODULOS = [
  { icon: CalendarDays, nome: 'Agenda',        texto: 'Seus compromissos e as notas do Keep no mesmo lugar.' },
  { icon: FolderKanban, nome: 'Projetos',      texto: 'Projetos, tarefas e linha do tempo, do começo ao fim.' },
  { icon: Headphones,   nome: 'Chamados',      texto: 'Pedidos, catálogo, horas e a pesquisa de satisfação.' },
  { icon: BookOpen,     nome: 'Conhecimento',  texto: 'Procedimentos e o que você não quer ter de lembrar.' },
  { icon: Wallet,       nome: 'Financeiro',    texto: 'Seus gastos, contas a pagar e o orçamento do ano.' },
  { icon: Settings,     nome: 'Administração', texto: 'Quem entra, as regras de alerta e o seu WhatsApp.' },
]

export default function PricingSection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-8%' })

  return (
    <section ref={ref} id="planos" className="relative py-14 overflow-hidden">
      {/* Background radial highlights */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(251,146,60,0.25)] to-transparent" />
        <div className="absolute top-1/2 left-0 w-[600px] h-[600px] bg-orange-500/10 blur-[140px] rounded-full -translate-y-1/2" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-10"
        >
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgba(251,146,60,0.2)] bg-[rgba(251,146,60,0.07)] text-[var(--accent-violet)] text-xs font-semibold mb-4">
            <Zap size={12} /> Preço
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--text-primary)] mb-4 leading-[1.1]">
            Um preço.
            <span className="text-[var(--accent-violet)]"> Tudo dentro.</span>
          </h2>
          <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto leading-relaxed">
            Sem plano para escolher, sem módulo vendido à parte. Você paga por conta e usa o sistema inteiro.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-6 items-stretch">
          {/* Preço */}
          <motion.div
            initial={{ opacity: 0, y: 36 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="absolute -inset-1.5 rounded-[32px] bg-gradient-to-r from-orange-500/60 via-amber-400/50 to-orange-600/60 opacity-60 blur-xl" />
            <div className="relative h-full rounded-3xl border border-[rgba(251,146,60,0.35)] bg-[#141417] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] p-7 flex flex-col justify-center">
              <div className="flex items-baseline">
                <span className="font-display text-6xl font-extrabold tracking-tight text-[var(--text-primary)]">{PRECO}</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mt-1.5">{PERIODO}</p>

              <p className="text-xs text-[var(--text-muted)] mt-5 leading-relaxed">
                Cada pessoa tem a sua conta, com os seus dados. Todos os módulos inclusos, do primeiro dia.
              </p>

              <a
                href={TRIAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-[0_4px_20px_rgba(249,115,22,0.35)] hover:shadow-[0_8px_30px_rgba(249,115,22,0.55)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
              >
                Começar com 7 dias grátis <ArrowRight size={14} />
              </a>
              <p className="text-[11px] text-[var(--text-muted)] mt-3.5 leading-relaxed">
                O teste começa por uma conversa no WhatsApp. Depois, cartão com renovação automática ou Pix mês a mês.
              </p>
            </div>
          </motion.div>

          {/* Módulos inclusos */}
          <motion.div
            initial={{ opacity: 0, y: 36 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.22, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-7"
          >
            <h3 className="font-display font-bold text-lg text-[var(--text-primary)] mb-5">
              O que já vem com a sua conta
            </h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
              {MODULOS.map(m => {
                const Icon = m.icon
                return (
                  <li key={m.nome} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-[rgba(251,146,60,0.08)] border border-[rgba(251,146,60,0.2)]">
                      <Icon size={15} className="text-[var(--accent-violet)]" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{m.nome}</div>
                      <div className="text-xs text-[var(--text-secondary)] leading-relaxed mt-0.5">{m.texto}</div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
