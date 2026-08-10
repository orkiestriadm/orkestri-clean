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
