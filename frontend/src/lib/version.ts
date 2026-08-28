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

export const VERSAO = "1.21.0";

/**
 * Data da versão, escrita à mão junto com o bump.
 *
 * Não é gerada no build: `new Date()` no bundle muda a cada compilação, e duas
 * builds do mesmo código pareceriam versões diferentes.
 */
export const VERSAO_DATA = "2026-08-25";

/** Nome da entrega, para dar contexto ao número. */
export const VERSAO_NOME = "Módulo de Indicações (referral)";

/**
 * Histórico exibido na tela Sobre, do mais recente para o mais antigo.
 *
 * Só o que muda a vida de quem usa. Refatoração interna não entra: quem lê
 * esta lista quer saber o que mudou para ele.
 */
export const HISTORICO: { versao: string; data: string; titulo: string; itens: string[] }[] = [
  {
    versao: "1.21.0",
    data: "2026-08-27",
    titulo: "Indicações (Indique e Ganhe) — controle manual",
    itens: [
      "Nova aba 🎁 Indicações no painel Super Admin: acompanhe os usuários em teste (dias restantes / vencidos), quem indicou cada um, e faça o controle na mão — marcar que efetivou a assinatura (R$27), gerar a comissão do indicador (R$5) e marcar como paga. Botão para falar direto no WhatsApp da pessoa",
      "No cadastro do teste (site) entrou um campo opcional de código de indicação; quem não informou, o admin pode definir o indicador à mão pela tela. Sem Mercado Pago — tudo manual nesta primeira versão",
    ],
  },
  {
    versao: "1.20.2",
    data: "2026-08-27",
    titulo: "Tutorial no WhatsApp ao vincular",
    itens: [
      "Assim que a pessoa vincula o WhatsApp, o sistema envia uma mensagem curta ensinando a criar eventos por mensagem (com exemplos prontos para copiar, inclusive recorrentes)",
    ],
  },
  {
    versao: "1.20.1",
    data: "2026-08-27",
    titulo: "Perfil rola no celular",
    itens: [
      "Correção: no celular, a tela de Perfil não rolava — quem tinha pouca altura de tela não conseguia chegar até o card de configurar o WhatsApp (nem no botão Salvar). Agora a tela rola normalmente",
    ],
  },
  {
    versao: "1.20.0",
    data: "2026-08-27",
    titulo: "Eventos recorrentes pelo WhatsApp",
    itens: [
      "Agora dá para criar compromissos que se repetem, direto pela mensagem: \"Evento: Academia 18h todo dia por 30 dias\", \"Evento: Reunião 10h toda semana até 31/12\", \"Evento: Pagamento 9h todo mês por 6 meses\". Aceita todo dia / toda semana / a cada 2 semanas / todo mês, com \"por N dias/semanas/meses/vezes\" ou \"até DD/MM\" (sem fim informado, assume 3 meses)",
      "Correção: a confirmação de evento criado por WhatsApp agora chega de fato (o WhatsApp não deixa responder ao identificador oculto de quem envia, então a resposta vai para o número cadastrado no perfil da pessoa)",
    ],
  },
  {
    versao: "1.19.1",
    data: "2026-08-27",
    titulo: "Criar evento pelo WhatsApp",
    itens: [
      "Agora dá para criar um compromisso mandando uma mensagem no WhatsApp do sistema, no formato: Evento: <título> <data> <hora> (ex.: \"Evento: Reunião 27/08 14:00\"). Aceita \"hoje\"/\"amanhã\" e horários como \"9h\" ou \"14:30\"; o fim entra automaticamente 1h depois. O sistema confirma por WhatsApp",
      "Como o WhatsApp esconde o número de quem envia, cada pessoa vincula o seu WhatsApp uma única vez: em Perfil → Criar evento pelo WhatsApp aparece um código para enviar (ex.: \"VINCULAR ABC123\"). Depois disso, os eventos criados por mensagem caem na agenda de quem enviou e a confirmação volta para essa pessoa",
    ],
  },
  {
    versao: "1.18.2",
    data: "2026-08-25",
    titulo: "Acesso de teste vê só o módulo escolhido",
    itens: [
      "Correção: o acesso de teste da landing page não abre mais a Visão Geral (que dava erro por consultar dados de módulos que o teste não tem). Agora o usuário entra direto no módulo que escolheu no cadastro — e enxerga só ele",
    ],
  },
  {
    versao: "1.18.1",
    data: "2026-08-25",
    titulo: "Agenda: dia correto + fim automático",
    itens: [
      "Correção: eventos criados no fim do dia apareciam no dia seguinte na visão de mês. A agenda agora agrupa cada evento pelo dia local correto",
      "Ao definir o horário de início de um evento, o término é ajustado automaticamente para 1 hora depois — e continua editável manualmente",
    ],
  },
  {
    versao: "1.18.0",
    data: "2026-08-25",
    titulo: "Dashboard de Billing",
    itens: [
      "Nova aba 📊 Dashboard no painel Super Admin (ao lado de Organizações e Billing): receita total, MRR, assinantes ativos e ticket médio, com receita acumulada no tempo, distribuição por plano, top organizações e novos assinantes por mês. Filtro de período (30/60/90 dias) que recalcula a dashboard inteira ao vivo",
    ],
  },
  {
    versao: "1.17.5",
    data: "2026-08-25",
    titulo: "Gerir lembretes de agenda + 30 min",
    itens: [
      "Novo lembrete de compromisso de 30 minutos antes, além dos de 1 hora, 15 e 5 minutos e na hora",
      "A tela de lembretes (Configurações → Alertas Visuais) ganhou botões para adicionar, editar, excluir e atualizar cada lembrete, com o visual no padrão do sistema",
    ],
  },
  {
    versao: "1.17.4",
    data: "2026-08-25",
    titulo: "Lembrete de agenda por WhatsApp",
    itens: [
      "Os lembretes de compromissos da Agenda (Space) voltaram a sair por WhatsApp para quem tem o número cadastrado — 60, 15 e 5 minutos antes e na hora. Antes dependiam de um botão que ficava na aba de WhatsApp removida, então não saíam para ninguém",
    ],
  },
  {
    versao: "1.17.3",
    data: "2026-08-25",
    titulo: "Teste vê só o módulo escolhido + botão Ajuda",
    itens: [
      "Correção importante: o acesso de teste estava liberando todos os módulos. Agora quem faz o teste enxerga apenas o módulo que escolheu na landing page (mais a Visão Geral) — nada além disso, no menu e nas telas",
      "Novo botão Ajuda no topo da tela: abre um campo para escrever uma dúvida, que chega por e-mail para o administrador. Pensado para quem está testando, mas disponível para todos",
    ],
  },
  {
    versao: "1.17.2",
    data: "2026-08-25",
    titulo: "Painel de testes para o suporte",
    itens: [
      "Nova aba Testes em Cadastros: lista quem está no teste de 7 dias, com os dias restantes (ou vencido), o módulo escolhido e um botão para falar direto no WhatsApp da pessoa e converter em assinatura",
    ],
  },
  {
    versao: "1.17.1",
    data: "2026-08-25",
    titulo: "Teste grátis direto na landing page",
    itens: [
      "Os botões 'Solicitar demonstração' do site passaram a abrir um cadastro rápido: e-mail, WhatsApp e o módulo que a pessoa quer testar. Confirma um código no WhatsApp e o acesso de 7 dias é criado na hora",
      "Quem prefere uma demonstração guiada com a equipe continua com o formulário completo, por um link dentro do próprio cadastro rápido",
    ],
  },
  {
    versao: "1.17.0",
    data: "2026-08-25",
    titulo: "Acesso de teste de 7 dias (base)",
    itens: [
      "Base do acesso de teste rápido: a pessoa informa e-mail e WhatsApp, confirma um código enviado no WhatsApp e ganha um acesso de 7 dias a um módulo escolhido, com as credenciais entregues no WhatsApp",
      "Ao fim dos 7 dias o login é bloqueado com um aviso, e o suporte é notificado para o contato de conversão",
    ],
  },
  {
    versao: "1.16.3",
    data: "2026-08-25",
    titulo: "Excluir usuário reflete na hora",
    itens: [
      "Excluir (ou editar/ativar) um usuário passou a atualizar a lista imediatamente. Antes o usuário era removido de verdade, mas continuava aparecendo na tela por até 1 minuto — a lista em cache não era limpa corretamente (a chave incluía a organização e a limpeza não batia)",
    ],
  },
  {
    versao: "1.16.2",
    data: "2026-08-25",
    titulo: "WhatsApp num lugar só",
    itens: [
      "Havia duas telas de WhatsApp que se sobrepunham e mostravam estados conflitantes. A aba WhatsApp dentro de Configurações foi removida — ela controlava uma conexão antiga e separada, e por isso pedia o QR Code mesmo com o número já conectado",
      "Agora a configuração de WhatsApp fica num lugar só: a tela WhatsApp do menu lateral, com a conexão da organização, o botão Desconectar (para trocar de número) e o seu número pessoal",
    ],
  },
  {
    versao: "1.16.1",
    data: "2026-08-25",
    titulo: "Conexão de WhatsApp volta a funcionar",
    itens: [
      "Criar a instância de WhatsApp da organização voltou a funcionar. O QR Code aparece para leitura, permitindo conectar o número",
      "Antes, 'Criar instância' falhava silenciosamente e o QR Code nunca aparecia (o gateway recusava a criação com 'Token already exists')",
    ],
  },
  {
    versao: "1.16.0",
    data: "2026-08-24",
    titulo: "Aprovar acesso direto na notificação",
    itens: [
      "A notificação de nova solicitação de acesso passou a ter os botões Aprovar e Reprovar. Aprovar cria o usuário na hora, com os dados que a pessoa informou no site e o perfil padrão",
      "As credenciais de acesso (e-mail e senha) são enviadas por WhatsApp para o número que a pessoa cadastrou, além do e-mail",
      "A senha inicial é 123@mudar e o sistema exige a troca no primeiro acesso",
    ],
  },
  {
    versao: "1.15.0",
    data: "2026-08-24",
    titulo: "Solicitação de demonstração pela landing page",
    itens: [
      "O formulário 'Solicitar demonstração' do site deixou de ser decorativo: antes exibia 'Recebemos sua solicitação' mas não entregava nada a ninguém. Agora ele registra o pedido de acesso de verdade e avisa os administradores",
      "Quem pede a demonstração informa os dados de cadastro e escolhe quais produtos do Orkiestri One quer testar",
      "O administrador recebe um e-mail com os dados e os produtos escolhidos, além da notificação no sistema, e aprova o acesso pela tela de Cadastros — que agora mostra os produtos de interesse de cada solicitação",
    ],
  },
  {
    versao: "1.14.6",
    data: "2026-08-20",
    titulo: "Calendário de licenciamento correto",
    itens: [
      "O vencimento calculado para veículos de São Paulo estava errado em todos os finais de placa. Agora segue o calendário oficial do Detran-SP: final 1 e 2 até 31 de julho, 3 e 4 até 31 de agosto, 5 e 6 até 30 de setembro, 7 e 8 até 31 de outubro, 9 até 30 de novembro e 0 até 31 de dezembro",
      "Caminhões e tratores passaram a ter calendário próprio, que vence mais tarde: um caminhão de final 1 vence em 30 de setembro, enquanto um carro do mesmo final vence em 31 de julho",
      "A data passou a ser o último dia do mês, como o calendário oficial determina. Antes o sistema antecipava para a sexta-feira quando o prazo caía em fim de semana",
    ],
  },
  {
    versao: "1.14.5",
    data: "2026-08-20",
    titulo: "Monitoramento volta a seguir o seu tema",
    itens: [
      "As telas de Monitoramento e do Executivo deixaram de ser sempre escuras e voltaram a seguir o tema claro ou escuro escolhido no topo da página",
      "A tela preta continua sendo o padrão do Modo NOC, que é onde ela faz sentido: painel de parede, olhado de longe e o dia inteiro",
      "As cores de disponibilidade (verde, vermelho e âmbar) ganharam um tom próprio para o tema claro, onde os tons calibrados para fundo preto ficavam lavados",
    ],
  },
  {
    versao: "1.14.4",
    data: "2026-08-19",
    titulo: "Farol: aviso de veículo sem OS e grade mais legível",
    itens: [
      "Duplo clique em veículo que não tem ordem de serviço aberta agora abre um aviso com o botão Cadastrar manutenção, que leva ao formulário já com o veículo preenchido. Antes o duplo clique parecia não fazer nada nessas linhas",
      "As linhas da grade passaram a ter altura uniforme. Com 12 colunas, o texto quebrando em várias linhas deixava as alturas entre 87 e 191 pixels, e ao rolar a tabela para o lado a tela virava um campo de retângulos vazios",
    ],
  },
  {
    versao: "1.14.3",
    data: "2026-08-19",
    titulo: "Colunas congeladas do Farol de volta",
    itens: [
      "No Farol da Frota, as colunas Status e Placa voltaram a ficar congeladas ao rolar a tabela para o lado. Elas rolavam junto, e ao chegar nas últimas colunas não dava mais para saber de qual veículo era a linha",
      "O duplo clique na linha abre o veículo na tela de Manutenções: na própria ordem de serviço quando existe uma, ou na lista já filtrada pelo veículo quando não existe",
    ],
  },
  {
    versao: "1.14.2",
    data: "2026-08-19",
    titulo: "Vencimento do CRLV e duplo clique no Farol",
    itens: [
      "O CRLV recém-cadastrado aparecia como Vencido. O documento do exercício 2026 comprova que o licenciamento de 2026 já foi feito, então ele vale até o prazo do exercício seguinte — o cálculo usava o prazo do próprio exercício, que já havia passado",
      "No Farol da Frota, o duplo clique na linha só abria alguma coisa quando o veículo tinha ordem de serviço. Nas demais linhas não acontecia nada: agora todas levam a algum lugar, e sem OS o duplo clique abre o cadastro do veículo, onde estão revisões, documentos e histórico",
    ],
  },
  {
    versao: "1.14.1",
    data: "2026-08-19",
    titulo: "Correções no documento por CRLV",
    itens: [
      "O vencimento calculado aparecia um dia antes do correto na tela. A data estava certa no banco; era a exibição que voltava um dia por causa do fuso",
      "O Status do documento passa a refletir a data: um documento com vencimento passado aparece como Vencido, e não mais como Vigente ao lado de uma data em vermelho. Cancelado continua sendo marcado à mão",
    ],
  },
  {
    versao: "1.14.0",
    data: "2026-08-19",
    titulo: "Documento de veículo pelo CRLV",
    itens: [
      "Novo botão Cadastrar Documento em Frotas › Documentações: escolha o PDF do CRLV e o sistema lê placa, RENAVAM, chassi, marca, modelo, ano, cor, combustível e proprietário, e amarra o documento ao veículo já cadastrado",
      "Se não houver veículo com aquela placa, o sistema avisa e leva direto para o cadastro de veículo, já aberto",
      "Escolhido São Paulo como estado de registro, o vencimento do licenciamento é calculado sozinho pelo final da placa, no último dia útil do mês; nos demais estados o campo fica em branco para preenchimento",
      "O que estiver em branco no cadastro do veículo é completado pelo CRLV: RENAVAM, chassi, marca, modelo, cor e ano. O que já estava preenchido não é sobrescrito",
      "O CRLV guardado fica em área restrita, fora do diretório público, por trazer CPF/CNPJ do proprietário",
      "Corrigido: anexo de documento baixava como arquivo genérico em vez de PDF",
    ],
  },
  {
    versao: "1.13.0",
    data: "2026-08-18",
    titulo: "Integração do Outlook configurável por tela",
    itens: [
      "As credenciais da integração com o Microsoft 365 passam a ser preenchidas por uma tela de administrador, em Configurações › Integrações — sem precisar mexer em arquivo de servidor. Cada ambiente e cada organização pode ter a sua",
      "A tela mostra qual configuração está em uso e o endereço de retorno exato para registrar no painel da Microsoft",
    ],
  },
  {
    versao: "1.12.1",
    data: "2026-08-18",
    titulo: "Agenda conectada ao Outlook",
    itens: [
      "Você pode conectar sua conta Microsoft 365 em Configurações › Integrações. Os compromissos do seu Outlook passam a aparecer na Agenda, em azul, e a contar na sua disponibilidade — quando alguém procura um horário livre para você, o que está ocupado no Outlook também é considerado",
      "Os compromissos que você criar na Agenda podem ser enviados automaticamente para o seu Outlook, se você deixar a opção ligada",
      "Alteração e cancelamento feitos no Outlook se refletem na Agenda, e o que você muda aqui volta para o Outlook",
      "Cada pessoa conecta apenas a própria conta, e o assunto das reuniões de outras pessoas não é exposto na visão de disponibilidade da equipe",
    ],
  },
  {
    versao: "1.11.10",
    data: "2026-08-17",
    titulo: "O tempo real do monitoramento volta a funcionar",
    itens: [
      "As telas de Monitoramento voltaram a atualizar sozinhas. A conexão em tempo real estava sendo recusada desde que o acesso passou a usar cookie seguro: o navegador não enviava a credencial no momento de abrir a conexão, e as telas só mudavam ao recarregar a página",
      "O Modo NOC deixa de exibir o aviso permanente de conexão perdida",
    ],
  },
  {
    versao: "1.11.7",
    data: "2026-08-17",
    titulo: "Disponibilidade medida contra a meta",
    itens: [
      "No Dashboard Executivo, a disponibilidade por categoria passou a mostrar a distância até a meta, em pontos, ao lado do percentual. No gráfico de colunas anterior, quatro categorias entre 94% e 99% saíam praticamente do mesmo tamanho e os rótulos batiam na linha da meta",
      "O centro do gráfico de rosca passou a exibir quanto da frota está no ar agora — o espaço estava vazio",
      "O SLA médio ganhou destaque entre os indicadores do topo: os cinco tinham o mesmo peso, e a resposta principal da tela competia com \"sem dados: 0\"",
    ],
  },
  {
    versao: "1.11.6",
    data: "2026-08-17",
    titulo: "Monitoramento: o alarme ganhou hierarquia",
    itens: [
      "Na tela de Monitoramento, o que está fora do ar passou a ser separado por urgência: o que caiu nas últimas duas horas aparece em destaque, o que caiu no dia aparece em lista simples, e o que está sem responder há mais de um dia fica recolhido em uma linha, com a contagem e o mais antigo. Antes os 57 equipamentos fora do ar recebiam o mesmo destaque, e a maioria está parada há meses",
      "O amarelo de atenção deixou de se confundir com o laranja da marca — no Dashboard Executivo, categorias com disponibilidade diferente apareciam todas da mesma cor",
      "O gráfico dos dez equipamentos com maior latência passou a usar uma cor só: ele já é o ranking dos piores, e colorir cada barra pelo mesmo critério deixava as dez iguais",
      "O Modo NOC passou a ocupar a tela inteira, sem o menu lateral",
      "Corrigido: o rótulo da meta aparecia cortado na borda do gráfico de disponibilidade",
    ],
  },
  {
    versao: "1.11.5",
    data: "2026-08-17",
    titulo: "Monitoramento redesenhado",
    itens: [
      "A lista de equipamentos saudáveis ficou quatro vezes mais compacta e passou a ser agrupada por tipo, com cada grupo podendo ser recolhido. Antes cada equipamento no ar ocupava um cartão repetindo endereço, tipo e a palavra \"Online\" — quatrocentas vezes",
      "No Modo NOC: botão para voltar ao modo padrão, que antes não existia, e botão de tela cheia (também pela tecla F). Equipamentos em alarme passaram a aparecer no topo do telão, antes das listas por categoria",
      "No Dashboard Executivo, a meta virou uma linha desenhada no gráfico de disponibilidade — antes ela só aparecia ao passar o mouse, e não dava para ver o quanto cada categoria estava longe do alvo",
      "Ainda no Executivo, os equipamentos que não responderam nenhuma vez no período saíram do ranking de indisponibilidade e viraram uma lista própria. Eles empatavam em 100% e ocupavam as dez posições, escondendo os equipamentos que oscilam",
      "As cores de estado do módulo passaram a vir do tema do sistema, com tratamento próprio para o modo escuro",
      "Corrigido: o Modo NOC exibia o nome de outra instalação no cabeçalho, independentemente de onde estivesse instalado",
    ],
  },
  {
    versao: "1.11.4",
    data: "2026-08-17",
    titulo: "Tempo de queda para todos os equipamentos",
    itens: [
      "Na tela de Monitoramento, o tempo de queda passou a aparecer em todos os equipamentos fora do ar. Na 1.11.3 ele só aparecia nos que caíram recentemente — dos 54 offline, 44 mostravam apenas \"Offline\", sem dizer há quanto tempo, justamente os que estavam caídos há mais tempo",
      "O resumo dos equipamentos saudáveis passa a agrupar por categoria quando a unidade não está cadastrada. Como nenhum equipamento tem unidade preenchida, o resumo inteiro se resumia a um rótulo \"Sem unidade\"",
    ],
  },
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
