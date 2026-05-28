'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, useInView } from 'framer-motion'
import { Play, X, Clapperboard } from 'lucide-react'

// ── Configuração do blur sobre o e-mail ─────────────────────────────────────
// Ajuste os segundos abaixo conforme o momento exato em que o e-mail aparece
// e desaparece no vídeo. A posição é em % relativa ao player (top/left/w/h).
const EMAIL_BLUR: {
  intervals: { start: number; end: number }[]
  top: string
  left: string
  width: string
  height: string
} = {
  // Adicione quantos intervalos precisar: [{ start: X, end: Y }, ...]
  intervals: [
    { start: 0, end: 9999 }, // blur permanente — ajuste quando souber o timestamp
  ],
  top: '36%',
  left: '50%',
  width: '42%',
  height: '7%',
}
// ────────────────────────────────────────────────────────────────────────────

function useEmailBlur(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const check = () => {
      const t = video.currentTime
      const active = EMAIL_BLUR.intervals.some(i => t >= i.start && t <= i.end)
      setShow(active)
    }

    video.addEventListener('timeupdate', check)
    // também checar quando o vídeo carrega/pausa/play
    video.addEventListener('loadedmetadata', check)
    video.addEventListener('seeked', check)
    return () => {
      video.removeEventListener('timeupdate', check)
      video.removeEventListener('loadedmetadata', check)
      video.removeEventListener('seeked', check)
    }
  }, [videoRef])

  return show
}

export default function VideoSection() {
  const [playing, setPlaying] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const modalVideoRef = useRef<HTMLVideoElement>(null)
  const inView = useInView(sectionRef, { once: true, margin: '-10%' })
  const showBlur = useEmailBlur(modalVideoRef)

  const openModal = useCallback(() => setPlaying(true), [])
  const closeModal = useCallback(() => {
    setPlaying(false)
    if (modalVideoRef.current) {
      modalVideoRef.current.pause()
      modalVideoRef.current.currentTime = 0
    }
  }, [])

  // Fechar com ESC
  useEffect(() => {
    if (!playing) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing, closeModal])

  return (
    <section ref={sectionRef} className="relative py-12 lg:py-16 overflow-hidden">

      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-violet-600/6 blur-[110px] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[200px] bg-cyan-500/5 blur-[80px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgba(167,139,250,0.2)] bg-[rgba(167,139,250,0.07)] text-[#a78bfa] text-xs font-medium mb-4">
            <Clapperboard size={12} /> Como funciona
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--text-primary)] mb-4 leading-[1.1]">
            Como o Orkiestri funciona{' '}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              na prática
            </span>
          </h2>
          <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto">
            Veja o sistema real em funcionamento — do onboarding ao dia a dia operacional, em menos de 3 minutos.
          </p>
        </motion.div>

        {/* Player card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-2xl overflow-hidden border border-[rgba(162,130,255,0.15)] shadow-[0_32px_80px_rgba(0,0,0,0.6)] group cursor-pointer"
          onClick={openModal}
        >
          {/* Thumbnail / preview loop */}
          <div className="relative aspect-video bg-[#0a0a1e] flex items-center justify-center">
            <div className="absolute inset-0 overflow-hidden">
              <video
                src="/videos/comofunciona.mp4"
                className="w-full h-full object-cover opacity-55"
                autoPlay
                loop
                muted
                playsInline
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/45" />

              {/* Blur estático sobre e-mail no thumbnail (decorativo) */}
              <div
                className="absolute rounded-lg backdrop-blur-md bg-black/30"
                style={{
                  top: EMAIL_BLUR.top,
                  left: EMAIL_BLUR.left,
                  width: EMAIL_BLUR.width,
                  height: EMAIL_BLUR.height,
                }}
              />
            </div>

            {/* Play button */}
            <div className="relative z-10 flex flex-col items-center gap-4">
              <motion.div
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.96 }}
                className="relative"
              >
                <div className="absolute inset-0 rounded-full bg-violet-600/30 animate-ping" style={{ animationDuration: '2.2s' }} />
                <div className="absolute inset-0 rounded-full bg-violet-600/15 animate-ping" style={{ animationDuration: '2.2s', animationDelay: '0.6s' }} />
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shadow-[0_0_40px_rgba(124,58,237,0.6)] group-hover:shadow-[0_0_60px_rgba(124,58,237,0.8)] transition-shadow">
                  <Play size={24} className="text-white ml-1 sm:w-7 sm:h-7" fill="white" />
                </div>
              </motion.div>
              <span className="text-white/80 text-sm font-medium">Assistir agora</span>
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
          Demonstração completa do sistema — nenhum corte, nenhum script
        </motion.p>
      </div>

      {/* Modal player */}
      {playing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 backdrop-blur-sm px-4"
          onClick={closeModal}
        >
          {/* Close button */}
          <button
            onClick={closeModal}
            className="absolute top-4 right-4 p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors z-10"
          >
            <X size={22} />
          </button>

          {/* Player wrapper */}
          <div
            className="relative w-full max-w-4xl aspect-video rounded-2xl border border-[rgba(162,130,255,0.2)] overflow-hidden shadow-[0_40px_120px_rgba(0,0,0,0.8)]"
            onClick={e => e.stopPropagation()}
          >
            <video
              ref={modalVideoRef}
              src="/videos/comofunciona.mp4"
              className="w-full h-full object-cover rounded-2xl outline-none"
              controls
              autoPlay
            />

            {/* Blur overlay dinâmico sobre o e-mail */}
            <motion.div
              animate={{ opacity: showBlur ? 1 : 0 }}
              transition={{ duration: 0.2 }}
              className="absolute pointer-events-none rounded-lg overflow-hidden"
              style={{
                top: EMAIL_BLUR.top,
                left: EMAIL_BLUR.left,
                width: EMAIL_BLUR.width,
                height: EMAIL_BLUR.height,
              }}
            >
              {/* Múltiplas camadas para blur mais opaco */}
              <div className="absolute inset-0 backdrop-blur-xl bg-[rgba(10,10,30,0.55)]" />
              <div className="absolute inset-0 backdrop-blur-xl" />
              <div className="absolute inset-0 bg-[rgba(10,10,30,0.3)]" />
            </motion.div>
          </div>
        </motion.div>
      )}
    </section>
  )
}
