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

descreve("People — integração", () => {
  let prisma: PrismaService;
  let employees: EmployeeService;
  let documents: DocumentService;
  let vacations: VacationService;
  let benefits: BenefitService;
  let development: DevelopmentService;
  let reports: ReportService;
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

    const modulo = await Test.createTestingModule({ imports: [PeopleModule] }).compile();
    await modulo.init();

    prisma = modulo.get(PrismaService);
    employees = modulo.get(EmployeeService);
    documents = modulo.get(DocumentService);
    vacations = modulo.get(VacationService);
    benefits = modulo.get(BenefitService);
    development = modulo.get(DevelopmentService);
    reports = modulo.get(ReportService);

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
