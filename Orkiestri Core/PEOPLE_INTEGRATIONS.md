# PEOPLE_INTEGRATIONS.md

# People Hub Integration Specification

## Objetivo

Este documento define os padrões de integração do People Hub com sistemas internos, plataformas externas e serviços de terceiros.

O objetivo é garantir que o módulo People possa operar como uma camada central de gestão de pessoas, mantendo dados sincronizados, seguros e confiáveis.

---

# Princípios de integração

Todas as integrações devem seguir:

- Segurança.
- Rastreabilidade.
- Idempotência.
- Controle de erros.
- Versionamento.
- Monitoramento.
- Baixo acoplamento.

---

# Arquitetura de integração

Modelo padrão:

Sistema Origem

↓

Integration Layer

↓

People Hub Core

↓

Eventos / Processos / Analytics


---

# Tipos de integração

O People Hub suporta:

## API REST

Utilizada para:

- Sistemas modernos.
- Aplicações internas.
- Parceiros externos.

Formato padrão:


JSON
REST API
HTTPS
OAuth2 / JWT


---

## Webhooks

Utilizados para eventos em tempo real.

Exemplos:

- Novo colaborador criado.
- Alteração cadastral.
- Aprovação realizada.
- Desligamento confirmado.

Fluxo:


Evento

↓

People Hub

↓

Webhook

↓

Sistema consumidor


---

## Importação de arquivos

Suporte para:

- CSV.
- XLSX.
- XML.

Utilizado para sistemas legados.

---

## Integração via banco de dados

Permitido somente para:

- Sistemas internos controlados.
- Ambientes homologados.

Regras:

- Nunca realizar escrita direta sem camada de serviço.
- Todas as alterações devem possuir auditoria.

---

# Sistemas corporativos

## ERP

Integração para sincronização de:

- Empresas.
- Filiais.
- Centros de custo.
- Departamentos.
- Colaboradores.
- Cargos.

---

## Sistema de folha de pagamento

Dados sincronizados:

- Dados contratuais.
- Salários.
- Benefícios.
- Eventos trabalhistas.
- Histórico profissional.

Regras:

- Dados financeiros devem possuir controle de acesso restrito.
- Sincronização deve possuir logs.

---

## Active Directory / LDAP

Objetivo:

Gerenciar identidades corporativas.

Sincronização:

- Usuários.
- Grupos.
- Permissões.
- Status da conta.

Eventos:


Admissão

↓

Criação usuário

↓

Liberação acessos


---

## SSO

O People Hub deve suportar:

- OAuth 2.0.
- OpenID Connect.
- SAML 2.0.

Provedores possíveis:

- Microsoft Entra ID.
- Google Workspace.
- Outros provedores corporativos.

---

# Integração com calendário

Suporte para:

- Google Calendar.
- Microsoft Outlook Calendar.

Uso:

- Entrevistas.
- Avaliações.
- Reuniões.
- Treinamentos.

---

# Integração com comunicação

## E-mail

Serviços suportados:

- SMTP.
- APIs transacionais.

Uso:

- Notificações.
- Convites.
- Comunicados.

---

## WhatsApp

Uso:

- Avisos.
- Lembretes.
- Comunicação com colaboradores.

Regras:

- Necessário consentimento.
- Registrar envio.
- Registrar retorno.

---

# Integração com recrutamento

Sistemas ATS podem fornecer:

- Candidatos.
- Processos seletivos.
- Status das vagas.
- Histórico.

Fluxo:


Candidato aprovado

↓

Cadastro automático

↓

Onboarding


---

# Integração com benefícios

Dados:

- Plano de saúde.
- Vale alimentação.
- Transporte.
- Benefícios flexíveis.

---

# Integração com ponto eletrônico

Dados:

- Marcações.
- Jornada.
- Horas extras.
- Banco de horas.

---

# Integração com treinamentos

Sistemas externos podem enviar:

- Cursos realizados.
- Certificações.
- Notas.
- Frequência.

---

# API Gateway

Todas as integrações externas devem passar por uma camada controladora:

Responsabilidades:

- Autenticação.
- Rate limit.
- Logs.
- Monitoramento.
- Segurança.

---

# Segurança

Toda integração deve possuir:

## Autenticação

Métodos:

- OAuth2.
- API Key.
- JWT.
- Certificados digitais.

---

## Criptografia

Obrigatório:

- HTTPS.
- TLS atualizado.
- Dados sensíveis criptografados.

---

# Controle de sincronização

Tipos:

## Tempo real

Para eventos críticos.

Exemplo:

- Desligamento.
- Alteração de acesso.

---

## Agendada

Para grandes volumes.

Exemplo:

- Atualização cadastral diária.

---

## Manual

Para cargas específicas.

---

# Tratamento de erros

Toda integração deve possuir:

- Retry automático.
- Registro de falhas.
- Alertas.
- Histórico de execução.

---

# Monitoramento

Indicadores:

- Última sincronização.
- Quantidade processada.
- Tempo de execução.
- Erros encontrados.
- Taxa de sucesso.

---

# Auditoria

Registrar:

- Sistema origem.
- Usuário responsável.
- Data/hora.
- Dados alterados.
- Resultado.

---

# Eventos padrão

Eventos disponibilizados pelo People Hub:


employee.created

employee.updated

employee.terminated

employee.department.changed

employee.position.changed

vacation.requested

vacation.approved

performance.completed

training.completed


---

# Evolução futura

Planejado:

- Marketplace de integrações.
- Conectores prontos.
- IA para mapeamento automático de dados.
- Sincronização inteligente.
- Integrações low-code.