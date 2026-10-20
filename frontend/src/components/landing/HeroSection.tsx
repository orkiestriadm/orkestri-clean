'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  ArrowRight, ChevronRight, TrendingUp,
  FolderKanban, CalendarDays, PiggyBank,
  ChevronLeft, ChevronRight as ChevronRightIcon, X, Maximize2,
} from 'lucide-react'

/* ══════════════════════════════════════════════════════════════
   SLIDE 1 — Agenda / Calendário
══════════════════════════════════════════════════════════════ */
function SlideAgenda() {
  const WEEKS = [
    [
      { d: null, evs: [] }, { d: null, evs: [] }, { d: null, evs: [] }, { d: null, evs: [] }, { d: null, evs: [] },
      { d: 1, evs: [{ t: 'Dia do Trabalhador', color: '#fca5a5', text: '#dc2626' }] }, { d: 2, evs: [] },
    ],
    [
      { d: 3, evs: [] }, { d: 4, evs: [] }, { d: 5, evs: [] }, { d: 6, evs: [] }, { d: 7, evs: [] }, { d: 8, evs: [] }, { d: 9, evs: [] },
    ],
    [
      { d: 10, evs: [] }, { d: 11, evs: [] }, { d: 12, evs: [] },
      { d: 13, evs: [{ t: '09:00 Daily Standup — Time TI', color: '#c4b5fd', text: '#7c3aed' }, { t: '10:00 Sprint Planning', color: '#a5f3fc', text: '#0891b2' }] },
      { d: 14, evs: [{ t: '09:00 Daily Standup — Time TI', color: '#c4b5fd', text: '#7c3aed' }] },
      { d: 15, evs: [{ t: '09:00 Daily Standup — Time TI', color: '#c4b5fd', text: '#7c3aed' }, { t: '14:00 Consulta médica', color: '#bbf7d0', text: '#15803d' }] },
      { d: 16, evs: [{ t: '09:00 Daily Standup — Time TI', color: '#c4b5fd', text: '#7c3aed' }] },
    ],
    [
      { d: 17, evs: [{ t: '09:00 Daily Standup — Time TI', color: '#c4b5fd', text: '#7c3aed' }, { t: '16:00 Reunião de fechamento', color: '#fed7aa', text: '#c2410c' }] },
      { d: 18, evs: [] },
      { d: 19, evs: [{ t: '09:00 Treinamento: Uso do Orkiestri', color: '#fbcfe8', text: '#be185d' }] },
      { d: 20, evs: [{ t: '09:00 Daily Standup — Time TI', color: '#c4b5fd', text: '#7c3aed' }, { t: '14:00 Reunião Semanal de TI', color: '#c4b5fd', text: '#7c3aed' }] },
      { d: 21, evs: [{ t: '09:00 Daily Standup — Time TI', color: '#c4b5fd', text: '#7c3aed' }] },
      { d: 22, evs: [{ t: '09:00 Daily Standup — Time TI', color: '#c4b5fd', text: '#7c3aed' }, { t: '15:00 Reunião com gestor', color: '#c4b5fd', text: '#7c3aed' }] },
      { d: 23, evs: [{ t: '09:00 Daily Standup — Time TI', color: '#c4b5fd', text: '#7c3aed' }], extra: 1 },
    ],
    [
      { d: 24, evs: [{ t: '09:00 Daily Standup — Time TI', color: '#c4b5fd', text: '#7c3aed' }, { t: '14:00 Alinhamento de equipe', color: '#fed7aa', text: '#c2410c' }] },
      { d: 25, evs: [{ t: '10:10 Revisão do quadro', color: '#c4b5fd', text: '#7c3aed' }] },
      { d: 26, evs: [{ t: '09:00 🔔 Renovar certificado SSL', color: '#fef08a', text: '#a16207' }, { t: '10:00 Sprint Review', color: '#a5f3fc', text: '#0891b2' }] },
      { d: 27, evs: [{ t: '09:00 Daily Standup — Time TI', color: '#c4b5fd', text: '#7c3aed' }, { t: '10:00 Sprint Planning', color: '#a5f3fc', text: '#0891b2' }] },
      { d: 28, evs: [{ t: '09:00 🔔 Backup mensal — verificar logs', color: '#fef08a', text: '#a16207' }, { t: '09:00 Daily Standup — Time TI', color: '#c4b5fd', text: '#7c3aed' }], today: true },
      { d: 29, evs: [{ t: '09:00 Daily Standup — Time TI', color: '#c4b5fd', text: '#7c3aed' }, { t: '14:00 One-on-One', color: '#bbf7d0', text: '#15803d' }] },
      { d: 30, evs: [{ t: '09:00 Daily Standup — Time TI', color: '#c4b5fd', text: '#7c3aed' }, { t: '14:00 Kickoff — Novo projeto', color: '#fed7aa', text: '#c2410c' }] },
    ],
    [
      { d: 31, evs: [{ t: '09:00 Daily Standup — Time TI', color: '#c4b5fd', text: '#7c3aed' }] },
      { d: null, evs: [] }, { d: null, evs: [] }, { d: null, evs: [] }, { d: null, evs: [] }, { d: null, evs: [] }, { d: null, evs: [] },
    ],
  ]
  const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  return (
    <div className="h-full bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[8px] text-gray-400">◀</span>
          <span className="text-[10px] font-bold text-gray-800">Maio 2026</span>
          <span className="text-[8px] text-gray-400">▶</span>
        </div>
        <div className="flex items-center gap-0.5 border border-gray-200 rounded-lg overflow-hidden">
          {['Hoje', 'Mês', 'Semana', 'Dia'].map(v => (
            <span key={v} className={`text-[8px] px-2 py-0.5 cursor-pointer ${v === 'Mês' ? 'bg-violet-600 text-white font-semibold' : 'text-gray-500'}`}>{v}</span>
          ))}
        </div>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-100 shrink-0">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[7px] font-semibold text-gray-400 py-1 border-r border-gray-100 last:border-0">{d}</div>
        ))}
      </div>
      {/* Calendar grid */}
      <div className="flex-1 overflow-hidden">
        {WEEKS.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-gray-100 last:border-0" style={{ height: `${100 / WEEKS.length}%` }}>
            {week.map((cell, ci) => (
              <div key={ci} className={`border-r border-gray-100 last:border-0 px-0.5 pt-0.5 overflow-hidden ${(cell as any).today ? 'bg-blue-50' : cell.d === null ? 'bg-gray-50/50' : ''}`}>
                {cell.d && (
                  <>
                    <span className={`text-[8px] font-medium block mb-0.5 ${(cell as any).today ? 'text-blue-600 font-bold' : ci === 0 || ci === 6 ? 'text-gray-400' : 'text-gray-700'}`}>{cell.d}</span>
                    {(cell.evs as any[]).slice(0, 2).map((ev, i) => (
                      <div key={i} className="text-[6px] rounded px-0.5 mb-0.5 truncate leading-tight py-0.5" style={{ background: ev.color, color: ev.text }}>{ev.t}</div>
                    ))}
                    {(cell as any).extra && <div className="text-[6px] text-gray-400 pl-0.5">+{(cell as any).extra}</div>}
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SLIDE 2 — Orçamento / CAPEX-OPEX
══════════════════════════════════════════════════════════════ */
function SlideOrcamento() {
  const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const PREVISTO = [48830, 31310, 32710, 61020, 61320, 63320, 69720, 70220, 71720, 78920, 79420, 81220]
  const REALIZADO = [47248, 38716, 34410, 59552, 23738, 0, 0, 0, 0, 0, 0, 0]
  const ESTOUROS = [false, false, true, false, false, false, false, false, false, false, false, false]
  const CATS = [
    { nome: 'Serviços Prestados', pct: 49.8, val: 'R$ 78.659' },
    { nome: 'Manutenção de Softwares', pct: 36.0, val: 'R$ 69.565' },
    { nome: 'Software e Licenças', pct: 11.0, val: 'R$ 21.794' },
    { nome: 'Infraestrutura e Cloud', pct: 9.0, val: 'R$ 17.781' },
    { nome: 'Pessoal e Treinamentos', pct: 4.0, val: 'R$ 7.875' },
  ]
  const maxVal = Math.max(...PREVISTO)
  return (
    <div className="h-full bg-white flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200 px-3 mt-1.5 shrink-0">
        {['Dashboard', 'OPEX', 'CAPEX', 'Configurações'].map(t => (
          <div key={t} className={`px-2.5 py-1.5 text-[8px] font-medium cursor-pointer border-b-2 -mb-px ${t === 'Dashboard' ? 'border-violet-500 text-violet-600' : 'border-transparent text-gray-400'}`}>{t}</div>
        ))}
      </div>
      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-2 px-3 mt-2 mb-2 shrink-0">
        {[
          { l: 'TOTAL PREVISTO', v: 'R$ 749.710', c: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
          { l: 'TOTAL REALIZADO', v: 'R$ 195.674', c: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-100' },
          { l: 'EXECUÇÃO GLOBAL', v: '26.0%', c: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { l: 'ESTOUROS', v: '1', c: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100' },
        ].map(k => (
          <div key={k.l} className={`rounded-lg border ${k.border} ${k.bg} p-2`}>
            <div className="text-[6px] text-gray-400 uppercase tracking-wide mb-0.5">{k.l}</div>
            <div className={`text-sm font-bold ${k.c}`}>{k.v}</div>
          </div>
        ))}
      </div>
      {/* Charts */}
      <div className="flex gap-2 px-3 flex-1 overflow-hidden pb-2">
        <div className="flex-1 rounded-lg border border-gray-100 bg-gray-50 p-2 overflow-hidden">
          <div className="text-[8px] font-semibold text-gray-700 mb-1.5">Evolução Mensal — Previsto × Realizado</div>
          <div className="flex flex-col gap-0.5">
            {MESES.map((m, i) => (
              <div key={m} className="flex items-center gap-1">
                <span className="text-[6px] text-gray-400 w-4 shrink-0">{m}</span>
                <div className="flex-1 flex flex-col gap-0.5">
                  <div className="h-1 rounded-full bg-gray-200 overflow-hidden">
                    <div className="h-full rounded-full bg-violet-400" style={{ width: `${(PREVISTO[i] / maxVal) * 100}%` }} />
                  </div>
                  {REALIZADO[i] > 0 && (
                    <div className="h-1 rounded-full bg-gray-200 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(REALIZADO[i] / maxVal) * 100}%`, background: ESTOUROS[i] ? '#ef4444' : '#06b6d4' }} />
                    </div>
                  )}
                </div>
                <span className="text-[6px] font-mono text-gray-500 w-12 text-right shrink-0">
                  {REALIZADO[i] > 0 ? (ESTOUROS[i] ? <span className="text-red-500">R${(REALIZADO[i] / 1000).toFixed(0)}k</span> : `R$${(REALIZADO[i] / 1000).toFixed(0)}k`) : ''}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-1.5">
            {[{ c: 'bg-violet-400', l: 'Previsto' }, { c: 'bg-cyan-400', l: 'Realizado' }, { c: 'bg-red-400', l: 'Estouro' }].map(x => (
              <div key={x.l} className="flex items-center gap-0.5"><span className={`w-2 h-1 rounded-full ${x.c}`} /><span className="text-[6px] text-gray-400">{x.l}</span></div>
            ))}
          </div>
        </div>
        <div className="w-36 shrink-0 rounded-lg border border-gray-100 bg-gray-50 p-2">
          <div className="text-[8px] font-semibold text-gray-700 mb-1.5">Distribuição por Categoria</div>
          <div className="flex flex-col gap-1.5">
            {CATS.map(c => (
              <div key={c.nome}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[7px] text-gray-600 truncate flex-1">{c.nome}</span>
                  <span className="text-[7px] font-semibold text-gray-500 shrink-0 ml-1">{c.pct}%</span>
                </div>
                <div className="h-1 rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${c.pct * 2}%`, background: '#7c3aed' }} />
                </div>
                <div className="text-[6px] text-gray-400 mt-0.5">{c.val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SLIDE 3 — Projetos / Kanban
══════════════════════════════════════════════════════════════ */
function SlideProjetos() {
  const PROJETOS = [
    { nome: 'Plataforma de BI e Analytics', status: 'Planejamento', prio: 'ALTA', color: '#f59e0b', pct: 5 },
    { nome: 'Automação de Processos RH', status: 'Concluído', prio: 'MEDIA', color: '#22c55e', pct: 100 },
    { nome: 'Redesign Portal do Cliente', status: 'Em andamento', prio: 'MEDIA', color: '#06b6d4', pct: 72 },
    { nome: 'Migração para Cloud AWS', status: 'Planejamento', prio: 'ALTA', color: '#3b82f6', pct: 10, active: true },
    { nome: 'Implantação ERP Financeiro', status: 'Em andamento', prio: 'ALTA', color: '#7c3aed', pct: 45 },
  ]
  const TASKS_KANBAN = [
    { col: 'A Fazer', count: 6, color: '#9ca3af', tasks: ['Reunião de kick-off', 'Validar arquitetura técnica', 'Testes de integração', 'Deploy em produção', 'Documentar ADR', 'Atualizar README'] },
    { col: 'Em Andamento', count: 4, color: '#3b82f6', tasks: ['Documentar requisitos', 'Config. ambiente dev', 'Desenvolvimento core', 'Configurar CI/CD'] },
    { col: 'Em Revisão', count: 1, color: '#f59e0b', tasks: ['Code review módulo'] },
    { col: 'Concluída', count: 0, color: '#22c55e', tasks: [] },
  ]
  return (
    <div className="flex h-full bg-white">
      {/* Left sidebar — project list */}
      <div className="w-[140px] shrink-0 border-r border-gray-100 flex flex-col pt-2 px-2">
        <div className="text-[7px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-1">6 Projetos</div>
        {PROJETOS.map(p => (
          <div key={p.nome} className={`rounded-lg px-2 py-1.5 mb-1 cursor-pointer ${p.active ? 'bg-violet-50 border border-violet-200' : 'hover:bg-gray-50'}`}>
            <div className="flex items-center gap-1 mb-0.5">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: p.color }} />
              <span className="text-[7px] font-medium text-gray-700 truncate leading-tight">{p.nome}</span>
            </div>
            <div className="flex items-center gap-1 pl-2.5">
              <span className="text-[6px] text-gray-400">{p.status}</span>
              <span className="text-[5px] font-bold ml-auto" style={{ color: p.prio === 'ALTA' ? '#f59e0b' : '#6b7280' }}>{p.prio}</span>
            </div>
            <div className="pl-2.5 mt-0.5">
              <div className="h-0.5 rounded-full bg-gray-200">
                <div className="h-full rounded-full" style={{ width: `${p.pct}%`, background: p.color }} />
              </div>
              <div className="text-[5px] text-gray-400 mt-0.5">{p.pct}%</div>
            </div>
          </div>
        ))}
      </div>
      {/* Right — kanban */}
      <div className="flex-1 flex flex-col pt-2 px-2 min-w-0">
        <div className="mb-1.5">
          <div className="text-[10px] font-bold text-gray-800 leading-tight">Migração para Cloud AWS</div>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="h-1 flex-1 rounded-full bg-gray-200">
              <div className="h-full w-[10%] rounded-full bg-blue-500" />
            </div>
            <span className="text-[6px] text-blue-500 font-semibold">10%</span>
          </div>
        </div>
        <div className="flex gap-1.5 flex-1 overflow-hidden">
          {TASKS_KANBAN.map(col => (
            <div key={col.col} className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-0.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: col.color }} />
                <span className="text-[6px] font-semibold text-gray-500 truncate">{col.col}</span>
                <span className="text-[6px] text-gray-400 ml-auto">{col.count}</span>
              </div>
              <div className="flex flex-col gap-1">
                {col.tasks.slice(0, 3).map(t => (
                  <div key={t} className="rounded border border-gray-200 bg-white p-1 shadow-sm">
                    <div className="text-[6px] font-medium text-gray-700 leading-tight">{t}</div>
                    <div className="mt-0.5 flex items-center gap-0.5">
                      <span className="w-3 h-3 rounded-full bg-violet-200 flex items-center justify-center text-[5px] font-bold text-violet-700">
                        {['A', 'DP', 'GR', 'CS', 'BL'][col.tasks.indexOf(t) % 5]}
                      </span>
                    </div>
                  </div>
                ))}
                {col.tasks.length === 0 && (
                  <div className="rounded border border-dashed border-gray-200 p-2 text-center">
                    <span className="text-[6px] text-gray-300">Solte aqui</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   CARROSSEL
══════════════════════════════════════════════════════════════ */
const SLIDES = [
  { id: 'projetos', label: 'Projetos', icon: FolderKanban, component: SlideProjetos, route: 'dashboard/projetos' },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays, component: SlideAgenda, route: 'dashboard/agenda' },
  { id: 'orcamento', label: 'Orçamento', icon: PiggyBank, component: SlideOrcamento, route: 'dashboard/orcamento' },
]

// ── Constantes do zoom ───────────────────────────────────────
const BASE_W = 620   // largura original do card
const BASE_H = 430   // titlebar (~45) + conteúdo (340) + bottomnav (~45)
const MAX_SCALE = 1.45

function HeroCarousel() {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const [frozen, setFrozen] = useState(false)  // para de avançar após fechar zoom
  const [zoomed, setZoomed] = useState(false)
  const [modalScale, setModalScale] = useState(MAX_SCALE)

  // Auto-avanço — para quando pausado OU frozen
  useEffect(() => {
    if (paused || frozen) return
    const t = setInterval(() => setCurrent(c => (c + 1) % SLIDES.length), 4000)
    return () => clearInterval(t)
  }, [paused, frozen])

  // Calcula escala responsiva quando o modal abre
  useEffect(() => {
    if (!zoomed) return
    const compute = () => {
      const avail = Math.min(window.innerWidth - 40, BASE_W * MAX_SCALE)
      setModalScale(Math.min(MAX_SCALE, avail / BASE_W))
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [zoomed])

  // ESC fecha o zoom
  useEffect(() => {
    if (!zoomed) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeZoom() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomed])

  const go = useCallback((i: number) => {
    setCurrent(i)
    setPaused(true)
    if (!frozen) setTimeout(() => setPaused(false), 8000)
  }, [frozen])

  const openZoom = useCallback(() => setZoomed(true), [])
  const closeZoom = useCallback(() => { setZoomed(false); setFrozen(true) }, [])

  const slide = SLIDES[current]
  const SlideComp = slide.component

  // ── Conteúdo do app window (renderizado em dois lugares) ──
  const renderWindow = () => (
    <div className="rounded-2xl border border-[rgba(162,130,255,0.2)] bg-white overflow-hidden shadow-[0_28px_90px_rgba(0,0,0,0.55),0_0_0_1px_rgba(162,130,255,0.08)]">

      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex-1 mx-3">
          <div className="max-w-[220px] mx-auto flex items-center gap-2 bg-white border border-gray-200 rounded px-2.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
            <span className="text-[9px] text-gray-400 font-mono">orkiestri.com/{slide.route}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {SLIDES.map((s, i) => {
            const Icon = s.icon
            return (
              <button
                key={s.id}
                onClick={(e) => { e.stopPropagation(); go(i) }}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium transition-all ${i === current ? 'bg-violet-100 text-violet-700' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <Icon size={9} />
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Slide content */}
      <div className="relative overflow-hidden" style={{ height: 340 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 overflow-hidden"
          >
            <SlideComp />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50">
        <button
          onClick={(e) => { e.stopPropagation(); go((current - 1 + SLIDES.length) % SLIDES.length) }}
          className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white transition-all"
        >
          <ChevronLeft size={12} />
        </button>

        <div className="flex items-center gap-1.5">
          {SLIDES.map((s, i) => (
            <button key={s.id} onClick={(e) => { e.stopPropagation(); go(i) }} className="flex items-center gap-1 group">
              <span className={`block rounded-full transition-all duration-300 ${i === current ? 'w-4 h-1.5 bg-violet-500' : 'w-1.5 h-1.5 bg-gray-300 group-hover:bg-violet-300'}`} />
            </button>
          ))}
          <span className="ml-2 text-[9px] text-gray-400 font-medium">{slide.label}</span>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); go((current + 1) % SLIDES.length) }}
          className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white transition-all"
        >
          <ChevronRightIcon size={12} />
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* ─── Card do carrossel ─── */}
      <motion.div
        initial={{ opacity: 0, y: 44, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[620px] mx-auto lg:mx-0 cursor-pointer group"
        onClick={openZoom}
        title="Clique para ampliar"
      >
        {/* Ambient glow */}
        <div className="absolute -inset-8 bg-gradient-to-br from-violet-600/18 via-violet-500/4 to-cyan-500/10 rounded-3xl blur-3xl pointer-events-none" />

        {/* Floating badge top-right */}
        <motion.div
          initial={{ opacity: 0, x: 20, y: -10 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ delay: 1.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="absolute -top-5 right-2 sm:right-6 z-20 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#080820]/95 border border-[rgba(52,211,153,0.35)] backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
        >
          <TrendingUp size={13} className="text-[#34d399]" />
          <span className="text-[11px] font-semibold text-[#34d399]">Projetos, Agenda e Financeiro integrados</span>
        </motion.div>

        {/* Hover overlay — "Ampliar" hint */}
        <div className="absolute inset-0 z-10 rounded-2xl flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors duration-200 pointer-events-none">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/90 shadow-lg border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-700 text-[11px] font-semibold">
            <Maximize2 size={13} className="text-violet-600" />
            Ampliar visualização
          </div>
        </div>

        {renderWindow()}
      </motion.div>

      {/* ─── Modal de zoom ─── */}
      <AnimatePresence>
        {zoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/88 backdrop-blur-sm px-4"
            onClick={closeZoom}
          >
            {/* Botão fechar */}
            <button
              onClick={closeZoom}
              className="absolute top-4 right-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white/80 hover:text-white hover:bg-white/20 transition-all z-10 text-sm font-medium"
            >
              <X size={16} />
              <span className="hidden sm:inline text-xs">Fechar</span>
            </button>

            {/* Container escalado */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative overflow-hidden rounded-2xl shadow-[0_40px_120px_rgba(0,0,0,0.8)] border border-[rgba(162,130,255,0.25)]"
              style={{
                width: `${BASE_W * modalScale}px`,
                height: `${BASE_H * modalScale}px`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* App window escalado para caber no modal */}
              <div style={{
                width: `${BASE_W}px`,
                transform: `scale(${modalScale})`,
                transformOrigin: 'top left',
                position: 'absolute',
                top: 0,
                left: 0,
              }}>
                {renderWindow()}
              </div>
            </motion.div>

            {/* Legenda */}
            <p className="absolute bottom-6 text-white/40 text-xs">
              Clique fora ou pressione ESC para fechar
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/* ══════════════════════════════════════════════════════════════
   HERO SECTION
══════════════════════════════════════════════════════════════ */
export default function HeroSection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true })

  return (
    <section ref={ref} className="relative min-h-screen flex items-center overflow-hidden pt-20">

      {/* Background layers */}
      <div className="absolute inset-0 pointer-events-none select-none">
        <div className="absolute inset-0 opacity-[0.032]"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(162,130,255,1) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
        <div className="absolute top-1/4 left-1/4 w-[700px] h-[700px] rounded-full bg-violet-600/10 blur-[130px]" style={{ animation: 'pulse 8s ease-in-out infinite' }} />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-cyan-500/7 blur-[110px]" style={{ animation: 'pulse 10s ease-in-out infinite', animationDelay: '3s' }} />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[var(--bg-primary)] to-transparent" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/5 blur-[80px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-12 lg:py-0">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left — Text */}
          <div className="text-center lg:text-left">

            {/* Pill tag */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgba(167,139,250,0.28)] bg-[rgba(167,139,250,0.08)] text-[#a78bfa] text-xs font-medium mb-6"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] animate-pulse" />
              Projetos · Agenda · Financeiro · 2026
            </motion.div>

            {/* H1 */}
            <motion.h1
              initial={{ opacity: 0, y: 28 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.75, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="font-display text-3xl sm:text-4xl lg:text-5xl xl:text-[52px] font-bold leading-[1.07] tracking-tight text-[var(--text-primary)] mb-6"
            >
              Seus{' '}
              <span className="bg-gradient-to-r from-violet-400 via-violet-300 to-fuchsia-400 bg-clip-text text-transparent">
                projetos, sua agenda
              </span>
              {' '}e seu financeiro{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                em uma única plataforma.
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="text-[var(--text-secondary)] text-lg lg:text-xl leading-relaxed max-w-xl mx-auto lg:mx-0 mb-8"
            >
              O Orkiestri reúne o quadro de projetos, a agenda da equipe e o controle orçamentário em um só lugar — com histórico, permissões por perfil e notificações no WhatsApp.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.28 }}
              className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start"
            >
              <Link
                href="/solicitar-acesso"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white font-semibold hover:from-violet-500 hover:to-violet-400 transition-all shadow-[0_0_28px_rgba(124,58,237,0.5)] hover:shadow-[0_0_40px_rgba(124,58,237,0.7)] hover:-translate-y-0.5 active:translate-y-0 text-sm"
              >
                Teste por 7 dias grátis <ArrowRight size={15} />
              </Link>

              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all font-medium text-sm"
              >
                Login no sistema <ChevronRight size={15} />
              </Link>
            </motion.div>

            {/* Social proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ duration: 0.7, delay: 0.48 }}
              className="flex flex-col sm:flex-row items-center gap-5 mt-10 justify-center lg:justify-start"
            >
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {['G', 'T', 'R', 'M', 'A'].map((l, i) => (
                    <div key={i} className="w-7 h-7 rounded-full border-2 border-[var(--bg-primary)] bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white text-[9px] font-bold">
                      {l}
                    </div>
                  ))}
                </div>
                <div className="text-sm text-[var(--text-muted)]">
                  Criado por profissionais com experiência real em operações corporativas críticas.
                </div>
              </div>
              <div className="hidden sm:block w-px h-6 bg-[rgba(162,130,255,0.1)]" />
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-muted)]">7 dias de teste, sem cartão</span>
              </div>
            </motion.div>
          </div>

          {/* Right — Carousel */}
          <div className="flex justify-center lg:justify-end">
            <HeroCarousel />
          </div>
        </div>
      </div>
    </section>
  )
}
