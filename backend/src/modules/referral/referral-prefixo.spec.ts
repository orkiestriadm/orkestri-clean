import { createHash } from "crypto";

/**
 * O prefixo do código de indicação muda com a marca — o CÓDIGO não.
 *
 * Em 02/10/2026 o prefixo deixou de ser `ORK-` fixo e passou a sair da marca
 * (`HUB-` no Hub Triunfo Transbrasiliana), porque era a última amarra visível
 * com o nome do Orkiestri num servidor white-label.
 *
 * Trocar prefixo é seguro por um motivo que não se enxerga lendo a função: o
 * código de verdade são os 6 caracteres do hash, derivados só do id do usuário,
 * e o prefixo é descartado na comparação. O que torna isso verdade é a lista
 * `PREFIXOS_INDICACAO` aceitar o `ORK` antigo para sempre.
 *
 * Se alguém "limpar" essa lista, nada quebra no build, nada quebra no teste de
 * marca, e nenhum log acusa: só param de funcionar os códigos que as pessoas já
 * compartilharam — e a queixa chega semanas depois, sem ligação com a causa.
 * Este teste existe para isso falhar aqui.
 */

const hex = (id: string) =>
  createHash("sha256").update(id + "|indicacao|" + (process.env.JWT_SECRET || "orkiestri"))
    .digest("hex").slice(0, 6).toUpperCase();

const USERS = [{ id: "user-aaa", nome: "Leticia" }, { id: "user-bbb", nome: "Marcos" }];
const prismaFake = (jaTem: any = null) => ({
  referral: { findUnique: async () => jaTem, create: async (a: any) => a },
  user: { findMany: async () => USERS },
});

/** Recarrega os helpers com a marca pedida — `MARCA` é lida no import, e
 *  `common/marca` também precisa sair do cache. */
function comMarca(marca?: string) {
  jest.resetModules();
  if (marca === undefined) delete process.env.MARCA; else process.env.MARCA = marca;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("./referral.helpers");
}

describe("código de indicação: o prefixo segue a marca, o código não muda", () => {
  const MARCA_ORIGINAL = process.env.MARCA;
  afterAll(() => { if (MARCA_ORIGINAL === undefined) delete process.env.MARCA; else process.env.MARCA = MARCA_ORIGINAL; });

  it("na linha do Orkiestri o código é idêntico ao de antes da troca", () => {
    const { codigoIndicacao } = comMarca(undefined);
    expect(codigoIndicacao("user-aaa")).toBe("ORK-" + hex("user-aaa"));
  });

  it("num servidor white-label o prefixo é da marca, e só o prefixo muda", () => {
    const { codigoIndicacao } = comMarca("HUB Triunfo Transbrasiliana");
    const cod = codigoIndicacao("user-aaa");
    expect(cod).toBe("HUB-" + hex("user-aaa"));
    expect(cod).not.toContain("ORK");
  });

  it("código ANTIGO, já compartilhado, continua resolvendo a pessoa certa", async () => {
    const { registrarIndicacao } = comMarca("HUB Triunfo Transbrasiliana");
    const h = hex("user-aaa");
    for (const entrada of [`ORK-${h}`, `ork-${h.toLowerCase()}`, `HUB-${h}`, `HUB${h}`, h]) {
      expect(await registrarIndicacao(prismaFake(), entrada, "user-bbb")).toBe("Leticia");
    }
  });

  it("o WhatsApp reconhece o código solto nas duas formas", () => {
    const { pareceCodigoIndicacao } = comMarca("HUB Triunfo Transbrasiliana");
    const h = hex("user-aaa");
    expect(pareceCodigoIndicacao(`ORK-${h}`)).toBe(true);
    expect(pareceCodigoIndicacao(`HUB-${h}`)).toBe(true);
    expect(pareceCodigoIndicacao("bom dia")).toBe(false);
  });

  it("as recusas de sempre continuam de pé", async () => {
    const { registrarIndicacao } = comMarca("HUB Triunfo Transbrasiliana");
    const h = hex("user-aaa");
    expect(await registrarIndicacao(prismaFake(), `HUB-000000`, "user-bbb")).toBeNull();
    expect(await registrarIndicacao(prismaFake(), `HUB-${h}`, "user-aaa")).toBeNull();
    expect(await registrarIndicacao(prismaFake({ id: "x" }), `HUB-${h}`, "user-bbb")).toBeNull();
  });
});
