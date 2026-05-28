'use client'

import { useState, useRef } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { TrendingUp, BarChart3, Headphones, FolderKanban, AlertTriangle, CalendarDays, PiggyBank, Package } from 'lucide-react'

const TABS = [
  { id: 'executivo',  label: 'Executivo',   icon: TrendingUp   },
  { id: 'relatorios', label: 'Relatórios',  icon: BarChart3    },
  { id: 'chamados',   label: 'Chamados',    icon: Headphones   },
  { id: 'projetos',   label: 'Projetos',    icon: FolderKanban },
  { id: 'agenda',     label: 'Agenda',      icon: CalendarDays },
  { id: 'orcamento',  label: 'Orçamento',   icon: PiggyBank    },
  { id: 'ativos',     label: 'Ativos',      icon: Package      },
]

/* ══════════════════════════════════════════════════════════════
   EXECUTIVO — fiel ao screenshot real
══════════════════════════════════════════════════════════════ */
function ExecutivoScreen() {
  return (
    <div className="h-full bg-[#f8f9fb] overflow-y-auto text-gray-800">
      {/* Alert banner */}
      <div className="mx-3 mt-2.5 mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 flex items-center gap-2 flex-wrap">
        <AlertTriangle size={11} className="text-amber-500 shrink-0" />
        <span className="text-[9px] font-semibold text-amber-700">Atenção necessária</span>
        {['4 chamados urgentes', '1 SLAs violados', '2 garantias vencidas'].map(t => (
          <span key={t} className="inline-flex items-center gap-0.5 rounded-full border border-amber-300 bg-white px-1.5 py-0.5 text-[8px] text-amber-700">
            <AlertTriangle size={7} /> {t}
          </span>
        ))}
      </div>

      {/* Chamados */}
      <div className="mx-3 mb-2">
        <div className="flex items-center gap-1 mb-1.5">
          <Headphones size={10} className="text-violet-500" />
          <span className="text-[9px] font-bold text-gray-700">Chamados</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5 mb-1.5">
          {[
            { l: 'ABERTOS',        v: '17', s: 'em atendimento ou aguardando', c: 'text-gray-800' },
            { l: 'URGENTES',       v: '4',  s: 'prioridade urgente',           c: 'text-orange-600' },
            { l: 'RESOLVIDOS/MÊS', v: '8',  s: 'mês atual',                    c: 'text-green-600' },
            { l: 'SLA VIOLADOS',   v: '1',  s: 'fora do prazo',                c: 'text-red-500' },
            { l: 'SLA COMPLIANCE', v: '88%',s: 'dentro do SLA',                c: 'text-yellow-600' },
          ].map(c => (
            <div key={c.l} className="rounded-lg border border-gray-100 bg-white shadow-sm p-2">
              <div className="text-[7px] text-gray-400 uppercase tracking-wide leading-tight mb-0.5">{c.l}</div>
              <div className={`text-base font-bold leading-none ${c.c}`}>{c.v}</div>
              <div className="text-[6px] text-gray-400 mt-0.5 leading-tight">{c.s}</div>
            </div>
          ))}
        </div>
        {/* CSAT */}
        <div className="rounded-lg border border-gray-100 bg-white shadow-sm px-3 py-1.5 flex items-center gap-3">
          <span className="text-yellow-400 text-sm">☆</span>
          <span className="text-[8px] text-gray-500 font-medium uppercase tracking-wide">CSAT Médio</span>
          <span className="text-sm font-bold text-gray-800">5</span>
          <span className="text-[8px] text-gray-400">/ 5</span>
          <span className="text-[7px] text-gray-400">(2 aval.)</span>
          <div className="flex gap-0.5 ml-auto">{Array(5).fill(0).map((_, i) => <span key={i} className="text-yellow-400 text-[8px]">★</span>)}</div>
        </div>
      </div>

      {/* Projetos / Ativos / Horas */}
      <div className="mx-3 grid grid-cols-3 gap-2">
        {/* Projetos */}
        <div className="rounded-lg border border-gray-100 bg-white shadow-sm p-2">
          <div className="text-[7px] text-violet-500 font-bold mb-1.5 flex items-center gap-0.5">
            <FolderKanban size={8} /> Projetos
          </div>
          <div className="grid grid-cols-2 gap-1">
            {[{ l:'ATIVOS',v:'7'},{l:'CONCL./MÊS',v:'1'}].map(x=>(
              <div key={x.l}><div className="text-[6px] text-gray-400 uppercase">{x.l}</div><div className="text-sm font-bold text-gray-800">{x.v}</div></div>
            ))}
          </div>
        </div>
        {/* Ativos */}
        <div className="rounded-lg border border-gray-100 bg-white shadow-sm p-2">
          <div className="text-[7px] text-cyan-500 font-bold mb-1.5">🖥️ Ativos</div>
          <div className="grid grid-cols-2 gap-1">
            {[{l:'TOTAL',v:'23'},{l:'MANUTENÇÃO',v:'1'}].map(x=>(
              <div key={x.l}><div className="text-[6px] text-gray-400 uppercase">{x.l}</div><div className="text-sm font-bold text-gray-800">{x.v}</div></div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1 mt-1">
            {[{l:'GAR. A VENCER',v:'0',c:'text-yellow-600'},{l:'GAR. VENCIDA',v:'2',c:'text-red-500'}].map(x=>(
              <div key={x.l}><div className="text-[6px] text-gray-400 uppercase">{x.l}</div><div className={`text-sm font-bold ${x.c}`}>{x.v}</div></div>
            ))}
          </div>
        </div>
        {/* Horas */}
        <div className="rounded-lg border border-gray-100 bg-white shadow-sm p-2">
          <div className="text-[7px] text-emerald-500 font-bold mb-1.5">⏱️ Horas (mês)</div>
          <div className="grid grid-cols-2 gap-1">
            {[{l:'TOTAL HORAS',v:'1h 30m'},{l:'APONTAMENTOS',v:'3'}].map(x=>(
              <div key={x.l}><div className="text-[6px] text-gray-400 uppercase">{x.l}</div><div className="text-xs font-bold text-gray-800">{x.v}</div></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   RELATÓRIOS — aba Projetos ativa
══════════════════════════════════════════════════════════════ */
function RelatoriosScreen() {
  const BARS = [
    { nome: 'Administrator',       val: 17, color: '#ef4444' },
    { nome: 'Diego Pereira',       val: 14, color: '#3b82f6' },
    { nome: 'Guilherme Rodrigues', val: 11, color: '#22c55e' },
    { nome: 'Carlos Souza',        val: 5,  color: '#f59e0b' },
    { nome: 'Ana Costa',           val: 5,  color: '#f59e0b' },
    { nome: 'Fernanda Alves',      val: 4,  color: '#06b6d4' },
    { nome: 'Beatriz Lima',        val: 4,  color: '#ec4899' },
  ]
  return (
    <div className="h-full bg-white overflow-y-auto text-gray-800 flex flex-col">
      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200 mx-3 mt-2 shrink-0">
        {['Chamados','SLA & CSAT','Horas','Projetos','Atendentes','Comparativo'].map(t => (
          <div key={t} className={`px-2 py-1.5 text-[8px] font-medium cursor-pointer border-b-2 -mb-px ${t==='Projetos'?'border-violet-500 text-violet-600':'border-transparent text-gray-400'}`}>{t}</div>
        ))}
      </div>

      {/* KPI strip */}
      <div className="mx-3 mt-2 grid grid-cols-4 gap-1.5 mb-2 shrink-0">
        {[
          { l:'TOTAL TASKS',      v:'63', s:'14% concluídas',  c:'text-gray-800' },
          { l:'CONCLUÍDAS',       v:'9',  s:'',                c:'text-green-600' },
          { l:'VENCIDAS',         v:'2',  s:'',                c:'text-red-500' },
          { l:'PROJETOS ATIVOS',  v:'2',  s:'de 8 total',      c:'text-violet-600' },
        ].map(c => (
          <div key={c.l} className="rounded-lg border border-gray-100 bg-gray-50 p-2">
            <div className="text-[6px] text-gray-400 uppercase tracking-wide mb-0.5">{c.l}</div>
            <div className={`text-sm font-bold ${c.c}`}>{c.v}</div>
            {c.s && <div className="text-[6px] text-gray-400">{c.s}</div>}
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="mx-3 flex gap-2 mb-2 shrink-0">
        {/* Bar chart — tasks por dia */}
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2 flex-1">
          <div className="text-[8px] font-semibold text-gray-600 mb-1">Tasks concluídas por dia</div>
          <div className="text-[7px] text-gray-400 mb-1.5">Últimos 14 dias</div>
          <div className="flex items-end gap-1" style={{ height: 42 }}>
            {[0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,8,0,0,0,0,0,0,0,0,9,0].map((v,i) => (
              <div key={i} className="flex-1 rounded-sm" style={{ height: v===0?'2px':`${(v/9)*100}%`, background: v>0?'#22c55e':'#e5e7eb', minHeight: '2px' }} />
            ))}
          </div>
        </div>
        {/* Donut */}
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2 flex-1">
          <div className="text-[8px] font-semibold text-gray-600 mb-1.5">Tasks por status</div>
          <div className="flex items-center gap-2">
            <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
              <circle cx="22" cy="22" r="16" fill="none" stroke="#e5e7eb" strokeWidth="7" />
              <circle cx="22" cy="22" r="16" fill="none" stroke="#9ca3af" strokeWidth="7" strokeDasharray="45 56" strokeDashoffset="14" />
              <circle cx="22" cy="22" r="16" fill="none" stroke="#3b82f6" strokeWidth="7" strokeDasharray="27 74" strokeDashoffset="-31" />
              <circle cx="22" cy="22" r="16" fill="none" stroke="#f59e0b" strokeWidth="7" strokeDasharray="14 87" strokeDashoffset="-58" />
              <circle cx="22" cy="22" r="16" fill="none" stroke="#22c55e" strokeWidth="7" strokeDasharray="14 87" strokeDashoffset="-72" />
              <text x="22" y="25" textAnchor="middle" fill="#374151" fontSize="9" fontWeight="bold">63</text>
            </svg>
            <div className="flex flex-col gap-0.5 flex-1">
              {[{l:'EM_REVISAO',v:9,c:'#3b82f6'},{l:'Concluída',v:9,c:'#22c55e'},{l:'A Fazer',v:28,c:'#9ca3af'},{l:'Em Andamento',v:17,c:'#f59e0b'}].map(d=>(
                <div key={d.l} className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:d.c}} />
                  <span className="text-[7px] text-gray-500 flex-1">{d.l}</span>
                  <span className="text-[7px] font-semibold text-gray-700">{d.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tasks por membro */}
      <div className="mx-3 rounded-lg border border-gray-100 bg-gray-50 p-2 flex-1">
        <div className="text-[8px] font-semibold text-gray-600 mb-1.5">Tasks por membro</div>
        <div className="flex flex-col gap-1">
          {BARS.map(b => (
            <div key={b.nome} className="flex items-center gap-1">
              <div className="text-[6px] text-gray-500 w-20 truncate shrink-0">{b.nome.split(' ')[0]}</div>
              <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                <div className="h-full rounded-full" style={{width:`${(b.val/17)*100}%`,background:b.color}} />
              </div>
              <div className="text-[6px] font-semibold text-gray-600 w-3 text-right">{b.val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   CHAMADOS — Kanban fiel ao screenshot
══════════════════════════════════════════════════════════════ */
function ChamadosScreen() {
  const COLS = [
    {
      label:'ABERTO', dot:'#6b7280', count:1,
      cards:[{num:'#15',prio:'MÉD',titulo:'Tela de login retornando erro 500 intermitente',cat:'Sistema',sla:'SLA Violado 10d',users:['A'],fila:true}],
    },
    {
      label:'EM ATENDIMENTO', dot:'#3b82f6', count:2,
      cards:[
        {num:'#21',prio:'BAI',titulo:'Configurar assinatura de e-mail padrão',cat:'Comunicação',sla:'SLA Violado 15d',users:['FA','A'],fila:false},
        {num:'#3', prio:'MÉD',titulo:'Criação de Usuário',cat:'Suporte Técnico',sla:'SLA Violado 2d',users:['A'],fila:false},
      ],
    },
    { label:'AGUARDANDO', dot:'#f59e0b', count:0, cards:[] },
    {
      label:'RESOLVIDO', dot:'#22c55e', count:3,
      cards:[
        {num:'#6', prio:'CRT',titulo:'Teste',cat:'TI',sla:'2d',users:['A'],fila:false},
        {num:'#4', prio:'MÉD',titulo:'Desbloquear Usuário',cat:'Suporte Técnico',sla:'2d',users:['A','GR'],fila:false},
        {num:'#22',prio:'MÉD',titulo:'Sistema de ponto eletrônico offline',cat:'Hardware',sla:'8d',users:['A','GR'],fila:false},
      ],
    },
    {
      label:'FECHADO', dot:'#7c3aed', count:2,
      cards:[
        {num:'#1',prio:'CRT',titulo:'Criar Plano Orçamentário 2027',cat:'Financeiro',sla:'8d',users:['A'],fila:false},
        {num:'#5',prio:'MÉD',titulo:'Testar Ferramenta Orkiestri',cat:'Suporte Técnico',sla:'2d',users:['A','GR'],fila:false},
      ],
    },
  ]
  const pc: Record<string,string> = {MÉD:'#fef3c7',BAI:'#f3f4f6',CRT:'#fee2e2'}
  const tc: Record<string,string> = {MÉD:'#d97706',BAI:'#6b7280',CRT:'#dc2626'}
  return (
    <div className="flex flex-col h-full bg-[#f8f9fb]">
      {/* Counter strip */}
      <div className="flex gap-1.5 mx-3 mt-2 mb-2 flex-wrap shrink-0">
        {[{l:'TOTAL',v:'8',c:'text-gray-700'},{l:'ABERTOS',v:'1',c:'text-gray-500'},{l:'EM ATEND.',v:'2',c:'text-blue-600'},{l:'AGUARDANDO',v:'0',c:'text-yellow-500'},{l:'RESOLVIDOS',v:'3',c:'text-green-600'},{l:'FECHADOS',v:'2',c:'text-violet-600'},{l:'SLA VIOLADO',v:'3',c:'text-red-500'},{l:'SLA EM RISCO',v:'0',c:'text-gray-400'}].map(x=>(
          <div key={x.l} className="rounded-lg border border-gray-200 bg-white shadow-sm px-2 py-1 text-center">
            <div className="text-[6px] text-gray-400 uppercase tracking-wide">{x.l}</div>
            <div className={`text-sm font-bold leading-tight ${x.c}`}>{x.v}</div>
          </div>
        ))}
      </div>
      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200 mx-3 mb-2 shrink-0">
        {[{l:'Meus Chamados',n:8,active:true},{l:'Fila Pública',n:9,active:false},{l:'Todos',n:8,active:false}].map(t=>(
          <div key={t.l} className={`flex items-center gap-1 px-3 py-1.5 text-[8px] font-medium border-b-2 -mb-px cursor-pointer ${t.active?'border-violet-500 text-violet-600':'border-transparent text-gray-400'}`}>
            {t.l} <span className={`text-[7px] rounded-full px-1 ${t.active?'bg-violet-100 text-violet-600':'bg-gray-100 text-gray-400'}`}>{t.n}</span>
          </div>
        ))}
      </div>
      {/* Kanban */}
      <div className="mx-3 flex gap-1.5 flex-1 overflow-hidden">
        {COLS.map(col=>(
          <div key={col.label} className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:col.dot}} />
              <span className="text-[6px] font-semibold text-gray-600 truncate">{col.label}</span>
              <span className="text-[6px] text-gray-400 ml-auto shrink-0 border border-gray-200 rounded-full px-1">{col.count}</span>
            </div>
            <div className="flex flex-col gap-1 flex-1">
              {col.cards.slice(0,2).map(card=>(
                <div key={card.num} className="rounded-lg border border-gray-200 bg-white p-1.5 shadow-sm">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[6px] text-gray-400">{card.num}</span>
                    <span className="text-[5px] font-bold px-1 py-0.5 rounded" style={{background:pc[card.prio],color:tc[card.prio]}}>{card.prio}</span>
                  </div>
                  <div className="text-[7px] font-medium text-gray-700 leading-tight mb-1 line-clamp-2">{card.titulo}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-[6px] px-1 py-0.5 rounded bg-gray-100 text-gray-500">{card.cat}</span>
                    <span className="text-[6px] text-red-400">{card.sla.startsWith('SLA')&&<span className="text-red-400">●</span>} {card.sla}</span>
                  </div>
                  <div className="flex items-center gap-0.5 mt-1">
                    {card.users.map(u=>(
                      <span key={u} className="w-3.5 h-3.5 rounded-full bg-violet-200 flex items-center justify-center text-[6px] font-bold text-violet-700">{u[0]}</span>
                    ))}
                  </div>
                </div>
              ))}
              {col.cards.length===0 && (
                <div className="rounded-lg border border-dashed border-gray-200 p-2 text-center flex-1">
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
   PROJETOS — sidebar + kanban
══════════════════════════════════════════════════════════════ */
function ProjetosScreen() {
  const PROJ = [
    {nome:'Plataforma de BI e Analytics',  status:'Planejamento',  prio:'ALTA',    color:'#f59e0b', pct:5,   active:false},
    {nome:'Automação de Processos RH',     status:'Concluído',     prio:'MEDIA',   color:'#22c55e', pct:100, active:false},
    {nome:'Redesign Portal do Cliente',    status:'Em andamento',  prio:'MEDIA',   color:'#06b6d4', pct:72,  active:false},
    {nome:'Migração para Cloud AWS',       status:'Planejamento',  prio:'ALTA',    color:'#3b82f6', pct:10,  active:true },
    {nome:'Implantação ERP Financeiro',    status:'Em andamento',  prio:'ALTA',    color:'#7c3aed', pct:45,  active:false},
    {nome:'Teste Operacional de Projetos', status:'Planejamento',  prio:'URGENTE', color:'#ec4899', pct:33,  active:false},
  ]
  const KANBAN = [
    {col:'A Fazer',     count:6, color:'#9ca3af', tasks:['Reunião de kick-off com stakeholders','Validar arquitetura técnica','Testes de integração e homologação','Deploy em produção e monitoramento','Documentar decisões de arquitetura (ADR)','Atualizar README e documentação técnica']},
    {col:'Em Andamento',count:4, color:'#3b82f6', tasks:['Documentar requisitos funcionais','Configurar ambiente de desenvolvimento','Desenvolvimento módulo core','Configurar pipeline de CI/CD']},
    {col:'Em Revisão',  count:1, color:'#f59e0b', tasks:['Code review do módulo principal']},
    {col:'Cancelada',   count:0, color:'#ef4444', tasks:[]},
    {col:'Concluída',   count:0, color:'#22c55e', tasks:[]},
  ]
  return (
    <div className="flex h-full bg-[#f8f9fb]">
      {/* Sidebar */}
      <div className="w-[130px] shrink-0 border-r border-gray-200 flex flex-col pt-2 px-2 bg-white">
        <div className="text-[7px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-1">6 Projetos</div>
        {PROJ.map(p=>(
          <div key={p.nome} className={`rounded-lg px-1.5 py-1.5 mb-0.5 cursor-pointer ${p.active?'bg-violet-50 border border-violet-200':'hover:bg-gray-50 border border-transparent'}`}>
            <div className="flex items-center gap-1 mb-0.5">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:p.color}} />
              <span className="text-[7px] font-medium text-gray-700 truncate leading-tight">{p.nome}</span>
            </div>
            <div className="flex items-center gap-1 pl-2.5">
              <span className="text-[6px] text-gray-400">{p.status}</span>
              <span className="text-[5px] font-bold ml-auto" style={{color:p.prio==='ALTA'?'#f59e0b':p.prio==='URGENTE'?'#ef4444':'#6b7280'}}>{p.prio}</span>
            </div>
            <div className="pl-2.5 mt-0.5">
              <div className="h-0.5 rounded-full bg-gray-200"><div className="h-full rounded-full" style={{width:`${p.pct}%`,background:p.color}} /></div>
              <div className="text-[5px] text-gray-400 mt-0.5">{p.pct}%</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main kanban */}
      <div className="flex-1 flex flex-col pt-2 px-2 min-w-0">
        <div className="mb-2 shrink-0">
          <div className="text-[10px] font-bold text-gray-800 leading-tight">Migração para Cloud AWS</div>
          <div className="text-[7px] text-gray-400 mt-0.5">3 membros · Prazo: 23/11/2026</div>
          <div className="flex items-center gap-2 mt-1">
            <div className="h-1 flex-1 rounded-full bg-gray-200"><div className="h-full w-[10%] rounded-full bg-blue-500" /></div>
            <span className="text-[6px] text-blue-500 font-semibold">10%</span>
          </div>
        </div>
        <div className="flex gap-1.5 flex-1 overflow-hidden">
          {KANBAN.map(col=>(
            <div key={col.col} className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-0.5 mb-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:col.color}} />
                <span className="text-[6px] font-semibold text-gray-500 truncate">{col.col}</span>
                <span className="text-[6px] text-gray-400 ml-auto border border-gray-200 rounded-full px-1">{col.count}</span>
              </div>
              <div className="flex flex-col gap-1">
                {col.tasks.slice(0,3).map(t=>(
                  <div key={t} className="rounded border border-gray-200 bg-white p-1 shadow-sm">
                    <div className="text-[6px] font-medium text-gray-700 leading-tight">{t}</div>
                  </div>
                ))}
                {col.tasks.length===0 && (
                  <div className="rounded border border-dashed border-gray-200 p-2 text-center">
                    <span className="text-[6px] text-gray-300">Solte tarefas aqui</span>
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
   AGENDA — calendário mensal Maio 2026
══════════════════════════════════════════════════════════════ */
function AgendaScreen() {
  // Dados reais do screenshot — cada célula: [dia, eventos[]]
  const WEEKS = [
    [
      { d:null, evs:[] }, { d:null, evs:[] }, { d:null, evs:[] }, { d:null, evs:[] }, { d:null, evs:[] },
      { d:1, evs:[{t:'Dia do Trabalhador', color:'#fca5a5', text:'#dc2626'}] }, { d:2, evs:[] },
    ],
    [
      { d:3, evs:[] }, { d:4, evs:[] }, { d:5, evs:[] }, { d:6, evs:[] }, { d:7, evs:[] }, { d:8, evs:[] }, { d:9, evs:[] },
    ],
    [
      { d:10, evs:[] }, { d:11, evs:[] }, { d:12, evs:[] },
      { d:13, evs:[{t:'09:00 Daily Standup — Time TI',color:'#c4b5fd',text:'#7c3aed'},{t:'10:00 Sprint Planning',color:'#a5f3fc',text:'#0891b2'}] },
      { d:14, evs:[{t:'09:00 Daily Standup — Time TI',color:'#c4b5fd',text:'#7c3aed'}] },
      { d:15, evs:[{t:'09:00 Daily Standup — Time TI',color:'#c4b5fd',text:'#7c3aed'},{t:'14:00 Consulta médica',color:'#bbf7d0',text:'#15803d'}] },
      { d:16, evs:[{t:'09:00 Daily Standup — Time TI',color:'#c4b5fd',text:'#7c3aed'}] },
    ],
    [
      { d:17, evs:[{t:'09:00 Daily Standup — Time TI',color:'#c4b5fd',text:'#7c3aed'},{t:'16:00 Reunião com Fornecedor — AWS',color:'#fed7aa',text:'#c2410c'}] },
      { d:18, evs:[] },
      { d:19, evs:[{t:'09:00 Treinamento: Uso do Orkiestri',color:'#fbcfe8',text:'#be185d'}] },
      { d:20, evs:[{t:'09:00 Daily Standup — Time TI',color:'#c4b5fd',text:'#7c3aed'},{t:'14:00 Reunião Semanal de TI',color:'#c4b5fd',text:'#7c3aed'}] },
      { d:21, evs:[{t:'09:00 Daily Standup — Time TI',color:'#c4b5fd',text:'#7c3aed'},{t:'09:00 Colocar a Alice para dormir',color:'#bbf7d0',text:'#15803d'}] },
      { d:22, evs:[{t:'09:00 Daily Standup — Time TI',color:'#c4b5fd',text:'#7c3aed'},{t:'15:00 Reunião com gestor',color:'#c4b5fd',text:'#7c3aed'}] },
      { d:23, evs:[{t:'09:00 Daily Standup — Time TI',color:'#c4b5fd',text:'#7c3aed'}], extra:1 },
    ],
    [
      { d:24, evs:[{t:'09:00 Daily Standup — Time TI',color:'#c4b5fd',text:'#7c3aed'},{t:'14:00 Reunião de Alinhamento Comercial',color:'#fed7aa',text:'#c2410c'}] },
      { d:25, evs:[{t:'10:10 Reunião de Alinhamento Testar',color:'#c4b5fd',text:'#7c3aed'}] },
      { d:26, evs:[{t:'09:00 🔔 Renovar certificado SSL',color:'#fef08a',text:'#a16207'},{t:'10:00 Sprint Review & Retrospectiva',color:'#a5f3fc',text:'#0891b2'}] },
      { d:27, evs:[{t:'09:00 Daily Standup — Time TI',color:'#c4b5fd',text:'#7c3aed'},{t:'10:00 Sprint Planning',color:'#a5f3fc',text:'#0891b2'}] },
      { d:28, evs:[{t:'09:00 🔔 Backup mensal — verificar logs',color:'#fef08a',text:'#a16207'},{t:'09:00 Daily Standup — Time TI',color:'#c4b5fd',text:'#7c3aed'}], today:true },
      { d:29, evs:[{t:'09:00 Daily Standup — Time TI',color:'#c4b5fd',text:'#7c3aed'},{t:'14:00 One-on-One — Review Semestral',color:'#bbf7d0',text:'#15803d'}] },
      { d:30, evs:[{t:'09:00 Daily Standup — Time TI',color:'#c4b5fd',text:'#7c3aed'},{t:'14:00 Kickoff — Migração Cloud AWS',color:'#fed7aa',text:'#c2410c'}] },
    ],
    [
      { d:31, evs:[{t:'09:00 Daily Standup — Time TI',color:'#c4b5fd',text:'#7c3aed'}] },
      { d:null, evs:[] }, { d:null, evs:[] }, { d:null, evs:[] }, { d:null, evs:[] }, { d:null, evs:[] }, { d:null, evs:[] },
    ],
  ]
  const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
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
          {['Hoje','Mês','Semana','Dia'].map(v=>(
            <span key={v} className={`text-[8px] px-2 py-0.5 cursor-pointer ${v==='Mês'?'bg-violet-600 text-white font-semibold':'text-gray-500 hover:bg-gray-50'}`}>{v}</span>
          ))}
        </div>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-100 shrink-0">
        {DAYS.map(d=>(
          <div key={d} className="text-center text-[7px] font-semibold text-gray-400 py-1 border-r border-gray-100 last:border-0">{d}</div>
        ))}
      </div>
      {/* Calendar grid */}
      <div className="flex-1 overflow-hidden">
        {WEEKS.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-gray-100 last:border-0" style={{height:`${100/WEEKS.length}%`}}>
            {week.map((cell, ci) => (
              <div key={ci} className={`border-r border-gray-100 last:border-0 px-0.5 pt-0.5 overflow-hidden ${cell.today?'bg-blue-50':cell.d===null?'bg-gray-50/50':''}`}>
                {cell.d && (
                  <>
                    <span className={`text-[8px] font-medium block mb-0.5 ${cell.today?'text-blue-600 font-bold':cell.d===1||ci===0||ci===6?'text-gray-400':'text-gray-700'}`}>{cell.d}</span>
                    {(cell.evs as any[]).slice(0,2).map((ev,i)=>(
                      <div key={i} className="text-[6px] rounded px-0.5 mb-0.5 truncate leading-tight py-0.5" style={{background:ev.color,color:ev.text}}>{ev.t}</div>
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
   ORÇAMENTO — dashboard CAPEX/OPEX
══════════════════════════════════════════════════════════════ */
function OrcamentoScreen() {
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const PREVISTO = [48830,31310,32710,61020,61320,63320,69720,70220,71720,78920,79420,81220]
  const REALIZADO= [47248,38716,34410,59552,23738,   0,   0,   0,   0,   0,   0,   0]
  const ESTOUROS = [false, false, true, false, false, false, false, false, false, false, false, false]
  const CATS = [
    {nome:'Serviços Prestados',    pct:49.8, val:'R$ 78.659', color:'#7c3aed'},
    {nome:'Manutenção de Softwares',pct:36.0, val:'R$ 69.565', color:'#7c3aed'},
    {nome:'Software e Licenças',   pct:11.0, val:'R$ 21.794', color:'#7c3aed'},
    {nome:'Infraestrutura e Cloud',pct: 9.0, val:'R$ 17.781', color:'#7c3aed'},
    {nome:'Pessoal e Treinamentos',pct: 4.0, val:'R$ 7.875',  color:'#7c3aed'},
  ]
  const maxVal = Math.max(...PREVISTO)
  return (
    <div className="h-full bg-white flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200 px-3 mt-1.5 shrink-0">
        {['Dashboard','OPEX','CAPEX','Aprovações','Configurações'].map(t=>(
          <div key={t} className={`px-2.5 py-1.5 text-[8px] font-medium cursor-pointer border-b-2 -mb-px ${t==='Dashboard'?'border-violet-500 text-violet-600':'border-transparent text-gray-400'}`}>{t}</div>
        ))}
      </div>
      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-2 px-3 mt-2 mb-2 shrink-0">
        {[
          {l:'TOTAL PREVISTO',v:'R$ 749.710',c:'text-violet-600',bg:'bg-violet-50',border:'border-violet-100'},
          {l:'TOTAL REALIZADO',v:'R$ 195.674',c:'text-cyan-600',bg:'bg-cyan-50',border:'border-cyan-100'},
          {l:'EXECUÇÃO GLOBAL',v:'26.0%',c:'text-emerald-600',bg:'bg-emerald-50',border:'border-emerald-100'},
          {l:'ESTOUROS',v:'1',c:'text-red-500',bg:'bg-red-50',border:'border-red-100'},
        ].map(k=>(
          <div key={k.l} className={`rounded-lg border ${k.border} ${k.bg} p-2`}>
            <div className="text-[6px] text-gray-400 uppercase tracking-wide mb-0.5">{k.l}</div>
            <div className={`text-sm font-bold ${k.c}`}>{k.v}</div>
          </div>
        ))}
      </div>
      {/* Charts */}
      <div className="flex gap-2 px-3 flex-1 overflow-hidden">
        {/* Evolução mensal */}
        <div className="flex-1 rounded-lg border border-gray-100 bg-gray-50 p-2 overflow-hidden">
          <div className="text-[8px] font-semibold text-gray-700 mb-1.5">Evolução Mensal — Previsto × Realizado</div>
          <div className="flex flex-col gap-0.5">
            {MESES.map((m,i)=>(
              <div key={m} className="flex items-center gap-1">
                <span className="text-[6px] text-gray-400 w-4 shrink-0">{m}</span>
                <div className="flex-1 flex flex-col gap-0.5">
                  <div className="h-1 rounded-full bg-gray-200 overflow-hidden">
                    <div className="h-full rounded-full bg-violet-400" style={{width:`${(PREVISTO[i]/maxVal)*100}%`}} />
                  </div>
                  {REALIZADO[i]>0 && (
                    <div className="h-1 rounded-full bg-gray-200 overflow-hidden">
                      <div className="h-full rounded-full" style={{width:`${(REALIZADO[i]/maxVal)*100}%`,background:ESTOUROS[i]?'#ef4444':'#06b6d4'}} />
                    </div>
                  )}
                </div>
                <span className="text-[6px] font-mono text-gray-500 w-12 text-right shrink-0">
                  {REALIZADO[i]>0?(ESTOUROS[i]?<span className="text-red-500">R${(REALIZADO[i]/1000).toFixed(0)}k</span>:`R$${(REALIZADO[i]/1000).toFixed(0)}k`):''}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-1.5">
            {[{c:'bg-violet-400',l:'Previsto'},{c:'bg-cyan-400',l:'Realizado'},{c:'bg-red-400',l:'Estouro'}].map(x=>(
              <div key={x.l} className="flex items-center gap-0.5"><span className={`w-2 h-1 rounded-full ${x.c}`}/><span className="text-[6px] text-gray-400">{x.l}</span></div>
            ))}
          </div>
        </div>
        {/* Distribuição */}
        <div className="w-36 shrink-0 rounded-lg border border-gray-100 bg-gray-50 p-2">
          <div className="text-[8px] font-semibold text-gray-700 mb-1.5">Distribuição por Categoria</div>
          <div className="flex flex-col gap-1.5">
            {CATS.map(c=>(
              <div key={c.nome}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[7px] text-gray-600 truncate flex-1">{c.nome}</span>
                  <span className="text-[7px] font-semibold text-gray-500 shrink-0 ml-1">{c.pct}%</span>
                </div>
                <div className="h-1 rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-full rounded-full" style={{width:`${c.pct*2}%`,background:'#7c3aed'}} />
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
   ATIVOS — inventário com cards
══════════════════════════════════════════════════════════════ */
function AtivosScreen() {
  const CATS = [
    {nome:'Todos',25:25,n:25,active:false},
    {nome:'Computadores',n:8,active:false},
    {nome:'Dispositivos Móveis',n:4,active:false},
    {nome:'Hardware',n:13,active:true},
    {nome:'Mobiliário e Instalações',n:8,active:false},
    {nome:'Móveis',n:8,active:false},
    {nome:'Periféricos',n:0,active:false},
    {nome:'Rede e Telecom',n:6,active:false},
    {nome:'Software e Licenças',n:2,active:false},
  ]
  const ATIVOS = [
    {cod:'PR-002',nome:'Impressora HP Color LaserJet Pro M4...',status:'Ativo',  user:'Fernanda Alves'},
    {cod:'PN-004',nome:'Monitor Ultrawide LG 49"',             status:'Ativo',  user:'Diego Pereira'},
    {cod:'MN-003',nome:'Monitor Samsung 32" 4K',               status:'Ativo',  user:'Beatriz Lima'},
    {cod:'SV-002',nome:'NAS Synology DS920+',                  status:'Ativo',  user:'Carlos Souza'},
    {cod:'SV-001',nome:'Servidor Dell PowerEdge R750',         status:'Ativo',  user:'Ana Costa'},
    {cod:'NB-005',nome:'Notebook Dell XPS 15',                 status:'Ativo',  user:'Guilherme Rodrigues'},
    {cod:'NB-004',nome:'Notebook MacBook Pro 14" M3',          status:'Ativo',  user:'Administrator'},
    {cod:'PR-001',nome:'Impressora HP LaserJet Pro M404n',     status:'Inativo',user:'Diego Pereira'},
    {cod:'MN-002',nome:'Monitor Dell P2722H 27"',              status:'Ativo',  user:'Diego Pereira'},
    {cod:'MN-001',nome:'Monitor LG UltraWide 34"',             status:'Ativo',  user:'Diego Pereira'},
    {cod:'NB-003',nome:'Notebook HP EliteBook 840',            status:'Manutenção',user:'Diego Pereira'},
    {cod:'NB-002',nome:'Notebook Lenovo ThinkPad X1',          status:'Ativo',  user:'Diego Pereira'},
    {cod:'NB-001',nome:'Notebook Dell Latitude 5540',          status:'Ativo',  user:'Diego Pereira'},
  ]
  const SC: Record<string,string> = {Ativo:'text-emerald-600',Inativo:'text-red-500',Manutenção:'text-amber-600'}
  const SB: Record<string,string> = {Ativo:'bg-emerald-50 border-emerald-100',Inativo:'bg-red-50 border-red-100',Manutenção:'bg-amber-50 border-amber-100'}
  return (
    <div className="flex h-full bg-[#f8f9fb]">
      {/* Sidebar */}
      <div className="w-28 shrink-0 border-r border-gray-200 bg-white pt-2">
        <div className="text-[7px] font-semibold text-gray-400 uppercase tracking-wide px-2 mb-1">Categorias</div>
        {CATS.map(c=>(
          <div key={c.nome} className={`flex items-center justify-between px-2 py-1 cursor-pointer ${c.active?'bg-violet-50 border-r-2 border-violet-500':''}`}>
            <span className={`text-[7px] ${c.active?'text-violet-700 font-semibold':'text-gray-600'}`}>{c.nome}</span>
            <span className={`text-[7px] ${c.active?'text-violet-500':'text-gray-400'}`}>{c.n}</span>
          </div>
        ))}
      </div>
      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Counter strip */}
        <div className="flex gap-0 shrink-0 border-b border-gray-200 bg-white">
          {[{l:'Total',v:25,border:'border-l-4 border-violet-500'},{l:'Ativo',v:23,border:'border-l-4 border-emerald-500'},{l:'Manutenção',v:1,border:'border-l-4 border-amber-500'},{l:'Inativo',v:1,border:'border-l-4 border-gray-300'}].map(x=>(
            <div key={x.l} className={`px-4 py-2 ${x.border}`}>
              <div className={`text-base font-bold ${x.l==='Ativo'?'text-emerald-600':x.l==='Manutenção'?'text-amber-600':x.l==='Inativo'?'text-gray-500':'text-gray-800'}`}>{x.v}</div>
              <div className="text-[7px] text-gray-400">{x.l}</div>
            </div>
          ))}
        </div>
        {/* Cards grid */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="text-[7px] text-gray-400 mb-1.5">13 ativos</div>
          <div className="grid grid-cols-5 gap-1.5">
            {ATIVOS.map(a=>(
              <div key={a.cod} className={`rounded-lg border bg-white p-2 shadow-sm ${SB[a.status]||'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[6px] text-gray-400 font-mono">{a.cod}</span>
                  <span className={`text-[6px] font-semibold ${SC[a.status]}`}>{a.status}</span>
                </div>
                <div className="text-[7px] font-medium text-gray-800 leading-tight mb-1 line-clamp-2">{a.nome}</div>
                <div className="text-[6px] text-gray-400 truncate">{a.user}</div>
                <div className="text-[6px] text-gray-300">Administrativo</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   DEMO SECTION
══════════════════════════════════════════════════════════════ */
const SCREENS: Record<string, React.ReactNode> = {
  executivo:  <ExecutivoScreen  />,
  relatorios: <RelatoriosScreen />,
  chamados:   <ChamadosScreen   />,
  projetos:   <ProjetosScreen   />,
  agenda:     <AgendaScreen     />,
  orcamento:  <OrcamentoScreen  />,
  ativos:     <AtivosScreen     />,
}

const ROUTES: Record<string, string> = {
  executivo:  'dashboard/executivo',
  relatorios: 'dashboard/relatorios',
  chamados:   'dashboard/chamados',
  projetos:   'dashboard/projetos',
}

export default function DemoSection() {
  const [active, setActive] = useState('executivo')
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-8%' })

  return (
    <section id="plataforma" ref={ref} className="relative py-12 lg:py-16 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(167,139,250,0.22)] to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-violet-600/9 blur-[130px] rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-cyan-500/6 blur-[110px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-10"
        >
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgba(167,139,250,0.2)] bg-[rgba(167,139,250,0.07)] text-[var(--accent-violet)] text-xs font-medium mb-4">
            Plataforma integrada
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--text-primary)] mb-4">
            Escale a gestão operacional
            <br className="hidden sm:block" /> da sua empresa
          </h2>
          <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto">
            Transforme tarefas, chamados, projetos e indicadores em uma única operação inteligente.
          </p>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="lp-card flex items-center gap-1 p-1 rounded-2xl border border-[rgba(162,130,255,0.12)] backdrop-blur-xl mb-4 overflow-x-auto scrollbar-none w-fit mx-auto"
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

        {/* Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="rounded-2xl border border-[rgba(162,130,255,0.18)] overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.55)]"
          style={{ height: 420 }}
        >
          {/* Window chrome — dark */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[rgba(162,130,255,0.12)] bg-[#07071a] shrink-0">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex-1 mx-3">
              <div className="max-w-[260px] mx-auto flex items-center gap-2 bg-[#0f0f2a] border border-[rgba(162,130,255,0.15)] rounded px-2.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
                <span className="text-[9px] text-gray-400 font-mono">orkiestri.com/{ROUTES[active]}</span>
              </div>
            </div>
            {/* Tab buttons in chrome */}
            <div className="flex items-center gap-1">
              {TABS.map(t => {
                const Icon = t.icon
                return (
                  <button
                    key={t.id}
                    onClick={() => setActive(t.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium transition-all ${active === t.id ? 'bg-violet-900/60 text-violet-300' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    <Icon size={9} />
                    <span className="hidden sm:inline">{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Screen area — light */}
          <div className="relative overflow-hidden flex-1" style={{ height: 'calc(420px - 45px)' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 overflow-hidden"
              >
                {SCREENS[active]}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

      </div>
    </section>
  )
}
