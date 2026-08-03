import {
  ANOS_GUARDA_PADRAO, avaliarElegibilidade, valoresAnonimos,
} from "./privacidade.entity";

/**
 * O erro caro aqui é liberar cedo, não tarde.
 *
 * Guardar dado além do necessário é uma não-conformidade que se corrige
 * apagando depois. Apagar antes do prazo destrói a prova que a empresa usaria
 * para se defender numa reclamação trabalhista, e isso não se corrige. Por
 * isso todo caso duvidoso abaixo espera `elegivel: false`.
 */

const desligadoEm = (iso: string) => ({
  status: "DESLIGADO",
  dataDesligamento: new Date(`${iso}T00:00:00.000Z`),
  anonimizadoEm: null,
});

const HOJE = new Date(2026, 7, 3); // 03/08/2026, hora local

describe("avaliarElegibilidade", () => {
  it("libera quem passou do prazo de guarda", () => {
    const r = avaliarElegibilidade(desligadoEm("2020-01-10"), HOJE);
    expect(r.elegivel).toBe(true);
    expect(r.motivo).toBeNull();
    expect(r.diasParaLiberar).toBeLessThan(0);
  });

  it("segura quem ainda está dentro do prazo, e diz quando libera", () => {
    const r = avaliarElegibilidade(desligadoEm("2024-06-01"), HOJE);
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("dentro_do_prazo");
    expect(r.liberaEm?.getFullYear()).toBe(2029);
    expect(r.diasParaLiberar).toBeGreaterThan(0);
  });

  it("no dia exato em que o prazo vence, já libera", () => {
    // Cinco anos cravados: o prazo prescricional terminou, e adiar um dia por
    // causa de um `>` no lugar de `>=` seria arbitrário.
    const r = avaliarElegibilidade(desligadoEm("2021-08-03"), HOJE);
    expect(r.elegivel).toBe(true);
    expect(r.diasParaLiberar).toBe(0);
  });

  it("um dia antes, ainda não", () => {
    const r = avaliarElegibilidade(desligadoEm("2021-08-04"), HOJE);
    expect(r.elegivel).toBe(false);
    expect(r.diasParaLiberar).toBe(1);
  });

  it("não libera quem está na ativa, por mais antigo que seja", () => {
    const r = avaliarElegibilidade(
      { status: "ATIVO", dataDesligamento: null, anonimizadoEm: null }, HOJE,
    );
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("nao_desligado");
  });

  // O caso que a omissão resolveria errado: sem data, "0 anos desde o
  // desligamento" seria a leitura ingênua, e ela apagaria o cadastro na hora.
  it("não libera desligado SEM data — é buraco de cadastro, não permissão", () => {
    const r = avaliarElegibilidade(
      { status: "DESLIGADO", dataDesligamento: null, anonimizadoEm: null }, HOJE,
    );
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("sem_data_desligamento");
  });

  it("não repete quem já foi anonimizado", () => {
    const r = avaliarElegibilidade(
      { ...desligadoEm("2015-01-01"), anonimizadoEm: new Date() }, HOJE,
    );
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe("ja_anonimizado");
  });

  it("respeita um prazo de guarda maior que o padrão", () => {
    // Organizações com obrigação setorial mais longa: o prazo é parâmetro.
    const r = avaliarElegibilidade(desligadoEm("2020-01-10"), HOJE, 10);
    expect(r.elegivel).toBe(false);
    expect(r.liberaEm?.getFullYear()).toBe(2030);
  });

  it("o padrão são cinco anos, a prescrição trabalhista", () => {
    expect(ANOS_GUARDA_PADRAO).toBe(5);
  });
});

describe("valoresAnonimos", () => {
  it("substitui em vez de esvaziar o nome", () => {
    // Nulo seria ambíguo: dado apagado ou nunca preenchido? O rótulo distingue.
    const v = valoresAnonimos("a1b2c3d4");
    expect(v.nomeCompleto).toContain("anonimizado");
    expect(v.nomeCompleto).toContain("a1b2c3d4");
  });

  it("desfaz o vínculo com o login", () => {
    // Manter o userId permitiria voltar ao nome pela tabela de usuários — a
    // anonimização seria só aparente.
    expect(valoresAnonimos("x").userId).toBeNull();
  });

  it("elimina todo identificador direto", () => {
    const v = valoresAnonimos("x") as Record<string, unknown>;
    for (const campo of [
      "emailPessoal", "emailCorporativo", "celular", "telefone",
      "dataNascimento", "fotoUrl", "matricula",
    ]) {
      expect(v[campo]).toBeNull();
    }
  });
});
