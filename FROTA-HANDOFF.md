# Handoff — Módulo Gestão de Frotas (Orkestri)

> Documento de continuidade para retomar as atualizações sistêmicas em outra sessão.
> Gerado em 2026-07-06. Local do projeto: `C:\orkestri-clean`.

---

## 0. Ambientes e regra de deploy (LER PRIMEIRO)

| Ambiente | Onde | Como sobe |
|---|---|---|
| **HOMOLOGAÇÃO** | `planner@10.192.4.123` → `/opt/orkestri` | `DEPLOY-FROTA.bat` (Área de Trabalho) → `C:\orkestri-clean\deploy-frota.sh` (tar dos arquivos \| ssh → extrai → `docker compose up -d --build api frontend`). Usuário digita a senha SSH. |
| **PRODUÇÃO** | AWS Lightsail `54.159.107.250` (`ssh orkestri-prod`), git `main` em `/opt/orkestri` | **Só quando o usuário pedir explicitamente.** |

⛔ **REGRA FIXA:** **NÃO** fazer deploy em produção (AWS) nem `git push`/commit-push **sem pedido explícito do usuário**.
Fluxo padrão: editar em `C:\orkestri-clean` → build local (verificação) → `DEPLOY-FROTA.bat` (vai para HOMOLOGAÇÃO).

- Migrations rodam sozinhas no boot do container `api` (Dockerfile CMD `npx prisma migrate deploy`).
- Uploads de anexos: volume `uploads_data:/app/uploads`, servidos em `/uploads/...` (nginx já roteia).

---

## 1. Workflow de desenvolvimento (IMPORTANTE)

- **Trabalhar SEMPRE no checkout principal `C:\orkestri-clean`** (não em git worktrees). O deploy empacota de lá.
- **Lição aprendida:** houve quebra quando o deploy enviou um `schema.prisma` de um worktree desatualizado (faltavam models de monitoramento) → `nest build` da homologação falhou. Ao mexer em arquivos compartilhados (schema, app.module, auth.service, Sidebar), editar a versão do `C:\orkestri-clean`, nunca sobrescrever com a de outro checkout.
- Build local é só verificação; o build que serve usuários roda no Docker do servidor.

### Verificação local (antes de qualquer deploy)
```bash
# backend (precisa DATABASE_URL dummy só p/ prisma)
cd /c/orkestri-clean/backend
export DATABASE_URL="postgresql://u:p@localhost:5432/db"
node node_modules/prisma/build/index.js validate
node node_modules/prisma/build/index.js generate
npm run build            # nest build — deve dar exit 0

# frontend
cd /c/orkestri-clean/frontend
npm run build            # next build — deve dar exit 0
```
> Se aparecerem erros de deps faltando (react-konva, jspdf, ssh2, mysql2, socket.io...) NO CHECKOUT PRINCIPAL, é só `node_modules` local desatualizado — rodar `npm install`. Não é erro do código; o Docker instala tudo do `package.json`.

---

## 2. O que já está construído (módulo Gestão de Frotas)

Backend: **arquivo único** `backend/src/modules/frota/frota.module.ts` (controllers + `@Module`), registrado em `app.module.ts` como `FrotaModule`.
Frontend: pasta `frontend/src/app/dashboard/frota/` (15 páginas + `_components/`).
Permissões RBAC: `frota:ver|criar|editar|excluir|configurar|relatorios` em `auth.service.ts` (seed no boot).
Menu lateral: grupo "Gestão de Frotas" em `Sidebar.tsx` (10 itens).
Alertas: `runFrotaCheck()` em `notifications/alert.scheduler.ts` (WhatsApp + Notification in-app).

### Submódulos entregues
1. **Veículos** (cadastro central) — `veiculos/page.tsx` + `veiculos/[id]/page.tsx` (abas: Linha do Tempo, Pneus c/ árvore, Revisões, Manutenções, Condutores, Custos; timeline; designar condutor). Campos incl. centroCusto, unidade, responsável, horímetro, status (ativo/manutencao/inativo/vendido/sinistrado).
2. **Motoristas** — `motoristas/page.tsx` (dashboard CNH + form vincular-usuário c/ autofill) + `[id]` (anexos CNH frente/verso/exames/certificados, histórico de renovações, renovar CNH). Alertas CNH 90/60/30/15/7/vencida. Bloqueio configurável (só sinaliza).
3. **Pneus** — `pneus/page.tsx` + `[id]` (nº fogo, DOT, custo/km, ações instalar/remover/rodízio/recapar/descartar, histórico). Layout de posições por tipo (config) + **árvore visual** (`_components/PneuTree.tsx`). Alertas rodízio/desgaste/recapagem/substituição.
4. **Revisões preventivas** — `revisoes/page.tsx` abas Agenda (farol verde/amarelo/laranja/vermelho + cálculo automático da próxima) / Planos (regra por modelo, base km/data/horímetro) / Registros.
5. **Manutenção (OS)** — `manutencoes/page.tsx` + `[id]` (nº OS auto, solicitante, custos peças/serviços/terceiros/mão de obra/TOTAL recalculado, apontamento de mão de obra, anexos NF/fotos/orçamentos). Tipos preventiva/corretiva/emergencial; status aberta/em_andamento/aguardando_pecas/finalizada/cancelada.
6. **Documentos** — `documentacoes/page.tsx` + `[id]` (tipos licenciamento/seguro/antt/tacografo/crlv/laudo/inspecao; dashboard de vencimentos; anexos; alertas graduados 90/60/30/15/7/vencido).
7. **Abastecimentos** — `abastecimentos/page.tsx` (km/L, custo/km, consumo médio, análise por veículo, **detecção de desvios** >20% via `/analise/consumo`).
8. **Dashboard executiva** — `page.tsx` (filtros período/unidade/centro-custo/tipo/veículo/motorista; 10 KPIs; 8 gráficos **recharts**; endpoint `/frota/dashboard/executivo`).
9. **Relatórios** — `relatorios/page.tsx` (+ trabalho de "report schedules"/agendamento já integrado — migrations `20260625000001_frota_report_schedules` e `20260625000002_rename_criado_por_id`).

---

## 3. Padrões-chave do código (reusar ao continuar)

- **Backend CRUD genérico:** classe abstrata `BaseFrotaController` no `frota.module.ts`. Subclasses declaram `model`, `tabela`, `fields` (FieldDef[]), `include`/`includeOne`, hooks `beforeCreate`/`afterWrite`. Dá soft-delete (`deletedAt`), auditoria (`AuditService` + `criadoPorId`/`atualizadoPorId`), scoping `organizationId`.
  - **DI com herança:** cada subclasse PRECISA de `constructor(prisma, audit){ super(prisma, audit); }` explícito (senão o Nest não injeta).
  - **Route ordering:** rotas estáticas que colidiriam com `@Get(":id")` usam 2 segmentos (ex.: `cnh/dashboard`, `analise/consumo`, `vencimentos/dashboard`, `:id/anexos`).
- **Frontend CRUD genérico:** `frota/_components/crud.tsx` — `CrudView` config-driven (columns/fields/filters/detailHref/intro) + `FormModal` (padrão `modal-overlay`/`modal-box` do sistema) + `HistoricoDrawer`. Sources de select: `veiculos|motoristas|categorias|setores|users|centrosCusto`.
- **Anexos (upload):** padrão multer em `frota.module.ts` — `diskStorage` p/ `/app/uploads/<entidade>/<id>`, endpoints `POST/GET/DELETE :id/anexos`, URL `/uploads/<entidade>/<id>/<arquivo>`. Usado em motoristas, manutenções, documentos.
- **Alertas:** `runFrotaCheck` monta array `alertas[]` e envia para masters da org (in-app + WhatsApp via `wa.resolveInstance(orgId)`); chaves de dedup com prefixo `frota-` (não são limpas no ciclo de 30min).
- **Gráficos:** **recharts ^3.8.1** (já no projeto). Theming: grid/eixos com `var(--border-subtle)`/`var(--text-muted)`, cores em `CHART_COLORS`, `ResponsiveContainer`.

---

## 4. Migrations da frota (todas idempotentes, hand-written)

`20260624000001_frota_gestao` · `..0002_frota_veiculo_detalhe` · `..0003_frota_motorista_detalhe` · `..0004_frota_pneu_gestao` · `..0005_frota_revisao_preventiva` · `..0006_frota_manutencao_os` · `..0007_frota_documento_anexos` · `..0008_frota_abastecimento_custokm` · `20260625000001_frota_report_schedules` · `20260625000002_rename_criado_por_id`.
> O projeto NÃO usa `prisma migrate dev` — migrations são SQL escritas à mão (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) aplicadas por `prisma migrate deploy` no boot.

---

## 5. Cuidados / armadilhas

- **lucide-react é 1.16.0 (LEGADO):** ícones modernos NÃO existem (Fuel, IdCard, CircleDashed, CalendarCheck, Gauge, Disc, RotateCw...). Antes de usar um ícone, confirmar que já é importado em outra página fora de `/frota`. Seguros: Truck, Users, Package, CalendarDays, Wrench, Zap, CreditCard, FileText, BarChart2, Settings, Plus, Pencil, Trash2, Eye, X, Search, User, ArrowLeft, CheckCircle2, RefreshCw, DollarSign, Activity, TrendingUp, Clock, ChevronRight/Left, Filter.
- **Sem ESLint** no build; **TS `strict:false`** (front e back) — `any` é livre, mas `ignoreBuildErrors:false` ⇒ erros de TIPO quebram o build.
- Working tree do `main` está **commitado localmente** — não fazer push sem pedido.

---

## 6. Próximos passos / ideias em aberto

- Alertas WhatsApp para a **agenda preventiva** entrar no farol laranja/vermelho (hoje o scheduler cobre revisões já agendadas, não o cálculo preventivo).
- Esconder motoristas com CNH vencida dos seletores de condutor quando o bloqueio estiver ativo (hoje só sinaliza).
- Visão de **estoque de pneus** (avulsos) e **dashboard de custos de pneus**.
- Exportações (Excel/PDF) da dashboard executiva / relatórios agendados (verificar o que "report schedules" já cobre).

---

## 7. Onde continuar

Abra este arquivo no início da próxima sessão e diga o que quer evoluir. O estado atual está no checkout `C:\orkestri-clean` (branch `main`, working tree limpo). Deploy de iteração = `DEPLOY-FROTA.bat` (homologação). Produção/git só quando você pedir.
