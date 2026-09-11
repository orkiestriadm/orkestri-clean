import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { lerPlanilha } from "./domain/importacao.parser";
import { executarImportacao, avaliarSubstituicao } from "./application/importacao.executor";

/**
 * Substituição da carga da planilha contra um Postgres DE VERDADE.
 *
 * Mesma regra do `estrategico.integracao.spec.ts`: só roda com
 * `ESTRATEGICO_DB_TEST_URL` apontando para um banco DESCARTÁVEL com o schema
 * aplicado. Dados sintéticos.
 *
 *   ESTRATEGICO_DB_TEST_URL=postgresql://postgres:teste@localhost:55439/est npx jest estrategico.substituicao
 */

const URL_TESTE = process.env.ESTRATEGICO_DB_TEST_URL;
const suite = URL_TESTE ? describe : describe.skip;

jest.setTimeout(120_000);

const HOJE = new Date("2026-09-11T12:00:00Z");

const CAB = [null, "Assunto", "Objetivo", "Principais Andamentos", "Valor envolvido - Pretensão", "Valor - Alcançado", "Valor de Reequilíbrio", "Esfera", "Status Atual", "Prazo", "Área Responsável", null];
const grupo = (n: string) => [null, n, null, null, null, null, null, null, null, null, null, null];
const caso = (titulo: string, andamentos: string | null, status: string, prazo: any = "N/A") =>
  [null, titulo, "Reequilíbrio", andamentos, null, null, null, "Administrativa", status, prazo, "Regulatório", "Em andamento"];

const planilha = (linhas: any[][]) => lerPlanilha([{ nome: "Assuntos", linhas: [[null, "ACOMPANHAMENTO"], CAB, ...linhas] }], HOJE);

/** Carga "de ontem": três assuntos. */
const V1 = () => planilha([
  grupo("Reequilíbrio"),
  caso("Caso Alfa com nome antigo", "01/07/2026 - Protocolo do pedido", "Aguardando ANTT"),
  caso("Caso Beta", "02/07/2026 - Reunião com a agência", "Aguardando ANTT"),
  caso("Caso Gama", null, "Aguardando judiciário"),
]);

/** Planilha atualizada: Alfa renomeado, Gama saiu, Delta entrou, Beta ganhou andamento e prazo. */
const V2 = () => planilha([
  grupo("Reequilíbrio"),
  caso("Caso Alfa com nome novo", "01/07/2026 - Protocolo do pedido", "Aguardando ANTT"),
  caso("Caso Beta", "02/07/2026 - Reunião com a agência\n05/09/2026 - Ofício recebido", "Aguardando ANTT", "15/09/2026"),
  grupo("Temas de estudo"),
  caso("Caso Delta", "10/09/2026 - Estudo iniciado", "Aguardando RH"),
]);

suite("Strategy — substituição da carga da planilha (banco real)", () => {
  let db: PrismaClient;
  const org = randomUUID();
  const usuario = randomUUID();

  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url: URL_TESTE } } });
    await db.$connect();
    await db.organization.create({ data: { id: org, nome: "Org substituição", slug: `subst-${org}` } as any });
    await db.user.create({ data: { id: usuario, organizationId: org, nome: "Usuário", email: `${usuario}@teste.local`, senhaHash: "x" } as any });
  });

  afterAll(async () => {
    if (db) {
      await db.organization.delete({ where: { id: org } }).catch(() => {});
      await db.$disconnect();
    }
  });

  const contar = async () => ({
    casos: await (db as any).estrategicoCaso.count({ where: { organizationId: org } }),
    eventos: await (db as any).estrategicoEvento.count({ where: { organizationId: org } }),
    dependencias: await (db as any).estrategicoDependencia.count({ where: { organizationId: org } }),
    historico: await (db as any).estrategicoHistorico.count({ where: { organizationId: org } }),
    reunioes: await (db as any).estrategicoReuniao.count({ where: { organizationId: org } }),
    decisoes: await (db as any).estrategicoDecisao.count({ where: { organizationId: org } }),
    documentos: await (db as any).estrategicoDocumento.count({ where: { organizationId: org } }),
    alertas: await (db as any).estrategicoAlertaEnvio.count({ where: { organizationId: org } }),
  });

  it("carga inicial + resíduo de teste já excluído (como no hub)", async () => {
    const r = await executarImportacao(db, { organizationId: org, userId: null, previa: V1(), arquivo: "v1.xlsx", hoje: HOJE });
    expect(r.criados.map(c => c.codigo)).toEqual(["EST-0001", "EST-0002", "EST-0003"]);

    // Assunto de teste excluído logicamente, com documento, e reunião de teste excluída com decisão.
    const x: any = db;
    const teste = await x.estrategicoCaso.create({ data: { organizationId: org, codigo: "EST-0004", titulo: "[TESTE]", deletedAt: new Date() } });
    await x.estrategicoDocumento.create({ data: { organizationId: org, casoId: teste.id, titulo: "doc", nomeOriginal: "doc.pdf", arquivoRef: `${org}/${teste.id}/doc.pdf` } });
    await x.estrategicoTarefa.create({ data: { organizationId: org, casoId: teste.id, titulo: "tarefa do teste" } });
    const reuniao = await x.estrategicoReuniao.create({ data: { organizationId: org, titulo: "[TESTE] reunião", dataReuniao: HOJE, deletedAt: new Date() } });
    await x.estrategicoDecisao.create({ data: { organizationId: org, reuniaoId: reuniao.id, descricao: "decisão geral", decididoEm: HOJE } });
    await x.estrategicoAlertaEnvio.create({ data: { organizationId: org, casoId: teste.id, chave: "acao:x", tipo: "estrategico_prazo", destinatarioId: usuario } });

    const d = await avaliarSubstituicao(db, org);
    expect(d).toMatchObject({ casosAtivos: 3, casosExcluidos: 1, reunioes: 1, documentos: 1, bloqueios: [] });
  });

  it("importar a versão nova SEM substituir duplicaria o assunto renomeado", async () => {
    // Prova do problema — em transação desfeita, para não sujar o teste seguinte.
    const antes = await contar();
    await (db as any).$transaction(async (tx: any) => {
      const r = await executarImportacao({ $transaction: (fn: any) => fn(tx) } as any, { organizationId: org, userId: null, previa: V2(), arquivo: "v2.xlsx", hoje: HOJE });
      expect(r.criados.map(c => c.titulo)).toEqual(["Caso Alfa com nome novo", "Caso Delta"]);
      expect(r.ignorados.map(i => i.titulo)).toEqual(["Caso Beta"]);
      throw new Error("desfazer");
    }).catch((e: any) => { if (e.message !== "desfazer") throw e; });
    expect(await contar()).toEqual(antes);
  });

  it("substituir troca a carga inteira: sem duplicado, sem resíduo, códigos do zero", async () => {
    const r = await executarImportacao(db, { organizationId: org, userId: null, previa: V2(), arquivo: "v2.xlsx", hoje: HOJE, substituir: true });

    expect(r.substituicao).toMatchObject({ casos: 4, reunioes: 1 });
    expect(r.substituicao!.documentos).toHaveLength(1);
    expect(r.ignorados).toHaveLength(0);
    expect(r.criados.map(c => [c.codigo, c.titulo])).toEqual([
      ["EST-0001", "Caso Alfa com nome novo"],
      ["EST-0002", "Caso Beta"],
      ["EST-0003", "Caso Delta"],
    ]);

    const x: any = db;
    const casos = await x.estrategicoCaso.findMany({ where: { organizationId: org }, orderBy: { codigo: "asc" } });
    expect(casos.map((c: any) => c.titulo)).toEqual(["Caso Alfa com nome novo", "Caso Beta", "Caso Delta"]);
    expect(casos.every((c: any) => c.deletedAt === null && c.revisarImportacao)).toBe(true);
    expect(new Set(casos.map((c: any) => c.importacaoChave)).size).toBe(3);

    const n = await contar();
    expect(n).toMatchObject({ casos: 3, eventos: 4, reunioes: 0, decisoes: 0, documentos: 0, alertas: 0 });
    expect(n.historico).toBe(3); // só o "importou" de cada assunto novo
    expect(await x.estrategicoTarefa.count({ where: { organizationId: org } })).toBe(0);

    // Prazo da planilha virou prazo final e entrou no farol.
    const beta = casos.find((c: any) => c.titulo === "Caso Beta");
    expect(beta.prazoFinal.toISOString().slice(0, 10)).toBe("2026-09-15");
    expect(JSON.stringify(beta.farolMotivos)).toContain("Prazo final em 4 dias");

    // Catálogo refeito, sem item órfão da carga anterior.
    const grupos = await x.estrategicoCatalogo.findMany({ where: { organizationId: org, tipo: "grupo" } });
    expect(grupos.map((g: any) => g.nome).sort()).toEqual(["Reequilíbrio", "Temas de estudo"]);
  });

  it("substituir de novo com a mesma planilha é repetível", async () => {
    const r = await executarImportacao(db, { organizationId: org, userId: null, previa: V2(), arquivo: "v2.xlsx", hoje: HOJE, substituir: true });
    expect(r.substituicao!.casos).toBe(3);
    expect(r.criados.map(c => c.codigo)).toEqual(["EST-0001", "EST-0002", "EST-0003"]);
    expect((await contar()).casos).toBe(3);
  });

  it("recusa substituir quando já há trabalho sobre a carga — e não apaga nada", async () => {
    const x: any = db;
    const beta = await x.estrategicoCaso.findFirst({ where: { organizationId: org, titulo: "Caso Beta" } });
    await x.estrategicoTarefa.create({ data: { organizationId: org, casoId: beta.id, titulo: "Cobrar a agência" } });
    await x.estrategicoCaso.update({ where: { id: beta.id }, data: { proximaAcao: "Cobrar a agência" } });

    const d = await avaliarSubstituicao(db, org);
    expect(d.bloqueios.join(" | ")).toMatch(/1 tarefa/);
    expect(d.bloqueios.join(" | ")).toMatch(/próxima ação/);

    const antes = await contar();
    await expect(
      executarImportacao(db, { organizationId: org, userId: null, previa: V2(), arquivo: "v2.xlsx", hoje: HOJE, substituir: true }),
    ).rejects.toThrow(/Substituição recusada/);
    expect(await contar()).toEqual(antes);
    expect(await x.estrategicoTarefa.count({ where: { casoId: beta.id } })).toBe(1);
  });
});
