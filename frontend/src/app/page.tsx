import type { Metadata } from 'next'
import Header from '@/components/landing/Header'
import HeroSection from '@/components/landing/HeroSection'
import DemoSection from '@/components/landing/DemoSection'
import VideoSection from '@/components/landing/VideoSection'
import BenefitsSection from '@/components/landing/BenefitsSection'
import ModulesSection from '@/components/landing/ModulesSection'
import DifferentialsSection from '@/components/landing/DifferentialsSection'
import TestimonialsSection from '@/components/landing/TestimonialsSection'
import LeadForm from '@/components/landing/LeadForm'
import CtaSection from '@/components/landing/CtaSection'
import Footer from '@/components/landing/Footer'
import WhatsAppButton from '@/components/landing/WhatsAppButton'

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
  return (
    <>
      {/*
        ═══════════════════════════════════════════════════════════════
        ANALYTICS — configure os IDs e descomente quando pronto

        1. Google Analytics 4
           NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX no .env
           Instale @next/third-parties e adicione <GoogleAnalytics> aqui

        2. Google Tag Manager
           Adicione script GTM-XXXXXXX no <head> de app/layout.tsx

        3. Meta Pixel
           Adicione pixel base code no <head> de app/layout.tsx

        4. Eventos de conversão (já preparados nos componentes):
           - Formulário enviado  → "lead_generated"
           - Clique em "Entrar"  → "login_intent"
           - Clique em "Demo"    → "demo_request"
        ═══════════════════════════════════════════════════════════════
      */}

      <Header />

      <main>
        <HeroSection />
        <DemoSection />
        <VideoSection />
        <BenefitsSection />
        <ModulesSection />
        <DifferentialsSection />
        <TestimonialsSection />
        <LeadForm />
        <CtaSection />
      </main>

      <Footer />
      <WhatsAppButton />
    </>
  )
}
