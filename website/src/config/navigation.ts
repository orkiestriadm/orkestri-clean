import type { NavItem } from "@/types";

/**
 * Primary navigation.
 * Source: orkiestri-design-system/04-information-architecture.md
 */
export const mainNav: NavItem[] = [
  { label: "Empresa", href: "/company" },
  { label: "Produtos", href: "/products" },
  { label: "Serviços", href: "/services" },
  { label: "Tecnologia", href: "/technology" },
  { label: "Cases", href: "/cases" },
  { label: "Blog", href: "/blog" },
  { label: "Contato", href: "/contact" },
];

export const footerNav: { title: string; items: NavItem[] }[] = [
  {
    title: "Produtos",
    items: [
      { label: "Orkiestri One", href: "/products/orkiestri-one" },
      { label: "One Desk", href: "/products/one-desk" },
      { label: "One Projects", href: "/products/one-projects" },
      { label: "One Fleet", href: "/products/one-fleet" },
      { label: "Ver todos", href: "/products" },
    ],
  },
  {
    title: "Serviços",
    items: [
      { label: "Software Factory", href: "/services/software-factory" },
      { label: "AI Solutions", href: "/services/ai-solutions" },
      { label: "Cloud Solutions", href: "/services/cloud-solutions" },
      { label: "Consultoria", href: "/services/consulting" },
    ],
  },
  {
    title: "Empresa",
    items: [
      { label: "Quem Somos", href: "/company" },
      { label: "Tecnologia", href: "/technology" },
      { label: "Cases", href: "/cases" },
      { label: "Carreiras", href: "/company/careers" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    title: "Contato",
    items: [
      { label: "Falar com especialista", href: "/contact" },
      { label: "Solicitar demonstração", href: "/demo" },
      { label: "Política de Privacidade", href: "/privacy" },
      { label: "Termos de Uso", href: "/terms" },
    ],
  },
];
