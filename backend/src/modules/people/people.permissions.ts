/**
 * Catálogo de permissões do Orkiestri People.
 *
 * FORMATO — correção sobre o que o ADR-003 previa.
 *
 * O ADR adotou `module.entity.action` (`people.employee.view`) copiando
 * PEOPLE_PERMISSIONS.md §12. Ao implementar a semente descobri que a plataforma
 * **não consegue armazenar esse formato**: a tabela `permissions` tem colunas
 * `recurso` e `acao`, e a string efetiva é sempre `${recurso}:${acao}`
 * (auth.service.ts:434). Uma permissão com três segmentos separados por ponto
 * jamais existiria no banco — logo, nunca seria concedível nem verificável.
 *
 * Formato adotado: `recurso` = `people.<entidade>`, `acao` em português.
 *
 *   people.colaborador:ver
 *   people.documento:aprovar
 *
 * O namespace do módulo é preservado (que era a intenção da especificação) e a
 * ação fica na mesma língua de todas as outras 84 permissões — o que importa,
 * porque a matriz de permissões é uma tela que o administrador lê.
 */

type Permissao = { recurso: string; acao: string; descricao: string };

const p = (recurso: string, acao: string, descricao: string): Permissao =>
  ({ recurso, acao, descricao });

/**
 * Catálogo semeado em `permissions` e concedido pelos papéis padrão.
 *
 * Só entra aqui o que já tem endpoint. Permissão sem uso polui a matriz e faz
 * o administrador conceder acesso a nada.
 */
export const PEOPLE_PERMISSION_CATALOG: readonly Permissao[] = [
  p("people.colaborador", "ver",            "Ver colaboradores no seu escopo"),
  // Escopo organizacional. Sem ela, o usuário vê a própria equipe (se for
  // gestor) ou apenas a si — ver PeopleScopeService.
  p("people.colaborador", "ver_todos",      "Ver todos os colaboradores da organização"),
  p("people.colaborador", "criar",          "Cadastrar colaboradores"),
  p("people.colaborador", "editar",         "Editar dados de colaboradores"),
  p("people.colaborador", "excluir",        "Excluir colaboradores"),
  p("people.colaborador", "mudar_situacao", "Alterar situação funcional (afastar, desligar)"),
  p("people.colaborador", "exportar",       "Exportar dados de colaboradores"),

  p("people.documento",   "ver",       "Ver documentos de colaboradores"),
  p("people.documento",   "enviar",    "Enviar documentos"),
  p("people.documento",   "aprovar",   "Aprovar ou rejeitar documentos"),
  p("people.documento",   "excluir",   "Excluir documentos"),

  p("people.cargo",       "ver",       "Ver cargos"),
  p("people.cargo",       "gerenciar", "Criar e editar cargos"),

  p("people.relatorio",   "ver",       "Ver indicadores de pessoas"),
  p("people.relatorio",   "exportar",  "Exportar relatórios de pessoas"),
];

const str = (recurso: string, acao: string) => `${recurso}:${acao}`;

/** Referência simbólica usada por controllers e serviços. */
export const PEOPLE_PERMISSIONS = {
  colaborador: {
    ver:           str("people.colaborador", "ver"),
    verTodos:      str("people.colaborador", "ver_todos"),
    criar:         str("people.colaborador", "criar"),
    editar:        str("people.colaborador", "editar"),
    excluir:       str("people.colaborador", "excluir"),
    mudarSituacao: str("people.colaborador", "mudar_situacao"),
    exportar:      str("people.colaborador", "exportar"),
  },
  documento: {
    ver:     str("people.documento", "ver"),
    enviar:  str("people.documento", "enviar"),
    aprovar: str("people.documento", "aprovar"),
    excluir: str("people.documento", "excluir"),
  },
  cargo: {
    ver:       str("people.cargo", "ver"),
    gerenciar: str("people.cargo", "gerenciar"),
  },
  relatorio: {
    ver:      str("people.relatorio", "ver"),
    exportar: str("people.relatorio", "exportar"),
  },
} as const;

/** Concedidas a quem hoje só enxerga (gestor, supervisor, visualizador). */
export const PEOPLE_PERMISSOES_LEITURA: readonly string[] = [
  PEOPLE_PERMISSIONS.colaborador.ver,
  PEOPLE_PERMISSIONS.documento.ver,
  PEOPLE_PERMISSIONS.cargo.ver,
  PEOPLE_PERMISSIONS.relatorio.ver,
];

/** Auditor: leitura ampla, sem escrita (PEOPLE_PERMISSIONS.md §11). */
export const PEOPLE_PERMISSOES_AUDITOR: readonly string[] = [
  ...PEOPLE_PERMISSOES_LEITURA,
  PEOPLE_PERMISSIONS.colaborador.verTodos,
  PEOPLE_PERMISSIONS.relatorio.exportar,
];
