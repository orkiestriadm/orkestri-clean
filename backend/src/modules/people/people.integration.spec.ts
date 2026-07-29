import { Test } from "@nestjs/testing";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { PeopleModule } from "./people.module";
import { EmployeeService } from "./application/employee.service";
import { DocumentService } from "./application/document.service";

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
