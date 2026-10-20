import type { Metadata } from 'next'
import LandingClient from './LandingClient'

export const metadata: Metadata = {
  title: 'Orkiestri — Projetos, Agenda e Financeiro em uma plataforma',
  description:
    'Centralize projetos, agenda e financeiro em uma plataforma enterprise moderna. Kanban, linha do tempo, contas a pagar e orçamento CAPEX/OPEX, com WhatsApp e Outlook integrados.',
  keywords:
    'gestão de projetos, kanban, agenda corporativa, contas a pagar, orçamento CAPEX OPEX, SaaS enterprise, integração WhatsApp, Outlook Microsoft 365',
  openGraph: {
    title: 'Orkiestri — Projetos, Agenda e Financeiro em uma plataforma',
    description:
      'Centralize projetos, agenda e financeiro em uma plataforma enterprise moderna.',
    url: 'https://www.orkiestri.com',
    siteName: 'Orkiestri',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Orkiestri — Projetos, Agenda e Financeiro em uma plataforma',
    description:
      'Centralize projetos, agenda e financeiro em uma plataforma enterprise moderna.',
  },
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://www.orkiestri.com' },
}

export default function LandingPage() {
  return <LandingClient />
}
