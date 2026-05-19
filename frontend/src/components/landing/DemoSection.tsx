'use client'

import { useState, useRef } from 'react'
import type { ReactNode } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, CalendarDays, Headphones, FolderKanban, DollarSign, Truck } from 'lucide-react'

const TABS = [
  { id: 'overview',   label: 'Visão Geral',  icon: LayoutDashboard },
  { id: 'agenda',     label: 'Agenda',        icon: CalendarDays },
  { id: 'chamados',   label: 'Chamados',      icon: Headphones },
  { id: 'projects',   label: 'Projetos',      icon: FolderKanban },
  { id: 'finance',    label: 'Financeiro',    icon: DollarSign },
  { id: 'suppliers',  label: 'Fornecedores',  icon: Truck },
]

/* ── WhatsApp SVG icon ── */
function WaIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

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

function AgendaScreen() {
  const events = [
    { time: '09:00', title: 'Reunião — TechCorp Brasil', type: 'Reunião', via: 'whatsapp', confirmed: true },
    { time: '10:30', title: 'Demo Produto — Grupo Meridian', type: 'Demo', via: 'portal', confirmed: true },
    { time: '14:00', title: 'Visita Técnica — Indústrias Forte', type: 'Visita', via: 'whatsapp', confirmed: false },
    { time: '16:00', title: 'Follow-up contrato — Retail Solutions', type: 'Follow-up', via: 'whatsapp', confirmed: true },
  ]
  const typeColor: Record<string, string> = { Reunião: '#a78bfa', Demo: '#22d3ee', Visita: '#fbbf24', 'Follow-up': '#34d399' }
  return (
    <div className="p-4 h-full flex flex-col gap-3">
      {/* Header strip */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {['Seg','Ter','Qua','Qui','Sex'].map((d, i) => (
            <div key={d} className={`w-8 h-8 rounded-lg flex flex-col items-center justify-center text-[8px] font-medium transition-colors ${i === 2 ? 'bg-[rgba(167,139,250,0.2)] text-[var(--accent-violet)] border border-[rgba(167,139,250,0.3)]' : 'text-[var(--text-muted)]'}`}>
              <span>{d}</span>
              <span className="font-bold text-[9px]">{19 + i}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[rgba(37,211,102,0.1)] border border-[rgba(37,211,102,0.25)]">
          <WaIcon size={10} />
          <span className="text-[9px] text-[#25D366] font-medium">Notif. WhatsApp ativo</span>
        </div>
      </div>

      {/* Events list */}
      <div className="flex-1 flex flex-col gap-2">
        {events.map((ev, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-[rgba(162,130,255,0.1)] bg-[rgba(12,12,34,0.5)] px-3 py-2.5 hover:border-[rgba(162,130,255,0.22)] transition-colors">
            <div className="text-[9px] font-mono text-[var(--text-muted)] w-8 shrink-0">{ev.time}</div>
            <div className="w-0.5 self-stretch rounded-full shrink-0" style={{ background: typeColor[ev.type] }} />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-medium text-[var(--text-primary)] truncate">{ev.title}</div>
              <span className="text-[8px] px-1.5 py-0.5 rounded border" style={{ color: typeColor[ev.type], borderColor: `${typeColor[ev.type]}40`, background: `${typeColor[ev.type]}12` }}>{ev.type}</span>
            </div>
            {ev.via === 'whatsapp' ? (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[rgba(37,211,102,0.1)] border border-[rgba(37,211,102,0.25)] shrink-0">
                <WaIcon size={9} />
                <span className="text-[8px] text-[#25D366] hidden sm:inline">
                  {ev.confirmed ? 'Confirmado' : 'Aguardando'}
                </span>
              </div>
            ) : (
              <span className="text-[8px] text-[var(--text-muted)] shrink-0">Portal</span>
            )}
          </div>
        ))}
      </div>

      {/* Bottom stat */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[rgba(37,211,102,0.15)] bg-[rgba(37,211,102,0.05)]">
        <WaIcon size={11} />
        <span className="text-[9px] text-[#25D366]">3 de 4 eventos confirmados automaticamente via WhatsApp</span>
      </div>
    </div>
  )
}

function ChamadosScreen() {
  const tickets = [
    { id: '#1.034', title: 'Erro no módulo financeiro — acesso negado', client: 'TechCorp Brasil', priority: 'Alta', status: 'Em andamento', via: 'whatsapp', ago: '12 min' },
    { id: '#1.033', title: 'Dúvida sobre exportação de relatório', client: 'Grupo Meridian', priority: 'Baixa', status: 'Resolvido', via: 'portal', ago: '1h' },
    { id: '#1.032', title: 'Integração API retornando 401', client: 'Indústrias Forte', priority: 'Alta', status: 'Aberto', via: 'whatsapp', ago: '2h' },
    { id: '#1.031', title: 'Usuário sem permissão de aprovação', client: 'Retail Solutions', priority: 'Média', status: 'Aguardando', via: 'whatsapp', ago: '3h' },
  ]
  const priorityColor: Record<string, string> = { Alta: '#f87171', Média: '#fbbf24', Baixa: '#34d399' }
  const statusColor: Record<string, string> = { 'Em andamento': '#a78bfa', Resolvido: '#34d399', Aberto: '#f87171', Aguardando: '#fbbf24' }
  return (
    <div className="p-4 h-full flex flex-col gap-3">
      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Abertos', value: '12', color: '#f87171' },
          { label: 'Em andamento', value: '5', color: '#a78bfa' },
          { label: 'Via WhatsApp', value: '9', color: '#25D366' },
          { label: 'Resolvidos hoje', value: '23', color: '#34d399' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-[rgba(162,130,255,0.1)] bg-[rgba(12,12,34,0.6)] p-2">
            <div className="text-[8px] text-[var(--text-muted)] mb-0.5 truncate">{s.label}</div>
            <div className="text-sm font-display font-bold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tickets list */}
      <div className="flex-1 rounded-xl border border-[rgba(162,130,255,0.1)] bg-[rgba(12,12,34,0.4)] overflow-hidden">
        {tickets.map((t, i) => (
          <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 border-b border-[rgba(162,130,255,0.05)] last:border-0 hover:bg-[rgba(167,139,250,0.04)] transition-colors">
            <div className="shrink-0">
              <div className="text-[8px] font-mono text-[var(--text-muted)]">{t.id}</div>
              <div className="w-1.5 h-1.5 rounded-full mt-1 mx-auto" style={{ background: priorityColor[t.priority] }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-medium text-[var(--text-primary)] truncate">{t.title}</div>
              <div className="text-[8px] text-[var(--text-muted)] truncate">{t.client}</div>
            </div>
            {t.via === 'whatsapp' && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[rgba(37,211,102,0.1)] border border-[rgba(37,211,102,0.25)] shrink-0">
                <WaIcon size={8} />
                <span className="text-[7px] text-[#25D366] hidden sm:inline">WhatsApp</span>
              </div>
            )}
            <div className="shrink-0 text-right">
              <span className="text-[8px] px-1.5 py-0.5 rounded-full border" style={{ color: statusColor[t.status], borderColor: `${statusColor[t.status]}40`, background: `${statusColor[t.status]}12` }}>{t.status}</span>
              <div className="text-[7px] text-[var(--text-muted)] mt-0.5">{t.ago}</div>
            </div>
          </div>
        ))}
      </div>

      {/* WhatsApp highlight */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[rgba(37,211,102,0.2)] bg-[rgba(37,211,102,0.06)]">
        <WaIcon size={12} />
        <span className="text-[9px] text-[#25D366] font-medium">75% dos chamados abertos e respondidos diretamente via WhatsApp</span>
      </div>
    </div>
  )
}

function ProjectsScreen() {
  const cols = [
    { title: 'Backlog', color: '#8888aa', cards: [{ text: 'Redesign do portal', pct: 45 }, { text: 'API v3 — auth', pct: 20 }] },
    { title: 'Em andamento', color: '#a78bfa', cards: [{ text: 'Projeto Expansão Alpha', pct: 65 }, { text: 'Módulo Financeiro', pct: 40 }, { text: 'Integ. WhatsApp', pct: 80 }] },
    { title: 'Revisão', color: '#fbbf24', cards: [{ text: 'Dashboard v2', pct: 88 }, { text: 'Onboarding flow', pct: 72 }] },
    { title: 'Concluído', color: '#34d399', cards: [{ text: 'Setup DevOps', pct: 100 }, { text: 'SSO Enterprise', pct: 100 }] },
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
              <div key={card.text} className="rounded-lg border border-[rgba(162,130,255,0.1)] bg-[rgba(12,12,34,0.6)] p-2.5 hover:border-[rgba(162,130,255,0.25)] transition-colors cursor-pointer">
                <div className="text-[9px] text-[var(--text-primary)] font-medium leading-tight mb-1">{card.text}</div>
                <div className="flex items-center gap-1 mt-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-[6px] text-white flex items-center justify-center">G</div>
                  <div className="flex-1 h-0.5 rounded-full bg-[rgba(162,130,255,0.1)]">
                    <div className="h-full rounded-full" style={{ width: `${card.pct}%`, background: col.color }} />
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
        <div className="flex items-end gap-2" style={{ height: 88 }}>
          {months.map((m, i) => (
            <div key={m} className="flex-1 flex flex-col items-center gap-0.5 justify-end">
              <div className="flex gap-0.5 items-end w-full">
                <div className="flex-1 rounded-t-sm bg-[#a78bfa]/60" style={{ height: Math.round(capex[i] * 0.76) }} />
                <div className="flex-1 rounded-t-sm bg-[#22d3ee]/50" style={{ height: Math.round(opex[i] * 0.76) }} />
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

const SCREENS: Record<string, ReactNode> = {
  overview:  <OverviewScreen />,
  agenda:    <AgendaScreen />,
  chamados:  <ChamadosScreen />,
  projects:  <ProjectsScreen />,
  finance:   <FinanceScreen />,
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
