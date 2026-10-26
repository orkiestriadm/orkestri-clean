import type { ProcessStep, FaqItem } from "@/types";

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
  /* Primeira pergunta de propósito: o site passou a ter um único caminho de
     cadastro (26/10/2026) e quem chega estranha não achar formulário. */
  {
    question: "Por que o cadastro é pelo WhatsApp?",
    answer:
      "Porque é onde a conversa já acontece. Você manda uma mensagem, responde as perguntas do cadastro ali mesmo e recebe a empresa criada com os módulos ligados — sem formulário no navegador e sem esperar aprovação. Depois disso, o mesmo canal serve para abrir chamado, marcar compromisso, criar projeto ou lançar uma despesa. Se preferir falar com uma pessoa antes, use a página de contato.",
  },
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
