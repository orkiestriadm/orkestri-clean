/**
 * Global site configuration.
 * Source: orkiestri-design-system/04-information-architecture.md
 */
/**
 * Voz do site (26/10/2026).
 *
 * Era "Enterprise Software Company / plataformas empresariais / Business
 * Operating System" — o visitante saía entendendo que isto é um ERP. O
 * produto real é outro: ele guarda a agenda, as anotações, os projetos, as
 * contas e os gastos de UMA PESSOA, e avisa no WhatsApp quando é hora.
 *
 * Regra ao escrever qualquer texto deste site: fale com uma pessoa, não com
 * uma diretoria. Nada de "operação", "gestão empresarial", "transformação
 * digital", "solução corporativa" ou "ecossistema".
 */
export const siteConfig = {
  name: "Orkiestri",
  legalName: "Orkiestri",
  domain: "orkiestri.com",
  url: "https://www.orkiestri.com",
  tagline: "A sua vida organizada, com aviso no WhatsApp.",
  description:
    "Orkiestri guarda a sua agenda, as suas anotações, os seus projetos, as suas contas e os seus gastos — e te avisa no WhatsApp quando é hora. Você anota mandando uma mensagem e é lembrado por mensagem.",
  locale: "pt-BR",
  social: {
    linkedin: "https://www.linkedin.com/company/orkiestri",
    github: "https://github.com/orkiestri",
    instagram: "https://www.instagram.com/orkiestri",
    youtube: "https://www.youtube.com/@orkiestri",
  },
  contact: {
    email: "contato@orkiestri.com",
  },
} as const;

export type SiteConfig = typeof siteConfig;

/**
 * Único caminho de cadastro do site (decisão do cliente, 26/10/2026): abre a
 * conversa já com o texto pronto, e a Aurélia conduz o cadastro por lá.
 *
 * O número tem de ser o mesmo a que a instância do Evolution está conectada
 * em produção — apontando para outro, a mensagem chega a um WhatsApp que
 * ninguém lê e o visitante fica sem resposta.
 */
export const WHATSAPP_NUMERO = "5514991661688";

export const WHATSAPP_CADASTRO = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
  "Quero fazer meu cadastro no Orkiestri",
)}`;
