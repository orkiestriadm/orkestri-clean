/**
 * Compatibilidade entre as permissões antigas de colaborador (`colaboradores:*`)
 * e as do Orkiestri People (`people.*`).
 *
 * Por que existe: o guard compara permissões por string exata. A semente de
 * `auth.service.ts` concede as novas aos PAPÉIS PADRÃO no próximo boot — mas
 * papéis customizados, criados pelo administrador de cada cliente, não estão
 * em `ROLE_DEFAULTS` e não recebem nada. Sem os aliases, quem usa papel próprio
 * perderia acesso ao módulo no deploy.
 *
 * A tradução é unidirecional: antiga → nova. Código novo declara só o formato
 * novo. Ver docs/people/ADR-003-modelo-permissoes.md.
 *
 * REGRA: alias só concede o que a permissão antiga já autorizava. `colaboradores:ver`
 * NÃO concede `people.documento:ver` — documento é dado restrito, com fluxo de
 * concessão próprio, e ninguém consentiu com esse acesso ao marcar "ver
 * colaboradores" no passado.
 */

/** Permissão antiga → permissões novas que ela concede. */
const LEGACY_TO_MODERN: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "colaboradores:ver": [
    "people.colaborador:ver",
    "people.cargo:ver",
  ],
  "colaboradores:criar":   ["people.colaborador:criar"],
  "colaboradores:editar":  ["people.colaborador:editar", "people.colaborador:mudar_situacao"],
  "colaboradores:excluir": ["people.colaborador:excluir"],
});

/**
 * Expande a lista de permissões do usuário com os equivalentes modernos.
 *
 * Preserva as originais: durante a transição um usuário pode ter permissões
 * dos dois formatos.
 */
export function expandLegacyPermissions(permissions: readonly string[]): Set<string> {
  const expandidas = new Set<string>(permissions);
  for (const perm of permissions) {
    const modernas = LEGACY_TO_MODERN[perm];
    if (modernas) for (const m of modernas) expandidas.add(m);
  }
  return expandidas;
}

/** Somente para diagnóstico e testes — não usar em decisão de acesso. */
export function legacyAliasesOf(permission: string): readonly string[] {
  return LEGACY_TO_MODERN[permission] ?? [];
}
