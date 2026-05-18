'use client'

import { useState, useRef } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, Users, FolderKanban, DollarSign, Truck } from 'lucide-react'

const TABS = [
  { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
  { id: 'crm', label: 'CRM', icon: Users },
  { id: 'projects', label: 'Projetos', icon: FolderKanban },
  { id: 'finance', label: 'Financeiro', icon: DollarSign },
  { id: 'suppliers', label: 'Fornecedores', icon: Truck },
]

/* ── Screen mockups ── */

function OverviewScreen() {
  const cols = [
    { label: 'Ticket médio', value: 'R$ 8.420', change: '+12%', color: '#a78bfa' },
    { label: 'SLA cumprido', value: '94,3%', change: '+2,1%', color: '#34d399' },
    { label: 'Projetos ativos', value: '18', change: '3 críticos', color: '#22d3ee' },
    { label: 'Fornec. ativos', value: '94', change: '+8 este mês', color: '#fbbf24' },
  ]
  return (
    <div className="p-4 h-full flex flex-col gap-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {cols.map(c => (
          <div key={c.label} className="rounded-xl border border-[rgba(162,130,255,0.12)] bg-[rgba(12,12,34,0.6)] p-3">
            <div className="text-[10px] text-[var(--text-muted)] mb-1">{c.label}</div>
            <div className="text-lg font-display font-bold" style={{ color: c.color }}>{c.value}</div>
            <div className="text-[9px] mt-0.5 text-[var(--text-muted)]">{c.change}</div>
          </div>
        ))}
      </div>
      <div className="flex-1 rounded-xl border border-[rgba(162,130,255,0.1)] bg-[rgba(12,12,34,0.4)] p-3 overflow-hidden">
        <div className="text-[10px] font-medium text-[var(--text-secondary)] mb-3">Atividade dos últimos 30 dias</div>
        <div className="flex items-end gap-1 h-20">
          {[40,65,45,80,55,90,70,85,60,75,50,88,72,95,68,82,58,77,63,90,45,70,55,85,60,78,92,65,80,88].map((h, i) => (
            <div key={i} className="flex-1 rounded-sm transition-all" style={{ height: `${h}%`, background: `rgba(167,139,250,${0.2 + h/200})` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function CRMScreen() {
  const clients = [
    { name: 'TechCorp Brasil', contact: 'Carlos Mendes', status: 'Ativo', value: 'R$ 48K', tag: 'Enterprise' },
    { name: 'Grupo Meridian', contact: 'Ana Ferreira', status: 'Proposta', value: 'R$ 22K', tag: 'Mid-market' },
    { name: 'Industrias Forte', contact: 'Pedro Santos', status: 'Ativo', value: 'R$ 85K', tag: 'Enterprise' },
    { name: 'Retail Solutions', contact: 'Marta Lima', status: 'Negociação', value: 'R$ 31K', tag: 'SMB' },
  ]
  const statusColor: Record<string, string> = { Ativo: '#34d399', Proposta: '#fbbf24', Negociação: '#22d3ee' }
  return (
    <div className="p-4 h-full flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="flex-1 h-7 rounded-lg border border-[rgba(162,130,255,0.12)] bg-[rgba(255,255,255,0.03)] px-3 flex items-center">
          <span className="text-[10px] text-[var(--text-muted)]">🔍 Buscar cliente...</span>
        </div>
        <div className="h-7 px-3 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 flex items-center text-[10px] text-white font-medium">+ Novo</div>
      </div>
      <div className="flex-1 rounded-xl border border-[rgba(162,130,255,0.1)] bg-[rgba(12,12,34,0.4)] overflow-hidden">
        <div className="grid grid-cols-4 px-3 py-2 border-b border-[rgba(162,130,255,0.08)] text-[9px] text-[var(--text-muted)] font-medium">
          <span>EMPRESA</span><span>CONTATO</span><span className="hidden sm:block">VALOR</span><span>STATUS</span>
        </div>
        {clients.map((c, i) => (
          <div key={i} className="grid grid-cols-4 px-3 py-2.5 border-b border-[rgba(162,130,255,0.05)] last:border-0 items-center hover:bg-[rgba(167,139,250,0.04)] transition-colors">
            <div>
              <div className="text-[10px] font-medium text-[var(--text-primary)] truncate">{c.name}</div>
              <span className="text-[8px] text-[var(--text-muted)] px-1.5 py-0.5 rounded border border-[rgba(162,130,255,0.12)]">{c.tag}</span>
            </div>
            <span className="text-[9px] text-[var(--text-secondary)] truncate">{c.contact}</span>
            <span className="text-[10px] font-medium text-[var(--text-primary)] hidden sm:block">{c.value}</span>
            <span className="text-[8px] px-1.5 py-0.5 rounded-full border w-fit" style={{ color: statusColor[c.status], borderColor: `${statusColor[c.status]}40`, background: `${statusColor[c.status]}12` }}>{c.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProjectsScreen() {
  const cols = [
    { title: 'Backlog', color: '#8888aa', cards: ['Redesign do portal', 'API v3 — auth'] },
    { title: 'Em andamento', color: '#a78bfa', cards: ['Projeto Expansão Alpha', 'Módulo Financeiro', 'Integ. WhatsApp'] },
    { title: 'Revisão', color: '#fbbf24', cards: ['Dashboard v2', 'Onboarding flow'] },
    { title: 'Concluído', color: '#34d399', cards: ['Setup DevOps', 'SSO Enterprise'] },
  ]
  return (
    <div className="p-4 h-full">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 h-full">
        {cols.map(col => (
          <div key={col.title} className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: col.color }} />
              <span className="text-[9px] font-medium text-[var(--text-secondary)]">{col.title}</span>
              <span className="ml-auto text-[8px] text-[var(--text-muted)]">{col.cards.length}</span>
            </div>
            {col.cards.map(card => (
              <div key={card} className="rounded-lg border border-[rgba(162,130,255,0.1)] bg-[rgba(12,12,34,0.6)] p-2.5 hover:border-[rgba(162,130,255,0.25)] transition-colors cursor-pointer">
                <div className="text-[9px] text-[var(--text-primary)] font-medium leading-tight mb-1">{card}</div>
                <div className="flex items-center gap-1 mt-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-[6px] text-white flex items-center justify-center">G</div>
                  <div className="flex-1 h-0.5 rounded-full bg-[rgba(162,130,255,0.1)]">
                    <div className="h-full rounded-full" style={{ width: `${30 + Math.random()*60}%`, background: col.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function FinanceScreen() {
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun']
  const capex = [62, 48, 75, 55, 88, 70]
  const opex  = [35, 42, 38, 51, 44, 58]
  return (
    <div className="p-4 h-full flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Receita total', value: 'R$ 2,4M', color: '#34d399' },
          { label: 'CAPEX', value: 'R$ 480K', color: '#a78bfa' },
          { label: 'OPEX', value: 'R$ 268K', color: '#22d3ee' },
        ].map(m => (
          <div key={m.label} className="rounded-xl border border-[rgba(162,130,255,0.1)] bg-[rgba(12,12,34,0.6)] p-2.5">
            <div className="text-[9px] text-[var(--text-muted)] mb-1">{m.label}</div>
            <div className="text-sm font-display font-bold" style={{ color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>
      <div className="flex-1 rounded-xl border border-[rgba(162,130,255,0.1)] bg-[rgba(12,12,34,0.4)] p-3">
        <div className="text-[10px] font-medium text-[var(--text-secondary)] mb-3 flex items-center gap-3">
          CAPEX vs OPEX — 2025
          <span className="flex items-center gap-1 text-[9px] text-[var(--text-muted)]"><span className="w-2 h-1 rounded-full bg-[#a78bfa] inline-block"/>CAPEX</span>
          <span className="flex items-center gap-1 text-[9px] text-[var(--text-muted)]"><span className="w-2 h-1 rounded-full bg-[#22d3ee] inline-block"/>OPEX</span>
        </div>
        <div className="flex items-end gap-2 h-24">
          {months.map((m, i) => (
            <div key={m} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full flex gap-0.5 items-end">
                <div className="flex-1 rounded-t-sm bg-[#a78bfa]/60" style={{ height: `${capex[i]}%` }} />
                <div className="flex-1 rounded-t-sm bg-[#22d3ee]/50" style={{ height: `${opex[i]}%` }} />
              </div>
              <span className="text-[7px] text-[var(--text-muted)]">{m}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SuppliersScreen() {
  const suppliers = [
    { name: 'Fornecedor Alpha', category: 'TI', rating: 4.8, status: 'Aprovado', spend: 'R$ 148K' },
    { name: 'Logística Prime', category: 'Logística', rating: 4.2, status: 'Aprovado', spend: 'R$ 92K' },
    { name: 'Tech Distribuidora', category: 'Hardware', rating: 3.9, status: 'Em avaliação', spend: 'R$ 56K' },
    { name: 'Serviços Gerais SA', category: 'Facilities', rating: 4.5, status: 'Aprovado', spend: 'R$ 34K' },
  ]
  const statusColor: Record<string,string> = { 'Aprovado': '#34d399', 'Em avaliação': '#fbbf24' }
  return (
    <div className="p-4 h-full flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {[{l:'Total',v:'94'},{l:'Aprovados',v:'78'},{l:'Em avaliação',v:'16'}].map(m=>(
          <div key={m.l} className="rounded-xl border border-[rgba(162,130,255,0.1)] bg-[rgba(12,12,34,0.6)] p-2.5">
            <div className="text-[9px] text-[var(--text-muted)]">{m.l}</div>
            <div className="text-base font-display font-bold text-[var(--accent-violet)]">{m.v}</div>
          </div>
        ))}
      </div>
      <div className="flex-1 rounded-xl border border-[rgba(162,130,255,0.1)] bg-[rgba(12,12,34,0.4)] overflow-hidden">
        {suppliers.map((s, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-[rgba(162,130,255,0.05)] last:border-0 hover:bg-[rgba(167,139,250,0.04)] transition-colors">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500/30 to-cyan-500/20 border border-[rgba(162,130,255,0.2)] flex items-center justify-center text-[9px] font-bold text-[var(--accent-violet)] shrink-0">
              {s.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-medium text-[var(--text-primary)] truncate">{s.name}</div>
              <div className="text-[8px] text-[var(--text-muted)]">{s.category}</div>
            </div>
            <div className="text-[9px] text-[#fbbf24] shrink-0">★ {s.rating}</div>
            <div className="text-[9px] font-medium text-[var(--text-secondary)] hidden sm:block shrink-0">{s.spend}</div>
            <span className="text-[8px] px-1.5 py-0.5 rounded-full border shrink-0"
              style={{ color: statusColor[s.status], borderColor: `${statusColor[s.status]}40`, background: `${statusColor[s.status]}12` }}>
              {s.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const SCREENS: Record<string, React.ReactNode> = {
  overview: <OverviewScreen />,
  crm: <CRMScreen />,
  projects: <ProjectsScreen />,
  finance: <FinanceScreen />,
  suppliers: <SuppliersScreen />,
}

export default function DemoSection() {
  const [active, setActive] = useState('overview')
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-8%' })

  return (
    <section id="plataforma" ref={ref} className="relative py-24 lg:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-violet-600/5 blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgba(167,139,250,0.2)] bg-[rgba(167,139,250,0.07)] text-[var(--accent-violet)] text-xs font-medium mb-4">
            Plataforma integrada
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--text-primary)] mb-4">
            Uma plataforma para cada área
            <br className="hidden sm:block" /> da sua empresa
          </h2>
          <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto">
            Módulos profundos e integrados entre si — do CRM ao financeiro, tudo em um único ambiente.
          </p>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="flex items-center gap-1 p-1 rounded-2xl border border-[rgba(162,130,255,0.12)] bg-[rgba(12,12,34,0.6)] backdrop-blur-xl mb-4 overflow-x-auto scrollbar-none"
        >
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = active === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all shrink-0 ${
                  isActive
                    ? 'bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-[0_0_16px_rgba(124,58,237,0.4)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[rgba(167,139,250,0.06)]'
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            )
          })}
        </motion.div>

        {/* Screen */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="rounded-2xl border border-[rgba(162,130,255,0.15)] bg-[#080818] overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.6)] min-h-[320px] sm:min-h-[360px]"
        >
          {/* Window chrome */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[rgba(162,130,255,0.1)] bg-[#06060f]">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
            </div>
            <span className="flex-1 text-center text-[10px] text-[var(--text-muted)] font-mono">
              orkiestri.com — {TABS.find(t => t.id === active)?.label}
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="h-full"
            >
              {SCREENS[active]}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  )
}
