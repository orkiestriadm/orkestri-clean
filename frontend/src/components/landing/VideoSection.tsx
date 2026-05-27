'use client'

import { useState, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Play, X } from 'lucide-react'

export default function VideoSection() {
  const [playing, setPlaying] = useState(false)
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10%' })

  return (
    <section ref={ref} className="relative py-12 lg:py-16 overflow-hidden">
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
            {/* Background Video */}
            <div className="absolute inset-0 overflow-hidden">
              <video 
                src="/videos/apresentacaoOrkiestri.mp4" 
                className="w-full h-full object-cover opacity-60" 
                autoPlay 
                loop 
                muted 
                playsInline 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />
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
          Apresentação institucional
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
          <div className="w-full max-w-4xl aspect-video rounded-2xl bg-[#0c0c22] border border-[rgba(162,130,255,0.2)] flex items-center justify-center overflow-hidden" onClick={e => e.stopPropagation()}>
            <video 
              src="/videos/apresentacaoOrkiestri.mp4" 
              className="w-full h-full object-cover rounded-2xl outline-none" 
              controls 
              autoPlay 
            />
          </div>
        </motion.div>
      )}
    </section>
  )
}
