import { Test } from "@nestjs/testing";
import { randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { PeopleModule } from "./people.module";
import { EmployeeService } from "./application/employee.service";
import { FeedbackDesempenhoService } from "./application/feedback-desempenho.service";
import { EmailService } from "../notifications/email.service";

/**
 * Avaliação de Desempenho › Feedback — o fluxo do RH contra o banco.
 *
 * As regras de etapa têm teste unitário (domain/feedback-desempenho.entity.spec.ts).
 * Este prova o que só aparece com banco: quem enxerga o quê, o texto escondido
 * do colaborador antes da reunião, a agenda, as notificações e a exclusão com
 * aprovação do RH.
 *
 *   GestorA ─┬─ Ana    (com login — recebe o feedback)
 *            └─ Bruno  (sem login — não pode receber)
 *   GestorB ─── Carla  (fora da árvore de GestorA)
 */

const DB = process.env.PEOPLE_IT_DATABASE_URL;
const descreve = DB ? describe : describe.skip;

descreve("People — feedback de desempenho", () => {
  let moduloRef: any;
  let prisma: any;
  let employees: EmployeeService;
  let svc: FeedbackDesempenhoService;

  const orgId = `fd-org-${randomUUID()}`;
  type Ctx = { id: string; organizationId: string; permissions: string[] };

  const GESTOR = [
    "people.colaborador:ver", "people.feedback_desempenho:ver", "people.feedback_desempenho:registrar",
  ];

  let rh: Ctx, gestorA: Ctx, gestorB: Ctx, ana: Ctx;
  const id = {} as Record<"gestorA" | "gestorB" | "ana" | "bruno" | "carla", string>;

  async function criarUsuario(nome: string, permissions: string[]): Promise<Ctx> {
    const u = await prisma.user.create({
      data: { id: `fd-user-${randomUUID()}`, organizationId: orgId, nome, email: `${randomUUID().slice(0, 8)}@fd.local`, senhaHash: "x" },
    });
    return { id: u.id, organizationId: orgId, permissions };
  }

  const notificacoes = (userId: string, tipo: string) =>
    prisma.notification.findMany({ where: { userId, tipo } });

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    moduloRef = await Test.createTestingModule({ imports: [PeopleModule] }).compile();
    await moduloRef.init();
    prisma = moduloRef.get(PrismaService);
    employees = moduloRef.get(EmployeeService);
    svc = moduloRef.get(FeedbackDesempenhoService);

    await prisma.organization.create({ data: { id: orgId, nome: "Feedback IT", slug: `fd-${randomUUID().slice(0, 8)}` } });

    rh = await criarUsuario("RH Aprovador", [
      "people.colaborador:ver_todos", "people.feedback_desempenho:ver", "people.feedback_desempenho:aprovar_exclusao",
    ]);
    gestorA = await criarUsuario("Gestor A", GESTOR);
    gestorB = await criarUsuario("Gestor B", GESTOR);
    ana = await criarUsuario("Ana", []);

    // O RH precisa ter a permissão NO BANCO: é por lá que se descobre a quem
    // mandar o pedido de exclusão (o JWT só existe durante a requisição).
    const perm = await prisma.permission.upsert({
      where: { recurso_acao: { recurso: "people.feedback_desempenho", acao: "aprovar_exclusao" } },
      create: { id: randomUUID(), recurso: "people.feedback_desempenho", acao: "aprovar_exclusao" },
      update: {},
    });
    const papel = await prisma.role.create({ data: { id: randomUUID(), organizationId: orgId, nome: "rh-it", nivel: 50 } });
    await prisma.rolePermission.create({ data: { roleId: papel.id, permissionId: perm.id } });
    await prisma.userRole.create({ data: { userId: rh.id, roleId: papel.id } });

    const nova = async (nomeCompleto: string, extra: Record<string, unknown> = {}) =>
      (await employees.criar(rh as any, { nomeCompleto, dataAdmissao: "2024-01-10", ...extra } as any)).data.id;

    id.gestorA = await nova("Gestor A", { userId: gestorA.id });
    id.gestorB = await nova("Gestor B", { userId: gestorB.id });
    id.ana     = await nova("Ana Liderada", { userId: ana.id, gestorId: id.gestorA });
    id.bruno   = await nova("Bruno Sem Login", { gestorId: id.gestorA });
    id.carla   = await nova("Carla de Fora", { gestorId: id.gestorB });
  }, 90_000);

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
    await moduloRef?.close().catch(() => {});
  }, 30_000);

  const registrar = (collaboratorId: string, quem: Ctx = gestorA) =>
    svc.criar(quem, { collaboratorId, pontosFortes: "Entrega com qualidade", oportunidades: "Comunicar atrasos antes" });

  describe("etapa 1 — registro", () => {
    it("gestor só pode escolher liderado com login", async () => {
      const r = await svc.colaboradoresElegiveis(gestorA);
      expect(r.data.map((c: any) => c.id)).toEqual([id.ana]);
    });

    // Caso da gestora de RH no Hub: via a empresa inteira na lista do modal e
    // só descobria que não podia registrar depois de escrever tudo.
    it("quem não tem cadastro vinculado é avisado ao abrir, não ao salvar", async () => {
      const r = await svc.colaboradoresElegiveis(rh);
      expect(r.semVinculo).toBe(true);
      expect(r.data).toEqual([]);
      expect((await svc.colaboradoresElegiveis(gestorA)).semVinculo).toBeUndefined();
    });

    it("recusa colaborador sem login, fora da árvore e a si mesmo", async () => {
      await expect(registrar(id.bruno)).rejects.toThrow(/não tem acesso ao sistema/);
      await expect(registrar(id.carla)).rejects.toThrow(/não encontrado/);
      await expect(registrar(id.gestorA)).rejects.toThrow(/você mesmo/);
    });

    it("exige pontos fortes e oportunidades", async () => {
      await expect(svc.criar(gestorA, { collaboratorId: id.ana, pontosFortes: " ", oportunidades: "x" }))
        .rejects.toThrow(/pontos fortes/);
    });
  });

  describe("fluxo completo: registro → reunião → ciência → encerramento", () => {
    let fid: string;

    it("registrado não existe para o colaborador", async () => {
      fid = (await registrar(id.ana)).data.id;
      expect((await svc.meus(ana)).data).toHaveLength(0);
      await expect(svc.meu(ana, fid)).rejects.toThrow(/não encontrado/);
    });

    // O RH chega pela notificação de exclusão e precisa ACHAR o registro. Uma
    // lista vazia para ele deixaria o pedido sem quem decidisse, e foi
    // exatamente o que aconteceu no homolog: o alcance "organização inteira"
    // virava uma condição vazia dentro de um OR, que não casa com nada.
    it("RH enxerga a organização inteira na lista", async () => {
      const lista = (await svc.listar(rh, {})).data;
      expect(lista.map((f: any) => f.id)).toContain(fid);
      expect(lista.every((f: any) => f.souGestor === false)).toBe(true);
      expect((await svc.obter(rh, fid)).data.papeis).toEqual(["rh"]);
    });

    it("quem está fora da árvore não enxerga; o próprio colaborador não lê pela gestão", async () => {
      await expect(svc.obter(gestorB, fid)).rejects.toThrow(/não encontrado/);
      expect((await svc.listar(gestorB, {})).data).toHaveLength(0);
      await expect(svc.obter({ ...ana, permissions: GESTOR }, fid)).rejects.toThrow(/não encontrado/);
    });

    it("agendar entra na agenda dos dois e avisa o colaborador, sem liberar o texto", async () => {
      const email = moduloRef.get(EmailService);
      const enviado = jest.spyOn(email, "sendFeedbackReuniaoAgendada").mockResolvedValue(true);
      const inicio = new Date(Date.now() + 2 * 86_400_000);
      const r = await svc.agendarReuniao(gestorA, fid, { inicio: inicio.toISOString(), local: "Sala 3" });

      // E-mail ao colaborador — no endereço do login dele — com data e local.
      const usuarioAna = await prisma.user.findUnique({ where: { id: ana.id } });
      expect(enviado).toHaveBeenCalledWith(
        usuarioAna.email, "Ana Liderada", "Gestor A", expect.stringMatching(/\d{2}\/\d{2}\/\d{4}/), "Sala 3", false,
      );
      enviado.mockRestore();
      expect(r.data.status).toBe("REUNIAO_AGENDADA");

      const eventos = await prisma.event.findMany({ where: { origemTipo: "people_feedback", origemId: fid } });
      expect(eventos.map((e: any) => e.userId).sort()).toEqual([gestorA.id, ana.id].sort());
      expect(await notificacoes(ana.id, "people_feedback_reuniao")).toHaveLength(1);

      const meu = (await svc.meus(ana)).data[0];
      expect(meu.status).toBe("REUNIAO_AGENDADA");
      expect(meu.pontosFortes).toBeNull();
      expect(meu.oportunidades).toBeNull();
    });

    it("remarcar atualiza os mesmos compromissos em vez de criar outros", async () => {
      const email = moduloRef.get(EmailService);
      const enviado = jest.spyOn(email, "sendFeedbackReuniaoAgendada").mockResolvedValue(true);
      const novo = new Date(Date.now() + 3 * 86_400_000);
      await svc.agendarReuniao(gestorA, fid, { inicio: novo.toISOString() });
      // Remarcou: novo e-mail, sinalizado como remarcação e sem local.
      expect(enviado.mock.calls[0][4]).toBeNull();
      expect(enviado.mock.calls[0][5]).toBe(true);
      enviado.mockRestore();
      const eventos = await prisma.event.findMany({ where: { origemTipo: "people_feedback", origemId: fid } });
      expect(eventos).toHaveLength(2);
      expect(eventos.every((e: any) => e.inicio.getTime() === novo.getTime())).toBe(true);
    });

    it("colaborador não dá ciência antes da reunião; reunião não pode ser registrada no futuro", async () => {
      await expect(svc.registrarCiencia(ana, fid, {})).rejects.toThrow(/etapa atual/);
      await expect(svc.registrarReuniao(gestorA, fid, {
        realizadaEm: new Date(Date.now() + 86_400_000).toISOString(), alinhamentos: "x",
      })).rejects.toThrow(/futura/);
    });

    it("reunião realizada libera o texto ao colaborador e trava a edição", async () => {
      const email = moduloRef.get(EmailService);
      const disponivel = jest.spyOn(email, "sendFeedbackDisponivel").mockResolvedValue(true);
      const r = await svc.registrarReuniao(gestorA, fid, { alinhamentos: "Avisar atraso em até 1 dia" });
      // O e-mail "você recebeu um feedback" sai só agora, quando há o que ler.
      expect(disponivel).toHaveBeenCalledTimes(1);
      expect(disponivel.mock.calls[0][1]).toBe("Ana Liderada");
      disponivel.mockRestore();
      expect(r.data.status).toBe("AGUARDANDO_CIENCIA");
      expect(await notificacoes(ana.id, "people_feedback_ciencia")).toHaveLength(1);

      const meu = (await svc.meu(ana, fid)).data;
      expect(meu.pontosFortes).toBe("Entrega com qualidade");
      expect(meu.alinhamentos).toBe("Avisar atraso em até 1 dia");
      expect(meu.podeDarCiencia).toBe(true);

      await expect(svc.editar(gestorA, fid, { pontosFortes: "outro" })).rejects.toThrow(/etapa atual/);
    });

    it("ciência encerra, guarda o comentário e avisa o gestor", async () => {
      const r = await svc.registrarCiencia(ana, fid, { comentario: "Concordo em parte" });
      expect(r.data.status).toBe("ENCERRADO");
      expect(r.data.comentarioColaborador).toBe("Concordo em parte");
      expect(await notificacoes(gestorA.id, "people_feedback_encerrado")).toHaveLength(1);

      const detalhe = (await svc.obter(gestorA, fid)).data;
      expect(detalhe.eventos.map((e: any) => e.tipo)).toEqual([
        "registrado", "reuniao_agendada", "reuniao_reagendada", "reuniao_realizada", "ciencia",
      ]);
      expect(detalhe.eventos[0].autorNome).toBe("Gestor A");
      expect(detalhe.acoes).toEqual(["solicitar_exclusao"]);

      await expect(svc.registrarCiencia(ana, fid, {})).rejects.toThrow(/etapa atual/);
    });
  });

  describe("acompanhamento do RH", () => {
    it("mostra os gestores do organograma, inclusive quem não registrou nada", async () => {
      const r = (await svc.acompanhamento(rh, 90)).data;

      const porId = new Map(r.gestores.map((g: any) => [g.id, g]));
      // Os dois gestores do organograma: A (Ana e Bruno) e B (Carla).
      expect(porId.get(id.gestorA).liderados).toBe(2);
      expect(porId.get(id.gestorA).registrados).toBeGreaterThan(0);
      // GestorB nunca registrou — é a linha que a lista de feedbacks não teria.
      expect(porId.get(id.gestorB)).toMatchObject({ liderados: 1, registrados: 0, cobertura: 0 });
      // Quem não lidera ninguém não é cobrado.
      expect(porId.has(id.ana)).toBe(false);
      expect(r.resumo.gestoresSemRegistro).toBeGreaterThanOrEqual(1);
    });

    it("a fila de quem não deu ciência traz os dias de espera", async () => {
      const fid = (await registrar(id.ana)).data.id;
      await svc.agendarReuniao(gestorA, fid, { inicio: new Date().toISOString() });
      await svc.registrarReuniao(gestorA, fid, {
        realizadaEm: new Date(Date.now() - 3 * 86_400_000).toISOString(),
        alinhamentos: "Combinados",
      });

      const r = (await svc.acompanhamento(rh, 90)).data;
      const linha = r.semRetorno.find((s: any) => s.id === fid);
      expect(linha).toBeDefined();
      expect(linha.diasEsperando).toBe(3);
      expect(linha.colaborador).toBe("Ana Liderada");

      await svc.registrarCiencia(ana, fid, {});
      const depois = (await svc.acompanhamento(rh, 90)).data;
      expect(depois.semRetorno.some((s: any) => s.id === fid)).toBe(false);
      expect(depois.resumo.percentualRetorno).toBeGreaterThan(0);
    });

    it("impressão: fichas trazem o texto inteiro, consolidado não; recorte igual ao da tela", async () => {
      const fichas = (await svc.impressao(rh, { completo: "1" })).data;
      expect(fichas.itens.length).toBeGreaterThan(0);
      expect(fichas.itens[0].pontosFortes).toBeTruthy();
      expect(fichas.itens.find((f: any) => f.eventos?.length)).toBeDefined();
      expect(fichas.alcance).toBe("organizacao");

      const consolidado = (await svc.impressao(rh, {})).data;
      expect(consolidado.itens[0].pontosFortes).toBeUndefined();
      expect(consolidado.resumo.registrados).toBe(consolidado.itens.length);

      // Gestor B não lidera ninguém que recebeu feedback: imprime zero.
      const doB = (await svc.impressao(gestorB, { completo: "1" })).data;
      expect(doB.itens).toHaveLength(0);
      expect(doB.alcance).toBe("equipe");

      // Período sem registro nenhum.
      const vazio = (await svc.impressao(rh, { de: "2020-01-01", ate: "2020-01-31" })).data;
      expect(vazio.itens).toHaveLength(0);

      // "De hoje até hoje" traz o que foi registrado hoje. A data chega sem
      // hora e é o dia em São Paulo — lida como UTC, o "até" recuava para as
      // 21h do dia anterior e o registro de hoje sumia do relatório (homolog,
      // 18/09/2026).
      const hojeSP = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
      const deHoje = (await svc.impressao(rh, { de: hojeSP, ate: hojeSP })).data;
      expect(deHoje.itens.length).toBe(consolidado.itens.length);
    });

    it("gestor vê só a própria equipe no acompanhamento", async () => {
      const r = (await svc.acompanhamento(gestorA, 90)).data;
      expect(r.gestores.map((g: any) => g.id)).toEqual([id.gestorA]);
      expect(r.semRetorno.every((s: any) => s.gestor === "Gestor A")).toBe(true);
    });
  });

  describe("exclusão: gestor pede, RH decide", () => {
    let fid: string;

    beforeAll(async () => {
      fid = (await registrar(id.ana)).data.id;
      await svc.agendarReuniao(gestorA, fid, { inicio: new Date(Date.now() + 86_400_000).toISOString() });
    });

    it("pedido notifica o RH e para o fluxo", async () => {
      const r = await svc.solicitarExclusao(gestorA, fid, { motivo: "Registrado para a pessoa errada" });
      expect(r.aprovadoresNotificados).toBe(1);
      expect(r.data.exclusao?.status).toBe("PENDENTE");
      expect(await notificacoes(rh.id, "people_feedback_exclusao")).toHaveLength(1);

      await expect(svc.registrarReuniao(gestorA, fid, { alinhamentos: "x" })).rejects.toThrow(/aguardando o RH/);
      await expect(svc.solicitarExclusao(gestorA, fid, { motivo: "de novo" })).rejects.toThrow(/Já existe/);
    });

    it("gestor não decide o próprio pedido", async () => {
      await expect(svc.decidirExclusao(gestorA, fid, { aprovar: true })).rejects.toThrow(/não cabe a você/);
    });

    it("reprovada: registro continua, gestor é avisado, pedido sai da fila do RH", async () => {
      await svc.decidirExclusao(rh, fid, { aprovar: false, parecer: "Corrija pela edição" });

      const f = await prisma.feedbackDesempenho.findUnique({ where: { id: fid } });
      expect(f.excluidoEm).toBeNull();
      expect(f.exclusaoStatus).toBe("REPROVADA");
      expect(f.status).toBe("REUNIAO_AGENDADA");

      const avisos = await notificacoes(gestorA.id, "people_feedback_exclusao_reprovada");
      expect(avisos).toHaveLength(1);
      expect(avisos[0].mensagem).toContain("Corrija pela edição");
      expect((await notificacoes(rh.id, "people_feedback_exclusao")).every((n: any) => n.lida)).toBe(true);

      // O fluxo volta a andar.
      expect((await svc.obter(gestorA, fid)).data.acoes).toContain("registrar_reuniao");
    });

    it("aprovada: some das telas, sai da agenda futura e o gestor é avisado", async () => {
      await svc.solicitarExclusao(gestorA, fid, { motivo: "Duplicado" });
      const r = await svc.decidirExclusao(rh, fid, { aprovar: true });
      expect((r.data as any).excluido).toBe(true);

      expect((await svc.listar(gestorA, {})).data.some((f: any) => f.id === fid)).toBe(false);
      await expect(svc.obter(rh, fid)).rejects.toThrow(/não encontrado/);
      expect((await svc.meus(ana)).data.some((f: any) => f.id === fid)).toBe(false);
      expect(await prisma.event.count({ where: { origemTipo: "people_feedback", origemId: fid } })).toBe(0);
      expect(await notificacoes(gestorA.id, "people_feedback_exclusao_aprovada")).toHaveLength(1);

      // A trilha fica.
      const eventos = await prisma.feedbackDesempenhoEvento.findMany({ where: { feedbackId: fid } });
      expect(eventos.map((e: any) => e.tipo)).toContain("exclusao_aprovada");
    });

    it("RH que registrou e pediu não decide o próprio pedido", async () => {
      const rhGestor = { ...rh, permissions: [...rh.permissions, "people.feedback_desempenho:registrar"] };
      const idRhGestor = await employees.criar(rh as any, {
        nomeCompleto: "Liderado do RH", dataAdmissao: "2024-01-10",
        userId: (await criarUsuario("Liderado do RH", [])).id,
        gestorId: (await employees.criar(rh as any, { nomeCompleto: "RH Aprovador", dataAdmissao: "2024-01-10", userId: rh.id } as any)).data.id,
      } as any);
      const f = (await registrar(idRhGestor.data.id, rhGestor)).data.id;
      await svc.solicitarExclusao(rhGestor, f, { motivo: "Teste" });
      await expect(svc.decidirExclusao(rhGestor, f, { aprovar: true })).rejects.toThrow(/próprio pedido/);
    });
  });
});
