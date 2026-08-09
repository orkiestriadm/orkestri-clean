import { NotificacaoDispatcher } from "./notificacao-dispatcher.service";

/**
 * Testes da REGRA de destinatário, com Prisma dublado.
 *
 * O que se protege aqui é o comportamento que o usuário pediu — "quem é de
 * Frotas não pode receber mensagem de Projetos" — e as duas barreiras que o
 * sustentam. Uma regressão nisso não aparece na tela: a pessoa só para de
 * receber (ou passa a receber demais), e ninguém percebe até dar problema.
 */

const ORG = "org-1";
const USER = "user-1";

function montarPrisma(over: any = {}) {
  const criadas: any[] = [];
  const enfileiradas: any[] = [];

  const db: any = {
    notificacaoPreferencia: {
      findMany: jest.fn().mockResolvedValue(over.prefs ?? []),
    },
    user: {
      findMany: jest.fn().mockResolvedValue(over.users ?? []),
    },
    notification: {
      create: jest.fn().mockImplementation(async (a: any) => { criadas.push(a.data); return a.data; }),
    },
    notificacaoEnvio: {
      create: jest.fn().mockImplementation(async (a: any) => { enfileiradas.push(a.data); return a.data; }),
    },
    orgNotificacaoConfig: {
      findUnique: jest.fn().mockResolvedValue(over.cfg ?? null),
    },
  };
  return { db, criadas, enfileiradas };
}

const usuarioPadrao = (over: any = {}) => ({
  id: USER,
  email: "a@b.com",
  profile: {
    whatsapp: "5511999999999",
    whatsappVerificado: true,
    modulos: "[]",          // vazio = vê tudo
    ...over.profile,
  },
  ...over,
});

const prefPadrao = (over: any = {}) => ({
  userId: USER, modulo: "fleet",
  sistema: true, whatsapp: true, email: false,
  severidadeMin: "info",
  ...over,
});

const pedido = (over: any = {}) => ({
  organizationId: ORG, modulo: "fleet", tipo: "teste",
  titulo: "T", mensagem: "M", ...over,
});

describe("NotificacaoDispatcher", () => {
  it("NEGA por padrão: sem preferência, ninguém recebe", async () => {
    const { db } = montarPrisma({ prefs: [] });
    const d = new NotificacaoDispatcher(db);
    const r = await d.despachar(pedido());
    expect(r).toEqual({ sistema: 0, whatsapp: 0, email: 0 });
  });

  it("entrega no módulo configurado", async () => {
    const { db } = montarPrisma({ prefs: [prefPadrao()], users: [usuarioPadrao()] });
    const d = new NotificacaoDispatcher(db);
    const r = await d.despachar(pedido());
    expect(r.sistema).toBe(1);
    expect(r.whatsapp).toBe(1);
  });

  it("ISOLA entre módulos — preferência de fleet não vale para projects", async () => {
    // A consulta é filtrada por módulo; o dublê devolve vazio para outro módulo.
    const { db } = montarPrisma({ prefs: [], users: [usuarioPadrao()] });
    const d = new NotificacaoDispatcher(db);
    const r = await d.despachar(pedido({ modulo: "projects" }));
    expect(r.sistema).toBe(0);
    expect(db.notificacaoPreferencia.findMany)
      .toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ modulo: "projects" }) }));
  });

  it("2ª barreira: sem ACESSO ao módulo não recebe, mesmo com preferência", async () => {
    // Cenário real: o master configurou, e depois a pessoa perdeu o módulo.
    // A preferência continua lá; o acesso é que manda.
    const { db } = montarPrisma({
      prefs: [prefPadrao()],
      users: [usuarioPadrao({ profile: { modulos: '["projetos"]' } })],
    });
    const d = new NotificacaoDispatcher(db);
    const r = await d.despachar(pedido());
    expect(r.sistema).toBe(0);
  });

  it("número NÃO verificado bloqueia WhatsApp mas não o sino", async () => {
    const { db } = montarPrisma({
      prefs: [prefPadrao()],
      users: [usuarioPadrao({ profile: { whatsappVerificado: false } })],
    });
    const d = new NotificacaoDispatcher(db);
    const r = await d.despachar(pedido());
    expect(r.whatsapp).toBe(0);
    expect(r.sistema).toBe(1);
  });

  it("respeita a severidade mínima", async () => {
    const { db } = montarPrisma({
      prefs: [prefPadrao({ severidadeMin: "critico" })],
      users: [usuarioPadrao()],
    });
    const d = new NotificacaoDispatcher(db);
    expect((await d.despachar(pedido({ severidade: "aviso" }))).sistema).toBe(0);
    expect((await d.despachar(pedido({ severidade: "critico" }))).sistema).toBe(1);
  });

  it("usuário inativo/removido é ignorado sem quebrar", async () => {
    const { db } = montarPrisma({ prefs: [prefPadrao()], users: [] });
    const d = new NotificacaoDispatcher(db);
    const r = await d.despachar(pedido());
    expect(r.sistema).toBe(0);
  });

  it("grava o módulo na notificação do sino", async () => {
    const { db, criadas } = montarPrisma({ prefs: [prefPadrao()], users: [usuarioPadrao()] });
    const d = new NotificacaoDispatcher(db);
    await d.despachar(pedido());
    expect(criadas[0]).toEqual(expect.objectContaining({ modulo: "fleet" }));
  });

  it("chave de de-dup inclui canal e usuário", async () => {
    // Sem isso, um evento com a mesma chave só chegaria à primeira pessoa: a
    // unique (org, chave) barraria as demais.
    const { db, enfileiradas } = montarPrisma({ prefs: [prefPadrao()], users: [usuarioPadrao()] });
    const d = new NotificacaoDispatcher(db);
    await d.despachar(pedido({ chave: "evt::1" }));
    expect(enfileiradas[0].chave).toBe(`evt::1::whatsapp::${USER}`);
  });

  describe("horário de silêncio", () => {
    /**
     * Janela que cobre QUALQUER hora, para o teste não depender do relógio.
     *
     * Era `silencioFim: 23`, mas o fim é exclusivo (`h < fim`), então as 23h
     * ficavam de fora: o teste falhava entre 23:00 e 23:59 e passava nas
     * outras vinte e três horas do dia. O comportamento em si está correto —
     * a janela real (21h → 7h) cruza a meia-noite e é tratada à parte.
     */
    const comSilencio = (over: any = {}) => ({
      silencioInicio: 0, silencioFim: 24, silencioIgnoraCritico: true,
      maxPorMinuto: 12, agruparPorModulo: true, ...over,
    });

    it("adia o não-crítico dentro da janela", async () => {
      const { db, enfileiradas } = montarPrisma({
        prefs: [prefPadrao()], users: [usuarioPadrao()], cfg: comSilencio(),
      });
      const d = new NotificacaoDispatcher(db);
      await d.despachar(pedido({ severidade: "aviso" }));
      expect(enfileiradas[0].agendadoPara).toBeInstanceOf(Date);
    });

    it("crítico fura o silêncio quando configurado", async () => {
      const { db, enfileiradas } = montarPrisma({
        prefs: [prefPadrao()], users: [usuarioPadrao()], cfg: comSilencio(),
      });
      const d = new NotificacaoDispatcher(db);
      await d.despachar(pedido({ severidade: "critico" }));
      expect(enfileiradas[0].agendadoPara).toBeNull();
    });

    it("horas iguais = silêncio desligado", async () => {
      const { db, enfileiradas } = montarPrisma({
        prefs: [prefPadrao()], users: [usuarioPadrao()],
        cfg: comSilencio({ silencioInicio: 8, silencioFim: 8 }),
      });
      const d = new NotificacaoDispatcher(db);
      await d.despachar(pedido({ severidade: "info" }));
      expect(enfileiradas[0].agendadoPara).toBeNull();
    });
  });

  describe("enfileirarDireto — usado por Chamados, Automações e Workflows", () => {
    it("enfileira sem consultar preferência", async () => {
      const { db, enfileiradas } = montarPrisma();
      const d = new NotificacaoDispatcher(db);
      const ok = await d.enfileirarDireto({
        organizationId: ORG, canal: "whatsapp", destino: "5511988887777",
        modulo: "service", tipo: "chamado_aberto", titulo: "Chamado", mensagem: "*texto*",
      });
      expect(ok).toBe(true);
      expect(db.notificacaoPreferencia.findMany).not.toHaveBeenCalled();
      expect(enfileiradas[0].destino).toBe("5511988887777");
    });

    it("recusa destino vazio", async () => {
      const { db } = montarPrisma();
      const d = new NotificacaoDispatcher(db);
      expect(await d.enfileirarDireto({
        organizationId: ORG, canal: "whatsapp", destino: "",
        modulo: "service", tipo: "x", titulo: "t", mensagem: "m",
      })).toBe(false);
    });
  });
});
