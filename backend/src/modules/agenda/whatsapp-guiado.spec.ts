import { WhatsappGuiadoService } from "./whatsapp-guiado.service";
import {
  camposGuia,
  validarCampo,
  diaGuia,
} from "./whatsapp-guiado-formularios";
import {
  parseComandoEvento,
  parseComandoGasto,
} from "./whatsapp-inbound.module";
import { WhatsappEquipeService } from "./whatsapp-equipe.service";

const user = { id: "u1", organizationId: "org1", nome: "Pessoa Teste" };
function setup(perms = ["*"]) {
  let state: any = null;
  const model = () => ({
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: "salvo" }),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  });
  const db: any = {
    note: model(),
    event: model(),
    gasto: model(),
    dailyTask: model(),
    project: model(),
    task: model(),
    user: model(),
    contaPagar: model(),
  };
  db.$executeRaw = jest.fn(async (sql: any, ...values: any[]) => {
    const q = sql.join("");
    if (q.includes("INSERT INTO whatsapp_inicio"))
      state = { etapa: values[3], dados: JSON.parse(values[4]) };
    if (q.includes("DELETE FROM whatsapp_inicio")) state = null;
    if (q.includes("etapa='GUIA_REVISAR'"))
      state = { etapa: "GUIA_REVISAR", dados: { fase: "REVISAR", v: {} } };
    return 1;
  });
  db.$queryRaw = jest.fn(async () =>
    state ? [JSON.parse(JSON.stringify(state))] : [],
  );
  db.$transaction = jest.fn(async (fn: any) => fn(db));
  const wa: any = { sendToJid: jest.fn().mockResolvedValue(true) };
  const auth: any = { resolvePermissions: jest.fn().mockResolvedValue(perms) };
  const equipe: any = {
    executarGuiado: jest.fn().mockResolvedValue(undefined),
  };
  const wb: any = {
    onEventCreated: jest.fn().mockResolvedValue(undefined),
    onEventUpdated: jest.fn().mockResolvedValue(undefined),
    onEventDeleted: jest.fn().mockResolvedValue(undefined),
  };
  const service = new WhatsappGuiadoService(db, wa, auth, equipe, wb);
  const ports: any = {
    evento: (t: string) => parseComandoEvento("Evento: " + t, new Date()),
    gasto: (t: string) => parseComandoGasto(t, new Date(), true),
    outro: jest.fn().mockResolvedValue(undefined),
  };
  const say = (t: string) => service.tratar(user, t, "chat", "inst", ports);
  const text = () => wa.sendToJid.mock.calls.at(-1)?.[1] || "";
  return {
    db,
    wa,
    auth,
    equipe,
    wb,
    service,
    ports,
    say,
    text,
    state: () => state,
  };
}
describe("Aurélia guiada", () => {
  it("mostra nomes de ações e só recursos permitidos", async () => {
    const s = setup(["keep:ver", "keep:criar"]);
    await s.say("menu");
    expect(s.text()).toContain("Anotações");
    expect(s.text()).not.toContain("Meus gastos");
    expect(s.text()).not.toContain("Keep");
  });
  it("anota com uma pergunta e só salva após confirmação", async () => {
    const s = setup();
    for (const t of ["menu", "2", "1", "Comprar pilhas"]) await s.say(t);
    expect(s.db.note.create).not.toHaveBeenCalled();
    expect(s.text()).toContain("Confirmar");
    await s.say("1");
    expect(s.db.note.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org1",
        userId: "u1",
        conteudo: "Comprar pilhas",
      }),
    });
  });
  it("corrige um campo sem perder os demais e permite voltar", async () => {
    const s = setup();
    for (const t of ["menu", "3", "1", "Mercado", "48,90", "1", "hoje"])
      await s.say(t);
    expect(s.text()).toContain("48,90");
    for (const t of ["2", "2", "55,90"]) await s.say(t);
    expect(s.text()).toContain("Mercado");
    expect(s.text()).toContain("55,90");
    expect(s.text()).toContain("Pix");
    await s.say("voltar");
    expect(s.state().dados.fase).toBe("FORM");
    expect(s.db.gasto.create).not.toHaveBeenCalled();
  });
  it("rejeita dinheiro inválido e preserva a descrição", async () => {
    const s = setup();
    for (const t of ["menu", "3", "1", "Mercado", "abc"]) await s.say(t);
    expect(s.text()).toContain("valor total");
    expect(s.state().dados.v.descricao).toBe("Mercado");
    expect(s.db.gasto.create).not.toHaveBeenCalled();
  });
  it("pergunta parcelas apenas no crédito e salva total e valor da parcela", async () => {
    const s = setup();
    for (const t of [
      "menu",
      "3",
      "1",
      "Televisão",
      "1200",
      "2",
      "12",
      "hoje",
      "1",
    ])
      await s.say(t);
    expect(s.db.gasto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        valor: 1200,
        parcelas: 12,
        valorParcela: 100,
        formaPagamento: "CREDITO",
      }),
    });
  });
  it("cria compromisso e envia ao sincronizador depois de confirmar", async () => {
    const s = setup();
    for (const t of ["menu", "1", "1", "Dentista", "amanhã às 14h", "60", "1"])
      await s.say(t);
    expect(s.db.event.create).not.toHaveBeenCalled();
    await s.say("1");
    expect(s.db.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        titulo: "Dentista",
        userId: "u1",
        organizationId: "org1",
      }),
    });
    expect(s.wb.onEventCreated).toHaveBeenCalledWith("salvo");
  });
  it("retoma a conversa em outra instância do serviço", async () => {
    const s = setup();
    for (const t of ["menu", "2", "1"]) await s.say(t);
    const outro = new WhatsappGuiadoService(s.db, s.wa, s.auth, s.equipe, s.wb);
    await outro.tratar(user, "Lembrar de estudar", "chat", "inst", s.ports);
    expect(s.text()).toContain("Lembrar de estudar");
    expect(s.db.note.create).not.toHaveBeenCalled();
  });
  it("não interpreta número de outro menu se não há diálogo aberto", async () => {
    const s = setup();
    expect(await s.say("1")).toBe(false);
  });
  it("cancelar não executa a operação e 0 encerra a conversa", async () => {
    const s = setup();
    for (const t of ["menu", "2", "1", "Nota temporária", "cancelar", "0"])
      await s.say(t);
    expect(s.state()).toBeNull();
    expect(s.db.note.create).not.toHaveBeenCalled();
  });
  it("permissão revogada antes da confirmação impede escrita", async () => {
    const s = setup();
    for (const t of ["menu", "2", "1", "Nota"]) await s.say(t);
    s.auth.resolvePermissions.mockResolvedValue(["keep:ver"]);
    await s.say("1");
    expect(s.db.note.create).not.toHaveBeenCalled();
    expect(s.text()).toContain("acesso mudou");
  });
  it("lista em páginas e não mostra códigos internos", async () => {
    const s = setup();
    const rows = Array.from({ length: 6 }, (_, i) => ({
      id: "uuid-" + i,
      titulo: "Nota " + i,
      conteudo: "Conteúdo",
      atualizadoEm: new Date(),
      tipo: "TEXTO",
    }));
    s.db.note.findMany
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce([rows[5]]);
    for (const t of ["menu", "2", "2"]) await s.say(t);
    expect(s.text()).toContain("Próxima página");
    expect(s.text()).not.toContain("uuid-");
    await s.say("8");
    expect(s.db.note.findMany.mock.calls[1][0]).toMatchObject({
      skip: 5,
      take: 6,
      where: { userId: "u1", organizationId: "org1" },
    });
    expect(s.text()).toContain("Nota 5");
  });
  it("seleciona pessoa por número e mantém a identidade dentro do estado", async () => {
    const s = setup();
    s.db.project.findMany.mockResolvedValue([
      { id: "proj", titulo: "Casa", atualizadoEm: new Date() },
    ]);
    s.db.project.findFirst.mockResolvedValue({ id: "proj", criadoPorId: "u1" });
    s.db.user.findMany.mockResolvedValue([{ id: "u2", nome: "Maria" }]);
    for (const t of [
      "menu",
      "4",
      "2",
      "1",
      "2",
      "Pintar sala",
      "pular",
      "amanhã",
    ])
      await s.say(t);
    expect(s.text()).toContain("*1* — Maria");
    expect(s.text()).not.toContain("u2");
    await s.say("1");
    expect(s.state().dados.v.assigneeId).toBe("u2");
    expect(s.text()).toContain("Responsável: Maria");
    expect(s.equipe.executarGuiado).not.toHaveBeenCalled();
    await s.say("1");
    expect(s.equipe.executarGuiado).toHaveBeenCalledWith(
      user,
      "demanda.criar",
      expect.objectContaining({ projectId: "proj", assigneeId: "u2" }),
    );
  });
  it("falha após início não repete automaticamente a operação", async () => {
    const s = setup();
    for (const t of ["menu", "2", "1", "Minha nota"]) await s.say(t);
    s.db.note.create.mockRejectedValue(new Error("falha"));
    await expect(s.say("1")).rejects.toThrow("revisão");
    expect(s.state().dados.fase).toBe("REVISAR");
    await s.say("1");
    expect(s.db.note.create).toHaveBeenCalledTimes(1);
  });
  it("comando antigo também apresenta prévia antes de criar", async () => {
    const s = setup();
    await s.say("Gasto: Mercado 150 pix");
    expect(s.text()).toContain("Confirmar");
    expect(s.db.gasto.create).not.toHaveBeenCalled();
  });
  it("deixa comandos de acesso saírem do diálogo sem virar anotação", async () => {
    const s = setup();
    for (const t of ["menu", "2", "1"]) await s.say(t);
    expect(await s.say("acesso")).toBe(false);
    expect(s.db.note.create).not.toHaveBeenCalled();
  });
  it("explica precisamente as opções avançadas do site", async () => {
    const s = setup();
    for (const t of ["menu", "6", "6"]) await s.say(t);
    expect(s.text()).toContain("anexos");
    expect(s.text()).toContain("https://www.orkiestri.com/login");
    expect(s.text()).toContain("Como posso ajudar");
  });
});
describe("Datas e valores guiados", () => {
  it('voltar retorna à escolha de ação e de campo sem reiniciar o menu',async()=>{
    const s=setup();s.db.note.findMany.mockResolvedValue([{id:'n',titulo:'Nota',conteudo:'Texto',tipo:'TEXTO',atualizadoEm:new Date()}]);
    for(const t of ['menu','2','2','1','1'])await s.say(t);
    expect(s.state().dados.fase).toBe('CORRIGIR');await s.say('voltar');expect(s.state().dados.fase).toBe('ITEM');expect(s.text()).toContain('*1* — Alterar');
    for(const t of ['1','1'])await s.say(t);expect(s.state().dados.fase).toBe('FORM');await s.say('voltar');expect(s.state().dados.fase).toBe('CORRIGIR');expect(s.text()).toContain('Anotação');
    expect(s.db.note.updateMany).not.toHaveBeenCalled();
  });
  it('não anuncia edição de lista com caixas de seleção como anotação de texto',async()=>{
    const s=setup();s.db.note.findMany.mockResolvedValue([{id:'lista',titulo:'Compras',tipo:'CHECKLIST',conteudo:null,atualizadoEm:new Date()}]);
    for(const t of ['menu','2','2','1'])await s.say(t);
    expect(s.text()).toContain('caixas de seleção');expect(s.text()).not.toContain('*1* — Alterar');await s.say('1');expect(s.text()).toContain('/login');expect(s.db.note.updateMany).not.toHaveBeenCalled();
  });
  it.each(["31/02/2027", "29/02/2027", "32/12/2026"])(
    "não corrige data inválida %s",
    (t) => expect(diaGuia(t)).toBeNull(),
  );
  it("aceita moeda brasileira sem mudar separadores", () => {
    const campo = camposGuia("gasto.criar")[1];
    expect(validarCampo(campo, "1.250,90", () => null).valor).toBe(1250.9);
    expect(validarCampo(campo, "-50", () => null).erro).toBeTruthy();
  });
});
describe("Gateway de projetos guiados", () => {
  it("reconsulta vínculo e organização antes de chamar a API", async () => {
    const db: any = {
      project: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const svc: any = new WhatsappEquipeService(
      db,
      {} as any,
      { resolvePermissions: async () => ["*"] } as any,
    );
    svc.chamar = jest.fn();
    await expect(
      svc.executarGuiado(user, "demanda.criar", { projectId: "alheio" }),
    ).rejects.toThrow("indisponível");
    expect(db.project.findFirst.mock.calls[0][0].where.organizationId).toBe(
      "org1",
    );
    expect(svc.chamar).not.toHaveBeenCalled();
  });
});
