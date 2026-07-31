import { AuditService } from "./audit.module";

/**
 * A trilha de auditoria ficou vazia por meses sem ninguém notar: o método não
 * enviava `organizationId` (coluna NOT NULL), o insert falhava, e um `catch {}`
 * vazio engolia o erro. Estes testes existem para que isso não se repita em
 * silêncio.
 */
describe("AuditService", () => {
  function montar(create: jest.Mock = jest.fn()) {
    const prisma = { auditLog: { create } } as any;
    const service = new AuditService(prisma);
    // O logger é ruído no output do teste; o que importa é que foi chamado.
    const erro = jest.spyOn((service as any).logger, "error").mockImplementation(() => {});
    return { service, create, erro };
  }

  const evento = {
    organizationId: "org-1",
    userId: "user-1",
    modulo: "people",
    tabela: "collaborators",
    registroId: "c-1",
    acao: "criar",
    descricao: "Colaborador cadastrado",
  };

  it("grava o evento com organizationId — o campo que faltava", async () => {
    const { service, create } = montar();
    await service.log(evento);

    expect(create).toHaveBeenCalledTimes(1);
    const enviado = create.mock.calls[0][0].data;
    expect(enviado.organizationId).toBe("org-1");
    expect(enviado.tabela).toBe("collaborators");
    expect(enviado.acao).toBe("criar");
    expect(enviado.id).toEqual(expect.any(String));
  });

  it("normaliza campos opcionais ausentes para null", async () => {
    const { service, create } = montar();
    await service.log({
      organizationId: "org-1", tabela: "t", registroId: "r", acao: "a",
    });

    const enviado = create.mock.calls[0][0].data;
    expect(enviado.userId).toBeNull();
    expect(enviado.modulo).toBeNull();
    expect(enviado.dados).toBeNull();
    expect(enviado.ip).toBeNull();
  });

  // Sem organização o insert falharia de qualquer forma (coluna NOT NULL).
  // Recusar antes deixa o motivo explícito no log em vez de virar erro do banco.
  it("recusa evento sem organizationId e registra o motivo", async () => {
    const { service, create, erro } = montar();
    await service.log({ ...evento, organizationId: "" });

    expect(create).not.toHaveBeenCalled();
    expect(erro).toHaveBeenCalled();
  });

  it("falha de gravação não derruba a operação de negócio", async () => {
    const create = jest.fn().mockRejectedValue(new Error("banco fora do ar"));
    const { service, erro } = montar(create);

    // A operação que originou o evento não pode ser desfeita porque a
    // auditoria falhou.
    await expect(service.log(evento)).resolves.toBeUndefined();
    expect(erro).toHaveBeenCalled();
  });

  // Este é o comportamento que causou o problema original.
  it("falha de gravação NÃO passa em silêncio", async () => {
    const create = jest.fn().mockRejectedValue(new Error("qualquer erro"));
    const { service, erro } = montar(create);

    await service.log(evento);

    expect(erro).toHaveBeenCalledTimes(1);
    const [mensagem] = erro.mock.calls[0];
    expect(String(mensagem)).toContain("collaborators");
    expect(String(mensagem)).toContain("c-1");
  });
});
