import {
  CalendarDays,
  Wallet,
  FolderKanban,
  Headset,
  BookOpen,
  Settings,
} from "lucide-react";
import type { Product } from "@/types";

/**
 * As aplicações do Orkiestri.
 *
 * 🔴 DUAS REGRAS, as duas aprendidas errando.
 *
 * **1. Esta lista é espelho do sistema, não de material de marketing.**
 * A fonte da verdade é `frontend/src/lib/modules.tsx` → `NAV`: cada produto
 * aqui é um grupo de lá e cada `feature` é uma tela que existe. Até
 * 26/10/2026 o site anunciava DOZE aplicações; cinco tinham sido removidas
 * da produção em 19/10 e o hero ainda mostrava capturas delas.
 * Em 02/11/2026 saiu CONTAS A PAGAR, e com ela a dashboard do Financeiro: o
 * Finance virou "meus gastos" e só. Do Service saíram Catálogo, Horas, CSAT e
 * Automações — sobrou o chamado. Não existe "contas a receber", e agora
 * também não existe "contas a pagar": o dinheiro aqui é o GASTO de uma
 * pessoa e o ORÇAMENTO da organização, que são produtos separados no menu.
 *
 * O Orçamento ainda não tem card próprio porque falta uma captura real da
 * tela — e esta lista não enche espaço com imagem de outro módulo.
 *
 * **2. O texto fala com UMA PESSOA.**
 * A ordem começa pelo que é mais pessoal (agenda, dinheiro) e não pelo que é
 * mais corporativo. Nada de "gestão", "operação" ou "ecossistema": o produto
 * guarda a agenda e as contas de alguém e avisa no WhatsApp quando é hora.
 */
export const products: Product[] = [
  {
    slug: "one-space",
    screenshot: {
      src: "/screenshots/real-dark/agenda.webp",
      alt: "Agenda real do Orkiestri em modo escuro, com compromissos de demonstração",
      width: 1440,
      height: 960,
    },
    name: "Agenda e anotações",
    short: "Agenda",
    category: "Space",
    tagline: "Marca pelo WhatsApp e é lembrado por lá.",
    description:
      "Seus compromissos, com repetição para o que acontece toda semana. O lembrete chega no WhatsApp uma hora antes, de novo faltando quinze minutos, aos cinco e na hora que começa. O Keep guarda a anotação que não é tarefa de ninguém — aquela de comprar pilha para o controle.",
    icon: CalendarDays,
    features: [
      "Compromissos e recorrência",
      "Lembrete no WhatsApp (1h, 15min, 5min e na hora)",
      "Keep: anotações rápidas",
      "Sincroniza com o Outlook",
    ],
    ai: ["Marcar e consultar compromisso por mensagem"],
    integrations: ["WhatsApp", "Outlook", "Microsoft 365"],
    audience: ["Qualquer pessoa"],
  },
  {
    slug: "one-finance",
    screenshot: {
      src: "/screenshots/real-dark/gastos.webp",
      alt: "Tela real de Meus Gastos em modo escuro, com totais e gráficos de demonstração",
      width: 1440,
      height: 960,
    },
    name: "Meus gastos",
    short: "Gastos",
    category: "Finance",
    tagline: "Anota no crédito em 12x e o domingo te cobra.",
    description:
      "Seus gastos, lançados por mensagem na hora em que acontecem, inclusive parcelados, e o relatório que diz quanto saiu no mês, por cartão ou no total. Todo domingo às 20h chega um resumo do que você gastou na semana — e dá para desligar mandando \"parar resumo\".",
    icon: Wallet,
    features: [
      "Meus gastos, com parcelamento",
      "Metas por categoria e gastos que se repetem",
      "Orçamento: previsto × realizado",
      "Resumo semanal no WhatsApp, com opt-out",
    ],
    ai: ["Lançar gasto, corrigir o último e pedir relatório por mensagem"],
    integrations: ["WhatsApp"],
    audience: ["Qualquer pessoa", "Financeiro"],
  },
  {
    slug: "one-projects",
    screenshot: {
      src: "/screenshots/real-dark/projetos.webp",
      alt: "Quadro de um projeto no Orkiestri, com tarefas, responsáveis e progresso",
      width: 1440,
      height: 960,
    },
    name: "Projetos e tarefas",
    short: "Projetos",
    category: "Projects",
    tagline: "O que você prometeu, e para quando.",
    description:
      "O quadro do projeto com as tarefas e quem ficou com cada uma. A linha do tempo mostra o que depende do quê, que é onde o prazo costuma escapar. Pelo WhatsApp dá para criar um projeto e perguntar \"minhas tarefas\" sem abrir nada.",
    icon: FolderKanban,
    features: [
      "Quadro de projetos e tarefas",
      "Linha do tempo",
      "Projetos concluídos com histórico",
    ],
    ai: ["Criar projeto e consultar tarefas por mensagem"],
    integrations: ["WhatsApp"],
    audience: ["Qualquer pessoa", "Quem toca projeto"],
  },
  {
    slug: "one-desk",
    screenshot: {
      src: "/screenshots/real-dark/chamados.webp",
      alt: "Fila de chamados no Orkiestri, com status, prioridade e indicadores de SLA",
      width: 1440,
      height: 960,
    },
    name: "Pedidos e chamados",
    short: "Chamados",
    category: "Service",
    tagline: "O pedido entra pelo WhatsApp e não se perde.",
    description:
      "Quando alguém precisa de você — a impressora que não liga, o acesso que falta —, o pedido vira um chamado com número, prazo e responsável, em vez de ficar num grupo. Se o prazo começa a apertar, o sistema avisa antes de estourar; se estourou, avisa também.",
    icon: Headset,
    features: [
      "Fila com prazo e responsável",
      "Aviso de prazo em risco, estourado e escalado",
      "Comentários, anexos e histórico no chamado",
    ],
    ai: ["Abrir e acompanhar chamado por mensagem"],
    integrations: ["WhatsApp", "E-mail", "Microsoft 365"],
    audience: ["Quem atende pedidos", "TI", "Administrativo"],
  },
  {
    slug: "one-quality",
    screenshot: {
      src: "/screenshots/real-dark/conhecimento.webp",
      alt: "Base de conhecimento do Orkiestri com artigos organizados por categoria",
      width: 1440,
      height: 960,
    },
    name: "Base de conhecimento",
    short: "Conhecimento",
    category: "Quality",
    tagline: "Escreveu uma vez, para de ser perguntado.",
    description:
      "O passo a passo que você explica toda semana, escrito e achável. Quem precisa procura pelo WhatsApp — \"Buscar: como configurar a VPN\" — e recebe o artigo, em vez de te chamar de novo.",
    icon: BookOpen,
    features: ["Artigos e categorias", "Busca no que está publicado", "Consulta pelo WhatsApp"],
    ai: ["Busca por significado, não só por palavra exata"],
    integrations: ["WhatsApp"],
    audience: ["Qualquer pessoa"],
  },
  {
    slug: "one-core",
    name: "Acessos e avisos",
    short: "Acessos",
    category: "Core",
    tagline: "Quem vê o quê, e o que chega até você.",
    description:
      "Quem entra, o que cada um enxerga e quais avisos você quer receber — por módulo, um a um. É aqui que o WhatsApp da conta é ligado e que fica o histórico de quem mexeu em quê.",
    icon: Settings,
    features: [
      "Pessoas e permissões",
      "Regras de alerta por módulo",
      "Conexão do WhatsApp",
      "Histórico de alterações",
      "Assinatura",
    ],
    ai: [],
    integrations: ["WhatsApp", "Microsoft 365"],
    audience: ["Quem administra a conta"],
  },
];

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

/**
 * Slugs anunciados até 26/10/2026 que não correspondem a nenhum módulo.
 * `next.config.ts` os redireciona para /products — um 404 numa URL já
 * indexada é pior do que um redirecionamento.
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
