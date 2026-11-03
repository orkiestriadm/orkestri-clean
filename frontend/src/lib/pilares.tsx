import { CalendarDays, MessageCircle, Headphones, FolderKanban } from "lucide-react";

/**
 * Os quatro cards do painel de marca, mostrados no login e em Solicitar acesso.
 *
 * Moram aqui porque as duas telas prometem a MESMA coisa, e antes a lista
 * estava escrita duas vezes — com um comentário em cada uma pedindo que fossem
 * iguais. Pedido em comentário não segura nada: quem mexer numa não vê a outra.
 *
 * O que entra: o que a pessoa vai FAZER aqui dentro. Antes eram quatro selos de
 * engenharia — "Cloud Native", "API First", "IA nativa" e "99,9% de
 * disponibilidade". Nenhum diz o que ela ganha ao entrar, e aquele número
 * ninguém media: era promessa escrita na porta de entrada sem nada por trás.
 *
 * Os quatro de agora valem em qualquer ambiente, inclusive nos white-label:
 * agenda, chamados e projetos existem em todos, e o aviso no WhatsApp é o que
 * o produto faz de diferente. Nada de módulo que uma organização possa não ter.
 */
export const PILARES = [
  { icon: CalendarDays, label: "Agenda", text: "Os seus compromissos, com lembrete" },
  { icon: MessageCircle, label: "No WhatsApp", text: "O aviso chega onde você já está" },
  { icon: Headphones, label: "Chamados", text: "Peça ajuda e acompanhe o andamento" },
  { icon: FolderKanban, label: "Projetos", text: "As tarefas e os prazos do time" },
];
