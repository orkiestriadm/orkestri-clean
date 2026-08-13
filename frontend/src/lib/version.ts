/**
 * Versão do sistema — fonte única.
 *
 * Existe para dar ao usuário uma referência exata ao relatar problema:
 * "quebrou na 1.1.0" resolve; "quebrou hoje de manhã" não, ainda mais com
 * vários deploys no mesmo dia.
 *
 * Como numerar (semver adaptado ao produto):
 *   MAIOR — muda ou quebra fluxo existente, exige ação de quem usa
 *   MENOR — módulo ou funcionalidade nova
 *   PATCH — correção, sem funcionalidade nova
 *
 * SUBIR A VERSÃO É PARTE DO DEPLOY, não um detalhe do fim. Deploy sem bump
 * deixa duas builds diferentes se dizendo a mesma versão — pior que não ter
 * versão nenhuma, porque dá falsa confiança.
 */

export const VERSAO = "1.10.1";

/**
 * Data da versão, escrita à mão junto com o bump.
 *
 * Não é gerada no build: `new Date()` no bundle muda a cada compilação, e duas
 * builds do mesmo código pareceriam versões diferentes.
 */
export const VERSAO_DATA = "2026-08-12";

/** Nome da entrega, para dar contexto ao número. */
export const VERSAO_NOME = "Cabeçalho fixo no grid do Orçamento";

/**
 * Histórico exibido na tela Sobre, do mais recente para o mais antigo.
 *
 * Só o que muda a vida de quem usa. Refatoração interna não entra: quem lê
 * esta lista quer saber o que mudou para ele.
 */
export const HISTORICO: { versao: string; data: string; titulo: string; itens: string[] }[] = [
  {
    versao: "1.10.1",
    data: "2026-08-12",
    titulo: "Cabeçalho fixo no grid do Orçamento",
    itens: [
      "No Orçamento, a linha de referência do grid (item, os doze meses, previsto, realizado e execução) fica fixa no topo enquanto a lista rola — descer até o trigésimo item não faz mais perder de vista qual coluna é qual mês. Vale para OPEX e CAPEX",
    ],
  },
  {
    versao: "1.10.0",
    data: "2026-08-12",
    titulo: "Chamados: fila, histórico e carga da equipe",
    itens: [
      "A fila pública virou uma lista de triagem: duplo clique assume o chamado, e o painel ao lado mostra o relato inteiro sem precisar abrir",
      "Setas do teclado percorrem a fila com o conteúdo acompanhando; Enter abre o chamado completo",
      "Seleção em lote na fila, para assumir vários de uma vez",
      "Colunas Resolvido e Fechado guardam só os últimos 5 dias — o quadro parou de ser ocupado por chamado encerrado há dois meses. O que sai fica indicado no cabeçalho e a contagem leva ao histórico",
      "Aba Histórico com três recortes: meus chamados, os da minha equipe e todos (para quem distribui trabalho), com filtro por período",
      "Buscar por número passou a funcionar: digitar 38 abre o chamado 38, em vez de procurar \"38\" no texto",
      "Aba Equipe: quanto cada pessoa tem em mãos, o que está parado e há quantos dias, com a fila sem responsável em primeiro lugar",
      "Ao mover um chamado para Aguardando, o sistema pergunta de que ele depende — e o card passa a mostrar isso e há quantos dias está parado",
      "Chamado atribuído por outra pessoa pode ser devolvido com motivo, voltando a quem atribuiu e não para a fila",
      "Ao abrir um chamado, dá para atribuir direto a alguém em vez de deixá-lo na fila",
      "Chamado de frota abre ordem de serviço em Frotas com um clique, e encerrar o chamado encerra a OS",
      "Os dois prazos do SLA — primeira resposta e resolução — passam a aparecer lado a lado; antes só um deles era mostrado",
      "Fila e quadro dividem a altura conforme o volume: fila vazia deixa de ocupar meia tela",
      "Papéis passam a valer por organização",
      "Anexos de chamado, projeto e compliance saem por rota autenticada, não mais por endereço público",
      "Corrigido: em 48 telas era possível alcançar registro de outra organização informando o endereço direto",
      "Corrigido: as telas administrativas do portal do cliente estavam acessíveis sem autenticação",
      "Corrigido: só o módulo de agenda vem liberado por padrão — Visão Geral, Sobre e Meu RH passam a exigir permissão, e quem não a tem cai no primeiro módulo que possui em vez de numa tela de erro",
      "Corrigido: o painel de acesso rápido oferecia doze atalhos a todo mundo, e onze terminavam em \"sem permissão\"",
      "Corrigido: o escalonamento automático de SLA gravava uma prioridade inexistente, e o chamado escalado aparecia como \"Média\"",
    ],
  },
  {
    versao: "1.9.2",
    data: "2026-08-09",
    titulo: "Sobre restrito à administração",
    itens: [
      "A tela Sobre passa a ser visível apenas ao master da organização e ao super administrador",
      "Para informar a versão ao relatar um problema, peça a um administrador — ou consulte /api/health, que segue respondendo",
    ],
  },
  {
    versao: "1.9.1",
    data: "2026-08-09",
    titulo: "Relatórios e notificações do Compliance",
    itens: [
      "Relatórios do Compliance passam a ter filtro por período, categoria e unidade — e o arquivo exportado leva exatamente o recorte que está na tela",
      "Configuração de notificações em uma tela só: quando avisar, quem recebe e o que a mensagem diz",
      "Os prazos de aviso viraram fichas clicáveis, com a sequência desenhada — dá para ver a lacuna antes de ela custar um prazo",
      "A mensagem pode ser vista pronta, montada com uma obrigação real, antes de salvar",
      "Botão para enviar a mensagem de teste na hora, e provar que o e-mail ou o WhatsApp chegam",
      "WhatsApps adicionais podem ser cadastrados na régua de aviso — o campo existia e não tinha onde preencher",
      "Corrigido: os botões de exportar relatório apareciam para quem não tinha permissão de usá-los, e o clique terminava em erro",
    ],
  },
  {
    versao: "1.9.0",
    data: "2026-08-09",
    titulo: "Compliance e convergência dos ambientes",
    itens: [
      "Compliance: licenças, laudos, AVCB e contratos com prazo, substituindo o controle em planilha",
      "O prazo para começar a renovar é calculado, não digitado: validade menos a antecedência que o órgão exige, menos a folga da empresa",
      "Licença vencida continua regular quando o protocolo de renovação foi feito dentro do prazo — e o sistema avisa quando o protocolo foi tarde demais",
      "Alertas com régua configurável por categoria, escalonamento e prévia do que seria enviado hoje, sem enviar nada",
      "Calendário mostra três marcos por obrigação: quando começar, o último dia para protocolar, e o vencimento",
      "Farol da Frota disponível também em produção",
      "Corrigido: excluir e transferir ativo, excluir artigo, configurar SLA, excluir chamado, excluir usuário e configurar monitoramento exigiam permissões que não existiam para ser concedidas — só funcionavam para o master",
    ],
  },
  {
    versao: "1.8.0",
    data: "2026-08-03",
    titulo: "Meu RH, avaliação 360 e privacidade",
    itens: [
      "Meu RH: cada pessoa vê o próprio saldo de férias, documentos, carreira e pendências, sem depender do RH",
      "Pedido de férias mostra o desfecho — aprovado, recusado com motivo — e pode ser cancelado por quem pediu",
      "Autoavaliação e avaliação de pares, com a divergência entre a nota da pessoa e a do gestor",
      "Comentários de pares chegam sem autor, e a média some quando há poucas respostas",
      "Calibração: compara a régua de cada gestor no mesmo ciclo, sem alterar nota nenhuma",
      "Privacidade: eliminação dos dados pessoais de ex-colaborador depois do prazo de guarda (LGPD)",
      "Aviso de item de checklist atrasado, que antes só documentos e férias tinham",
      "Correção: prazos apareciam um dia adiantados — item que vencia hoje constava como atrasado",
      "Correção: o perfil completo de qualquer colega podia ser aberto por quem não tinha alcance a ele",
    ],
  },
  {
    versao: "1.7.0",
    data: "2026-08-03",
    titulo: "Promoção com salário e férias na rescisão",
    itens: [
      "Promover pelo plano de carreira ajusta o salário na mesma ação, com a faixa do cargo à vista",
      "Desligamento resume as férias devidas, separando o vencido — que é pago em dobro",
      "Linha do tempo mostra o nome do cargo e do setor no lugar do código interno",
    ],
  },
  {
    versao: "1.6.0",
    data: "2026-08-03",
    titulo: "Checklist de admissão e melhorias da auditoria",
    itens: [
      "Checklist de admissão e desligamento: o que falta, de quem é e qual prazo já venceu",
      "Modelos de checklist configuráveis em Catálogos, com responsável e prazo por item",
      "Promover pelo plano de carreira, sem precisar editar o cargo na mão",
      "Excluir cadastro criado por engano, com confirmação e sem confundir com desligamento",
      "Abas do perfil agrupadas em Perfil, Tempo, Financeiro e Desenvolvimento",
      "Passivo de férias reflete a solicitação na hora, sem esperar a virada do dia",
    ],
  },
  {
    versao: "1.5.0",
    data: "2026-08-02",
    titulo: "Auditoria do People — conformidade documental",
    itens: [
      "Documentos deixam de ser perdidos a cada atualização do sistema",
      "Tela de conformidade documental: o que falta aprovar, o que vence e o que perdeu o arquivo",
      "A lista de documentos avisa quando o arquivo não está mais disponível, em vez de falhar só no clique",
    ],
  },
  {
    versao: "1.4.0",
    data: "2026-07-30",
    titulo: "Plano de carreira",
    itens: [
      "Trilhas de carreira: sequência de cargos com requisitos por degrau",
      "Requisito pode ser competência com nível mínimo, treinamento concluído ou conferência manual",
      "Tempo mínimo no cargo e nota mínima de avaliação como critérios do degrau",
      "Aba Carreira no perfil mostra onde a pessoa está e o que falta, item a item, para o próximo degrau",
      "Requisito marcado como diferencial conta a favor sem travar a progressão",
    ],
  },
  {
    versao: "1.3.0",
    data: "2026-07-29",
    titulo: "Faixas salariais e correções da validação",
    itens: [
      "Faixa salarial por cargo tem tela própria, em Cargos › Faixas salariais",
      "Aviso de quantos cargos estão sem faixa — sem faixa, o alerta de fora da faixa fica cego",
      "Linha do tempo do colaborador não mostra mais valor de salário nem nota de avaliação a quem não tem a permissão",
      "Passivo de férias passa a ser calculado na subida do sistema, não só às 07:00",
      "Abas do perfil roláveis: Desenvolvimento, Competências, Equipe e Histórico estavam inalcançáveis",
      "Cargo do catálogo aparece no organograma, na equipe e nos indicadores no lugar de traço",
    ],
  },
  {
    versao: "1.2.0",
    data: "2026-07-29",
    titulo: "People — Remuneração e feedback",
    itens: [
      "Remuneração: salário vigente, histórico com variação e motivo da mudança",
      "Faixa salarial por cargo, com posição de cada pessoa dentro dela",
      "Painel de massa salarial, quem está fora da faixa e quem está sem reajuste",
      "Feedback contínuo — elogio, correção e 1:1 — com anotação privada do gestor",
      "Aba Remuneração no perfil, sob permissão própria e fora dos perfis padrão",
    ],
  },
  {
    versao: "1.1.0",
    data: "2026-07-29",
    // Sem o nome do produto: o módulo se chama "People" no menu, e esta tela
    // é lida também no servidor white-label, onde a marca é a do cliente.
    titulo: "People — gestão de pessoas",
    itens: [
      "Módulo de pessoas: colaboradores, cargos, organograma e equipes",
      "Documentos do colaborador com aprovação e controle de validade",
      "Férias com período aquisitivo, saldo e painel de passivo",
      "Benefícios com vigência e custo mensal",
      "Treinamentos, certificações com validade e avaliações de desempenho",
      "Ausências e solicitações ao RH com fluxo de aprovação",
      "Indicadores de pessoas e exportação do quadro em CSV",
      "Notificações de admissão, férias, documentos e prazos vencendo",
      "Recuperação de senha por WhatsApp, além do e-mail",
    ],
  },
  {
    versao: "1.0.0",
    data: "2026-07-28",
    titulo: "Plataforma",
    itens: [
      "Chamados, projetos, frota, orçamento, ativos e conhecimento",
      "Painel de plataforma para super administradores",
      "Site institucional no mesmo domínio do sistema",
    ],
  },
];
