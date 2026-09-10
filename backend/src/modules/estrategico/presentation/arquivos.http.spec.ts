import { Test } from "@nestjs/testing";
import { INestApplication, Logger } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { PainelController } from "./painel.controller";
import { ReuniaoController } from "./reuniao.controller";
import { PainelService } from "../application/painel.service";
import { RelatorioService } from "../application/relatorio.service";
import { ReuniaoService } from "../application/reuniao.service";

/**
 * Rotas que devolvem ARQUIVO, testadas pela camada HTTP de verdade.
 *
 * O teste de integração chama os serviços direto e não pegou o defeito que o
 * teste de ponta a ponta no hub pegou: `return res.send(...)` com
 * `passthrough` entregava o arquivo e em seguida estourava "Converting circular
 * structure to JSON" no log. Aqui a requisição passa pelo roteador do Nest e o
 * teste falha se qualquer exceção chegar ao ExceptionsHandler.
 */
describe("Strategy — rotas de arquivo (HTTP)", () => {
  let app: INestApplication;
  let base: string;
  const erros: string[] = [];
  const pdf = Buffer.from("%PDF-1.4 teste");

  beforeAll(async () => {
    const liberado = { canActivate: (ctx: any) => { ctx.switchToHttp().getRequest().user = { id: "u", organizationId: "o", isMaster: true }; return true; } };
    const modulo = await Test.createTestingModule({
      controllers: [PainelController, ReuniaoController],
      providers: [
        { provide: PainelService, useValue: { painel: jest.fn() } },
        {
          provide: RelatorioService,
          useValue: {
            tipos: jest.fn().mockReturnValue([{ id: "executivo" }]),
            gerar: jest.fn().mockResolvedValue({ tipo: "executivo", linhas: [] }),
            exportar: jest.fn().mockResolvedValue({ conteudo: Buffer.from("a;b\r\n1;2"), mime: "text/csv; charset=utf-8", nome: "estrategico-executivo.csv" }),
          },
        },
        { provide: ReuniaoService, useValue: { ataPdf: jest.fn().mockResolvedValue({ conteudo: pdf, nome: "ata.pdf" }) } },
      ],
    })
      .overrideGuard(AuthGuard("jwt")).useValue(liberado)
      .overrideGuard(PermissionsGuard).useValue({ canActivate: () => true })
      .compile();

    app = modulo.createNestApplication();
    app.setGlobalPrefix("api");
    jest.spyOn(Logger.prototype, "error").mockImplementation((m: any) => { erros.push(String(m)); });
    await app.listen(0);
    const endereco: any = app.getHttpServer().address();
    base = `http://127.0.0.1:${endereco.port}/api/v1/estrategico`;
  });

  afterAll(async () => { await app?.close(); });
  afterEach(() => { erros.length = 0; });

  it("ata em PDF sai inteira, com cabeçalhos certos e sem erro no servidor", async () => {
    const r = await fetch(`${base}/reunioes/r1/ata.pdf`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="ata.pdf"');
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(Buffer.from(await r.arrayBuffer()).equals(pdf)).toBe(true);
    await new Promise(res => setTimeout(res, 50));
    expect(erros).toEqual([]);
  });

  it("exportação sai com o tipo do arquivo e sem erro no servidor", async () => {
    const r = await fetch(`${base}/relatorios/executivo/exportar?formato=csv`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(r.headers.get("content-disposition")).toContain("estrategico-executivo.csv");
    expect(await r.text()).toBe("a;b\r\n1;2");
    await new Promise(res => setTimeout(res, 50));
    expect(erros).toEqual([]);
  });

  it("prévias ficam fora de /relatorios (limite de exportação do nginx)", async () => {
    const regraNginx = /\/api\/.*\/(export|csv|relatorio|download)/i;
    expect(regraNginx.test("/api/v1/estrategico/analises")).toBe(false);
    expect(regraNginx.test("/api/v1/estrategico/analises/executivo")).toBe(false);
    expect(regraNginx.test("/api/v1/estrategico/relatorios/executivo/exportar")).toBe(true);
    expect((await fetch(`${base}/analises`)).status).toBe(200);
    expect((await fetch(`${base}/analises/executivo`)).status).toBe(200);
  });
});
