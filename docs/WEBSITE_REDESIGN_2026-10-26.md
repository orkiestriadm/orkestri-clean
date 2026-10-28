# Modernização do site — versão 3.2.0

Publicado em `https://www.orkiestri.com/` em 26/10/2026, às 22h44 (America/Sao_Paulo). Todos os links de cadastro no WhatsApp usam **Cadastre-se é gratuito!**, conforme pedido do usuário. As condições do teste de sete dias permanecem no texto explicativo.

## Código e base

A versão correspondente ao site público está em `C:/orkestri-clean/.claude/worktrees/landing-page-audit-redesign-2a4359/Website`, na base Git `9dd80fd`. A pasta `C:/orkestri-clean/Website` pertence a outra revisão e não foi substituída. As mudanças da plataforma e do backend existentes no checkout principal foram preservadas.

O arquivo `website-redesign-3.2.0.patch` guarda as mudanças desta entrega, incluindo o novo componente de demonstração. Aplicá-lo somente sobre a base correspondente ao site 3.1.0, depois de conferir a revisão e eventuais alterações concorrentes.

## Implementado

- Página inicial focada na agenda por sete dias, com CTA que prepara `CADASTRO AGENDA` no WhatsApp já utilizado pelo site.
- Captura real da agenda ampliável, apresentação da Aurélia em três etapas e indicação explícita de demonstração ilustrativa. A demonstração não chama APIs nem cria contas.
- Condições do teste: somente agenda, início na criação da conta, sem cartão e sem cobrança automática; demais módulos dependem de plano e permissões. Preços não foram inventados.
- Fundos com luz animada em CSS, título com gradiente, entradas e microinterações. Movimento reduzido é respeitado; conteúdo principal não depende de JavaScript para ficar visível.
- Serviços detalhados e lista de tecnologias saíram da home; continuam disponíveis nas páginas próprias. A entrada para desenvolvimento sob medida permanece destacada.
- Menu e rodapé com nomes coerentes, serviços em português e acesso a “Como funciona”. Cases e Blog continuam acessíveis por URL, mas perderam destaque enquanto não há publicações.
- “Entrar” aponta a `/login`; `/entrar` redireciona no servidor, sem apresentação em vídeo.
- Menu móvel renderizado em portal para não ser limitado pelo filtro do cabeçalho fixo. Restauração de rolagem e foco, fechamento por Escape e contenção do foco no menu.
- Páginas de serviços encaminham ao contato com o serviço escolhido. O encerramento dessas páginas trata de projetos, sem confundir com teste de agenda.
- Contato diferencia produto, projeto e ajuda com conta. Empresa é opcional e o interesse do serviço é preservado. O formulário valida os campos e prepara um e-mail para envio explícito pelo visitante.
- Removida a confirmação falsa de entrega em `/api/contact`: não existe integração configurada nesse endpoint; agora ele não informa sucesso sem entrega.
- Correção de títulos gramaticais dos módulos, nome “Base de conhecimento” e ocultação do bloco vazio de IA quando não existem capacidades cadastradas.
- Página “Como funciona” atualizada com instruções do teste, primeiro compromisso e definição de senha por código no WhatsApp.

## Validação

- TypeScript e ESLint direcionado aprovados; a compilação de produção também executa lint e verificação de tipos.
- Build final de produção, lint e TypeScript aprovados; 32 páginas estáticas geradas, além das rotas dinâmicas. Sem alteração em banco de dados ou envio de WhatsApp/e-mail.
- Navegação visual em desktop e viewport de 390 × 844: leitura da primeira dobra, ausência de transbordamento horizontal na home, demonstração interativa, menu móvel após rolagem, Escape, restauração de foco e rolagem.
- Galeria da agenda aberta e fechada no navegador.
- Serviço → contato verificado com interesse e nome do serviço preservados.
- Campos obrigatórios e mensagem preparada testados com dados fictícios locais, sem envio e com empresa em branco.

## Limites e publicação

Foi publicado somente o serviço `website`, com `up -d --no-deps`. Não houve commit ou mudança do sistema de autenticação. Os IDs dos containers de API, frontend e nginx permaneceram iguais; o nginx recebeu somente reload após teste de sintaxe. `/login` e `/recuperar-senha` continuam pertencendo à plataforma.

Antes da ativação, uma execução isolada da imagem, sem rede externa, validou página inicial, rótulo de cadastro, versão, demonstração, contato, produto, serviço e HTTP 307 de `/entrar` para `/login`. O redirecionamento foi colocado em `next.config.ts` para ocorrer antes da renderização/streaming do React.

Após a ativação, as dez rotas públicas verificadas retornaram HTTP 200, incluindo login e recuperação de senha. CSS e JavaScript do namespace `/_site/` retornaram 200. `/entrar` retornou 307 com destino `/login`. O navegador confirmou versão 3.2.0, rótulos novos, captura da agenda carregada e apresentação no celular. API permaneceu saudável.

Backup dos arquivos anteriores: `/opt/orkestri/backups/website-before-3.2.0-20261027T013323Z.tar.gz`. Imagem anterior preservada como `orkestri/website:rollback-before-3.2.0-20261027`. Imagem publicada: `sha256:8907d7559a9eb5ba62ce1ccc71c034c6cd169a1b25057e8cc7bef658e908becb`.

Os 29 arquivos da publicação foram comparados com a base anterior sem conflitos. O manifesto `website-release-3.2.0.json`, o arquivo `website-release-3.2.0.tar.gz` e o patch registram a entrega final.

A revisão automática rejeitou uma proposta de integração com webhook porque o destinatário externo para os dados do formulário não estava identificado/autorizado. A alternativa implementada prepara um e-mail para `contato@orkiestri.com`, endereço já publicado no site, sem transmissão automática. Uma integração de envio pelo servidor deve ter destinatário e mecanismo definidos antes de ser implementada.

Fotos da equipe, depoimentos, cases reais e valores dos planos não foram criados sem fonte. O cadastro completo e a entrega de lembretes são fluxos existentes do backend; não foram disparados como parte desta revisão visual.
