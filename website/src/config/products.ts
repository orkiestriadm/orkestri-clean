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
  CalendarDays,
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
    screenshot: {
      src: "/screenshots/orkiestridesk.png",
      alt: "Orkiestri Desk — fila de chamados por status, com indicadores de SLA e atendimento em andamento",
      width: 2200,
      height: 1086,
    },
    name: "Orkiestri Desk",
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
    screenshot: {
      src: "/screenshots/projetos.png",
      alt: "Orkiestri Projects — quadro kanban de um projeto com progresso, tarefas e responsáveis",
      width: 2200,
      height: 1332,
    },
    name: "Orkiestri Projects",
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
    slug: "one-space",
    screenshot: {
      src: "/screenshots/orkiestrispace.png",
      alt: "Orkiestri Space — agenda corporativa do mês com eventos, próximos compromissos e disponibilidade do time",
      width: 1683,
      height: 711,
    },
    name: "Orkiestri Space",
    category: "Agenda & Colaboração",
    tagline: "Organize a agenda e os compromissos do time.",
    description:
      "Agenda corporativa conectada à operação: eventos, reuniões, treinamentos e disponibilidade das equipes no mesmo ambiente dos projetos e chamados.",
    icon: CalendarDays,
    features: [
      "Agenda compartilhada",
      "Visões de mês, semana e dia",
      "Disponibilidade do time",
      "Convites e participantes",
      "Lembretes e notificações",
      "Compromissos vinculados a projetos",
    ],
    ai: [
      "Sugestão de melhor horário",
      "Resumo de reuniões",
      "Detecção de conflitos de agenda",
    ],
    integrations: ["Google Agenda", "Microsoft 365", "Google Meet", "Teams"],
  },
  {
    slug: "one-fleet",
    screenshot: {
      src: "/screenshots/frota.png",
      alt: "Orkiestri Fleet — frota com placa, modelo, categoria, responsável, hodômetro e status de cada veículo",
      width: 920,
      height: 608,
    },
    name: "Orkiestri Fleet",
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
    screenshot: {
      src: "/screenshots/ativos.png",
      alt: "Orkiestri Assets — inventário de equipamentos por categoria, com responsável e status",
      width: 1742,
      height: 599,
    },
    name: "Orkiestri Assets",
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
    screenshot: {
      src: "/screenshots/contratos.png",
      alt: "Orkiestri Finance — contratos com vigência, status e valores consolidados",
      width: 1692,
      height: 991,
    },
    name: "Orkiestri Finance",
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
    screenshot: {
      src: "/screenshots/orcamento-dashboard.png",
      alt: "Orkiestri Budget — dashboard orçamentário com CAPEX, OPEX, evolução mensal e distribuição por centro de custo",
      width: 2200,
      height: 1265,
    },
    name: "Orkiestri Budget",
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
    screenshot: {
      src: "/screenshots/clientes.png",
      alt: "Orkiestri CRM — carteira de clientes com health score, MRR e responsável por conta",
      width: 1687,
      height: 876,
    },
    name: "Orkiestri CRM",
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
    name: "Orkiestri Flow",
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
    comingSoon: true,
    name: "Orkiestri Supply",
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
    screenshot: {
      src: "/screenshots/monitoramento.png",
      alt: "Orkiestri Observe — monitoramento operacional em tempo real com disponibilidade e estado de cada ativo",
      width: 1058,
      height: 623,
    },
    name: "Orkiestri Observe",
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
    name: "Orkiestri Core",
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
