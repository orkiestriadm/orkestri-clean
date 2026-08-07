# Orkiestri Compliance — guia do módulo

Implementação de `gestaodeobrigacoes.md`. Este documento é o mapa: onde está
cada coisa, o que ficou de fora e o que precisa acontecer no deploy.

Análise da planilha de origem: [`COMPLIANCE_PLANILHA_ORIGEM.md`](./COMPLIANCE_PLANILHA_ORIGEM.md).

---

## A regra central

Tudo no módulo gira em torno de uma distinção que a planilha não fazia:

- **Status** é *declarado* — alguém decidiu (`ativa`, `suspensa`, `cancelada`).
- **Situação** é *derivada* das datas, nunca digitada.

A escada de situação, do tranquilo ao crítico:

```
sem_validade → prorrogada → vigente → renovacao_devida → prazo_fatal_vencido → vencida
```

E os prazos vêm de uma conta, não de um campo:

```
prazo fatal   = validade − antecedência exigida pelo órgão
prazo interno = prazo fatal − folga da categoria
```

Ambos são recalculados em toda escrita (`ObrigacaoService.montarDados`) e
persistidos, para que a lista possa filtrar e ordenar no banco.

> **Atenção ao mexer:** a regra existe em DOIS lugares — `situacaoPrazo()` no
> domínio e `whereDaSituacao()` no repositório (tradução para SQL).
> `obrigacao.repository.spec.ts` compara as duas numa matriz de casos e falha se
> discordarem. Não remova esse teste.

---

## Onde está cada coisa

```
backend/src/modules/compliance/
  domain/            regras puras, sem Prisma
    obrigacao.entity.ts    prazos, situação, prorrogação, renovação
    alerta.entity.ts       régua de marcos, escalonamento, templates
    campo.entity.ts        campos personalizados (coerção de valor)
  application/
    obrigacao.service.ts   CRUD, renovação, protocolo, histórico campo a campo
    catalogo.service.ts    categorias, campos, órgãos, tags, réguas, fluxos
    arquivo.service.ts     anexos
    painel.service.ts      painel executivo, painel pessoal, calendário
    relatorio.service.ts   exportação Excel / PDF / CSV
    notificacao.service.ts MOTOR DE ALERTAS (cron 07:00)
    fluxo.service.ts       aprovação em etapas
    obrigacao.presenter.ts único lugar que calcula a situação para a API
  infrastructure/    repositórios — único ponto que fala Prisma
  presentation/      controllers finos
```

Frontend em `frontend/src/app/dashboard/compliance/` e
`frontend/src/lib/compliance/`.

---

## O motor de alertas

Três garantias, todas cobertas por teste:

1. **Não perde marco.** `marcoVigente()` devolve o limiar mais recentemente
   *cruzado*, não o que casa exatamente com hoje. Varredura que não rodou por
   três dias (deploy, container parado) recupera o aviso ao voltar — uma vez só.
2. **Não repete.** Cada envio grava `ComplianceNotificacaoEnvio.chave`
   (obrigação + marco + canal + destino), com índice único. A chave é reservada
   **antes** do envio, então duas varreduras concorrentes não duplicam.
3. **Não inventa destinatário.** Só quem está nomeado como responsável, mais os
   e-mails/WhatsApps extras da régua.

**Precedência das réguas:** obrigação > categoria > organização.

A aba **Prévia** (`/dashboard/compliance/alertas`) mostra o que a varredura de
hoje dispararia, sem enviar nada — inclusive as obrigações que atingiram um
marco e **não têm destinatário**, que avisariam ninguém.

---

## Permissões

Catálogo em `compliance.permissions.ts`, semeado por `auth.service.ts`.

| Papel | O que recebe |
|---|---|
| administrador | tudo |
| gestor | operação completa (criar, editar, renovar, protocolar, anexar) + aprovar |
| supervisor | só leitura |
| auditor | leitura + histórico de envios + exportação |
| visualizador | as ações `ver` (via filtro genérico de `ALL_PERMISSIONS`) |

Fora de todo perfil padrão, por serem decisões explícitas:
`compliance.notificacao:configurar` (decide quem é incomodado e quando) e
`compliance.admin:gerenciar` (órgãos, tags, fluxos).

---

## Deploy — o que NÃO pode ser esquecido

### 1. Volume nomeado para os anexos

Os anexos ficam **fora** do diretório público, em `COMPLIANCE_DOCS_DIR`
(padrão `/app/secure/compliance-docs`). **Precisa ser volume nomeado no
compose**, do repositório *e* do ambiente. Upload sem volume nomeado se perde a
cada deploy — foi o que aconteceu com os documentos do People em 02/08/2026.

```yaml
services:
  api:
    environment:
      COMPLIANCE_DOCS_DIR: /app/secure/compliance-docs
    volumes:
      - compliance_docs:/app/secure/compliance-docs
volumes:
  compliance_docs:
```

Prove recriando o container e conferindo que o anexo continua baixável.

### 2. Migration

`20260806000000_compliance_gestao_obrigacoes` é puramente **aditiva**: 20
tabelas novas, nenhum ALTER e nenhum DROP em tabela existente. As FKs apontam
para tabelas existentes, mas as filhas nascem vazias — a validação é instantânea
e não trava a API.

### 3. `APP_URL`

Alimenta o `{{Link}}` das mensagens. Sem ela, o e-mail chega com um link
quebrado.

### 4. Carga inicial (opcional)

```bash
node prisma/seed-compliance.js [organizationId]
```

Idempotente. Imprime no fim uma lista de pontos que exigem conferência humana.

---

## O que ficou de fora da v1

Declarado, não esquecido:

| Item da especificação | Situação |
|---|---|
| Canais Teams, Slack e Webhook | O vocabulário existe no schema; a entrega não. O motor registra o canal como não implementado em vez de fingir que enviou. |
| IA (OCR, resumo, perguntas em linguagem natural) | Não implementado. A especificação a coloca como "funcionalidades futuras". |
| Drag and drop / infinite scroll | A lista usa paginação server-side, que é o que escala. |
| Fluxo desenhável em tela | O fluxo é configurável por API (etapas, ordem, papel aprovador); falta o editor visual. |
| Mapa de calor de vencimentos | Substituído pela linha do tempo mensal, que responde a mesma pergunta com menos ruído. |
| Aprovação com aviso ao aprovador | A fila de pendentes existe (`/obrigacoes/aprovacoes/pendentes`); o motor ainda não notifica quem tem que decidir. |

---

## Pontos de atenção conhecidos

- **A régua padrão do seed só notifica o responsável `principal`.** Os demais
  entram como `equipe`, que não está em `destinatarios`. Se a intenção for
  avisar todo mundo, inclua `equipe` na régua.
- **Nenhum dos responsáveis da planilha tem login** na organização semeada, então
  o canal `interno` não alcança ninguém — só o e-mail. Amarrar os e-mails a
  usuários existentes resolve.
- **As três licenças de renovação automática aparecem como vencidas** até que
  alguém registre o número e a data do protocolo. Isso é correto: a flag sozinha
  não prorroga nada.
