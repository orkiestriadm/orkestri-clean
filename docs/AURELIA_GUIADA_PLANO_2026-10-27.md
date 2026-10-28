# Implementação em andamento: dez pontos da Aurélia

Solicitação autorizada: implementar os nove pontos da auditoria de simplicidade, mais cadastro inicial fácil pelo site e contato espontâneo. Publicação em produção autorizada no histórico. Não enviar mensagens reais de teste/campanha.

Fonte backend atual e completa: `work/whatsapp-entry-20261027/backend`, atualizada nas três entregas anteriores. Não substituir pelo backend antigo da raiz. Produção `/opt/orkestri`, SSH alias `orkestri-prod`. Fonte One original preservada; manifestos e backups documentam a origem efetiva de produção.

Plano: serviço de diálogo guiado persistido em `whatsapp_inicio` (etapas prefixadas GUIA_), integrado ao inbound antes dos parsers antigos e da divisão pessoal/empresa. Menu por ação, nomes simples, seleção numérica paginada de registros e pessoas, perguntas uma a uma, prévia antes de gravar, correção de campo, voltar uma etapa, cancelar/sair. Permissões e escopo revalidados em leitura e gravação. Agenda, anotações, gastos, projetos/tarefas e tarefas pessoais. Outros recursos com caminho curto e explicação precisa do que exige o site. Projetos usam o mesmo gateway/controller de negócio, sem gravar direto ignorando regras.

Cadastro: apresentação curta persistida em etapa INICIO para aceitar 1/2/3 sem criar usuário antes de confirmação; CADASTRO do site começa perguntando nome. Perguntas curtas, opção de uso pessoal, voltar sem apagar respostas, correção por campo. Gratuidade sem prazo mantida somente para novos cadastros; contas existentes preservadas.

Validação obrigatória: testes de diálogo e integração com banco em rollback, isolamento entre usuários/organizações e permissões, paginação, eventos simultâneos/menus, falhas e execução única, compilação completa, hashes contra produção, backup de fontes no próprio servidor e imagem de retorno. Nenhuma exportação adicional de fonte privado do servidor: uma tentativa anterior de copiar arquivo foi rejeitada pela revisão automática; usar fontes locais já disponíveis e comparar hashes.

Baseline desta entrega salva em functions.store `guiadoBaseline` (cinco arquivos existentes, antes das edições).

## Estado em 27/10, 08:47

Implementação local concluída e 13 arquivos já aplicados aos fontes do servidor após conferência de hashes. Backup `/opt/orkestri/backups/aurelia-guiada-before-20261027T114430Z.tar.gz`. Manifesto `docs/aurelia-guiada-release-20261027.json`; pacotes backend e website no mesmo diretório. Imagens de retorno `orkestri/api:rollback-aurelia-guiada-20261027` e `orkestri/website:rollback-aurelia-guiada-20261027`.

83 testes de quatro conjuntos e TypeScript aprovados. API candidata construída: `sha256:8b4d84cd367e84626f72a8ff71668b95d2377eed9dfa75216be3a02fa2e5382c`. Ensaio `docs/aurelia-guiada-probe-20261027.js` aprovado em 45 verificações com banco real e handler de entrada real; rollback confirmado, contas existentes preservadas, zero envios reais e zero chamadas externas de projetos. No ensaio o gateway de escopo de projetos é real e o HTTP de execução de negócio é simulado sobre a transação, evitando efeitos externos. WhatsApp e Graph simulados.

Website 3.3.2 em construção. Produção ainda roda a API e website anteriores. Falta validar imagem do site, ativar API e site preservando frontend, nginx e banco; conferir saúde pública e ausência de migrações pendentes. Nenhuma nova migração de banco nesta entrega.

## Concluído em 27/10, 09:09

Implementação publicada. A validação final passou em 85 testes e 47 verificações em banco com rollback; navegação de volta entre submenus e correção de campo incluídas. API e website saudáveis; frontend preservado. Detalhes e imagens finais em `AURELIA_GUIADA_ENTREGA_2026-10-27.md`. Nenhum trabalho técnico obrigatório desta entrega ficou pendente; a validação de usabilidade com pessoas reais permanece uma etapa distinta, sem garantia etária inferida dos testes de código.
