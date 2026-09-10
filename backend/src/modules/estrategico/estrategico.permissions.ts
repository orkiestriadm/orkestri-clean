/**
 * Catálogo de permissões do Orkiestri Strategy.
 *
 * Formato `recurso:acao`, como o resto da plataforma. Só entra o que tem
 * endpoint — permissão sem uso faz conceder acesso a nada.
 *
 * CONFIDENCIALIDADE: o módulo trata litígio, arbitragem e pleito regulatório.
 * Por isso NENHUM papel padrão recebe estas permissões automaticamente — nem
 * o `visualizador` nem o `auditor`, que ganham todo `:ver` do sistema (ver o
 * filtro em auth.service.ts). Só o master e o `administrador` enxergam de
 * saída; o resto é concessão explícita, usando os perfis abaixo como receita.
 */

type Permissao = { recurso: string; acao: string; descricao: string };

const p = (recurso: string, acao: string, descricao: string): Permissao =>
  ({ recurso, acao, descricao });

export const ESTRATEGICO_PREFIXO = "estrategico.";

export const ESTRATEGICO_PERMISSION_CATALOG: readonly Permissao[] = [
  p("estrategico.caso", "ver",             "Ver assuntos estratégicos, timeline, tarefas, riscos e dependências"),
  p("estrategico.caso", "criar",           "Cadastrar assuntos e oportunidades"),
  p("estrategico.caso", "editar",          "Editar qualquer assunto (etapa, responsáveis, próxima ação, riscos)"),
  // Linha a linha: só vale onde a pessoa é responsável executiva, operacional
  // ou pela próxima ação. É o perfil "Responsável" do plano.
  p("estrategico.caso", "editar_proprios", "Atualizar os assuntos sob a própria responsabilidade"),
  p("estrategico.caso", "excluir",         "Excluir (logicamente) assuntos"),
  p("estrategico.caso", "farol",           "Alterar o farol manualmente, com justificativa"),

  p("estrategico.tarefa", "executar", "Executar tarefas, registrar andamentos e comentar"),

  // Valor é separado de ver o assunto: quem executa uma tarefa não precisa
  // saber quanto o pleito vale.
  p("estrategico.financeiro", "ver",    "Ver valores financeiros dos assuntos"),
  p("estrategico.financeiro", "editar", "Alterar valores financeiros (gera histórico)"),

  p("estrategico.documento", "ver",     "Ver e baixar documentos dos assuntos"),
  p("estrategico.documento", "enviar",  "Anexar documentos e novas versões"),
  p("estrategico.documento", "excluir", "Excluir documentos"),

  p("estrategico.reuniao", "ver",      "Ver reuniões estratégicas, pautas e atas"),
  p("estrategico.reuniao", "conduzir", "Criar e conduzir reuniões, registrar decisões e gerar atas"),

  p("estrategico.relatorio", "ver",      "Ver o painel executivo e relatórios"),
  p("estrategico.relatorio", "exportar", "Exportar relatórios (PDF, Excel, CSV)"),

  p("estrategico.admin", "gerenciar", "Configurar catálogos, parâmetros e automações; importar a planilha"),
];

const str = (recurso: string, acao: string) => `${recurso}:${acao}`;

export const ESTRATEGICO_PERMISSIONS = {
  caso: {
    ver:            str("estrategico.caso", "ver"),
    criar:          str("estrategico.caso", "criar"),
    editar:         str("estrategico.caso", "editar"),
    editarProprios: str("estrategico.caso", "editar_proprios"),
    excluir:        str("estrategico.caso", "excluir"),
    farol:          str("estrategico.caso", "farol"),
  },
  tarefa: { executar: str("estrategico.tarefa", "executar") },
  financeiro: {
    ver:    str("estrategico.financeiro", "ver"),
    editar: str("estrategico.financeiro", "editar"),
  },
  documento: {
    ver:     str("estrategico.documento", "ver"),
    enviar:  str("estrategico.documento", "enviar"),
    excluir: str("estrategico.documento", "excluir"),
  },
  reuniao: {
    ver:      str("estrategico.reuniao", "ver"),
    conduzir: str("estrategico.reuniao", "conduzir"),
  },
  relatorio: {
    ver:      str("estrategico.relatorio", "ver"),
    exportar: str("estrategico.relatorio", "exportar"),
  },
  admin: { gerenciar: str("estrategico.admin", "gerenciar") },
} as const;

const P = ESTRATEGICO_PERMISSIONS;

/**
 * Receitas dos perfis da seção 15 do plano. Os papéis do sistema são fixos
 * (administrador, gestor, analista...), então os perfis estratégicos são
 * CONJUNTOS de permissões que o administrador concede — diretamente ou num
 * papel próprio. A tela de Configurações do módulo mostra estas receitas.
 */
const CONSULTA = [P.caso.ver, P.relatorio.ver, P.reuniao.ver, P.documento.ver];
const COLABORADOR = [P.caso.ver, P.tarefa.executar, P.documento.ver, P.documento.enviar];
const RESPONSAVEL = [...COLABORADOR, P.caso.editarProprios, P.financeiro.ver, P.relatorio.ver, P.reuniao.ver];
const DIRETORIA = [...CONSULTA, P.financeiro.ver, P.relatorio.exportar, P.reuniao.conduzir, P.caso.farol];
const TODAS = ESTRATEGICO_PERMISSION_CATALOG.map(x => str(x.recurso, x.acao));
const GESTOR = TODAS.filter(x => x !== P.admin.gerenciar);

export const ESTRATEGICO_PERFIS: readonly { id: string; nome: string; descricao: string; permissoes: string[] }[] = [
  { id: "administrador", nome: "Administrador",      descricao: "Configurações, cadastros, importação e permissões.", permissoes: TODAS },
  { id: "gestor",        nome: "Gestor Estratégico", descricao: "Acesso total aos assuntos e dashboards.",            permissoes: GESTOR },
  { id: "responsavel",   nome: "Responsável",        descricao: "Atualiza os assuntos sob sua responsabilidade.",     permissoes: [...new Set(RESPONSAVEL)] },
  { id: "colaborador",   nome: "Colaborador",        descricao: "Executa tarefas e registra informações.",            permissoes: COLABORADOR },
  { id: "diretoria",     nome: "Diretoria",          descricao: "Visão executiva, reuniões e acompanhamento.",        permissoes: [...new Set(DIRETORIA)] },
  { id: "consulta",      nome: "Consulta",           descricao: "Somente leitura, sem valores financeiros.",          permissoes: CONSULTA },
];

export function tem(user: any, permissao: string): boolean {
  if (user?.isMaster) return true;
  const perms: string[] = user?.permissions ?? [];
  return perms.includes("*") || perms.includes(permissao);
}
