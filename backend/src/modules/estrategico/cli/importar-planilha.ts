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
 * Trocar a carga por uma versão mais nova da planilha (sem duplicar assuntos):
 *
 *   ... importar-planilha.js /tmp/planilha.xlsx <organizationId> --substituir --simular
 *   ... importar-planilha.js /tmp/planilha.xlsx <organizationId> --substituir
 *
 * `--substituir` apaga a carga atual do Strategy da organização (assuntos com
 * tudo que pende deles, catálogos, reuniões) e importa a planilha no lugar, na
 * mesma transação. É recusado se houver trabalho feito sobre a carga — ver
 * `avaliarSubstituicao`. Os arquivos dos documentos apagados saem do disco
 * depois do commit.
 *
 * O arquivo em /tmp deve ser apagado depois (`docker exec orkestri_api rm /tmp/planilha.xlsx`):
 * a planilha tem informação estratégica e não deve sobrar no container.
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { lerPlanilha } from "../domain/importacao.parser";
import { executarImportacao, avaliarSubstituicao } from "../application/importacao.executor";
import { abasDoArquivo } from "../application/importacao.service";
import { etapaDe } from "../domain/caso.entity";

async function main() {
  const [arquivo, organizationId, ...flags] = process.argv.slice(2);
  if (!arquivo || !organizationId) {
    console.error("Uso: node importar-planilha.js <arquivo.xlsx> <organizationId> [--substituir] [--simular]");
    process.exit(2);
  }
  const simular = flags.includes("--simular");
  const substituir = flags.includes("--substituir");
  const previa = lerPlanilha(abasDoArquivo(fs.readFileSync(arquivo)));

  console.log(`Aba: ${previa.aba} · cabeçalho na linha ${previa.linhaCabecalho}`);
  console.log(`Colunas: ${Object.entries(previa.colunas).map(([k, v]) => `${k}="${v}"`).join(", ")}`);
  for (const a of previa.avisos) console.log(`Aviso: ${a}`);
  console.log("");
  for (const c of previa.casos) {
    console.log(`L${c.linha} [${c.tipo}] ${c.titulo}`);
    console.log(`     etapa=${etapaDe(c.etapa)?.rotulo} dependência=${c.dependencia ?? "—"} objetivo=${c.objetivo ?? "—"} área=${c.areaOperacional ?? "—"}${c.areasApoio.length ? ` (+${c.areasApoio.join(", ")})` : ""} prazo final=${c.prazoFinal ?? "—"}`);
    console.log(`     ${c.eventos.length} andamento(s), ${c.trechosSemData.length} trecho(s) sem data, última movimentação ${c.ultimaMovimentacao ?? "—"}, ${c.pendencias.length} pendência(s)`);
  }
  console.log(`\nTotal: ${previa.casos.length} assuntos, ${previa.casos.reduce((s, c) => s + c.eventos.length, 0)} andamentos.`);

  if (simular && !substituir) {
    console.log("\n--simular: nada foi gravado.");
    return;
  }

  const prisma = new PrismaClient();
  try {
    const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, nome: true } });
    if (!org) throw new Error(`Organização ${organizationId} não encontrada.`);

    if (substituir) {
      const d = await avaliarSubstituicao(prisma, organizationId);
      console.log(`\nCarga atual em "${org.nome}": ${d.casosAtivos} assunto(s) ativo(s), ${d.casosExcluidos} excluído(s), ${d.reunioes} reunião(ões), ${d.catalogos} item(ns) de catálogo, ${d.documentos} documento(s) — tudo isso será APAGADO e substituído pela planilha.`);
      if (d.bloqueios.length) {
        console.error(`\nSubstituição recusada — há trabalho feito sobre a carga atual:\n  - ${d.bloqueios.join("\n  - ")}`);
        process.exitCode = 1;
        return;
      }
      console.log("Nenhum trabalho feito sobre a carga atual: substituição liberada.");
    }

    if (simular) {
      console.log("\n--simular: nada foi gravado.");
      return;
    }

    const r = await executarImportacao(prisma, { organizationId, userId: null, previa, arquivo: path.basename(arquivo), substituir });
    console.log(`\nOrganização: ${org.nome}`);
    if (r.substituicao) {
      console.log(`Substituição: removidos ${r.substituicao.casos} assunto(s), ${r.substituicao.reunioes} reunião(ões), ${r.substituicao.catalogos} item(ns) de catálogo, ${r.substituicao.compromissos} compromisso(s) de agenda.`);
    }
    console.log(`Criados: ${r.criados.length} · Ignorados: ${r.ignorados.length} · Andamentos: ${r.eventos} · Dependências: ${r.dependencias}`);
    for (const c of r.criados) console.log(`  + ${c.codigo} ${c.titulo} (${c.eventos} andamentos, ${c.pendencias} pendências)`);
    for (const i of r.ignorados) console.log(`  = ${i.titulo}: ${i.motivo}`);
    if (r.catalogosCriados.length) console.log(`Catálogo: ${r.catalogosCriados.join("; ")}`);

    // Arquivos só depois do commit: se a transação falhasse, eles precisariam continuar lá.
    if (r.substituicao?.documentos.length) {
      const raiz = path.resolve(process.env.ESTRATEGICO_DOCS_DIR || "/app/secure/estrategico-docs");
      let removidos = 0;
      for (const ref of r.substituicao.documentos) {
        const alvo = path.resolve(raiz, ref);
        if (!alvo.startsWith(raiz + path.sep)) continue;
        try {
          if (fs.existsSync(alvo)) { fs.rmSync(alvo, { force: true }); removidos++; }
          fs.rmdirSync(path.dirname(alvo)); // pasta do assunto, se ficou vazia
        } catch { /* pasta com outros arquivos: fica */ }
      }
      console.log(`Arquivos de documentos removidos do disco: ${removidos} de ${r.substituicao.documentos.length}.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => {
  console.error(e?.message ?? e);
  process.exit(1);
});
