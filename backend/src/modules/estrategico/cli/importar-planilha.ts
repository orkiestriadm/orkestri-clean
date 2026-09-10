/**
 * Importação da planilha "Acompanhamento Estratégico" pela linha de comando.
 *
 * Mesmo leitor e mesma gravação da tela (Configurações › Importar planilha).
 * Existe para a implantação: roda dentro do container da API, sem depender de
 * uma sessão logada, e com `--simular` mostra a prévia sem gravar nada.
 *
 *   docker cp "Acompanhamento Estratégico.xlsx" orkestri_api:/tmp/planilha.xlsx
 *   docker exec orkestri_api node dist/modules/estrategico/cli/importar-planilha.js /tmp/planilha.xlsx <organizationId> --simular
 *   docker exec orkestri_api node dist/modules/estrategico/cli/importar-planilha.js /tmp/planilha.xlsx <organizationId>
 *
 * O arquivo em /tmp deve ser apagado depois (`docker exec orkestri_api rm /tmp/planilha.xlsx`):
 * a planilha tem informação estratégica e não deve sobrar no container.
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { lerPlanilha } from "../domain/importacao.parser";
import { executarImportacao } from "../application/importacao.executor";
import { abasDoArquivo } from "../application/importacao.service";
import { etapaDe } from "../domain/caso.entity";

async function main() {
  const [arquivo, organizationId, ...flags] = process.argv.slice(2);
  if (!arquivo || !organizationId) {
    console.error("Uso: node importar-planilha.js <arquivo.xlsx> <organizationId> [--simular]");
    process.exit(2);
  }
  const simular = flags.includes("--simular");
  const previa = lerPlanilha(abasDoArquivo(fs.readFileSync(arquivo)));

  console.log(`Aba: ${previa.aba} · cabeçalho na linha ${previa.linhaCabecalho}`);
  console.log(`Colunas: ${Object.entries(previa.colunas).map(([k, v]) => `${k}="${v}"`).join(", ")}`);
  for (const a of previa.avisos) console.log(`Aviso: ${a}`);
  console.log("");
  for (const c of previa.casos) {
    console.log(`L${c.linha} [${c.tipo}] ${c.titulo}`);
    console.log(`     etapa=${etapaDe(c.etapa)?.rotulo} dependência=${c.dependencia ?? "—"} objetivo=${c.objetivo ?? "—"} área=${c.areaOperacional ?? "—"}${c.areasApoio.length ? ` (+${c.areasApoio.join(", ")})` : ""}`);
    console.log(`     ${c.eventos.length} andamento(s), ${c.trechosSemData.length} trecho(s) sem data, última movimentação ${c.ultimaMovimentacao ?? "—"}, ${c.pendencias.length} pendência(s)`);
  }
  console.log(`\nTotal: ${previa.casos.length} assuntos, ${previa.casos.reduce((s, c) => s + c.eventos.length, 0)} andamentos.`);

  if (simular) {
    console.log("\n--simular: nada foi gravado.");
    return;
  }

  const prisma = new PrismaClient();
  try {
    const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, nome: true } });
    if (!org) throw new Error(`Organização ${organizationId} não encontrada.`);
    const r = await executarImportacao(prisma, { organizationId, userId: null, previa, arquivo: path.basename(arquivo) });
    console.log(`\nOrganização: ${org.nome}`);
    console.log(`Criados: ${r.criados.length} · Ignorados: ${r.ignorados.length} · Andamentos: ${r.eventos} · Dependências: ${r.dependencias}`);
    for (const c of r.criados) console.log(`  + ${c.codigo} ${c.titulo} (${c.eventos} andamentos, ${c.pendencias} pendências)`);
    for (const i of r.ignorados) console.log(`  = ${i.titulo}: ${i.motivo}`);
    if (r.catalogosCriados.length) console.log(`Catálogo: ${r.catalogosCriados.join("; ")}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => {
  console.error(e?.message ?? e);
  process.exit(1);
});
