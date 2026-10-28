# Critérios de conclusão da entrega do WhatsApp

A autorização cobre desenvolvimento, testes e deploy em produção. Não alterar o servidor 10.192.4.123. A fonte desta edição fica em `apps/orkiestri-one`; a edição empresarial da raiz é preservada.

## Critérios obrigatórios

- Contexto pessoal/empresa persistente, indicado nas respostas, sem escolher organização pelo texto de uma mensagem. Troca de contexto invalida rascunhos e respeita permissões.
- Demandas de projetos: criar, listar, atribuir a membros autorizados, iniciar, concluir e reabrir, preservando as regras e os efeitos do módulo de projetos.
- Métricas reais de cadastro, primeira ação útil, atividade e retorno por coorte, com definições explícitas e sem inventar histórico.
- Painel autenticado de filas/recibos e métricas, escopo de usuário/empresa, revisão auditada e reprocessamento somente quando não houver risco de repetir efeitos.
- Linguagem cotidiana para intenções documentadas, com data/valor/contexto em confirmação antes de gravar.
- Áudio curto transcrito localmente e confirmado antes de executar; anexos PDF/imagem privados, limitados em tamanho e sujeitos à autorização de acesso.
- Uma fonte consolidada e um build completo reproduzível, testado em instância isolada e promovido a produção. Não misturar os módulos da edição empresarial.
- Regressão das funcionalidades já publicadas; testes de isolamento, concorrência, falhas e caminhos reais de WhatsApp; saúde após deploy e reversão disponível.

O plano de desenvolvimento só pode ser marcado concluído após esses critérios estarem publicados e validados. Evolução contínua de qualidade de transcrição, novas intenções e análise comercial das coortes não equivalem a funcionalidades já implementadas.

## Resultado em 25/10/2026

Os oito critérios foram implementados, publicados e validados. Evidências em `WHATSAPP_CONSOLIDACAO_2026-10-25.md` e na release da edição One. Foram preservados o código empresarial da raiz e o servidor 10.192.4.123. O caso adicional do menu após `0` também foi corrigido, publicado e testado sem criar gastos.
