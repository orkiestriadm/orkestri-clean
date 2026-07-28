import { sincronizarSituacao, ativoFromStatus } from "./collaborators.module";

/**
 * `ativo` (legado, consumido por Capacidade e Squads) e `status` (canônico do
 * People) descrevem a mesma coisa. Se divergirem, o perfil mostra "Ativo"
 * enquanto a capacidade exclui a pessoa — e ninguém entende por quê.
 */
describe("sincronização de ativo e status", () => {
  it("status manda quando os dois vêm", () => {
    expect(sincronizarSituacao({ status: "AFASTADO", ativo: true }))
      .toEqual({ status: "AFASTADO", ativo: false });
  });

  it("deriva ativo a partir do status", () => {
    expect(sincronizarSituacao({ status: "ATIVO" })).toEqual({ status: "ATIVO", ativo: true });
    expect(sincronizarSituacao({ status: "DESLIGADO" })).toEqual({ status: "DESLIGADO", ativo: false });
    expect(sincronizarSituacao({ status: "SUSPENSO" })).toEqual({ status: "SUSPENSO", ativo: false });
  });

  // Este é o caminho que causava a divergência: cliente legado manda só `ativo`.
  it("deriva status a partir de ativo quando só ele vem", () => {
    expect(sincronizarSituacao({ ativo: false })).toEqual({ ativo: false, status: "INATIVO" });
    expect(sincronizarSituacao({ ativo: true })).toEqual({ ativo: true, status: "ATIVO" });
  });

  // Desativar não é desligar: desligamento exige data e passa pelo endpoint
  // próprio, com regra de transição.
  it("desativar pelo caminho legado gera INATIVO, nunca DESLIGADO", () => {
    expect(sincronizarSituacao({ ativo: false }).status).toBe("INATIVO");
  });

  it("não mexe em nada quando nenhum dos dois vem", () => {
    expect(sincronizarSituacao({})).toEqual({});
  });

  it("nunca devolve os dois campos incoerentes", () => {
    const casos = [
      { status: "ATIVO" }, { status: "INATIVO" }, { status: "AFASTADO" },
      { status: "DESLIGADO" }, { status: "SUSPENSO" },
      { ativo: true }, { ativo: false },
      { status: "ATIVO", ativo: false }, { status: "DESLIGADO", ativo: true },
    ];
    for (const caso of casos) {
      const r = sincronizarSituacao(caso) as { status?: string; ativo?: boolean };
      if (r.status === undefined) continue;
      expect(r.ativo).toBe(ativoFromStatus(r.status));
    }
  });
});
