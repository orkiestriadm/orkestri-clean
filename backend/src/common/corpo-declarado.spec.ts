/**
 * Trava o resultado do achado 7 e impede a regressão.
 *
 * O `ValidationPipe` global está configurado corretamente desde sempre
 * (`whitelist`, `transform`, `forbidNonWhitelisted`) e mesmo assim não validava
 * nada nessas rotas: sem classe DTO ele não tem metadata, porque o tipo do
 * TypeScript é apagado em tempo de execução. Configuração certa dando impressão
 * de cobertura que não existia.
 *
 * Estes testes leem o código-fonte em vez de subir a aplicação — é a única
 * forma de afirmar algo sobre TODAS as rotas de uma vez, e de falhar no dia em
 * que alguém escrever `@Body() body: any` de novo.
 */
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const RAIZ = path.join(__dirname, "../..");

function arquivosDeModulo(): string[] {
  return execSync('git ls-files "backend/src/**/*.ts"', { cwd: path.join(RAIZ, ".."), encoding: "utf8" })
    .split("\n")
    .filter(f => f && !f.includes(".spec."))
    .map(f => path.join(RAIZ, "..", f));
}

/** Rotas cujo corpo continua `any`, com o motivo de cada exceção. */
const EXCECOES_CONHECIDAS: Record<string, string> = {
  "frota.module.ts": "BaseFrotaController é CRUD genérico: os campos vêm de `this.fields` em cada subclasse e `buildData` já os usa como lista fechada, com coerção por tipo em `coerce`",
  "monitoramento.module.ts": "handlers repassam o corpo a MonitoramentoService; os campos vivem no serviço",
  "reservas.controller.ts": "repassa o corpo a ReservasService",
  "osa.module.ts": "repassa o corpo inteiro adiante",
  "notificacao-prefs.controller.ts": "salvarConfig/enviarCodigo/confirmarCodigo repassam adiante",
};

describe("achado 7 — corpo de requisição declarado", () => {
  const arquivos = arquivosDeModulo();

  function rotasComBodyAny() {
    const achados: { arquivo: string; linha: number }[] = [];
    for (const p of arquivos) {
      const linhas = fs.readFileSync(p, "utf8").split(/\r?\n/);
      linhas.forEach((l, i) => {
        if (/@Body\(\)\s*\w+\s*:\s*any\b/.test(l)) achados.push({ arquivo: path.basename(p), linha: i + 1 });
      });
    }
    return achados;
  }

  it("nenhuma rota usa mais tipo inline `@Body() body: { ... }`", () => {
    const inline: string[] = [];
    for (const p of arquivos) {
      const linhas = fs.readFileSync(p, "utf8").split(/\r?\n/);
      linhas.forEach((l, i) => {
        if (/@Body\(\)\s*\w+\s*:\s*\{/.test(l)) inline.push(`${path.basename(p)}:${i + 1}`);
      });
    }
    expect(inline).toEqual([]);
  });

  /**
   * O `any` que sobra é sempre em handler que repassa o corpo adiante, onde um
   * DTO parcial recusaria (400) campo que hoje funciona. Se aparecer `any` em
   * arquivo fora desta lista, é rota nova sem DTO — e este teste falha.
   */
  it("o corpo `any` que resta está só nos arquivos com motivo registrado", () => {
    const fora = rotasComBodyAny()
      .filter(r => !EXCECOES_CONHECIDAS[r.arquivo])
      .map(r => `${r.arquivo}:${r.linha}`);

    expect(fora).toEqual([]);
  });

  it("toda exceção listada tem justificativa escrita", () => {
    for (const [arquivo, motivo] of Object.entries(EXCECOES_CONHECIDAS)) {
      expect(motivo.length).toBeGreaterThan(20);
    }
  });

  /**
   * `@Allow()` não é enfeite: sem ele o `whitelist` REMOVE o campo declarado
   * sem tipo — sem erro e sem o dado, que é pior que os dois separados.
   */
  it("todo campo com @Allow também é declarado no DTO, nunca solto", () => {
    const soltos: string[] = [];
    for (const p of arquivos) {
      const src = fs.readFileSync(p, "utf8");
      for (const m of src.matchAll(/@Allow\(\)\s*(\w+)?/g)) {
        if (!m[1]) soltos.push(path.basename(p));
      }
    }
    expect(soltos).toEqual([]);
  });
});
