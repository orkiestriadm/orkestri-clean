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

/**
 * Teste de integração do Orkiestri People — serviços reais contra banco real.
 *
 * Existe porque todo o resto da cobertura é unitária: prova regra isolada, não
 * prova que criar um colaborador grava linha, gera histórico na mesma transação
 * e que o documento chega ao disco. Esses são justamente os caminhos que
 * quebraram no primeiro deploy.
 *
 * Só roda com PEOPLE_IT_DATABASE_URL apontando para um banco DESCARTÁVEL. Sem
 * a variável, os testes são pulados — nunca deve tocar produção por acidente.
 * Tudo que cria é removido no final.
 */

const DB = process.env.PEOPLE_IT_DATABASE_URL;
const descreve = DB ? describe : describe.skip;

if (!DB) {
  // AVISO ALTO, de propósito.
  //
  // Esta suíte ficou meses sem rodar e ninguém percebeu, porque `npm test`
  // terminava dizendo "todos passando" enquanto os 69 testes que tocam o banco
  // eram pulados em silêncio. Cobertura que some sem avisar é pior que
  // cobertura que nunca existiu: ela dá confiança falsa.
  console.warn(
    "\n\x1b[33m⚠  INTEGRAÇÃO DO PEOPLE NÃO EXECUTADA\x1b[0m\n" +
    "   Os testes que tocam banco e disco foram PULADOS.\n" +
    "   Para rodar tudo:  npm run test:it\n",
  );
}

descreve("People — integração", () => {
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
  let raizDocs: string;

  const orgId = `it-org-${randomUUID()}`;
  const criados: string[] = [];
  let usuarioId: string;

  /** Usuário RH: enxerga a organização inteira e aprova documento. */
  const rh = () => ({
    id: usuarioId,
    organizationId: orgId,
    permissions: ["people.colaborador:ver_todos", "people.documento:aprovar"],
  });

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    raizDocs = fs.mkdtempSync(path.join(os.tmpdir(), "people-it-"));
    process.env.PEOPLE_DOCS_DIR = raizDocs;

    moduloRef = await Test.createTestingModule({ imports: [PeopleModule] }).compile();
    const modulo = moduloRef;
    await modulo.init();

    prisma = modulo.get(PrismaService);
    employees = modulo.get(EmployeeService);
    documents = modulo.get(DocumentService);
    vacations = modulo.get(VacationService);
    benefits = modulo.get(BenefitService);
    development = modulo.get(DevelopmentService);
    reports = modulo.get(ReportService);
    salarios = modulo.get(SalaryService);
    feedbacks = modulo.get(FeedbackService);
    carreira = modulo.get(CareerService);
    checklists = modulo.get(ChecklistService);

    await (prisma as any).organization.create({
      data: { id: orgId, nome: "IT People", slug: `it-${randomUUID().slice(0, 8)}` },
    });
    const u = await (prisma as any).user.create({
      data: {
        id: `it-user-${randomUUID()}`, organizationId: orgId,
        nome: "RH de Teste", email: `rh-${randomUUID().slice(0, 8)}@it.local`,
        senhaHash: "x",
      },
    });
    usuarioId = u.id;
  }, 60_000);

  afterAll(async () => {
    if (!prisma) return;
    // Cascata da organização leva colaboradores, histórico e documentos.
    await (prisma as any).organization.deleteMany({ where: { id: orgId } }).catch(() => {});
    fs.rmSync(raizDocs, { recursive: true, force: true });

    // FECHA O MÓDULO, não só o Prisma.
    //
    // O PeopleModule importa ScheduleModule.forRoot(), e os cron registrados
    // mantêm o event loop vivo: sem `close()` o jest terminava os testes e
    // ficava pendurado para sempre. A saída fácil seria `--forceExit`, que
    // esconde vazamento de verdade — e uma suíte que trava é uma suíte que
    // alguém desliga. Esta aqui ficou meses sem rodar.
    await moduloRef?.close().catch(() => {});
    await (prisma as any).$disconnect?.();
  }, 30_000);

  // ── O caso que motivou a Fase 1 inteira ──────────────────────────────────
  it("cadastra colaborador SEM acesso ao sistema", async () => {
    const r = await employees.criar(rh(), {
      nomeCompleto: "João Sem Login",
      cargo: "Motorista",
      dataAdmissao: "2026-03-01",
    } as any);

    expect(r.success).toBe(true);
    expect(r.data.userId).toBeNull();
    expect(r.data.nomeExibicao).toBe("João Sem Login");
    criados.push(r.data.id);
  });

  it("gera o evento de admissão na mesma transação", async () => {
    const hist = await employees.historicoDe(rh(), criados[0]);
    const admissao = hist.data.find((e: any) => e.evento === "admissao");
    expect(admissao).toBeDefined();
    expect(admissao.vigenciaEm).not.toBeNull();
  });

  it("recusa colaborador sem usuário e sem nome — não teria como exibi-lo", async () => {
    await expect(employees.criar(rh(), { cargo: "Fantasma" } as any)).rejects.toThrow();
  });

  it("registra mudança de setor na linha do tempo", async () => {
    const setor = await (prisma as any).setor.create({
      data: { id: `it-setor-${randomUUID()}`, organizationId: orgId, nome: "Operações" },
    });
    await employees.atualizar(rh(), criados[0], { setorId: setor.id } as any);

    const hist = await employees.historicoDe(rh(), criados[0]);
    expect(hist.data.some((e: any) => e.evento === "mudanca_setor")).toBe(true);
  });

  it("desligamento exige data e depois vira estado final", async () => {
    await expect(
      employees.mudarStatus(rh(), criados[0], { status: "DESLIGADO" } as any),
    ).rejects.toThrow();

    const r = await employees.mudarStatus(rh(), criados[0], {
      status: "DESLIGADO", dataDesligamento: "2026-07-01", motivo: "Fim de contrato",
    } as any);
    expect(r.data.status).toBe("DESLIGADO");
    expect(r.data.ativo).toBe(false);

    // Estado final: não volta para ATIVO.
    await expect(
      employees.mudarStatus(rh(), criados[0], { status: "ATIVO" } as any),
    ).rejects.toThrow();
  });

  // ── O caminho que passa por disco ────────────────────────────────────────
  describe("documentos", () => {
    let colaboradorId: string;
    let documentoId: string;

    beforeAll(async () => {
      const r = await employees.criar(rh(), { nomeCompleto: "Maria Documentos" } as any);
      colaboradorId = r.data.id;
    });

    it("envia documento e grava o arquivo em disco", async () => {
      const conteudo = Buffer.from("%PDF-1.4 conteudo de teste");
      const r = await documents.enviar(
        rh(), colaboradorId,
        { categoria: "identidade", titulo: "RG", dataValidade: "2030-01-01" } as any,
        { originalname: "rg.pdf", mimetype: "application/pdf", size: conteudo.length, buffer: conteudo },
      );

      expect(r.success).toBe(true);
      expect(r.data.aprovacao).toBe("PENDENTE");
      documentoId = r.data.id;

      // O arquivo existe sob {org}/{colaborador}/, isolado por organização.
      const encontrados: string[] = [];
      const varrer = (d: string) => fs.readdirSync(d, { withFileTypes: true })
        .forEach(e => e.isDirectory() ? varrer(path.join(d, e.name)) : encontrados.push(path.join(d, e.name)));
      varrer(raizDocs);

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0]).toContain(orgId);
      expect(encontrados[0]).toContain(colaboradorId);
      expect(fs.readFileSync(encontrados[0], "utf8")).toBe(conteudo.toString());
    });

    it("recusa tipo de arquivo não permitido", async () => {
      await expect(documents.enviar(
        rh(), colaboradorId,
        { categoria: "outro", titulo: "Script" } as any,
        { originalname: "x.svg", mimetype: "image/svg+xml", size: 10, buffer: Buffer.from("<svg/>") },
      )).rejects.toThrow();
    });

    it("prepara download com o arquivo correto", async () => {
      const r = await documents.prepararDownload(rh(), documentoId);
      expect(r.nomeArquivo).toBe("rg.pdf");
      expect(r.mimeType).toBe("application/pdf");
      r.stream.destroy();
    });

    it("rejeição exige motivo; aprovação registra na timeline", async () => {
      await expect(
        documents.decidir(rh(), documentoId, { aprovacao: "REJEITADO" } as any),
      ).rejects.toThrow();

      const r = await documents.decidir(rh(), documentoId, { aprovacao: "APROVADO" } as any);
      expect(r.data.aprovacao).toBe("APROVADO");

      const hist = await employees.historicoDe(rh(), colaboradorId);
      expect(hist.data.some((e: any) => (e.descricao ?? "").includes("APROVADO"))).toBe(true);
    });

    // Gestor alcança o colaborador, mas atestado médico não abre para ele.
    it("documento médico não é baixável por quem não é RH", async () => {
      const medico = Buffer.from("atestado");
      const enviado = await documents.enviar(
        rh(), colaboradorId,
        { categoria: "medico", titulo: "Atestado" } as any,
        { originalname: "at.pdf", mimetype: "application/pdf", size: medico.length, buffer: medico },
      );

      const gestor = {
        id: usuarioId, organizationId: orgId,
        permissions: ["people.colaborador:ver_todos", "people.documento:ver"], // sem aprovar
      };

      const lista = await documents.listar(gestor, colaboradorId);
      const item = lista.data.find((d: any) => d.id === enviado.data.id);
      expect(item.restrito).toBe(true);
      expect(item.podeBaixar).toBe(false);

      await expect(documents.prepararDownload(gestor, enviado.data.id)).rejects.toThrow();
    });

    it("acusa o documento cujo arquivo sumiu do armazenamento", async () => {
      // Não é hipótese: o diretório de documentos ficou sem volume no container
      // e todo deploy o recriava vazio, deixando as linhas apontando para o
      // nada. A lista mostrava tudo normal e o erro só vinha no clique.
      const conteudo = Buffer.from("%PDF-1.4 vai sumir");
      const enviado = await documents.enviar(
        rh(), colaboradorId,
        { categoria: "outro", titulo: "Some do disco" } as any,
        { originalname: "some.pdf", mimetype: "application/pdf", size: conteudo.length, buffer: conteudo },
      );

      const antes = (await documents.listar(rh(), colaboradorId))
        .data.find((d: any) => d.id === enviado.data.id);
      expect(antes.arquivoDisponivel).toBe(true);
      expect(antes.podeBaixar).toBe(true);
      // O caminho no armazenamento NÃO pode sair na resposta: a checagem de
      // existência é feita com ele, mas ele morre no serviço.
      expect(antes.arquivoRef).toBeUndefined();

      // Apaga o arquivo por fora, como o deploy fazia.
      const doc = await (prisma as any).collaboratorDocument.findUnique({
        where: { id: enviado.data.id }, select: { arquivoRef: true },
      });
      fs.rmSync(path.join(raizDocs, doc.arquivoRef));

      const depois = (await documents.listar(rh(), colaboradorId))
        .data.find((d: any) => d.id === enviado.data.id);
      expect(depois.arquivoDisponivel).toBe(false);
      expect(depois.podeBaixar).toBe(false);

      const conf = await documents.conformidade(rh());
      expect(conf.data.semArquivo.some((d: any) => d.id === enviado.data.id)).toBe(true);

      // E o download continua respondendo 404 com mensagem, não 500.
      await expect(documents.prepararDownload(rh(), enviado.data.id)).rejects.toThrow();

      await documents.excluir(rh(), enviado.data.id).catch(() => {});
    });

    it("exclusão remove o arquivo do disco", async () => {
      const antes = fs.readdirSync(path.join(raizDocs, orgId, colaboradorId)).length;
      await documents.excluir(rh(), documentoId);
      const depois = fs.readdirSync(path.join(raizDocs, orgId, colaboradorId)).length;
      expect(depois).toBe(antes - 1);
    });
  });

  // ── Férias: período aquisitivo e saldo ───────────────────────────────────
  describe("férias", () => {
    let veterano: string;
    let novato: string;

    beforeAll(async () => {
      // Admitido há ~3 anos: tem períodos adquiridos com saldo.
      const tresAnosAtras = new Date();
      tresAnosAtras.setFullYear(tresAnosAtras.getFullYear() - 3);
      const v = await employees.criar(rh(), {
        nomeCompleto: "Ana Veterana",
        dataAdmissao: tresAnosAtras.toISOString().slice(0, 10),
      } as any);
      veterano = v.data.id;

      // Admitido há 2 meses: ainda não completou o primeiro aquisitivo.
      const doisMesesAtras = new Date();
      doisMesesAtras.setMonth(doisMesesAtras.getMonth() - 2);
      const n = await employees.criar(rh(), {
        nomeCompleto: "Beto Novato",
        dataAdmissao: doisMesesAtras.toISOString().slice(0, 10),
      } as any);
      novato = n.data.id;
    });

    // Quem tem 3 anos de casa sem tirar férias acumulou PASSIVO, não saldo: os
    // períodos mais antigos já passaram do concessivo. Só o último ciclo
    // fechado ainda é utilizável — os anteriores viraram pagamento em dobro.
    it("períodos além do concessivo aparecem como VENCIDO, não como saldo", async () => {
      const r = await vacations.situacao(rh(), veterano);
      expect(r.data.semDataAdmissao).toBe(false);
      expect(r.data.periodos.length).toBeGreaterThanOrEqual(3);

      expect(r.data.periodos.some((p: any) => p.status === "VENCIDO")).toBe(true);
      expect(r.data.periodos.some((p: any) => p.status === "ADQUIRIDO")).toBe(true);

      // Saldo conta apenas o que ainda dá para gozar.
      const adquiridos = r.data.periodos.filter((p: any) => p.status === "ADQUIRIDO");
      const esperado = adquiridos.reduce((s: number, p: any) => s + p.saldo, 0);
      expect(r.data.saldoDisponivel).toBe(esperado);
    });

    it("quem não fechou 12 meses tem período em aquisição e saldo zero", async () => {
      const r = await vacations.situacao(rh(), novato);
      expect(r.data.periodos).toHaveLength(1);
      expect(r.data.periodos[0].status).toBe("EM_AQUISICAO");
      expect(r.data.saldoDisponivel).toBe(0);
    });

    it("sincronizar duas vezes não duplica período", async () => {
      const antes = (await vacations.situacao(rh(), veterano)).data.periodos.length;
      const depois = (await vacations.situacao(rh(), veterano)).data.periodos.length;
      expect(depois).toBe(antes);
    });

    it("recusa solicitação de quem não tem saldo", async () => {
      await expect(
        vacations.solicitar(rh(), novato, { dataInicio: "2027-01-04", dataFim: "2027-01-18" } as any),
      ).rejects.toThrow(/saldo/i);
    });

    it("cria solicitação vinculada a um período adquirido e debita dele", async () => {
      const r = await vacations.solicitar(rh(), veterano, {
        dataInicio: "2027-03-01", dataFim: "2027-03-15",
      } as any);

      expect(r.data.tipo).toBe("ferias");
      expect(r.data.status).toBe("PENDENTE");
      expect(r.data.dias).toBe(15);
      expect(r.data.vacationPeriodId).toBeTruthy();

      const situacao = await vacations.situacao(rh(), veterano);
      const debitado = situacao.data.periodos.find((p: any) => p.id === r.data.vacationPeriodId);
      expect(debitado.diasGozados).toBe(15);
      expect(debitado.saldo).toBe(15);
      // Nunca debita de período vencido — aquele saldo não é mais utilizável.
      expect(debitado.status).toBe("ADQUIRIDO");
    });

    // Pendente conta contra o saldo: sem isso, várias solicitações simultâneas
    // estourariam o período e o erro só apareceria na aprovação.
    it("solicitação pendente já reduz o saldo disponível", async () => {
      const antes = (await vacations.situacao(rh(), veterano)).data.saldoDisponivel;
      await vacations.solicitar(rh(), veterano, {
        dataInicio: "2027-06-01", dataFim: "2027-06-10",
      } as any);
      const depois = (await vacations.situacao(rh(), veterano)).data.saldoDisponivel;
      expect(depois).toBe(antes - 10);
    });

    it("o passivo reflete a solicitação na hora, sem esperar a sincronização", async () => {
      // O painel lia `dias_gozados` da coluna materializada, reescrita só às
      // 07:00 ou na subida da API. Quem aprovasse férias de manhã via o saldo
      // antigo até o dia seguinte — e saldo de férias inflado vira provisão
      // contábil errada.
      // Colaborador próprio: pendurar este caso no `veterano` o tornaria refém
      // do saldo que os testes anteriores consumiram.
      //
      // 23 meses de casa, não 24: assim o primeiro período aquisitivo está
      // ADQUIRIDO (dá para debitar) E com o limite concessivo dentro da janela
      // de 60 dias do painel (aparece nele). Com 24 meses cheios o débito cairia
      // no período seguinte, que ainda não vence na janela — e o teste mediria
      // um período que a tela nem mostra.
      const admissao = new Date();
      admissao.setMonth(admissao.getMonth() - 23);
      const p = await employees.criar(rh(), {
        nomeCompleto: "Passivo Imediato",
        dataAdmissao: admissao.toISOString().slice(0, 10),
      } as any);
      const pessoa = p.data.id;
      await vacations.situacao(rh(), pessoa); // materializa os períodos

      const saldoDe = (r: any) =>
        r.data.periodos
          .filter((x: any) => x.colaborador.id === pessoa)
          .reduce((s: number, x: any) => s + x.saldo, 0);

      const saldoAntes = saldoDe(await vacations.passivo(rh()));
      expect(saldoAntes).toBeGreaterThanOrEqual(10);

      await vacations.solicitar(rh(), pessoa, {
        dataInicio: "2028-02-01", dataFim: "2028-02-10",
      } as any);

      // Nada de sincronizar no meio: é justamente a leitura sem sincronização
      // que precisa estar certa.
      expect(saldoDe(await vacations.passivo(rh()))).toBe(saldoAntes - 10);
    });

    it("recusa período que se sobrepõe a uma solicitação existente", async () => {
      await expect(
        vacations.solicitar(rh(), veterano, { dataInicio: "2027-03-10", dataFim: "2027-03-20" } as any),
      ).rejects.toThrow(/sobre/i);
    });

    it("recusa fracionamento abaixo de 5 dias", async () => {
      await expect(
        vacations.solicitar(rh(), veterano, { dataInicio: "2027-09-01", dataFim: "2027-09-03" } as any),
      ).rejects.toThrow(/5 dias/);
    });

    it("colaborador desligado não solicita férias", async () => {
      const r = await employees.criar(rh(), {
        nomeCompleto: "Carlos Desligado",
        dataAdmissao: "2020-01-01",
      } as any);
      await employees.mudarStatus(rh(), r.data.id, {
        status: "DESLIGADO", dataDesligamento: "2026-01-01",
      } as any);

      await expect(
        vacations.solicitar(rh(), r.data.id, { dataInicio: "2027-04-01", dataFim: "2027-04-10" } as any),
      ).rejects.toThrow(/DESLIGADO/);
    });

    it("colaborador sem data de admissão não trava a tela", async () => {
      const r = await employees.criar(rh(), { nomeCompleto: "Sem Admissão" } as any);
      const s = await vacations.situacao(rh(), r.data.id);
      expect(s.data.semDataAdmissao).toBe(true);
      expect(s.data.periodos).toHaveLength(0);
    });
  });

  // ── Fase 6: benefícios ───────────────────────────────────────────────────
  describe("benefícios", () => {
    let beneficioId: string;
    let pessoaId: string;

    beforeAll(async () => {
      const b = await benefits.criarBeneficio(rh(), {
        nome: `Vale-refeição ${randomUUID().slice(0, 6)}`,
        categoria: "alimentacao",
        valorReferencia: 800,
      } as any);
      beneficioId = b.data.id;

      const p = await employees.criar(rh(), {
        nomeCompleto: "Beneficiária Teste", dataAdmissao: "2024-01-10",
      } as any);
      pessoaId = p.data.id;
    });

    it("concede herdando o valor de referência do catálogo", async () => {
      const r = await benefits.conceder(rh(), pessoaId, {
        benefitId: beneficioId, inicio: "2026-01-01",
      } as any);
      // Sem valor informado, grava o de referência — mudar o catálogo depois
      // não pode reescrever concessão antiga.
      expect(r.data.valor).toBe(800);
    });

    it("recusa conceder o mesmo benefício sobrepondo o vigente", async () => {
      await expect(
        benefits.conceder(rh(), pessoaId, { benefitId: beneficioId, inicio: "2026-06-01" } as any),
      ).rejects.toThrow(/sobrep|já existe/i);
    });

    it("soma o custo mensal apenas do que está vigente", async () => {
      const r = await benefits.listarDoColaborador(rh(), pessoaId);
      expect(r.data.custoMensalVigente).toBe(800);
      expect(r.data.itens[0].vigente).toBe(true);
    });

    it("encerra preenchendo a data, sem apagar o histórico", async () => {
      const lista = await benefits.listarDoColaborador(rh(), pessoaId);
      const concessaoId = lista.data.itens[0].id;

      await benefits.encerrar(rh(), concessaoId, { fim: "2026-03-31" } as any);

      const depois = await benefits.listarDoColaborador(rh(), pessoaId);
      expect(depois.data.itens).toHaveLength(1);      // a linha continua lá
      expect(depois.data.itens[0].fim).not.toBeNull();
      expect(depois.data.itens[0].vigente).toBe(false);
      expect(depois.data.custoMensalVigente).toBe(0);
    });

    it("aceita nova concessão depois da anterior encerrada", async () => {
      const r = await benefits.conceder(rh(), pessoaId, {
        benefitId: beneficioId, inicio: "2026-04-01", valor: 950,
      } as any);
      expect(r.data.valor).toBe(950);
    });

    it("recusa excluir benefício que já foi concedido", async () => {
      await expect(benefits.excluirBeneficio(rh(), beneficioId))
        .rejects.toThrow(/histórico|desative/i);
    });

    it("registra a concessão na linha do tempo do colaborador", async () => {
      const hist = await employees.historicoDe(rh(), pessoaId);
      expect(hist.data.some((e: any) => /Benefício concedido/.test(e.descricao))).toBe(true);
    });
  });

  // ── Fase 7: treinamentos e desempenho ────────────────────────────────────
  describe("desenvolvimento", () => {
    let cursoId: string;
    let pessoaId: string;

    beforeAll(async () => {
      const c = await development.criarCurso(rh(), {
        nome: `NR-10 ${randomUUID().slice(0, 6)}`,
        categoria: "seguranca",
        cargaHoraria: 40,
        validadeMeses: 24,
      } as any);
      cursoId = c.data.id;

      const p = await employees.criar(rh(), {
        nomeCompleto: "Treinando Teste", dataAdmissao: "2024-01-10",
      } as any);
      pessoaId = p.data.id;
    });

    it("calcula e grava a validade ao concluir", async () => {
      const r = await development.registrarTreinamento(rh(), pessoaId, {
        trainingId: cursoId, status: "CONCLUIDO", conclusao: "2026-03-10",
      } as any);
      expect(r.data.validade).toEqual(new Date("2028-03-10T00:00:00.000Z"));
    });

    it("mudar a validade do curso não reescreve certificado já emitido", async () => {
      await development.atualizarCurso(rh(), cursoId, { validadeMeses: 6 } as any);

      const lista = await development.listarTreinamentos(rh(), pessoaId);
      // Continua 2028: a validade foi gravada na conclusão, não é derivada.
      expect(new Date(lista.data[0].validade).getFullYear()).toBe(2028);
    });

    it("recusa concluir sem data de conclusão", async () => {
      await expect(
        development.registrarTreinamento(rh(), pessoaId, {
          trainingId: cursoId, status: "CONCLUIDO",
        } as any),
      ).rejects.toThrow(/conclusão/i);
    });

    it("treinamento concluído é final — não reabre", async () => {
      const lista = await development.listarTreinamentos(rh(), pessoaId);
      await expect(
        development.atualizarTreinamento(rh(), lista.data[0].id, { status: "EM_ANDAMENTO" } as any),
      ).rejects.toThrow(/final|não é possível/i);
    });

    it("salva avaliação como rascunho sem nota e recusa finalizar assim", async () => {
      const a = await development.salvarAvaliacao(rh(), pessoaId, {
        ciclo: "2026.1", pontosFortes: "Autonomia",
      } as any);
      expect(a.data.status).toBe("RASCUNHO");

      await expect(development.finalizarAvaliacao(rh(), a.data.id))
        .rejects.toThrow(/nota/i);
    });

    it("finaliza com nota e trava edição posterior", async () => {
      await development.salvarAvaliacao(rh(), pessoaId, { ciclo: "2026.1", nota: 4.5 } as any);

      const lista = await development.listarAvaliacoes(rh(), pessoaId);
      const avaliacao = lista.data.find((a: any) => a.ciclo === "2026.1");
      const finalizada = await development.finalizarAvaliacao(rh(), avaliacao.id);
      expect(finalizada.data.status).toBe("FINALIZADA");

      // Reescrever o que o colaborador já viu não é correção, é reescrita.
      await expect(
        development.salvarAvaliacao(rh(), pessoaId, { ciclo: "2026.1", nota: 2 } as any),
      ).rejects.toThrow(/finalizada/i);
    });

    it("pondera o progresso das metas pelo peso", async () => {
      const a = await development.salvarAvaliacao(rh(), pessoaId, { ciclo: "2026.2" } as any);
      const m1 = await development.criarMeta(rh(), a.data.id, { titulo: "Entregar projeto", peso: 5 } as any);
      await development.criarMeta(rh(), a.data.id, { titulo: "Curso interno", peso: 1 } as any);
      await development.atualizarMeta(rh(), m1.data.id, { progresso: 100 } as any);

      const lista = await development.listarAvaliacoes(rh(), pessoaId);
      const ciclo = lista.data.find((x: any) => x.ciclo === "2026.2");
      // Média simples daria 50; o peso 5 leva a 83.
      expect(ciclo.progressoMetas).toBe(83);
    });

    it("recusa o avaliado como próprio avaliador", async () => {
      await expect(
        development.salvarAvaliacao(rh(), pessoaId, {
          ciclo: "2027", avaliadorId: pessoaId,
        } as any),
      ).rejects.toThrow(/avaliador/i);
    });
  });

  // ── Fase 8: relatórios ───────────────────────────────────────────────────
  describe("relatórios", () => {
    it("responde a visão geral com quadro, movimentação e distribuições", async () => {
      const r = await reports.visaoGeral(rh());
      expect(r.data.quadro.total).toBeGreaterThan(0);
      expect(r.data.escopoOrganizacional).toBe(true);
      expect(Array.isArray(r.data.distribuicoes.porSetor)).toBe(true);
      // Turnover é número, não Infinity nem NaN.
      expect(Number.isFinite(r.data.movimentacao.turnoverPercentual)).toBe(true);
    });

    it("exporta CSV com BOM, cabeçalho e uma linha por colaborador", async () => {
      const { nome, conteudo } = await reports.exportarQuadro(rh());
      expect(nome).toMatch(/^colaboradores-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(conteudo.startsWith("﻿")).toBe(true);
      expect(conteudo).toContain("Matrícula;Nome;");

      const linhas = conteudo.trim().split("\r\n");
      const quadro = await reports.visaoGeral(rh());
      expect(linhas.length - 1).toBe(quadro.data.quadro.total);
    });

    it("soma o custo dos benefícios vigentes no painel", async () => {
      const r = await reports.beneficiosGeral(rh());
      expect(r.data.custoMensalTotal).toBeGreaterThan(0);
      expect(r.data.pessoasCobertas).toBeGreaterThan(0);
    });

    it("traz a média de desempenho por ciclo", async () => {
      const r = await reports.desenvolvimentoGeral(rh());
      const ciclo = r.data.desempenhoPorCiclo.find((c: any) => c.ciclo === "2026.1");
      expect(ciclo?.media).toBe(4.5);
    });
  });

  // ── Remuneração ──────────────────────────────────────────────────────────
  describe("remuneração", () => {
    let pessoaId: string;
    let cargoId: string;

    beforeAll(async () => {
      const cargo = await (prisma as any).position.create({
        data: {
          id: `it-pos-${randomUUID()}`, organizationId: orgId,
          titulo: `Analista Sal ${randomUUID().slice(0, 6)}`,
          salarioMinimo: 5000, salarioMedio: 7000, salarioMaximo: 9000,
        },
      });
      cargoId = cargo.id;

      const p = await employees.criar(rh(), {
        nomeCompleto: "Salário Teste", dataAdmissao: "2023-01-10",
      } as any);
      pessoaId = p.data.id;
      await (prisma as any).collaborator.update({
        where: { id: pessoaId }, data: { positionId: cargoId },
      });
    });

    it("registra a admissão e calcula posição na faixa", async () => {
      await salarios.registrar(rh(), pessoaId, {
        valor: 6000, vigenciaInicio: "2023-01-10", motivo: "admissao",
      } as any);

      const s = await salarios.situacao(rh(), pessoaId);
      expect(s.data.vigente?.valor).toBe(6000);
      expect(s.data.faixa?.posicao).toBe("dentro");
      // 6000 numa faixa 5000–9000 é 25% do caminho.
      expect(s.data.faixa?.percentual).toBe(25);
    });

    it("calcula a variação entre registros", async () => {
      await salarios.registrar(rh(), pessoaId, {
        valor: 7200, vigenciaInicio: "2024-06-01", motivo: "merito",
      } as any);

      const s = await salarios.situacao(rh(), pessoaId);
      expect(s.data.vigente?.valor).toBe(7200);
      expect(s.data.historico[0].variacaoPercentual).toBe(20);
      // A admissão não tem com o que comparar.
      expect(s.data.historico[1].variacaoPercentual).toBeNull();
    });

    it("recusa duas mudanças na mesma vigência", async () => {
      await expect(
        salarios.registrar(rh(), pessoaId, {
          valor: 7500, vigenciaInicio: "2024-06-01", motivo: "merito",
        } as any),
      ).rejects.toThrow(/vigência|já existe/i);
    });

    // Redução tem restrição legal: o sistema exige que fique declarada.
    it("recusa redução disfarçada de mérito", async () => {
      await expect(
        salarios.registrar(rh(), pessoaId, {
          valor: 6500, vigenciaInicio: "2025-01-01", motivo: "merito",
        } as any),
      ).rejects.toThrow(/redução/i);
    });

    it("aceita vigência futura sem mudar o salário de hoje", async () => {
      const futuro = new Date();
      futuro.setFullYear(futuro.getFullYear() + 1);
      await salarios.registrar(rh(), pessoaId, {
        valor: 9500, vigenciaInicio: futuro.toISOString().slice(0, 10), motivo: "promocao",
      } as any);

      const s = await salarios.situacao(rh(), pessoaId);
      // O combinado para o ano que vem não pode subir o custo agora.
      expect(s.data.vigente?.valor).toBe(7200);
      expect(s.data.historico[0].valor).toBe(9500);
    });

    it("registra a mudança na linha do tempo funcional", async () => {
      const hist = await employees.historicoDe(rh(), pessoaId);
      expect(hist.data.some((e: any) => /Salário/.test(e.descricao))).toBe(true);
      // Promoção usa o evento próprio, não "outro".
      expect(hist.data.some((e: any) => e.evento === "promocao")).toBe(true);
    });

    it("acusa quem está fora da faixa do cargo", async () => {
      const fora = await employees.criar(rh(), { nomeCompleto: "Acima da Faixa" } as any);
      await (prisma as any).collaborator.update({
        where: { id: fora.data.id }, data: { positionId: cargoId },
      });
      await salarios.registrar(rh(), fora.data.id, {
        valor: 12000, vigenciaInicio: "2024-01-01", motivo: "enquadramento",
      } as any);

      const painel = await salarios.painel(rh());
      const achado = painel.data.foraDaFaixa.find((f: any) => f.collaboratorId === fora.data.id);
      expect(achado?.posicao).toBe("acima");
      expect(painel.data.massaSalarial).toBeGreaterThan(0);
    });

    it("recusa faixa incoerente", async () => {
      await expect(
        salarios.definirFaixa(rh(), cargoId, { minimo: 9000, maximo: 5000 } as any),
      ).rejects.toThrow(/faixa|incoerente/i);
    });
  });

  // ── Feedback ─────────────────────────────────────────────────────────────
  describe("feedback", () => {
    let pessoaId: string;
    let autorId: string;

    beforeAll(async () => {
      const p = await employees.criar(rh(), { nomeCompleto: "Recebe Feedback" } as any);
      pessoaId = p.data.id;
      const a = await employees.criar(rh(), { nomeCompleto: "Dá Feedback" } as any);
      autorId = a.data.id;
    });

    it("registra e devolve o feedback compartilhado", async () => {
      await feedbacks.criar(rh(), pessoaId, {
        tipo: "elogio", conteudo: "Conduziu bem a virada do plantão.", autorId,
      } as any);

      const r = await feedbacks.listar(rh(), pessoaId, false);
      expect(r.data).toHaveLength(1);
      expect(r.data[0].autorNome).toBe("Dá Feedback");
    });

    // A anotação privada não pode sair no JSON de quem não pode vê-la.
    it("esconde o privado de quem não registra feedback", async () => {
      await feedbacks.criar(rh(), pessoaId, {
        tipo: "um_a_um", conteudo: "Anotação a tratar na próxima conversa.",
        visibilidade: "privado", autorId,
      } as any);

      const comPrivado = await feedbacks.listar(rh(), pessoaId, true);
      const semPrivado = await feedbacks.listar(rh(), pessoaId, false);
      expect(comPrivado.data).toHaveLength(2);
      expect(semPrivado.data).toHaveLength(1);
      expect(semPrivado.data.some((f: any) => f.visibilidade === "privado")).toBe(false);
    });

    it("recusa feedback do avaliado sobre si mesmo", async () => {
      await expect(
        feedbacks.criar(rh(), pessoaId, {
          tipo: "elogio", conteudo: "Fui muito bem.", autorId: pessoaId,
        } as any),
      ).rejects.toThrow(/próprio avaliado/i);
    });

    it("usa a data de hoje quando nenhuma é informada", async () => {
      const r = await feedbacks.criar(rh(), pessoaId, {
        tipo: "reconhecimento", conteudo: "Ajudou o time novo.",
      } as any);
      const hoje = new Date().toDateString();
      expect(new Date(r.data.ocorridoEm).toDateString()).toBe(hoje);
    });
  });

  describe("plano de carreira", () => {
    let trilhaId: string;
    let cargoJr: string;
    let cargoPl: string;
    let cargoSr: string;
    let skillId: string;
    let cursoId: string;
    let degrauPl: string;
    let pessoaId: string;

    beforeAll(async () => {
      const sufixo = randomUUID().slice(0, 6);
      const cargo = async (titulo: string) =>
        (await (prisma as any).position.create({
          data: { id: `it-pos-${randomUUID()}`, organizationId: orgId, titulo },
        })).id;

      cargoJr = await cargo(`Dev Jr ${sufixo}`);
      cargoPl = await cargo(`Dev Pl ${sufixo}`);
      cargoSr = await cargo(`Dev Sr ${sufixo}`);

      skillId = (await (prisma as any).skill.create({
        data: { id: `it-sk-${randomUUID()}`, organizationId: orgId, nome: `Go ${sufixo}` },
      })).id;

      cursoId = (await (prisma as any).trainingCourse.create({
        data: { id: `it-tc-${randomUUID()}`, organizationId: orgId, nome: `Arquitetura ${sufixo}` },
      })).id;

      const t = await carreira.criarTrilha(rh(), { nome: `Engenharia ${sufixo}` });
      trilhaId = t.data.id;

      await carreira.adicionarDegrau(rh(), trilhaId, { positionId: cargoJr } as any);
      const pl = await carreira.adicionarDegrau(rh(), trilhaId, {
        positionId: cargoPl, mesesMinimos: 12, notaMinima: 3.5,
      } as any);
      degrauPl = pl.data.id;
      await carreira.adicionarDegrau(rh(), trilhaId, { positionId: cargoSr } as any);

      const p = await employees.criar(rh(), {
        nomeCompleto: "Carreira Teste", dataAdmissao: "2024-01-15",
      } as any);
      pessoaId = p.data.id;
      await (prisma as any).collaborator.update({
        where: { id: pessoaId }, data: { positionId: cargoJr },
      });
    });

    it("numera os degraus na ordem em que entram", async () => {
      const t = await carreira.listarTrilhas(rh(), true);
      const minha = t.data.find((x: any) => x.id === trilhaId);
      expect(minha.degraus.map((d: any) => d.ordem)).toEqual([1, 2, 3]);
    });

    it("recusa o mesmo cargo duas vezes na trilha", async () => {
      // O degrau atual é descoberto pelo cargo; repetir tornaria isso ambíguo.
      await expect(
        carreira.adicionarDegrau(rh(), trilhaId, { positionId: cargoJr } as any),
      ).rejects.toThrow();
    });

    it("infere a trilha pelo cargo quando nenhuma foi atribuída", async () => {
      const r = await carreira.situacao(rh(), pessoaId);
      expect(r.data.inferida).toBe(true);
      expect(r.data.trilha.id).toBe(trilhaId);
      expect(r.data.degrauAtual.ordem).toBe(1);
      expect(r.data.proximoDegrau.ordem).toBe(2);
    });

    it("cobra tempo e nota do próximo degrau", async () => {
      const r = await carreira.situacao(rh(), pessoaId);
      const p = r.data.prontidao;
      const tempo = p.criterios.find((c: any) => c.rotulo === "Tempo no cargo");
      const nota = p.criterios.find((c: any) => c.rotulo === "Desempenho");

      // Admitida em 2024-01-15 e sem mudança de cargo: já passou de 12 meses.
      expect(tempo.situacao).toBe("atendido");
      // Nenhuma avaliação finalizada — aqui a ausência É a pendência.
      expect(nota.situacao).toBe("pendente");
      expect(p.pronto).toBe(false);
    });

    it("avalia competência pelo nível alcançado", async () => {
      await carreira.adicionarRequisito(rh(), degrauPl, {
        tipo: "competencia", skillId, nivelMinimo: "senior",
      } as any);

      const antes = await carreira.situacao(rh(), pessoaId);
      expect(antes.data.prontidao.requisitos[0].situacao).toBe("pendente");

      await (prisma as any).collaboratorSkill.create({
        data: { id: `it-cs-${randomUUID()}`, collaboratorId: pessoaId, skillId, nivel: "junior" },
      });
      const junior = await carreira.situacao(rh(), pessoaId);
      expect(junior.data.prontidao.requisitos[0].situacao).toBe("pendente");
      expect(junior.data.prontidao.requisitos[0].nivelAtual).toBe("junior");

      await (prisma as any).collaboratorSkill.updateMany({
        where: { collaboratorId: pessoaId, skillId }, data: { nivel: "especialista" },
      });
      const especialista = await carreira.situacao(rh(), pessoaId);
      expect(especialista.data.prontidao.requisitos[0].situacao).toBe("atendido");
    });

    it("só conta treinamento CONCLUÍDO", async () => {
      const r = await carreira.adicionarRequisito(rh(), degrauPl, {
        tipo: "treinamento", trainingId: cursoId,
      } as any);
      const reqId = r.data.id;

      const participacao = await (prisma as any).collaboratorTraining.create({
        data: {
          id: `it-ct-${randomUUID()}`, organizationId: orgId,
          collaboratorId: pessoaId, trainingId: cursoId, status: "EM_ANDAMENTO",
        },
      });

      const andando = await carreira.situacao(rh(), pessoaId);
      expect(andando.data.prontidao.requisitos.find((q: any) => q.id === reqId).situacao).toBe("pendente");

      await (prisma as any).collaboratorTraining.update({
        where: { id: participacao.id },
        data: { status: "CONCLUIDO", conclusao: new Date() },
      });

      const concluido = await carreira.situacao(rh(), pessoaId);
      expect(concluido.data.prontidao.requisitos.find((q: any) => q.id === reqId).situacao).toBe("atendido");
    });

    it("requisito manual nunca é dado como atendido e fica fora do percentual", async () => {
      const r = await carreira.adicionarRequisito(rh(), degrauPl, {
        tipo: "manual", descricao: "Conduzir uma entrega crítica",
      } as any);

      const s = await carreira.situacao(rh(), pessoaId);
      const item = s.data.prontidao.requisitos.find((q: any) => q.id === r.data.id);
      expect(item.situacao).toBe("conferencia_manual");
      expect(s.data.prontidao.conferenciasManuais).toBeGreaterThan(0);
    });

    it("recusa requisito sem alvo", async () => {
      await expect(
        carreira.adicionarRequisito(rh(), degrauPl, { tipo: "competencia" } as any),
      ).rejects.toThrow();
      await expect(
        carreira.adicionarRequisito(rh(), degrauPl, { tipo: "manual", descricao: "  " } as any),
      ).rejects.toThrow();
    });

    it("reordena os degraus", async () => {
      const antes = await carreira.listarTrilhas(rh(), true);
      const minha = antes.data.find((x: any) => x.id === trilhaId);
      const ids = [...minha.degraus].sort((a: any, b: any) => a.ordem - b.ordem).map((d: any) => d.id);

      await carreira.reordenarDegraus(rh(), trilhaId, { ids: [ids[2], ids[0], ids[1]] });

      const depois = await carreira.listarTrilhas(rh(), true);
      const nova = depois.data.find((x: any) => x.id === trilhaId);
      const porOrdem = [...nova.degraus].sort((a: any, b: any) => a.ordem - b.ordem).map((d: any) => d.id);
      expect(porOrdem).toEqual([ids[2], ids[0], ids[1]]);

      // Devolve a ordem original para não contaminar os testes seguintes.
      await carreira.reordenarDegraus(rh(), trilhaId, { ids });
    });

    it("recusa reordenação que não cubra exatamente os degraus da trilha", async () => {
      await expect(
        carreira.reordenarDegraus(rh(), trilhaId, { ids: ["inexistente"] }),
      ).rejects.toThrow();
    });

    it("no topo da trilha não há próximo degrau nem prontidão", async () => {
      await (prisma as any).collaborator.update({
        where: { id: pessoaId }, data: { positionId: cargoSr },
      });
      const r = await carreira.situacao(rh(), pessoaId);
      expect(r.data.noTopo).toBe(true);
      expect(r.data.proximoDegrau).toBeNull();
      expect(r.data.prontidao).toBeNull();

      await (prisma as any).collaborator.update({
        where: { id: pessoaId }, data: { positionId: cargoJr },
      });
    });

    it("cargo fora de qualquer trilha não inventa plano", async () => {
      const solto = await employees.criar(rh(), { nomeCompleto: "Sem Trilha" } as any);
      const r = await carreira.situacao(rh(), solto.data.id);
      expect(r.data.trilha).toBeNull();
      expect(r.data.motivo).toContain("cargo");
    });

    it("atribui e desfaz a trilha do colaborador", async () => {
      await carreira.definirTrilhaDoColaborador(rh(), pessoaId, { careerTrackId: trilhaId });
      const atribuida = await carreira.situacao(rh(), pessoaId);
      expect(atribuida.data.inferida).toBe(false);

      await carreira.definirTrilhaDoColaborador(rh(), pessoaId, { careerTrackId: null });
      const desfeita = await carreira.situacao(rh(), pessoaId);
      // Volta a ser deduzida pelo cargo, não some.
      expect(desfeita.data.inferida).toBe(true);
    });

    it("remover degrau renumera o que sobrou", async () => {
      const t = await carreira.listarTrilhas(rh(), true);
      const minha = t.data.find((x: any) => x.id === trilhaId);
      const doMeio = minha.degraus.find((d: any) => d.ordem === 2);

      await carreira.removerDegrau(rh(), doMeio.id);

      const depois = await carreira.listarTrilhas(rh(), true);
      const nova = depois.data.find((x: any) => x.id === trilhaId);
      expect(nova.degraus.map((d: any) => d.ordem).sort()).toEqual([1, 2]);
    });

    it("promove trocando o cargo e registrando o motivo", async () => {
      const antes = await carreira.situacao(rh(), pessoaId);
      const destino = antes.data.proximoDegrau;
      expect(destino).not.toBeNull();

      await carreira.promover(rh(), pessoaId, {
        stepId: destino.id, motivo: "Assumiu a liderança técnica",
      } as any);

      // O cargo mudou de verdade — não é um carimbo paralelo.
      const perfil = await employees.obter(rh(), pessoaId);
      expect(perfil.data.position?.id).toBe(
        (antes.data.degraus ?? []).find((d: any) => d.id === destino.id) && perfil.data.position?.id,
      );
      expect(perfil.data.position?.titulo).toBe(destino.cargo);

      // E a linha do tempo ganhou promoção COM motivo, além do `mudanca_cargo`
      // que o caminho de edição já grava.
      const hist = await employees.historicoDe(rh(), pessoaId);
      const promocao = hist.data.find((e: any) => e.evento === "promocao");
      expect(promocao).toBeDefined();
      expect(promocao.descricao).toContain("Assumiu a liderança técnica");
      expect(hist.data.some((e: any) => e.evento === "mudanca_cargo")).toBe(true);

      // Agora ela está no degrau de destino.
      const depois = await carreira.situacao(rh(), pessoaId);
      expect(depois.data.degrauAtual.id).toBe(destino.id);
    });

    it("recusa promover para trás — isso é rebaixamento, não promoção", async () => {
      const s = await carreira.situacao(rh(), pessoaId);
      const anterior = (s.data.degraus ?? []).find((d: any) => d.ordem < s.data.degrauAtual.ordem);
      if (!anterior) return; // trilha de um degrau só: nada a testar

      await expect(
        carreira.promover(rh(), pessoaId, { stepId: anterior.id } as any),
      ).rejects.toThrow(/à frente|frente/i);
    });

    it("não deixa excluir cargo que é degrau de trilha", async () => {
      // RESTRICT no banco: apagar abriria buraco no meio da progressão.
      await expect(
        (prisma as any).position.delete({ where: { id: cargoJr } }),
      ).rejects.toThrow();
    });
  });

  describe("checklist de admissão", () => {
    let modeloId: string;
    let pessoaId: string;

    beforeAll(async () => {
      const m = await checklists.criarModelo(rh(), {
        nome: `Admissão padrão ${randomUUID().slice(0, 6)}`,
        evento: "admissao",
      } as any);
      modeloId = m.data.id;

      await checklists.adicionarItemModelo(rh(), modeloId, {
        titulo: "Entregar documentos", responsavel: "colaborador", prazoDias: 5,
      } as any);
      await checklists.adicionarItemModelo(rh(), modeloId, {
        titulo: "Exame admissional", responsavel: "rh", prazoDias: 2,
      } as any);
      await checklists.adicionarItemModelo(rh(), modeloId, {
        titulo: "Crachá", responsavel: "rh", obrigatorio: false,
      } as any);

      // Admitido há 30 dias: os prazos de 5 e 2 dias já estouraram.
      const admissao = new Date();
      admissao.setDate(admissao.getDate() - 30);
      const p = await employees.criar(rh(), {
        nomeCompleto: "Recém Chegado",
        dataAdmissao: admissao.toISOString().slice(0, 10),
      } as any);
      pessoaId = p.data.id;
    });

    it("abre copiando os itens do modelo", async () => {
      const r = await checklists.abrir(rh(), pessoaId, { evento: "admissao" } as any);
      expect(r.data.total).toBe(3);
      expect(r.data.itens.map((i: any) => i.ordem)).toEqual([1, 2, 3]);
      expect(r.data.percentual).toBe(0);
    });

    it("acusa atraso contando do dia da ADMISSÃO, não da abertura", async () => {
      const [c] = (await checklists.doColaborador(rh(), pessoaId)).data;
      // Dois obrigatórios com prazo estourado; o opcional não tem prazo.
      expect(c.atrasados).toBe(2);
      expect(c.itens.find((i: any) => i.titulo === "Crachá").situacao).toBe("pendente");
    });

    it("recusa abrir dois checklists do mesmo evento", async () => {
      await expect(
        checklists.abrir(rh(), pessoaId, { evento: "admissao" } as any),
      ).rejects.toThrow();
    });

    it("item opcional não impede a conclusão", async () => {
      const [c] = (await checklists.doColaborador(rh(), pessoaId)).data;
      const obrigatorios = c.itens.filter((i: any) => i.obrigatorio);

      for (const i of obrigatorios) {
        await checklists.marcarItem(rh(), i.id, { concluido: true } as any);
      }

      const [depois] = (await checklists.doColaborador(rh(), pessoaId)).data;
      expect(depois.percentual).toBe(100);
      expect(depois.concluidoEm).not.toBeNull();
      // O opcional segue pendente e visível.
      expect(depois.itens.find((i: any) => i.titulo === "Crachá").situacao).toBe("pendente");
    });

    it("desmarcar reabre o checklist", async () => {
      // Item marcado por engano travaria a conclusão numa mentira; corrigir não
      // pode exigir apagar o checklist inteiro.
      const [c] = (await checklists.doColaborador(rh(), pessoaId)).data;
      const um = c.itens.find((i: any) => i.obrigatorio && i.situacao === "concluido");

      await checklists.marcarItem(rh(), um.id, { concluido: false } as any);

      const [depois] = (await checklists.doColaborador(rh(), pessoaId)).data;
      expect(depois.concluidoEm).toBeNull();
      expect(depois.percentual).toBeLessThan(100);
    });

    it("mudar o modelo NÃO reescreve checklist já aberto", async () => {
      // O histórico não pode mentir sobre o que foi exigido na época.
      await checklists.adicionarItemModelo(rh(), modeloId, {
        titulo: "Item novo no modelo",
      } as any);

      const [c] = (await checklists.doColaborador(rh(), pessoaId)).data;
      expect(c.total).toBe(3);
      expect(c.itens.some((i: any) => i.titulo === "Item novo no modelo")).toBe(false);
    });

    it("o painel ordena por atraso", async () => {
      const r = await checklists.painel(rh());
      expect(r.data.checklists.some((c: any) => c.colaborador.id === pessoaId)).toBe(true);
    });

    it("excluir o modelo não leva junto os checklists abertos", async () => {
      await checklists.excluirModelo(rh(), modeloId);
      const lista = await checklists.doColaborador(rh(), pessoaId);
      expect(lista.data).toHaveLength(1);
      expect(lista.data[0].total).toBe(3);
    });
  });

  // ── Isolamento ───────────────────────────────────────────────────────────
  it("não enxerga colaborador de outra organização", async () => {
    const outraOrg = `it-org2-${randomUUID()}`;
    await (prisma as any).organization.create({
      data: { id: outraOrg, nome: "Outra", slug: `it2-${randomUUID().slice(0, 8)}` },
    });
    const alheio = await (prisma as any).collaborator.create({
      data: { id: `it-c-${randomUUID()}`, organizationId: outraOrg, nomeCompleto: "De Outra Org" },
    });

    try {
      await expect(employees.obter(rh(), alheio.id)).rejects.toThrow();
      const lista = await employees.listar(rh(), {} as any);
      expect(lista.data.some((c: any) => c.id === alheio.id)).toBe(false);
    } finally {
      await (prisma as any).organization.deleteMany({ where: { id: outraOrg } });
    }
  });
});
