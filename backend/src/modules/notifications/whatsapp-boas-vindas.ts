/**
 * Boas-vindas por WhatsApp de quem acabou de ser cadastrado (pedido de 17/09/2026).
 *
 * O número é digitado pelo administrador no cadastro e já nasce confirmado —
 * decisão explícita, trocando a verificação por código pela palavra de quem
 * cadastra. A linha "Não reconhece este cadastro?" existe por causa disso: é
 * o único retorno que um número digitado errado tem.
 *
 * Função pura, sem Prisma e sem Nest, para o texto ser testado do jeito que sai.
 */

/** Só dígitos, com DDD (10 a 13). Vazio → null; inválido → lança. */
export function normalizarWhatsapp(bruto: string | null | undefined): string | null {
  const digitos = String(bruto ?? "").replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.length < 10 || digitos.length > 13) {
    throw new Error("WhatsApp inválido. Use DDD + número.");
  }
  return digitos;
}

type Bloco = { permissao: string; titulo: string; itens: string[] };

/**
 * Um bloco por módulo, e só avisos que o sistema de fato manda pelo WhatsApp.
 * Prometer aviso que não existe é pior que não citar o módulo.
 */
const BLOCOS: Bloco[] = [
  {
    permissao: "projetos:ver", titulo: "📁 *Projetos*",
    itens: ["Quando incluírem você em um projeto", "Prazos de projetos e de tarefas se aproximando"],
  },
  {
    permissao: "agenda:ver", titulo: "🗓️ *Agenda*",
    itens: ["Lembrete 15 minutos antes de cada compromisso"],
  },
  {
    permissao: "chamados:ver", titulo: "🛠️ *Chamados*",
    itens: ["Chamado devolvido a você", "Chamado de frota aguardando atendimento"],
  },
  {
    permissao: "solicitacoes:ver", titulo: "✅ *Aprovações*",
    itens: ["Solicitação aguardando sua aprovação", "Aprovação delegada a você", "Ajustes pedidos na sua solicitação"],
  },
  {
    permissao: "frota:ver", titulo: "🚚 *Frotas*",
    itens: ["Andamento das manutenções abertas por chamado de frota"],
  },
];

function primeiroNome(nome: string): string {
  return String(nome || "").trim().split(/\s+/)[0] || "";
}

export function montarBoasVindasCadastro(p: {
  nome: string;
  email: string;
  permissoes: string[];
  marca: string;
  url: string;
}): string {
  const tudo = p.permissoes.includes("*");
  const blocos = BLOCOS.filter(b => tudo || p.permissoes.includes(b.permissao));
  const nm = primeiroNome(p.nome);

  // Começa com negrito de propósito: o worker da fila não empilha o cabeçalho
  // da marca em mensagem que já vem formatada.
  let m = `*👋 Olá${nm ? `, ${nm}` : ""}!*\n\n` +
    `Seu acesso ao *${p.marca}* foi criado, e este WhatsApp já está ativo para receber os avisos do sistema.\n\n`;

  if (blocos.length) {
    m += "📌 *O que vai chegar para você aqui:*\n\n" +
      blocos.map(b => `${b.titulo}\n${b.itens.map(i => `• ${i}`).join("\n")}`).join("\n\n") +
      "\n\n";
  }

  m += "🔐 *Como acessar*\n" +
    `Endereço: ${p.url}\n` +
    `Usuário: ${p.email}\n` +
    "A senha inicial é passada pelo administrador. No primeiro acesso você cria a sua.\n\n" +
    "Não reconhece este cadastro? Fale com o administrador do sistema.";
  return m;
}
