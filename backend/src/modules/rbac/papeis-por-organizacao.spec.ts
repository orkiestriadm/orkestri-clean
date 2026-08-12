/**
 * Papeis sao POR ORGANIZACAO.
 *
 * Antes, `roles.nome` era unico globalmente e a tabela nao tinha
 * organization_id: duas organizacoes NAO conseguiam ter duas linhas "gestor" —
 * compartilhavam a mesma. Um master do cliente A editava aquela linha e mudava
 * o que os usuarios do cliente B podiam fazer.
 *
 * Estes testes olham o schema e o comportamento do controller. O do schema e o
 * mais importante: se alguem devolver `@unique` para o campo `nome`, o defeito
 * volta inteiro e nenhum teste de rota perceberia.
 */
import * as fs from "fs";
import * as path from "path";

describe("schema — Role pertence a uma organizacao", () => {
  const schema = fs.readFileSync(
    path.join(__dirname, "../../../prisma/schema.prisma"),
    "utf8",
  );
  const modelRole = (schema.match(/^model Role \{([\s\S]*?)^\}/m) || [])[1] || "";

  it("declara organizationId", () => {
    expect(modelRole).toMatch(/organizationId\s+String/);
  });

  it("NAO tem nome unico global — era isso que forcava o compartilhamento", () => {
    expect(modelRole).not.toMatch(/nome\s+String\s+@unique/);
  });

  it("tem unicidade composta por organizacao + nome", () => {
    expect(modelRole).toMatch(/@@unique\(\[organizationId,\s*nome\]\)/);
  });

  it("apaga os papeis junto com a organizacao", () => {
    expect(modelRole).toMatch(/onDelete:\s*Cascade/);
  });

  /**
   * Permission continua global de proposito: e catalogo de capacidades do
   * sistema, nao dado de cliente. Se alguem "consertar" isso por simetria, a
   * sincronia de permissoes no boot passa a duplicar catalogo por tenant.
   */
  it("Permission SEGUE global — nao e dado de cliente", () => {
    const modelPermission = (schema.match(/^model Permission \{([\s\S]*?)^\}/m) || [])[1] || "";
    expect(modelPermission).not.toMatch(/organizationId/);
    expect(modelPermission).toMatch(/@@unique\(\[recurso,\s*acao\]\)/);
  });
});

describe("migration — converte a base compartilhada sem perder vinculo", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "../../../prisma/migrations/20260811000001_roles_por_organizacao/migration.sql"),
    "utf8",
  );

  it("adiciona a coluna como NULL antes de exigir valor", () => {
    const addIdx = sql.indexOf('ADD COLUMN "organization_id" TEXT');
    const notNullIdx = sql.indexOf('SET NOT NULL');
    expect(addIdx).toBeGreaterThan(-1);
    expect(notNullIdx).toBeGreaterThan(addIdx);
  });

  it("duplica os papeis para cada organizacao antes de apagar os globais", () => {
    const insertIdx = sql.indexOf('INSERT INTO "roles"');
    const deleteIdx = sql.indexOf('DELETE FROM "roles"');
    expect(insertIdx).toBeGreaterThan(-1);
    expect(deleteIdx).toBeGreaterThan(insertIdx);
  });

  /**
   * O ponto que quebraria em producao: remapear user_roles DEPOIS de apagar os
   * papeis antigos deixaria os vinculos orfaos — ou o CASCADE os levaria junto,
   * e todo mundo perderia o papel.
   */
  it("remapeia user_roles ANTES de apagar os papeis antigos", () => {
    const remapIdx = sql.indexOf('INSERT INTO "user_roles"');
    const deleteRolesIdx = sql.indexOf('DELETE FROM "roles"');
    expect(remapIdx).toBeGreaterThan(-1);
    expect(deleteRolesIdx).toBeGreaterThan(remapIdx);
  });

  it("liga o vinculo a copia da organizacao DO USUARIO", () => {
    expect(sql).toMatch(/JOIN "users" u\s+ON u\.id = ur\.user_id/);
    expect(sql).toMatch(/m\.org_id = u\."organization_id"/);
  });

  it("troca o unico global pelo composto", () => {
    expect(sql).toMatch(/DROP INDEX IF EXISTS "roles_nome_key"/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX "roles_organization_id_nome_key"/);
  });

  /**
   * A base de producao ja teve linhas com FK quebrada apesar das constraints —
   * validar o passado aqui arriscaria abortar o deploy inteiro.
   */
  it("cria a FK como NOT VALID", () => {
    expect(sql).toMatch(/roles_organization_id_fkey[\s\S]*NOT VALID/);
  });
});

describe("RolesController — escopo por organizacao", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fonte = fs.readFileSync(path.join(__dirname, "rbac.module.ts"), "utf8");

  it("nao consulta mais papel por nome global", () => {
    expect(fonte).not.toMatch(/role\.findUnique\(\{ where: \{ nome \} \}\)/);
  });

  it("resolve papel pelo helper de escopo, nao por id solto", () => {
    expect(fonte).toMatch(/acharNaOrganizacao\(this\.prisma\.role/);
  });

  /**
   * O cache era a segunda porta: mesmo com a consulta filtrando por
   * organizacao, uma chave global serviria a lista do primeiro tenant a
   * consultar para todos os outros.
   */
  it("usa chave de cache por organizacao", () => {
    expect(fonte).toMatch(/cache:roles:list:\$\{orgId\}/);
    expect(fonte).toMatch(/cache:rbac:matrix:\$\{orgId\}/);
  });

  it("cria papel ja amarrado a organizacao de quem chamou", () => {
    expect(fonte).toMatch(/organizationId: orgId, nome, descricao/);
  });
});
