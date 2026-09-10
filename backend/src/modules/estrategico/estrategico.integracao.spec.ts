import { randomUUID } from "crypto";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import * as XLSX from "xlsx";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.module";
import { NotificacaoDispatcher } from "../notifications/notificacao-dispatcher.service";
import { CasoRepository } from "./infrastructure/caso.repository";
import { DocumentoStorageService } from "./infrastructure/documento-storage.service";
import { CasoService } from "./application/caso.service";
import { AtividadeService } from "./application/atividade.service";
import { AvisoService } from "./application/aviso.service";
import { DocumentoService } from "./application/documento.service";
import { PainelService } from "./application/painel.service";
import { RelatorioService, TIPOS_RELATORIO } from "./application/relatorio.service";
import { ReuniaoService } from "./application/reuniao.service";
import { ImportacaoService } from "./application/importacao.service";
import { AutomacaoService } from "./application/automacao.service";
import { AdminService } from "./application/admin.service";

/**
 * Integração contra um Postgres DE VERDADE.
 *
 * Só roda com `ESTRATEGICO_DB_TEST_URL` apontando para um banco DESCARTÁVEL já
 * com o schema aplicado — nunca homologação ou produção: o teste cria e apaga
 * uma organização inteira. Sem a variável, a suíte é pulada.
 *
 *   ESTRATEGICO_DB_TEST_URL=postgresql://postgres:teste@localhost:55439/est npx jest estrategico.integracao
 *
 * Dados sintéticos: nada da planilha real entra no repositório.
 */

const URL_TESTE = process.env.ESTRATEGICO_DB_TEST_URL;
const suite = URL_TESTE ? describe : describe.skip;

jest.setTimeout(120_000);

suite("Strategy — integração com banco real", () => {
  let prisma: any;
  let casos: CasoService;
  let atividade: AtividadeService;
  let documentos: DocumentoService;
  let painel: PainelService;
  let relatorios: RelatorioService;
  let reunioes: ReuniaoService;
  let importacao: ImportacaoService;
  let automacao: AutomacaoService;
  let admin: AdminService;
  let pastaDocs: string;

  const org = randomUUID();
  const master = randomUUID();
  const resp = randomUUID();
  const leitor = randomUUID();

  const MASTER = () => ({ id: master, organizationId: org, isMaster: true });
  const U = (id: string, permissions: string[]) => ({ id, organizationId: org, permissions });
  const iso = (diasAtras: number) => new Date(Date.now() - diasAtras * 86_400_000).toISOString().slice(0, 10);

  function planilha(): any {
    const cab = [null, "Assunto", "Objetivo", "Principais Andamentos", "Valor envolvido - Pretensão", "Valor - Alcançado", "Valor de Reequilíbrio", "Esfera", "Status Atual", "Área Responsável", null];
    const grupo = (n: string) => [null, n, null, null, null, null, null, null, null, null, null];
    const linhas = [
      [null, "ACOMPANHAMENTO"], cab,
      grupo("Reequilíbrio"),
      [null, "Caso Alfa", "Reequilíbrio", "01/07/2026 - Protocolo do pedido", null, null, null, "Administrativa", "Aguardando ANTT", "Regulatório/ Jurídico", "Em andamento"],
      [null, "Caso Beta", "Reequilíbrio", "Texto sem data.", null, null, 2500000, "Judicial", "Aguardando judiciário", "Jurídico", "Em andamento"],
      grupo("Oportunidades"),
      [null, "Oportunidade Gama", "Reequilíbrio", null, null, null, null, "Administrativa", "Aguardando levantamento - Time Financeiro", "Financeiro", "Em andamento"],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), "Assuntos");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return { buffer, originalname: "teste.xlsx", size: buffer.length };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_TESTE;
    pastaDocs = fs.mkdtempSync(path.join(os.tmpdir(), "est-docs-"));
    process.env.ESTRATEGICO_DOCS_DIR = pastaDocs;

    prisma = new PrismaService();
    await prisma.$connect();
    await prisma.organization.create({ data: { id: org, nome: "Org de teste", slug: `teste-${org}` } });
    for (const [id, nome] of [[master, "Master"], [resp, "Responsável"], [leitor, "Leitor"]]) {
      await prisma.user.create({ data: { id, organizationId: org, nome, email: `${id}@teste.local`, senhaHash: "x" } });
    }

    const audit = new AuditService(prisma);
    const repo = new CasoRepository(prisma);
    const aviso = new AvisoService(prisma, new NotificacaoDispatcher(prisma));
    casos = new CasoService(prisma, repo, audit);
    atividade = new AtividadeService(prisma, repo, casos, aviso, audit);
    documentos = new DocumentoService(prisma, repo, casos, new DocumentoStorageService(), audit);
    painel = new PainelService(prisma, casos);
    relatorios = new RelatorioService(prisma, casos, painel);
    reunioes = new ReuniaoService(prisma, repo, casos, atividade, aviso, audit);
    importacao = new ImportacaoService(prisma, audit);
    automacao = new AutomacaoService(prisma, repo, casos, aviso);
    admin = new AdminService(prisma, repo, audit);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.organization.delete({ where: { id: org } }).catch(() => {});
      await prisma.$disconnect();
    }
    if (pastaDocs) fs.rmSync(pastaDocs, { recursive: true, force: true });
  });

  it("importa a planilha com prévia e é idempotente", async () => {
    const previa = await importacao.previa(MASTER(), planilha());
    expect(previa.resumo).toMatchObject({ casos: 3, novos: 3, jaImportados: 0, eventos: 1 });

    const r = await importacao.confirmar(MASTER(), planilha());
    expect(r.criados.map(c => c.codigo)).toEqual(["EST-0001", "EST-0002", "EST-0003"]);
    expect(r.dependencias).toBe(3);

    const r2 = await importacao.confirmar(MASTER(), planilha());
    expect(r2.criados).toHaveLength(0);
    expect(r2.ignorados).toHaveLength(3);

    const lista = await casos.listar(MASTER(), {});
    expect(lista.total).toBe(3);
    expect(lista.contagens.revisar).toBe(3);
    const beta = lista.itens.find(c => c.titulo === "Caso Beta")!;
    expect(beta.valorReequilibrio).toBe(2500000);
    expect(beta.dependenciaTexto).toBe("Aguardando Judiciário");
    const gama = lista.itens.find(c => c.titulo === "Oportunidade Gama")!;
    expect(gama.farol).toBe("azul");
  });

  it("atualiza etapa, próxima ação e valor gravando trilha, timeline e histórico financeiro", async () => {
    const alfa = (await casos.listar(MASTER(), { q: "Alfa" })).itens[0];
    const r = await casos.atualizar(MASTER(), alfa.id, {
      etapa: "protocolado", motivo: "Protocolo realizado", proximaAcao: "Cobrar manifestação",
      proximaAcaoPrazo: iso(-20), proximaAcaoResponsavelId: resp, valorPretendido: 100_000_000,
      observacaoValor: "Estudo econômico",
    } as any);
    expect(r.etapa).toBe("protocolado");
    expect(r.semProximaAcao).toBe(false);
    expect(r.farol).not.toBe("vermelho");

    const hist = await casos.historico(MASTER(), alfa.id);
    const acoes = hist.map((h: any) => h.acao);
    expect(acoes).toEqual(expect.arrayContaining(["mudou_etapa", "mudou_valor", "mudou_responsavel", "mudou_prazo"]));

    const valores = await casos.valores(MASTER(), alfa.id);
    expect(valores[valores.length - 1]).toMatchObject({ campo: "valorPretendido", valorNovo: 100_000_000, observacao: "Estudo econômico" });

    const eventos = await atividade.eventos(MASTER(), alfa.id);
    expect(eventos.some((e: any) => e.tipo === "alteracao_status")).toBe(true);
  });

  it("aplica permissão linha a linha e protege o financeiro", async () => {
    const { itens } = await casos.listar(MASTER(), {});
    const alfa = itens.find(c => c.titulo === "Caso Alfa")!;
    const beta = itens.find(c => c.titulo === "Caso Beta")!;
    const responsavel = U(resp, ["estrategico.caso:ver", "estrategico.caso:editar_proprios"]);

    await expect(casos.atualizar(responsavel, beta.id, { prioridade: "alta" } as any)).rejects.toThrow(/responsabilidade/);
    expect((await casos.atualizar(responsavel, alfa.id, { prioridade: "alta" } as any)).prioridade).toBe("alta");
    await expect(casos.atualizar(responsavel, alfa.id, { valorPretendido: 1 } as any)).rejects.toThrow(/financeiros/);

    const semFin = await casos.obter(U(leitor, ["estrategico.caso:ver"]), alfa.id);
    expect(semFin.financeiroVisivel).toBe(false);
    expect(semFin.valorPretendido).toBeNull();
    const histSemFin = await casos.historico(U(leitor, ["estrategico.caso:ver"]), alfa.id);
    expect(histSemFin.filter((h: any) => h.acao === "mudou_valor").every((h: any) => h.valorNovo === null)).toBe(true);
  });

  it("farol manual exige justificativa e fica registrado", async () => {
    const beta = (await casos.listar(MASTER(), { q: "Beta" })).itens[0];
    await expect(casos.definirFarol(MASTER(), beta.id, { farol: "vermelho", justificativa: "curta" })).rejects.toThrow(/Justifique/);
    const r = await casos.definirFarol(MASTER(), beta.id, { farol: "vermelho", justificativa: "Risco de condenação discutido com o jurídico" });
    expect(r.farol).toBe("vermelho");
    expect(r.farolManual).toBe("vermelho");
    const hist = await casos.historico(MASTER(), beta.id);
    expect(hist[0].acao).toBe("farol_manual");
    const volta = await casos.definirFarol(MASTER(), beta.id, { farol: null });
    expect(volta.farolManual).toBeNull();
  });

  it("automação cria cobrança de dependência externa uma vez por ciclo e a conclusão registra o follow-up", async () => {
    const alfa = (await casos.listar(MASTER(), { q: "Alfa" })).itens[0];
    const catalogos = await admin.catalogos(MASTER());
    const antt = catalogos.find((c: any) => c.tipo === "dependencia" && c.nome === "ANTT");
    const dep = alfa.dependencias[0];
    await atividade.atualizarDependencia(MASTER(), dep.id, { desde: iso(40), catalogoId: antt.id } as any);

    const r1 = await automacao.executar(org);
    expect(r1.followUps).toBe(1);
    const r2 = await automacao.executar(org);
    expect(r2.followUps).toBe(0);

    const tarefas = await atividade.tarefas(MASTER(), alfa.id);
    const cobranca = tarefas.find((t: any) => t.origem === "automacao")!;
    expect(cobranca.titulo).toMatch(/^Cobrar ANTT — aguardando há 40 dias/);
    expect(cobranca.responsavelId).toBe(resp);

    await atividade.atualizarTarefa(U(resp, ["estrategico.caso:ver", "estrategico.tarefa:executar"]), cobranca.id, { status: "concluida", conclusao: "Ofício enviado" } as any);
    const deps = await atividade.dependencias(MASTER(), alfa.id);
    expect(deps[0].ultimoFollowUpEm).not.toBeNull();
    const eventos = await atividade.eventos(MASTER(), alfa.id);
    expect(eventos[0]).toMatchObject({ tipo: "cobranca", origem: "sistema" });

    const notificacoes = await prisma.notification.count({ where: { userId: resp, modulo: "strategy" } });
    expect(notificacoes).toBeGreaterThan(0);
  });

  it("andamento com data futura é recusado; o válido atualiza a última movimentação", async () => {
    const beta = (await casos.listar(MASTER(), { q: "Beta" })).itens[0];
    await expect(atividade.criarEvento(MASTER(), beta.id, { tipo: "andamento", dataEvento: iso(-5), titulo: "Futuro" } as any)).rejects.toThrow(/já aconteceu/);
    await atividade.criarEvento(MASTER(), beta.id, { tipo: "decisao", dataEvento: iso(2), titulo: "Sentença", decisao: "Procedente em parte" } as any);
    const atual = await casos.obter(MASTER(), beta.id);
    // Coluna DATE: meia-noite UTC. `String(Date)` formataria no fuso local e recuaria um dia.
    expect(new Date(atual.ultimaMovimentacaoEm).toISOString().slice(0, 10)).toBe(iso(2));
  });

  it("painel e todos os relatórios geram dados; exportações saem nos três formatos", async () => {
    const p = await painel.painel(MASTER());
    expect(p.kpis.total).toBe(3);
    expect(p.valores!.valorPretendido).toBe(100_000_000);
    expect(p.pipeline.find(e => e.id === "em_estudo")!.quantidade).toBe(1);
    expect(p.quemPrecisaAgir.length).toBeGreaterThan(0);

    for (const t of TIPOS_RELATORIO) {
      const tabela = await relatorios.gerar(MASTER(), t.id);
      expect(Array.isArray(tabela.linhas)).toBe(true);
    }
    for (const formato of ["excel", "csv", "pdf"]) {
      const arq = await relatorios.exportar(MASTER(), "executivo", formato);
      expect(arq.conteudo.length).toBeGreaterThan(200);
    }
    await expect(relatorios.gerar(U(leitor, ["estrategico.relatorio:ver"]), "financeiro")).rejects.toThrow();
  });

  it("reunião: pauta gerada, decisão na timeline, tarefa e ata ao encerrar", async () => {
    const r = await reunioes.criar(MASTER(), { titulo: "Reunião de teste", dataReuniao: new Date().toISOString(), participantes: [{ userId: resp, nome: "x" }], agendar: true } as any);
    expect(r.pauta.map((s: any) => s.id)).toEqual(["criticos", "vencidos", "sem_atualizacao", "alterados", "oportunidades_novas", "decisoes_pendentes", "acoes_vencidas"]);
    const beta = (await casos.listar(MASTER(), { q: "Beta" })).itens[0];

    await reunioes.decidir(MASTER(), r.id, { casoId: beta.id, descricao: "Contratar parecer externo" });
    await reunioes.criarTarefa(MASTER(), r.id, { casoId: beta.id, titulo: "Cotar parecer", responsavelId: resp, prazo: iso(-10) } as any);
    await reunioes.anotar(MASTER(), r.id, { casoId: beta.id, discutido: true, nota: "Prioridade da Diretoria" });

    const encerrada = await reunioes.mudarStatus(MASTER(), r.id, "encerrada");
    expect(encerrada.status).toBe("encerrada");
    expect(encerrada.ata).toContain("2. DECISÕES");
    expect(encerrada.ata).toContain("Contratar parecer externo");
    expect(encerrada.ata).toContain("Cotar parecer");

    const eventos = await atividade.eventos(MASTER(), beta.id);
    expect(eventos.some((e: any) => e.origem === "reuniao" && e.tipo === "decisao")).toBe(true);
    expect(await prisma.event.count({ where: { origemTipo: "estrategico_reuniao", origemId: r.id } })).toBe(2);
    await expect(reunioes.decidir(MASTER(), r.id, { descricao: "depois" })).rejects.toThrow(/congeladas/);

    const pdf = await reunioes.ataPdf(MASTER(), r.id);
    expect(pdf.conteudo.length).toBeGreaterThan(500);
  });

  it("documento: grava fora da pasta pública, versiona e baixa", async () => {
    const alfa = (await casos.listar(MASTER(), { q: "Alfa" })).itens[0];
    const arq = (nome: string, texto: string) => ({ buffer: Buffer.from(texto), originalname: nome, size: texto.length, mimetype: "application/pdf" });
    const v1 = await documentos.enviar(MASTER(), alfa.id, { categoria: "parecer" } as any, arq("parecer.pdf", "%PDF versão 1"));
    const v2 = await documentos.enviar(MASTER(), alfa.id, { documentoOrigemId: v1.id } as any, arq("parecer-v2.pdf", "%PDF versão 2"));
    expect(v2.versao).toBe(2);
    expect(v2.categoria).toBe("parecer");
    expect(fs.existsSync(path.join(pastaDocs, v2.arquivoRef))).toBe(true);
    await expect(documentos.enviar(MASTER(), alfa.id, {} as any, arq("script.exe", "x"))).rejects.toThrow(/não aceito/);

    const { stream } = await documentos.paraDownload(MASTER(), v1.id);
    const conteudo = await new Promise<string>(res => { let s = ""; stream.on("data", c => (s += c)); stream.on("end", () => res(s)); });
    expect(conteudo).toBe("%PDF versão 1");
  });

  it("exclusão lógica tira da carteira e preserva o histórico", async () => {
    const gama = (await casos.listar(MASTER(), { q: "Gama" })).itens[0];
    await casos.excluir(MASTER(), gama.id);
    expect((await casos.listar(MASTER(), {})).total).toBe(2);
    const linhas = await prisma.estrategicoHistorico.count({ where: { casoId: gama.id } });
    expect(linhas).toBeGreaterThan(1);
    const r = await importacao.confirmar(MASTER(), planilha());
    expect(r.ignorados.find(i => i.titulo === "Oportunidade Gama")!.motivo).toMatch(/excluído/);
  });
});
