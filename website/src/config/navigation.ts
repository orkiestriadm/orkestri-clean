import type { NavItem } from "@/types";
import { WHATSAPP_CADASTRO } from "./site";

/**
 * Primary navigation.
 * Source: orkiestri-design-system/04-information-architecture.md
 */
export const mainNav: NavItem[] = [
  { label: "Empresa", href: "/company" },
  { label: "Produtos", href: "/products" },
  { label: "Soluções", href: "/services" },
  { label: "Tecnologia", href: "/technology" },
  { label: "Como funciona", href: "/demo" },
  { label: "Contato", href: "/contact" },
];

export const footerNav: { title: string; items: NavItem[] }[] = [
  {
    title: "Produtos",
    items: [
      { label: "Orkiestri One", href: "/products/orkiestri-one" },
      { label: "Agenda e anotações", href: "/products/one-space" },
      { label: "Pedidos e chamados", href: "/products/one-desk" },
      { label: "Projetos e tarefas", href: "/products/one-projects" },
      /* Era "Orkiestri Fleet", removido do sistema em 19/10/2026. */
      { label: "Contas e gastos", href: "/products/one-finance" },
      { label: "Ver todos", href: "/products" },
    ],
  },
  {
    title: "Soluções",
    items: [
      { label: "Software sob medida", href: "/services/software-factory" },
      { label: "Inteligência artificial", href: "/services/ai-solutions" },
      { label: "Soluções em nuvem", href: "/services/cloud-solutions" },
      { label: "Consultoria", href: "/services/consulting" },
    ],
  },
  {
    title: "Empresa",
    items: [
      { label: "Quem Somos", href: "/company" },
      { label: "Tecnologia", href: "/technology" },
      { label: "Carreiras", href: "/company/careers" },
    ],
  },
  {
    title: "Contato",
    items: [
      { label: "Falar com especialista", href: "/contact" },
      /* "Solicitar demonstração" saiu daqui em 26/10/2026: o cadastro passou
         a ser só pelo WhatsApp, e o rodapé era o último lugar do site que
         ainda oferecia o caminho antigo. */
      { label: "Cadastre-se é gratuito!", href: WHATSAPP_CADASTRO },
      { label: "Como funciona", href: "/demo" },
      { label: "Guias de uso", href: "/blog" },
      { label: "Possibilidades de uso", href: "/cases" },
      { label: "Política de Privacidade", href: "/privacy" },
      { label: "Termos de Uso", href: "/terms" },
    ],
  },
];
