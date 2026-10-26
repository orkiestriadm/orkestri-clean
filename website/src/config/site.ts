/**
 * Global site configuration.
 * Source: orkiestri-design-system/04-information-architecture.md
 */
export const siteConfig = {
  name: "Orkiestri",
  legalName: "Orkiestri",
  domain: "orkiestri.com",
  url: "https://www.orkiestri.com",
  tagline: "Technology that organizes businesses.",
  description:
    "Orkiestri é uma Enterprise Software Company. Desenvolvemos plataformas empresariais, soluções em Inteligência Artificial e softwares sob medida para empresas que desejam crescer com eficiência, inovação e segurança.",
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
