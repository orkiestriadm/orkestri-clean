# Aurélia guiada — entrega dos dez pontos

## Experiência implementada

| Ponto | Entrega |
|---|---|
| 1. Conversas guiadas | Agenda, anotações, gastos, projetos, tarefas de projeto e tarefas pessoais usam perguntas uma a uma. Pedidos de ajuda e contas a pagar também têm entrada guiada. |
| 2. Nomes simples | Menu apresenta Meus compromissos, Anotações, Meus gastos, Projetos e tarefas da equipe, Minhas tarefas pessoais e Mais opções. |
| 3. Seleção sem códigos | Registros e responsáveis aparecem em listas numeradas de cinco itens, com páginas. IDs continuam apenas no estado interno e são revalidados. Códigos de comprovação de vínculo/acesso existentes não são removidos. |
| 4. Orientação coerente | Menu explica ações disponíveis; exemplos do site atualizados. Tutorial longo e PDF antigo deixam de ser enviados automaticamente após vínculo. |
| 5. Tipos de tarefas | Tarefas pessoais e tarefas de projetos têm caminhos separados e nomes claros. |
| 6. Pessoal/empresa | Escolher uma categoria encaminha ao espaço correspondente, sem pedir que a pessoa decore a troca de contexto. Mensagens de projetos e contas indicam o espaço da empresa. Organização nunca vem do texto do usuário. |
| 7. Confirmação e navegação | Prévia antes de salvar; corrigir por campo, voltar uma pergunta, cancelar ou sair. Comandos antigos de criação mais usados também passam pela prévia. |
| 8. Recuperação de erros | Data/valor inválidos mantêm as demais respostas. Voltar preserva valores já preenchidos. Permissão e versão do registro são rechecadas; falha ambígua de gravação exige revisão, sem repetição automática. |
| 9. Limites explícitos | Menu explica que anexos, compartilhamentos, quadro completo, relatórios detalhados e configurações avançadas ficam no site. Lista de anotação com caixas de seleção tem orientação específica para editar no site, sem oferecer edição de texto que não funciona. |
| 10. Cadastro fácil | Contato espontâneo recebe 1 criar conta, 2 já tenho conta, 3 conhecer, 0 sair. CADASTRO pelo site começa diretamente pelo nome. Uma pergunta por vez, escolha de uso pessoal/empresa, voltar/manter e correção de um dado. Confirmação aceita 1, sim ou “Confirmo meus dados”. |

## Escopo e regras preservadas

Novos cadastros seguem gratuitos nesta fase, sem inserir prazo de teste ou assinatura. Contas existentes mantêm seus prazos e condições. Não há mudança de esquema nesta entrega.

Agenda cria/edita/exclui compromissos e preserva o writeback do calendário externo. Anotações de texto são criadas/editadas e enviadas à lixeira. Gastos têm valor, forma, parcelas quando crédito e data. Projetos e suas tarefas reutilizam o gateway das APIs existentes, preservando autorização, efeitos de calendário e notificações de negócio. Não são gravados diretamente para ignorar regras. Tarefas pessoais independentes podem ser criadas, editadas, concluídas, reabertas e excluídas; listas vinculadas a caixas de seleção continuam no site.

Diálogo guiado persiste em `whatsapp_inicio`, com janela de 30 minutos renovada ao avançar. Acesso e organização são conferidos em leitura e gravação. Chamadas externas que falham após possível efeito não são repetidas automaticamente. O estado de revisão orienta consultar a lista antes de tentar de novo.

## Evidências

- 85 testes automatizados de quatro conjuntos aprovados; TypeScript aprovado.
- 47 verificações com banco real em transação revertida: cadastro espontâneo, correção por campo, cadastro gratuito, menu, notas, gastos, agenda, projetos, tarefas, responsáveis, paginação, navegação de volta entre submenus e campos, cancelamento, revogação e isolamento. Contas existentes conferidas como inalteradas.
- Envios de WhatsApp e calendário externo simulados; gateway de escopo de projetos real e HTTP de execução simulado dentro da transação. Nenhuma chamada externa de projetos e nenhuma mensagem real de teste.
- Site 3.3.2 compilado com lint/TypeScript; duas rotas e sete links de cadastro validados em imagem isolada. Todos os links continuam com comando CADASTRO.
- 115 migrações de produção, banco atualizado antes da ativação; nenhuma migração nova nesta entrega.
- Manifesto de 13 arquivos: `aurelia-guiada-release-20261027.json`.
- Backup original no servidor: `/opt/orkestri/backups/aurelia-guiada-before-20261027T114430Z.tar.gz`.
- Retorno: `orkestri/api:rollback-aurelia-guiada-20261027` e `orkestri/website:rollback-aurelia-guiada-20261027`.

Fonte backend: `work/whatsapp-entry-20261027/backend`, conferida por hashes contra o servidor. Fonte do site: `.claude/worktrees/landing-page-audit-redesign-2a4359/Website`. Backend antigo da raiz não foi usado para sobrescrever produção.

A validação feita é técnica. Ainda não houve observação de crianças, idosos ou outros usuários realizando tarefas; não representa garantia de uso independente por qualquer pessoa nem equivalência total de todas as funções do site no WhatsApp.

## Publicação concluída

Versão final ativada em **27/10/2026, 09:09 (America/Sao_Paulo)**. API saudável; home, demonstração, login e saúde pública disponíveis. Frontend do sistema preservado; site comercial atualizado para **3.3.2**; nginx validado e recarregado.

- API ativa: `sha256:ec5615d14051a80cb48e9a17fa40b1b42018ab9399300007d6f14513fbb3318b`.
- Website ativo: `sha256:eee24c01444873244d6edfad1a73d2b65910a8e0fbff4d51b3edce835f5a3973`.
- Versão final aprovada nas 47 verificações com banco antes da ativação, incluindo navegação entre escolha de ação e campo. Dados de ensaio revertidos, sem mensagens reais.
- Nenhuma campanha disparada e nenhuma condição de conta existente alterada.

Para iniciar a nova experiência ou sair de um diálogo de uma versão anterior, enviar **menu** no WhatsApp.
