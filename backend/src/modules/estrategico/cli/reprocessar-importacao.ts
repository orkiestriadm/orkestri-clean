/**
 * Reconverte os andamentos dos assuntos IMPORTADOS a partir do texto original
 * que o próprio sistema preservou (`andamentos_originais`) — sem precisar da
 * planilha de novo.
 *
 * Existe porque o leitor pode melhorar depois da carga (1.35.1: a regra de
 * continuação de linha grudava itens sem data no andamento anterior). Reimportar
 * não serve: a importação é idempotente e ignora o que já existe.
 *
 * Garantias:
 *  - Só toca assunto que NINGUÉM mexeu desde a importação: ainda marcado para
 *    revisão, histórico só de importação/farol calculado/reprocessamento, e
 *    todos os eventos de origem "importacao". Qualquer outro é pulado e listado.
 *  - Substitui só os eventos de origem "importacao". Nada manual é tocado.
 *  - Registra o reprocessamento no histórico do assunto (que nunca é apagado).
 *  - `--simular` mostra a diferença e não grava.
 *
 *   docker exec orkestri_api node dist/modules/estrategico/cli/reprocessar-importacao.js <organizationId> --simular
 *   docker exec orkestri_api node dist/modules/estrategico/cli/reprocessar-importacao.js <organizationId>
 */
import { PrismaClient } from "@prisma/client";
import { extrairEventos } from "../domain/importacao.parser";
import { calcularFarol, PARAMETROS_PADRAO } from "../domain/farol.entity";

const ACOES_DE_IMPORTACAO = ["importou", "farol_calculado", "reprocessou"];
const dataDia = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
const assinatura = (e: { data: string; titulo: string; descricao: string | null }) =>
  `${e.data.slice(0, 10)}|${e.titulo}|${e.descricao ?? ""}`;

async function main() {
  const [organizationId, ...flags] = process.argv.slice(2);
  if (!organizationId) {
    console.error("Uso: node reprocessar-importacao.js <organizationId> [--simular]");
    process.exit(2);
  }
  const simular = flags.includes("--simular");
  const prisma = new PrismaClient();
  const db: any = prisma;

  try {
    const casos = await db.estrategicoCaso.findMany({
      where: { organizationId, deletedAt: null, importacaoChave: { not: null } },
      include: {
        eventos: { where: { deletedAt: null } },
        historico: { select: { acao: true, userId: true, origem: true } },
        dependencias: { where: { resolvidaEm: null }, include: { catalogo: true } },
      },
      orderBy: { codigo: "asc" },
    });

    let alterados = 0;
    for (const c of casos) {
      const intocado = c.revisarImportacao
        && c.historico.every((h: any) => ACOES_DE_IMPORTACAO.includes(h.acao) && !h.userId)
        && c.eventos.every((e: any) => e.origem === "importacao");
      if (!intocado) {
        console.log(`= ${c.codigo} pulado: já foi alterado por alguém depois da importação`);
        continue;
      }

      const dados: any = c.importacaoDados ?? {};
      const importadoEm = dados.importadoEm ? new Date(dados.importadoEm) : c.criadoEm;
      const { eventos, trechosSemData } = extrairEventos(c.andamentosOriginais, importadoEm);

      const antes = c.eventos.map((e: any) => ({ data: e.dataEvento.toISOString(), titulo: e.titulo, descricao: e.descricao }));
      const depois = eventos.map(e => ({
        data: e.data, titulo: e.titulo,
        descricao: e.contexto ? `${e.descricao}\n\nContexto na planilha: ${e.contexto}` : e.descricao,
      }));
      const iguais = antes.length === depois.length
        && antes.map(assinatura).sort().join("\n") === depois.map(assinatura).sort().join("\n");
      if (iguais) continue;

      alterados++;
      console.log(`~ ${c.codigo} ${c.titulo}: ${antes.length} → ${depois.length} andamento(s), ${trechosSemData.length} trecho(s) sem data`);
      for (const e of antes.filter((a: any) => !depois.some(d => assinatura(d) === assinatura(a)))) {
        console.log(`    - ${e.data.slice(0, 10)} ${e.titulo} :: ${(e.descricao ?? "").slice(0, 140)}`);
      }
      for (const e of depois.filter(d => !antes.some((a: any) => assinatura(a) === assinatura(d)))) {
        console.log(`    + ${e.data} ${e.titulo} :: ${e.descricao.slice(0, 140)}`);
      }
      if (simular) continue;

      const pendencias = (dados.pendencias ?? []).filter((p: string) =>
        !/trechos? dos andamentos sem data/.test(p) && !/^Datas de blocos distintos/.test(p));
      if (trechosSemData.length) {
        pendencias.push(`${trechosSemData.length} ${trechosSemData.length === 1 ? "trecho" : "trechos"} dos andamentos sem data clara — mantidos só no texto original.`);
      }
      if (eventos.some(e => e.contexto)) pendencias.push("Datas de blocos distintos (processos diferentes) no mesmo assunto — conferir a timeline.");

      const ultima = eventos.length ? eventos.map(e => e.data).sort().reverse()[0] : null;
      const farol = calcularFarol({
        tipo: c.tipo, etapa: c.etapa, estagioOportunidade: c.estagioOportunidade, prioridade: c.prioridade,
        proximaAcao: c.proximaAcao, proximaAcaoPrazo: c.proximaAcaoPrazo, prazoFinal: c.prazoFinal,
        ultimaMovimentacaoEm: ultima ? dataDia(ultima) : null,
        probabilidade: c.probabilidade, impacto: c.impacto, valorEmRisco: c.valorEmRisco == null ? null : Number(c.valorEmRisco),
        dependencias: c.dependencias.map((d: any) => ({ nome: d.catalogo?.nome ?? d.organizacao ?? "Terceiro", desde: d.desde })),
      }, PARAMETROS_PADRAO, new Date());

      await db.$transaction(async (tx: any) => {
        await tx.estrategicoEvento.deleteMany({ where: { casoId: c.id, origem: "importacao" } });
        if (eventos.length) {
          await tx.estrategicoEvento.createMany({
            data: eventos.map(e => ({
              organizationId, casoId: c.id, tipo: e.tipo, dataEvento: dataDia(e.data), precisaoData: e.precisao,
              titulo: e.titulo, descricao: e.contexto ? `${e.descricao}\n\nContexto na planilha: ${e.contexto}` : e.descricao,
              origem: "importacao", revisar: !!e.contexto || e.precisao === "mes",
            })),
          });
        }
        await tx.estrategicoCaso.update({
          where: { id: c.id },
          data: {
            ultimaMovimentacaoEm: ultima ? dataDia(ultima) : null,
            importacaoDados: { ...dados, pendencias, trechosSemData },
            farolCalculado: farol.farol, farolMotivos: farol.motivos, farolCalculadoEm: new Date(),
          },
        });
        await tx.estrategicoHistorico.create({
          data: {
            organizationId, casoId: c.id, acao: "reprocessou", origem: "importacao",
            descricao: `Andamentos reconvertidos do texto original preservado (correção do leitor da planilha): ${antes.length} → ${eventos.length} andamento(s), ${trechosSemData.length} trecho(s) sem data.`,
          },
        });
      });
    }

    console.log(`\n${casos.length} assunto(s) importado(s) examinado(s); ${alterados} com andamentos diferentes.${simular ? " --simular: nada foi gravado." : ""}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => {
  console.error(e?.message ?? e);
  process.exit(1);
});
