# Módulo: Gestão de Obrigações (Compliance)

## Objetivo

Desenvolver um módulo corporativo de Gestão de Obrigações para o Orkiestri.

O objetivo do módulo é centralizar todo o gerenciamento de documentos, licenças, certificados, contratos, alvarás e quaisquer obrigações que possuam emissão, validade, responsáveis, renovações e notificações.

A planilha em anexo deve ser utilizada apenas como referência da regra de negócio atualmente utilizada pelo cliente. O sistema NÃO deve reproduzir a planilha, mas sim transformá-la em uma solução moderna, escalável e altamente configurável.

---

# Objetivos do módulo

O módulo deverá permitir:

- Cadastro ilimitado de categorias de obrigações
- Cadastro ilimitado de obrigações
- Controle de emissão e validade
- Controle de renovações
- Histórico completo
- Versionamento
- Upload de documentos
- Dashboard executivo
- Calendário
- Linha do tempo
- Workflow de renovação
- Notificações inteligentes
- Auditoria
- Permissões

Todo o módulo deverá seguir o padrão visual e arquitetural do Orkiestri.

---

# Conceito

A entidade principal do módulo será:

Obrigação

Uma obrigação pode representar qualquer item que necessite de acompanhamento.

Exemplos:

- Licença Ambiental
- Licença de Operação
- PGR
- LTCAT
- AVCB
- CLCB
- Licença de Software
- Certificado Digital
- Certificado SSL
- ISO 9001
- Contrato
- Alvará
- Licença Sanitária
- Licença ANVISA
- Licença Ambiental Estadual
- Documento obrigatório
- Qualquer documento com vencimento

O sistema nunca deve limitar os tipos existentes.

---

# Arquitetura

Compliance

├── Dashboard

├── Obrigações

├── Categorias

├── Calendário

├── Notificações

├── Workflow

├── Relatórios

├── Configurações

---

# Cadastro de Categorias

O administrador poderá criar categorias.

Campos:

Nome

Descrição

Ícone

Cor

Status

Exemplos

Meio Ambiente

Segurança do Trabalho

Tecnologia

Software

Jurídico

Qualidade

Financeiro

Fiscal

Infraestrutura

Patrimônio

Contratos

Certificados

Outros

---

# Cadastro da Obrigação

Cada obrigação possuirá:

## Informações Gerais

Nome

Código

Categoria

Tipo

Empresa

Filial

Unidade

Departamento

Centro de custo

Descrição

Criticidade

Baixa

Média

Alta

Crítica

Status

Ativa

Em Renovação

Suspensa

Vencida

Cancelada

Arquivada

---

# Datas

Data de emissão

Data de validade

Data de renovação interna

Data limite (fatal)

Data de aprovação

Data da última renovação

---

# Responsáveis

Responsável principal

Gestor

Equipe

Emails adicionais

WhatsApps adicionais

---

# Órgão

Nome

Contato

Telefone

Email

Site

Endereço

---

# Custos

Valor da licença

Valor da renovação

Centro de custo

Fornecedor

Número da nota fiscal

---

# Arquivos

Upload múltiplo

PDF

Word

Excel

Imagem

ZIP

Todos os anexos deverão possuir:

Nome

Data

Usuário

Versão

Observações

---

# Campos personalizados

Cada categoria poderá possuir campos personalizados.

Exemplo

Categoria

Meio Ambiente

Possui:

Número do Processo

IBAMA

CETESB

Condicionantes

Categoria

Software

Possui:

Fabricante

Número de licenças

Chave

Servidor

Categoria

Segurança do Trabalho

Possui:

Responsável Técnico

CREA

ART

Assim o módulo será completamente dinâmico.

---

# Versionamento

Toda renovação gera automaticamente uma nova versão.

Nunca substituir registros anteriores.

Exemplo

Licença Ambiental

Versão 1

2025

↓

Versão 2

2026

↓

Versão 3

2027

O usuário poderá visualizar qualquer versão anterior.

---

# Histórico

Todas as alterações deverão ser registradas.

Usuário

Data

Hora

Alteração realizada

Valores anteriores

Novos valores

IP

Origem

Exemplo

João alterou validade

Maria anexou documento

Sistema enviou notificação

Carlos renovou obrigação

---

# Dashboard

Criar dashboard executivo.

Cards

Total de Obrigações

Ativas

Vencidas

Vencendo hoje

Vencendo em 7 dias

Vencendo em 30 dias

Em Renovação

Pendentes

Gráficos

Obrigações por categoria

Por empresa

Por unidade

Por departamento

Por responsável

Por criticidade

Por status

Linha do tempo de vencimentos

Calendário mensal

Mapa de calor de vencimentos

---

# Calendário

Visualização:

Dia

Semana

Mês

Ano

Eventos

Data de validade

Data de renovação

Notificações

Workflow

Ao clicar em um evento abrir diretamente a obrigação.

---

# Pesquisa

Pesquisa rápida

Filtros

Categoria

Responsável

Empresa

Departamento

Status

Criticidade

Período

Órgão

Fornecedor

Tags

Data de vencimento

---

# Tags

Cada obrigação poderá possuir múltiplas tags.

Exemplo

Urgente

IBAMA

Software

Fiscal

Segurança

Contrato

Renovação

---

# Favoritos

Usuário poderá favoritar obrigações.

---

# Dashboard Pessoal

Cada usuário visualizará:

Suas obrigações

Próximos vencimentos

Notificações

Pendências

---

# Workflow

Workflow totalmente configurável.

Exemplo

Obrigação criada

↓

Aguardando aprovação

↓

Aprovada

↓

Ativa

↓

Renovação iniciada

↓

Renovada

↓

Arquivada

Administrador poderá criar fluxos personalizados.

---

# Aprovação

Uma obrigação poderá exigir aprovação.

Fluxo

Analista

↓

Supervisor

↓

Gerente

↓

Diretor

---

# Notificações Inteligentes

Esse será um dos principais diferenciais do módulo.

Cada obrigação possuirá sua própria configuração de alerta.

Exemplo

Validade

05/04/2027

Notificar:

180 dias

120 dias

90 dias

60 dias

30 dias

15 dias

10 dias

7 dias

5 dias

3 dias

1 dia

No dia do vencimento

Após vencimento

1 dia

3 dias

7 dias

15 dias

30 dias

Todas essas regras deverão ser configuráveis.

---

# Destinatários

Responsável

Gestor

Equipe

Administrador

Grupo

Emails extras

WhatsApps extras

---

# Canais

Notificação interna do Orkiestri

Email

WhatsApp

Microsoft Teams

Slack

Webhook

API

---

# Templates

O administrador poderá personalizar mensagens.

Exemplo

Olá {{Responsavel}}

A obrigação

{{NomeObrigacao}}

vence em

{{Dias}}

dias.

Validade:

{{DataValidade}}

Clique aqui para visualizar.

---

# Escalonamento

Caso ninguém realize a renovação.

Exemplo

Após 3 dias

Enviar ao gestor

Após 7 dias

Enviar ao gerente

Após 15 dias

Enviar ao diretor

Tudo configurável.

---

# Automações

Quando uma obrigação vencer

Criar tarefa

Criar evento

Enviar email

Enviar WhatsApp

Alterar status

Criar aprovação

Abrir chamado

Executar Webhook

Enviar API

---

# Relatórios

Obrigações vencidas

Obrigações por categoria

Obrigações por empresa

Custos

Renovações

Histórico

Exportação

Excel

PDF

CSV

---

# Permissões

Visualizar

Cadastrar

Editar

Excluir

Renovar

Anexar arquivos

Criar categorias

Configurar notificações

Aprovar

Administrar módulo

Permissões por perfil.

---

# API

Criar API REST completa.

CRUD

Categorias

Obrigações

Anexos

Histórico

Versionamento

Workflow

Notificações

Dashboard

Relatórios

Seguir padrão utilizado pelos demais módulos do Orkiestri.

---

# Banco de Dados

Separar entidades.

Categoria

Obrigacao

ObrigacaoVersao

ObrigacaoHistorico

ObrigacaoArquivo

ObrigacaoComentario

ObrigacaoNotificacao

ObrigacaoResponsavel

ObrigacaoWorkflow

ObrigacaoEvento

ObrigacaoTag

ObrigacaoCampoPersonalizado

ObrigacaoCampoValor

ConfiguracaoNotificacao

TemplateNotificacao

---

# Auditoria

Toda alteração deverá ser auditada.

Quem

Quando

Onde

O que alterou

Valor anterior

Valor novo

IP

Dispositivo

Nunca permitir exclusão física.

Utilizar Soft Delete.

---

# UX/UI

Seguir rigorosamente o Design System do Orkiestri.

Interface moderna inspirada em:

- Linear
- Notion
- Jira
- ClickUp
- Monday
- Asana

Características obrigatórias:

- Interface limpa
- Cards modernos
- Data Grid avançado
- Filtros rápidos
- Pesquisa instantânea
- Drag and Drop quando aplicável
- Modo escuro
- Responsivo
- Skeleton Loading
- Infinite Scroll
- Componentização completa

---

# Inteligência Artificial (Diferencial)

Preparar o módulo para IA.

Funcionalidades futuras:

- Resumir documentos anexados
- Detectar riscos de vencimento
- Sugerir renovação
- Identificar obrigações semelhantes
- Extrair automaticamente dados de PDFs enviados (OCR)
- Criar automaticamente uma obrigação a partir de um documento anexado
- Responder perguntas em linguagem natural, como:
  - "Quais licenças vencem nos próximos 60 dias?"
  - "Qual departamento possui mais obrigações vencidas?"
  - "Quanto gastamos com renovações este ano?"

---

# Requisitos Técnicos

- Arquitetura modular
- Código desacoplado
- Componentes reutilizáveis
- APIs documentadas (OpenAPI/Swagger)
- Testes unitários
- Testes de integração
- Logs estruturados
- Performance para milhares de registros
- Paginação server-side
- Busca full-text
- Controle de concorrência otimista
- Versionamento de dados
- Segurança baseada em RBAC
- Compatível com multiempresa (multi-tenant)
- Preparado para internacionalização (i18n)

---

# Referência

A planilha anexada representa o processo atual do cliente e deve ser utilizada exclusivamente como base para compreender a regra de negócio e os campos existentes. O desenvolvimento não deve replicar a estrutura da planilha, mas evoluí-la para um módulo corporativo, escalável, configurável e aderente à arquitetura do Orkiestri.

---

# Objetivo Final

Entregar um módulo de Gestão de Obrigações que substitua completamente controles realizados em planilhas, centralizando todas as obrigações corporativas da organização em uma única plataforma, com automações, notificações inteligentes, workflows configuráveis, auditoria completa e uma experiência de uso moderna, tornando-se uma referência dentro do ecossistema do Orkiestri.