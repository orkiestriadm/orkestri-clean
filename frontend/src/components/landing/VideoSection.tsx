'use client'

import { useState, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Play, X } from 'lucide-react'

export default function VideoSection() {
  const [playing, setPlaying] = useState(false)
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10%' })

  return (
    <section ref={ref} className="relative py-24 lg:py-32 overflow-hidden">
      {/* Background orb */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-cyan-500/5 blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgba(34,211,238,0.2)] bg-[rgba(34,211,238,0.06)] text-[#22d3ee] text-xs font-medium mb-4">
            Vídeo institucional
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--text-primary)] mb-4">
            Veja o Orkiestri em ação
          </h2>
          <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto">
            Descubra como empresas estão centralizando toda a operação em uma única plataforma moderna e escalável.
          </p>
        </motion.div>

        {/* Player */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-2xl overflow-hidden border border-[rgba(162,130,255,0.15)] shadow-[0_32px_80px_rgba(0,0,0,0.6)] group cursor-pointer"
          onClick={() => setPlaying(true)}
        >
          {/* Thumbnail */}
          <div className="relative aspect-video bg-[#0a0a1e] flex items-center justify-center">
            {/* Abstract gradient background simulating a screen */}
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-gradient-to-br from-[#0c0c22] via-[#0e0820] to-[#06060f]" />
              {/* Grid */}
              <div className="absolute inset-0 opacity-[0.04]"
                style={{ backgroundImage: 'radial-gradient(circle, rgba(162,130,255,1) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
              {/* Orbs */}
              <div className="absolute top-1/4 left-1/3 w-64 h-64 rounded-full bg-violet-600/20 blur-[80px]" />
              <div className="absolute bottom-1/4 right-1/3 w-48 h-48 rounded-full bg-cyan-500/15 blur-[60px]" />

              {/* Simulated interface elements */}
              <div className="absolute inset-8 sm:inset-16">
                {/* Header bar */}
                <div className="w-full h-8 rounded-lg bg-[rgba(12,12,34,0.8)] border border-[rgba(162,130,255,0.12)] mb-3 flex items-center px-3 gap-2">
                  <div className="w-3 h-3 rounded-full bg-violet-500/60" />
                  <div className="flex-1 h-1.5 rounded-full bg-[rgba(162,130,255,0.1)]" />
                  <div className="w-8 h-4 rounded bg-violet-600/40" />
                </div>
                {/* Cards row */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[1,2,3].map(i=>(
                    <div key={i} className="h-12 rounded-lg bg-[rgba(12,12,34,0.7)] border border-[rgba(162,130,255,0.1)]" />
                  ))}
                </div>
                {/* Content area */}
                <div className="h-20 rounded-lg bg-[rgba(12,12,34,0.5)] border border-[rgba(162,130,255,0.08)]" />
              </div>

              {/* Overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            </div>

            {/* Play button */}
            <div className="relative z-10 flex flex-col items-center gap-4">
              <motion.div
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.96 }}
                className="relative"
              >
                {/* Pulse rings */}
                <div className="absolute inset-0 rounded-full bg-violet-600/30 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="absolute inset-0 rounded-full bg-violet-600/15 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />

                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shadow-[0_0_40px_rgba(124,58,237,0.6)] group-hover:shadow-[0_0_60px_rgba(124,58,237,0.8)] transition-shadow">
                  <Play size={24} className="text-white ml-1 sm:w-7 sm:h-7" fill="white" />
                </div>
              </motion.div>
              <span className="text-white/80 text-sm font-medium">Assistir apresentação</span>
            </div>

            {/* Duration badge */}
            <div className="absolute bottom-4 right-4 px-2 py-1 rounded bg-black/70 text-white text-xs font-mono">
              2:34
            </div>
          </div>
        </motion.div>

        {/* Caption */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center text-sm text-[var(--text-muted)] mt-4"
        >
          {/* Substitua pelo ID do vídeo real quando disponível — YouTube, Vimeo ou arquivo próprio */}
          Apresentação institucional · 2 min 34 s
        </motion.p>
      </div>

      {/* Modal overlay (placeholder — integrar player real aqui) */}
      {playing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm px-4"
          onClick={() => setPlaying(false)}
        >
          <button
            onClick={() => setPlaying(false)}
            className="absolute top-4 right-4 p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
          <div className="w-full max-w-4xl aspect-video rounded-2xl bg-[#0c0c22] border border-[rgba(162,130,255,0.2)] flex items-center justify-center" onClick={e => e.stopPropagation()}>
            {/*
              INTEGRAÇÃO DE VÍDEO:
              Substitua este bloco pelo iframe do seu player:

              YouTube:
              <iframe src="https://www.youtube.com/embed/SEU_VIDEO_ID?autoplay=1"
                className="w-full h-full rounded-2xl" allowFullScreen />

              Vimeo:
              <iframe src="https://player.vimeo.com/video/SEU_VIDEO_ID?autoplay=1"
                className="w-full h-full rounded-2xl" allowFullScreen />
            */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-violet-600/20 flex items-center justify-center mx-auto mb-4">
                <Play size={24} className="text-[var(--accent-violet)]" fill="currentColor" />
              </div>
              <p className="text-[var(--text-secondary)] text-sm">Vídeo institucional em breve</p>
              <p className="text-[var(--text-muted)] text-xs mt-1">Substitua pelo iframe do player real</p>
            </div>
          </div>
        </motion.div>
      )}
    </section>
  )
}
