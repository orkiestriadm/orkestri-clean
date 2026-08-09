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
