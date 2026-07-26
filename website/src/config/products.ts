import {
  Headset,
  KanbanSquare,
  Truck,
  Boxes,
  Wallet,
  PiggyBank,
  HeartHandshake,
  Workflow,
  ShoppingCart,
  Activity,
  ShieldCheck,
} from "lucide-react";
import type { Product } from "@/types";

/**
 * Orkiestri One — Business Applications.
 * Source: orkiestri-design-system/12-products.md + 05-website-copywriting.md
 * Order follows the brand architecture (doc 01).
 */
export const products: Product[] = [
  {
    slug: "one-desk",
    name: "One Desk",
    category: "Service Management",
    tagline: "Centralize chamados, solicitações e atendimento.",
    description:
      "Reúna solicitações, incidentes, mudanças e catálogo de serviços em um único portal, com SLA, workflow e base de conhecimento.",
    icon: Headset,
    features: [
      "Portal de Serviços",
      "Service Desk & Help Desk",
      "Catálogo de Serviços",
      "SLA & Workflow",
      "Base de Conhecimento",
      "Portal do Cliente",
    ],
    ai: [
      "Resumo automático",
      "Classificação inteligente",
      "Sugestão de solução",
      "Análise de sentimento",
    ],
    integrations: ["Microsoft Teams", "Email", "WhatsApp", "Azure AD", "LDAP"],
    audience: ["TI", "RH", "Facilities", "Financeiro", "Jurídico"],
  },
  {
    slug: "one-projects",
    name: "One Projects",
    category: "Project Management",
    tagline: "Planeje, acompanhe e entregue projetos com eficiência.",
    description:
      "Do backlog à entrega: kanban, gantt, sprints, custos e dependências em uma experiência única para times de qualquer tamanho.",
    icon: KanbanSquare,
    features: [
      "Kanban & Gantt",
      "Cronograma & Roadmap",
      "Backlog & Sprints",
      "Controle de Tempo e Custos",
      "Documentos",
      "Dependências",
    ],
    ai: [
      "Estimativa de prazo",
      "Resumo de reuniões",
      "Geração automática de tarefas",
      "Análise de riscos",
    ],
    integrations: ["GitHub", "Azure DevOps", "Jira", "Microsoft Project"],
  },
  {
    slug: "one-fleet",
    name: "One Fleet",
    category: "Fleet Management",
    tagline: "Gerencie veículos, reservas, abastecimentos e manutenção.",
    description:
      "Controle completo da operação de veículos — de reservas e motoristas a manutenção, documentação e telemetria.",
    icon: Truck,
    features: [
      "Cadastro & Reservas",
      "Motoristas & Checklist",
      "Abastecimento & Multas",
      "Manutenção & Pneus",
      "Documentação",
      "Telemetria & Sinistros",
    ],
    ai: [
      "Previsão de manutenção",
      "Detecção de custos elevados",
      "Sugestão de otimização",
    ],
    integrations: ["GPS", "Telemetria", "ERP"],
  },
  {
    slug: "one-assets",
    name: "One Assets",
    category: "Asset Management",
    tagline: "Controle ativos, patrimônio e inventário.",
    description:
      "Gestão de ativos físicos e tecnológicos com inventário, QR Code, RFID, garantias e licenças em tempo real.",
    icon: Boxes,
    features: [
      "Inventário & Patrimônio",
      "QR Code & RFID",
      "Movimentações",
      "Auditoria",
      "Garantias & Licenças",
      "Equipamentos",
    ],
    ai: ["Detecção de ativos críticos", "Previsão de substituição"],
  },
  {
    slug: "one-finance",
    name: "One Finance",
    category: "Financial Management",
    tagline: "Organize receitas, despesas e indicadores financeiros.",
    description:
      "Centralize contas, fluxo de caixa, centros de custo e indicadores em dashboards claros para decisões mais rápidas.",
    icon: Wallet,
    features: [
      "Contas & Fluxo de Caixa",
      "Receitas & Despesas",
      "Centros de Custo",
      "Dashboards & Indicadores",
      "Pagamentos",
      "Recebimentos",
    ],
    ai: [
      "Previsão financeira",
      "Análise de tendências",
      "Detecção de anomalias",
    ],
  },
  {
    slug: "one-budget",
    name: "One Budget",
    category: "Budget Planning",
    tagline: "Planeje e acompanhe o orçamento da empresa.",
    description:
      "Planejamento orçamentário corporativo com CAPEX, OPEX, forecast, aprovações e comparativos em um só lugar.",
    icon: PiggyBank,
    features: [
      "CAPEX & OPEX",
      "Forecast",
      "Revisões",
      "Aprovações",
      "Comparativos",
      "Indicadores",
    ],
    ai: ["Projeções", "Simulações", "Sugestão de otimizações"],
  },
  {
    slug: "one-crm",
    name: "One CRM",
    category: "Customer Relationship",
    tagline: "Fortaleça o relacionamento com seus clientes.",
    description:
      "Do lead à renovação: pipeline, oportunidades, propostas e follow-up para times comerciais orientados a resultado.",
    icon: HeartHandshake,
    features: [
      "Leads & Pipeline",
      "Oportunidades",
      "Empresas & Contatos",
      "Funil & Agenda",
      "Propostas",
      "Histórico & Follow-up",
    ],
    ai: ["Score de leads", "Próxima ação", "Resumo de reuniões"],
  },
  {
    slug: "one-flow",
    name: "One Flow",
    category: "Workflow Automation",
    tagline: "Automatize processos internos sem complexidade.",
    description:
      "Um designer visual para criar fluxos, aprovações e integrações — automatize o repetitivo sem escrever código.",
    icon: Workflow,
    features: [
      "Designer Visual",
      "Fluxos & Aprovações",
      "Eventos",
      "Integrações",
      "Notificações",
      "Formulários",
    ],
    ai: ["Construção automática de workflows", "Sugestão de automações"],
  },
  {
    slug: "one-supply",
    name: "One Supply",
    category: "Procurement",
    tagline: "Gerencie compras, fornecedores e suprimentos.",
    description:
      "Do pedido ao recebimento: solicitações, cotações, contratos e fornecedores com indicadores de performance.",
    icon: ShoppingCart,
    features: [
      "Solicitações & Cotações",
      "Pedidos",
      "Fornecedores",
      "Contratos",
      "Recebimento",
      "Indicadores",
    ],
    ai: ["Sugestão de fornecedores", "Comparação inteligente"],
  },
  {
    slug: "one-observe",
    name: "One Observe",
    category: "Observability",
    tagline: "Monitore indicadores operacionais em tempo real.",
    description:
      "Observe ambientes, serviços e aplicações com dashboards de disponibilidade, logs, alertas e métricas.",
    icon: Activity,
    features: [
      "Dashboards",
      "Disponibilidade",
      "Logs & Alertas",
      "Infraestrutura",
      "Aplicações & Serviços",
      "Métricas",
    ],
    ai: [
      "Detecção de incidentes",
      "Análise de causa raiz",
      "Análise preditiva",
    ],
  },
  {
    slug: "one-core",
    name: "One Core",
    category: "Platform Administration",
    tagline: "Administre usuários, permissões e integrações.",
    description:
      "O núcleo da plataforma: identidade, autenticação, SSO, permissões granulares, logs e API para toda a operação.",
    icon: ShieldCheck,
    features: [
      "Usuários & Permissões",
      "Empresas & Filiais",
      "Autenticação & SSO",
      "Logs",
      "Configurações",
      "Integrações & API",
    ],
    ai: ["Auditoria inteligente", "Detecção de acessos anômalos"],
  },
];

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}
