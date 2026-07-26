import {
  Code2,
  BrainCircuit,
  Cloud,
  Compass,
  Users,
  Plug,
} from "lucide-react";
import type { Service } from "@/types";

/**
 * Orkiestri Services — Software Factory & Professional Services.
 * Source: orkiestri-design-system/05-website-copywriting.md + 03-business-model.md
 */
export const services: Service[] = [
  {
    slug: "software-factory",
    name: "Software Factory",
    tagline: "Software desenvolvido para o seu negócio.",
    description:
      "Projetos personalizados para empresas que precisam de soluções exclusivas, integradas ao seu ambiente tecnológico.",
    icon: Code2,
    highlights: [
      "Aplicações Web & Mobile",
      "Portais e Dashboards",
      "Modernização de sistemas legados",
      "Discovery → UX → Arquitetura → Deploy → Suporte",
    ],
  },
  {
    slug: "ai-solutions",
    name: "Artificial Intelligence",
    tagline: "Inteligência Artificial aplicada ao seu negócio.",
    description:
      "Automação inteligente, agentes de IA, OCR, análise de documentos e assistentes corporativos que apoiam decisões.",
    icon: BrainCircuit,
    highlights: [
      "Agentes & Copilotos",
      "OCR & Análise de documentos",
      "Busca semântica (RAG)",
      "Automação inteligente",
    ],
  },
  {
    slug: "cloud-solutions",
    name: "Cloud Solutions",
    tagline: "Infraestrutura pronta para escalar.",
    description:
      "Migração, infraestrutura, observabilidade, DevOps e alta disponibilidade sobre AWS, Azure e Google Cloud.",
    icon: Cloud,
    highlights: [
      "Migração para Cloud",
      "Infraestrutura & DevOps",
      "Observabilidade",
      "Alta disponibilidade",
    ],
  },
  {
    slug: "consulting",
    name: "Consulting",
    tagline: "Da estratégia à execução.",
    description:
      "Arquitetura, transformação digital, governança e modernização tecnológica conduzidas por um time especializado.",
    icon: Compass,
    highlights: [
      "Arquitetura de sistemas",
      "Transformação digital",
      "Governança",
      "Modernização tecnológica",
    ],
  },
  {
    slug: "outsourcing",
    name: "Outsourcing",
    tagline: "Especialistas para acelerar suas entregas.",
    description:
      "Profissionais preparados para integrar sua equipe, sustentar sistemas e acelerar a evolução dos seus produtos.",
    icon: Users,
    highlights: [
      "Alocação de especialistas",
      "Sustentação",
      "Suporte especializado",
      "Squads dedicados",
    ],
  },
  {
    slug: "integrations",
    name: "Integrations",
    tagline: "Conecte tudo. Elimine retrabalho.",
    description:
      "Conectamos sistemas, APIs e plataformas para centralizar informações e eliminar processos manuais.",
    icon: Plug,
    highlights: [
      "APIs & Webhooks",
      "Microsoft 365 & Google Workspace",
      "SAP, TOTVS, Oracle",
      "Mensageria & Filas",
    ],
  },
];

export function getService(slug: string): Service | undefined {
  return services.find((s) => s.slug === slug);
}
