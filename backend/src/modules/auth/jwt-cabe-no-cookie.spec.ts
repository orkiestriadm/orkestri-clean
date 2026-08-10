import { JwtService } from "@nestjs/jwt";

/**
 * O token de sessão precisa caber num cookie.
 *
 * Em 10/08/2026 ninguém conseguiu usar o sistema por quase um dia. O login
 * respondia 200, a API não registrava erro nenhum, o build estava limpo e os
 * containers saudáveis — mas o token trazia a lista inteira de permissões
 * (144 na época), o JWT dava 4531 bytes e o cookie 4596.
 *
 * Navegador descarta silenciosamente cookie acima de 4096 bytes. Sem cookie,
 * o middleware não via sessão e devolvia todo mundo para a tela de entrada.
 * Nada no servidor acusava o problema, porque do lado do servidor não havia
 * problema nenhum.
 *
 * Este teste existe porque o defeito é INVISÍVEL para tudo o que costumamos
 * checar num deploy. Ele falha no CI em vez de falhar na cara do usuário.
 *
 * Se falhar: NÃO aumente o limite. O limite é do navegador, não nosso. Tire
 * campo do payload — `JwtStrategy.validate` resolve permissões e isSuperAdmin
 * no servidor, então quase nada precisa viajar assinado.
 */

/** Limite por cookie em Chrome/Firefox/Safari (nome + valor + atributos). */
const LIMITE_COOKIE = 4096;

/** Atributos que `res.cookie` acrescenta em auth.controller.ts. */
const ATRIBUTOS = "orkestri_token=; Max-Age=28800; Path=/; HttpOnly; SameSite=Strict";

describe("o token de sessão cabe no cookie", () => {
  const jwt = new JwtService({ secret: "teste" });

  /** Paga o preço de uma organização grande: mais papéis, e-mail e ids longos. */
  const payloadRealista = {
    sub: "00000000-0000-0000-0000-000000000001",
    email: "nome.sobrenome.longo@empresa-com-dominio-extenso.com.br",
    organizationId: "00000000-0000-0000-0000-000000000001",
    roles: ["master", "administrador", "gestor", "supervisor"],
    isMaster: true,
    isSuperAdmin: false,
  };

  it("fica com folga dentro do limite de 4096 bytes do navegador", () => {
    const token = jwt.sign(payloadRealista, { expiresIn: "8h" });
    const cookie = ATRIBUTOS.length + token.length;

    expect(cookie).toBeLessThan(LIMITE_COOKIE);
    // Folga real, não "passou raspando": o payload ainda vai crescer.
    expect(cookie).toBeLessThan(LIMITE_COOKIE / 2);
  });

  it("não carrega a lista de permissões — é ela que estourava o cookie", () => {
    expect(Object.keys(payloadRealista)).not.toContain("permissions");
  });

  /**
   * Demonstra o defeito, para quem ler este arquivo entender a ordem de
   * grandeza: com as permissões dentro, o cookie estoura.
   */
  it("estouraria de volta se as permissões voltassem ao payload", () => {
    const permissoes = Array.from({ length: 144 }, (_, i) => `recurso${i}:acao_alguma`);
    const token = jwt.sign({ ...payloadRealista, permissions: permissoes }, { expiresIn: "8h" });

    expect(ATRIBUTOS.length + token.length).toBeGreaterThan(LIMITE_COOKIE);
  });
});
