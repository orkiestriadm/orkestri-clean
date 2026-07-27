import type { LucideIcon } from "lucide-react";

export interface Screenshot {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface Product {
  slug: string;
  name: string;
  category: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  features: string[];
  ai: string[];
  integrations?: string[];
  audience?: string[];
  /** Captura real da aplicação. Ausente enquanto não houver imagem do módulo. */
  screenshot?: Screenshot;
}

export interface Service {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  highlights: string[];
}

export interface NavItem {
  label: string;
  href: string;
  description?: string;
}

export interface Stat {
  value: string;
  label: string;
  suffix?: string;
}

export interface ProcessStep {
  title: string;
  description: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}
