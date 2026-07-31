import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { DocumentStorageService } from "./document-storage.service";

/**
 * Documentos de colaborador não podem escapar do diretório da organização.
 * O caminho vem do nosso banco, mas isolamento não se apoia em "o dado é
 * confiável" — se um dia gravarem `../` ali, a leitura tem que falhar.
 */
describe("DocumentStorageService", () => {
  let raiz: string;
  let storage: DocumentStorageService;
  const envAnterior = process.env.PEOPLE_DOCS_DIR;

  beforeEach(() => {
    raiz = fs.mkdtempSync(path.join(os.tmpdir(), "people-docs-"));
    process.env.PEOPLE_DOCS_DIR = raiz;
    storage = new DocumentStorageService();
  });

  afterEach(() => {
    fs.rmSync(raiz, { recursive: true, force: true });
    if (envAnterior === undefined) delete process.env.PEOPLE_DOCS_DIR;
    else process.env.PEOPLE_DOCS_DIR = envAnterior;
  });

  it("compõe a referência começando pela organização", () => {
    // O isolamento por cliente fica visível no disco (MULTITENANT.md §16).
    expect(storage.refDe("org-a", "collab-1", "doc.pdf")).toBe("org-a/collab-1/doc.pdf");
  });

  it("grava e lê o arquivo de volta", async () => {
    const ref = await storage.gravar("org-a", "collab-1", "x.pdf", Buffer.from("conteudo"));
    expect(storage.existe(ref)).toBe(true);

    const lido = fs.readFileSync(path.join(raiz, ref), "utf8");
    expect(lido).toBe("conteudo");
  });

  it("cria a árvore de diretórios da organização", async () => {
    await storage.gravar("org-nova", "collab-9", "y.pdf", Buffer.from("x"));
    expect(fs.existsSync(path.join(raiz, "org-nova", "collab-9"))).toBe(true);
  });

  it("separa arquivos de organizações diferentes", async () => {
    const refA = await storage.gravar("org-a", "c1", "doc.pdf", Buffer.from("a"));
    const refB = await storage.gravar("org-b", "c1", "doc.pdf", Buffer.from("b"));

    expect(refA).not.toBe(refB);
    expect(fs.readFileSync(path.join(raiz, refA), "utf8")).toBe("a");
    expect(fs.readFileSync(path.join(raiz, refB), "utf8")).toBe("b");
  });

  it("recusa referência que escapa da raiz", () => {
    expect(storage.existe("../../../etc/passwd")).toBe(false);
    expect(storage.existe("org-a/../../fora.txt")).toBe(false);
  });

  it("não lê arquivo existente fora da raiz", () => {
    // Arquivo real no diretório-pai da raiz: sem a checagem, seria alcançável.
    const forcado = path.join(path.dirname(raiz), "alvo-secreto.txt");
    fs.writeFileSync(forcado, "segredo");
    try {
      expect(storage.existe(`../${path.basename(forcado)}`)).toBe(false);
    } finally {
      fs.rmSync(forcado, { force: true });
    }
  });

  it("remover arquivo inexistente não estoura", async () => {
    // A exclusão lógica do registro já aconteceu; falhar aqui não pode
    // derrubar a operação.
    await expect(storage.remover("org-a/c1/nao-existe.pdf")).resolves.toBeUndefined();
  });

  it("remove o arquivo do disco", async () => {
    const ref = await storage.gravar("org-a", "c1", "z.pdf", Buffer.from("x"));
    await storage.remover(ref);
    expect(storage.existe(ref)).toBe(false);
  });
});
