/**
 * Identidade da marca exibida ao usuário.
 *
 * POR QUE ISTO EXISTE
 *
 * O nome do produto estava escrito à mão em 175 lugares entre backend e
 * frontend. Quando o servidor de homologação passou a ser white-label de um
 * cliente (Triunfo Transbrasiliana), a única saída seria editar dezenas de
 * arquivos naquele servidor — criando divergência que o deploy seguinte
 * sobrescreveria em silêncio. Foi exatamente o que aconteceu com o logo do
 * Sidebar em 04/08/2026: uma customização local foi apagada por um envio de
 * rotina e ninguém notou até o cliente reclamar.
 *
 * Com a marca vindo do ambiente, o CÓDIGO é idêntico em todo lugar e a
 * diferença mora na configuração — que o deploy não sobrescreve.
 *
 * ⚠️ SÓ TEXTO VISÍVEL. Nunca use isto para identificador técnico: nome de
 * cookie (`orkestri_sa_token`), chave de localStorage (`orkestri-favorites`),
 * nome de instância do WhatsApp (`orkestri-org-*`), arquivo do agente
 * (`orkestri-agent.js`) ou variável de ambiente. Trocar qualquer um deles
 * desloga usuários, apaga preferências salvas ou perde a instância pareada.
 */

/** Nome exibido do produto. */
export const MARCA = process.env.MARCA?.trim() || "Orkiestri";

/**
 * Endereço de acesso mostrado ao usuário em e-mails e telas.
 *
 * Separado da marca porque é informação verdadeira, não identidade: num
 * ambiente white-label mostrar o domínio errado confunde mais do que mostrar
 * a marca de outro produto.
 */
export const APP_DOMINIO = process.env.APP_DOMINIO?.trim() || "app.orkiestri.com";

/**
 * A marca em forma de NOME DE ARQUIVO: sem acento, sem espaço, sem símbolo.
 *
 * O guia em PDF chega ao celular com o nome do arquivo à vista, e era o último
 * lugar onde a marca do produto aparecia para o cliente white-label mesmo com
 * todo o texto já corrigido — `Guia-Orkiestri-WhatsApp.pdf` no WhatsApp de
 * quem usa o Hub.
 *
 * Isto NÃO é identificador técnico: o arquivo no disco continua
 * `assets/guia-whatsapp.pdf`. Aqui é só o nome que o destinatário lê.
 */
export const MARCA_ARQUIVO =
  MARCA.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "Guia";
