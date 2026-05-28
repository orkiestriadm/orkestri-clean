'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { Menu, X, ArrowRight, Moon, Sun } from 'lucide-react'
import { BrandLogo } from '@/components/ui/logo'
import { useTheme } from '@/lib/theme'

const NAV_LINKS = [
  { label: 'Plataforma', href: '#plataforma' },
  { label: 'Módulos', href: '#modulos' },
  { label: 'Análise Econômica', href: '#beneficios' },
  { label: 'Preços', href: '#planos' },
  { label: 'Contato', href: '#contato' },
]

function scrollTo(href: string) {
  const el = document.querySelector(href)
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - 80
  window.scrollTo({ top, behavior: 'smooth' })
}

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { theme, toggle } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-[var(--bg-primary)]/80 backdrop-blur-2xl border-b border-[var(--border-subtle)] shadow-sm'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">

            {/* Logo */}
            <Link href="/" className="flex items-center shrink-0">
              <BrandLogo size="md" />
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-0.5">
              {NAV_LINKS.map(link => (
                <button
                  key={link.href}
                  onClick={() => scrollTo(link.href)}
                  className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-200 rounded-lg hover:bg-[var(--bg-hover)] cursor-pointer"
                >
                  {link.label}
                </button>
              ))}
            </nav>

            {/* CTA + hamburger */}
            <div className="flex items-center gap-3">
              {mounted && (
                <button
                  onClick={toggle}
                  className="hidden sm:flex items-center justify-center p-2.5 rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                  aria-label="Alternar tema"
                >
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              )}

              <Link
                href="/login"
                onClick={() => {
                  /* Analytics: dispare evento "login_intent" aqui */
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white text-sm font-semibold hover:from-violet-500 hover:to-violet-400 transition-all shadow-[0_0_20px_rgba(124,58,237,0.35)] hover:shadow-[0_0_32px_rgba(124,58,237,0.55)] hover:-translate-y-px active:translate-y-0 active:shadow-none"
              >
                Login <ArrowRight size={14} />
              </Link>

              <button
                onClick={() => setOpen(v => !v)}
                className="md:hidden p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                aria-label="Menu"
              >
                {open ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            />
            <motion.nav
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="fixed top-0 right-0 bottom-0 z-50 w-72 bg-[var(--bg-primary)] border-l border-[var(--border-subtle)] flex flex-col md:hidden"
            >
              <div className="flex items-center justify-between px-5 h-16 border-b border-[var(--border-subtle)]">
                <span className="font-display font-bold text-[var(--text-primary)]">Menu</span>
                <button onClick={() => setOpen(false)} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-col gap-1 p-4 flex-1">
                {NAV_LINKS.map(link => (
                  <button
                    key={link.href}
                    onClick={() => { scrollTo(link.href); setOpen(false) }}
                    className="flex items-center px-4 py-3.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-xl transition-colors text-left"
                  >
                    {link.label}
                  </button>
                ))}
              </div>

              <div className="p-4 border-t border-[var(--border-subtle)] flex flex-col gap-3">
                {mounted && (
                  <button
                    onClick={toggle}
                    className="flex items-center justify-between w-full px-4 py-3 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-xl transition-colors text-left"
                  >
                    <span>Modo {theme === 'dark' ? 'Claro' : 'Escuro'}</span>
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                  </button>
                )}

                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white font-semibold text-sm shadow-[0_0_20px_rgba(124,58,237,0.35)]"
                >
                  Login no sistema <ArrowRight size={15} />
                </Link>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
