'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Presentation,
  AlertTriangle,
  XCircle,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  Layers,
  MessageSquare,
  LineChart,
  Calendar,
  GitMerge,
  ShieldCheck,
  Star,
  Infinity as InfinityIcon,
  CheckSquare,
  Server,
  Fingerprint,
  CreditCard,
  Cpu,
  Network,
  Plus,
  Map,
  Check,
  PhoneCall,
  Keyboard,
  DollarSign,
  Sparkles,
  CircleDollarSign
} from 'lucide-react'

export default function UnderstandOrkiestriPage() {
  const [currentSlide, setCurrentSlide] = useState(1)
  const totalSlides = 8

  const nextSlide = () => {
    if (currentSlide < totalSlides) {
      setCurrentSlide(prev => prev + 1)
    }
  }

  const prevSlide = () => {
    if (currentSlide > 1) {
      setCurrentSlide(prev => prev - 1)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        nextSlide()
      } else if (e.key === 'ArrowLeft') {
        prevSlide()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentSlide])

  // Mobile Swipe Controls
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > 50
    const isRightSwipe = distance < -50

    if (isLeftSwipe) {
      nextSlide()
    } else if (isRightSwipe) {
      prevSlide()
    }

    setTouchStart(null)
    setTouchEnd(null)
  }

  // Motion variants for slide transition
  const slideVariants = {
    initial: { opacity: 0, y: 15, scale: 0.99 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -15, scale: 0.99 }
  }

  return (
    <div 
      className="relative min-h-screen w-full bg-[#050510] text-[#f5f5f7] overflow-hidden flex flex-col justify-between font-sans selection:bg-violet-500/20 selection:text-inherit"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background Dots Grid */}
      <div 
        className="absolute inset-0 opacity-[0.02] pointer-events-none z-0" 
        style={{ 
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', 
          backgroundSize: '32px 32px' 
        }} 
      />

      {/* Background Glowing Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-violet-600/10 blur-[130px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[110px] animate-pulse style={{ animationDelay: '2.5s' }}" />
      </div>

      {/* Header Navigation */}
      <header className="relative z-50 flex items-center justify-between px-6 md:px-12 h-20 bg-slate-950/20 backdrop-blur-xl border-b border-white/5">
        <Link href="/" className="flex items-center gap-2.5 text-sm font-semibold text-slate-300 hover:text-white transition-colors">
          <ArrowLeft size={16} className="text-cyan-400" />
          <span>Voltar para o site</span>
        </Link>
        
        <div className="hidden md:flex items-center gap-3 text-xs tracking-widest text-slate-400 font-bold uppercase">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          Orkiestri Pitch Deck
        </div>

        {/* Header Progress Indicators */}
        <div className="flex items-center gap-1.5 w-32 md:w-48">
          {Array.from({ length: totalSlides }).map((_, idx) => (
            <div 
              key={idx} 
              className="h-[3px] rounded-full bg-white/10 flex-1 relative overflow-hidden"
            >
              <div 
                className={`absolute inset-0 bg-gradient-to-r from-cyan-400 to-violet-500 transition-transform duration-500 ${
                  idx + 1 <= currentSlide ? 'translate-x-0' : '-translate-x-full'
                }`}
              />
            </div>
          ))}
        </div>
      </header>

      {/* Slides Container */}
      <main className="relative flex-1 flex flex-col justify-center items-center z-10 w-full max-w-7xl mx-auto px-6 md:px-12 py-8">
        <AnimatePresence mode="wait">
          {currentSlide === 1 && (
            <motion.div
              key="slide1"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-4xl text-center flex flex-col items-center"
            >
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-violet-500/20 bg-violet-500/5 text-violet-300 text-xs font-semibold tracking-wider uppercase mb-8">
                <Presentation size={14} />
                Apresentação Corporativa
              </span>

              <h1 className="font-display text-7xl md:text-[96px] font-black leading-none mb-8 tracking-tighter">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400">
                  ORKIESTRI
                </span>
              </h1>

              <p className="font-display text-2xl md:text-3xl font-bold text-slate-200 leading-relaxed mb-6">
                A evolução da orquestração operacional corporativa.
              </p>

              <p className="text-base md:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed mb-12">
                Substitua o caos de múltiplos softwares descentralizados por um hub operacional integrado, automatizado e orientado a resultados em tempo real.
              </p>

              <button 
                onClick={nextSlide} 
                className="relative group inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white font-bold text-base hover:from-violet-500 hover:to-violet-400 transition-all shadow-[0_0_30px_rgba(124,58,237,0.4)] hover:shadow-[0_0_40px_rgba(124,58,237,0.6)] hover:-translate-y-0.5"
              >
                {/* Glow behind button */}
                <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 opacity-30 blur-md group-hover:opacity-60 transition duration-500" />
                <span className="relative z-10 flex items-center gap-2">
                  Explorar Apresentação
                  <ArrowRight size={16} />
                </span>
              </button>
              
              <p className="mt-8 text-xs text-slate-500 flex items-center gap-2">
                <Keyboard size={14} />
                Use as setas do teclado (← / →) para navegar
              </p>
            </motion.div>
          )}

          {currentSlide === 2 && (
            <motion.div
              key="slide2"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.4 }}
              className="w-full max-w-6xl"
            >
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-red-500/20 bg-red-500/5 text-red-300 text-xs font-semibold tracking-wider uppercase mb-4">
                <AlertTriangle size={14} />
                O Desafio Operacional
              </span>
              
              <h2 className="font-display text-3xl md:text-5xl font-bold text-white mb-4">
                O problema não é falta de software.
              </h2>
              
              <p className="text-base md:text-lg text-slate-400 mb-10 max-w-3xl">
                Empresas modernas utilizam dezenas de ferramentas diferentes. O resultado é a fragmentação de dados, retrabalho e perda de produtividade operacional.
              </p>

              <div className="grid md:grid-cols-2 gap-8">
                {/* Left Card */}
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-8 relative overflow-hidden backdrop-blur-xl">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 blur-2xl rounded-full" />
                  <h3 className="text-xl font-bold text-red-400 mb-6 flex items-center gap-2">
                    <XCircle size={20} />
                    O Cenário Fragmentado (Legado)
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <span className="text-slate-300 text-sm">Gestão de Projetos</span>
                      <span className="text-xs bg-white/5 text-slate-400 px-2.5 py-1 rounded-md font-mono">Jira</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <span className="text-slate-300 text-sm">Atendimento / Chamados</span>
                      <span class="text-xs bg-white/5 text-slate-400 px-2.5 py-1 rounded-md font-mono">Movidesk</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <span className="text-slate-300 text-sm">Organização de Tarefas</span>
                      <span className="text-xs bg-white/5 text-slate-400 px-2.5 py-1 rounded-md font-mono">Planner</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <span className="text-slate-300 text-sm">Indicadores e Métricas</span>
                      <span className="text-xs bg-white/5 text-slate-400 px-2.5 py-1 rounded-md font-mono">Power BI</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 text-sm">Agenda e Comunicação</span>
                      <span className="text-xs bg-white/5 text-slate-400 px-2.5 py-1 rounded-md font-mono">Outlook / Excel</span>
                    </div>
                  </div>
                </div>

                {/* Right Card */}
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-8 relative overflow-hidden backdrop-blur-xl">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 blur-2xl rounded-full" />
                  <h3 className="text-xl font-bold text-violet-400 mb-6 flex items-center gap-2">
                    <TrendingDown size={20} />
                    As Consequências Operacionais
                  </h3>
                  <div className="space-y-4 text-sm text-slate-300">
                    <div className="flex gap-3">
                      <span className="text-red-400 font-bold">•</span>
                      <span><strong>Perda de contexto:</strong> Informações descentralizadas e descentralizadas.</span>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-red-400 font-bold">•</span>
                      <span><strong>Altos custos:</strong> Licenciamento redundante de múltiplas plataformas.</span>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-red-400 font-bold">•</span>
                      <span><strong>Falta de visibilidade:</strong> Dificuldade para obter métricas de desempenho unificadas.</span>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-red-400 font-bold">•</span>
                      <span><strong>Inércia operacional:</strong> Retrabalho e atrito constante de comunicação entre as equipes.</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentSlide === 3 && (
            <motion.div
              key="slide3"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.4 }}
              className="w-full max-w-6xl"
            >
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-cyan-300 text-xs font-semibold tracking-wider uppercase mb-4">
                <CheckCircle2 size={14} />
                A Solução Orkiestri
              </span>
              
              <h2 className="font-display text-3xl md:text-5xl font-bold text-white mb-4">
                Toda sua operação em um único ecossistema.
              </h2>
              
              <p className="text-base md:text-lg text-slate-400 mb-10 max-w-3xl">
                Conectamos pessoas, fluxos e dados corporativos eliminando sistemas isolados e construindo uma base de governança sólida.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5 hover:border-violet-500/40 transition-all duration-300">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center mb-4">
                    <Layers className="text-violet-400" size={20} />
                  </div>
                  <h4 className="font-bold text-base text-slate-200 mb-1.5">Gestão de Projetos</h4>
                  <p className="text-xs text-slate-400">Entrega de demandas com cronograma integrado e sprints operacionais.</p>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5 hover:border-cyan-500/40 transition-all duration-300">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-4">
                    <MessageSquare className="text-cyan-400" size={20} />
                  </div>
                  <h4 className="font-bold text-base text-slate-200 mb-1.5">Service Desk</h4>
                  <p className="text-xs text-slate-400">Atendimento a chamados com controle integrado de fila e SLAs.</p>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5 hover:border-emerald-500/40 transition-all duration-300">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4">
                    <LineChart className="text-emerald-400" size={20} />
                  </div>
                  <h4 className="font-bold text-base text-slate-200 mb-1.5">Dashboards</h4>
                  <p className="text-xs text-slate-400">Indicadores consolidados baseados nas atividades reais das equipes.</p>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5 hover:border-blue-500/40 transition-all duration-300">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
                    <Calendar className="text-blue-400" size={20} />
                  </div>
                  <h4 className="font-bold text-base text-slate-200 mb-1.5">Agenda Corporativa</h4>
                  <p className="text-xs text-slate-400">Reuniões, compromissos e tarefas integradas ao calendário corporativo.</p>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5 hover:border-fuchsia-500/40 transition-all duration-300">
                  <div className="w-10 h-10 rounded-lg bg-fuchsia-500/10 flex items-center justify-center mb-4">
                    <GitMerge className="text-fuchsia-400" size={20} />
                  </div>
                  <h4 className="font-bold text-base text-slate-200 mb-1.5">Engine de Workflows</h4>
                  <p className="text-xs text-slate-400">Automação inteligente de processos e envio de alertas operacionais.</p>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5 hover:border-amber-500/40 transition-all duration-300">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-4">
                    <ShieldCheck className="text-amber-400" size={20} />
                  </div>
                  <h4 className="font-bold text-base text-slate-200 mb-1.5">Governança</h4>
                  <p className="text-xs text-slate-400">Níveis granulares de acesso, auditoria detalhada de logs e compliance.</p>
                </div>
              </div>
            </motion.div>
          )}

          {currentSlide === 4 && (
            <motion.div
              key="slide4"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.4 }}
              className="w-full max-w-6xl"
            >
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-violet-500/20 bg-violet-500/5 text-violet-300 text-xs font-semibold tracking-wider uppercase mb-4">
                <Star size={14} />
                Diferencial Competitivo
              </span>
              
              <h2 className="font-display text-3xl md:text-5xl font-bold text-white mb-4">
                A força do Contexto Unificado.
              </h2>
              
              <p className="text-base md:text-lg text-slate-400 mb-10 max-w-3xl">
                Nossos módulos não funcionam isolados. Eles cooperam de forma nativa e em tempo real para gerar inteligência operacional.
              </p>

              <div className="grid md:grid-cols-12 gap-8 items-center">
                {/* Visual Flow */}
                <div className="md:col-span-7 space-y-4">
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5 flex items-center gap-4 hover:border-cyan-500/25 transition-all">
                    <div className="w-8 h-8 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-xs font-bold font-mono">1</div>
                    <p className="text-sm text-slate-300"><strong>Chamado é aberto:</strong> Suporte registra a demanda do cliente no Service Desk.</p>
                  </div>
                  
                  <div className="flex justify-center my-0.5">
                    <ChevronRight size={20} className="text-slate-600 rotate-90" />
                  </div>
                  
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5 flex items-center gap-4 hover:border-violet-500/25 transition-all">
                    <div className="w-8 h-8 rounded-full bg-violet-500/10 text-violet-400 flex items-center justify-center text-xs font-bold font-mono">2</div>
                    <p className="text-sm text-slate-300"><strong>Gera tarefa de desenvolvimento:</strong> A tarefa é vinculada instantaneamente a um projeto ativo.</p>
                  </div>
                  
                  <div className="flex justify-center my-0.5">
                    <ChevronRight size={20} className="text-slate-600 rotate-90" />
                  </div>
                  
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5 flex items-center gap-4 hover:border-emerald-500/25 transition-all">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-bold font-mono">3</div>
                    <p className="text-sm text-slate-300"><strong>Dashboards atualizam:</strong> O tempo gasto e o impacto de custo são consolidados em tempo real.</p>
                  </div>
                </div>

                {/* Info Card */}
                <div className="md:col-span-5 bg-white/[0.03] border border-violet-500/20 rounded-2xl p-7 relative overflow-hidden backdrop-blur-xl">
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-violet-600/10 blur-2xl rounded-full" />
                  <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <InfinityIcon size={20} className="text-cyan-400" />
                    Nativo vs. APIs Frágeis
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed mb-6">
                    Em vez de pagar consultores caros para criar integrações via API que frequentemente falham e quebram ao menor sinal de atualização, o Orkiestri oferece essa jornada de dados nativa.
                  </p>
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-2 text-xs text-emerald-400">
                      <CheckSquare size={16} />
                      <span>Sem APIs terceirizadas para gerenciar</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-emerald-400">
                      <CheckSquare size={16} />
                      <span>Fonte única da verdade (Single Source of Truth)</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-emerald-400">
                      <CheckSquare size={16} />
                      <span>Consistência total de dados e relatórios</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentSlide === 5 && (
            <motion.div
              key="slide5"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.4 }}
              className="w-full max-w-6xl"
            >
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-300 text-xs font-semibold tracking-wider uppercase mb-4">
                <ShieldCheck size={14} />
                Arquitetura & Segurança
              </span>
              
              <h2 className="font-display text-3xl md:text-5xl font-bold text-white mb-4">
                Segurança e infraestrutura robustas.
              </h2>
              
              <p className="text-base md:text-lg text-slate-400 mb-10 max-w-3xl">
                Construímos o Orkiestri sobre tecnologias robustas para suportar operações corporativas críticas com total conformidade.
              </p>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
                  <h4 className="font-bold text-lg text-slate-200 mb-2 flex items-center gap-2">
                    <Server size={16} className="text-cyan-400" />
                    Multi-Tenant Isolado
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Cada cliente possui sua própria organização de forma independente na camada lógica do banco de dados, garantindo privacidade e controle total de informações.
                  </p>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
                  <h4 className="font-bold text-lg text-slate-200 mb-2 flex items-center gap-2">
                    <Fingerprint size={16} className="text-violet-400" />
                    Controles RBAC e LGPD
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Controle granular de acessos e permissões para usuários e times. Registros e auditorias completos de qualquer ação em conformidade com as regulamentações.
                  </p>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
                  <h4 className="font-bold text-lg text-slate-200 mb-2 flex items-center gap-2">
                    <CreditCard size={16} className="text-emerald-400" />
                    Billing Integrado
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Mecanismos flexíveis para planos de assinaturas corporativas, controle de consumo de limites, faturamento automático e gestão financeira.
                  </p>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
                  <h4 className="font-bold text-lg text-slate-200 mb-2 flex items-center gap-2">
                    <Cpu size={16} className="text-blue-400" />
                    Observabilidade
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Logs estruturados, tracing e telemetria para garantir tempos de resposta de API consistentes e estabilidade permanente da operação.
                  </p>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
                  <h4 className="font-bold text-lg text-slate-200 mb-2 flex items-center gap-2">
                    <Network size={16} className="text-fuchsia-400" />
                    Escalabilidade Horizontal
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Microsserviços empacotados em containers Docker prontos para expansão sob demanda, alta disponibilidade e backups contínuos de banco de dados.
                  </p>
                </div>

                <div className="bg-white/[0.01] border border-dashed border-white/10 hover:border-violet-500/30 transition-all duration-300 rounded-xl p-6 flex flex-col justify-center items-center text-center">
                  <div className="w-9 h-9 rounded-full bg-violet-600/10 flex items-center justify-center mb-3">
                    <Plus size={16} className="text-violet-400" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-300 mb-1">Customização Dedicada</h4>
                  <p className="text-[10px] text-slate-500 max-w-[200px]">Precisa de integração específica? Nós cuidamos da implementação.</p>
                </div>
              </div>
            </motion.div>
          )}

          {currentSlide === 6 && (
            <motion.div
              key="slide6"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.4 }}
              className="w-full max-w-6xl"
            >
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-300 text-xs font-semibold tracking-wider uppercase mb-4">
                <Map size={14} />
                Roadmap Estratégico
              </span>
              
              <h2 className="font-display text-3xl md:text-5xl font-bold text-white mb-4">
                Evolução guiada por valor.
              </h2>
              
              <p className="text-base md:text-lg text-slate-400 mb-8 max-w-3xl">
                Nossa estratégia de desenvolvimento está dividida em marcos estruturados para acelerar a transformação digital das empresas.
              </p>

              <div className="grid md:grid-cols-3 gap-6 mt-4">
                {/* Phase 1 */}
                <div className="bg-[#12121e]/90 border border-white/5 p-6 rounded-xl hover:border-cyan-500/30 transition-all flex flex-col justify-between backdrop-blur-md">
                  <div>
                    <span className="text-cyan-400 font-bold text-xs tracking-widest uppercase">Fase 01</span>
                    <h4 className="text-lg font-bold text-white mt-1.5 mb-2">Core Operacional</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">
                      Centralize o dia a dia da sua operação eliminando a fragmentação de ferramentas (Jira + Planner + Movidesk).
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-4 mt-auto">
                    <span className="flex items-center gap-1.5 text-xs text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      Chamados
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      Tarefas
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      Projetos
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      Dashboard
                    </span>
                  </div>
                </div>

                {/* Phase 2 */}
                <div className="bg-[#12121e]/90 border border-white/5 p-6 rounded-xl hover:border-violet-500/30 transition-all flex flex-col justify-between backdrop-blur-md">
                  <div>
                    <span className="text-violet-400 font-bold text-xs tracking-widest uppercase">Fase 02</span>
                    <h4 className="text-lg font-bold text-white mt-1.5 mb-2">Core Conectividade</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">
                      Automatize fluxos e sincronize as agendas das equipes em tempo real, sem necessidade de integrações de terceiros.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-4 mt-auto">
                    <span className="flex items-center gap-1.5 text-xs text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                      Agenda
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                      Workflows
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                      Automação
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                      Integrações
                    </span>
                  </div>
                </div>

                {/* Phase 3 */}
                <div className="bg-[#12121e]/90 border border-white/5 p-6 rounded-xl hover:border-fuchsia-500/30 transition-all flex flex-col justify-between backdrop-blur-md">
                  <div>
                    <span className="text-fuchsia-400 font-bold text-xs tracking-widest uppercase">Fase 03</span>
                    <h4 className="text-lg font-bold text-white mt-1.5 mb-2">Core Financeiro</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">
                      Controle custos de CAPEX/OPEX, tenha relatórios preditivos para tomada de decisão e audite cada detalhe da sua empresa.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 border-t border-white/5 pt-4 mt-auto">
                    <div className="grid grid-cols-2 gap-2">
                      <span className="flex items-center gap-1.5 text-xs text-slate-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400" />
                        Onboarding
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-slate-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400" />
                        Preditivos
                      </span>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400" />
                      Gestão de Orçamento (CAPEX/OPEX)
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <span className="flex items-center gap-1.5 text-xs text-slate-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400" />
                        Demandas
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-slate-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400" />
                        Auditorias
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentSlide === 7 && (
            <motion.div
              key="slide7"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.4 }}
              className="w-full max-w-6xl"
            >
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-300 text-xs font-semibold tracking-wider uppercase mb-4">
                <CircleDollarSign size={14} />
                Análise Financeira
              </span>

              <h2 className="font-display text-3xl md:text-5xl font-bold text-white mb-4">
                Quanto custa manter sistemas separados?
              </h2>

              <p className="text-base md:text-lg text-slate-400 mb-8 max-w-3xl">
                Um gestor com equipe de 5 pessoas paga múltiplas licenças todo mês. Veja o que isso representa ao ano.
              </p>

              <div className="grid md:grid-cols-2 gap-6 mb-6">

                {/* Card Legado */}
                <div className="bg-white/[0.02] border border-red-500/20 rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-3xl rounded-full" />
                  <h3 className="text-base font-bold text-red-400 mb-5 flex items-center gap-2">
                    <XCircle size={18} />
                    Stack Legada — 5 agentes/mês
                  </h3>
                  <div className="space-y-3 mb-5">
                    {[
                      { tool: 'Jira Software Cloud Standard', uso: 'Gestão de Projetos', valor: 'R$ 1.300' },
                      { tool: 'Movidesk', uso: 'Atendimento / Chamados', valor: 'R$ 700' },
                      { tool: 'Microsoft 365 Business Premium', uso: 'Agenda, Tarefas, E-mail', valor: 'R$ 850' },
                      { tool: 'Power BI Pro', uso: 'Indicadores e Métricas', valor: 'R$ 350' },
                      { tool: 'GLPI', uso: 'Inventário e Service Desk', valor: 'R$ 700' },
                    ].map((item) => (
                      <div key={item.tool} className="flex items-center justify-between border-b border-white/5 pb-3">
                        <div>
                          <span className="text-slate-200 text-sm font-medium">{item.tool}</span>
                          <p className="text-slate-500 text-xs">{item.uso}</p>
                        </div>
                        <span className="text-red-400 font-bold text-sm font-mono">{item.valor}<span className="text-slate-500 font-normal text-xs">/mês</span></span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    <span className="text-slate-300 text-sm font-semibold">Total mensal</span>
                    <span className="text-red-300 font-extrabold text-lg font-mono">R$ 3.900<span className="text-slate-400 font-normal text-xs">/mês</span></span>
                  </div>
                  <p className="text-right text-slate-500 text-xs mt-2 font-mono">= R$ 46.800 por ano</p>
                </div>

                {/* Card Orkiestri */}
                <div className="bg-white/[0.02] border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full" />
                  <h3 className="text-base font-bold text-emerald-400 mb-5 flex items-center gap-2">
                    <CheckCircle2 size={18} />
                    Orkiestri Business Cloud — 5 usuários
                  </h3>
                  <div className="flex flex-col items-center justify-center py-4 mb-5">
                    <span className="text-5xl font-extrabold text-white font-mono">R$ 99<span className="text-2xl">,90</span></span>
                    <span className="text-slate-400 text-sm mt-1">por mês · tudo incluso</span>
                  </div>
                  <div className="space-y-2.5 mb-5">
                    {[
                      'Service Desk com controle de SLA',
                      'Gestão de Projetos e Sprints',
                      'Agenda Corporativa Integrada',
                      'CRM e Gestão de Clientes',
                      'Dashboards e Relatórios em tempo real',
                    ].map((f) => (
                      <div key={f} className="flex items-center gap-2 text-xs text-slate-300">
                        <Check size={13} className="text-emerald-400 shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                    <span className="text-slate-300 text-sm font-semibold">Total mensal</span>
                    <span className="text-emerald-300 font-extrabold text-lg font-mono">R$ 99<span className="text-sm">,90</span><span className="text-slate-400 font-normal text-xs">/mês</span></span>
                  </div>
                  <p className="text-right text-slate-500 text-xs mt-2 font-mono">= R$ 1.198,80 por ano</p>
                </div>
              </div>

              {/* Banner de economia */}
              <div className="relative rounded-2xl bg-gradient-to-r from-emerald-900/40 via-emerald-800/20 to-emerald-900/40 border border-emerald-500/30 px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-4 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 via-emerald-400/10 to-emerald-600/5 pointer-events-none" />
                <div className="flex items-center gap-3 relative z-10">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <TrendingDown size={20} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-slate-300 text-sm font-semibold">Economia anual estimada com Orkiestri</p>
                    <p className="text-slate-500 text-xs">Baseado em equipe de 5 agentes com stack legada equivalente</p>
                  </div>
                </div>
                <div className="text-center md:text-right relative z-10 shrink-0">
                  <p className="text-4xl font-extrabold text-emerald-400 font-mono">R$ 45.601</p>
                  <p className="text-emerald-300 text-sm font-bold">~97% de redução de custos ao ano</p>
                </div>
              </div>
            </motion.div>
          )}

          {currentSlide === 8 && (
            <motion.div
              key="slide8"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.4 }}
              className="max-w-4xl text-center flex flex-col items-center"
            >
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-cyan-300 text-xs font-semibold tracking-wider uppercase mb-8">
                <Check size={14} />
                Conclusão
              </span>

              <h2 className="font-display text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 mb-8 leading-tight">
                Menos Sistemas.<br />Mais Controle.
              </h2>

              <p className="text-xl md:text-2xl text-slate-200 font-medium max-w-3xl mx-auto leading-relaxed mb-6">
                O Orkiestri não é apenas mais um software. É o ecossistema definitivo para a produtividade da sua empresa.
              </p>

              <p className="text-base text-slate-400 max-w-2xl mx-auto leading-relaxed mb-12">
                Reduza custos de licenciamento desnecessários, evite a fragmentação de dados e empodere a sua gestão operacional em tempo real.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a 
                  href="/#planos" 
                  className="relative group inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white font-bold text-base hover:from-violet-500 hover:to-violet-400 transition-all shadow-[0_0_30px_rgba(124,58,237,0.4)]"
                >
                  <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 opacity-30 blur-md group-hover:opacity-60 transition duration-500" />
                  <span className="relative z-10 flex items-center gap-2.5">
                    Contrate
                    <ArrowRight size={16} />
                  </span>
                </a>
                <a 
                  href="https://wa.me/5514991661688" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 text-slate-300 hover:text-white transition-all text-base font-semibold"
                >
                  <PhoneCall size={16} className="text-emerald-400" />
                  Conversar no WhatsApp
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Navigation controls */}
      <footer className="relative z-50 flex items-center justify-between px-6 md:px-12 h-20 bg-slate-950/20 backdrop-blur-xl border-t border-white/5">
        <button 
          onClick={prevSlide} 
          disabled={currentSlide === 1}
          className={`flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none`}
        >
          <ChevronLeft size={20} />
          <span>Anterior</span>
        </button>

        <div className="text-sm font-semibold text-slate-300 font-mono">
          {currentSlide} / {totalSlides}
        </div>

        <button 
          onClick={nextSlide} 
          disabled={currentSlide === totalSlides}
          className={`flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none`}
        >
          <span>Próximo</span>
          <ChevronRight size={20} />
        </button>
      </footer>
    </div>
  )
}
