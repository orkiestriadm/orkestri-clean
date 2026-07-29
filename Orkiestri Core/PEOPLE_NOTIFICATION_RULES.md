# PEOPLE_NOTIFICATION_RULES.md

# People Hub Notification Rules

## Objetivo

Este documento define as regras de notificações, alertas e comunicações automáticas do People Hub.

O objetivo é garantir que colaboradores, gestores e administradores recebam informações relevantes no momento correto, utilizando o canal adequado.

O sistema deve equilibrar:

- Comunicação eficiente.
- Redução de ruído.
- Priorização de eventos.
- Automação de processos.
- Experiência positiva do usuário.

---

# Princípios de Notificação

## Relevância acima de quantidade

O People Hub não deve gerar excesso de notificações.

Toda notificação deve possuir:

- Motivo claro.
- Usuário responsável.
- Ação esperada.
- Prazo quando aplicável.

---

# Tipos de notificações

O sistema possui quatro categorias principais:

INFORMATION

WARNING

ACTION_REQUIRED

CRITICAL


---

# INFORMATION

## Objetivo

Comunicar eventos concluídos ou atualizações.

Exemplos:

- Documento aprovado.
- Solicitação concluída.
- Treinamento finalizado.
- Atualização cadastral realizada.

Prioridade:

Baixa.

---

# WARNING

## Objetivo

Alertar situações que podem exigir atenção.

Exemplos:

- Documento próximo do vencimento.
- Avaliação pendente.
- Férias próximas.
- Treinamento obrigatório pendente.

Prioridade:

Média.

---

# ACTION_REQUIRED

## Objetivo

Solicitar uma ação do usuário.

Exemplos:

- Aprovar férias.
- Validar documento.
- Responder avaliação.
- Completar cadastro.

Prioridade:

Alta.

---

# CRITICAL

## Objetivo

Comunicar eventos críticos relacionados a processos de pessoas.

Exemplos:

- Falha em integração trabalhista.
- Erro em processamento de folha.
- Violação de regra obrigatória.
- Falha de sincronização de dados.

Prioridade:

Muito alta.

---

# Canais de comunicação

O People Hub suporta:

## In-App Notification

Canal principal.

Utilizado para:

- Alertas internos.
- Pendências.
- Atualizações.

---

## E-mail

Utilizado para:

- Comunicações formais.
- Aprovações.
- Alertas importantes.
- Relatórios.

---

## WhatsApp

Utilizado para:

- Comunicações urgentes.
- Lembretes importantes.
- Interações com colaboradores.

Uso condicionado à autorização do usuário.

---

## Push Notification

Utilizado em aplicações mobile.

---

# Matriz de envio


INFORMATION

In-App

WARNING

In-App
Email

ACTION_REQUIRED

In-App
Email
WhatsApp

CRITICAL

In-App
Email
WhatsApp
Push


---

# Eventos automáticos

## Cadastro de colaborador

Eventos:

- Novo colaborador criado.
- Cadastro incompleto.
- Documentação pendente.

Destinatários:

- Colaborador.
- RH.
- Gestor responsável.

---

# Férias

Eventos:

- Solicitação criada.
- Solicitação aprovada.
- Solicitação recusada.
- Próximo período aquisitivo.

Destinatários:

- Colaborador.
- Gestor.
- RH.

---

# Avaliação de desempenho

Eventos:

- Avaliação liberada.
- Avaliação pendente.
- Prazo próximo.
- Resultado publicado.

Destinatários:

- Avaliado.
- Avaliador.
- Gestor.

---

# Treinamentos

Eventos:

- Novo treinamento atribuído.
- Prazo próximo.
- Treinamento concluído.

Destinatários:

- Colaborador.
- Gestor.

---

# Regras de agrupamento

O sistema deve evitar múltiplas mensagens iguais.

Exemplo:

Antes:


Documento RG pendente

Documento CPF pendente

Documento Endereço pendente


Depois:


3 documentos pendentes no cadastro


---

# Preferências do usuário

Cada usuário poderá configurar:


Notification Preferences

Email enabled
WhatsApp enabled
Push enabled
Marketing notifications
Operational notifications

---

# Horário inteligente

O sistema deve evitar notificações fora de horário comercial.

Padrão:


08:00 até 18:00
Segunda a Sexta


Exceções:

- Eventos críticos.
- Segurança.
- Falhas operacionais.

---

# Histórico de notificações

Toda notificação deve possuir:


id

user_id

type

channel

status

created_at

read_at

action_taken


---

# Status

Estados possíveis:


CREATED

SENT

DELIVERED

READ

ACTIONED

FAILED


---

# Auditoria

O sistema deve registrar:

- Quem recebeu.
- Quando recebeu.
- Qual canal foi utilizado.
- Se houve interação.

---

# Inteligência Artificial

A IA poderá:

- Priorizar notificações.
- Identificar excesso de alertas.
- Sugerir melhores canais.
- Criar resumos inteligentes.

Exemplo:

"Você possui 5 pendências relacionadas ao seu time."

---

# Regras de desenvolvimento

Todo novo módulo do People Hub deve definir:

- Eventos geradores.
- Usuários impactados.
- Prioridade.
- Canal.
- Ação esperada.

Nenhuma funcionalidade deve criar notificações fora deste padrão.