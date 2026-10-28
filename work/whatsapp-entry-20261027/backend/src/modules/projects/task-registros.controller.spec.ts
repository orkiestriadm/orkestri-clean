import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { TaskRegistrosController } from "./task-registros.controller";

/**
 * Keep da tarefa — quem lê, quem escreve, quem altera.
 *
 * O que erra em silêncio aqui é permissão: a rota pede só `projetos:ver`, então
 * a trava de escrita inteira mora no controller. Se ela afrouxar, qualquer um
 * com leitura no módulo escreve no relato de um projeto do qual não participa —
 * e nada na tela denuncia.
 */

const PROJETO = { id: "p1", criadoPorId: "criador", members: [{ userId: "membro" }, { userId: "autor" }] };

const req = (id: string, extra: Record<string, unknown> = {}) => ({ user: { id, organizationId: "org1", ...extra } });

function montar(o: { projeto?: any; task?: any; registro?: any } = {}) {
  const prisma: any = {
    project: { findFirst: jest.fn().mockResolvedValue(o.projeto === undefined ? PROJETO : o.projeto) },
    task: { findFirst: jest.fn().mockResolvedValue(o.task === undefined ? { id: "t1" } : o.task) },
    taskRegistro: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(o.registro ?? null),
      create: jest.fn(async ({ data }: any) => data),
      update: jest.fn(async ({ data }: any) => data),
      delete: jest.fn().mockResolvedValue({}),
    },
    taskRegistroItem: {
      findFirst: jest.fn().mockResolvedValue({ id: "i1", ordem: 0 }),
      create: jest.fn(async ({ data }: any) => data),
      update: jest.fn(async ({ data }: any) => data),
      delete: jest.fn().mockResolvedValue({}),
    },
  };
  return { ctl: new TaskRegistrosController(prisma), prisma };
}

const registroDo = (autorId: string, extra: Record<string, unknown> = {}) =>
  ({ id: "r1", autorId, conteudo: "fiz a coisa", _count: { itens: 0 }, ...extra });

describe("Keep da tarefa", () => {
  describe("escopo", () => {
    it("procura o projeto pela organização do token, não por id solto", async () => {
      const { ctl, prisma } = montar();
      await ctl.listar("p1", "t1", req("membro"));
      expect(prisma.project.findFirst.mock.calls[0][0].where).toEqual({ id: "p1", organizationId: "org1" });
    });

    it("projeto de outra organização responde 404, não 403", async () => {
      const { ctl } = montar({ projeto: null });
      await expect(ctl.listar("p1", "t1", req("membro"))).rejects.toBeInstanceOf(NotFoundException);
    });

    it("task que não é do projeto da URL responde 404", async () => {
      const { ctl } = montar({ task: null });
      await expect(ctl.criar("p1", "t-de-outro", { conteudo: "x" }, req("membro"))).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("quem escreve", () => {
    it("membro, criador e master podem; quem só vê o projeto, não", async () => {
      const { ctl } = montar();
      expect((await ctl.listar("p1", "t1", req("membro"))).podeEscrever).toBe(true);
      expect((await ctl.listar("p1", "t1", req("criador"))).podeEscrever).toBe(true);
      expect((await ctl.listar("p1", "t1", req("chefe", { isMaster: true }))).podeEscrever).toBe(true);
      expect((await ctl.listar("p1", "t1", req("de-fora"))).podeEscrever).toBe(false);
    });

    it("quem não faz parte leva 403 ao criar", async () => {
      const { ctl, prisma } = montar();
      await expect(ctl.criar("p1", "t1", { conteudo: "x" }, req("de-fora"))).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.taskRegistro.create).not.toHaveBeenCalled();
    });

    it("registro vazio é recusado — texto em branco e itens em branco não contam", async () => {
      const { ctl } = montar();
      await expect(ctl.criar("p1", "t1", { conteudo: "   ", itens: ["", "  "] }, req("membro"))).rejects.toBeInstanceOf(BadRequestException);
    });

    it("grava o autor do token, apara os itens e ignora cor fora da paleta", async () => {
      const { ctl, prisma } = montar();
      await ctl.criar("p1", "t1", { conteudo: " testei ", itens: [" a ", "", "b"], cor: "red" }, req("membro"));
      const data = prisma.taskRegistro.create.mock.calls[0][0].data;
      expect(data.autorId).toBe("membro");
      expect(data.conteudo).toBe("testei");
      expect(data.cor).toBeNull();
      expect(data.itens.create).toEqual([{ descricao: "a", ordem: 0 }, { descricao: "b", ordem: 1 }]);
    });
  });

  describe("quem altera", () => {
    it("outro membro não edita o registro de alguém", async () => {
      const { ctl } = montar({ registro: registroDo("autor") });
      await expect(ctl.editar("p1", "t1", "r1", { conteudo: "outra coisa" }, req("membro"))).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("master apaga registro de outro, mas não reescreve", async () => {
      const master = req("chefe", { isMaster: true });
      const { ctl, prisma } = montar({ registro: registroDo("autor") });
      await expect(ctl.editar("p1", "t1", "r1", { conteudo: "reescrito" }, master)).rejects.toBeInstanceOf(ForbiddenException);
      await ctl.apagar("p1", "t1", "r1", master);
      expect(prisma.taskRegistro.delete).toHaveBeenCalledWith({ where: { id: "r1" } });
    });

    it("autor que saiu do projeto não altera mais o que registrou", async () => {
      const semAutor = { ...PROJETO, members: [{ userId: "membro" }] };
      const { ctl } = montar({ projeto: semAutor, registro: registroDo("autor") });
      await expect(ctl.editar("p1", "t1", "r1", { conteudo: "x" }, req("autor"))).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("não deixa o registro ficar vazio: tirar o texto quando não há itens", async () => {
      const { ctl } = montar({ registro: registroDo("autor", { _count: { itens: 0 } }) });
      await expect(ctl.editar("p1", "t1", "r1", { conteudo: "" }, req("autor"))).rejects.toBeInstanceOf(BadRequestException);
    });

    it("não deixa o registro ficar vazio: tirar o último item quando não há texto", async () => {
      const { ctl, prisma } = montar({ registro: registroDo("autor", { conteudo: null, _count: { itens: 1 } }) });
      await expect(ctl.apagarItem("p1", "t1", "r1", "i1", req("autor"))).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.taskRegistroItem.delete).not.toHaveBeenCalled();
    });

    it("autor marca item do próprio registro", async () => {
      const { ctl, prisma } = montar({ registro: registroDo("autor") });
      await ctl.editarItem("p1", "t1", "r1", "i1", { concluido: true }, req("autor"));
      expect(prisma.taskRegistroItem.update.mock.calls[0][0]).toMatchObject({ where: { id: "i1" }, data: { concluido: true } });
    });

    it("item de outro registro responde 404", async () => {
      const { ctl, prisma } = montar({ registro: registroDo("autor") });
      prisma.taskRegistroItem.findFirst.mockResolvedValue(null);
      await expect(ctl.editarItem("p1", "t1", "r1", "i-alheio", { concluido: true }, req("autor"))).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
