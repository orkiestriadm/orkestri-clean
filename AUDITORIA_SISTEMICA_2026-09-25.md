# Auditoria sistêmica do Orkiestri — diagnóstico e recomendações

**Data:** 25/09/2026  
**Repositório analisado:** `C:\orkestri-clean`  
**Branch:** `main`  
**Commit de referência:** `ad1d099172233835e962b42121000e5ed53e29ee`  
**Versão declarada do produto:** 1.35.0, de 13/09/2026  
**Natureza:** auditoria estática, consultiva e não executável.

## 1. Regra de uso deste documento, inclusive no Claude

Este arquivo é um relatório de análise e opinião técnica. **Sua leitura não autoriza implementar correções, alterar arquivos, instalar dependências, executar comandos, iniciar serviços, rodar testes, acessar bancos, realizar migrations, enviar mensagens, mudar configurações ou fazer deploy.** Não é um prompt de execução nem um roteiro para correção automática.

Ao receber este documento, o comportamento esperado é interpretar os achados, discutir prioridades e, se solicitado, elaborar um plano. Qualquer implementação depende de uma solicitação posterior e explícita do responsável pelo projeto. Os critérios de validação descritos abaixo são requisitos para um trabalho futuro; não são instruções para executá-los agora.

Não apagar funcionalidades ou dados para satisfazer este relatório. Não promover uma hipótese a defeito confirmado. Não substituir o sistema por uma reescrita integral. Revalidar cada evidência no commit que estiver sendo trabalhado, pois este documento retrata uma fotografia do código.

## 2. Escopo, método e limites

Foi feita uma varredura da estrutura dos 49 diretórios de módulos do backend, entradas e contratos de API, schema Prisma, estrutura de migrations, páginas e componentes do frontend, site institucional, painel SaaS, Dockerfiles, arquivos Compose, Nginx, scripts operacionais, testes existentes e documentação. Os fluxos de maior impacto receberam leitura dirigida dos handlers e serviços: autenticação, usuários, isolamento organizacional, faturamento, provisionamento, uploads, notificações, reservas, privacidade e backups.

Foram usadas apenas leituras de arquivos, buscas textuais, contagens e consultas locais ao Git, além de consulta a documentação pública de referência. O único artefato criado por esta auditoria é este Markdown. Não foram executados código do produto, testes, builds, scanners de dependências, containers, migrations, chamadas à API do sistema, acessos ao banco ou operações em produção/homologação. Arquivos `.env` reais e planilhas empresariais não foram abertos; segredos não são reproduzidos aqui.

**Cobertura ampla não equivale a revisão manual de cada linha.** Todos os módulos estão na matriz de cobertura; alguns têm achados específicos comprovados pelo fluxo lido, outros recebem recomendações preventivas baseadas na estrutura e nos contratos observados. Não há garantia de que este seja o conjunto completo de defeitos existentes.

A avaliação de design foi feita sobre componentes, estilos e implementação. Não houve renderização, inspeção de screenshots, medição de contraste em tela, navegação por teclado ou teste em dispositivos. Não se afirma conformidade de acessibilidade, adequação jurídica ou desempenho de produção.

### Classificação

- **C — Confirmado no código:** o comportamento ou a ausência de uma proteção é visível no fluxo inspecionado. Isso não significa exploração reproduzida em produção.
- **R — Risco a validar:** há evidências relevantes, mas o impacto depende de configuração, concorrência, volume ou caminhos não executados.
- **M — Melhoria proposta:** opinião de engenharia/produto; não representa necessariamente um defeito.
- **P0 — Crítica:** fronteira de autenticação ou controle da infraestrutura; avaliação prioritária.
- **P1 — Alta:** isolamento entre clientes, perda/integridade de dados, funções essenciais e recuperação.
- **P2 — Média:** manutenção, desempenho, consistência, acessibilidade e robustez.
- **P3 — Evolutiva:** organização e aperfeiçoamentos sem urgência operacional demonstrada.

As prioridades são qualitativas; não foram calculados CVSS, probabilidade estatística ou exposição real dos ambientes.

## 3. Visão do sistema e opinião geral

O Orkiestri é um monólito modular de gestão empresarial com quatro aplicações principais: API NestJS, frontend do produto em Next.js 14, site institucional em Next.js 15 e painel SaaS em Express. Compartilha autenticação, organizações, permissões, dados e automações entre domínios de negócio. Há tanto separação lógica por organização quanto mecanismos de provisionamento de instâncias em `saas/`; a relação entre esses dois modelos merece documentação operacional explícita.

Inventário local observado:

| Indicador | Quantidade |
|---|---:|
| Diretórios de módulos em `backend/src/modules` | 49 |
| Arquivos em `backend/src` | 285 |
| Arquivos em `frontend/src` | 251 |
| Páginas `page.tsx` do frontend do produto | 118 |
| Models no schema Prisma | 195 |
| Diretórios de migrations | 101 |
| Arquivos `.spec.ts` no backend | 56 |

Essas contagens não representam módulos comerciais, endpoints, testes aprovados nem migrations efetivamente aplicadas. Não incluem as páginas do site no total de 118.

**Opinião central:** a plataforma tem profundidade funcional e investimento real em padrões, mas as proteções não estão uniformemente aplicadas. Existem correções sólidas em alguns caminhos e rotas vizinhas que ainda usam padrões anteriores. A prioridade deve ser consolidar segurança e integridade antes de ampliar o catálogo de funcionalidades.

O catálogo a seguir reúne **70 itens identificados**, entre falhas confirmadas no código, riscos pendentes de validação e propostas de melhoria: 25 de segurança, 9 de dados/regras, 6 de API, 11 de infraestrutura, 9 de engenharia e 10 de experiência/design. Os itens se relacionam entre si; não representam 70 vulnerabilidades independentes. As duas prioridades P0 são a ausência de exigência efetiva de 2FA e a montagem de comandos shell no painel SaaS.

### O que já está bem encaminhado e deve ser preservado

- Cookies HttpOnly e proteção CSRF, validação global e headers de segurança.
- Helpers de escopo organizacional que recusam contexto ausente, em `backend/src/common/escopo-organizacao.ts`.
- Downloads autenticados e armazenamento separado de documentos restritos.
- People, Compliance e Strategy com separação mais clara entre apresentação, aplicação, domínio e infraestrutura.
- Testes de isolamento do People e testes de regras de prazo/importação em módulos novos.
- Outbox de notificações com tentativas, estados e retenção, em vez de depender apenas de envio imediato.
- Tokens de design, componentes compartilhados e preocupação explícita com temas e movimento reduzido.
- Script mais recente de deploy baseado em referência Git, com verificações anteriores à publicação.
- Trilha de decisões, histórico de versões e documentação de problemas reais.

Não se recomenda remover esses mecanismos ao corrigir as inconsistências identificadas.

## 4. Achados de segurança, autenticação e isolamento

### SEG-01 — Sessão completa emitida sem exigir segundo fator

**P0 · C.** `backend/src/modules/auth/auth.service.ts`, método `login`, emite access token e refresh token após verificar senha. `auth.controller.ts` grava o cookie de sessão. Não há consulta ao estado de 2FA nesse fluxo. `twofa.module.ts` possui validação TOTP, mas ela exige uma sessão JWT já emitida e apenas devolve `{ valido: true }`. A estratégia JWT não exige comprovação do segundo fator.

**Impacto:** habilitar 2FA no perfil não torna o segundo fator obrigatório para acessar a API com senha válida.

**Melhoria:** separar desafio de autenticação de sessão efetiva, exigir TOTP/backup quando habilitado e emitir sessão completa somente depois. Setup não deve substituir secret ativo sem reautenticação; adicionar controle de tentativas e proteção do secret armazenado.

**Critério futuro:** conta com 2FA e senha correta continua sem acesso aos recursos até concluir o desafio; repetição, expiração e uso concorrente de códigos de recuperação são recusados.

### SEG-02 — Restrição de primeiro acesso executada antes da autenticação

**P1 · C, por composição do fluxo.** `backend/src/main.ts` registra `FirstAccessGuard` globalmente; `auth/first-access.guard.ts` permite a requisição quando `req.user` não existe. O `AuthGuard('jwt')` é aplicado em controllers/handlers, portanto depois do guard global. Não foi encontrada outra autenticação global anterior que preencha esse usuário.

**Impacto:** a obrigação de trocar a senha temporária pode não proteger a API, embora a interface redirecione o usuário.

**Melhoria:** garantir ordem autenticação → primeiro acesso → autorização, preservando exceções explícitas para troca de senha e logout. Fundamentação: [ciclo de requisição do NestJS](https://docs.nestjs.com/faq/request-lifecycle).

**Critério futuro:** sessão de primeiro acesso recebe recusa em uma rota protegida comum, independentemente do frontend.

### SEG-03 — Mutação de usuários sem verificar organização antes da escrita

**P1 · C.** Em `backend/src/modules/users/users.module.ts`, `update` procura o usuário apenas por `id`, altera usuário/perfil e só depois chama `findOne`, que verifica o tenant. `updateModulos` também altera perfil por `userId` sem receber contexto da organização. Em `auth/auth.service.ts`, `unblockUser` exige master, mas atualiza o alvo apenas pelo ID.

**Impacto:** um operador autorizado no próprio cliente pode modificar registros de outro cliente se conhecer o ID. No `update`, um erro posterior de leitura não desfaz as escritas já realizadas.

**Melhoria:** validar posse antes de qualquer alteração, incluindo relações como setor, e usar transação quando usuário e perfil precisam mudar juntos.

**Critério futuro:** IDs externos resultam em recusa sem mudança em nenhuma tabela; resposta de erro não pode esconder uma alteração concluída.

### SEG-04 — Avaliação CSAT não verifica dono nem organização do chamado

**P1 · C.** `backend/src/modules/csat/csat.module.ts`, `avaliar`, exige `chamados:ver`, consulta por `chamadoId` e grava a nota sem contexto do solicitante. Também não exige chamado resolvido, ao contrário do fluxo do portal.

**Melhoria:** vincular avaliação à organização e ao avaliador legitimado, definir quando pode avaliar/editar e aceitar somente nota inteira na escala. Separar leitura de indicadores da permissão de avaliar.

**Critério futuro:** leitor de chamados não altera avaliação arbitrária; usuário de outro tenant nunca avalia o registro; notas fracionárias são recusadas com erro claro.

### SEG-05 — Setores podem ser alterados fora do tenant

**P1 · C.** `backend/src/modules/setores/setores.module.ts`, `update` e `remove`, verificam capacidade administrativa, mas escrevem pelo ID sem escopo organizacional. A criação recebe `parentId` e `responsavelId` sem verificação local de pertencimento. O impedimento de ciclo só cobre pai igual ao próprio setor.

**Melhoria:** escopo obrigatório no alvo e nas relações, detecção de ciclos indiretos e transação ao mover filhos/desativar setor.

**Critério futuro:** hierarquia não aceita pai de outro cliente, nem ciclo A → B → A; falha intermediária não deixa filhos parcialmente movidos.

### SEG-06 — Configurações de lembretes não isolam alterações por cliente

**P1 · C.** `backend/src/modules/notifications/alert-config.module.ts` recebe organização na listagem/criação, mas `update` e `remove` recebem apenas ID. O controller exige master, que é um papel da organização, não necessariamente administrador global.

**Melhoria:** levar contexto organizacional até o serviço e resolver o registro dentro dele antes de editar/excluir.

**Critério futuro:** master de A não altera ou remove configuração de B.

### SEG-07 — Relações de negócio aceitam IDs de outros clientes

**P1 · C.** Em `apontamentos/apontamentos.module.ts`, a criação resolve chamado apenas por ID e cria o apontamento na organização do solicitante. Em `faturas/faturas.module.ts`, `create` resolve cliente por ID e recebe contrato sem validar o tenant. Em `frota/reservas/reservas.service.ts`, `create` recebe veículo/projeto sem verificar pertencimento.

**Impacto:** registros podem unir entidades de organizações distintas; filtros na listagem do registro principal não corrigem essas associações.

**Melhoria:** validar todos os IDs relacionados na organização, além do alvo principal. Avaliar restrições compostas no banco onde forem adequadas.

**Critério futuro:** relações cruzadas são recusadas para criação, edição, importação e operações em lote.

### SEG-08 — Faturas usam permissão de leitura para operações de escrita

**P1 · C.** `backend/src/modules/faturas/faturas.module.ts` exige `crm:ver` para criar, editar, pagar, importar, gerar lote e excluir faturas.

**Melhoria:** definir permissões específicas de faturamento, inclusive baixa e estorno, e migrar os perfis de forma explícita. Revisar outras mutações autorizadas por permissões terminadas em `:ver`; não presumir que todas sejam defeitos sem avaliar o produto.

**Critério futuro:** perfil de consulta não altera situação financeira nem remove histórico.

### SEG-09 — Política de senhas é global na prática e não governa todos os fluxos

**P1 · C.** `auth/twofa.module.ts`, `PasswordPolicyController`, lê e escreve em `DEFAULT_ORG`, inclusive quando outro master chama a rota. `AuthService.validatePasswordStrength` usa regras fixas; `users.module.ts/changeMyPassword` usa mínimo de seis caracteres. Não foi localizado consumo de `pwPolicy_` fora do controller da política.

**Impacto:** a tela pode sugerir uma política efetiva que não é aplicada, e administradores de clientes diferentes alcançam a mesma configuração.

**Melhoria:** único serviço de política por organização, usado em cadastro, reset, troca e administração; separar requisitos reais de opções ainda não implementadas, como histórico/expiração.

**Critério futuro:** a mesma senha recebe a mesma decisão em todos os fluxos do tenant; mudança da política de A não modifica B.

### SEG-10 — Funções globais de backup e logs acessíveis a master de organização

**P1 · C.** `backend/src/modules/sistema/sistema.module.ts` mantém configuração em `DEFAULT_ORG` e opera no banco/arquivos da instância. Diversos handlers aceitam `isMaster || isSuperAdmin`, incluindo configuração de caminhos, backups e limpeza de logs.

**Melhoria:** separar administração da empresa de administração da infraestrutura. Caminhos de escrita/limpeza devem ser restritos a raízes controladas pelo servidor, não texto arbitrário fornecido por um tenant.

**Critério futuro:** master de cliente não altera a política global de backups, não dispara tarefas globais e não escolhe diretórios de manutenção da instância.

### SEG-11 — Painel SaaS constrói comandos shell com dados recebidos

**P0 · C quanto à construção insegura; alcance depende da exposição do painel.** `saas/sa-panel/server.js`, função `execScript`, interpola argumentos em uma string executada por `exec`, escapando apenas aspas duplas. O provisionamento passa campos como nome e e-mail para essa função. Aspas duplas não neutralizam todas as expansões do shell.

**Impacto:** dados administrativos podem ser interpretados como comandos. O painel tem ferramentas Docker e acesso ao socket do daemon, elevando a consequência potencial.

**Melhoria:** execução sem shell com argumentos separados, validação de tipos/tamanhos e privilégios mínimos. Não incluir payloads de exploração em correções ou logs. Fundamentação: [processos filhos no Node.js](https://nodejs.org/api/child_process.html).

**Critério futuro:** qualquer conteúdo de campo é tratado literalmente; provisionamento não depende de montagem de linha de comando por concatenação.

### SEG-12 — Painel SaaS serve o diretório do servidor como conteúdo público

**P1 · C.** `saas/sa-panel/server.js` usa `express.static(__dirname)` antes da autenticação. O Dockerfile copia o projeto para esse mesmo diretório.

**Impacto:** arquivos não destinados ao navegador, como código do servidor e manifestos, ficam incluídos na raiz estática. Isso não prova exposição de variáveis de ambiente, mas amplia desnecessariamente a superfície.

**Melhoria:** diretório público dedicado contendo somente recursos necessários ao painel.

**Critério futuro:** código backend, manifestos e arquivos internos não são servidos por HTTP; o painel continua funcionando.

### SEG-13 — Autenticação e armazenamento do painel SaaS precisam de endurecimento

**P1 · C/R.** `server.js` tem token padrão de fallback e CORS aberto quando a lista de origens está vazia. `index.html` guarda o token SA em `localStorage` e interpola dados como `t.nome` em `innerHTML`, sem escape no trecho inspecionado. O Dockerfile não define usuário não privilegiado.

**Atenuante importante:** o Compose base exige `SA_TOKEN` e vincula a porta 8080 ao loopback; não é correto afirmar que a instalação base publica essa porta para toda a rede. Há, entretanto, proxy HTTPS público em `/sa/`.

**Melhoria:** configuração obrigatória também na aplicação, autenticação individual com sessão curta e auditoria, renderização segura de texto, proteção de tentativas e isolamento do serviço. O socket Docker montado como `:ro` não deve ser tratado como API de operações somente de leitura. Ver [segurança do Docker Engine](https://docs.docker.com/engine/security/).

**Critério futuro:** ausência de configuração impede inicialização; nomes não são interpretados como HTML; ações têm identidade individual e trilha.

### SEG-14 — Conteúdo de conhecimento é convertido em HTML sem sanitização

**P1 · C.** `frontend/src/app/dashboard/conhecimento/page.tsx` e `frontend/src/app/kb/page.tsx` usam `renderMd` baseado em substituições de texto e `dangerouslySetInnerHTML`. Não há escape de HTML original nesse conversor. O backend grava `conteudo` diretamente. A CSP de produção permite scripts inline.

**Impacto:** conteúdo gravado por quem pode editar artigos pode virar HTML ativo no navegador de leitores, inclusive no portal público.

**Melhoria:** renderizador de Markdown com política explícita de HTML, sanitização e validação de URLs; preservar conteúdo legítimo e não depender apenas de CSP.

**Critério futuro:** HTML e URLs perigosos permanecem inertes; artigos existentes continuam legíveis. Não classificar JSON-LD do site como XSS apenas por usar a mesma API React: os dados de entrada são diferentes.

### SEG-15 — WebSocket verifica assinatura, mas não reproduz controles da API

**P1 · C.** `monitoramento/monitoramento.gateway.ts` verifica JWT e entra na sala de `organizationId`, sem consultar usuário ativo, blacklist, billing ou permissão de monitoramento. Aceita token pela query e configura origem `*`. A expiração só é verificada no handshake.

**Melhoria:** autorização de conexão e dos eventos equivalente à API; origem controlada; revogação/expiração de sessões abertas; remover token de URL; esclarecer comportamento da impersonação, cujo token usa `targetOrgId`.

**Critério futuro:** usuário sem acesso ao monitoramento não recebe eventos; bloqueio/logout/expiração interrompem acesso dentro da política definida.

### SEG-16 — Webhook de pagamento recebe assinatura, mas não a valida

**P1 · C.** `billing/billing.module.ts`, `BillingWebhookController` captura `x-signature`; `processWebhook` recebe o parâmetro, porém não o utiliza. O código consulta o Mercado Pago antes de processar estados, uma proteção relevante que deve ser mantida.

**Impacto:** chamadas não autenticadas podem acionar processamento e consultas; não se conclui que um pagamento arbitrário possa ser inventado, pois há consulta ao provedor.

**Melhoria:** autenticar notificações conforme contrato do provedor, persistir recepção, deduplicar e retentar processamento. Hoje erros podem ser registrados e ainda resultar em confirmação de recebimento.

**Critério futuro:** assinatura inválida é recusada; evento repetido não duplica efeitos; falha temporária não perde reconciliação.

### SEG-17 — Proteção de webhook de saída termina antes da conexão real

**P1 · R.** `automacoes/webhooks.module.ts` valida DNS/IP na configuração, mas `dispatch` usa `fetch(hook.url)` sem revalidação do destino conectado nem política explícita de redirects. A resposta é inteiramente lida antes de ser truncada para 500 caracteres; o timeout é removido antes da leitura do corpo.

**Melhoria:** proteção contra resolução alterada e redirects para destinos internos, limites de resposta e prazo total de leitura; política de saída da infraestrutura. Evitar retries de efeitos sem identificador estável de entrega.

**Critério futuro:** cada conexão continua respeitando a política de destino e tamanho; resposta lenta ou grande não ocupa recursos indefinidamente. Não houve tentativa real de SSRF.

### SEG-18 — Redis indisponível desativa controles de segurança silenciosamente

**P1 · C.** `cache/cache.service.ts` retorna `0` para contador de tentativas indisponível e `null` para leitura de cache. A autenticação usa os mesmos métodos para rate limit e blacklist.

**Impacto:** falha de cache de negócio e falha de controle de segurança recebem o mesmo tratamento. Logout pode não revogar um token quando Redis falha; limitadores deixam de contar.

**Melhoria:** separar cache opcional de estado de segurança, definir comportamento de indisponibilidade e emitir sinais operacionais. Tornar incremento/expiração atômicos; substituir `KEYS` em invalidações amplas por estratégia incremental ou versionada.

**Critério futuro:** falhas de Redis produzem comportamento documentado e observável, sem aparentar revogação bem-sucedida quando ela não ocorreu.

### SEG-19 — Troca de senha, reset e tipos de token não têm fronteira uniforme

**P1 · C/R.** `resetPasswordWithToken`, `changeFirstPassword` e handlers de troca em `users.module.ts` não invalidam todas as sessões existentes. Reset por e-mail faz leitura e remoção separadas do marcador de uso; o token OTP do tipo `reset` não passa pelo mesmo controle de uso único. `JwtStrategy` não exige um tipo exclusivo de token de acesso, enquanto reset e acesso compartilham `JWT_SECRET`.

**Melhoria:** sessão versionada/revogável, separação verificável de finalidade dos tokens, consumo atômico e política clara para refresh token. O login emite refresh token, mas não foi encontrado um fluxo de renovação correspondente no controller lido.

**Critério futuro:** token de reset nunca autentica uma rota de negócio; dois resets concorrentes não consomem o mesmo direito; troca de senha revoga sessões conforme política definida.

### SEG-20 — Token HttpOnly também retorna no corpo acessível ao JavaScript

**P2 · C.** O login devolve `accessToken`; `frontend/src/lib/store.ts` e a página de login o mantêm no estado JavaScript.

**Melhoria:** distinguir login do navegador de autenticação de clientes de API e reduzir exposição desnecessária da credencial no navegador. Não afirmar que HttpOnly elimina XSS: scripts maliciosos ainda podem fazer ações usando a sessão.

**Critério futuro:** frontend não precisa copiar JWT para estado/localStorage nem recebê-lo em JSON para usar a aplicação.

### SEG-21 — IP de rate limit depende de cabeçalho fornecido pela cadeia de proxies

**P1 · R.** `auth.controller.ts` toma o primeiro valor de `X-Forwarded-For`. O Nginx usa `$proxy_add_x_forwarded_for`, preservando entradas prévias. A origem de cada elemento não é validada no handler.

**Melhoria:** fronteira explícita de proxies confiáveis e endereço canônico; combinar controles por IP, conta e fluxo. Os limitadores do Nginx existem e reduzem parte do risco, mas não tornam todos os contadores da aplicação confiáveis.

**Critério futuro:** um cabeçalho arbitrário não troca a identidade usada para o limitador; usuários legítimos atrás de NAT não ficam bloqueados indevidamente.

### SEG-22 — Identidade global por e-mail e login ambíguo entre organizações

**P1 · C/R; potencial crítico a validar.** `AuthService.login` usa `findFirst({ email })`, mas `User` tem unicidade por `[organizationId, email]`. `checkGlobalSuperAdmin` concede privilégio por igualdade com um e-mail configurado, além da tabela `superAdmin`. Há criação de usuários por organização.

**Impacto:** duplicidade permitida pelo banco não é resolvida pelo login. Identidade global baseada somente em endereço editável cria risco de escalada; não foi reproduzido um caminho completo de exploração.

**Melhoria:** definir identidade de login global versus vínculo organizacional, reservar contas privilegiadas e usar concessão explícita por identidade imutável. Revisar recuperação de senha pelo mesmo critério. Revalidar status de Super Admin durante impersonação, inclusive após revogação.

**Critério futuro:** contas homônimas são resolvidas deterministicamente; escrever o e-mail administrativo em um usuário comum não concede privilégio global.

### SEG-23 — Geração de credenciais temporárias e OTP usa aleatoriedade inadequada

**P1 · C.** `auth/auth.service.ts` usa `Math.random()` na senha temporária e no código de trial. O fluxo também oferece senha temporária padronizada na aprovação rápida.

**Melhoria:** gerador criptográfico, validade curta, uso único e convite de definição de senha. Remover dependência de senha compartilhada, especialmente enquanto SEG-02 existir.

**Critério futuro:** convites/códigos têm limite de tentativas, expiração e consumo único; uma senha conhecida não concede acesso útil.

### SEG-24 — Scheduler de SLA seleciona destinatários de todas as organizações

**P1 · C.** `notifications/alert.scheduler.ts`, em `runSlaCheck`, busca masters sem `organizationId` e cria notificações com número e título do chamado. No scheduler de agenda, configurações ativas de todas as organizações são combinadas com todos os eventos sem filtragem por organização no laço de configuração.

O defeito de delegate descrito em DAD-09 pode interromper o fluxo de escalonamento antes dessa entrega no estado atual. Isso não torna a seleção segura: corrigir somente o delegate pode tornar alcançável a entrega cruzada. Os dois pontos precisam ser avaliados em conjunto.

**Melhoria:** separar configurações e destinatários por organização em cada evento; usar o dispatcher comum. Consultar muitos tenants em um job global é legítimo, mas a entrega precisa respeitar cada tenant.

**Critério futuro:** chamado de A só notifica destinatários autorizados em A; a configuração de lembrete de B não muda os avisos de A.

### SEG-25 — Integração SSH do OSA aceita destino sem identidade de host verificada

**P1 · R.** `osa/osa.module.ts`, `consultarN1` e `sshExec`, recebem host/porta e conectam por senha sem `hostVerifier` no trecho inspecionado. A senha do MySQL entra na linha do processo remoto. O comando SQL é fixo e os argumentos têm escape; não foi identificada injeção SQL nesse trecho.

**Melhoria:** política de destinos por organização, identificação da chave do servidor, credencial de privilégio mínimo e método que não exponha senha em argumentos de processo.

**Critério futuro:** servidor inesperado é recusado; permissão de consulta não permite sondar qualquer destino da rede; credenciais não aparecem em processos/logs.

## 5. Integridade de dados, regras de negócio e APIs

### DAD-01 — Excluir usuário remove histórico operacional de outros domínios

**P1 · C.** `users/users.module.ts`, `remove`, apaga aprovações, itens de orçamento, artigos, chamados solicitados, tarefas e projetos criados pelo usuário, entre outros registros. A transação protege atomicidade, mas não protege o valor histórico do negócio.

**Melhoria:** separar desativação de acesso, transferência de responsabilidade, anonimização e expurgo. Preservar registros compartilhados e decisões administrativas; definir retenção por domínio com o responsável pelo produto.

**Critério futuro:** desligar uma pessoa não faz desaparecer projetos, chamados e aprovações da organização; o impacto é apresentado antes de qualquer expurgo autorizado.

### DAD-02 — Anonimização de People pode declarar remoção sem apagar o arquivo

**P1 · C.** `people/infrastructure/document-storage.service.ts/remover` captura erros de exclusão e apenas registra aviso. `people/application/privacy.service.ts/anonimizar` incrementa a contagem após essa chamada e depois exclui as referências no banco. Uma falha física pode deixar arquivo órfão.

Também há divergência entre a prévia, que lista acesso ao sistema, e a execução: `valoresAnonimos` remove o vínculo `userId` do colaborador, mas o método não desativa ou anonimiza a conta `User` anteriormente vinculada. O log de auditoria inclui o nome anterior. Isso requer decisão explícita de minimização/retenção, não conclusão jurídica automática.

**Melhoria:** estados de eliminação verificáveis, retry, reconciliação de arquivos, escopo de identidade completo e evidência mínima de auditoria.

**Critério futuro:** erro de armazenamento não vira contagem de sucesso; a interface explica quais dados e acessos efetivamente permanecem.

### DAD-03 — Valores monetários usam representações inconsistentes

**P1 · C quanto ao modelo; divergências de cálculo não medidas.** `backend/prisma/schema.prisma` usa `Float` em orçamento, faturas, contratos e custos de frota, enquanto People usa `Decimal` e indicação usa centavos inteiros.

**Melhoria:** contrato monetário consistente, escala e arredondamento por operação, moeda explícita quando necessária, serialização previsível. Migração precisa reconciliar saldos existentes; não é simples substituição textual de tipo.

**Critério futuro:** somas, parcelas, importações e exportações reconciliam com precisão e regras documentadas.

### DAD-04 — Reserva de veículo tem janela de concorrência

**P1 · R.** `frota/reservas/reservas.service.ts` verifica conflito e depois cria/edita em operações separadas. O schema não declara mecanismo de exclusão de intervalos; não foi localizada proteção equivalente no fluxo lido. Status vem do corpo, e datas não passam por DTO concreto no controller.

**Melhoria:** garantir exclusividade no banco/controle transacional adequado, validar datas e definir transições permitidas. Uma transação simples com isolamento padrão não resolve automaticamente a corrida.

**Critério futuro:** duas reservas concorrentes para o mesmo veículo/período não são confirmadas; não é possível pular estados indevidamente.

### DAD-05 — Aprovação de workflow não é uma transição atômica

**P1 · R.** `workflows/workflows.module.ts` lê estado, cria aprovação e atualiza solicitação em passos separados, sem transação nesse módulo. Decisões concorrentes podem observar o mesmo estado pendente.

**Melhoria:** comparação de estado/versão, persistência atômica de decisão e histórico, idempotência e outbox dos efeitos posteriores.

**Critério futuro:** aprovação versus rejeição concorrentes produzem uma decisão válida, sem histórico contraditório ou notificações duplicadas.

### DAD-06 — Provisionamento e cobrança têm múltiplas escritas sem atomicidade global

**P1 · R.** `billing/billing.module.ts`, `cadastro-request/cadastro-request.module.ts` e `referral/referral.module.ts` possuem processos de múltiplas escritas e chamadas externas. Não há `$transaction` nesses módulos. Em `ReferralService.efetivar`, usuário e comissão são atualizados separadamente; nova efetivação grava comissão como pendente.

**Melhoria:** estados de processamento recuperáveis, unicidade/idempotência, transações locais e compensações para provedores externos. Preservar comissão já paga e distinguir intenção de renovar, concessão de acesso e pagamento efetivamente conciliado.

**Critério futuro:** retry não cria organização/usuário/comissão duplicados nem reabre comissão paga; falhas parciais podem ser retomadas com rastreabilidade.

### DAD-07 — Abertura de chamado pelo portal não acompanha o schema atual

**P1 · C.** `portal/portal.module.ts/createChamado` cria chamado sem `organizationId`, obrigatório no schema, e usa solicitante técnico fixo. Também calcula `numero` por maior valor + 1, apesar do campo ter autoincremento.

No mesmo controller, `getChamado` seleciona comentários com `conteudo` e `publico` e filtra por `publico`. O model `ChamadoComentario` define `texto` e `interno`. A divergência é escondida pelo acesso ao Prisma como `any` e pode impedir a leitura de detalhes, além da falha de criação.

**Melhoria:** derivar organização do cliente autenticado pelo token, definir identidade técnica por tenant e usar a estratégia de numeração oficial. Revisar prazo, rotação e revogação do token do portal.

**Critério futuro:** chamado nasce com organização correta e numeração segura sob concorrência, sem depender de registro técnico global implícito; detalhe do portal carrega comentários públicos e nunca mostra internos.

### DAD-08 — Cadastro de organizações usa identidade incompatível com a estratégia JWT

**P1 · C.** `cadastro-request/cadastro-request.module.ts` usa `req.user.sub` ao criar/aprovar/rejeitar. `auth/jwt.strategy.ts` devolve o identificador como `id`, não `sub`.

**Melhoria:** um tipo único de usuário autenticado e uso consistente nos serviços. Evitar `any` justamente nessa fronteira.

**Critério futuro:** toda solicitação e decisão tem autor válido; o fluxo não depende de campos ausentes que geram falha de FK ou autoria vazia.

### DAD-09 — Escalonamento de SLA tenta usar delegate inexistente

**P1 · C.** `notifications/alert.scheduler.ts/runSlaCheck` usa `(prisma as any).comentarioChamado.create`, enquanto o model é `ChamadoComentario`, cujo delegate esperado é `chamadoComentario`. Os campos `texto` e `interno` desse trecho correspondem ao model; a incompatibilidade aqui é o nome do delegate, diferentemente do fluxo do portal em DAD-07.

**Impacto:** após elevar prioridade, o registro do evento pode falhar e interromper parte da rotina. Um `.catch` encadeado não captura acesso síncrono a método de delegate inexistente antes de uma Promise ser criada.

**Melhoria:** cliente Prisma tipado, serviço de histórico compartilhado e transição consistente com a auditoria.

**Critério futuro:** escalonamento registra histórico e entrega avisos; nenhuma alteração de prioridade fica sem evidência da causa.

### API-01 — DTOs parcialmente decorativos

**P1 · C.** Há muitos campos `@Allow() any` em RBAC, financeiro, frota, contratos e faturas. Reservas usa `@Body() any`. `ValidationPipe` global com whitelist não valida semanticamente campos liberados com `Allow` nem corpos sem classe concreta.

**Melhoria:** DTOs por caso de uso, tipos reais, enums, limites numéricos/textuais, arrays aninhados e validação cruzada. Diferenciar limpeza de entrada de regras de negócio.

**Critério futuro:** tipos errados, campos excessivos, datas inválidas, valores negativos indevidos e IDs inconsistentes resultam em erros de cliente previsíveis, não falhas internas.

### API-02 — Escopo organizacional opcional ainda permite consultas sem filtro

**P1 · R.** Diversos helpers em `workflows`, `capacity`, `squads`, `chamado-templates`, `audit` e outros retornam `{}` quando organização falta. O helper central `organizacaoDe` já demonstra o comportamento mais seguro. `users/getRoles` lista papéis de todas as organizações sem filtro.

**Melhoria:** contexto obrigatório no acesso de tenant; caminhos globais separados, explícitos e restritos. Não aplicar filtro de tenant cegamente a catálogos realmente globais ou jobs administrativos.

**Critério futuro:** ausência de organização nunca amplia silenciosamente o resultado; endpoints de papéis não expõem cadastros de outros clientes.

### API-03 — Paginação, limites e agregação precisam ser uniformizados

**P2 · C/M.** Há listagens completas em reservas, CSAT e usuários. Strategy carrega carteira com teto de 5.000 em `estrategico/infrastructure/caso.repository.ts`; telas e indicadores consomem essa carteira. Isso é razoável para a origem pequena, mas pode truncar resultados conforme o produto crescer.

**Melhoria:** paginação de servidor, limites validados, total consistente, busca indexável e agregações adequadas ao banco. Exibir explicitamente qualquer truncamento; preservar a coerência das regras derivadas de prazo.

**Critério futuro:** totais não ignoram registros além de um teto silencioso; latência e memória têm orçamento definido por cenário.

### API-04 — Contratos e erros variam entre módulos

**P2 · C/M.** Rotas legadas retornam entidades/arrays diretamente; People usa envelopes em vários serviços; há APIs com e sem `v1`, além de erros genéricos como `throw new Error('Acesso negado')` em administração.

**Melhoria:** documentar contrato atual, padronizar erros com código estável e contexto seguro, publicar especificação de API e adotar versionamento incremental. Não alterar envelopes em massa sem compatibilidade do frontend.

**Critério futuro:** validação, recusa, inexistência e indisponibilidade são distinguíveis; consumidor não precisa interpretar mensagem textual para todo fluxo.

### API-05 — Exportações e importações exigem política transversal

**P2 · R/M.** Há planilhas e relatórios em financeiro, frota, orçamento e Strategy, com implementações locais e leitura de arquivos. A auditoria não validou cada fórmula/exportação.

**Melhoria:** limites de arquivo e linhas, preview, validação de vínculo, tratamento de fórmulas perigosas em exportações, chave de lote, resultado por linha e idempotência. Distinguir arquivo parcialmente aceito de importação atômica.

**Critério futuro:** reimportação não duplica obrigações/contas; linhas inválidas são identificadas; valores/datas exportados preservam o significado do dado.

### API-06 — Upload seguro por assinatura é uma defesa parcial

**P2 · C/M.** `common/arquivo-seguro.ts` valida algumas assinaturas, mas arquivos Office compartilham assinatura ZIP; texto e MP4 não são inspecionados pelo conteúdo. Isso é uma proteção útil e não deve ser confundida com verificação completa de segurança do arquivo.

**Melhoria:** limites por finalidade, validação estrutural quando necessária, quarentena/inspeção conforme exposição, download com disposição e MIME seguros, quota por tenant e limpeza de uploads órfãos. Corpo JSON global de 50 MB em `main.ts` merece segmentação por endpoint.

**Critério futuro:** arquivo rejeitado não deixa lixo; limites são aplicados antes de processamento caro; documento de tenant A não pode ser baixado por B.

## 6. Infraestrutura, recuperação e operação

### INF-01 — Backup principal não cobre os volumes de documentos seguros

**P1 · C.** `scripts/backup.sh` cobre banco e `orkestri_uploads_data`. O Compose monta também `people_docs_data`, `compliance_docs_data`, `project_docs_data`, `frota_docs_data` e `estrategico_docs_data`. `saas/backup-tenant.sh` cobre apenas banco.

**Melhoria:** inventário completo de dados persistentes, backup coerente de banco e arquivos, destino fora da máquina, proteção de acesso, checksum e política de retenção. O nome fixo do volume de uploads deve ser reconciliado com o nome de projeto Compose.

**Critério futuro:** restauração em ambiente vazio recupera documentos reais de todos os módulos e suas relações. Verificar existência do arquivo de backup não comprova restaurabilidade.

### INF-02 — Falhas de backup de arquivos podem terminar como sucesso

**P1 · C.** `scripts/backup.sh` ignora falha do arquivamento de uploads com `|| true` e termina com mensagem de sucesso. Promoções semanais/mensais são do banco, sem política equivalente explícita dos arquivos.

**Melhoria:** estado por componente, marcador de backup completo, alerta de execução parcial e retenção sincronizada entre banco/arquivos.

**Critério futuro:** backup sem anexos necessários é classificado como incompleto e não é anunciado como recuperação integral disponível.

### INF-03 — Backups gerados pela API não têm persistência declarada no Compose base

**P1 · C/R.** `SistemaService` grava por padrão em `/app/backup`; não há montagem desse diretório no Compose base inspecionado. Um ambiente pode ter configuração externa diferente, não verificada.

**Melhoria:** persistência explícita, execução de backup fora do processo de requisições e política comum com scripts externos. O fluxo `runBackupIncremental` é dump integral de dados de seis tabelas, não uma estratégia incremental de recuperação de todo o banco.

**Critério futuro:** recriar container não apaga backups; nome exibido explica exatamente o que foi salvo e como pode ser restaurado.

### INF-04 — Restauração pode prosseguir com erros SQL e tem formatos incompatíveis

**P1 · C.** `scripts/restore.sh` restaura SQL gzip via `psql` sem `ON_ERROR_STOP`. `SistemaService.runBackupFull` produz formato custom do PostgreSQL com extensão `.sql`, diferente do formato esperado pelo script.

**Melhoria:** identificação de formato, parada em erro, pré-validação em banco descartável, plano de retorno e recuperação de arquivos. Não executar o restore atual para validar este relatório.

**Critério futuro:** arquivo inválido ou erro SQL nunca é anunciado como restauração bem-sucedida; banco e anexos são reconciliados antes da liberação.

### INF-05 — Healthcheck prova processo vivo, não prontidão do serviço

**P2 · C.** `health/health.module.ts` retorna `ok`, versão e horários sem verificar PostgreSQL ou Redis. O healthcheck Docker chama essa rota.

**Melhoria:** separar liveness, readiness e diagnóstico protegido; refletir dependências essenciais e degradação das opcionais. Adicionar identificação do artefato/commit implantado, mantendo comparação de versões API/frontend.

**Critério futuro:** API que perdeu acesso ao banco não continua sendo classificada como pronta apenas porque responde HTTP.

### INF-06 — Renovação de certificado não recarrega Nginx no fluxo declarado

**P1 · R.** O serviço Certbot em `docker-compose.prod.yml` renova certificados periodicamente, mas não declara hook de reload do Nginx. Não foi encontrado o mecanismo correspondente nos scripts inspecionados; automação externa pode existir.

**Melhoria:** mecanismo documentado de renovação e recarga, com monitoração da validade do certificado efetivamente servido.

**Critério futuro:** renovação no disco resulta em certificado novo servido, sem depender de restart manual não documentado.

### INF-07 — Builds e imagens não são totalmente reproduzíveis

**P2 · C.** Backend/frontend usam `npm install --legacy-peer-deps`; o site usa `npm ci`. O painel não tem lockfile observado e instala em build. Backend copia `node_modules` do builder para produção. Há tags de imagens mutáveis e fallback de checksum dos engines Prisma.

**Melhoria:** instalação determinística compatível com os lockfiles, resolução consciente de peers, redução de dependências de desenvolvimento no runtime e promoção de imagem identificada por release/digest. Revisar ciclo de suporte e advisories com inventário efetivamente instalado em trabalho futuro.

**Critério futuro:** mesmo commit e configuração geram dependências equivalentes; nenhuma versão é atualizada indiscriminadamente apenas porque existe uma major nova. Esta auditoria não atribui CVEs às versões declaradas.

### INF-08 — Há dois modelos de deploy com garantias diferentes

**P1 · C/M.** O `deploy.sh` da raiz sincroniza a árvore local; `scripts/deploy.sh` publica referência Git, mas seu escopo padrão é `backend frontend`. Website, SaaS, Nginx, Compose e scripts exigem tratamento adicional. README ainda orienta o fluxo antigo.

**Melhoria:** processo de release único com escopo explícito, artefatos, migrations, configurações e rollback compatível. Build no próprio host pequeno deve ser reavaliado; há documentação de falta de memória.

**Critério futuro:** uma release declara tudo o que mudou e o que foi implantado; comparar versão não esconde site/painel/infra de outra revisão.

### INF-09 — Contextos e sincronização podem carregar arquivos não destinados ao deploy

**P2 · R.** O rsync da raiz exclui nomes específicos de `.env`, mas não usa automaticamente `.gitignore`. Há `.env` de backup e artefatos locais na raiz. `.dockerignore` do frontend exclui `.env`, mas não todas as variantes; o painel não apresenta contexto mínimo dedicado.

**Melhoria:** empacotamento por lista positiva ou artefato Git, exclusão consistente de segredos/arquivos locais e separação entre material empresarial e distribuição. Não assumir vazamento consumado: o conteúdo dos ambientes não foi inspecionado.

**Critério futuro:** pacote de deploy contém só os arquivos necessários, sem dados de importação, credenciais de backup ou artefatos de trabalho.

### INF-10 — Worker de monitoramento não está explicitado na stack principal

**P2 · R.** Código de monitoramento e cofre referenciam worker/rollups/pub-sub; não foi localizado serviço `monitoring-worker` no Compose principal nem diretório equivalente na estrutura analisada. O agente em `scripts/orkestri-agent.js` não comprova, por si só, a mesma responsabilidade.

**Melhoria:** inventário de processos externos, repositório/versão, configuração, credenciais, retenção de telemetria e relação com OSA/Zabbix. Preservar distinção entre telemetria regenerável e eventos históricos necessários.

**Critério futuro:** nova instalação consegue reproduzir monitoramento e rollups sem depender de componente não documentado em uma máquina antiga.

### INF-11 — Observabilidade e auditoria não garantem acompanhamento de falhas

**P2 · C/M.** Há `catch` silenciosos e respostas vazias de contingência. `AuditService` registra erro quando falha, mas não oferece persistência alternativa. Jobs e webhooks nem sempre compartilham correlação.

**Melhoria:** logs estruturados, ID de requisição/job, métricas de fila, falhas por integração e alertas de backup/expiração. Separar auditoria de negócio, logs técnicos e dados pessoais; proteger dados sensíveis nesses registros.

**Critério futuro:** falha de entrega, auditoria ou backup deixa sinal rastreável e acionável; dado vazio não se confunde com indisponibilidade.

## 7. Código, testes, arquitetura e integrações

### ENG-01 — Pipeline de testes existe como documento, mas não está ativado neste checkout

**P1 · C.** `docs/ci/github-actions-testes.yml` explica que ainda não está em `.github/workflows` por limitação anterior do token. Não há workflow versionado nessa localização no commit analisado.

**Melhoria:** pipeline oficial com verificações obrigatórias e relatórios preservados. A restrição histórica não deve ser confundida com necessidade de criar novos mecanismos paralelos.

**Critério futuro:** PRs mostram resultado real das validações definidas; não basta a existência de um YAML em `docs/`.

### ENG-02 — Suítes importantes podem ser puladas sem evidenciar lacuna

**P1 · C.** Integração de People usa `PEOPLE_IT_DATABASE_URL`; Strategy usa `ESTRATEGICO_DB_TEST_URL`; sem essas variáveis as suítes usam `describe.skip`. O script `backend/scripts/test-integracao.js` seleciona as integrações de People e não a de Strategy. O comando de teste permite ausência de testes.

**Melhoria:** inventário de suítes obrigatórias e bancos descartáveis, relatório de testes pulados, isolamento entre suítes e critérios de falha na CI.

**Critério futuro:** uma execução que pulou integrações obrigatórias não é apresentada como cobertura completa. Nenhuma suíte foi executada nesta auditoria.

### ENG-03 — Cobertura está concentrada em alguns módulos

**P2 · C/M.** Foram encontrados 56 arquivos de testes, com concentração em People, auth, integrações, Strategy e helpers. Diversos módulos, inclusive billing, frota e faturas, não possuem `.spec.ts` próprio no diretório. Testes transversais podem cobrir partes deles; contagem de arquivos não mede cobertura.

**Melhoria:** priorizar regressões de fronteira organizacional, autenticação, dinheiro, reserva concorrente e recuperação. Adicionar jornadas de frontend e contrato API para fluxos críticos, em vez de perseguir percentual indiscriminado.

**Critério futuro:** correções dos achados P0/P1 ficam protegidas por comportamentos verificáveis, incluindo cenários negativos e concorrência.

### ENG-04 — Tipagem permissiva permite divergências entre código e modelo

**P2 · C.** Backend desativa `strictNullChecks` e `noImplicitAny`; frontend usa `strict: false`. Há muitos casts do Prisma para `any`. Os achados DAD-08 e DAD-09 são exemplos concretos do custo dessa permissividade.

**Melhoria:** tipar contexto autenticado, DTOs, contratos e delegates primeiro; adotar rigor gradualmente por fronteira. Não ligar flags globais e silenciar todos os erros com novos casts.

**Critério futuro:** alteração de model ou contexto autenticado quebra a validação de desenvolvimento nos consumidores incompatíveis.

### ENG-05 — Arquivos grandes concentram responsabilidades

**P2 · C/M.** Exemplos no frontend, contados por linhas físicas: cadastros 3.003; chamados 2.767; relatórios de frota 1.748; orçamento 1.620; agenda 1.281. No backend, frota, auth, chamados e projetos também concentram grande volume em poucos arquivos.

**Melhoria:** decompor por caso de uso/componente e regra estável; aproveitar a organização de People/Compliance/Strategy. Extrair serviço antes de duplicar lógica em novo controller.

**Critério futuro:** uma alteração pequena de regra não exige entender toda a página ou um módulo inteiro; a refatoração preserva o comportamento atual.

### ENG-06 — Estado de jobs é frequentemente local ao processo

**P2 · R.** `NotificacaoWorker` usa flag `rodando`; o scheduler de alertas usa mapa `sent`. Isso reduz reentrada na mesma instância, mas não coordena réplicas nem persiste deduplicação após restart. Graph responde 202 e inicia sincronização em memória, embora exista reconciliação agendada em outros serviços.

**Melhoria:** reserva atômica de trabalho, deduplicação durável, fila/outbox e reconciliação. Reaproveitar a infraestrutura de notificações já existente.

**Critério futuro:** restart e duas instâncias não geram efeito duplicado nem perda irreversível; a entrega não depende da vida de uma requisição HTTP.

### ENG-07 — Integrações precisam de contrato de falha e sincronização

**P2 · M/R.** Microsoft tem state assinado e testes, calendário bidirecional e assinaturas; WhatsApp tem monitor/dispatcher. São bases positivas. Faltam nesta auditoria evidências de ensaios de concorrência de refresh, callback repetido, cancelamento externo e recuperação após indisponibilidade longa.

**Melhoria:** estados claros de conexão, tentativa com backoff, timeout total, revogação, prevenção de loops de atualização, conflitos editados dos dois lados e rastreio por evento. Para OAuth, avaliar nonce de uso único e PKCE conforme fluxo suportado; assinatura de state por si só não documenta replay.

**Critério futuro:** usuário distingue conta desconectada, sincronização atrasada e erro; mudanças repetidas não criam eventos duplicados.

### ENG-08 — Limites entre módulos e planos comerciais estão duplicados

**P2 · C/M.** `frontend/src/lib/modules.tsx` é catálogo da navegação, mas `users.module.ts/ALL_MODULOS` mantém catálogo menor e independente. Planos/limites estão em billing e usuários; assinatura individual e comissão têm valores fixos em referral, além de mensagens em frontend/WhatsApp.

**Melhoria:** catálogo de produto, permissões, direitos da assinatura e visibilidade separados conceitualmente, mas derivados de definições coerentes. Não transformar menu oculto em controle de segurança.

**Critério futuro:** novo módulo/plano não exige editar listas incongruentes; alterar preço não deixa texto, cobrança e comissão divergentes.

### ENG-09 — Documentação está rica, mas mistura histórico e estado vigente

**P2 · C/M.** `AUDITORIA_PROJETO.md`, matriz People, documentos de convergência e README retratam momentos diferentes. `Orkiestri Core/MASTER.md` referencia `CURRENT_STATE.md`, não encontrado na listagem dessa pasta. Há arquivos locais não rastreados de planejamento e apresentação.

**Melhoria:** índice de documentação vigente, decisões supersedidas marcadas, mapa do produto atualizado e guia operacional único. Conferir a grafia Git `website/`, que aparece no Windows como `Website/`, sem repetir como defeito atual um problema de caixa já corrigido no Git.

**Critério futuro:** novo colaborador identifica o padrão atual e o que é histórico sem depender da memória de quem implantou.

## 8. Design, experiência e acessibilidade

### UX-01 — Modal compartilhado não contém nem restaura o foco

**P2 · C.** `frontend/src/components/data-ui.tsx/Modal` move foco para o dialog, fecha com Escape e bloqueia scroll, mas não implementa ciclo de Tab, inertização do fundo nem retorno ao elemento que abriu. O comentário sugere foco preso, comportamento que não é implementado pelo simples `.focus()`.

**Melhoria:** comportamento completo de dialog, incluindo modais aninhados, cancelamento com edição pendente e nome acessível. Referência: [padrão de dialog modal do W3C](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

**Critério futuro:** teclado não sai para o fundo; ao fechar, foco retorna a um destino lógico; leitor de tela anuncia título e contexto.

### UX-02 — Abas e cards precisam de interação sem mouse

**P2 · C/M.** `data-ui.tsx/Tabs` tem roles de abas e seleção, mas não associa painéis nem implementa navegação por setas/roving tabindex. `conhecimento/page.tsx/ArticleCard` usa `div` clicável sem equivalente semântico de botão/link no trecho lido.

**Melhoria:** controles semânticos, ordem de foco, estado selecionado, associação de labels e alternativas a hover. Revisar a barra lateral móvel pelo mesmo princípio.

**Critério futuro:** ações essenciais podem ser concluídas só por teclado; cards e abas anunciam papel/estado corretamente.

### UX-03 — Densidade e cores exigem revisão visual dirigida

**P2 · R/M.** Há textos de 10–11 px, tokens `--text-muted`/`--text-faint` claros e abundância de estilos inline. As telas mais densas são cadastros, chamados, frota, financeiro e agenda. A existência de tema claro/escuro e tokens é positiva.

**Melhoria:** escala tipográfica legível, hierarquia de informação, tokens semânticos, contraste medido nos dois temas, zoom, estados de foco e alvos de interação adequados. Não há nota de contraste nesta auditoria porque nenhuma tela foi medida.

**Critério futuro:** dados importantes não dependem de cor ou texto minúsculo; zoom não esconde ações nem causa sobreposição.

### UX-04 — Feedback de ações mistura padrões

**P2 · C/M.** Existem `alert`/`confirm` nativos em reservas, integrações, frota, contratos e outros módulos, ao lado de Sonner, store de toast e modais próprios. Algumas falhas são capturadas sem feedback local.

**Melhoria:** confirmação contextual para exclusão, progresso durante salvamento, prevenção de envio duplicado, mensagem de erro útil e opção de repetir. Avisos de sucesso devem refletir persistência real.

**Critério futuro:** usuário sabe o que mudou, se houve falha parcial e como recuperar; operação destrutiva informa escopo e consequência.

### UX-05 — Falhas de página e carregamento não têm estrutura uniforme

**P2 · C/M.** Não foram encontrados arquivos `error`, `loading` e `not-found` por convenção no App Router do frontend do produto; o Website possui esses componentes. Há estados locais nas páginas, mas isso não equivale a uma fronteira global de erro.

**Melhoria:** fronteiras de erro, estado vazio contextual, skeleton proporcional à tela e retry sem perder filtros/edição. Diferenciar falta de permissão de falta de dados.

**Critério futuro:** falha isolada de API não produz página incompreensível nem apaga estado editável do usuário.

### UX-06 — Catálogo amplo precisa de orientação por tarefa e perfil

**P2 · M.** O catálogo inclui People, Compliance, Strategy, Service, Quality, Projects, Space, Approvals, Assets, Finance, Budget, Fleet, Relations, Supply e áreas administrativas. Parte dos nomes mistura marca em inglês e descrição em português; reservas também possui shell separado.

**Melhoria:** validar agrupamentos com os perfis reais, consistência de termos, favoritos, busca, links contextuais entre módulos e retorno à origem. Não reduzir tudo a um menu maior nem esconder diferenças de permissão.

**Critério futuro:** um usuário de frota/RH/financeiro localiza sua tarefa recorrente sem compreender a organização interna do código.

### UX-07 — Site confirma recebimento de contato sem entregar a solicitação

**P1 · C.** `Website/src/app/api/contact/route.ts` valida os dados, possui `TODO(integration)` e retorna sucesso sem persistir ou encaminhar. O visitante recebe promessa de retorno.

**Melhoria:** entrega durável a um destino real, acompanhamento de falha e prevenção de spam; enquanto não existir, ajustar comportamento e mensagem para não declarar recebimento concluído.

**Critério futuro:** cada confirmação corresponde a registro recuperável; erro de entrega não vira sucesso.

### UX-08 — Demonstração escolhe a primeira organização como fallback

**P1 · R.** `Website/src/app/api/demo/route.ts/resolveOrganizationId` procura organização Default e, na ausência, usa `orgs[0]`.

**Melhoria:** destino de demonstração explícito e validado; indisponibilidade deve impedir encaminhamento errado. O handler já tem timeout e não finge sucesso quando o backend falha, pontos a preservar.

**Critério futuro:** pedido público nunca cai em cliente arbitrário por ordem de consulta.

### UX-09 — Ações visíveis e promessas de produto precisam corresponder à implementação

**P2 · C/M.** `frontend/src/app/dashboard/cmdb/page.tsx` apresenta ação de exportação que apenas avisa “em breve”. O caso de contato do site é mais grave e está separado em UX-07.

**Melhoria:** inventariar ações incompletas, estados demonstrativos e textos comerciais. Desabilitar com explicação ou remover ação não disponível, conforme decisão de produto. Não considerar toda palavra `placeholder` em código como funcionalidade falsa.

**Critério futuro:** botão primário tem efeito útil e previsível; conteúdos comerciais não afirmam uma capacidade ainda indisponível.

### UX-10 — Mídia decorativa e desempenho precisam de medição real

**P2 · R/M.** `Website/src/components/ui/video-backdrop.tsx` mantém vídeo com `src` e autoplay e invoca `play()` mesmo quando CSS pode ocultá-lo. O comentário de que esconder por CSS impede download não deve ser tomado como garantia de economia de rede.

**Melhoria:** carregamento condicionado ao uso, respeito a movimento reduzido, imagem alternativa e orçamento de mídia. Medir desempenho do site e das grandes telas; não há resultado de Lighthouse/Core Web Vitals neste relatório.

**Critério futuro:** telas pequenas e preferência por menos movimento não pagam custo desnecessário de vídeos decorativos; conteúdo permanece completo sem reprodução.

## 9. Matriz de cobertura de todos os módulos do backend

Cada diretório abaixo entrou na varredura estrutural. **D** significa leitura dirigida de fluxo/implementação nesta auditoria; **V** significa varredura estrutural e trechos/contratos, sem revisão completa das regras. Recomendações sem ID de achado são propostas preventivas, não defeitos comprovados. Quantidade de testes é de arquivos `.spec.ts` dentro do próprio diretório, sem contar cobertura indireta.

| Módulo | Nível / testes locais | Parecer e melhoria prioritária |
|---|---|---|
| `agenda` | V / 2 | Revisar recorrência, dia inteiro, fusos, participantes externos e duplicidade com Outlook/WhatsApp. Lembretes são afetados por SEG-24. |
| `alertas` | D / 0 | Validar destinatários da própria organização; evitar autorização duradoura por nome de papel carregado no JWT; unificar catálogo de canais. |
| `apontamentos` | D / 0 | Corrigir vínculo de chamado fora do tenant (SEG-07); definir permissão de registrar horas, limites e edição após fechamento. |
| `ativos` | V / 0 | Revisar DTOs permissivos, transferências, vínculos e histórico; esclarecer separação entre patrimônio/CMDB e monitoramento operacional. |
| `audit` | D / 1 | Escopo obrigatório, recuperação de gravação perdida e política de dados pessoais; preservar eventos essenciais (API-02, INF-11). |
| `ausencias` | V / 0 | Consolidar autoridade com férias/People; validar sobreposição, saldo, calendário útil e mudanças concorrentes de aprovação. |
| `auth` | D / 6 | Prioridade máxima para 2FA, primeiro acesso, tokens, login por organização e reset (SEG-01 a SEG-03, SEG-09, SEG-18 a SEG-23). |
| `automacoes` | D / 0 | Endurecer saída HTTP e retry (SEG-17); versionar regra, registrar avaliação e impedir loops de efeitos entre módulos. |
| `billing` | D / 0 | Autenticar webhook, garantir idempotência e reconciliação; distinguir autorização da assinatura de recebimento de pagamento (SEG-16, DAD-06). |
| `cache` | D / 0 | Separar segurança de cache opcional, usar operações atômicas e evitar invalidação bloqueante ampla (SEG-18). |
| `cadastro-request` | D / 0 | Corrigir `sub` versus `id`, garantir provisão recuperável e autoria (DAD-06, DAD-08). Acesso global já é explicitamente restrito a SA. |
| `capacity` | V / 0 | Definir calendário, capacidade disponível versus planejada e origem das horas; medir consultas por colaborador e exigir escopo. |
| `chamado-templates` | V / 0 | Validar prioridade/categoria e autoria; remover fallback de escopo vazio; preservar compatibilidade de templates usados em chamados existentes. |
| `chamados` | V / 0 | Proteger transições, relações e campos customizados; extrair casos de uso; integrar SLA/CSAT/horas com autorização consistente. |
| `clientes` | V / 0 | Revisar minimização de contatos, regra do score de saúde, relações financeiras e revogação do acesso por portal. |
| `collaborators` | V / 1 | Definir fronteira legada em relação ao People; evitar duas fontes de cargo, gestor e identidade; publicar prazo de migração. |
| `compliance` | D / 3 | Preservar testes de equivalência entre situação derivada e filtro SQL; expandir concorrência de renovação, permissão de anexos e deduplicação de alertas. |
| `conhecimento` | D / 0 | Corrigir renderização HTML (SEG-14); definir publicação/revisão, visibilidade pública e retenção de autoria ao desligar usuário. |
| `contratos` | V / 0 | DTOs e valores monetários; relações cliente/fornecedor, renovação, vigência, histórico e autorização de anexos. |
| `csat` | D / 0 | Corrigir autoria/tenant (SEG-04); usar data própria de avaliação. Rever o indicador chamado NPS, hoje derivado de notas 1–5, para não confundir metodologias. |
| `estrategico` | D / 5 | Preservar domínio e histórico por campo; tratar carteira acima do teto, importação repetida e integração de banco na CI (API-03, ENG-02). |
| `faturas` | D / 0 | Separar leitura e baixa/exclusão, validar relações e precisão; testar geração concorrente por competência (SEG-07, SEG-08, DAD-03). |
| `financeiro` | D / 0 | Tornar DTOs semanticamente fortes; conciliar importações, filtros e exportação; definir estorno e preservação de evidência de pagamento. |
| `frota` | D / 0 | Reservas seguras e concorrência (SEG-07, DAD-04); testar pneus, abastecimentos, manutenção, km, revisões e estado operacional; dividir módulo grande. |
| `gastos` | V / 0 | Idempotência de recorrências, interpretação de mensagens, precisão monetária e distinção entre gasto pessoal e conta empresarial. |
| `health` | D / 0 | Separar prontidão e vida do processo; diagnosticar versão implantada e dependências (INF-05). |
| `integracoes` | D / 5 | Persistir trabalho de webhook, resolver conflito bidirecional, refresh concorrente e replay; preservar secrets cifrados e testes já presentes. |
| `keep` | V / 0 | Preservar propriedade das notas/checklists; revisar compartilhamento, ordenação concorrente e paridade de experiência com Keep da tarefa. |
| `monitoramento` | D / 0 | Corrigir autorização do socket, documentar worker, telemetria e retenção; não atribuir SQL injection só ao nome `$queryRawUnsafe` (SEG-15, INF-10). |
| `notifications` | D / 3 | Corrigir entrega cruzada/configurações, delegate de comentário e deduplicação durável (SEG-06, SEG-24, DAD-09, ENG-06). |
| `orcamento` | V / 0 | Precisão por mês, transação de aprovação, alterações após aprovação, reconciliação do previsto/realizado e segregação de funções. |
| `organizations` | D / 0 | Revisar exclusão de tenant, impedimento de autoimpersonação aninhada e revogação de SA durante sessão; registrar início/fim/motivo de impersonação. |
| `osa` | D / 0 | Verificar host SSH, restringir destinos e proteger credenciais; documentar dependências externas e fallback (SEG-25). |
| `people` | D / 17 | Prioridade para eliminação real de documentos/identidades (DAD-02); preservar escopo organizacional/hierárquico; expandir salários, férias e avaliações concorrentes. |
| `portal` | D / 1 | Corrigir criação de chamado, identidade técnica e numeração; revisar vida útil de tokens e limitação de abuso (DAD-07). |
| `projects` | V / 3 | Preservar testes de conclusão e registros de tarefa; aprofundar colaboração, concorrência no quadro, prazos e retenção após exclusão de usuário. |
| `rbac` | D / 1 | Sincronização de permissões em transação, DTOs concretos e proibição de vínculos cruzados; impedir concessão de privilégios acima do autorizado. |
| `referral` | D / 0 | Efetivação idempotente, não reabrir comissão paga e fonte única de preços/prazos (DAD-06, ENG-08). |
| `setores` | D / 0 | Corrigir escopo de escrita e relações, ciclos indiretos e movimento atômico de hierarquia (SEG-05). |
| `sistema` | D / 0 | Separar SA de master, persistir backup, restringir diretórios e nomear corretamente dump parcial (SEG-10, INF-03, INF-04). |
| `skills` | V / 0 | Validar vínculo colaborador/skill e escala de proficiência; alinhar autoridade com treinamentos/carreira do People. |
| `sla` | D / 0 | Escopo obrigatório e regra explícita de horas corridas versus úteis, pausa/reabertura e recalculagem; alinhar scheduler ao mesmo cálculo. |
| `squads` | V / 0 | Percentuais válidos, soma de alocação, vigência, autorização de membros e reflexos em capacidade/People. |
| `stats` | V / 0 | Revisar escopo e semântica de indicadores, período/fuso, consultas agregadas e distinção de dado ausente versus zero. |
| `suppliers` | V / 0 | Rever se CNPJ deve ser único globalmente ou por tenant; preservar checagem de posse existente nas mutações; proteger documentos e contatos. |
| `users` | D / 0 | Corrigir mutações cruzadas, papéis globais, revogação de sessão e exclusão destrutiva de histórico (SEG-03, API-02, DAD-01). |
| `workflow-templates` | V / 0 | Validar estrutura das etapas e destinatários; versionar templates para não alterar significado de processos em andamento. |
| `workflows` | D / 0 | Transições atômicas, idempotência, segregação de funções, substituição de aprovador e notificação durável (DAD-05). |
| `workforce` | V / 0 | Unificar conceito de colaborador, capacidade e ausência; garantir privacidade dos indicadores e tratamento de pessoa sem login. |

### Cobertura complementar fora dos módulos

| Área | Observação |
|---|---|
| `backend/prisma` | Schema e estrutura de migrations inspecionados; SQL de todas as 101 migrations não foi validado semanticamente. Nenhuma migration executada. |
| `backend/src/common` | Helpers de organização, arquivos e cofre avaliados; reforçar uso consistente. |
| `frontend/src` | Navegação, sessão, shell, estilos, componentes e amostras de páginas avaliados; todas as páginas inventariadas, não todas renderizadas. |
| `Website/` | Dependências, rotas de contato/demo, estrutura e componentes de mídia avaliados; sem teste público. |
| `saas/` | Painel, execução de scripts, persistência de tenants e backup inspecionados; sem provisionar ou remover ambientes. |
| `nginx/`, `infra/` | Headers, roteamento, limites, proxy e duplicação de configurações avaliados; configurações efetivamente carregadas nos servidores não verificadas. |
| `scripts/` e scripts da raiz | Deploy, backup, restore, instalação e referências operacionais lidos seletivamente; nenhum foi executado. |
| `Orkiestri Core/`, `docs/`, design system | Usados como intenção e histórico, não como prova automática de implementação. |
| `importar/`, `.env*`, artefatos binários e logos | Existência estrutural observada; dados/segredos e conteúdo de apresentações não auditados. |

## 10. Plano de priorização sugerido — não executar

### Etapa A — Fronteiras de confiança

1. SEG-01 e SEG-02: 2FA e primeiro acesso realmente aplicados no backend.
2. SEG-11 a SEG-14: shell, superfície estática e HTML ativo nos painéis/conhecimento.
3. SEG-03 a SEG-10 e SEG-24: isolamento de usuários, relações, configurações e entregas.
4. SEG-15 a SEG-23: sessões, WebSocket, webhooks, Redis, identidade e credenciais.

Cada correção deve ser pequena o suficiente para revisar e ter regressão específica. Não juntar atualização de framework, redesign e mudança de autorização na mesma entrega.

### Etapa B — Recuperação e integridade

1. INF-01 a INF-04: estratégia de recuperação comprovável, antes de migrations estruturais.
2. DAD-01 e DAD-02: retenção e eliminação com resultado real.
3. DAD-04 a DAD-09: concorrência, provisão, portal e falhas funcionais específicas.
4. DAD-03: contrato monetário e plano de migração reconciliado.

### Etapa C — Prevenção de regressões

1. ENG-01 a ENG-04: pipeline ativo, integrações não puladas e tipos nas fronteiras críticas.
2. API-01 a API-04: validação, contexto, paginação e contratos.
3. ENG-05 a ENG-08: decomposição, jobs duráveis e catálogo coerente.
4. INF-05 a INF-11: prontidão, certificados, releases, observabilidade e inventário operacional.

### Etapa D — Experiência e consolidação de produto

1. UX-07 e UX-08 têm prioridade anterior por afetarem aquisição e destino dos dados.
2. UX-01, UX-02, UX-04 e UX-05: interação acessível e feedback previsível.
3. UX-03, UX-06, UX-09 e UX-10: revisão visual, arquitetura da informação e desempenho medido.
4. Matriz de módulos: transformar recomendações preventivas em backlog somente após confirmar necessidade e dependências.

## 11. Validações futuras necessárias para fechar uma auditoria de execução

Esta lista documenta o que ainda falta conhecer. Não é autorização para realizar as ações.

- Jornadas HTTP com duas organizações e perfis distintos, cobrindo leitura, escrita, relações, anexos, exportações e notificações.
- Fluxos de login, primeiro acesso, 2FA, reset, expiração, revogação, impersonação e indisponibilidade de Redis.
- Estados de assinatura e pagamentos repetidos, fora de ordem ou interrompidos, sem usar cobrança real em testes.
- Concorrência de reservas, decisões de workflow, geração de faturas e comissões.
- Recuperação de banco e todos os documentos em ambiente descartável, com comprovação de consistência.
- Inventário real de versões instaladas/imagens, advisories aplicáveis e ciclo de suporte; lockfile é referência melhor que apenas `package.json`.
- Identificação de workflows e automações externas, secrets management, firewall, permissões dos volumes e configuração efetiva do proxy.
- Análise de consultas com volume representativo, plano de execução e crescimento de telemetria; nenhuma alegação de consulta lenta foi medida aqui.
- Navegação por teclado/leitor de tela, contraste, zoom, tema claro/escuro e larguras móveis nas jornadas de cada perfil.
- Inspeção visual de agenda, quadro de projetos, relatórios, financeiro, People, Compliance e Strategy; screenshots consistentes para futuras regressões.
- Revisão de políticas de retenção, privacidade, comunicações e termos com os responsáveis competentes; este documento não é parecer jurídico.

## 12. Cuidados para não produzir falsas correções

- Ausência de teste no diretório não prova ausência de cobertura indireta. Número de testes em documento antigo não prova execução atual.
- Consulta global em um job ou painel Super Admin pode ser correta. O problema é misturar contexto global com permissão de tenant ou entregar dados ao destinatário errado.
- `findUnique` por ID não é isoladamente uma vulnerabilidade quando há checagem de posse anterior. Os achados apontam caminhos em que ela falta ou vem depois da escrita.
- `$queryRawUnsafe` não prova SQL injection. Foram observadas consultas parametrizadas no monitoramento; qualquer outra alegação exige rastrear a entrada até o SQL.
- O código já implementa outbox, armazenamento privado, CSRF e escopo em diversas rotas. Melhorar consistência é preferível a criar mecanismos duplicados.
- Não remover documentos, seeds, scripts ou integrações porque não aparecem em imports TypeScript: alguns são chamados operacionalmente.
- Não assumir que ambiente local, homologação e produção estão iguais. Esta auditoria não acessou os servidores.
- Não trocar todas as dependências para “a última versão” sem compatibilidade, advisories aplicáveis, teste e plano de migração.
- Não tratar “mais modular” como obrigação de microserviços. O monólito modular continua adequado; o problema observado é responsabilidade e fronteira pouco uniforme.
- Não anunciar redução de risco, conformidade ou correção concluída apenas porque este relatório existe.

**Conclusão técnica:** o projeto merece uma fase de consolidação com foco em fronteiras de autenticação, isolamento organizacional e recuperação de dados. Há boas soluções já implementadas que podem servir de padrão. A recomendação é evoluir essas soluções para cobrir todos os caminhos, corrigir os defeitos concretos listados e medir o restante antes de decidir mudanças maiores.

---

**Fim do relatório. Nenhuma implementação ou execução operacional é autorizada por este documento.**
