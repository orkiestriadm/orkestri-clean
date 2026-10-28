# Etapa 1 — integridade do cadastro pelo WhatsApp

Data: 24/10/2026. Status: publicada em produção em 24/10/2026, aproximadamente 18h37 (São Paulo).

## Alteração

O provisionamento passa a executar em uma transação PostgreSQL: empresa, usuário, permissões, papel administrador, vínculo, perfil e conclusão do cadastro. Todas as operações usam o cliente da transação. O envio da mensagem de boas-vindas ocorre somente depois do commit.

A confirmação obtém lock da linha por uma atualização condicional. Confirmações simultâneas do mesmo cadastro são serializadas; depois que a primeira conclui, as demais reconhecem o cadastro concluído sem criar outra conta. Cadastros expirados, cancelados ou fora da etapa de confirmação não são provisionados.

O fluxo lê os dados atuais persistidos, em vez das respostas de uma requisição possivelmente desatualizada. Papel administrador ausente ou cadastro não finalizado causam rollback. Em erro, a mensagem oferece tentar novamente, revisar os dados ou cancelar.

## Arquivos

- `backend/src/modules/cadastro-whatsapp/cadastro-atomico.ts`: transação, lock e invariantes de conclusão.
- `backend/src/modules/cadastro-whatsapp/cadastro-whatsapp.module.ts`: cópia do módulo existente em produção com a conclusão corrigida.
- `.whatsapp-audit/cadastro-production.patch`: patch restrito para a versão de produção auditada.
- `.whatsapp-audit/prepare-cadastro.cjs`: geração reproduzível do patch sobre a cópia original.
- `.whatsapp-audit/test-cadastro-postgres.cjs`: testes de falha e concorrência usando PostgreSQL local.

O checkout local não tinha o módulo de cadastro de produção. A cópia foi adicionada para manter o código editável, mas não foi ligada ao módulo de entrada antigo nem foi promovido o checkout inteiro. Produção já importa esse módulo. A convergência dos ambientes continua necessária; este patch é independente dela.

## Validação executada

- Compilação TypeScript da API sem emissão: aprovada.
- Falhas injetadas em criação de empresa, usuário, papel, vínculo, perfil, conclusão e ausência de papel administrador: nenhuma gravação parcial persistiu.
- Nova tentativa após cada uma dessas sete falhas: concluiu com sucesso.
- Seis confirmações concorrentes do mesmo cadastro: um único conjunto de registros; apenas uma mensagem de boas-vindas com senha.
- Cadastros expirado, cancelado, em etapa incorreta e com dados incompletos: nenhuma conta criada.
- Tabelas de teste isoladas foram removidas ao final. Não houve envio de WhatsApp nem criação de conta em produção.

Os testes iniciais executaram o método de conclusão com adaptador de tabelas de teste. Antes do deploy, foi criado um banco separado com o schema real, sem copiar dados de clientes. Nele foram usados os helpers reais de permissões: rollback após falha no perfil, quatro confirmações simultâneas e repetição posterior passaram. As confirmações simultâneas terminaram em aproximadamente 1,7 segundo, abaixo do limite transacional de 30 segundos. Depois do deploy, o módulo efetivamente publicado também concluiu um cadastro nesse banco isolado. Apenas o transporte de WhatsApp foi simulado nesses testes de nova conta.

## Limites e próximos passos

1. A proteção é para confirmações do mesmo cadastro. Dois cadastros distintos para o mesmo CPF/e-mail/número exigem restrições únicas e uma política de identidade revisadas.
2. A entrega de boas-vindas ainda pode falhar depois do commit. A próxima etapa é entrega recuperável e ativação segura; não se deve desfazer uma conta válida só porque o WhatsApp falhou.
3. A senha provisória mantém o comportamento existente. Link de ativação, ocultação de conteúdo sensível em logs e recuperação de acesso serão tratados separadamente.
4. Cadastro parcial preexistente não é corrigido automaticamente.
5. Falhas de negócio não são contornadas retirando permissões ou validações.

Base anterior conferida por SHA-256: `fa039fa2887e7723e8a81f3ba1b043a5b63c2714d51073b35401997e63ba982a`. O cadastro não exige migration; o deploy conjunto incluiu uma migration aditiva para recibos de mensagens. Não reaplicar os scripts sobre a versão já publicada.

## Proteção persistente contra reenvios publicada junto

- Cada mensagem é registrada por instância, conversa e ID do provedor. Reenvios concorrentes e após recriação do serviço não executam a mesma mensagem novamente.
- Todos os itens de um lote são processados; antes, somente o primeiro era considerado.
- `PROCESSADO` significa que o handler terminou, não que a mensagem de resposta foi entregue ao aparelho.
- Falha depois de iniciar a execução deixa o recibo em `REVISAR`. Não há repetição automática de uma operação com efeitos possivelmente parciais.
- Recibos `PROCESSANDO` com mais de dez minutos devem ser inspecionados. Quando há reentrega, passam para `REVISAR`; ainda não há rotina periódica ou interface administrativa para esse tratamento.
- Se não for possível persistir o recibo, o endpoint responde 503, permitindo reentrega pelo provedor. Payload sem identificador de mensagem é ignorado e gera aviso.
- Retenção/limpeza dos recibos e reprocessamento assistido são etapas futuras. O registro não guarda o corpo das mensagens e não substitui uma fila de entrega.

## Resultado de produção

- Migration `20261024183000_whatsapp_recibos` aplicada com sucesso; tabela e modelo Prisma mantidos nos fontes.
- Imagem: `orkestri/api:cadastro-recibos-20261024`, também marcada `latest`.
- Backup da imagem: `orkestri/api:before-cadastro-recibos-20261024`.
- Materiais e fontes anteriores: `/opt/orkestri/.deploy-cadastro-recibos-20261024-C1kIUl`.
- API healthy, zero reinícios após inicialização, endpoint público HTTP 200.
- Três requisições simultâneas pelo webhook real produziram um evento e um recibo PROCESSADO. O evento de teste foi removido; o recibo permanece como trilha.
- Evolution aceitou a confirmação e a saudação com HTTP 201; não se afirma leitura no aparelho.
- 26 testes locais de regressão e a validação TypeScript passaram.

Para rollback da aplicação, restaurar os fontes anteriores de cadastro/entrada, marcar a imagem de backup como `latest` e recriar apenas a API. A tabela de recibos é aditiva e pode permanecer; não apagar a migration aplicada nem os recibos para reverter o código. O schema deve continuar refletindo a tabela existente.
