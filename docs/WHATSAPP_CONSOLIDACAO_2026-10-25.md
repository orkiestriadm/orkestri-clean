# Consolidação do Orkiestri One — pacote principal publicado

Esta entrega se aplica somente à produção 54.159.107.250. Não alterar 10.192.4.123. A edição empresarial da raiz do repositório permanece preservada; a fonte consolidada da edição de produção está em `apps/orkiestri-one`.

## Implementação candidata

- `pessoal`, `empresa`, `contexto`: contexto persistido por usuário/instância/conversa. Organização resolvida pelo cadastro do usuário, nunca pela mensagem. Trocar contexto cancela rascunhos. Números ambíguos e contas bloqueadas são recusados.
- Empresa: `projetos`, `projeto: Nome`, `equipe P-código`, `demanda P-código: Título para U-código`, `demandas P-código`, `minhas demandas`, `atribuir D-código U-código`, `iniciar`, `concluir`, `reabrir`, `revisar D-código`. Os códigos são os primeiros oito caracteres do UUID; colisões são recusadas. Escritas usam a API autenticada existente para preservar histórico, progresso, agenda e notificações.
- Pessoal: frases delimitadas como `tenho dentista amanhã 14h`, `preciso comprar material amanhã`, `gastei 50 no mercado no pix`. Data/valor são fixados na prévia; confirmar grava, corrigir pede nova frase, cancelar descarta. Prévia expira em 10 minutos. Valores ambíguos são recusados.
- Áudio pessoal: até 30 segundos e 5 MB. O provedor configurado fornece o conteúdo; não acessamos URLs arbitrárias recebidas no webhook. Whisper.cpp local, modelo multilíngue base com checksum verificado; uma transcrição por vez. Toda ação proposta passa por prévia e confirmação. Falas não reconhecidas pedem texto. Precisão varia e a pessoa deve conferir a prévia.
- PDFs/imagens pessoais: até 5 MB, 100 arquivos/100 MB por usuário, 30 dias de retenção. Arquivos fora de diretório público, nomes internos UUID, acesso somente pelo proprietário autenticado. Não geram gastos ou compromissos automaticamente. Anexos empresariais continuam no módulo de projetos.
- Operação: recibos, filas pessoais, métricas e revisão auditada. Reprocessamento exige ausência de gravação de negócio iniciada, payload protegido disponível, identidade/contexto válidos, menos de três tentativas e idade de até 14 dias. Recibos antigos ou com efeitos parciais não podem ser repetidos. Resolver uma revisão não reexecuta comandos.
- Métricas: somente dados reais após a instrumentação; cadastro concluído, mensagens e ações úteis confirmadas. Coortes semanais e retorno entre os dias 7 e 14; denominador considera apenas cadastros com 14 dias completos. Sem reconstruir histórico anterior.

## Evidências já obtidas

Em PostgreSQL real isolado, sem dados de clientes: persistência e isolamento de contexto, cancelamento de rascunhos, escopo de projetos e responsáveis, permissão de Keep, bloqueio de conta e telefone ambíguo, confirmação concorrente sem duplicação, expiração, recibos criptografados, revisão concorrente, recusa de repetição após efeito parcial, auditoria, métricas, armazenamento privado e isolamento de download/exclusão.

O primeiro áudio sintético via eSpeak apresentou baixa precisão tanto no modelo tiny quanto no base. A amostra mais natural gerada localmente com Piper foi reconhecida pelo modelo base como “em um dentista amanhã às 14 horas”, preservando assunto, dia e horário; esse resultado precisa de confirmação humana antes de gravar. Os testes também verificaram autenticação, formato, ocupação, limite de duração e limpeza dos temporários.

Fontes dos componentes: [Whisper.cpp](https://github.com/ggml-org/whisper.cpp), [modelos e checksums](https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md), [API de mídia do Evolution](https://docs.evoapicloud.com/api-reference/chat-controller/get-base64), [voz de teste Piper Faber](https://huggingface.co/rhasspy/piper-voices/tree/main/pt/pt_BR/faber/medium). A voz é usada para teste, sem dados de clientes.

## Publicação e validação

Publicado em 25/10/2026, às 01:30 (America/Sao_Paulo), após compilações completas com lockfiles e testes HTTP em PostgreSQL/Redis próprios, em rede interna sem dados de clientes. As quatro migrations foram ensaiadas com a estrutura e o histórico de migrations da produção antes da aplicação real. Suítes de cadastro, recuperação/primeira ação, rotina diária e recibos passaram.

Imagens do pacote principal:

- API: `sha256:56d3190568ba7c42fdefa037bf077f1e01c594dd43bed447d0399d6cfa5f3a45`.
- Frontend: `sha256:ef1c6966d7c3434a9f3fff65debd8e7d188dbd51f870ca87d5edb2f98f838b10`.
- Mídia: `sha256:abf739426f28c213b4d51b906d3db8eac5b1abfc65ead4e7fb9b1b0530a90baa`.

Navegador real: telas autenticadas, resolução auditada sem repetir efeitos, recusa da opção de reprocessamento para efeitos parciais, redirecionamento de anônimos, rolagem e enquadramento móvel. A verificação visual detectou e corrigiu a ausência do contêiner de rolagem nas novas páginas.

Produção: saúde HTTP, endpoints privados e ASR com token real validados. PDF de demonstração enviado pelo provedor compartilhado, recuperado por sua API, armazenado privadamente, baixado pelo proprietário com hash idêntico e recusado para anônimos. Mensagem de teste aceita pelo provedor. Os payloads de entrada foram injetados pelo webhook autenticado para o telefone autorizado; isso não comprova recebimento/leitura no aparelho. Compromisso, arquivo e métricas técnicas desses testes foram removidos.

O cálculo de coortes foi validado somente em banco isolado com três cadastros sintéticos, uma ativação, duas janelas completas e um retorno. Esses dados não foram inseridos em produção.

Backup protegido e reversão em `/opt/orkestri/.backups/one-20261025`. A reversão automática foi exercitada quando o gate tratou o redirecionamento legítimo 307 para login como falha; o gate foi corrigido e a mesma imagem validada foi reaplicada. Nenhum dump foi restaurado sobre dados legítimos. Scripts de deploy devem ser executados por arquivo, com entrada interativa desativada no comando de migração.

O caso enviado pelo proprietário foi corrigido após a publicação principal: `0` encerra independentemente de estado; `9` reabre o menu; texto desconhecido orienta a abrir o menu; números soltos são recusados como despesas. As respostas de cadastro, renovação válida e confirmações têm prioridade. Testada a sequência da imagem e uma conta com permissão somente de gastos, seguida de regressão de cadastro/primeira ação/recuperação. Publicado em 25/10/2026 às 01:43 (America/Sao_Paulo), imagem final da API `sha256:b721a7480907b165b32a79787e315ccde64793a4870955b74a7e50bdbffa7a90`. Frontend e mídia mantiveram as imagens acima.

No número autorizado, a sequência `menu → 0 → teste → 42 → 9` terminou com recibos processados e sem aumento no número de gastos. Notificação real aceita pelo provedor. As métricas técnicas foram removidas. Reversão específica da correção em `scripts/rollback-menu.sh`, preservando o pacote principal.

O build inicial revelou Next.js 14.2.0 fixado no pacote. Foi preparado o patch compatível 14.2.35, sem mudança de versão principal/React, conforme o [aviso do mantenedor de dezembro de 2025](https://nextjs.org/blog/security-update-2025-12-11). Isso não constitui uma auditoria completa de dependências nem uma migração para uma linha de framework atualmente suportada; essa modernização requer uma entrega própria com regressão dos módulos existentes.
