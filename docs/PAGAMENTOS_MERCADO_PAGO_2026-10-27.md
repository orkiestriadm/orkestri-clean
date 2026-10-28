# Orkiestri: auditoria e implantação de pagamentos

Verificação realizada em 27/10/2026. Este documento descreve o estado encontrado e a proposta de implantação. **A assinatura de R$ 11,90 ainda não foi ativada.** Nenhuma cobrança, alteração de vencimento ou mensagem comercial foi disparada nesta auditoria.

## Resultado da verificação

Existe integração parcial com o Mercado Pago no backend de produção. A fonte local auditada tem o mesmo SHA-256 do arquivo no servidor: `c8c17e1a6e754f6c93d3122b286feaccdc1b5dcee1f3c3848940359318459ae8` (`billing.module.ts`, normalizado para LF).

| Recurso | Estado encontrado |
| --- | --- |
| Criar assinatura recorrente | Código usa `/preapproval`, com plano associado ou valor definido pelo backend |
| Receber atualizações do provedor | Rota `/api/billing/webhook/mp` existe; processamento precisa de correções |
| Histórico e painel de assinaturas | Estruturas `OrgBilling`, `BillingPayment` e telas de cobrança existem |
| Cancelamento | Há chamada ao Mercado Pago; precisa tratar falhas sem anunciar cancelamento indevidamente |
| Avisos de vencimento | Há rotina de e-mail; WhatsApp possui outro fluxo legado de renovação manual |
| Credenciais de produção | `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` ausentes no contêiner da API |
| Planos do Mercado Pago | `MP_PLAN_BUSINESS_CLOUD` e `MP_PLAN_BUSINESS_PLUS` ausentes |
| Preço único de R$ 11,90 | Não implementado no fluxo de cobrança atual |
| Pix integrado à renovação do Orkiestri | Não encontrei emissão de cobrança Pix com conciliação para este fluxo |

A conferência das configurações retornou somente presença/ausência, sem copiar ou exibir credenciais. Não foram consultadas credenciais de uma conta Mercado Pago externa; a constatação refere-se ao servidor atual.

## Pendências antes de cobrar

1. **Unificar o preço e o produto.** O catálogo atual tem Business Cloud de R$ 99,90, Business Plus de R$ 199,90 e Enterprise manual. Renovação por WhatsApp e indicações ainda referenciam R$ 27. Trocar somente um texto na tela não muda o valor de um plano já criado no Mercado Pago.
2. **Unificar o vínculo da assinatura.** Hoje há cobrança por organização e campos de assinatura por usuário. Proposta: uma assinatura por conta assinante, com todos os módulos contratados por R$ 11,90/mês. Antes de implementar, definir o comportamento de equipes: uma organização inteira paga R$ 11,90 ou cada pessoa paga R$ 11,90? Esse vínculo altera o modelo de dados e o isolamento das cobranças.
3. **Verificar a origem dos webhooks.** O controller lê `x-signature`, mas o serviço não o valida nem usa a chave secreta. Implementar a validação conforme o tópico e consultar o recurso diretamente no Mercado Pago. Não aceitar corpo, link de retorno ou comprovante como confirmação de pagamento. [Documentação oficial de webhooks](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/your-integrations/notifications/webhooks).
4. **Processar eventos repetidos e fora de ordem.** Atualmente cada notificação de pagamento cria uma linha; `mpPaymentId` não tem restrição única. Um evento repetido pode duplicar o histórico e recalcular o mês a partir do dia de recebimento. Usar identificador único, transação, período real e atualização idempotente.
5. **Distinguir autorização de pagamento aprovado.** O fluxo atual transforma assinatura `authorized` em acesso `active`. Registrar autorização separadamente da parcela quitada, preservando eventual período gratuito. Validar valor, moeda BRL, ambiente, recebedor e referência da conta antes de liberar um período pago.
6. **Tratar a renovação recorrente completa.** Além de `payment` e `subscription_preapproval`, reconciliar as cobranças recorrentes e os tópicos pertinentes, incluindo `subscription_authorized_payment`; cancelamento, reembolso e contestação precisam atualizar o acesso segundo a política definida.
7. **Permitir recuperação de falhas.** O webhook atual captura erros e devolve sucesso. Gravar evento em fila durável antes de confirmar recebimento, reprocessar com segurança e reconciliar diariamente com o provedor. Erro temporário sem gravação não deve ser descartado.
8. **Revisar a suspensão e a recuperação do acesso.** Datas e decisões devem vir da assinatura conciliada. A rotina atual depende também de `atualizadoEm` e pode não representar a data real da inadimplência. O usuário suspenso precisa conseguir acessar pagamento, recibos e cancelamento sem entrar em um ciclo de autenticação.

Essas correções são propostas de implantação, não funcionalidades novas já publicadas por esta entrega. Não basta preencher o token no código atual e começar a cobrar.

## Modelo recomendado para R$ 11,90 mensais

Um único produto: **Orkiestri — assinatura mensal**, `1190` centavos, moeda `BRL`, frequência de um mês. O valor deve vir do catálogo no servidor. O cliente não escolhe preço nem informa um valor que o backend aceite sem validação.

Usar checkout hospedado pelo Mercado Pago para autorização do cartão; dados de cartão e CVV não devem passar pelo WhatsApp nem pelo banco do Orkiestri. O backend cria a assinatura vinculada à conta já existente e o provedor confirma os pagamentos. [API oficial de Assinaturas](https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/overview).

| Forma de pagamento | Experiência proposta |
| --- | --- |
| Cartão recorrente | Cliente autoriza R$ 11,90/mês no checkout; cobranças seguintes seguem a recorrência |
| Pix mensal | Gerar cobrança de R$ 11,90 por competência; o cliente paga e o webhook confirmado libera o período |
| Pix Automático | Avaliar separadamente a disponibilidade do produto para a conta e sua integração; não prometer débito automático apenas por oferecer um QR Code Pix |

O Mercado Pago documenta cartão e outros meios, incluindo Pix, na solução de assinaturas. A experiência final e os meios habilitados devem ser validados na integração/conta escolhida. Um Pix avulso exige novo pagamento pelo cliente a cada mês; não equivale a autorização de débito recorrente. [Assinaturas](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/overview), [Pix no checkout](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/websites/pix?scope=prod).

### Jornada do cliente

1. A pessoa se cadastra gratuitamente pelo WhatsApp e começa a usar o Orkiestri.
2. Enquanto a campanha gratuita não tiver encerramento definido, essa pessoa continua gratuita. Os cadastros antigos mantêm suas condições; nenhuma migração automática de vencimentos foi executada.
3. Quando você definir a transição, o sistema mostra preço, data de início, frequência e cancelamento. Sugestão de avisos: sete dias antes, três dias antes e no vencimento. São uma proposta; não há disparo programado nesta entrega.
4. A Aurélia oferece: **1 — Assinar por R$ 11,90/mês; 2 — Continuar até o fim do acesso gratuito; 3 — Tirar uma dúvida.** Responder 1 abre a etapa de pagamento; não registra um pagamento inexistente.
5. O cliente autoriza o cartão ou paga o Pix em uma página segura. O webhook validado confirma a parcela. Só então o sistema registra o período pago.
6. No cartão, a renovação acontece pelo provedor. Em caso de falha, avisar e oferecer atualização do meio de pagamento; tolerância proposta de três dias, a aprovar antes de ativar. No Pix, enviar nova cobrança sem duplicar a competência.
7. Cancelamento deve ter confirmação do provedor e regra explícita de acesso até o fim do período já pago. Manter informações do cliente; não apagar agenda por inadimplência.

Texto sugerido para a transição, somente após definir uma data real:

> Olá, {nome}! Seu acesso gratuito ao Orkiestri termina em {data}. Para continuar usando agenda, anotações, gastos e projetos com a Aurélia, a assinatura será de R$ 11,90 por mês. Você pode escolher cartão com renovação automática ou Pix mensal. Nenhuma cobrança será feita sem você escolher e autorizar. Responda 1 para ver as opções ou 2 para tirar uma dúvida.

## Passo a passo para o responsável pela conta

### 1. Preparar sua conta Mercado Pago

Entre na conta que deve receber o dinheiro, conclua as verificações solicitadas e confira seus dados. Não crie a integração em uma conta de terceiros.

Consulte as taxas mostradas para sua conta e o prazo de recebimento. Não considere os R$ 11,90 como receita líquida: há tarifas de processamento conforme meio, prazo e condições. A integração pode dispensar uma plataforma intermediária paga, mas **não significa recebimentos sem taxas**. [Explicação do Mercado Pago sobre custos e recorrência](https://www.mercadopago.com.br/blog/pagamento-recorrente-ou-unico).

### 2. Criar a aplicação de integração

Acesse o [portal de desenvolvedores](https://www.mercadopago.com.br/developers/pt/docs/getting-started), entre em **Suas integrações/Integrações** e crie uma aplicação para o Orkiestri. Informe o site `https://www.orkiestri.com` e escolha a solução de assinaturas disponível no formulário. Os nomes dos menus podem variar conforme a aplicação.

Essa aplicação identifica a integração técnica. Não é uma assinatura do cliente nem uma autorização para cobrar toda a sua base.

### 3. Separar teste e produção

Na aplicação, abra **Credenciais**. Use o ambiente e os recursos de teste indicados na documentação específica de Assinaturas. Não confunda conta compradora de teste com conta recebedora de produção; não use o próprio cartão para simular pagamentos.

O **Access Token** é a chave privada usada pelo servidor. Ele deve ser instalado pelo responsável técnico em uma variável protegida do backend, nunca em mensagem, print, código público ou campo do site. Os requisitos e a interface de credenciais podem variar por produto; conferir a seção de Assinaturas da aplicação. [Boas práticas oficiais para credenciais](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/resources/credentials-best-practices/secure-credentials).

Você não precisa me enviar sua senha ou token neste chat para concluir a preparação.

### 4. Definir o plano único

Após corrigir e testar o backend, configurar o plano com estes dados:

| Campo | Valor |
| --- | --- |
| Nome | Orkiestri — assinatura mensal |
| Preço | R$ 11,90 |
| Frequência | Mensal, uma cobrança a cada mês |
| Moeda | BRL |
| Duração | Até o cliente cancelar |
| Teste no provedor | Não criar outro prazo automático se a gratuidade já é controlada pelo Orkiestri |
| Referência da compra | Identificador interno da conta e da assinatura |

É possível criar planos pelo painel sem programar, mas um link genérico não resolve sozinho o vínculo automático com a conta do Orkiestri. Para essa liberação, preferir assinatura individual gerada pelo backend com referência única. Não preencher os IDs antigos de Cloud e Plus com um novo plano para simular a unificação. [Plano pelo painel](https://www.mercadopago.com.br/developers/pt/docs/subscription-plans/create-subscription-plan), [plano pela API](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/integration-configuration/subscription-associated-plan).

### 5. Configurar as notificações

Na aplicação, abra **Webhooks/Notificações** e configure os tópicos de pagamentos e assinaturas. A rota existente no sistema é:

`https://www.orkiestri.com/api/billing/webhook/mp`

**Antes de habilitar recebimentos reais nessa rota, corrigir e homologar seu processamento conforme as pendências acima.** Configure uma URL separada para homologação se o ambiente de teste exigir; não envie testes à base real.

A chave secreta de validação deve ficar no servidor, em `MP_WEBHOOK_SECRET`. O backend deve validar a assinatura usando os campos indicados pelo Mercado Pago e consultar o pagamento na API. O redirecionamento após checkout não é comprovante. [Configuração oficial dos webhooks](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/your-integrations/notifications/webhooks).

### 6. O que o desenvolvedor precisa entregar

Consolidar catálogo e cobrança por conta, corrigir webhooks e idempotência, integrar Pix, revisar permissões e página de recuperação, implementar consentimento/cancelamento e avisos com registro de envio. A configuração de produção atual não tem esses ajustes do novo modelo.

Homologar: pagamento aprovado e recusado; evento repetido e atrasado; renovação de cartão; Pix pendente, vencido e pago; cancelamento; reembolso; falha de rede; usuário em organização diferente; acesso gratuito sem fim definido. Confirmar o valor de R$ 11,90 também no provedor, não só na interface.

### 7. Iniciar a operação

Depois da homologação, instalar as credenciais de produção no servidor, verificar a conta recebedora e liberar a opção de assinatura para um grupo controlado. Anunciar a data de término da gratuidade antes da transição. A opção de assinar exige autorização do cliente; a mudança não cobra automaticamente cadastros existentes.

No painel, conferir primeira parcela e renovação. Depois ampliar a operação. Não ativar o catálogo antigo de valores maiores.

## Arquivos técnicos auditados

- Backend atual: `work/whatsapp-entry-20261027/backend/src/modules/billing/billing.module.ts`.
- Modelo de cobrança: `work/whatsapp-entry-20261027/backend/prisma/schema.prisma`.
- Renovação legada: `work/whatsapp-entry-20261027/backend/src/modules/auth/trial-renovacao.ts` e `src/modules/agenda/whatsapp-inbound.module.ts`.
- Indicações e comissão: `work/whatsapp-entry-20261027/backend/src/modules/referral/referral.module.ts`.
- Área do assinante: `apps/orkiestri-one/frontend/src/app/dashboard/billing/me/page.tsx`.

Preservar o backend empresarial da raiz e o histórico financeiro. O código de produção atual foi usado como referência; arquivos antigos não devem substituir o backend em produção.
