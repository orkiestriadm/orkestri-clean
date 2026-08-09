/**
 * Vocabulário compartilhado das notificações: módulos e severidade.
 *
 * Fica num arquivo próprio, sem Prisma e sem Nest, para que o despachante, o
 * worker, os controllers e os testes usem a MESMA lista. Foi assim que as
 * colunas dos relatórios de frota divergiram em quatro cópias antes de virarem
 * definição única — o mesmo erro custaria mais caro aqui, porque uma divergência
 * numa regra de permissão não aparece na tela: ela silencia ou vaza mensagem.
 */

/** Módulos que podem originar notificação. Os ids são os mesmos do `NAV` do
 *  frontend (`frontend/src/lib/modules.tsx`), para que a tela de configuração
 *  fale a mesma língua do menu que o usuário já conhece. */
export const MODULOS_NOTIFICAVEIS = [
  { id: "fleet", label: "Fleet — Frotas" },
  { id: "people", label: "People — Pessoas" },
  { id: "service", label: "Service — Chamados" },
  { id: "projects", label: "Projects — Projetos" },
  { id: "budget", label: "Budget — Orçamento" },
  { id: "finance", label: "Finance — Financeiro" },
  { id: "assets", label: "Assets — Ativos" },
  { id: "quality", label: "Quality — Procedimentos" },
  { id: "approvals", label: "Approvals — Aprovações" },
  { id: "space", label: "Space — Agenda" },
  { id: "supply", label: "Supply — Suprimentos" },
  { id: "relations", label: "Relations — Clientes" },
  { id: "core", label: "Core — Administração" },
] as const;

export type ModuloNotificavel = (typeof MODULOS_NOTIFICAVEIS)[number]["id"];

export const MODULO_IDS: string[] = MODULOS_NOTIFICAVEIS.map(m => m.id);

export function moduloValido(m: string): boolean {
  return MODULO_IDS.includes(m);
}

/**
 * `UserProfile.modulos` guarda slugs LEGADOS em português ("frota", "projetos")
 * enquanto o menu e as preferências usam os ids de produto em inglês
 * ("fleet", "projects").
 *
 * Sem este mapa a comparação falharia em silêncio — e falhar em silêncio numa
 * regra de permissão é o pior desfecho possível: ninguém vê o erro, a pessoa
 * simplesmente para de receber (ou passa a receber o que não devia). Medido em
 * homologação: a única pessoa com módulo restrito tem `["frota"]`, que não bate
 * com nenhum id de produto.
 */
const SLUG_LEGADO_PARA_MODULO: Record<string, string> = {
  frota: "fleet",
  frotas: "fleet",
  pessoas: "people",
  rh: "people",
  chamados: "service",
  helpdesk: "service",
  projetos: "projects",
  orcamento: "budget",
  financeiro: "finance",
  ativos: "assets",
  procedimentos: "quality",
  aprovacoes: "approvals",
  agenda: "space",
  suprimentos: "supply",
  clientes: "relations",
  administracao: "core",
};

/** Normaliza um slug de `UserProfile.modulos` para o id de produto. */
export function normalizarModulo(slug: string): string {
  const s = String(slug || "").trim().toLowerCase();
  if (!s) return "";
  if (MODULO_IDS.includes(s)) return s;
  return SLUG_LEGADO_PARA_MODULO[s] || s;
}

/**
 * Módulos que a pessoa ENXERGA no sistema, a partir de `UserProfile.modulos`.
 *
 * Lista vazia significa "vê tudo" — retrocompatibilidade já estabelecida no
 * gating do Sidebar, e que precisa valer igual aqui. Se este helper tratasse
 * vazio como "nada", quem nunca foi configurado perderia o acesso junto com as
 * notificações.
 */
export function modulosVisiveis(modulosJson: string | null | undefined): string[] {
  let brutos: string[] = [];
  try { brutos = JSON.parse(modulosJson || "[]"); } catch { brutos = []; }
  if (!Array.isArray(brutos) || !brutos.length) return [...MODULO_IDS];
  return brutos.map(normalizarModulo).filter(Boolean);
}

// ── Severidade ───────────────────────────────────────────────────────────────

export type Severidade = "info" | "aviso" | "critico";

const ORDEM: Record<string, number> = { info: 0, aviso: 1, critico: 2 };

export function severidadeAtende(sev: string, minimo: string): boolean {
  return (ORDEM[sev] ?? 0) >= (ORDEM[minimo] ?? 0);
}

export function ehCritico(sev: string): boolean {
  return sev === "critico";
}
