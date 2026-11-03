import {
  CalendarDays,
  Wallet,
  StickyNote,
  ListChecks,
  FolderKanban,
  Receipt,
  Headset,
  BookOpen,
  UserCog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * O que a Aurélia entende, escrito a partir do código que interpreta a
 * mensagem — e não de material de marketing.
 *
 * 🔴 REGRA. Cada pedido desta página tem de casar com um padrão que existe em
 * `backend/src/modules/agenda/`:
 *
 *   - `whatsapp-inbound.module.ts` — os parsers de texto livre: evento, gasto,
 *     nota, tarefa, projeto, conta, chamado, busca e desfazer.
 *   - `whatsapp-guiado.service.ts` — o menu numerado, para quem prefere
 *     escolher em vez de escrever.
 *   - `whatsapp-rotina.service.ts` — "meu dia" e o resumo diário.
 *   - `whatsapp-media.service.ts` — áudio e arquivo.
 *
 * Inventário feito em 03/11/2026 sobre a base de produção (site 3.3.2, API
 * 4.3.0). Ao mexer: abra o parser antes de acrescentar um pedido. Publicar
 * uma frase que a Aurélia não entende é pior do que não publicar nenhuma —
 * a pessoa tenta, não funciona, e para de tentar.
 */

export type Pedido = {
  /** O texto exato, do jeito que a pessoa manda. */
  texto: string;
  /** Hora fictícia, só para a parede parecer uma conversa e não uma tabela. */
  hora: string;
  /** Onde no código isso é interpretado. Não aparece na tela; serve de prova. */
  parser?: string;
};

export type MesaPedidos = {
  id: string;
  titulo: string;
  modulo: string;
  icon: LucideIcon;
  /** Para onde a pessoa vai se quiser conhecer o módulo. */
  href: string;
  pedidos: Pedido[];
};

export const MESAS: MesaPedidos[] = [
  {
    id: "agenda",
    titulo: "Agenda e compromissos",
    modulo: "Space",
    icon: CalendarDays,
    href: "/products/one-space",
    pedidos: [
      { texto: "Evento: reunião com a equipe amanhã 9h", hora: "08:14", parser: "parseComandoEvento" },
      { texto: "Marcar dentista quinta 15h", hora: "11:02", parser: "parseComandoEvento" },
      { texto: "Agendar consulta dia 12/11 às 14h30", hora: "19:47", parser: "parseComandoEvento" },
      { texto: "Compromisso: aula de inglês toda semana", hora: "07:33", parser: "recorrência semanal" },
      { texto: "Evento: academia todo dia às 7h por 3 meses", hora: "22:08", parser: "recorrência + limite" },
      { texto: "Evento: financeiro todo mês a partir de 01/12", hora: "16:21", parser: "recorrência mensal" },
      { texto: "meus compromissos", hora: "06:58", parser: "listarCompromissos" },
      { texto: "minha agenda", hora: "13:40", parser: "listarCompromissos" },
      { texto: "excluir compromisso 2", hora: "20:15", parser: "mDelEvento" },
    ],
  },
  {
    id: "gastos",
    titulo: "Gastos do dia a dia",
    modulo: "Finance",
    icon: Wallet,
    href: "/products/one-finance",
    pedidos: [
      { texto: "gastei 87 na farmácia", hora: "19:26", parser: "parseComandoGasto" },
      { texto: "Gasto: mercado 150 no crédito", hora: "12:41", parser: "parseComandoGasto" },
      { texto: "paguei 180 de luz no pix", hora: "08:39", parser: "forma de pagamento" },
      { texto: "almoço 45 no débito", hora: "13:48", parser: "forma de pagamento" },
      { texto: "comprei uma cadeira em 6x de 95", hora: "21:04", parser: "parcelamento" },
      { texto: "abasteci 250 no cartão", hora: "17:12", parser: "categoria automática" },
      { texto: "quanto gastei esse mês", hora: "22:07", parser: "relatório de gastos" },
      { texto: "resumo dos meus gastos", hora: "09:05", parser: "gastos.resumo" },
      { texto: "corrige, o almoço foi 54", hora: "13:52", parser: "correção do último" },
      { texto: "parar resumo", hora: "23:31", parser: "configurarResumo" },
    ],
  },
  {
    id: "anotacoes",
    titulo: "Anotações rápidas",
    modulo: "Space · Keep",
    icon: StickyNote,
    href: "/products/one-space",
    pedidos: [
      { texto: "Nota: comprar pilha para o controle", hora: "19:12", parser: "mNota" },
      { texto: "anotar: ideia da vitrine nova", hora: "23:14", parser: "mNota" },
      { texto: "lembrete: ligar para o contador", hora: "18:40", parser: "mNota" },
      { texto: "minhas notas", hora: "10:26", parser: "listarNotas" },
    ],
  },
  {
    id: "rotina",
    titulo: "Tarefas e o resumo do dia",
    modulo: "Space · Rotina",
    icon: ListChecks,
    href: "/products/one-space",
    pedidos: [
      { texto: "tarefa: comprar material amanhã", hora: "09:57", parser: "comandoRotina" },
      { texto: "meu dia", hora: "07:00", parser: "comandoRotina" },
      { texto: "rotina", hora: "07:02", parser: "comandoRotina" },
      { texto: "ativar resumo diário 08:00", hora: "22:51", parser: "resumo diário" },
      { texto: "ativar resumo diário 08:00 dias úteis", hora: "22:53", parser: "resumo diário" },
      { texto: "pausar resumo diário", hora: "07:26", parser: "resumo diário" },
      { texto: "minhas tarefas", hora: "19:23", parser: "listarTarefas" },
    ],
  },
  {
    id: "projetos",
    titulo: "Projetos da equipe",
    modulo: "Projects",
    icon: FolderKanban,
    href: "/products/one-projects",
    pedidos: [
      { texto: "Projeto: reforma da loja", hora: "16:52", parser: "mProjeto" },
      { texto: "meus projetos", hora: "10:11", parser: "listarProjetos" },
    ],
  },
  {
    id: "contas",
    titulo: "Contas a pagar",
    modulo: "Finance",
    icon: Receipt,
    href: "/products/one-finance",
    pedidos: [
      { texto: "Conta: energia 350 vence 10/11", hora: "11:08", parser: "mConta" },
      { texto: "contas a pagar", hora: "15:20", parser: "contas.lista" },
      { texto: "resumo de contas", hora: "17:40", parser: "contas.resumo" },
    ],
  },
  {
    id: "chamados",
    titulo: "Pedidos e chamados",
    modulo: "Service",
    icon: Headset,
    href: "/products/one-desk",
    pedidos: [
      { texto: "Chamado: a impressora não liga", hora: "09:22", parser: "mChamado" },
      { texto: "suporte: o acesso do Lucas não entra", hora: "14:33", parser: "mChamado" },
      { texto: "meus chamados", hora: "17:55", parser: "listarChamados" },
    ],
  },
  {
    id: "conhecimento",
    titulo: "Base de conhecimento",
    modulo: "Quality",
    icon: BookOpen,
    href: "/products/one-quality",
    pedidos: [
      { texto: "Buscar: como criar um projeto", hora: "11:20", parser: "mBusca" },
      { texto: "procurar política de reembolso", hora: "16:23", parser: "mBusca" },
    ],
  },
  {
    id: "conta",
    titulo: "Sua conta e o acesso",
    modulo: "Core",
    icon: UserCog,
    href: "/products/one-core",
    pedidos: [
      { texto: "menu", hora: "08:05", parser: "menu guiado" },
      { texto: "cadastro", hora: "09:12", parser: "cadastro-whatsapp" },
      { texto: "vincular 7QF3ZD", hora: "12:53", parser: "mVinc" },
      { texto: "apagar", hora: "13:12", parser: "desfazer o último" },
      { texto: "errei", hora: "13:13", parser: "desfazer o último" },
    ],
  },
];

/** Quantos pedidos a parede mostra, contados de verdade. */
export const TOTAL_PEDIDOS = MESAS.reduce((n, m) => n + m.pedidos.length, 0);

/**
 * O catálogo de funcionalidades.
 *
 * Mesma regra das mesas: cada item corresponde a comportamento que existe no
 * sistema hoje. `grupo` casa com os módulos de `config/products.ts`.
 */
export type Capacidade = {
  grupo: string;
  titulo: string;
  texto: string;
  /** Exemplo de conversa, quando existe um pedido que demonstra a capacidade. */
  exemplo?: { pergunta: string; resposta: string };
};

export const CAPACIDADES: Capacidade[] = [
  // ── Space · agenda ────────────────────────────────────────────────────
  {
    grupo: "Agenda e anotações",
    titulo: "Marque um compromisso escrevendo como você falaria.",
    texto:
      "Você não decora comando. “Marcar dentista quinta 15h” e “Evento: reunião com a equipe amanhã 9h” chegam ao mesmo lugar. A Aurélia entende o dia, a hora e o assunto, cria o compromisso e devolve a confirmação escrita para você conferir sem abrir nada.",
    exemplo: {
      pergunta: "Marcar dentista quinta 15h",
      resposta: "Marcado: Dentista, quinta, 15:00. Eu te aviso antes.",
    },
  },
  {
    grupo: "Agenda e anotações",
    titulo: "O que se repete nasce de uma vez só.",
    texto:
      "“Toda semana”, “todo mês”, “todo dia”, “a cada quinze dias”. A série inteira é criada de uma vez. Dá para limitar com “por 3 meses” ou começar adiante com “a partir de 01/12”, na mesma frase.",
  },
  {
    grupo: "Agenda e anotações",
    titulo: "O lembrete chega quatro vezes, antes de você precisar dele.",
    texto:
      "Uma hora antes, de novo aos quinze minutos, aos cinco e na hora que começa. Os quatro avisos chegam na mesma conversa do WhatsApp, sem aplicativo novo e sem notificação vindo de outro lugar.",
  },
  {
    grupo: "Agenda e anotações",
    titulo: "Consulte a semana sem sair da conversa.",
    texto:
      "“meus compromissos” ou “minha agenda” devolve a lista numerada do que vem pela frente. Para tirar um, “excluir compromisso 2” — o número é o da própria lista que acabou de chegar.",
  },
  {
    grupo: "Agenda e anotações",
    titulo: "A agenda do site e a do WhatsApp são a mesma.",
    texto:
      "O que você marca pela conversa aparece na agenda do site, e o que você marca no site a Aurélia enxerga. Nada é digitado duas vezes. Quem usa Outlook ou Microsoft 365 mantém a sincronização ligada.",
  },
  {
    grupo: "Agenda e anotações",
    titulo: "A anotação que não é tarefa de ninguém tem lugar.",
    texto:
      "“Nota: comprar pilha para o controle” vira uma anotação no Keep, e “minhas notas” traz tudo de volta. É o lugar da ideia solta, daquilo que você só precisa não esquecer, sem prazo nem responsável.",
    exemplo: {
      pergunta: "Nota: comprar pilha para o controle",
      resposta: "Anotado no seu Keep.",
    },
  },
  {
    grupo: "Agenda e anotações",
    titulo: "Receba o resumo do dia no horário que você escolher.",
    texto:
      "“meu dia” responde na hora. Para receber sozinho toda manhã, “ativar resumo diário 08:00”, e “ativar resumo diário 08:00 dias úteis” pula o fim de semana. Para parar, “pausar resumo diário”. Horário de Brasília.",
  },
  {
    grupo: "Agenda e anotações",
    titulo: "A tarefa pessoal entra pela mesma conversa.",
    texto:
      "“tarefa: comprar material amanhã” abre a tarefa com o prazo que você disse. Ela entra no resumo do dia e sai da fila quando você manda concluir, pelo código que veio na mensagem.",
  },

  // ── Finance ───────────────────────────────────────────────────────────
  {
    grupo: "Contas e gastos",
    titulo: "Anote o gasto numa frase, e ele entra na categoria certa.",
    texto:
      "“gastei 87 na farmácia”, “mercado 150 no crédito”, “paguei 180 de luz no pix”. A Aurélia lê o valor, a descrição e a forma de pagamento e lança. A categoria sai do que você escreveu: mercado, combustível, academia, contas de casa, roupa, assinatura e material de estudo são reconhecidos pelo nome.",
    exemplo: {
      pergunta: "gastei 87 na farmácia",
      resposta: "Lancei R$ 87,00 em Saúde, no crédito.",
    },
  },
  {
    grupo: "Contas e gastos",
    titulo: "A compra parcelada se desdobra sozinha.",
    texto:
      "“comprei uma cadeira em 6x de 95” cria as seis parcelas, uma em cada mês, com o total calculado. “à vista” também é entendido, e vale escrever “parcelado em 12” do mesmo jeito.",
  },
  {
    grupo: "Contas e gastos",
    titulo: "Cada forma de pagamento é reconhecida pelo nome.",
    texto:
      "Débito, crédito, Pix, dinheiro e boleto. Você escreve do jeito que falaria — “no cartão”, “em espécie”, “no pix” — e o lançamento guarda a forma certa, que é o que faz o resumo do mês bater com a fatura.",
  },
  {
    grupo: "Contas e gastos",
    titulo: "Pergunte quanto já foi, no período que você quiser.",
    texto:
      "“quanto gastei esse mês” responde com o número na conversa. “resumo dos meus gastos” traz o recorte por categoria e por forma de pagamento, e o resumo semanal chega sozinho — “parar resumo” desliga, “voltar resumo” religa.",
  },
  {
    grupo: "Contas e gastos",
    titulo: "Errou o valor? Corrija na frase seguinte.",
    texto:
      "“corrige, o almoço foi 54” troca o valor do último lançamento. Um “apagar”, “desfazer” ou “errei” desfaz o que acabou de entrar, sem tela de edição no meio.",
    exemplo: {
      pergunta: "corrige, o almoço foi 54",
      resposta: "Corrigido: almoço, R$ 54,00.",
    },
  },
  {
    grupo: "Contas e gastos",
    titulo: "A conta a pagar guarda o vencimento junto.",
    texto:
      "“Conta: energia 350 vence 10/11” registra o valor e a data. “contas a pagar” lista o que está em aberto e “resumo de contas” fecha o período. Quem paga continua sendo você; a Aurélia anota e lembra.",
  },
  {
    grupo: "Contas e gastos",
    titulo: "Seus gastos pessoais são só seus.",
    texto:
      "O que você lança como gasto pessoal fica na sua conta, e não aparece para o resto da organização. As contas da empresa vivem em outro lugar, com a permissão de quem cuida do financeiro.",
  },

  // ── Projects ──────────────────────────────────────────────────────────
  {
    grupo: "Projetos e tarefas",
    titulo: "O projeto começa por uma mensagem e continua no quadro.",
    texto:
      "“Projeto: reforma da loja” abre o projeto no contexto da sua empresa. Daí em diante prazos, responsáveis e etapas vivem no quadro do site, e “meus projetos” traz a situação de volta para a conversa.",
  },
  {
    grupo: "Projetos e tarefas",
    titulo: "Cada um vê o que é da sua conta.",
    texto:
      "A lista de projetos respeita o acesso de quem perguntou: você só enxerga aquilo a que tem permissão. É o mesmo controle do site, aplicado à conversa.",
  },

  // ── Service ───────────────────────────────────────────────────────────
  {
    grupo: "Pedidos e chamados",
    titulo: "O pedido entra pelo WhatsApp e não se perde.",
    texto:
      "“Chamado: a impressora não liga” abre o chamado com histórico e responsável. “meus chamados” mostra em que pé estão. O pedido deixa de depender de alguém lembrar que foi pedido.",
    exemplo: {
      pergunta: "Chamado: a impressora não liga",
      resposta: "Chamado aberto. Eu te aviso quando andar.",
    },
  },
  {
    grupo: "Pedidos e chamados",
    titulo: "O prazo do atendimento é acompanhado sozinho.",
    texto:
      "O sistema acompanha o prazo de cada chamado e avisa quem precisa agir antes de ele estourar, em vez de só registrar o atraso depois que aconteceu.",
  },

  // ── Quality ───────────────────────────────────────────────────────────
  {
    grupo: "Base de conhecimento",
    titulo: "Escreveu uma vez, para de ser perguntado.",
    texto:
      "“Buscar: como criar um projeto” procura na base de conhecimento da sua organização e devolve a orientação na conversa. Quem respondia a mesma pergunta toda semana passa a mandar o link uma vez.",
  },

  // ── Core ──────────────────────────────────────────────────────────────
  {
    grupo: "Acessos e avisos",
    titulo: "Quem prefere escolher em vez de escrever, manda “menu”.",
    texto:
      "Um menu numerado aparece com o que a sua conta pode fazer: compromissos, anotações, gastos, projetos, tarefas e mais opções. A Aurélia pergunta um campo por vez, e “voltar”, “menu” e “0” existem em toda etapa.",
  },
  {
    grupo: "Acessos e avisos",
    titulo: "O menu mostra só o que você tem permissão de usar.",
    texto:
      "As opções são montadas a partir das suas permissões. Um módulo que a sua conta não acessa não aparece na lista — e não aparece também se você perguntar por ele escrevendo.",
  },
  {
    grupo: "Acessos e avisos",
    titulo: "Mande um áudio quando escrever não der.",
    texto:
      "Áudio de até trinta segundos é transcrito e tratado como se você tivesse escrito. Serve para o pedido que aparece no meio da rua, com o celular na mão e sem jeito de digitar.",
  },
  {
    grupo: "Acessos e avisos",
    titulo: "Mande o arquivo e ele fica anexado ao registro.",
    texto:
      "PDF e imagem em JPEG, PNG ou WebP, de até 5 MB. O arquivo chega pela conversa e fica guardado junto do que você estava registrando, para ser encontrado depois pelo site.",
  },
  {
    grupo: "Acessos e avisos",
    titulo: "Já tem conta no site? Vincule o seu WhatsApp.",
    texto:
      "No Perfil do sistema você gera um código e manda “vincular” com ele na conversa. Daí em diante o WhatsApp e a conta são a mesma coisa, sem cadastro novo.",
  },
];

/** Os grupos do catálogo, na ordem em que aparecem. */
export const GRUPOS_CAPACIDADE = [...new Set(CAPACIDADES.map((c) => c.grupo))];

/**
 * O roteiro da demonstração clicável.
 *
 * 🔴 A resposta aqui é ENCENAÇÃO, e a página diz isso em voz alta. Nada é
 * enviado, nada é salvo e nenhum número é real. O que não pode ser encenado é
 * o COMPORTAMENTO: cada pedido é um que a Aurélia entende de verdade, e a
 * resposta é do mesmo formato que ela devolve — confirmação escrita, com o
 * dado que ela extraiu da frase.
 *
 * Sem isso, a demonstração vira promessa; com isso, ela vira amostra.
 */
export type DemoPasso = {
  id: string;
  /** O que a pessoa manda. */
  pedido: string;
  /** O que a Aurélia responde, em até três linhas. */
  resposta: string[];
  /** Rótulo curto do botão. */
  chip: string;
  /** A mesa, para colorir o chip e dar contexto. */
  mesa: string;
};

export const DEMO: DemoPasso[] = [
  {
    id: "evento",
    chip: "Marcar um compromisso",
    mesa: "Agenda",
    pedido: "Evento: reunião com a equipe amanhã 9h",
    resposta: [
      "Marcado: *Reunião com a equipe*",
      "Amanhã, 09:00 · 1 hora",
      "Eu te aviso 1h antes, aos 15min, aos 5min e na hora.",
    ],
  },
  {
    id: "gasto",
    chip: "Anotar um gasto",
    mesa: "Gastos",
    pedido: "gastei 87 na farmácia",
    resposta: ["Lancei *R$ 87,00*", "Categoria: Saúde · Forma: crédito"],
  },
  {
    id: "parcelado",
    chip: "Parcelar uma compra",
    mesa: "Gastos",
    pedido: "comprei uma cadeira em 6x de 95",
    resposta: [
      "Parcelei em *6x de R$ 95,00*",
      "Total: R$ 570,00 · uma parcela por mês",
    ],
  },
  {
    id: "nota",
    chip: "Guardar uma anotação",
    mesa: "Anotações",
    pedido: "Nota: comprar pilha para o controle",
    resposta: ["Anotado no seu Keep.", "Mande *minhas notas* para ver tudo."],
  },
  {
    id: "tarefa",
    chip: "Criar uma tarefa",
    mesa: "Tarefas",
    pedido: "tarefa: comprar material amanhã",
    resposta: [
      "Tarefa criada: *comprar material*",
      "Prazo: amanhã · Código T-9F2A41C8",
      "Ela entra no seu resumo do dia.",
    ],
  },
  {
    id: "dia",
    chip: "Ver o meu dia",
    mesa: "Rotina",
    pedido: "meu dia",
    resposta: [
      "*Hoje*",
      "09:00 — Reunião com a equipe",
      "Vence hoje: comprar material",
    ],
  },
  {
    id: "conta",
    chip: "Anotar uma conta",
    mesa: "Contas",
    pedido: "Conta: energia 350 vence 10/11",
    resposta: ["Conta registrada: *Energia*", "R$ 350,00 · vence em 10/11"],
  },
  {
    id: "chamado",
    chip: "Abrir um chamado",
    mesa: "Chamados",
    pedido: "Chamado: a impressora não liga",
    resposta: [
      "Chamado aberto para a sua equipe.",
      "Eu te aviso quando ele andar.",
    ],
  },
  {
    id: "gastos-mes",
    chip: "Quanto eu gastei",
    mesa: "Gastos",
    pedido: "quanto gastei esse mês",
    resposta: [
      "No mês: *R$ 1.284,50*",
      "Mercado R$ 412 · Saúde R$ 287 · Transporte R$ 250",
    ],
  },
  {
    id: "buscar",
    chip: "Procurar uma orientação",
    mesa: "Conhecimento",
    pedido: "Buscar: como criar um projeto",
    resposta: [
      "Achei na base da sua organização:",
      "*Como abrir um projeto e convidar a equipe*",
    ],
  },
  {
    id: "desfazer",
    chip: "Desfazer o último",
    mesa: "Conta",
    pedido: "errei",
    resposta: ["Desfiz o último registro.", "Pode mandar de novo do jeito certo."],
  },
  {
    id: "menu",
    chip: "Ver o menu",
    mesa: "Conta",
    pedido: "menu",
    resposta: [
      "Como posso ajudar? Responda o número:",
      "*1* Compromissos · *2* Anotações · *3* Gastos",
      "*4* Projetos · *5* Tarefas · *6* Mais opções",
    ],
  },
];
