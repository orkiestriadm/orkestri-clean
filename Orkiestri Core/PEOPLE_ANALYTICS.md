# PEOPLE_ANALYTICS.md

# People Hub Analytics Specification

## Objetivo

Este documento define a arquitetura de dados, indicadores, dashboards e regras analíticas do módulo People Hub.

O objetivo é transformar dados de pessoas, processos e operações em inteligência para tomada de decisão.

O People Hub deve permitir que gestores compreendam:

- Perfil organizacional.
- Distribuição de colaboradores.
- Evolução da equipe.
- Custos relacionados a pessoas.
- Produtividade.
- Engajamento.
- Indicadores operacionais.
- Tendências futuras.

---

# Princípios

## Dados devem gerar decisão

Toda informação apresentada deve responder:

- Qual problema existe?
- Qual impacto?
- Qual tendência?
- Qual ação recomendada?

---

# Camadas de Analytics

O People Hub deve possuir quatro níveis analíticos:

Operational Analytics

↓

Management Analytics

↓

Strategic Analytics

↓

AI Predictive Analytics

---

# Operational Analytics

Indicadores utilizados pela operação diária.

Exemplos:

- Quantidade de colaboradores ativos.
- Admissões recentes.
- Desligamentos.
- Solicitações pendentes.
- Férias próximas.
- Documentos pendentes.
- Avaliações atrasadas.

---

# Management Analytics

Indicadores para gestores.

Exemplos:

- Distribuição por departamento.
- Distribuição por cargo.
- Turnover.
- Absenteísmo.
- Tempo médio de contratação.
- Evolução salarial.
- Performance das equipes.

---

# Strategic Analytics

Indicadores executivos.

Exemplos:

- Crescimento organizacional.
- Custo total da força de trabalho.
- Previsão de necessidade de contratação.
- Retenção de talentos.
- Evolução de competências.

---

# AI Predictive Analytics

O módulo de IA poderá analisar:

- Risco de desligamento.
- Tendência de turnover.
- Necessidade de contratação.
- Sobrecarga de equipes.
- Lacunas de conhecimento.
- Sugestões de desenvolvimento.

---

# Dashboards

## Dashboard Executivo

Público:

- CEO.
- Diretoria.
- RH estratégico.

Indicadores:

- Total colaboradores.
- Crescimento da empresa.
- Custo médio por colaborador.
- Turnover.
- Indicadores de retenção.

---

## Dashboard RH

Público:

- Recursos Humanos.

Indicadores:

- Admissões.
- Demissões.
- Férias.
- Avaliações.
- Treinamentos.
- Documentação.

---

## Dashboard Gestor

Público:

- Gestores de área.

Indicadores:

- Minha equipe.
- Pendências.
- Performance.
- Ausências.
- Solicitações.

---

# Indicadores principais

## Headcount

Quantidade total de colaboradores.

Headcount =
Colaboradores ativos


---

## Turnover

Mede rotatividade.

Turnover =
(Desligamentos / Média de colaboradores) * 100


---

## Absenteísmo

Mede ausência.

Absenteísmo =
Horas ausentes / Horas previstas


---

## Tempo médio de contratação

Mede eficiência do recrutamento.

Tempo médio =
Dias entre abertura e contratação


---

# Filtros analíticos

Todos os dashboards devem permitir:

- Período.
- Unidade.
- Departamento.
- Cargo.
- Gestor.
- Localidade.
- Status.

---

# Exportação

Dados poderão ser exportados:

- Excel.
- CSV.
- PDF.
- Relatórios automáticos.

---

# Controle de acesso

Analytics deve respeitar:

- Tenant.
- Permissões.
- Hierarquia organizacional.

Exemplo:

Gestor visualiza apenas sua equipe.

RH visualiza toda empresa.

---

# Auditoria

Toda consulta analítica deve registrar:

- Usuário.
- Data.
- Filtros utilizados.
- Relatório acessado.

---

# Performance

Dashboards devem utilizar:

- Cache quando aplicável.
- Consultas otimizadas.
- Processamento assíncrono para relatórios grandes.

---

# Evolução futura

Planejado:

- Benchmark interno.
- Recomendações automáticas.
- Copiloto de RH.
- Previsão de cenários.

