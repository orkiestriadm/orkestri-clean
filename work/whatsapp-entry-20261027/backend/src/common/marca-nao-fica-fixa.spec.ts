import * as fs from "fs";
import * as path from "path";

/**
 * A marca do produto não pode estar escrita à mão em texto que sai para o
 * usuário.
 *
 * Em 10/08/2026 isso vazou TRÊS vezes no mesmo dia, em servidor white-label de
 * um cliente:
 *
 *  1. `whatsapp.service.ts` tinha `const MARCA = "Orkiestri"` local. Os
 *     templates usavam `${MARCA}` e pareciam corretos em qualquer revisão —
 *     era a constante do arquivo, não a do ambiente.
 *  2. A barra superior caía em `"Orkiestri"` fixo em 27 rotas sem título.
 *  3. `alert.scheduler.ts` mandava `*Orkestri*` (sem o "i", outra grafia) em
 *     todo alerta de WhatsApp — foi o que o cliente recebeu no celular.
 *
 * Nenhuma das três apareceria lendo o código com atenção: o padrão `${MARCA}`
 * parece certo, e a segunda grafia escapa de qualquer busca por "Orkiestri".
 *
 * Este teste falha no CI em vez de falhar no celular do cliente.
 *
 * Se falhar: importe `MARCA` de `common/marca`, que lê do ambiente. NÃO
 * acrescente exceção aqui sem que o texto seja de fato interno.
 */

const RAIZ = path.resolve(__dirname, "..");

/**
 * Onde a marca do PRODUTO é legítima.
 *
 * - `common/marca.ts` é quem define o padrão.
 * - `billing` é a assinatura do SaaS Orkiestri: quem paga, paga ao produto,
 *   não ao cliente white-label.
 * - `webhooks` usa o nome em CABEÇALHO HTTP (`X-Orkestri-Event`), que é
 *   contrato de integração — mudar quebraria quem já consome.
 * - `main.ts` é log de servidor, não chega a usuário.
 */
const PERMITIDOS = [
  path.join("common", "marca.ts"),
  path.join("modules", "billing"),
  path.join("modules", "automacoes", "webhooks.module.ts"),
  "main.ts",
];

function arquivosTs(dir: string, saida: string[] = []): string[] {
  for (const nome of fs.readdirSync(dir)) {
    const completo = path.join(dir, nome);
    if (fs.statSync(completo).isDirectory()) {
      if (nome === "node_modules" || nome === "dist") continue;
      arquivosTs(completo, saida);
    } else if (nome.endsWith(".ts") && !nome.endsWith(".spec.ts")) {
      saida.push(completo);
    }
  }
  return saida;
}

/** Remove comentários: a marca em comentário explicativo é legítima. */
function semComentarios(codigo: string): string {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("a marca do produto não fica escrita à mão", () => {
  // As duas grafias: "Orkiestri" é a atual, "Orkestri" é a antiga e continua
  // espalhada pelo código — foi ela que escapou da primeira varredura.
  const MARCA_FIXA = /"[^"]*Ork(i)?estri[^"]*"|`[^`]*Ork(i)?estri[^`]*`/;

  it("nenhum texto de usuário traz a marca em literal", () => {
    const infratores: string[] = [];

    for (const arquivo of arquivosTs(RAIZ)) {
      const relativo = path.relative(RAIZ, arquivo);
      if (PERMITIDOS.some(p => relativo.includes(p))) continue;

      const codigo = semComentarios(fs.readFileSync(arquivo, "utf-8"));
      for (const linha of codigo.split("\n")) {
        // `orkestri-default`, `orkestri_token` e afins são identificadores
        // internos (instância, cookie, chave), não texto exibido.
        const semIdentificadores = linha.replace(/orkestri[-_][\w-]+/gi, "");
        if (MARCA_FIXA.test(semIdentificadores)) {
          infratores.push(`${relativo}: ${linha.trim().slice(0, 100)}`);
        }
      }
    }

    expect(infratores).toEqual([]);
  });

  it("common/marca lê do ambiente e só cai no padrão sem variável", () => {
    const fonte = fs.readFileSync(path.join(RAIZ, "common", "marca.ts"), "utf-8");
    expect(fonte).toContain("process.env.MARCA");
  });
});
