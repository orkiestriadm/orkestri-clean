/**
 * Identidade da marca exibida ao usuário — lado do cliente.
 *
 * Espelha `backend/src/common/marca.ts`. Ver lá o motivo completo; em resumo:
 * o nome do produto estava escrito à mão em 175 lugares, e o servidor de
 * homologação é white-label de um cliente. Com a marca vindo do ambiente, o
 * código fica idêntico em todos os servidores e a diferença mora na
 * configuração — que o deploy não sobrescreve.
 *
 * `NEXT_PUBLIC_` é obrigatório: sem o prefixo, o Next não expõe a variável ao
 * bundle do navegador e o valor chegaria vazio na tela.
 *
 * ⚠️ SÓ TEXTO VISÍVEL. Chave de localStorage (`orkestri-auth`,
 * `orkestri-favorites`, `orkestri-sidebar-expanded`) é identificador: trocar
 * desloga o usuário e apaga as preferências dele.
 */

export const MARCA = process.env.NEXT_PUBLIC_MARCA?.trim() || "Orkiestri";

/** Endereço de acesso mostrado em texto. Verdade, não identidade. */
export const APP_DOMINIO = process.env.NEXT_PUBLIC_APP_DOMINIO?.trim() || "app.orkiestri.com";

/**
 * Plano de fundo da tela de login.
 *
 * Homologação exibia a rodovia da Triunfo Transbrasiliana, e conseguia isso
 * SUBSTITUINDO O CONTEÚDO de `planeta.jpg` pela foto — mesmo nome de arquivo,
 * imagem diferente. Funcionava até alguém trazer `frontend/public` do git, que
 * devolvia o planeta sem nenhum erro: o build passava e a tela mudava sozinha.
 *
 * Com o caminho vindo do ambiente, os dois arquivos convivem no repositório e
 * cada servidor escolhe o seu — que é o que faz a escolha sobreviver ao deploy.
 */
export const LOGIN_FUNDO =
  process.env.NEXT_PUBLIC_LOGIN_FUNDO?.trim() || "/branding/planeta.jpg";

/**
 * Arquivo de logotipo no lugar do símbolo vetorial.
 *
 * Vazio (padrão) mantém o símbolo em SVG do produto, que é nítido em qualquer
 * DPI. Um ambiente white-label aponta para a marca do cliente — em homologação,
 * `/branding/logo-ttbr-branca.png`, que já vinha no repositório e não tinha
 * nenhum código a referenciando.
 */
export const LOGO_ARQUIVO = process.env.NEXT_PUBLIC_LOGO_ARQUIVO?.trim() || "";

/**
 * Variante do logotipo para FUNDO CLARO.
 *
 * Existe porque o menu lateral acompanha o tema: no claro, um logotipo branco
 * fica invisível. Onde o fundo é sempre escuro — a tela de login, sobre a foto
 * — `LOGO_ARQUIVO` basta e esta variante nem é consultada.
 *
 * O padrão cai em `LOGO_ARQUIVO` de propósito: um ambiente que só tenha uma
 * versão da marca continua funcionando, e quem tiver as duas configura as duas.
 */
export const LOGO_ARQUIVO_CLARO =
  process.env.NEXT_PUBLIC_LOGO_ARQUIVO_CLARO?.trim() || LOGO_ARQUIVO;

/**
 * Ícone do atalho instalado (PWA) e da aba do navegador.
 *
 * Vazio (padrão) usa o símbolo do produto, em `/icon-192.png` e companhia.
 * Um ambiente white-label aponta para o ícone do cliente — e aponta por
 * CAMINHO, não trocando o conteúdo de `/icon-512.png`: arquivo substituído no
 * disco volta ao original na primeira vez que alguém trouxer `frontend/public`
 * do git, e volta em silêncio, porque o build passa igual (foi assim que a
 * foto da rodovia virou planeta — ver `LOGIN_FUNDO`).
 *
 * Precisa ser um PNG quadrado de 512×512: é o que o manifest declara, e o
 * navegador só oferece a instalação com o tamanho batendo.
 */
export const ICONE_APP = process.env.NEXT_PUBLIC_ICONE_APP?.trim() || "";

/**
 * A frase de uma linha que descreve o produto.
 *
 * Mora aqui porque sai em DOIS lugares — a meta `description` da página e o
 * `description` do manifest, que o celular mostra na hora de instalar — e duas
 * cópias à mão acabam divergindo.
 *
 * Sem o nome do produto dentro: a frase serve a qualquer ambiente, e quem põe
 * o nome é quem a exibe.
 */
export const DESCRICAO_CURTA =
  "A sua agenda, os seus gastos e os seus pedidos de ajuda — com aviso no WhatsApp.";
