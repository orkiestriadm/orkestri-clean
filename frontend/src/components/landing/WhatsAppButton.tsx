'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

/*
  CONFIGURAÇÃO:
  Substitua WHATSAPP_NUMBER pelo número comercial real (apenas dígitos, com DDI):
  Ex.: 5511900000000 → Brasil, DDD 11, número 9 0000-0000
*/
const WHATSAPP_NUMBER = '5500000000000'
const WHATSAPP_MESSAGE = encodeURIComponent(
  'Olá! Vi o Orkiestri e gostaria de saber mais sobre a plataforma. Podem me ajudar?'
)
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`

export default function WhatsAppButton() {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)

  useEffect(() => {
    // Aparece após 3s
    const t = setTimeout(() => setVisible(true), 3000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    // Mostra o tooltip após 5s
    if (!visible) return
    const t = setTimeout(() => setShowTooltip(true), 2000)
    return () => clearTimeout(t)
  }, [visible])

  if (dismissed) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2"
        >
          {/* Tooltip */}
          <AnimatePresence>
            {showTooltip && (
              <motion.div
                initial={{ opacity: 0, x: 10, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0c0c22]/95 border border-[rgba(162,130,255,0.15)] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] text-sm text-[var(--text-secondary)] whitespace-nowrap"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse shrink-0" />
                Fale conosco no WhatsApp
                <button
                  onClick={() => setShowTooltip(false)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] ml-1"
                  aria-label="Fechar"
                >
                  <X size={12} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Button */}
          <div className="relative">
            {/* Pulse rings */}
            <div className="absolute inset-0 rounded-full bg-[#25D366]/30 animate-ping" style={{ animationDuration: '2.5s' }} />
            <div className="absolute inset-0 rounded-full bg-[#25D366]/15 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.8s' }} />

            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir WhatsApp"
              onClick={() => {
                /* Analytics: dispare evento "whatsapp_click" aqui */
                setShowTooltip(false)
              }}
              className="relative flex items-center justify-center w-14 h-14 rounded-full shadow-[0_8px_30px_rgba(37,211,102,0.4)] hover:shadow-[0_8px_40px_rgba(37,211,102,0.6)] hover:scale-105 active:scale-95 transition-all duration-200"
              style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}
            >
              {/* WhatsApp SVG icon */}
              <svg viewBox="0 0 24 24" width="26" height="26" fill="white" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12.05 2C6.495 2 2.005 6.491 2.005 12.048c0 1.937.534 3.741 1.457 5.278L2 22l4.796-1.438A10.036 10.036 0 0012.05 22c5.553 0 10.042-4.491 10.042-10.048S17.603 2 12.05 2zm0 18.368a8.367 8.367 0 01-4.266-1.166l-.306-.182-3.157.828.843-3.075-.2-.315A8.354 8.354 0 013.674 12.05C3.674 7.406 7.409 3.67 12.05 3.67c4.643 0 8.378 3.736 8.378 8.379 0 4.644-3.735 8.319-8.378 8.319z"/>
              </svg>
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
