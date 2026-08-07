/**
 * Catálogo de permissões do Orkiestri Compliance.
 *
 * Formato `recurso:acao`, como o resto da plataforma — a tabela `permissions`
 * tem as colunas `recurso` e `acao` e a string efetiva é sempre a concatenação
 * das duas (auth.service.ts). O namespace do módulo vai no recurso
 * (`compliance.obrigacao`) e a ação fica em português, como nas outras.
 *
 * Só entra aqui o que tem endpoint. Permissão sem uso polui a matriz que o
 * administrador lê e faz conceder acesso a nada.
 */

type Permissao = { recurso: string; acao: string; descricao: string };

const p = (recurso: string, acao: string, descricao: string): Permissao =>
  ({ recurso, acao, descricao });

export const COMPLIANCE_PERMISSION_CATALOG: readonly Permissao[] = [
  p("compliance.obrigacao", "ver",           "Ver obrigações e seus prazos"),
  p("compliance.obrigacao", "criar",         "Cadastrar obrigações"),
  p("compliance.obrigacao", "editar",        "Editar obrigações"),
  p("compliance.obrigacao", "excluir",       "Excluir (logicamente) obrigações"),
  // Renovar é separado de editar: renovar CONGELA a versão anterior e abre uma
  // nova vigência. É um ato de gestão, não uma correção de digitação.
  p("compliance.obrigacao", "renovar",       "Renovar e registrar protocolo de renovação"),
  p("compliance.obrigacao", "mudar_status",  "Suspender, cancelar ou arquivar obrigações"),
  p("compliance.obrigacao", "exportar",      "Exportar a carteira de obrigações"),

  p("compliance.anexo",     "ver",     "Ver e baixar anexos das obrigações"),
  p("compliance.anexo",     "enviar",  "Anexar documentos"),
  p("compliance.anexo",     "excluir", "Excluir anexos"),

  p("compliance.categoria", "ver",       "Ver categorias e campos personalizados"),
  p("compliance.categoria", "gerenciar", "Criar categorias e definir campos personalizados"),

  // Configurar a régua de avisos é poder decidir quem é incomodado e quando.
  // Quem cadastra uma licença não recebe isso junto.
  p("compliance.notificacao", "ver",        "Ver réguas de alerta e histórico de envios"),
  p("compliance.notificacao", "configurar", "Configurar réguas, templates e escalonamento"),

  p("compliance.aprovacao", "aprovar", "Aprovar ou rejeitar obrigações em fluxo"),

  p("compliance.relatorio", "ver",      "Ver painel e relatórios de conformidade"),
  p("compliance.relatorio", "exportar", "Exportar relatórios de conformidade"),

  // Guarda-chuva do módulo: órgãos, tags e fluxos de aprovação.
  p("compliance.admin", "gerenciar", "Administrar o módulo (órgãos, tags, fluxos)"),
];

const str = (recurso: string, acao: string) => `${recurso}:${acao}`;

/** Referência simbólica usada por controllers e serviços. */
export const COMPLIANCE_PERMISSIONS = {
  obrigacao: {
    ver:          str("compliance.obrigacao", "ver"),
    criar:        str("compliance.obrigacao", "criar"),
    editar:       str("compliance.obrigacao", "editar"),
    excluir:      str("compliance.obrigacao", "excluir"),
    renovar:      str("compliance.obrigacao", "renovar"),
    mudarStatus:  str("compliance.obrigacao", "mudar_status"),
    exportar:     str("compliance.obrigacao", "exportar"),
  },
  anexo: {
    ver:     str("compliance.anexo", "ver"),
    enviar:  str("compliance.anexo", "enviar"),
    excluir: str("compliance.anexo", "excluir"),
  },
  categoria: {
    ver:       str("compliance.categoria", "ver"),
    gerenciar: str("compliance.categoria", "gerenciar"),
  },
  notificacao: {
    ver:        str("compliance.notificacao", "ver"),
    configurar: str("compliance.notificacao", "configurar"),
  },
  aprovacao: {
    aprovar: str("compliance.aprovacao", "aprovar"),
  },
  relatorio: {
    ver:      str("compliance.relatorio", "ver"),
    exportar: str("compliance.relatorio", "exportar"),
  },
  admin: {
    gerenciar: str("compliance.admin", "gerenciar"),
  },
} as const;

/**
 * Concedidas a quem só precisa enxergar (gestor, supervisor, visualizador).
 *
 * Ver a carteira de obrigações é leitura de rotina para qualquer gestor: a
 * licença que vence é problema da operação inteira, não só de quem a cadastrou.
 * O anexo entra junto porque uma obrigação sem o documento anexo não prova nada.
 */
export const COMPLIANCE_PERMISSOES_LEITURA: readonly string[] = [
  COMPLIANCE_PERMISSIONS.obrigacao.ver,
  COMPLIANCE_PERMISSIONS.anexo.ver,
  COMPLIANCE_PERMISSIONS.categoria.ver,
  COMPLIANCE_PERMISSIONS.relatorio.ver,
];

/** Operação do dia a dia de quem cuida das licenças. */
export const COMPLIANCE_PERMISSOES_OPERACAO: readonly string[] = [
  ...COMPLIANCE_PERMISSOES_LEITURA,
  COMPLIANCE_PERMISSIONS.obrigacao.criar,
  COMPLIANCE_PERMISSIONS.obrigacao.editar,
  COMPLIANCE_PERMISSIONS.obrigacao.renovar,
  COMPLIANCE_PERMISSIONS.anexo.enviar,
  COMPLIANCE_PERMISSIONS.notificacao.ver,
];

/** Auditor: leitura ampla, inclusive do que foi notificado a quem. */
export const COMPLIANCE_PERMISSOES_AUDITOR: readonly string[] = [
  ...COMPLIANCE_PERMISSOES_LEITURA,
  COMPLIANCE_PERMISSIONS.notificacao.ver,
  COMPLIANCE_PERMISSIONS.relatorio.exportar,
  COMPLIANCE_PERMISSIONS.obrigacao.exportar,
];
