# Auditoria de design, UI e UX — Aurélia / Orkiestri 3.3.0

## Escopo e método

Navegação das 25 páginas públicas, leitura dos componentes compartilhados e revisão visual em desktop, tablet e celular. Acesso à plataforma conferido por rotas públicas, sem entrar em contas, enviar WhatsApp ou criar cadastros. Os seis prints enviados foram usados como referência funcional e editorial, sem publicar o nome pessoal nem reproduzir o fluxo antigo de vínculo como requisito para todo novo cadastro.

A avaliação é de interface e experiência observada. Não foram inventados dados de conversão, notas de Lighthouse, resultados de clientes ou métricas de uso.

## Achados e alterações

| Prioridade | Evidência / problema | Implementação |
| --- | --- | --- |
| Alta | A Aurélia aparecia principalmente no cadastro, sem uma apresentação própria. | Abertura dedicada à assistente, com a frase “Aurélia. Sua rotina em harmonia.”, função explícita no WhatsApp e marca visual em SVG/CSS. |
| Alta | Abertura muito alta em tablet: aproximadamente 1.463 px na largura de 958 px. | Grade em duas colunas a partir de tablet e composição mais enxuta; abertura medida em aproximadamente 824 px na mesma largura. |
| Alta | Explicações de comandos e lembretes se repetiam em seções longas. | Cinco exemplos selecionáveis: Meu dia, Compromissos, Gastos, Anotações e Projetos. Removidos blocos redundantes da home. |
| Alta | Blocos começavam com opacidade zero, inclusive quando o usuário preferia movimento reduzido. | Conteúdo de `Reveal` nasce visível. Movimento de entrada é progressivo e não condiciona a leitura à hidratação do JavaScript. |
| Alta | Um brilho da captura de tela ultrapassava a largura útil do celular. | Contenção do efeito na seção editorial. Verificação: largura de rolagem igual à largura útil de 375 px no viewport de 390 px. |
| Alta | Blog e Cases anunciavam falta de conteúdo. | `/blog` virou um hub de guias com comandos copiáveis; `/cases` apresenta possibilidades de uso, sem atribuir resultados a clientes inexistentes. URLs foram preservadas. |
| Média | Seções usavam quase sempre o mesmo preto, a mesma disposição e o mesmo peso visual. | Seção editorial clara para a agenda real, superfícies com profundidade, bordas iluminadas e áreas com funções visuais distintas. |
| Média | Faltava orientação sobre contexto pessoal versus organização. | Exemplos identificam explicitamente o contexto; Projetos explica o comando `empresa`. |
| Média | Prints de instruções têm texto pequeno e não são adaptáveis ao celular. | Conversas reconstruídas como HTML acessível, com texto selecionável, controles de tamanho adequado e exemplos anônimos. |
| Média | Era preciso lembrar ou redigitar os comandos mostrados. | Guias com botão de copiar, confirmação acessível e orientação alternativa se a área de transferência não estiver disponível. |
| Média | Páginas internas tinham cartões planos e pouca ligação com a nova apresentação. | Mesmo sistema de superfícies, sombra, luz local, órbitas decorativas e rodapé em português. |
| Média | Menu não indicava a página atual nas opções diretas. | Estado visual ativo e `aria-current` no menu desktop. Menu móvel com foco e Escape foi preservado. |
| Média | A FAQ deixava uma área vazia larga em desktop. | Layout de duas colunas, com introdução e perguntas em painéis que destacam a resposta aberta. |
| Média | Efeitos poderiam custar processamento sem ajudar a compreensão. | Órbitas e flutuação usam transformações; sombras são estáticas. Realce por ponteiro é limitado a superfícies, com `requestAnimationFrame`, sem execução em toque ou movimento reduzido. |
| Média | Interação poderia sugerir conversa real ou liberação de todos os módulos. | Prévia explicitamente ilustrativa, sem chamadas ao backend; teste de sete dias restrito à agenda e demais recursos conforme plano/permissões. |

## Direção visual

- Identidade da assistente construída como um monograma em órbitas, sem imagem humana fictícia.
- Laranja da marca, preto, tons de cobre e pequenos realces frios. Verde mantido como identificação do cadastro no WhatsApp.
- Títulos com mais contraste de escala, espaço controlado e menos repetição de frases.
- Painel de conversa como elemento funcional: a interação explica o produto, não é apenas decoração.
- Agenda em uma seção clara, com captura real ampliável e três etapas: escrever, acompanhar, lembrar.
- Progresso de leitura discreto nos navegadores compatíveis; navegação comum e rolagem nativa.
- Nenhum áudio automático, envio de dados do ponteiro, cursor substituído, rolagem forçada ou biblioteca 3D adicionada.

## Contraste dos tokens principais

Razões calculadas pelo método de luminância relativa para as cores sólidas indicadas. Os valores não representam uma certificação de acessibilidade da página inteira nem medição de pixels em gradientes.

| Texto / fundo | Razão |
| --- | --- |
| `#adb4c2` / `#15181f` — texto de apoio | 8,53:1 |
| `#868e9d` / `#15181f` — legendas | 5,39:1 |
| `#484b52` / `#edeae5` — seção editorial | 7,28:1 |
| `#9c451c` / `#edeae5` — rótulo editorial | 5,33:1 |
| `#06281a` / `#25d366` — cadastro | 7,98:1 |

## Cobertura de navegação pública

`/`, `/products`, `/products/orkiestri-one`, `/products/one-space`, `/products/one-finance`, `/products/one-projects`, `/products/one-desk`, `/products/one-quality`, `/products/one-core`, `/services`, `/services/software-factory`, `/services/ai-solutions`, `/services/cloud-solutions`, `/services/consulting`, `/services/outsourcing`, `/services/integrations`, `/company`, `/company/careers`, `/technology`, `/cases`, `/blog`, `/contact`, `/demo`, `/privacy`, `/terms`.

As 24 páginas internas inspecionadas apresentaram um H1 por página e não mostraram transbordamento horizontal na largura da inspeção. A revisão responsiva detalhada concentrou-se nos modelos compartilhados e nas novas experiências da home e dos guias.

## Validações da implementação

- TypeScript e lint dos componentes/páginas alterados.
- Cinco cenários clicados, expansão e reinício, preservando os contextos pessoal e da empresa.
- Cópia de comando testada no navegador, com confirmação de sucesso; nenhuma mensagem foi enviada.
- Captura da agenda, leitura no celular e ausência de rolagem horizontal.
- Conteúdo principal visível no HTML; preferência de movimento reduzido tratada no código/CSS.
- Condições do teste e rótulo “Cadastre-se é gratuito!” preservados.

## Conteúdo que depende de evidência adicional

Depoimentos autorizados, estudos de caso com resultados, fotografias da equipe e preços podem melhorar a confiança, mas exigem material real. Não foram criados como decoração. Uma integração automática do formulário de contato depende de destinatário e mecanismo definidos; o preparo de e-mail existente foi mantido.

## Publicação

Versão **3.3.0 publicada em https://www.orkiestri.com/** em 26/10/2026, às 23h28 (America/Sao_Paulo).

Código em `C:/orkestri-clean/.claude/worktrees/landing-page-audit-redesign-2a4359/Website`. Manifesto dos 23 arquivos em `website-release-3.3.0.json` e pacote em `website-release-3.3.0.tar.gz`. Não houve conflito com os arquivos da versão anterior.

O build de produção aprovou TypeScript e lint e gerou as 32 páginas estáticas, além das rotas dinâmicas. O relatório do Next indicou 141 kB de JavaScript no primeiro carregamento da home; esse valor é do build, não uma medição de desempenho em dispositivo real.

Antes da ativação, a imagem foi executada sem rede externa e validou os marcadores da Aurélia, os cinco exemplos, guias, possibilidades de uso, demonstração, produto, serviço e redirecionamento imediato para o login. Depois da publicação:

- As 25 rotas públicas retornaram HTTP 200, com um H1 por página.
- JavaScript e CSS do namespace `/_site/` retornaram 200.
- `/login` e `/recuperar-senha` retornaram 200; `/entrar` retornou HTTP 307 para `/login`.
- Navegador confirmou a versão 3.3.0, o rótulo de cadastro, a interação de Projetos no contexto da empresa e o comando copiável nos guias.
- No viewport público de 390 px, a largura útil e a largura de rolagem foram de 375 px: sem transbordamento horizontal na home.
- API permaneceu saudável; os IDs dos containers de API e frontend foram preservados. Apenas o site foi recriado e o nginx recebeu reload após teste de sintaxe.

Backup dos arquivos anteriores: `/opt/orkestri/backups/website-before-3.3.0-20261027T022420Z.tar.gz`. Imagem anterior preservada como `orkestri/website:rollback-before-3.3.0-20261027`. Imagem publicada: `sha256:962b60f739a85aa6063d58bb2c5b0d1c25f59c9cfddd026b993b8c1e00ffe44d`.

Nenhuma mensagem real foi enviada, nenhum cadastro foi criado e nenhuma alteração em banco de dados foi necessária nesta publicação.
