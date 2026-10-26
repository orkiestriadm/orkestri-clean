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
  {
    question: 'Preciso instalar alguma coisa?',
    answer:
      'Não. O cadastro acontece numa conversa de WhatsApp, no número que você já usa, e os avisos chegam por lá. Existe um site onde você entra para ver tudo com calma — agenda, gastos, projetos —, mas o dia a dia funciona só por mensagem.',
  },
  {
    question: 'Por que o cadastro é pelo WhatsApp?',
    answer:
      'Porque é onde a conversa já acontece. Você manda uma mensagem, responde as perguntas do cadastro ali mesmo e recebe a conta pronta, com os módulos ligados — sem formulário e sem esperar aprovação. Se preferir falar com uma pessoa antes, use a página de contato.',
  },
  {
    question: 'Que avisos eu recebo, e quando?',
    answer:
      "Compromisso: uma hora antes, de novo aos quinze minutos, aos cinco e na hora que começa. Gastos: um resumo da semana todo domingo às 20h, só se você tiver lançado algo — e você desliga respondendo “parar resumo”. Chamados: quando o prazo entra em risco, estoura ou é escalado. Em Acessos você escolhe, módulo por módulo, o que quer receber.",
  },
  {
    question: 'Dá para usar só a agenda, ou só os gastos?',
    answer:
      'Dá. Você liga o que usa e o resto não aparece na sua tela. Nada obriga você a preencher um módulo para outro funcionar.',
  },
  {
    question: 'Meus gastos ficam visíveis para outras pessoas?',
    answer:
      'Não. Gasto pessoal fica no seu usuário: cada pessoa só vê os próprios lançamentos, inclusive quem administra a conta. Contas a pagar e orçamento são outra coisa — esses são da empresa e seguem as permissões que o administrador definir.',
  },
  {
    question: 'Serve para uma pessoa só ou para um time?',
    answer:
      'Os dois. Sozinho, ele é a sua agenda, as suas anotações e o seu controle de gastos. Com um time, as mesmas telas passam a ter responsável, prazo e histórico — e cada um continua recebendo no WhatsApp só o que é dele.',
  },
  {
    question: 'E se eu quiser algo que o Orkiestri não faz?',
    answer:
      'A gente também constrói software sob medida — foi assim que o próprio Orkiestri nasceu. Se o que você precisa não existe aqui, dá para conversar sobre construir.',
  },
];
