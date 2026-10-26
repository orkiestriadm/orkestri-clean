import {
  Headset,
  BookOpen,
  FolderKanban,
  CalendarDays,
  Wallet,
  Settings,
} from "lucide-react";
import type { Product } from "@/types";

/**
 * Aplicações do Orkiestri One.
 *
 * 🔴 ESTA LISTA É ESPELHO DO SISTEMA, NÃO DE MATERIAL DE MARKETING.
 *
 * A fonte da verdade é `frontend/src/lib/modules.tsx` → `NAV`: cada produto
 * aqui é um grupo de lá, e cada item de `features` é uma tela que existe.
 * Antes de acrescentar qualquer coisa a este arquivo, abra o `NAV` e
 * confirme que a tela existe.
 *
 * Por que a regra é dura: até 26/10/2026 o site anunciava DOZE aplicações —
 * Desk, Projects, Space, Fleet, Assets, Finance, Budget, CRM, Flow, Supply,
 * Observe e Core. A redução de escopo de 19/10/2026 tinha removido da
 * produção Fleet, Assets, Relations (CRM), Supply, Strategy, People,
 * Compliance e Approvals, medindo tabela por tabela o que não tinha uso. O
 * site continuou vendendo cinco módulos que não existiam mais, e ainda
 * mostrava capturas de tela deles. Ao mesmo tempo não vendia o Conhecimento,
 * que tem 61 artigos em produção.
 *
 * Budget e Flow não sumiram: viraram TELAS. "Orçamento" é item do Finance
 * desde 19/10/2026 e "Automações" é item do Service. Promover tela a produto
 * foi o que inflou a lista para doze.
 *
 * As URLs dos produtos removidos redirecionam para /products
 * (ver `next.config.ts`) em vez de dar 404.
 */
export const products: Product[] = [
  {
    slug: "one-desk",
    screenshot: {
      src: "/screenshots/orkiestridesk.png",
      alt: "Orkiestri Service — fila de chamados por status, com indicadores de SLA e atendimento em andamento",
      width: 2200,
      height: 1086,
    },
    name: "Orkiestri Service",
    category: "Chamados e atendimento",
    tagline: "Centralize chamados, catálogo de serviços e horas.",
    description:
      "O módulo com mais uso da plataforma. Reúne o catálogo de serviços, a fila de chamados com SLA, o apontamento de horas, a pesquisa de satisfação e as automações que tiram o trabalho repetitivo do caminho.",
    icon: Headset,
    /* Telas reais do grupo `service` do NAV. */
    features: [
      "Catálogo de Serviços",
      "Chamados com SLA",
      "Apontamento de Horas",
      "CSAT (satisfação)",
      "Automações",
      "Relatórios",
    ],
    ai: [
      "Abertura de chamado por WhatsApp",
      "Resumo automático",
      "Classificação inteligente",
    ],
    integrations: ["WhatsApp", "E-mail", "Microsoft 365"],
    audience: ["TI", "Facilities", "Administrativo"],
  },
  {
    slug: "one-quality",
    screenshot: {
      src: "/screenshots/conhecimento.png",
      alt: "Orkiestri Quality — base de conhecimento com artigos publicados organizados por categoria",
      width: 1690,
      height: 1030,
    },
    name: "Orkiestri Quality",
    category: "Procedimentos e conhecimento",
    tagline: "A resposta certa onde todo mundo acha.",
    description:
      "Base de conhecimento com artigos, categorias e busca. Procedimento documentado uma vez para de ser perguntado toda semana — e quem atende chamado responde com o mesmo texto que o time publicou.",
    icon: BookOpen,
    features: [
      "Artigos e categorias",
      "Busca no conteúdo publicado",
      "Consulta pelo WhatsApp",
    ],
    ai: ["Busca semântica", "Sugestão de artigo no chamado"],
    integrations: ["WhatsApp"],
    audience: ["TI", "Qualidade", "Operações"],
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
    category: "Projetos e entregas",
    tagline: "Do quadro de tarefas à linha do tempo.",
    description:
      "Projetos em quadro kanban, com tarefas, responsáveis e progresso. A linha do tempo mostra como as entregas se encaixam, e os projetos concluídos ficam com histórico em vez de sumirem da lista.",
    icon: FolderKanban,
    features: [
      "Quadro de projetos",
      "Tarefas e responsáveis",
      "Linha do Tempo (Gantt)",
      "Projetos concluídos",
    ],
    ai: ["Criação de projeto e consulta de tarefas por WhatsApp"],
    integrations: ["WhatsApp"],
    audience: ["PMO", "Operações", "TI"],
  },
  {
    slug: "one-space",
    screenshot: {
      src: "/screenshots/orkiestrispace.png",
      alt: "Orkiestri Space — agenda da semana com compromissos e participantes",
      width: 1690,
      height: 1030,
    },
    name: "Orkiestri Space",
    category: "Agenda e anotações",
    tagline: "A agenda do time e o bloco de notas de cada um.",
    description:
      "Agenda com compromissos, recorrência e participantes, integrada ao Outlook e ao Microsoft 365. O Keep guarda a anotação que não é tarefa de ninguém — e as duas coisas respondem a uma mensagem no WhatsApp.",
    icon: CalendarDays,
    features: [
      "Agenda e compromissos",
      "Recorrência",
      "Keep (anotações)",
      "Integração com Outlook",
    ],
    ai: ["Marcar compromisso e anotar pelo WhatsApp"],
    integrations: ["Microsoft 365", "Outlook", "WhatsApp"],
    audience: ["Todo o time"],
  },
  {
    slug: "one-finance",
    screenshot: {
      src: "/screenshots/orcamento-dashboard.png",
      alt: "Orkiestri Finance — painel de orçamento com previsto, realizado e desvio por período",
      width: 1755,
      height: 999,
    },
    name: "Orkiestri Finance",
    category: "Financeiro e orçamento",
    tagline: "Contas a pagar, gastos e orçamento no mesmo lugar.",
    description:
      "Painel financeiro, contas a pagar, despesas pessoais e orçamento com previsto × realizado por período. O orçamento era um produto à parte até 19/10/2026; virou tela daqui, porque dinheiro é um assunto só.",
    icon: Wallet,
    features: [
      "Painel financeiro",
      "Contas a pagar",
      "Meus Gastos",
      "Orçamento (previsto × realizado)",
    ],
    ai: ["Lançamento de gasto e relatório por WhatsApp"],
    integrations: ["WhatsApp"],
    audience: ["Financeiro", "Diretoria", "Todo o time"],
  },
  {
    slug: "one-core",
    name: "Orkiestri Core",
    category: "Administração da plataforma",
    tagline: "Usuários, permissões e o que o sistema avisa.",
    description:
      "Cadastros, papéis e permissões granulares, regras de alerta, histórico de auditoria, configuração do WhatsApp e assinatura. É a parte que o administrador usa para o resto funcionar do jeito da empresa.",
    icon: Settings,
    features: [
      "Cadastros e usuários",
      "Papéis e permissões",
      "Regras de alertas",
      "Configuração do WhatsApp",
      "Histórico de auditoria",
      "Assinatura",
    ],
    ai: [],
    integrations: ["WhatsApp", "Microsoft 365"],
    audience: ["Administrador", "TI"],
  },
];

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

/**
 * Slugs que o site anunciou até 26/10/2026 e que não correspondem mais a
 * nenhum módulo. Ficam aqui porque `next.config.ts` os redireciona para
 * /products — um 404 em URL que já foi indexada é pior do que um redirecionamento.
 */
export const PRODUTOS_DESCONTINUADOS = [
  "one-fleet",
  "one-assets",
  "one-crm",
  "one-supply",
  "one-observe",
  "one-budget",
  "one-flow",
] as const;
