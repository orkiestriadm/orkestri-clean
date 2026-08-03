import type { Stat, ProcessStep, FaqItem } from "@/types";

/** Home — Números (doc 04). Placeholder values, ready to be replaced with real data. */
export const stats: Stat[] = [
  { value: "500", suffix: "+", label: "Projetos entregues" },
  { value: "99.9", suffix: "%", label: "Disponibilidade" },
  { value: "40", suffix: "+", label: "Integrações" },
  { value: "10", suffix: " anos", label: "de engenharia" },
];

/** Home — Diferenciais (doc 05). */
export const differentials: string[] = [
  "Arquitetura Modular",
  "Cloud Native",
  "Alta Performance",
  "API First",
  "Business Operating System",
  "Inteligência Artificial",
  "Integrações",
  "Segurança",
  "Experiência Premium",
  "Escalabilidade",
];

/** Home — Tecnologias (doc 04). */
export const technologies: string[] = [
  "AWS",
  "Azure",
  "Google Cloud",
  "Docker",
  "Next.js",
  "React",
  "Node.js",
  "TypeScript",
  "PostgreSQL",
  "SQL Server",
  "Redis",
  "RabbitMQ",
  "OpenAI",
  "Claude",
  "Gemini",
];

/** Software Factory process (docs 04, 05). */
export const softwareFactoryProcess: ProcessStep[] = [
  { title: "Discovery", description: "Entendemos o problema, o negócio e os objetivos antes de qualquer linha de código." },
  { title: "UX", description: "Desenhamos a experiência para ser simples, clara e intuitiva." },
  { title: "Arquitetura", description: "Definimos uma base escalável, segura e preparada para evoluir." },
  { title: "Desenvolvimento", description: "Construímos com qualidade, testes e boas práticas de engenharia." },
  { title: "Qualidade", description: "Validamos performance, acessibilidade e segurança." },
  { title: "Implantação", description: "Colocamos em produção com processos de CI/CD e observabilidade." },
  { title: "Suporte", description: "Evoluímos a solução continuamente junto com o seu negócio." },
];

/** Home / plataforma FAQ (doc 07 — FAQ accordion). */
export const homeFaq: FaqItem[] = [
  {
    question: "O que é o Orkiestri One?",
    answer:
      "O Orkiestri One é um Business Operating System: uma plataforma empresarial modular que reúne gestão, automação, inteligência artificial e integrações em uma única experiência. Em vez de dezenas de sistemas desconectados, sua empresa opera em um ambiente único.",
  },
  {
    question: "Preciso contratar todos os módulos?",
    answer:
      "Não. Cada aplicação pode ser adquirida individualmente, por departamento, em pacotes ou como parte da plataforma completa. Você ativa apenas os módulos necessários e a plataforma cresce conforme a empresa evolui.",
  },
  {
    question: "A Orkiestri também desenvolve software sob medida?",
    answer:
      "Sim. Nossa Software Factory desenvolve aplicações web, mobile, portais, dashboards e integrações personalizadas, além de modernização de sistemas legados — tudo com o mesmo padrão de engenharia da plataforma.",
  },
  {
    question: "Como funciona a Inteligência Artificial na plataforma?",
    answer:
      "A IA é uma capacidade compartilhada, não um módulo isolado. Ela aparece naturalmente durante o uso — resumos automáticos, classificação, busca semântica, copilotos e automações inteligentes distribuídos por toda a plataforma.",
  },
  {
    question: "A plataforma se integra com meus sistemas atuais?",
    answer:
      "Sim. O Orkiestri One foi concebido para ser aberto, com API REST, webhooks e integrações com Microsoft 365, Google Workspace, SAP, TOTVS, Oracle, Active Directory e provedores de nuvem.",
  },
  {
    question: "A Orkiestri atende empresas de qual porte?",
    answer:
      "Atendemos empresas de médio e grande porte, tipicamente entre 50 e 5.000 colaboradores, com operações complexas e necessidade de integração, automação e governança.",
  },
];
