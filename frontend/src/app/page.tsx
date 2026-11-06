import type { Metadata } from 'next'
import LandingClient from './LandingClient'

/**
 * Isto é o que o Google mostra, e estava errado em dois sentidos.
 *
 * Vendia CRM, fornecedores e CAPEX/OPEX — produtos que saíram do sistema na
 * redução de escopo de 19/10/2026. Quem chegasse pela busca procuraria telas
 * que não existem mais.
 *
 * E falava como ERP (“plataforma corporativa”, “enterprise”, “gestão
 * operacional”), quando o produto organiza o dia de UMA PESSOA e avisa no
 * WhatsApp. O texto agora lista os módulos que estão no ar, na ordem do menu.
 */
export const metadata: Metadata = {
  title: 'Orkiestri — organize o seu dia e receba o aviso no WhatsApp',
  description:
    'Agenda, chamados, projetos, orçamento e os seus gastos no mesmo lugar — e um aviso no WhatsApp quando a hora chega.',
  keywords:
    'agenda no whatsapp, lembrete de compromisso, controle de gastos, chamados, gestão de projetos, orçamento',
  openGraph: {
    title: 'Orkiestri — organize o seu dia e receba o aviso no WhatsApp',
    description:
      'Agenda, chamados, projetos, orçamento e os seus gastos no mesmo lugar — e um aviso no WhatsApp quando a hora chega.',
    url: 'https://www.orkiestri.com',
    siteName: 'Orkiestri',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Orkiestri — organize o seu dia e receba o aviso no WhatsApp',
    description:
      'Agenda, chamados, projetos, orçamento e os seus gastos no mesmo lugar — e um aviso no WhatsApp quando a hora chega.',
  },
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://www.orkiestri.com' },
}

export default function LandingPage() {
  return <LandingClient />
}
