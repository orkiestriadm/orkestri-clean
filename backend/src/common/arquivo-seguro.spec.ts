import { BadRequestException } from "@nestjs/common";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  extensaoSegura, nomeDeArquivoSeguro, conteudoConfere,
  filtroDeTipo, validarArquivoGravado, caminhoDentroDe, MIMES_ACEITOS,
} from "./arquivo-seguro";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const HTML = Buffer.from("<html><script>alert(1)</script></html>".padEnd(16, " "));

describe("extensao — nunca vem do nome enviado", () => {
  /**
   * O nucleo do defeito: `path.extname(file.originalname)` deixava o remetente
   * escolher a extensao. Com `Content-Type: image/png` e nome `x.html`, o
   * arquivo era gravado como `.html` e o nginx o servia como PAGINA, na origem
   * da aplicacao — XSS armazenado com acesso a sessao de quem abrisse.
   */
  it("deriva a extensao do tipo aceito", () => {
    expect(extensaoSegura("image/png")).toBe(".png");
    expect(extensaoSegura("application/pdf")).toBe(".pdf");
  });

  it("NENHUM tipo aceito produz extensao executavel pelo navegador", () => {
    const perigosas = [".html", ".htm", ".svg", ".xhtml", ".js", ".mjs", ".php"];
    for (const mime of MIMES_ACEITOS) {
      expect(perigosas).not.toContain(extensaoSegura(mime));
    }
  });

  it("tipo desconhecido cai em .bin, nunca no que veio no nome", () => {
    expect(extensaoSegura("text/html")).toBe(".bin");
    expect(extensaoSegura("image/svg+xml")).toBe(".bin");
  });

  it("o nome gerado nao carrega nada do arquivo enviado", () => {
    const nome = nomeDeArquivoSeguro("image/png");
    expect(nome).toMatch(/^\d+-[a-z0-9]+\.png$/);
    expect(nome).not.toContain("html");
  });
});

describe("filtroDeTipo", () => {
  it("aceita tipo da lista", () => {
    const cb = jest.fn();
    filtroDeTipo(null, { mimetype: "application/pdf" }, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it("recusa text/html", () => {
    const cb = jest.fn();
    filtroDeTipo(null, { mimetype: "text/html" }, cb);
    expect(cb.mock.calls[0][0]).toBeInstanceOf(BadRequestException);
    expect(cb.mock.calls[0][1]).toBe(false);
  });

  it("recusa image/svg+xml — SVG carrega script", () => {
    const cb = jest.fn();
    filtroDeTipo(null, { mimetype: "image/svg+xml" }, cb);
    expect(cb.mock.calls[0][1]).toBe(false);
  });
});

describe("conteudoConfere — o unico sinal que o remetente nao controla", () => {
  it("aceita PNG de verdade declarado como PNG", () => {
    expect(conteudoConfere(PNG, "image/png")).toBe(true);
  });

  /** O caso do ataque: cabecalho diz imagem, conteudo e HTML. */
  it("recusa HTML declarado como PNG", () => {
    expect(conteudoConfere(HTML, "image/png")).toBe(false);
  });

  it("recusa PDF declarado como PNG", () => {
    expect(conteudoConfere(PDF, "image/png")).toBe(false);
  });

  it("aceita formatos sem assinatura — a extensao forcada ja os torna inertes", () => {
    expect(conteudoConfere(HTML, "text/plain")).toBe(true);
    expect(extensaoSegura("text/plain")).toBe(".txt");
  });

  it("recusa tipo fora da lista", () => {
    expect(conteudoConfere(PNG, "text/html")).toBe(false);
  });
});

describe("validarArquivoGravado", () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "arqseg-")); });
  afterEach(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });

  it("deixa passar arquivo coerente", () => {
    const p = path.join(dir, "ok.png");
    fs.writeFileSync(p, PNG);
    expect(() => validarArquivoGravado(p, "image/png")).not.toThrow();
    expect(fs.existsSync(p)).toBe(true);
  });

  /**
   * O arquivo reprovado tem de SAIR do disco. Deixa-lo la, mesmo sem registro
   * no banco, mantem o conteudo alcancavel por quem souber a URL.
   */
  it("APAGA o arquivo quando o conteudo nao corresponde", () => {
    const p = path.join(dir, "mentira.png");
    fs.writeFileSync(p, HTML);
    expect(() => validarArquivoGravado(p, "image/png")).toThrow(BadRequestException);
    expect(fs.existsSync(p)).toBe(false);
  });

  it("falha fechado quando nao consegue ler", () => {
    expect(() => validarArquivoGravado(path.join(dir, "nao-existe.png"), "image/png"))
      .toThrow(BadRequestException);
  });
});

describe("caminhoDentroDe — impede escapar do diretorio", () => {
  it("aceita caminho abaixo da base", () => {
    const base = path.resolve("/app/uploads");
    expect(caminhoDentroDe(base, "chamado-1", "a.png")).toContain("chamado-1");
  });

  it("recusa ..", () => {
    const base = path.resolve("/app/uploads");
    expect(() => caminhoDentroDe(base, "..", "..", "etc", "passwd")).toThrow(BadRequestException);
  });
});
