import type { MetadataRoute } from "next";
import { MARCA, ICONE_APP, DESCRICAO_CURTA } from "@/lib/marca";

/**
 * Manifest do atalho instalável (PWA).
 *
 * Por que é um arquivo .ts e não um .webmanifest estático em `public/`: o nome
 * que aparece embaixo do ícone no celular é texto visível, e texto visível não
 * pode estar escrito à mão — em servidor white-label o produto tem outro nome.
 * Aqui ele vem de `MARCA`, que lê do ambiente no momento do build, como no
 * resto da interface.
 *
 * O Next serve isto em `/manifest.webmanifest` e põe o `<link rel="manifest">`
 * em toda página sozinho.
 *
 * Instalar exige HTTPS (ou localhost). Em homologação, que responde em HTTP
 * puro, o navegador NÃO vai oferecer a instalação — e isso é do protocolo, não
 * do código.
 */
export default function manifest(): MetadataRoute.Manifest {
  // Um ambiente com ícone próprio substitui os três de uma vez: declarar os do
  // produto ao lado faria o navegador escolher o do produto em algum tamanho.
  const icones: MetadataRoute.Manifest["icons"] = ICONE_APP
    ? [{ src: ICONE_APP, sizes: "512x512", type: "image/png", purpose: "any" }]
    : [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        // O Android recorta o ícone na forma do sistema (círculo, quadrado
        // arredondado...). Sem uma versão `maskable`, ele mete o desenho
        // inteiro dentro de um círculo branco menor.
        { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ];

  return {
    name: `${MARCA} One`,
    short_name: MARCA,
    description: DESCRICAO_CURTA,
    lang: "pt-BR",
    // Abre direto no sistema. Sem sessão, o middleware manda para o login —
    // que é o que se espera de um atalho de aplicativo.
    start_url: "/dashboard",
    // A raiz inteira: o login, o cadastro e a recuperação de senha precisam
    // abrir DENTRO do aplicativo. Fora do escopo, o celular joga a pessoa no
    // navegador no meio do caminho.
    scope: "/",
    display: "standalone",
    background_color: "#09090b",
    // Pinta a barra de título do aplicativo instalado. É o fundo do tema
    // escuro, que é o padrão do sistema — o claro é escolha de quem usa, e o
    // manifest não tem como saber qual está valendo.
    theme_color: "#09090b",
    icons: icones,
  };
}
