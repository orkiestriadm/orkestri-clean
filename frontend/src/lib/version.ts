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

export const VERSAO = "1.11.3";

/**
 * Data da versão, escrita à mão junto com o bump.
 *
 * Não é gerada no build: `new Date()` no bundle muda a cada compilação, e duas
 * builds do mesmo código pareceriam versões diferentes.
 */
export const VERSAO_DATA = "2026-08-17";

/** Nome da entrega, para dar contexto ao número. */
export const VERSAO_NOME = "Monitoramento mostra o problema primeiro";

/**
 * Histórico exibido na tela Sobre, do mais recente para o mais antigo.
 *
 * Só o que muda a vida de quem usa. Refatoração interna não entra: quem lê
 * esta lista quer saber o que mudou para ele.
 */
export const HISTORICO: { versao: string; data: string; titulo: string; itens: string[] }[] = [
  {
    versao: "1.11.3",
    data: "2026-08-17",
    titulo: "Monitoramento mostra o problema primeiro",
    itens: [
      "A tela de Monitoramento passou a ser organizada por gravidade: o que está fora do ar e o que está instável aparecem primeiro e já abertos, e os equipamentos saudáveis vêm somados por unidade, para abrir só quando interessar. Antes os 55 offline ficavam espalhados no meio de 406 cartões verdes e só apareciam usando o filtro",
      "Equipamento com problema virou linha larga, com o nome inteiro — o cartão anterior cortava justamente o fim, que é onde está o KM e o sentido da via",
      "O tempo mostrado no equipamento fora do ar passou a ser há quanto tempo ele caiu. Antes aparecia o intervalo do último ping, então um equipamento parado há três dias exibia \"28s\" e parecia ter caído naquele instante",
      "Equipamento instável mostra o desenho da oscilação das últimas duas horas e a perda de pacote — latência média igual pode ser rede estável ou serrote, e são problemas diferentes",
      "A correlação de falhas (\"um switch caiu e levou 12 câmeras\") subiu para o topo da página, antes dos indicadores",
      "O vermelho ficou reservado para alarme: a etiqueta de tempo real ficou neutra e a disponibilidade geral agora muda de cor conforme o valor, em vez de ser sempre vermelha",
    ],
  },
  {
    versao: "1.11.2",
    data: "2026-08-16",
    titulo: "Chamado de frota pergunta se o veículo roda",
    itens: [
      "Ao abrir chamado de frota, a condição do veículo virou uma pergunta direta — \"O veículo consegue rodar?\", com as respostas \"Não, está parado\" e \"Sim, mas com defeito\". Os rótulos anteriores eram termos de quem já conhece a regra, e um chamado real chegou marcado como \"operando com avaria\" descrevendo um trator que não funciona",
      "Responder passou a ser obrigatório: sem isso o chamado chegava na oficina sem dizer se o veículo parou, que é justamente o que decide atender agora ou depois",
      "Se o texto do chamado menciona algo como \"não liga\" ou \"quebrado\" e a resposta diz que o veículo roda, a tela avisa da contradição — sem impedir de salvar, porque \"não funciona o ar\" num caminhão que roda todo dia é chamado legítimo",
    ],
  },
  {
    versao: "1.11.1",
    data: "2026-08-16",
    titulo: "Atraso implausível não vira alerta",
    itens: [
      "Na agenda de revisão, atraso grande demais para ser verdade — mais de dez vezes o intervalo do plano — deixa de aparecer como revisão vencida e passa a pedir a conferência do hodômetro. Dois veículos apareciam \"vencidos\" por 3.304.493 e 571.442 km, herança de leituras de abastecimento gravadas antes de existir checagem",
      "Esses casos também deixam de gerar aviso no WhatsApp: número absurdo na mensagem tira a credibilidade dos avisos que estão certos",
      "A revisão realmente atrasada continua vermelha e continua avisando",
    ],
  },
  {
    versao: "1.11.0",
    data: "2026-08-15",
    titulo: "Frotas: o KM do abastecimento manda",
    itens: [
      "O quilômetro lançado no abastecimento passa a atualizar o hodômetro do veículo em todas as situações — inclusive ao corrigir ou excluir um lançamento, que antes não mexiam em nada. É desse número que a revisão por KM depende, e ele podia estar semanas atrasado sem nenhum aviso na tela",
      "Leitura fora do razoável — um salto de mais de 30.000 km sobre o hodômetro atual — deixa de ser aceita, e a tela diz quantas foram recusadas em vez de informar apenas \"0 atualizados\"",
      "O pneu montado passa a acompanhar a quilometragem do veículo: o aviso de rodízio e o custo por quilômetro estavam parados no número do dia da instalação",
      "A agenda de revisão preventiva passa a gerar aviso. Ela mostrava vermelho na tela e não avisava ninguém, porque o alerta ainda olhava o agendamento por data, que deixou de ser usado",
      "Ao abrir chamado de frota, a situação relatada — inoperante ou operando com avaria — chega ao módulo de Manutenção e sugere a cor do Farol. A decisão continua sendo de quem atende, agora com dois botões e a consequência escrita na própria ordem de serviço",
      "A lista de ordens de serviço mostra de qual chamado cada uma nasceu e o que foi relatado na abertura",
      "O controle de CNH deixa de cobrar motorista inativo: a conta passa a ser de quem está ativo, e desligados e afastados aparecem quando pedidos",
      "Com o bloqueio de CNH ligado, motorista com habilitação vencida some dos campos de seleção — antes o bloqueio só pintava um aviso e a pessoa seguia selecionável",
      "A dashboard de Frotas exporta em Excel e PDF, levando o mesmo recorte de filtros que está na tela",
      "Estoque de pneus avulsos ganhou tela, com a quebra por medida — a pergunta de quem vai trocar não é quantos pneus existem, é se existe daquela medida",
      "Corrigido: ordem de serviço já finalizada continuava disparando aviso de manutenção atrasada, todos os dias",
    ],
  },
  {
    versao: "1.10.5",
    data: "2026-08-14",
    titulo: "Dashboard de Frotas com dado real",
    itens: [
      "A dashboard de Frotas passou a ler o estado dos veículos das ordens de serviço, e não do campo Status do cadastro — ela anunciava 100% de disponibilidade e nenhum veículo em manutenção enquanto o Farol, na tela ao lado, mostrava sete parados",
      "Novo indicador \"Com Avaria\": veículos que continuam rodando com defeito aberto, um número que o sistema já tinha e não mostrava em lugar nenhum",
      "\"Em Manutenção\" só acende quando há veículo parado — antes ficava colorido mesmo em zero, e zero e sete pareciam a mesma coisa",
    ],
  },
  {
    versao: "1.10.4",
    data: "2026-08-13",
    titulo: "Formulários de Frotas",
    itens: [
      "Cadastro de veículo organizado em blocos — Identificação, Veículo, Operação, Abastecimento, Aquisição e Anotações — em vez de vinte e seis campos em lista corrida",
      "Saíram do cadastro de veículo os campos Categoria, Unidade, Responsável e Motorista padrão, que não eram usados; as colunas correspondentes também saíram da listagem, onde só mostravam traço",
      "Ordem de serviço reorganizada, com o problema relatado logo no início e as três datas de prazo juntas",
      "Na ordem de serviço, a marcação de veículo parado ganhou destaque e passou a explicar o efeito: marcada, o veículo fica vermelho no Farol da Frota; desmarcada, amarelo",
      "O campo de problema da ordem de serviço virou caixa de texto — era uma linha só para relatos que passam de mil caracteres",
      "Na revisão, \"KM previsto\" passou a se chamar \"KM atual\", inclusive no relatório exportado, e o formulário separa o que foi planejado do que foi feito",
      "Corrigido: as telas de ordem de serviço e de categoria diziam \"Novo ordem de serviço\" e \"Novo categoria\"",
      "Explicações que estavam entre parênteses no rótulo passaram para baixo do campo, onde cabem inteiras",
    ],
  },
  {
    versao: "1.10.3",
    data: "2026-08-13",
    titulo: "A marca do menu vem do ambiente",
    itens: [
      "O logotipo do menu lateral passa a vir da configuração da instalação, como o da tela de login já vinha — cada ambiente exibe a sua marca, e ela deixa de depender do que está escrito no código",
      "Instalação sem logotipo próprio exibe o símbolo do produto",
    ],
  },
  {
    versao: "1.10.2",
    data: "2026-08-13",
    titulo: "Usuário novo entra só com Agenda e Keep",
    itens: [
      "Usuário recém-criado passa a ver apenas Agenda e Keep. Todo o resto — Visão Geral, Compliance, People, chamados — só aparece por papel ou permissão concedida",
      "O Keep passou a acompanhar a conta, como a Agenda já acompanhava: são ferramentas pessoais, e pedir permissão ao administrador para usar o próprio bloco de notas não fazia sentido",
      "Corrigido: o grupo Compliance aparecia no menu de qualquer pessoa, mesmo sem nenhuma permissão do módulo, por causa da tela Minhas. Quem responde por uma licença continua vendo as próprias pendências, agora pela permissão de obrigações",
    ],
  },
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
