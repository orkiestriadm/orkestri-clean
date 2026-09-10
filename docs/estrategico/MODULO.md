# Orkiestri Strategy — Gestão Estratégica

Documentação técnica do módulo que informatiza a planilha **"Acompanhamento
Estratégico"** (plano: `Orkiestri Core/Plano_Orkiestri_Strategic_Management.md`).

- Backend: `backend/src/modules/estrategico/` — rotas em `/api/v1/estrategico/*`
- Frontend: `frontend/src/app/dashboard/estrategico/` — grupo **Strategy** no menu
- Banco: 14 tabelas `estrategico_*` (migration `20260910120000_estrategico_gestao_estrategica`)
- Versão de entrada: **1.35.0**

---

## 1. Arquitetura

Mesmas camadas do Compliance (o módulo mais parecido em natureza: prazos,
alertas, anexos, trilha):

```
estrategico/
  domain/           regras puras, testadas sem banco
    caso.entity.ts        etapas, pipeline, catálogos padrão, risco, aging, normalização
    farol.entity.ts       algoritmo do farol
    alerta.entity.ts      marcos de prazo, escalonamento, aging, follow-up, chaves de de-duplicação
    importacao.parser.ts  leitura da planilha (prévia)
  application/      casos de uso
    caso.service.ts        carteira, filtros, criar/editar com trilha, farol manual, exclusão lógica
    atividade.service.ts   timeline, tarefas, comentários, dependências, "minhas ações"
    documento.service.ts   repositório com versionamento
    painel.service.ts      painel executivo/Diretoria
    relatorio.service.ts   9 relatórios × PDF/Excel/CSV
    reuniao.service.ts     Reunião Estratégica: pauta, decisões, tarefas, ata
    importacao.service.ts  prévia + confirmação (upload)
    importacao.executor.ts gravação transacional (compartilhada com a CLI)
    automacao.service.ts   cron diário 07:30
    aviso.service.ts       sino + e-mail opcional pela fila do despachante
    admin.service.ts       catálogos, parâmetros, perfis
    presenter.ts           o caso "apresentado" (farol e derivados calculados na leitura)
  infrastructure/   caso.repository.ts, documento-storage.service.ts
  presentation/     6 controllers finos
  cli/importar-planilha.ts
```

**Decisão: farol calculado na leitura.** A carteira é pequena por natureza (28
assuntos na planilha de origem; teto de segurança de 5.000), então lista, painel
e relatórios carregam a carteira e calculam o farol com a data de hoje. Assim um
prazo que venceu à meia-noite aparece vencido às 8h, rodando ou não a automação.
A coluna `farol_calculado` é gravada a cada escrita e pela automação, e serve à
trilha ("farol mudou de Amarelo para Vermelho em …").

---

## 2. Modelo de dados

| Tabela | Papel |
|---|---|
| `estrategico_catalogos` | Listas configuráveis por organização: `grupo`, `objetivo`, `esfera`, `area`, `dependencia` (esta com `natureza` interna/externa) |
| `estrategico_casos` | O assunto: identificação, etapa, estágio (oportunidade), prioridade, responsáveis (1 executivo + 1 operacional), próxima ação (texto, responsável usuário **ou** nome, prazo, prioridade), prazo final, última movimentação, 9 valores + classificação, 7 campos de risco + mitigação, farol (calculado, motivos, manual, justificativa), dados de importação, soft delete |
| `estrategico_caso_areas` | Áreas de apoio (N) |
| `estrategico_eventos` | Timeline: tipo, data (precisão dia/mês), título, descrição, decisão, próximo passo, origem (manual/importacao/sistema/reuniao), `revisar` |
| `estrategico_tarefas` | Tarefas; `chave_automacao` única por organização de-duplica a cobrança automática |
| `estrategico_dependencias` | "Aguardando X desde D": catálogo ou organização livre, contato, resposta esperada, follow-ups, resolvida |
| `estrategico_documentos` | Arquivo fora do diretório público; versões apontam para a primeira (`documento_origem_id`) |
| `estrategico_comentarios` | Comentários |
| `estrategico_valores_historico` | Uma linha por mudança de valor (Pretendido → Negociado → Reconhecido → Realizado) |
| `estrategico_historico` | Trilha campo a campo do caso. **Nunca apagada** — nem na exclusão lógica |
| `estrategico_reunioes` | Reunião: participantes, pauta congelada (JSON), anotações, ata, referência "desde" |
| `estrategico_decisoes` | Decisões (de reunião ou de andamento), ligadas ao caso quando houver |
| `estrategico_configs` | Parâmetros do farol e das automações (1 por organização) |
| `estrategico_alerta_envios` | Registro de aviso emitido — a chave única impede repetição |

Relação com o plano (seção 22): `strategic_financials` e `strategic_risks` são
1:1 com o caso e ficaram como colunas dele (evita join em toda leitura); o
histórico financeiro, que é 1:N, é tabela própria. `StrategicStage` e
`StrategicStatus` são definição de processo em `domain/caso.entity.ts` (ver §4).

A migration é **puramente aditiva** (nenhum ALTER/DROP em tabela existente) e
foi validada aplicando-a sobre o schema anterior num Postgres descartável:
`prisma migrate diff --from-url … --to-schema-datamodel` → *No difference detected*.

---

## 3. API (`/api/v1/estrategico`)

Todas exigem JWT. Entre parênteses, a permissão do decorator; regras linha a
linha são aplicadas no serviço.

**Casos** — `GET /casos` (caso:ver; filtros `q, farol, etapa, tipo, objetivoId, esferaId, grupoId, areaId, dependenciaId, prioridade, responsavelId, recorte, paradoDias, ordenar`) ·
`GET /casos/filtros` · `GET /casos/:id` · `GET /casos/:id/historico` · `GET /casos/:id/valores` (financeiro:ver) ·
`POST /casos` (caso:criar) · `PUT /casos/:id` (caso:ver → `editar` ou `editar_proprios` sendo responsável; valores exigem financeiro:editar) ·
`PATCH /casos/:id/farol` (caso:farol) · `DELETE /casos/:id` (caso:excluir)

**Atividade** — `GET /minhas` · `GET|POST /casos/:id/eventos` · `PUT|DELETE /eventos/:id` ·
`GET|POST /casos/:id/tarefas` · `PUT|DELETE /tarefas/:id` · `GET|POST /casos/:id/comentarios` · `DELETE /comentarios/:id` ·
`GET|POST /casos/:id/dependencias` · `PUT|DELETE /dependencias/:id`

**Documentos** — `GET|POST /casos/:id/documentos` (documento:ver|enviar; multipart `arquivo`, 25 MB) ·
`GET /documentos/:id/download` · `DELETE /documentos/:id` (documento:excluir)

**Painel e relatórios** — `GET /painel` (relatorio:ver) · `GET /relatorios` · `GET /relatorios/:tipo` ·
`GET /relatorios/:tipo/exportar?formato=excel|csv|pdf` (relatorio:exportar)

**Reuniões** — `GET /reunioes` · `GET /reunioes/:id` · `GET /reunioes/:id/ata.pdf` (reuniao:ver) ·
`POST /reunioes` · `POST /reunioes/:id/pauta` · `PATCH /reunioes/:id/anotacoes` · `POST /reunioes/:id/decisoes` ·
`POST /reunioes/:id/tarefas` · `PATCH /reunioes/:id/status` (reuniao:conduzir)

**Administração** — `GET /admin/catalogos` · `GET /admin/config` (caso:ver) ·
`POST|PUT /admin/catalogos` · `PUT /admin/config` · `GET /admin/perfis` ·
`POST /admin/importacao/previa` · `POST /admin/importacao/confirmar` · `POST /admin/automacoes/executar` (admin:gerenciar)

---

## 4. Regras de negócio

### Etapas (workflow) e natureza

| Etapa | Natureza |
|---|---|
| Ideia/Oportunidade | oportunidade |
| Em análise · Levantamento de informações · Produção de evidências · Quantificação econômica · Preparação do pleito · Protocolado* · Em negociação/análise externa* · Aguardando decisão* · Decisão recebida · Implementação | ativa |
| Suspenso | suspensa |
| Concluído · Cancelado | encerrada |

\* aguarda terceiro. "Aguardando ANTT" deixa de ser status: é **etapa +
dependência** (catálogo ANTT, desde D) + próxima ação + prazo.

Etapas e pipeline ficam no código porque farol, pauta e indicadores dependem da
natureza de cada uma; objetivos, esferas, grupos, áreas e dependências são
catálogo editável (as 13 dependências da seção 7 do plano são semeadas uma vez
por organização).

### Farol (`domain/farol.entity.ts`)

- **Cinza**: suspenso ou cancelado. **Verde**: concluído.
- **Vermelho** se qualquer um: ação vencida há ≥ `diasAtrasoCritico` (15) — ou vencida em assunto de prioridade alta/crítica; prazo final vencido; sem movimentação há ≥ `diasCriticoSemMovimento` (90); risco geral crítico; qualquer dimensão de risco = 5; assunto crítico sem próxima ação; valor em risco ≥ limiar configurado com risco alto.
- **Azul**: oportunidade antes do protocolo (ou etapa Ideia), sem motivo vermelho.
- **Amarelo** se qualquer um: sem próxima ação; ação sem prazo; ação vencida (abaixo do limite); ação vence em ≤ 7 dias; prazo final em ≤ 15 dias; sem movimentação há ≥ 30 dias; nenhum andamento datado; aguardando dependência há ≥ 30 dias; risco alto; tarefas vencidas.
- **Verde**: nada disso.

Todo motivo sai em texto. Override manual exige justificativa (≥ 10
caracteres), fica no histórico e a tela continua mostrando o calculado.

### Risco

Probabilidade × Impacto (1–5): 1–4 baixo · 5–9 moderado · 10–14 alto · 15–25
crítico. Dimensões (financeiro, jurídico, regulatório, operacional, prazo) em
1–5: 4 alto, 5 crítico. Classificação geral = o pior entre matriz e dimensões.

### Aging e movimentação

`ultima_movimentacao_em` = data do andamento mais recente (recalculada a cada
escrita na timeline). Mudança de etapa, decisão em reunião e conclusão de tarefa
geram andamento de sistema — são movimento real.

### Automações (07:30, `automacao.service.ts`)

1. recalcula e grava o farol; 2. avisa o dono da próxima ação a 15/7/3/0 dias e
no vencimento (marco mais recente cruzado — não perde aviso se o cron parou);
3. escalona assunto vencido com farol vermelho ou prioridade alta/crítica a cada
`diasEscalonamento`: responsável → + operacional → + executivo e gestores
configurados; 4. aging 30/60/90 para responsável da ação e operacional;
5. dependência **externa** com data de início aguardando ≥ `diasFollowUp` gera
tarefa "Cobrar X — aguardando há N dias" (uma por ciclo; concluir registra o
follow-up); 6. prazos das tarefas.

Avisos vão para o **sino**; e-mail só com `notificarEmail` ligado, pela fila do
`NotificacaoDispatcher` (vazão, silêncio noturno, retentativa). Não há
destinatário implícito: sem pessoa nomeada, conta em `semDestinatario`.
Nenhuma automação altera etapa, valores ou farol manual.

### Reunião Estratégica

Pauta gerada na ordem da seção 25: críticos, vencidos, sem atualização,
alterados desde a última reunião encerrada (ou 30 dias), oportunidades novas,
decisões pendentes (aguardando decisão / decisão recebida), ações vencidas.
A pauta é congelada na reunião; "regerar" só antes de encerrar. Decisão com
assunto vira decisão + andamento na timeline. Encerrar monta a ata (texto e
PDF) e avisa cada responsável das ações definidas.

### Importação (`domain/importacao.parser.ts`)

- Aba = a primeira com cabeçalho "Assunto" + "Objetivo"/"Status"; resumos dinâmicos são ignorados (e avisados).
- Linha só com "Assunto" = **grupo**; o grupo "Oportunidades" gera `tipo = oportunidade`.
- Grafias diferentes do mesmo objetivo/área são unificadas por normalização (acentos, preposições, plural) e a unificação é avisada.
- "Área Responsável" com barras: a primeira é a operacional, as demais são apoio.
- Status → etapa + dependência por regras explícitas; o que não casa vira "Em análise" com pendência. O status original é preservado.
- **Evento só de linha que começa com data clara** (`dd/mm/aaaa`, `dd/mm/aa`, `dd.mm.aa`, `mm/aaaa`, `Mês/aa` com precisão de mês). Data futura não é andamento. Linha seguinte sem data é continuação; primeira linha curta de um bloco seguida de datas vira contexto. O resto fica só no texto original e conta como "trecho sem data".
- Valor de célula < R$ 1 (ex.: 0,08 formatado como moeda) não é consolidado. Valores citados no texto ("R$ 295.900.937,50", "40MM") viram **sugestão** na aba Financeiro, nunca número do painel.
- Todo assunto importado nasce com `revisar_importacao = true` e a lista de pendências; data de início de dependência fica vazia (desconhecida).
- Idempotente por título normalizado; reimportar ignora o que existe, inclusive excluído.

---

## 5. Segurança e permissões

Confidencial por padrão: o catálogo `estrategico.*` fica **fora** do
"todo `:ver`" automático do `visualizador` e do `auditor`
(`auth.service.ts`). De saída, só master e `administrador`.

| Permissão | Uso |
|---|---|
| `estrategico.caso:ver/criar/editar/editar_proprios/excluir/farol` | assuntos |
| `estrategico.tarefa:executar` | andamentos, tarefas, comentários sem editar o caso |
| `estrategico.financeiro:ver/editar` | valores (sem `ver`, a API devolve nulo e oculta valores do histórico) |
| `estrategico.documento:ver/enviar/excluir` | repositório |
| `estrategico.reuniao:ver/conduzir` | reuniões |
| `estrategico.relatorio:ver/exportar` | painel e relatórios |
| `estrategico.admin:gerenciar` | catálogos, parâmetros, importação, automações |

Perfis do plano (§15) como receitas em `ESTRATEGICO_PERFIS` (tela
Configurações › Perfis): Administrador, Gestor Estratégico, Responsável,
Colaborador, Diretoria, Consulta. Os papéis do sistema são fixos; concede-se o
conjunto em Administração › Cadastros.

Documentos: fora de `UPLOAD_DIR`, só por download autenticado
(`attachment`, `nosniff`, `no-store`), com auditoria de download; extensões em
lista branca; 25 MB. Toda escrita relevante vai também para o `AuditLog` global.

---

## 6. Testes

- `domain/*.spec.ts` — farol (17 cenários), alertas/risco/normalização, parser (dados sintéticos).
- `estrategico.integracao.spec.ts` — contra Postgres real e descartável (`ESTRATEGICO_DB_TEST_URL`): importação idempotente, trilha, permissão linha a linha, farol manual, automação de follow-up sem duplicar, andamento futuro recusado, painel, 9 relatórios × 3 formatos, reunião completa com ata e agenda, documento versionado e baixado, exclusão lógica preservando histórico.

---

## 7. Pendências conhecidas (fora desta entrega)

- **Fase 4 — IA** (assistente estratégico, sugestão de próxima ação, análise de documento): não implementada.
- **Fase 5 — Outlook**: a reunião vai para a agenda interna (que já sincroniza com o Outlook de quem conectou), mas não há convite externo.
- Controle de acesso **por área** (ver só assuntos da própria área): hoje a visibilidade é por organização + permissão.
- Snapshot mensal de indicadores: a evolução mensal é derivada de andamentos, decisões e histórico de valores; não há foto congelada do painel por mês.
- Política de retenção de documentos: não configurável.
