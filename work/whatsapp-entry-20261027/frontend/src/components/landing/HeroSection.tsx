'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  ArrowRight, ChevronRight, TrendingUp, AlertTriangle,
  Headphones, BarChart3, FolderKanban, LayoutDashboard,
  ChevronLeft, ChevronRight as ChevronRightIcon, X, Maximize2,
} from 'lucide-react'

/* ══════════════════════════════════════════════════════════════
   SLIDE 1 — Dashboard Executivo
══════════════════════════════════════════════════════════════ */
function SlideExecutivo() {
  return (
    <div className="flex flex-col h-full text-[var(--app-text,#111)] bg-white">
      {/* Alert banner */}
      <div className="mx-3 mt-2 mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 flex items-center gap-2 flex-wrap">
        <AlertTriangle size={11} className="text-amber-500 shrink-0" />
        <span className="text-[9px] font-semibold text-amber-700">Atenção necessária</span>
        <div className="flex gap-1.5 flex-wrap">
          {['4 chamados urgentes', '1 SLA violado', '2 garantias vencidas'].map(t => (
            <span key={t} className="inline-flex items-center gap-0.5 rounded-full border border-amber-300 bg-white px-1.5 py-0.5 text-[8px] text-amber-700">
              <AlertTriangle size={7} /> {t}
            </span>
          ))}
        </div>
      </div>

      {/* Chamados section */}
      <div className="mx-3 mb-2">
        <div className="flex items-center gap-1 mb-1.5">
          <Headphones size={10} className="text-violet-500" />
          <span className="text-[9px] font-bold text-gray-700">Chamados</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {[
            { label: 'ABERTOS', val: '17', sub: 'em atendimento ou aguardando', color: 'text-gray-800' },
            { label: 'URGENTES', val: '4', sub: 'prioridade urgente', color: 'text-orange-600' },
            { label: 'RESOLVIDOS/MÊS', val: '8', sub: 'mês atual', color: 'text-green-600' },
            { label: 'SLA VIOLADOS', val: '1', sub: 'fora do prazo', color: 'text-red-500' },
            { label: 'SLA COMPLIANCE', val: '88%', sub: 'dentro do SLA', color: 'text-yellow-600' },
          ].map(c => (
            <div key={c.label} className="rounded-lg border border-gray-100 bg-gray-50 p-2">
              <div className="text-[7px] text-gray-400 font-medium mb-0.5 uppercase tracking-wide leading-tight">{c.label}</div>
              <div className={`text-base font-bold leading-none ${c.color}`}>{c.val}</div>
              <div className="text-[6px] text-gray-400 mt-0.5 leading-tight">{c.sub}</div>
            </div>
          ))}
        </div>
        {/* CSAT */}
        <div className="mt-1.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5 flex items-center gap-2">
          <span className="text-[8px] text-gray-500 font-medium uppercase tracking-wide">CSAT Médio</span>
          <span className="text-sm font-bold text-gray-800">5</span>
          <span className="text-[8px] text-gray-400">/ 5</span>
          <span className="text-[7px] text-gray-400">(2 aval.)</span>
          <div className="flex gap-0.5 ml-auto">
            {Array(5).fill(0).map((_, i) => <span key={i} className="text-yellow-400 text-[8px]">★</span>)}
          </div>
        </div>
      </div>

      {/* Projetos / Ativos / Horas row */}
      <div className="mx-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
          <div className="text-[7px] text-violet-500 font-bold mb-1.5 flex items-center gap-0.5"><FolderKanban size={8} /> Projetos</div>
          <div className="grid grid-cols-2 gap-1">
            {[{ l: 'ATIVOS', v: '7' }, { l: 'CONCL./MÊS', v: '1' }].map(x => (
              <div key={x.l}>
                <div className="text-[6px] text-gray-400 uppercase tracking-wide">{x.l}</div>
                <div className="text-sm font-bold text-gray-800">{x.v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
          <div className="text-[7px] text-cyan-500 font-bold mb-1.5">🖥️ Ativos</div>
          <div className="grid grid-cols-2 gap-1">
            {[{ l: 'TOTAL', v: '23' }, { l: 'MANUTENÇÃO', v: '1' }].map(x => (
              <div key={x.l}>
                <div className="text-[6px] text-gray-400 uppercase tracking-wide">{x.l}</div>
                <div className="text-sm font-bold text-gray-800">{x.v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
          <div className="text-[7px] text-emerald-500 font-bold mb-1.5">⏱️ Horas (mês)</div>
          <div className="grid grid-cols-2 gap-1">
            {[{ l: 'TOTAL', v: '1h 30m' }, { l: 'APONTAMENTOS', v: '3' }].map(x => (
              <div key={x.l}>
                <div className="text-[6px] text-gray-400 uppercase tracking-wide">{x.l}</div>
                <div className="text-xs font-bold text-gray-800">{x.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SLIDE 2 — Relatórios & Analytics (aba Projetos)
══════════════════════════════════════════════════════════════ */
function SlideRelatorios() {
  const BARS = [
    { nome: 'Administrator', val: 17, color: '#ef4444' },
    { nome: 'Diego Pereira', val: 14, color: '#3b82f6' },
    { nome: 'Guilherme Rodrigues', val: 11, color: '#22c55e' },
    { nome: 'Carlos Souza', val: 5, color: '#f59e0b' },
    { nome: 'Ana Costa', val: 5, color: '#f59e0b' },
    { nome: 'Fernanda Alves', val: 4, color: '#06b6d4' },
    { nome: 'Beatriz Lima', val: 4, color: '#ec4899' },
  ]
  const DONUTS = [
    { label: 'A Fazer', val: 28, color: '#9ca3af' },
    { label: 'Em Andamento', val: 17, color: '#3b82f6' },
    { label: 'Em Revisão', val: 9, color: '#f59e0b' },
    { label: 'Concluída', val: 9, color: '#22c55e' },
  ]
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200 mx-3 mt-2">
        {['Chamados', 'SLA & CSAT', 'Horas', 'Projetos', 'Atendentes', 'Comparativo'].map(t => (
          <div key={t} className={`px-2 py-1.5 text-[8px] font-medium cursor-pointer border-b-2 -mb-px ${t === 'Projetos' ? 'border-violet-500 text-violet-600' : 'border-transparent text-gray-400'}`}>{t}</div>
        ))}
      </div>
      {/* KPI strip */}
      <div className="mx-3 mt-2 grid grid-cols-4 gap-1.5 mb-2">
        {[
          { l: 'TOTAL TASKS', v: '63', s: '14% concluídas', color: 'text-gray-800' },
          { l: 'CONCLUÍDAS', v: '9', s: '', color: 'text-green-600' },
          { l: 'VENCIDAS', v: '2', s: '', color: 'text-red-500' },
          { l: 'PROJETOS ATIVOS', v: '2', s: 'de 8 total', color: 'text-violet-600' },
        ].map(c => (
          <div key={c.l} className="rounded-lg border border-gray-100 bg-gray-50 p-2">
            <div className="text-[6px] text-gray-400 uppercase tracking-wide mb-0.5">{c.l}</div>
            <div className={`text-sm font-bold ${c.color}`}>{c.v}</div>
            {c.s && <div className="text-[6px] text-gray-400">{c.s}</div>}
          </div>
        ))}
      </div>
      {/* Charts row */}
      <div className="mx-3 flex gap-2 flex-1">
        {/* Donut */}
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2 flex-1">
          <div className="text-[8px] font-semibold text-gray-600 mb-1.5">Tasks por status</div>
          <div className="flex items-center gap-2">
            {/* SVG donut approximation */}
            <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
              {/* segments approximation */}
              <circle cx="22" cy="22" r="16" fill="none" stroke="#e5e7eb" strokeWidth="7" />
              <circle cx="22" cy="22" r="16" fill="none" stroke="#9ca3af" strokeWidth="7" strokeDasharray="45 56" strokeDashoffset="14" />
              <circle cx="22" cy="22" r="16" fill="none" stroke="#3b82f6" strokeWidth="7" strokeDasharray="27 74" strokeDashoffset="-31" />
              <circle cx="22" cy="22" r="16" fill="none" stroke="#f59e0b" strokeWidth="7" strokeDasharray="14 87" strokeDashoffset="-58" />
              <circle cx="22" cy="22" r="16" fill="none" stroke="#22c55e" strokeWidth="7" strokeDasharray="14 87" strokeDashoffset="-72" />
              <text x="22" y="25" textAnchor="middle" className="text-[8px] font-bold" fill="#374151" fontSize="9">63</text>
            </svg>
            <div className="flex flex-col gap-0.5">
              {DONUTS.map(d => (
                <div key={d.label} className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="text-[7px] text-gray-500">{d.label}</span>
                  <span className="text-[7px] font-semibold text-gray-700 ml-auto pl-1">{d.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Bars */}
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2 flex-1">
          <div className="text-[8px] font-semibold text-gray-600 mb-1.5">Tasks por membro</div>
          <div className="flex flex-col gap-1">
            {BARS.map(b => (
              <div key={b.nome} className="flex items-center gap-1">
                <div className="text-[6px] text-gray-500 w-16 truncate shrink-0">{b.nome.split(' ')[0]}</div>
                <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(b.val / 17) * 100}%`, background: b.color }} />
                </div>
                <div className="text-[6px] font-semibold text-gray-600 w-3 text-right">{b.val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SLIDE 3 — Chamados / Service Desk
══════════════════════════════════════════════════════════════ */
function SlideChamados() {
  const COLS = [
    {
      label: 'ABERTO', count: 1, color: '#6b7280',
      cards: [{ num: '#15', prio: 'MÉD', titulo: 'Tela de login erro 500 intermitente', cat: 'Sistema', sla: 'SLA Violado 10d', user: 'A' }],
    },
    {
      label: 'EM ATENDIMENTO', count: 2, color: '#3b82f6',
      cards: [
        { num: '#21', prio: 'BAI', titulo: 'Configurar assinatura de e-mail padrão', cat: 'Comunicação', sla: 'SLA Violado 15d', user: 'FA' },
        { num: '#3', prio: 'MÉD', titulo: 'Criação de Usuário', cat: 'Suporte Técnico', sla: 'SLA Violado 2d', user: 'A' },
      ],
    },
    { label: 'AGUARDANDO', count: 0, color: '#f59e0b', cards: [] },
    {
      label: 'RESOLVIDO', count: 3, color: '#22c55e',
      cards: [
        { num: '#6', prio: 'CRÍT', titulo: 'Teste', cat: 'TI', sla: '2d', user: 'A' },
        { num: '#22', prio: 'MÉD', titulo: 'Sistema de ponto eletrônico offline', cat: 'Hardware', sla: '8d', user: 'A' },
      ],
    },
    {
      label: 'FECHADO', count: 2, color: '#7c3aed',
      cards: [
        { num: '#1', prio: 'CRÍT', titulo: 'Criar Plano Orçamentário 2027', cat: 'Financeiro', sla: '8d', user: 'A' },
      ],
    },
  ]
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Counter strip */}
      <div className="flex gap-2 mx-3 mt-2 mb-2 flex-wrap">
        {[
          { l: 'TOTAL', v: '8', c: 'text-gray-700' },
          { l: 'ABERTOS', v: '1', c: 'text-gray-500' },
          { l: 'EM ATEND.', v: '2', c: 'text-blue-600' },
          { l: 'AGUARDANDO', v: '0', c: 'text-yellow-500' },
          { l: 'RESOLVIDOS', v: '3', c: 'text-green-600' },
          { l: 'SLA VIOLADO', v: '3', c: 'text-red-500' },
        ].map(x => (
          <div key={x.l} className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-1 text-center">
            <div className="text-[6px] text-gray-400 uppercase tracking-wide">{x.l}</div>
            <div className={`text-sm font-bold ${x.c}`}>{x.v}</div>
          </div>
        ))}
      </div>
      {/* Kanban */}
      <div className="mx-3 flex gap-1.5 flex-1 overflow-hidden">
        {COLS.map(col => (
          <div key={col.label} className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: col.color }} />
              <span className="text-[6px] font-semibold text-gray-600 truncate">{col.label}</span>
              <span className="text-[6px] text-gray-400 ml-auto shrink-0">{col.count}</span>
            </div>
            <div className="flex flex-col gap-1">
              {col.cards.map(card => (
                <div key={card.num} className="rounded-lg border border-gray-200 bg-white p-1.5 shadow-sm">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[6px] text-gray-400">{card.num}</span>
                    <span className="text-[5px] font-bold px-1 rounded" style={{ background: card.prio === 'CRÍT' ? '#fee2e2' : card.prio === 'BAI' ? '#f3f4f6' : '#fef3c7', color: card.prio === 'CRÍT' ? '#dc2626' : card.prio === 'BAI' ? '#6b7280' : '#d97706' }}>
                      {card.prio}
                    </span>
                  </div>
                  <div className="text-[7px] font-medium text-gray-700 leading-tight mb-1 line-clamp-2">{card.titulo}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-[6px] px-1 py-0.5 rounded bg-gray-100 text-gray-500">{card.cat}</span>
                    <span className="text-[6px] text-red-400">{card.sla}</span>
                  </div>
                </div>
              ))}
              {col.cards.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-200 p-2 text-center">
                  <span className="text-[6px] text-gray-300">Nenhum chamado</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SLIDE 4 — Projetos / Kanban
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
  { id: 'executivo', label: 'Dashboard Executivo', icon: LayoutDashboard, component: SlideExecutivo, route: 'dashboard/executivo' },
  { id: 'relatorios', label: 'Relatórios & Analytics', icon: BarChart3, component: SlideRelatorios, route: 'dashboard/relatorios' },
  { id: 'chamados', label: 'Service Desk', icon: () => <span className="text-[10px]">🎧</span>, component: SlideChamados, route: 'dashboard/chamados' },
  { id: 'projetos', label: 'Gestão de Projetos', icon: FolderKanban, component: SlideProjetos, route: 'dashboard/projetos' },
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
                <span className="hidden sm:inline">{s.label.split(' ')[0]}</span>
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
          <span className="text-[11px] font-semibold text-[#34d399]">↑ 24% eficiência operacional</span>
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
              Plataforma Operacional Integrada · 2026
            </motion.div>

            {/* H1 */}
            <motion.h1
              initial={{ opacity: 0, y: 28 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.75, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="font-display text-3xl sm:text-4xl lg:text-5xl xl:text-[52px] font-bold leading-[1.07] tracking-tight text-[var(--text-primary)] mb-6"
            >
              Centralize{' '}
              <span className="bg-gradient-to-r from-violet-400 via-violet-300 to-fuchsia-400 bg-clip-text text-transparent">
                gestão de equipe, chamados,
              </span>
              {' '}projetos, financeiro e operações{' '}
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
              O Orkiestri elimina o caos de múltiplos sistemas e oferece governança operacional completa para empresas que precisam de controle, produtividade e rastreabilidade.
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
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill="#fbbf24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                  ))}
                </div>
                <span className="text-sm text-[var(--text-muted)]">4,9 / 5 satisfação</span>
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
