/**
 * Catálogo de permissões do Orkiestri Strategy.
 *
 * Formato `recurso:acao`, como o resto da plataforma. Só entra o que tem
 * endpoint — permissão sem uso faz conceder acesso a nada.
 *
 * CONFIDENCIALIDADE: o módulo trata litígio, arbitragem e pleito regulatório.
 * Nem o `visualizador` nem o `auditor`, que ganham todo `:ver` do sistema,
 * recebem estas permissões (ver o filtro em auth.service.ts). Enxergam o
 * módulo: o master, o `administrador` e quem tiver o papel ESTRATEGICO_PAPEL.
 *
 * O catálogo continua granular porque é o que os endpoints verificam; o acesso
 * das pessoas, não — ver ESTRATEGICO_PAPEL.
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

/**
 * Papel de quem usa o Strategy. O módulo é da alta gestão e o acesso é
 * tudo-ou-nada (decisão de 11/09/2026): quem entra cadastra, edita, exclui e
 * configura — não há perfil de consulta, colaborador ou diretoria. O papel
 * carrega TODAS as permissões do módulo e nenhuma de outro, e é semeado em
 * cada organização junto com os papéis padrão. Concede-se em Administração ›
 * Cadastros, somando aos papéis que a pessoa já tenha.
 */
export const ESTRATEGICO_PAPEL = "Alta Gestão (Strategy)";

export function tem(user: any, permissao: string): boolean {
  if (user?.isMaster) return true;
  const perms: string[] = user?.permissions ?? [];
  return perms.includes("*") || perms.includes(permissao);
}
