import {
  collaboratorDisplayName,
  hasSystemAccess,
  absenceDaysByCollaborator,
} from "./collaborator";

describe("collaboratorDisplayName", () => {
  it("prefere o nome próprio do colaborador", () => {
    expect(
      collaboratorDisplayName({ nomeCompleto: "Maria Oliveira", user: { nome: "maria.o" } }),
    ).toBe("Maria Oliveira");
  });

  it("cai para o nome do usuário quando não há nome próprio", () => {
    expect(collaboratorDisplayName({ nomeCompleto: null, user: { nome: "Carlos Mendes" } }))
      .toBe("Carlos Mendes");
  });

  // Este é o caso que motiva o helper: colaborador sem acesso ao sistema.
  // Antes da Fase 1 do People, `collab.user.nome` estourava TypeError aqui.
  it("não quebra quando o colaborador não tem usuário vinculado", () => {
    expect(collaboratorDisplayName({ nomeCompleto: "João Silva", user: null }))
      .toBe("João Silva");
  });

  it("trata nome próprio em branco como ausente", () => {
    expect(collaboratorDisplayName({ nomeCompleto: "   ", user: { nome: "Ana Santos" } }))
      .toBe("Ana Santos");
  });

  it("devolve rótulo neutro quando não há nenhum nome", () => {
    expect(collaboratorDisplayName({ nomeCompleto: null, user: null })).toBe("Sem nome");
  });

  it("devolve travessão para colaborador inexistente", () => {
    expect(collaboratorDisplayName(null)).toBe("—");
    expect(collaboratorDisplayName(undefined)).toBe("—");
  });
});

describe("absenceDaysByCollaborator", () => {
  // Julho/2026: dia 1 é quarta, dia 6 é segunda, 11 e 12 são fim de semana.
  const inicioMes = new Date("2026-07-01T00:00:00");
  const fimMes = new Date("2026-07-31T23:59:59");

  const ausencia = (id: string, de: string, ate: string) => ({
    collaborator: { id },
    dataInicio: new Date(`${de}T00:00:00`),
    dataFim: new Date(`${ate}T23:59:59`),
  });

  it("conta apenas dias úteis", () => {
    // Seg 06 a Sex 10 = 5 dias úteis
    const r = absenceDaysByCollaborator([ausencia("c1", "2026-07-06", "2026-07-10")], inicioMes, fimMes);
    expect(r.get("c1")).toBe(5);
  });

  it("descarta sábado e domingo no meio do período", () => {
    // Seg 06 a Seg 13 = 10 dias corridos, mas 11 (sáb) e 12 (dom) não contam
    const r = absenceDaysByCollaborator([ausencia("c1", "2026-07-06", "2026-07-13")], inicioMes, fimMes);
    expect(r.get("c1")).toBe(6);
  });

  it("soma múltiplas ausências do mesmo colaborador", () => {
    const r = absenceDaysByCollaborator(
      [ausencia("c1", "2026-07-06", "2026-07-07"), ausencia("c1", "2026-07-09", "2026-07-10")],
      inicioMes, fimMes,
    );
    expect(r.get("c1")).toBe(4);
  });

  it("recorta ausência que começa antes da janela", () => {
    // Começou em junho, mas só os dias úteis de julho contam
    const r = absenceDaysByCollaborator([ausencia("c1", "2026-06-20", "2026-07-03")], inicioMes, fimMes);
    expect(r.get("c1")).toBe(3); // qua 01, qui 02, sex 03
  });

  // Regressão: antes o mapa era chaveado por userId. Dois colaboradores sem
  // usuário compartilhavam a chave nula e somavam os dias um do outro.
  it("mantém colaboradores separados — inclusive sem usuário vinculado", () => {
    const r = absenceDaysByCollaborator(
      [ausencia("sem-login-1", "2026-07-06", "2026-07-10"), ausencia("sem-login-2", "2026-07-06", "2026-07-07")],
      inicioMes, fimMes,
    );
    expect(r.get("sem-login-1")).toBe(5);
    expect(r.get("sem-login-2")).toBe(2);
  });

  it("ignora ausência órfã em vez de agrupá-la numa chave vazia", () => {
    const r = absenceDaysByCollaborator(
      [{ collaborator: null, dataInicio: new Date("2026-07-06"), dataFim: new Date("2026-07-10") }],
      inicioMes, fimMes,
    );
    expect(r.size).toBe(0);
  });

  it("devolve mapa vazio quando não há ausências", () => {
    expect(absenceDaysByCollaborator([], inicioMes, fimMes).size).toBe(0);
  });
});

describe("hasSystemAccess", () => {
  it("identifica colaborador com login", () => {
    expect(hasSystemAccess({ userId: "user-1" })).toBe(true);
  });

  it("identifica colaborador sem login", () => {
    expect(hasSystemAccess({ userId: null })).toBe(false);
    expect(hasSystemAccess({})).toBe(false);
    expect(hasSystemAccess(null)).toBe(false);
  });
});
