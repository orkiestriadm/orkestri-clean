import type { Metadata } from 'next'
import LandingClient from './LandingClient'

export const metadata: Metadata = {
  title: 'Orkiestri — Plataforma Corporativa de Gestão Operacional',
  description:
    'Centralize CRM, projetos, fornecedores, financeiro e operações em uma plataforma enterprise moderna. Profundidade corporativa com experiência moderna.',
  keywords:
    'sistema corporativo, ERP moderno, CRM, gestão de projetos, fornecedores, CAPEX OPEX, SaaS enterprise, gestão operacional',
  openGraph: {
    title: 'Orkiestri — Plataforma Corporativa de Gestão Operacional',
    description:
      'Centralize CRM, projetos, fornecedores, financeiro e operações em uma plataforma enterprise moderna.',
    url: 'https://www.orkiestri.com',
    siteName: 'Orkiestri',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Orkiestri — Plataforma Corporativa de Gestão Operacional',
    description:
      'Centralize CRM, projetos, fornecedores, financeiro e operações em uma plataforma enterprise moderna.',
  },
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://www.orkiestri.com' },
}

export default function LandingPage() {
  return <LandingClient />
}
