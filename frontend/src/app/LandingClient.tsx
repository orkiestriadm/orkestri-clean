"use client";
import { useEffect } from 'react';
import Header from '@/components/landing/Header'
import HeroSection from '@/components/landing/HeroSection'
import DemoSection from '@/components/landing/DemoSection'
import SecuritySection from '@/components/landing/SecuritySection'
import StepsSection from '@/components/landing/StepsSection'
import ModulesSection from '@/components/landing/ModulesSection'
import DifferentialsSection from '@/components/landing/DifferentialsSection'
import VideoSection from '@/components/landing/VideoSection'
import UnderstandSection from '@/components/landing/UnderstandSection'
import PricingSection from '@/components/landing/PricingSection'
import FaqSection from '@/components/landing/FaqSection'
import LeadForm from '@/components/landing/LeadForm'
import CtaSection from '@/components/landing/CtaSection'
import Footer from '@/components/landing/Footer'
import WhatsAppButton from '@/components/landing/WhatsAppButton'

export default function LandingClient() {
  useEffect(() => {
    // Força dark mode na landing page (site público)
    document.documentElement.setAttribute('data-theme', 'dark');
    return () => {
      // Restaura o tema salvo do usuário ao navegar para o sistema
      try {
        const saved = localStorage.getItem('orkestri-theme-v2');
        document.documentElement.setAttribute(
          'data-theme',
          saved === 'dark' || saved === 'light' ? saved : 'light'
        );
      } catch {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    };
  }, []);

  return (
    <>
      <Header />
      <main>
        {/* 1. Hero — impacto imediato */}
        <HeroSection />

        {/* 2. Demo interativa — mostra o produto */}
        <DemoSection />

        {/* 3. Segurança & Governança */}
        <SecuritySection />

        {/* 4. Como funciona — 3 etapas */}
        <StepsSection />

        {/* 5. Módulos — functionalities principais */}
        <ModulesSection />

        {/* 6. Diferenciais — Orkiestri vs legado */}
        <DifferentialsSection />

        {/* 7. Vídeo institucional */}
        <VideoSection />

        {/* 8. Entenda o Orkiestri */}
        <UnderstandSection />

        {/* 9. Preços */}
        <PricingSection />

        {/* 10. FAQ */}
        <FaqSection />

        {/* 11. Formulário de contato / lead */}
        <LeadForm />

        {/* 12. CTA final */}
        <CtaSection />
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
