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
