import { Test } from "@nestjs/testing";
import { randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { PeopleModule } from "./people.module";
import { EmployeeService } from "./application/employee.service";
import { ChecklistService } from "./application/checklist.service";
import { PeopleNotificationsService } from "./application/people-notifications.service";

/**
 * Varredura de prazos — o aviso que faltava.
 *
 * Documento vencendo, certificação vencendo e férias vencendo já avisavam.
 * Checklist de admissão parado, não: a Fase do checklist entregou prazo por
 * item e painel de atraso, e nada que avisasse. Prazo que ninguém vê é um
 * campo de formulário, não um controle.
 *
 * O teste também fixa a política ANTI-RUÍDO, que é metade do valor: um aviso
 * por checklist e não um por item, e nada repetido no mesmo dia. Um alerta que
 * chega oito vezes deixa de ser lido na terceira, e aí os outros sete avisos
 * do sistema morrem junto.
 */

const DB = process.env.PEOPLE_IT_DATABASE_URL;
const descreve = DB ? describe : describe.skip;

descreve("People — varredura de prazos", () => {
  let moduloRef: any;
  let prisma: PrismaService;
  let employees: EmployeeService;
  let checklists: ChecklistService;
  let notificacoes: PeopleNotificationsService;

  const orgId = `nt-org-${randomUUID()}`;
  let gestorUserId: string;
  let colaboradorUserId: string;
  let gestorId: string;
  let colaboradorId: string;
  let templateId: string;

  const rh = () => ({
    id: gestorUserId,
    organizationId: orgId,
    permissions: ["people.colaborador:ver_todos", "people.checklist:gerenciar"],
  });

  /** Notificações do tipo, restritas a quem este teste criou. */
  const avisos = (userId: string, tipo = "people_checklist_atrasado") =>
    (prisma as any).notification.findMany({ where: { userId, tipo } });

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    moduloRef = await Test.createTestingModule({ imports: [PeopleModule] }).compile();
    await moduloRef.init();

    prisma = moduloRef.get(PrismaService);
    employees = moduloRef.get(EmployeeService);
    checklists = moduloRef.get(ChecklistService);
    notificacoes = moduloRef.get(PeopleNotificationsService);

    await (prisma as any).organization.create({
      data: { id: orgId, nome: "IT Notificações", slug: `nt-${randomUUID().slice(0, 8)}` },
    });

    const criarUser = async (nome: string) =>
      (await (prisma as any).user.create({
        data: {
          id: `nt-user-${randomUUID()}`, organizationId: orgId,
          nome, email: `${randomUUID().slice(0, 8)}@nt.local`, senhaHash: "x",
        },
      })).id;

    gestorUserId = await criarUser("Gestor");
    colaboradorUserId = await criarUser("Recém-admitido");

    gestorId = (await employees.criar(rh(), {
      nomeCompleto: "Gestor", userId: gestorUserId,
    } as any)).data.id;

    // Admitido há 60 dias: qualquer item com prazo curto já está vencido.
    colaboradorId = (await employees.criar(rh(), {
      nomeCompleto: "Recém-admitido", userId: colaboradorUserId,
      gestorId, dataAdmissao: diasAtras(60),
    } as any)).data.id;

    const modelo = await checklists.criarModelo(rh(), {
      nome: `Admissão ${randomUUID().slice(0, 6)}`, evento: "admissao",
    } as any);
    templateId = modelo.data.id;

    // Três vencidos, um deles do colaborador, e um sem prazo (nunca atrasa).
    await checklists.adicionarItemModelo(rh(), templateId, {
      titulo: "Exame admissional", responsavel: "rh", prazoDias: 5,
    } as any);
    await checklists.adicionarItemModelo(rh(), templateId, {
      titulo: "Crachá e acessos", responsavel: "gestor", prazoDias: 10,
    } as any);
    await checklists.adicionarItemModelo(rh(), templateId, {
      titulo: "Entregar carteira de trabalho", responsavel: "colaborador", prazoDias: 7,
    } as any);
    await checklists.adicionarItemModelo(rh(), templateId, {
      titulo: "Almoço de boas-vindas", responsavel: "gestor", obrigatorio: false,
    } as any);
  }, 90_000);

  afterAll(async () => {
    if (!prisma) return;
    await (prisma as any).organization.deleteMany({ where: { id: orgId } }).catch(() => {});
    await moduloRef?.close().catch(() => {});
    await (prisma as any).$disconnect?.();
  }, 30_000);

  function diasAtras(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  it("não avisa antes de existir checklist", async () => {
    await notificacoes.varrerPrazos();
    expect(await avisos(gestorUserId)).toHaveLength(0);
  });

  it("avisa o gestor UMA vez, com a contagem dos itens atrasados", async () => {
    await checklists.abrir(rh(), colaboradorId, { evento: "admissao" } as any);
    await notificacoes.varrerPrazos();

    const recebidos = await avisos(gestorUserId);
    // Três itens vencidos, UM aviso. O item sem prazo não conta como atraso.
    expect(recebidos).toHaveLength(1);
    expect(recebidos[0].mensagem).toContain("3 itens estão atrasados");
    expect(recebidos[0].titulo).toContain("admissao");
    // O mais antigo é o exame: prazo de 5 dias sobre admissão de 60 dias atrás.
    expect(recebidos[0].mensagem).toContain("venceu há 55 dias");
  });

  it("avisa o colaborador só do que é dele", async () => {
    const recebidos = await avisos(colaboradorUserId);
    expect(recebidos).toHaveLength(1);
    expect(recebidos[0].mensagem).toContain("Entregar carteira de trabalho");
    // Ele não fica sabendo do exame nem do crachá — não são pendências dele.
    expect(recebidos[0].mensagem).not.toContain("Exame");
    expect(recebidos[0].mensagem).not.toContain("Crachá");
  });

  it("varrer de novo no mesmo dia não repete o aviso", async () => {
    await notificacoes.varrerPrazos();
    await notificacoes.varrerPrazos();

    expect(await avisos(gestorUserId)).toHaveLength(1);
    expect(await avisos(colaboradorUserId)).toHaveLength(1);
  });

  it("para de avisar quando o checklist é concluído", async () => {
    const lista = await checklists.doColaborador(rh(), colaboradorId);
    for (const item of lista.data[0].itens) {
      await checklists.marcarItem(rh(), item.id, { concluido: true } as any);
    }

    // Zera o que já foi avisado para provar que a varredura seguinte cala.
    await (prisma as any).notification.deleteMany({
      where: { userId: { in: [gestorUserId, colaboradorUserId] } },
    });
    await notificacoes.varrerPrazos();

    expect(await avisos(gestorUserId)).toHaveLength(0);
    expect(await avisos(colaboradorUserId)).toHaveLength(0);
  });
});
