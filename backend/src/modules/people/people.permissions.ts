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

  p("people.ferias",      "ver",       "Ver saldo e períodos de férias"),
  p("people.ferias",      "solicitar", "Solicitar férias"),

  p("people.beneficio",   "ver",       "Ver benefícios de colaboradores"),
  p("people.beneficio",   "gerenciar", "Manter o catálogo e conceder benefícios"),

  p("people.treinamento", "ver",       "Ver treinamentos e certificações"),
  p("people.treinamento", "gerenciar", "Manter cursos e registrar participações"),

  // Avaliação é separada de treinamento apesar de conviverem na mesma aba:
  // desempenho é dado sensível de carreira, e quem cuida de capacitação não
  // necessariamente pode ler a nota que o gestor deu.
  p("people.avaliacao",   "ver",       "Ver avaliações de desempenho"),
  p("people.avaliacao",   "gerenciar", "Criar e finalizar avaliações"),

  // Salário é o dado mais sensível do módulo. Fica fora de qualquer perfil
  // padrão: ver remuneração é decisão explícita, não consequência de ser gestor.
  p("people.salario",     "ver",       "Ver remuneração e histórico salarial"),
  p("people.salario",     "gerenciar", "Registrar mudança salarial e faixa de cargo"),

  p("people.feedback",    "ver",       "Ver feedbacks do colaborador"),
  p("people.feedback",    "registrar", "Registrar feedback e ver anotação privada"),

  // Carreira é leitura ampla de propósito: o plano só muda comportamento se a
  // pessoa souber o que falta para o próximo degrau. Quem DESENHA a trilha é
  // que precisa de concessão explícita.
  p("people.carreira",    "ver",       "Ver trilhas de carreira e prontidão"),
  p("people.carreira",    "gerenciar", "Desenhar trilhas, degraus e requisitos"),

  // Checklist: ver e amplo porque a pessoa precisa saber o que falta dela e o
  // gestor o que falta do time. Conduzir o processo e que exige concessao.
  p("people.checklist",   "ver",       "Ver checklists de admissão e desligamento"),
  p("people.checklist",   "gerenciar", "Manter modelos, abrir checklist e marcar itens"),

  p("people.relatorio",   "ver",       "Ver indicadores de pessoas"),
  p("people.relatorio",   "exportar",  "Exportar relatórios de pessoas"),

  // Separada de `colaborador:excluir` porque são poderes diferentes: excluir
  // some das telas e volta atrás; anonimizar apaga o dado pessoal e não tem
  // volta. Reaproveitar a permissão daria o irreversível a quem recebeu o
  // reversível. Fora de todo perfil padrão, como salário.
  p("people.privacidade", "gerenciar", "Eliminar dados pessoais de ex-colaborador (LGPD)"),
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
  ferias: {
    ver:       str("people.ferias", "ver"),
    solicitar: str("people.ferias", "solicitar"),
  },
  beneficio: {
    ver:       str("people.beneficio", "ver"),
    gerenciar: str("people.beneficio", "gerenciar"),
  },
  treinamento: {
    ver:       str("people.treinamento", "ver"),
    gerenciar: str("people.treinamento", "gerenciar"),
  },
  avaliacao: {
    ver:       str("people.avaliacao", "ver"),
    gerenciar: str("people.avaliacao", "gerenciar"),
  },
  salario: {
    ver:       str("people.salario", "ver"),
    gerenciar: str("people.salario", "gerenciar"),
  },
  feedback: {
    ver:       str("people.feedback", "ver"),
    registrar: str("people.feedback", "registrar"),
  },
  checklist: {
    ver:       str("people.checklist", "ver"),
    gerenciar: str("people.checklist", "gerenciar"),
  },
  carreira: {
    ver:       str("people.carreira", "ver"),
    gerenciar: str("people.carreira", "gerenciar"),
  },
  relatorio: {
    ver:      str("people.relatorio", "ver"),
    exportar: str("people.relatorio", "exportar"),
  },
  privacidade: {
    gerenciar: str("people.privacidade", "gerenciar"),
  },
} as const;

/** Concedidas a quem hoje só enxerga (gestor, supervisor, visualizador). */
export const PEOPLE_PERMISSOES_LEITURA: readonly string[] = [
  PEOPLE_PERMISSIONS.colaborador.ver,
  PEOPLE_PERMISSIONS.documento.ver,
  PEOPLE_PERMISSIONS.cargo.ver,
  PEOPLE_PERMISSIONS.treinamento.ver,
  PEOPLE_PERMISSIONS.carreira.ver,
  PEOPLE_PERMISSIONS.checklist.ver,
  PEOPLE_PERMISSIONS.relatorio.ver,
  // `beneficio.ver`, `avaliacao.ver` e `salario.ver` ficam de fora: salário
  // indireto e nota de desempenho não são leitura de rotina de quem apenas
  // consulta o quadro. Quem precisar recebe explicitamente.
];

/** Auditor: leitura ampla, sem escrita (PEOPLE_PERMISSIONS.md §11). */
export const PEOPLE_PERMISSOES_AUDITOR: readonly string[] = [
  ...PEOPLE_PERMISSOES_LEITURA,
  PEOPLE_PERMISSIONS.colaborador.verTodos,
  PEOPLE_PERMISSIONS.relatorio.exportar,
];
