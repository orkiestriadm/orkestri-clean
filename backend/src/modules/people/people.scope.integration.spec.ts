import { Test } from "@nestjs/testing";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { PeopleModule } from "./people.module";
import { EmployeeService } from "./application/employee.service";
import { DocumentService } from "./application/document.service";
import { VacationService } from "./application/vacation.service";
import { BenefitService } from "./application/benefit.service";
import { DevelopmentService } from "./application/development.service";
import { ReportService } from "./application/report.service";
import { SalaryService } from "./application/salary.service";
import { FeedbackService } from "./application/feedback.service";
import { CareerService } from "./application/career.service";
import { ChecklistService } from "./application/checklist.service";
import { PeopleScopeService } from "./application/people-scope.service";
import { SelfServiceService } from "./application/self-service.service";
import { Review360Service } from "./application/review360.service";

/**
 * Isolamento de dados do People — o teste que faltava.
 *
 * Toda a cobertura anterior roda com um usuário que enxerga a organização
 * inteira (`people.colaborador:ver_todos`), e o PeopleScopeService só tinha
 * teste unitário com Prisma dublado. Ou seja: as regras de escopo estavam
 * provadas em isolamento, e o CAMINHO REAL — serviço → escopo → banco — nunca
 * tinha sido exercido por um usuário restrito.
 *
 * É o pior lugar para confiar em prova indireta. Salário, avaliação de
 * desempenho e anotação privada de feedback passam por aqui, e um `where` que
 * esqueça o filtro não quebra nada: só devolve gente demais, em silêncio.
 *
 * A montagem abaixo existe para que CADA superfície de leitura seja consultada
 * por um gestor, e o vazamento apareça como teste vermelho e não como
 * incidente.
 *
 *   Diretora ─┬─ GestorA ─┬─ Ana            (sem liderados → escopo "próprio")
 *             │           └─ Bruno ── Diego (indireto de GestorA)
 *             └─ GestorB ─── Carla          (o CONTROLE: ninguém de GestorA a alcança)
 *
 * Carla é o canário. Qualquer superfície que a devolva para GestorA está
 * vazando, e é sempre ela que os testes procuram.
 */

const DB = process.env.PEOPLE_IT_DATABASE_URL;
const descreve = DB ? describe : describe.skip;

descreve("People — isolamento por escopo", () => {
  let moduloRef: any;
  let prisma: PrismaService;
  let employees: EmployeeService;
  let documents: DocumentService;
  let vacations: VacationService;
  let benefits: BenefitService;
  let development: DevelopmentService;
  let reports: ReportService;
  let salarios: SalaryService;
  let feedbacks: FeedbackService;
  let carreira: CareerService;
  let checklists: ChecklistService;
  let escopos: PeopleScopeService;
  let euMesmo: SelfServiceService;
  let r360: Review360Service;
  let raizDocs: string;

  const orgId = `sc-org-${randomUUID()}`;
  const outraOrgId = `sc-org-${randomUUID()}`;

  /** Contextos de usuário, na forma que o JWT entrega. */
  type Ctx = { id: string; organizationId: string; permissions: string[] };

  const P = {
    /** Leitura ampla, SEM `ver_todos` — é o que o gestor recebe de fato. */
    leitura: [
      "people.colaborador:ver", "people.documento:ver", "people.ferias:ver",
      "people.beneficio:ver", "people.treinamento:ver", "people.avaliacao:ver",
      "people.salario:ver", "people.feedback:ver", "people.feedback:registrar",
      "people.carreira:ver", "people.checklist:ver", "people.relatorio:ver",
      "people.colaborador:editar", "people.salario:gerenciar",
    ],
  };

  let rhCtx: Ctx;             // ver_todos → organização inteira
  let gestorACtx: Ctx;        // equipe: ele, Ana, Bruno, Diego
  let gestorBCtx: Ctx;        // equipe: ele, Carla
  let anaCtx: Ctx;            // próprio: só ela
  let orfaoCtx: Ctx;          // usuário sem colaborador vinculado → nenhum
  let outraOrgCtx: Ctx;       // ver_todos, mas de OUTRA organização

  const id = {} as Record<"diretora" | "gestorA" | "gestorB" | "ana" | "bruno" | "diego" | "carla", string>;

  /** Cria usuário na organização e devolve o contexto. */
  async function criarUsuario(nome: string, permissions: string[], organizationId = orgId): Promise<Ctx> {
    const u = await (prisma as any).user.create({
      data: {
        id: `sc-user-${randomUUID()}`, organizationId,
        nome, email: `${randomUUID().slice(0, 8)}@sc.local`, senhaHash: "x",
      },
    });
    return { id: u.id, organizationId, permissions };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    raizDocs = fs.mkdtempSync(path.join(os.tmpdir(), "people-scope-"));
    process.env.PEOPLE_DOCS_DIR = raizDocs;

    moduloRef = await Test.createTestingModule({ imports: [PeopleModule] }).compile();
    await moduloRef.init();

    prisma = moduloRef.get(PrismaService);
    employees = moduloRef.get(EmployeeService);
    documents = moduloRef.get(DocumentService);
    vacations = moduloRef.get(VacationService);
    benefits = moduloRef.get(BenefitService);
    development = moduloRef.get(DevelopmentService);
    reports = moduloRef.get(ReportService);
    salarios = moduloRef.get(SalaryService);
    feedbacks = moduloRef.get(FeedbackService);
    carreira = moduloRef.get(CareerService);
    checklists = moduloRef.get(ChecklistService);
    escopos = moduloRef.get(PeopleScopeService);
    euMesmo = moduloRef.get(SelfServiceService);
    r360 = moduloRef.get(Review360Service);

    for (const [oid, nome] of [[orgId, "Escopo A"], [outraOrgId, "Escopo B"]] as const) {
      await (prisma as any).organization.create({
        data: { id: oid, nome, slug: `sc-${randomUUID().slice(0, 8)}` },
      });
    }

    rhCtx       = await criarUsuario("RH",       ["people.colaborador:ver_todos", "people.salario:ver", "people.documento:aprovar"]);
    gestorACtx  = await criarUsuario("Gestor A", P.leitura);
    gestorBCtx  = await criarUsuario("Gestor B", P.leitura);
    anaCtx      = await criarUsuario("Ana",      P.leitura);
    orfaoCtx    = await criarUsuario("Órfão",    P.leitura);
    outraOrgCtx = await criarUsuario("RH da outra org", ["people.colaborador:ver_todos"], outraOrgId);

    // A hierarquia. Cada um é criado pelo RH, que enxerga tudo.
    const nova = async (nomeCompleto: string, extra: Record<string, unknown> = {}) =>
      (await employees.criar(rhCtx, { nomeCompleto, dataAdmissao: "2024-01-10", ...extra } as any)).data.id;

    id.diretora = await nova("Diretora Raiz");
    id.gestorA  = await nova("Gestor A", { userId: gestorACtx.id, gestorId: id.diretora });
    id.gestorB  = await nova("Gestor B", { userId: gestorBCtx.id, gestorId: id.diretora });
    id.ana      = await nova("Ana Direta", { userId: anaCtx.id, gestorId: id.gestorA });
    id.bruno    = await nova("Bruno Direto", { gestorId: id.gestorA });
    id.diego    = await nova("Diego Indireto", { gestorId: id.bruno });
    id.carla    = await nova("Carla Canário", { gestorId: id.gestorB });

    // Colaborador na outra organização, para o teste de vazamento entre orgs.
    await employees.criar(outraOrgCtx, { nomeCompleto: "Pessoa de Outra Org" } as any);
  }, 90_000);

  afterAll(async () => {
    if (!prisma) return;
    await (prisma as any).organization.deleteMany({ where: { id: { in: [orgId, outraOrgId] } } }).catch(() => {});
    fs.rmSync(raizDocs, { recursive: true, force: true });
    await moduloRef?.close().catch(() => {});
    await (prisma as any).$disconnect?.();
  }, 30_000);

  /* ── O escopo em si ───────────────────────────────────────────────────────── */

  describe("resolução do escopo", () => {
    it("RH com ver_todos alcança a organização inteira", async () => {
      expect((await escopos.resolve(rhCtx)).tipo).toBe("organizacao");
    });

    it("gestor alcança a própria árvore, incluindo os indiretos", async () => {
      const escopo = await escopos.resolve(gestorACtx);
      expect(escopo.tipo).toBe("equipe");
      const ids = (escopo as any).collaboratorIds;
      // Ele mesmo entra: gestor precisa enxergar o próprio cadastro.
      expect(ids).toEqual(expect.arrayContaining([id.gestorA, id.ana, id.bruno, id.diego]));
      // Diego é DOIS níveis abaixo — se faltasse, a varredura em largura estaria
      // parando no primeiro nível.
      expect(ids).toContain(id.diego);
      expect(ids).not.toContain(id.carla);
      expect(ids).not.toContain(id.diretora);
      expect(ids).toHaveLength(4);
    });

    it("quem não lidera ninguém alcança apenas a si", async () => {
      const escopo = await escopos.resolve(anaCtx);
      expect(escopo.tipo).toBe("proprio");
      expect((escopo as any).collaboratorIds).toEqual([id.ana]);
    });

    it("usuário sem colaborador vinculado não alcança ninguém", async () => {
      expect((await escopos.resolve(orfaoCtx)).tipo).toBe("nenhum");
    });

    it("escopo nenhum vira filtro que não casa com nada, não filtro ausente", async () => {
      // A diferença importa: `where` sem cláusula devolveria a organização
      // inteira. Negar por construção em vez de por omissão.
      const where = await escopos.whereColaborador(orfaoCtx);
      expect(where.id).toEqual({ in: [] });
    });
  });

  /* ── Leitura: nenhuma superfície pode devolver Carla ao Gestor A ──────────── */

  describe("gestor não alcança quem está fora da sua árvore", () => {
    it("a lista traz só a árvore dele", async () => {
      const r = await employees.listar(gestorACtx, {} as any);
      const nomes = r.data.map((c: any) => c.nomeExibicao);
      expect(r.meta.total).toBe(4);
      expect(nomes).toContain("Ana Direta");
      expect(nomes).toContain("Diego Indireto");
      expect(nomes).not.toContain("Carla Canário");
      expect(nomes).not.toContain("Diretora Raiz");
    });

    // O filtro de setor da lista sai do QUADRO, e o quadro é o do escopo:
    // oferecer um setor que só existe fora dele devolveria zero ao clicar, e
    // ainda entregaria que o setor existe.
    it("as opções de filtro não vazam setor de fora da árvore", async () => {
      const setorDeFora = await (prisma as any).setor.create({
        data: { id: `sc-setor-${randomUUID()}`, organizationId: orgId, nome: "Setor da Carla", ativo: false },
      });
      await employees.atualizar(rhCtx, id.carla, { setorId: setorDeFora.id } as any);

      const doGestor = await employees.filtros(gestorACtx);
      expect(doGestor.data.setores.some((s: any) => s.id === setorDeFora.id)).toBe(false);

      // E o RH, que enxerga tudo, VÊ o setor mesmo ele estando inativo — é o
      // caso que o catálogo `/setores` escondia.
      const doRh = await employees.filtros(rhCtx);
      expect(doRh.data.setores.some((s: any) => s.id === setorDeFora.id)).toBe(true);
    });

    // 404 e não 403 de propósito: "existe mas você não pode" já entrega que a
    // pessoa existe. Para quem está fora do escopo, ela simplesmente não está lá.
    it.each([
      ["perfil",           () => employees.obter(gestorACtx, id.carla)],
      ["linha do tempo",   () => employees.historicoDe(gestorACtx, id.carla)],
      ["documentos",       () => documents.listar(gestorACtx, id.carla)],
      ["férias",           () => vacations.situacao(gestorACtx, id.carla)],
      ["benefícios",       () => benefits.listarDoColaborador(gestorACtx, id.carla)],
      ["treinamentos",     () => development.listarTreinamentos(gestorACtx, id.carla)],
      ["avaliações",       () => development.listarAvaliacoes(gestorACtx, id.carla)],
      ["remuneração",      () => salarios.situacao(gestorACtx, id.carla)],
      ["feedback",         () => feedbacks.listar(gestorACtx, id.carla, true)],
      ["carreira",         () => carreira.situacao(gestorACtx, id.carla)],
      ["checklist",        () => checklists.doColaborador(gestorACtx, id.carla)],
    ])("%s de fora da árvore responde como inexistente", async (_rotulo, chamada) => {
      await expect(chamada()).rejects.toThrow(/não encontrado/i);
    });

    it.each([
      ["editar cadastro", () => employees.atualizar(gestorACtx, id.carla, { cargo: "Invadido" } as any)],
      ["registrar salário", () => salarios.registrar(gestorACtx, id.carla, { valor: 1, vigenciaInicio: "2026-01-01" } as any)],
      ["registrar feedback", () => feedbacks.criar(gestorACtx, id.carla, { tipo: "elogio", conteudo: "x" } as any)],
    ])("%s de fora da árvore é recusado", async (_rotulo, chamada) => {
      await expect(chamada()).rejects.toThrow(/não encontrado/i);
    });
  });

  /* ── Painéis: agregado também vaza ────────────────────────────────────────── */

  describe("painéis respeitam o escopo", () => {
    // Um número agregado parece inofensivo e não é: "custo de benefícios da
    // organização" dividido pelo headcount é o salário médio.
    it("a visão geral conta só a árvore do gestor", async () => {
      const gestor = await reports.visaoGeral(gestorACtx);
      const rh = await reports.visaoGeral(rhCtx);

      expect(gestor.data.escopoOrganizacional).toBe(false);
      expect(rh.data.escopoOrganizacional).toBe(true);
      expect(gestor.data.quadro.ativos).toBe(4);
      expect(rh.data.quadro.ativos).toBe(7);
    });

    it("o painel salarial não conta quem está fora da árvore", async () => {
      const r = await salarios.painel(gestorACtx);
      expect(r.data.escopoOrganizacional).toBe(false);
    });

    it.each([
      ["conformidade documental", () => documents.conformidade(gestorACtx)],
      ["certificações vencendo",  () => development.certificacoesVencendo(gestorACtx)],
      ["checklists em aberto",    () => checklists.painel(gestorACtx)],
    ])("%s roda em escopo restrito", async (_rotulo, chamada) => {
      const r: any = await chamada();
      expect(r.data.escopoOrganizacional).toBe(false);
    });

    it("painel recusa quem não tem escopo em vez de devolver vazio", async () => {
      // Vazio diria "não há pendências" — uma afirmação falsa sobre o mundo.
      await expect(checklists.painel(orfaoCtx)).rejects.toThrow(/escopo/i);
      await expect(salarios.painel(orfaoCtx)).rejects.toThrow(/escopo/i);
      await expect(reports.visaoGeral(orfaoCtx)).rejects.toThrow(/escopo/i);
    });
  });

  /* ── Colaborador comum ────────────────────────────────────────────────────── */

  describe("colaborador comum alcança apenas o próprio cadastro", () => {
    it("a lista traz só ela", async () => {
      const r = await employees.listar(anaCtx, {} as any);
      expect(r.data).toHaveLength(1);
      expect(r.data[0].id).toBe(id.ana);
    });

    it("não alcança um colega do mesmo gestor", async () => {
      await expect(employees.obter(anaCtx, id.bruno)).rejects.toThrow(/não encontrado/i);
    });

    it("não alcança o próprio gestor", async () => {
      await expect(employees.obter(anaCtx, id.gestorA)).rejects.toThrow(/não encontrado/i);
    });

    it("alcança o próprio perfil, férias e carreira", async () => {
      await expect(employees.obter(anaCtx, id.ana)).resolves.toBeDefined();
      await expect(vacations.situacao(anaCtx, id.ana)).resolves.toBeDefined();
      await expect(carreira.situacao(anaCtx, id.ana)).resolves.toBeDefined();
    });

    it("não lê a anotação privada de feedback sobre si", async () => {
      await feedbacks.criar(rhCtx, id.ana, {
        tipo: "um_a_um", conteudo: "Tratar na próxima conversa.",
        visibilidade: "privado", autorId: id.gestorA,
      } as any);

      // O `incluirPrivados` vem do guard de permissão na camada de cima; aqui a
      // garantia é a de baixo — pedir explicitamente não basta.
      const dela = await feedbacks.listar(anaCtx, id.ana, false);
      expect(dela.data.some((f: any) => f.visibilidade === "privado")).toBe(false);
    });
  });

  /* ── Usuário sem vínculo ──────────────────────────────────────────────────── */

  describe("usuário sem colaborador vinculado", () => {
    it("recebe explicação em vez de lista vazia", async () => {
      // "Nenhum colaborador cadastrado" seria mentira: há sete. O que falta é o
      // vínculo do usuário, e a mensagem precisa dizer isso.
      await expect(employees.listar(orfaoCtx, {} as any)).rejects.toThrow(/vinculado a um colaborador/i);
    });

    it("não alcança nenhum perfil", async () => {
      await expect(employees.obter(orfaoCtx, id.ana)).rejects.toThrow(/não encontrado/i);
      await expect(employees.obter(orfaoCtx, id.carla)).rejects.toThrow(/não encontrado/i);
    });
  });

  /* ── Isolamento entre organizações ────────────────────────────────────────── */

  describe("isolamento entre organizações", () => {
    // `ver_todos` é amplo DENTRO da organização. A multi-tenancy é a camada de
    // fora, e nenhuma permissão a atravessa.
    it("ver_todos da outra org não enxerga o quadro desta", async () => {
      const r = await employees.listar(outraOrgCtx, {} as any);
      const nomes = r.data.map((c: any) => c.nomeExibicao);
      expect(nomes).toContain("Pessoa de Outra Org");
      expect(nomes).not.toContain("Carla Canário");
      expect(nomes).not.toContain("Ana Direta");
    });

    it("nem alcança um colaborador desta pelo id direto", async () => {
      await expect(employees.obter(outraOrgCtx, id.ana)).rejects.toThrow(/não encontrado/i);
      await expect(vacations.situacao(outraOrgCtx, id.ana)).rejects.toThrow(/não encontrado/i);
      await expect(salarios.situacao(outraOrgCtx, id.ana)).rejects.toThrow(/não encontrado/i);
    });

    it("a visão geral da outra org não soma o quadro desta", async () => {
      const r = await reports.visaoGeral(outraOrgCtx);
      expect(r.data.quadro.ativos).toBe(1);
    });
  });

  /* ── Autoatendimento ──────────────────────────────────────────────────────── */

  describe("Meu RH — o alvo vem do token, nunca da requisição", () => {
    it("o colaborador comum vê a si", async () => {
      const r = await euMesmo.resumo(anaCtx);
      expect(r.data.colaborador.id).toBe(id.ana);
      expect(r.data.colaborador.nome).toBe("Ana Direta");
      expect(r.data.colaborador.gestor).toBe("Gestor A");
    });

    // O teste que justifica resolver pelo VÍNCULO e não pelo escopo. O gestor
    // alcança quatro cadastros; ler o primeiro da lista lhe mostraria outra
    // pessoa sob o título "meus dados".
    it("o gestor vê a si, não o primeiro da sua equipe", async () => {
      const r = await euMesmo.resumo(gestorACtx);
      expect(r.data.colaborador.id).toBe(id.gestorA);
      expect(r.data.colaborador.nome).toBe("Gestor A");
    });

    it("quem não tem cadastro recebe instrução, não erro genérico", async () => {
      await expect(euMesmo.resumo(orfaoCtx)).rejects.toThrow(/vinculado a um cadastro/i);
      // O RH deste teste também não tem cadastro próprio: enxergar todo mundo
      // não é o mesmo que ter uma ficha.
      await expect(euMesmo.resumo(rhCtx)).rejects.toThrow(/vinculado a um cadastro/i);
    });

    it("as abas trazem os dados de quem chamou", async () => {
      const [ferias, docs, carreira] = await Promise.all([
        euMesmo.minhasFerias(anaCtx),
        euMesmo.meusDocumentos(anaCtx),
        euMesmo.minhaCarreira(anaCtx),
      ]);
      expect(ferias.data).toHaveProperty("saldoDisponivel");
      expect(docs.data.every((d: any) => d.collaboratorId === undefined || d.collaboratorId === id.ana)).toBe(true);
      expect(carreira.success).toBe(true);
    });

    // O ciclo que estava partido: dava para pedir férias e não para saber o
    // que aconteceu com o pedido — a aprovação vive no módulo de ausências, e
    // a tela de férias não mostrava nem que a solicitação existia.
    it("fecha o ciclo do pedido de férias: pedir, ver o desfecho e desistir", async () => {
      const dias = (n: number) => {
        const d = new Date();
        d.setDate(d.getDate() + n);
        return d.toISOString().slice(0, 10);
      };

      // Ana precisa de saldo: admissão antiga o bastante para ter período.
      await employees.atualizar(rhCtx, id.ana, { dataAdmissao: "2020-01-10" } as any);

      const pedido = await euMesmo.solicitarFerias(anaCtx, {
        dataInicio: dias(30), dataFim: dias(39), observacao: "Viagem",
      } as any);

      const antes = await euMesmo.minhasFerias(anaCtx);
      const minha = antes.data.solicitacoes.find((s: any) => s.id === pedido.data.id);
      expect(minha).toBeDefined();
      expect(minha.status).toBe("PENDENTE");
      expect(minha.dias).toBe(10);

      await euMesmo.cancelarFerias(anaCtx, pedido.data.id);

      const depois = await euMesmo.minhasFerias(anaCtx);
      const cancelada = depois.data.solicitacoes.find((s: any) => s.id === pedido.data.id);
      // Continua na lista, com o desfecho à vista: sumir faria a pessoa
      // duvidar se chegou a cancelar.
      expect(cancelada.status).toBe("CANCELADA");
    });

    it("não cancela o pedido de outra pessoa", async () => {
      await employees.atualizar(rhCtx, id.bruno, { dataAdmissao: "2020-01-10" } as any);
      const dias = (n: number) => {
        const d = new Date();
        d.setDate(d.getDate() + n);
        return d.toISOString().slice(0, 10);
      };
      const doBruno = await vacations.solicitar(rhCtx, id.bruno, {
        dataInicio: dias(60), dataFim: dias(69),
      } as any);

      await expect(euMesmo.cancelarFerias(anaCtx, doBruno.data.id))
        .rejects.toThrow(/não encontrada/i);
    });

    it("nunca devolve a anotação privada feita sobre a própria pessoa", async () => {
      await feedbacks.criar(rhCtx, id.ana, {
        tipo: "um_a_um", conteudo: "Só para o gestor.",
        visibilidade: "privado", autorId: id.gestorA,
      } as any);
      await feedbacks.criar(rhCtx, id.ana, {
        tipo: "elogio", conteudo: "Conduziu bem a virada.", autorId: id.gestorA,
      } as any);

      const r = await euMesmo.meusFeedbacks(anaCtx);
      expect(r.data.length).toBeGreaterThan(0);
      expect(r.data.some((f: any) => f.visibilidade === "privado")).toBe(false);
    });

    it("mostra avaliação finalizada e esconde rascunho", async () => {
      // Rascunho é trabalho em curso do gestor: uma nota que ainda vai mudar
      // gera conversa sobre um número provisório.
      await development.salvarAvaliacao(rhCtx, id.ana, { ciclo: "2026.1", nota: 4 } as any);
      const lista = await development.listarAvaliacoes(rhCtx, id.ana);
      await development.finalizarAvaliacao(rhCtx, lista.data.find((a: any) => a.ciclo === "2026.1").id);
      await development.salvarAvaliacao(rhCtx, id.ana, { ciclo: "2026.2", nota: 3 } as any);

      const r = await euMesmo.meuDesenvolvimento(anaCtx);
      const ciclos = r.data.avaliacoes.map((a: any) => a.ciclo);
      expect(ciclos).toContain("2026.1");
      expect(ciclos).not.toContain("2026.2");
    });
  });

  /* ── Avaliação 360 ────────────────────────────────────────────────────────── */

  describe("360 — autoavaliação, pares e o anonimato que os sustenta", () => {
    let reviewId: string;

    beforeAll(async () => {
      await development.salvarAvaliacao(rhCtx, id.bruno, { ciclo: "2027.1", nota: 3 } as any);
      const lista = await development.listarAvaliacoes(rhCtx, id.bruno);
      reviewId = lista.data.find((a: any) => a.ciclo === "2027.1").id;
    });

    it("convida o avaliado para a autoavaliação e colegas como pares", async () => {
      await r360.convidar(gestorACtx, reviewId, { avaliadorId: id.bruno, origem: "autoavaliacao" } as any);
      await r360.convidar(gestorACtx, reviewId, { avaliadorId: id.ana, origem: "par" } as any);
      await r360.convidar(gestorACtx, reviewId, { avaliadorId: id.diego, origem: "par" } as any);

      const p = await r360.painel(gestorACtx, reviewId);
      expect(p.data.entradas).toHaveLength(3);
    });

    it("recusa o avaliado como par de si mesmo", async () => {
      await expect(
        r360.convidar(gestorACtx, reviewId, { avaliadorId: id.bruno, origem: "par" } as any),
      ).rejects.toThrow(/par de si mesmo/i);
    });

    it("recusa autoavaliação atribuída a terceiro", async () => {
      await expect(
        r360.convidar(gestorACtx, reviewId, { avaliadorId: id.gestorA, origem: "autoavaliacao" } as any),
      ).rejects.toThrow(/próprio avaliado/i);
    });

    it("não convida quem está fora do escopo de quem convida", async () => {
      // Sem isto, convidar seria uma forma de descobrir ids alheios por tentativa.
      await expect(
        r360.convidar(gestorACtx, reviewId, { avaliadorId: id.carla, origem: "par" } as any),
      ).rejects.toThrow(/não encontrado/i);
    });

    it("cada um responde o SEU convite, e ninguém responde pelo outro", async () => {
      const minhas = await r360.minhasPendencias(anaCtx);
      const daAna = minhas.data.find((x: any) => x.ciclo === "2027.1");
      expect(daAna.origem).toBe("par");
      expect(daAna.sobre.nome).toBe("Bruno Direto");

      // Ana tentando responder pelo Diego: o alvo sai do vínculo, não do corpo.
      const doDiego = (await r360.painel(gestorACtx, reviewId)).data.entradas
        .find((e: any) => e.avaliador.id === id.diego);
      await expect(
        r360.responder(anaCtx, doDiego.id, { nota: 5 } as any),
      ).rejects.toThrow(/não encontrado/i);

      await r360.responder(anaCtx, daAna.id, { nota: 4, pontosFortes: "Sempre disponível." } as any);
      const depois = await r360.minhasPendencias(anaCtx);
      expect(depois.data.some((x: any) => x.ciclo === "2027.1")).toBe(false);
    });

    it("recusa resposta vazia — participação que não diz nada é pior que a ausência", async () => {
      const doDiego = (await r360.painel(gestorACtx, reviewId)).data.entradas
        .find((e: any) => e.avaliador.id === id.diego);
      await expect(r360.responder(rhCtx, doDiego.id, {} as any)).rejects.toThrow();
    });

    it("mostra ao gestor a divergência entre a autoavaliação e a nota dele", async () => {
      const auto = (await r360.painel(gestorACtx, reviewId)).data.entradas
        .find((e: any) => e.origem === "autoavaliacao");
      // O Bruno não tem login neste cenário — o RH responde por ele para
      // exercitar o cálculo; a regra de titularidade já foi provada acima.
      await (prisma as any).performanceReviewInput.update({
        where: { id: auto.id },
        data: { nota: 5, status: "RESPONDIDA", respondidoEm: new Date() },
      });

      const p = await r360.painel(gestorACtx, reviewId);
      // Ele se vê 2 pontos acima do que o gestor o vê: é o número que aponta
      // para uma conversa específica.
      expect(p.data.divergenciaAutoavaliacao).toBe(2);
      expect(p.data.notaGestor).toBe(3);
    });

    it("o avaliado não lê nada enquanto a avaliação não é finalizada", async () => {
      // Ler as respostas com o gestor ainda decidindo transformaria o ciclo
      // numa negociação.
      await development.salvarAvaliacao(rhCtx, id.ana, { ciclo: "2027.2", nota: 4 } as any);
      await expect(r360.meuResultado(anaCtx, "2027.2")).rejects.toThrow(/em andamento/i);
    });

    it("esconde do avaliado a média de pares quando poucos responderam", async () => {
      const lista = await development.listarAvaliacoes(rhCtx, id.ana);
      const rev = lista.data.find((a: any) => a.ciclo === "2027.2");
      await r360.convidar(gestorACtx, rev.id, { avaliadorId: id.bruno, origem: "par" } as any);
      const entradas = (await r360.painel(gestorACtx, rev.id)).data.entradas;
      await (prisma as any).performanceReviewInput.update({
        where: { id: entradas[0].id },
        data: { nota: 2, pontosMelhoria: "Precisa comunicar mais.", status: "RESPONDIDA", respondidoEm: new Date() },
      });
      await development.finalizarAvaliacao(rhCtx, rev.id);

      const meu = await r360.meuResultado(anaCtx, "2027.2");
      const pares = meu.data.resumo.find((x: any) => x.origem === "par");
      // Com uma resposta, a "média dos pares" identificaria quem respondeu.
      expect(pares.media).toBeNull();
      expect(pares.omitidaPorAnonimato).toBe(true);
      // O comentário chega, mas SEM autor — é o que mantém o par franco.
      expect(meu.data.comentarios[0].texto).toContain("comunicar");
      expect(meu.data.comentarios[0]).not.toHaveProperty("avaliador");
    });

    it("não remove convite já respondido", async () => {
      const respondida = (await r360.painel(gestorACtx, reviewId)).data.entradas
        .find((e: any) => e.status === "RESPONDIDA");
      await expect(r360.remover(gestorACtx, respondida.id)).rejects.toThrow(/já respondeu/i);
    });

    it("a calibração compara a régua de cada gestor sem mexer em nota", async () => {
      const r = await r360.calibracao(rhCtx, "2027.2");
      expect(r.data.ciclo).toBe("2027.2");
      expect(r.data.totalAvaliados).toBeGreaterThan(0);
      expect(r.data.mediaGeral).not.toBeNull();
      expect(r.data.gestores[0]).toHaveProperty("desvio");
    });
  });

  /* ── Documento sensível ───────────────────────────────────────────────────── */

  describe("documento de categoria sensível", () => {
    const arquivo = () => ({
      originalname: "atestado.pdf",
      mimetype: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 teste"),
      size: 14,
    });

    it("o próprio colaborador baixa o seu, mesmo sendo gestor de uma equipe", async () => {
      // Gestor A tem equipe, então o escopo dele é "equipe" e não "próprio".
      // A primeira versão só liberava "próprio" — e um gestor não conseguia
      // abrir o próprio atestado médico.
      const doc = await documents.enviar(rhCtx, id.gestorA, {
        titulo: "Atestado do gestor", categoria: "medico",
      } as any, arquivo() as any);

      await expect(documents.prepararDownload(gestorACtx, doc.data.id)).resolves.toBeDefined();
    });

    it("gestor não abre o documento sensível de um liderado", async () => {
      const doc = await documents.enviar(rhCtx, id.ana, {
        titulo: "Atestado da Ana", categoria: "medico",
      } as any, arquivo() as any);

      // Ele vê a pendência — precisa saber que existe — mas não o conteúdo.
      await expect(documents.prepararDownload(gestorACtx, doc.data.id)).rejects.toThrow();
      await expect(documents.prepararDownload(anaCtx, doc.data.id)).resolves.toBeDefined();
      await expect(documents.prepararDownload(rhCtx, doc.data.id)).resolves.toBeDefined();
    });
  });
});
