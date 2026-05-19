'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'

function scrollTo(href: string) {
  if (!href.startsWith('#')) return
  const el = document.querySelector(href)
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - 80
  window.scrollTo({ top, behavior: 'smooth' })
}

const LINKS = {
  Plataforma: [
    { label: 'Visão geral', href: '#plataforma' },
    { label: 'Módulos', href: '#modulos' },
    { label: 'Benefícios', href: '#beneficios' },
    { label: 'Diferenciais', href: '#beneficios' },
  ],
  Empresa: [
    { label: 'Sobre nós', href: '#' },
    { label: 'Carreiras', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Parceiros', href: '#' },
  ],
  Suporte: [
    { label: 'Documentação', href: '#' },
    { label: 'Status do sistema', href: '#' },
    { label: 'Contato', href: '#contato' },
    { label: 'Entrar', href: '/login' },
  ],
  Legal: [
    { label: 'Política de privacidade', href: '#' },
    { label: 'Termos de uso', href: '#' },
    { label: 'Cookies', href: '#' },
    { label: 'LGPD', href: '#' },
  ],
}

function SocialIcon({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="w-9 h-9 rounded-xl border border-[rgba(162,130,255,0.12)] bg-[rgba(255,255,255,0.02)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent-violet)] hover:border-[rgba(167,139,250,0.3)] hover:bg-[rgba(167,139,250,0.06)] transition-all"
    >
      {children}
    </a>
  )
}

export default function Footer() {
  return (
    <footer className="relative border-t border-[rgba(162,130,255,0.1)] bg-[#06060f]">
      {/* Top glow */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(167,139,250,0.25)] to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Main footer */}
        <div className="py-16 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-12">

          {/* Brand */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link href="/" className="inline-block mb-4">
              <img src="/logo-orkiestri-dark.png" alt="Logo Orkiestri" className="h-7 w-auto object-contain" />
            </Link>
            <p className="text-[var(--text-muted)] text-sm leading-relaxed max-w-[200px] mb-6">
              Plataforma corporativa de gestão operacional enterprise.
            </p>

            {/* Social */}
            <div className="flex items-center gap-2">
              <SocialIcon href="#">
                {/* LinkedIn */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </SocialIcon>
              <SocialIcon href="#">
                {/* Instagram */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                </svg>
              </SocialIcon>
              <SocialIcon href="#">
                {/* X / Twitter */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </SocialIcon>
            </div>
          </div>

          {/* Links */}
          {Object.entries(LINKS).map(([group, links]) => (
            <div key={group}>
              <h3 className="font-display font-semibold text-xs text-[var(--text-muted)] uppercase tracking-wider mb-4">
                {group}
              </h3>
              <ul className="flex flex-col gap-2.5">
                {links.map(link => (
                  <li key={link.label}>
                    {link.href.startsWith('#') ? (
                      <button
                        onClick={() => scrollTo(link.href)}
                        className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-left"
                      >
                        {link.label}
                      </button>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="py-6 border-t border-[rgba(162,130,255,0.07)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[var(--text-muted)] text-xs">
            © {new Date().getFullYear()} Orkiestri. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">Privacidade</a>
            <a href="#" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">Termos</a>
            <a href="#" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
