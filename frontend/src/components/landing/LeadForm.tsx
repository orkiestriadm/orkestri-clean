'use client'

import { useState, useRef } from 'react'
import type { ElementType } from 'react'
import { motion, useInView } from 'framer-motion'
import { Send, CheckCircle2, Loader2, User, Building2, Phone, Mail, MessageSquare } from 'lucide-react'

type FormData = {
  nome: string
  empresa: string
  telefone: string
  email: string
  mensagem: string
}

type Errors = Partial<Record<keyof FormData, string>>

function validate(data: FormData): Errors {
  const errs: Errors = {}
  if (!data.nome.trim()) errs.nome = 'Nome é obrigatório'
  if (!data.empresa.trim()) errs.empresa = 'Empresa é obrigatória'
  if (!data.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) errs.email = 'E-mail inválido'
  if (!data.telefone.trim()) errs.telefone = 'Telefone é obrigatório'
  return errs
}

function Field({
  label, name, type = 'text', placeholder, icon: Icon, value, onChange, error, multiline,
}: {
  label: string; name: keyof FormData; type?: string; placeholder: string
  icon: ElementType; value: string; onChange: (v: string) => void
  error?: string; multiline?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[var(--text-secondary)]">{label}</label>
      <div className={`relative rounded-xl border transition-all duration-200 ${error ? 'border-[rgba(248,113,113,0.5)] bg-[rgba(248,113,113,0.04)]' : 'border-[rgba(162,130,255,0.15)] bg-[rgba(255,255,255,0.02)] focus-within:border-[rgba(167,139,250,0.4)] focus-within:bg-[rgba(167,139,250,0.04)]'}`}>
        <Icon size={15} className="absolute left-3.5 top-3.5 text-[var(--text-muted)] pointer-events-none" style={{ marginTop: multiline ? 0 : undefined }} />
        {multiline ? (
          <textarea
            rows={4}
            placeholder={placeholder}
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full bg-transparent pl-10 pr-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none resize-none rounded-xl"
          />
        ) : (
          <input
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full bg-transparent pl-10 pr-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none rounded-xl"
          />
        )}
      </div>
      {error && <span className="text-[11px] text-[#f87171]">{error}</span>}
    </div>
  )
}

export default function LeadForm() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-8%' })

  const [form, setForm] = useState<FormData>({ nome: '', empresa: '', telefone: '', email: '', mensagem: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const set = (k: keyof FormData) => (v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: undefined }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate(form)
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    try {
      /*
        INTEGRAÇÃO DE FORMULÁRIO:
        Substitua pelo endpoint real — ex.:
          await fetch('/api/leads', { method: 'POST', body: JSON.stringify(form) })
        Ou integre com:
          - Resend: resend.com/emails
          - HubSpot: forms.hubspot.com/...
          - Zapier webhook

        Analytics: dispare evento "lead_generated" aqui com os dados do formulário
      */
      await new Promise(r => setTimeout(r, 1400)) // simulação
      setSuccess(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="contato" ref={ref} className="relative py-24 lg:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(167,139,250,0.25)] to-transparent" />
        <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-[700px] h-[600px] bg-violet-600/10 blur-[140px] rounded-full" />
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/6 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">

          {/* Left */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgba(167,139,250,0.2)] bg-[rgba(167,139,250,0.07)] text-[var(--accent-violet)] text-xs font-medium mb-6">
              Fale com o time
            </span>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--text-primary)] mb-4 leading-[1.1]">
              Pronto para transformar
              <br />
              <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                sua operação?
              </span>
            </h2>
            <p className="text-[var(--text-secondary)] text-lg leading-relaxed mb-8">
              Fale com nosso time e agende uma demonstração personalizada. Mostramos como o Orkiestri se adapta ao seu negócio em menos de 30 minutos.
            </p>

            {/* Contact info */}
            <div className="flex flex-col gap-4">
              {[
                { icon: Mail, label: 'E-mail', value: 'contato@orkiestri.com' },
                { icon: Phone, label: 'WhatsApp', value: '+55 (11) 9 0000-0000' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[rgba(167,139,250,0.08)] border border-[rgba(167,139,250,0.15)] flex items-center justify-center">
                    <Icon size={15} className="text-[var(--accent-violet)]" />
                  </div>
                  <div>
                    <div className="text-xs text-[var(--text-muted)]">{label}</div>
                    <div className="text-sm text-[var(--text-primary)] font-medium">{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right — Form */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="lp-card relative rounded-2xl border border-[rgba(255,255,255,0.08)] backdrop-blur-xl p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_24px_60px_rgba(0,0,0,0.35)]">
              {/* Glow */}
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-violet-600/10 via-transparent to-cyan-500/5 pointer-events-none" />

              {success ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center text-center py-8 gap-4"
                >
                  <div className="w-16 h-16 rounded-full bg-[rgba(52,211,153,0.12)] border border-[rgba(52,211,153,0.3)] flex items-center justify-center">
                    <CheckCircle2 size={28} className="text-[#34d399]" />
                  </div>
                  <h3 className="font-display font-bold text-xl text-[var(--text-primary)]">Mensagem enviada!</h3>
                  <p className="text-[var(--text-secondary)] text-sm leading-relaxed max-w-xs">
                    Recebemos sua solicitação. Nossa equipe entrará em contato em até 24 horas.
                  </p>
                  <button
                    onClick={() => { setSuccess(false); setForm({ nome:'', empresa:'', telefone:'', email:'', mensagem:'' }) }}
                    className="mt-2 text-xs text-[var(--accent-violet)] hover:underline"
                  >
                    Enviar outra mensagem
                  </button>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4 relative">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Nome completo *" name="nome" placeholder="Seu nome" icon={User} value={form.nome} onChange={set('nome')} error={errors.nome} />
                    <Field label="Empresa *" name="empresa" placeholder="Nome da empresa" icon={Building2} value={form.empresa} onChange={set('empresa')} error={errors.empresa} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Telefone *" name="telefone" type="tel" placeholder="+55 (11) 9 0000-0000" icon={Phone} value={form.telefone} onChange={set('telefone')} error={errors.telefone} />
                    <Field label="E-mail corporativo *" name="email" type="email" placeholder="voce@empresa.com" icon={Mail} value={form.email} onChange={set('email')} error={errors.email} />
                  </div>
                  <Field label="Mensagem" name="mensagem" placeholder="Conte-nos sobre sua operação e o que você precisa..." icon={MessageSquare} value={form.mensagem} onChange={set('mensagem')} multiline />

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white font-medium text-sm hover:from-violet-500 hover:to-violet-400 transition-all shadow-[0_0_20px_rgba(124,58,237,0.4)] hover:shadow-[0_0_30px_rgba(124,58,237,0.6)] disabled:opacity-60 disabled:cursor-not-allowed mt-1"
                  >
                    {loading ? (
                      <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                    ) : (
                      <><Send size={15} /> Solicitar demonstração</>
                    )}
                  </button>

                  <p className="text-center text-xs text-[var(--text-muted)]">
                    Ao enviar, você concorda com nossa{' '}
                    <a href="#" className="text-[var(--accent-violet)] hover:underline">Política de Privacidade</a>.
                  </p>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
