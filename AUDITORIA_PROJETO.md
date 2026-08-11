# AUDITORIA DE PROJETO — Orkestri / Orkiestri

**Data:** 11/08/2026
**Branch:** `claude/project-audit-reorganization-761e9e` (worktree isolado; `main` intocada)
**Baseline verificada antes de qualquer alteração:** 486 testes passando, build do backend e dos dois frontends em exit 0.

---

## SUMÁRIO EXECUTIVO

O projeto está **em bem melhor estado do que a maioria dos códigos desta idade e tamanho**. Não encontrei o cenário típico de auditoria (pastas `Old/`, `Backup2/`, código comentado aos montes, `console.log` esquecido). Encontrei:

- **zero** arquivos órfãos em `backend/src` (204 arquivos, todos alcançáveis)
- **zero** `debugger`, **zero** `console.log` no frontend, **1** no backend
- **zero** marcadores `TODO`/`FIXME` reais (os 8 achados são a palavra portuguesa *todos*)
- 43 módulos, todos registrados em `app.module.ts` — nenhum módulo morto

O que encontrei de fato foi: **um defeito real de infraestrutura** que só se manifesta em Linux, um punhado de rascunhos de depuração no diretório do backend, seis arquivos de frontend desconectados, e sete dependências npm sem uso.

**O achado mais importante desta auditoria não é lixo — é um bug.** Está descrito logo abaixo.

---

## 🔴 ACHADO CRÍTICO — contexto de build do site com caixa trocada

`docker-compose.yml` construía o site institucional a partir de `./Website` (W maiúsculo). O aplicativo Next.js do site mora em `./website` (minúsculo).

```
docker-compose.yml:198     context: ./Website     ← errado
docker-compose.prod.yml:28 context: ./website     ← certo
```

**Por que passou despercebido:** o desenvolvimento é em Windows, cujo sistema de arquivos é *case-insensitive* — `./Website` e `./website` são a mesma pasta, então localmente funciona. Em produção o `prod.yml` sobrescreve o serviço com o caminho correto, mascarando o problema.

**Onde quebra:** qualquer execução em Linux do compose base sem o `prod.yml` — que, segundo a documentação do próprio projeto, é como a produção sobe (`yml + override.yml`). Em Linux as duas pastas são distintas, e `./Website` contém apenas 6 arquivos de mídia soltos, **sem Dockerfile**. O build falha com "Dockerfile not found", ou pior, reutiliza silenciosamente a imagem `orkiestri/website:latest` antiga e o deploy "passa" publicando o site velho.

O git chegou a registrar as duas grafias simultaneamente: 6 arquivos sob `Website/` e 104 sob `website/`.

**Corrigido:** contexto unificado em `./website`; as 6 entradas com W maiúsculo removidas do índice.

---

## ETAPA 1 — O PROJETO

| Item | Descrição |
|---|---|
| **Arquitetura** | Monorepo, 3 aplicações + painel SaaS, orquestradas por Docker Compose |
| **Backend** | NestJS 10 + TypeScript, Prisma 5 / PostgreSQL 16, Redis, Socket.IO |
| **Frontend (produto)** | Next.js 14 App Router, 105 rotas, ~74.800 linhas |
| **Website (institucional)** | Next.js 15, ~5.200 linhas, standalone output |
| **SA Panel** | Node/Express puro, provisionamento multi-tenant |
| **Entrada backend** | `backend/src/main.ts` → `app.module.ts` (43 módulos) |
| **Banco** | 169 modelos Prisma, 82 migrations, schema de 4.514 linhas |
| **Testes** | Jest, 34 suítes, 643 testes |
| **Multi-tenancy** | Escopo por `organizationId`, JWT com `orgId` |

**Roteamento de produção** (nginx): `/` → container do site; `/dashboard`, `/login`, `/api/`, `/branding/`, `/videos/`, `/_next/` → produto. Site e sistema convivem no mesmo domínio.

---

## ETAPA 2 — CLASSIFICAÇÃO

### 🟢 EM USO CONFIRMADO
Os 204 arquivos de `backend/src`, os 43 módulos, as 105 rotas do frontend, os 82 migrations, `nginx/`, `scripts/` de infraestrutura.

### 🟠 SEM REFERÊNCIA DIRETA — MAS VIVOS (não tocar)

Esta é a categoria que justifica a regra do briefing. **Cada um destes tem zero referência estática e todos estão em uso:**

| Arquivo | Como é realmente chamado |
|---|---|
| `saas/provision.sh`, `deprovision.sh`, `status.sh`, `update-all.sh`, `backup-tenant.sh` | Invocados **por string de caminho** em `saas/sa-panel/server.js:14-18`. Apagá-los quebraria todo o provisionamento de clientes. |
| `frontend/src/components/ui/ToastContainer.tsx` | `dynamic(() => import(...))` em `layout.tsx:7` |
| `xlsx`, `jspdf`, `jspdf-autotable`, `react-konva`, `konva` | `await import(...)` dentro de handlers (orçamento, frota, financeiro, mapas) |
| `scripts/orkestri-agent.js` | Baixado por HTTP pelos servidores dos clientes (`https://orkiestri.com/scripts/orkestri-agent.js`) — integração externa |
| `reflect-metadata`, `passport`, `@nestjs/platform-socket.io` | Carregados por nome/reflection pelo próprio NestJS em runtime |
| `website/.../entrar/page.tsx` → `/branding/planeta.jpg` | Parece 404 (o site não tem esse asset), mas o nginx roteia `/branding/` para o container do **produto**, que tem. Prefetch intencional e funcional. |

Cheguei a marcar o último como defeito antes de ler `nginx/nginx-ssl.conf:225`. Ficou como está.

### 🔴 OBSOLETO — REMOVIDO
Detalhado na Etapa 8.

---

## ETAPA 3 — CÓDIGO MORTO ENCONTRADO

**Rascunhos de depuração em `backend/` (9 arquivos, ~200 linhas).** Sobras de duas sessões de debug: uma contagem de veículos da Frota (`check.js`, `check2.js`, `check3.js`, `check_api.js`, `test_api.js`, `test_count.js`) e um problema de permissões de uma usuária (`check_leticia.js`, `test_leticia.js`, `fix_leticia.js`). Evidência de que eram descartáveis: UUID de organização escrito na mão, zero referências, ausentes do `package.json` e do Dockerfile. **`fix_leticia.js` grava no banco** — não é algo para deixar solto na raiz.

**Frontend desconectado (6 arquivos).**
- `BenefitsSection.tsx`, `TestimonialsSection.tsx` — `LandingClient.tsx` importa explicitamente 15 dos 17 componentes de `landing/`; estes dois foram deixados de fora.
- `ui/button.tsx` — primitiva shadcn da primeira commit, nunca adotada. **Cuidado:** o `website/` tem um `ui/button.tsx` **próprio e diferente**, usado por 17 arquivos. São arquivos distintos em aplicações distintas.
- `WhatsAppSettings.tsx` — substituído por `WhatsAppUserConfig.tsx`
- `hooks/usePermission.ts` — nunca consumido
- `lib/dateUtils.ts` — superado por `lib/datas.ts` (`formatarDataBR`), que é o que as telas usam

**Mídia órfã (6 arquivos).** `gif/`, `hero/` e `screenshots/mod_*.png` foram substituídos por `media/`. `hero/Orange_light_streaks…mp4` é **byte a byte idêntico** a `media/light-streaks.mp4`. Iam para a imagem de produção via `COPY public`.

**O que NÃO é código morto, apesar da aparência:** `seed-demo.js`, `seed-demo2.js`, `seed-demo3.js` parecem versões sucessivas. Não são — são **complementares**: o primeiro popula orçamento/chamados/projetos, o segundo agenda de todos os usuários, o terceiro frota/clientes/contratos/faturas. Mantidos. (O nome é que é ruim; ver recomendações.)

---

## ETAPA 4 — ARQUITETURA

O projeto tem **duas convenções convivendo**, e a mais nova é claramente melhor.

**Convenção antiga — controllers dentro do `.module.ts`.** 40 dos 43 módulos declaram `@Controller` dentro do próprio arquivo de módulo:

| Arquivo | Linhas | Controllers embutidos |
|---|---|---|
| `frota/frota.module.ts` | 2.455 | 17 |
| `chamados/chamados.module.ts` | 1.279 | 2 |
| `orcamento/orcamento.module.ts` | 1.183 | 1 |
| `billing/billing.module.ts` | 971 | 3 |
| `workflows/workflows.module.ts` | 831 | 2 |

Um arquivo de módulo do Nest deveria ter ~20 linhas de fiação. 2.455 linhas com 17 controllers significa que roteamento, validação e regra de negócio estão no mesmo arquivo.

**Convenção nova — camadas explícitas.** Os módulos `people/` e `compliance/` usam `domain/` · `application/` · `infrastructure/` · `presentation/`. Regra de negócio testável isolada de HTTP e de Prisma — e não à toa são os módulos com mais testes de unidade do projeto.

O mesmo padrão se repete no frontend: os módulos novos (`people`, `compliance`, `meu-rh`, `frota`, `projetos`) usam colocação em `_components/`; os antigos concentram tudo em um `page.tsx` — `cadastros/page.tsx` tem 2.945 linhas e `chamados/page.tsx` 2.087.

**Recomendação:** não importar arquitetura de fora. O alvo já existe dentro do repositório, já está em produção e já provou que funciona — é o formato de `people/`. Migrar **incrementalmente**, um módulo por vez, quando cada um for tocado por outro motivo.

**Não executei essa migração nesta auditoria.** Reescrever 40 módulos de uma vez é exatamente o tipo de mudança de risco alto que o briefing manda registrar em vez de executar. É refatoração, não organização.

---

## ETAPA 5 / 7 — ESTRUTURA

A estrutura de diretórios está **coerente** e não exigiu remanejamento. Não movi arquivos de código: em um monorepo com imports por alias, movimentação em massa entrega risco real em troca de ganho estético.

A única movimentação foi para quarentena:

| Arquivo | Origem → Destino | Motivo | Risco |
|---|---|---|---|
| `CLAUDE-FABLE-5.md` | raiz → `_quarentena/` | 124 KB de *system prompt* de um modelo de IA. Não é artefato do projeto, não é referenciado. | Baixo |
| `deploy-frota.sh` | raiz → `_quarentena/` | Deploy pontual de 24/06/2026 para homologação; empacota migrations nomeadas que já estão aplicadas nos três ambientes. | Baixo |
| `FROTA-HANDOFF.md` | raiz → `_quarentena/` | Documento de repasse do módulo, concluído em 07/2026. | Baixo |

Quarentena em vez de exclusão porque são documentos/scripts de valor histórico — a decisão de descartar é sua, não minha.

---

## ETAPA 6 — SEGURANÇA

✅ Versionado em git · ✅ Árvore limpa no início · ✅ Branch dedicada em worktree isolado · ✅ `main` nunca tocada · ✅ Todo arquivo removido recuperável via `git revert` ou `git checkout`.

Rollback completo:
```bash
git checkout main
```

---

## ETAPA 8 — REMOÇÕES

**21 arquivos removidos do índice.** Todos passam pelos mesmos critérios: zero referência estática, zero referência dinâmica, ausentes de configuração/build/deploy, e build + testes verdes depois.

| Grupo | Qtd | Evidência | Risco |
|---|---|---|---|
| Scripts de depuração do backend | 9 | Sem referência; fora do Dockerfile (que copia só `src`, `prisma` e configs); fora do `package.json` | Baixo |
| Frontend desconectado | 6 | Sem import estático nem dinâmico; `next build` idêntico | Baixo |
| Mídia órfã do site | 6 | Sem referência; substituída por `media/`; 1 duplicata exata por checksum | Baixo |

**Dependências removidas (7):**

| Pacote | Onde | Evidência |
|---|---|---|
| `react-big-calendar` + `@types/…` | frontend | A agenda tem calendário próprio (`MiniCalendar`, `eventLayout`, tipo `View` local) |
| `js-cookie` + `@types/…` | frontend | O código usa `document.cookie` direto (`lib/api.ts:39`) |
| `class-variance-authority`, `@radix-ui/react-slot` | frontend | Existiam só para o `ui/button.tsx` removido |
| `mercadopago` | backend | O billing chama a API REST por `fetch` direto; o SDK nunca foi importado |

Resultado: **31 pacotes** a menos em `node_modules` do frontend, 2 no backend.

**Mantidas apesar de "sem uso" aparente:** `react-is` (dependência real do recharts — ver riscos), `reflect-metadata`, `passport`, `@nestjs/platform-socket.io`, e todos os `@types/*`.

---

## ETAPA 9 — DEPENDÊNCIAS

Nenhuma versão foi atualizada — atualização é atividade separada, como pedido.

**Pontos de atenção (não tratados):**

1. **`react-is` com conflito de versão.** O frontend fixa `^19.2.6`; o recharts declara `react-is: ^18.3.1` nas próprias dependências. Provavelmente foi fixado à mão para resolver algum conflito. Mexer sem teste visual dos gráficos é arriscado — **deixei como está**.
2. **`lucide-react ^1.14.0`** — versão fora do padrão da biblioteca, e o histórico do projeto registra que ela já causou problema. Não tocar sem varrer os 133 arquivos que a importam.
3. **`mysql2` no backend** de um projeto PostgreSQL — 1 referência. Vale investigar se é integração legada com sistema externo.

---

## ETAPA 10 — TESTES

| Verificação | Antes | Depois | Resultado |
|---|---|---|---|
| Jest (backend) | 486 ✅ / 157 ⊘ / 643 | 486 ✅ / 157 ⊘ / 643 | **idêntico** |
| `nest build` | exit 0 | exit 0 | ✅ |
| `next build` (produto) | exit 0, 105 rotas | exit 0, 105 rotas, **mesmos hashes de chunk** | ✅ |
| `next build` (site) | exit 0 | exit 0 | ✅ |
| `docker compose config` | — | contexto único `./website` | ✅ |

Os hashes de chunk do frontend saíram **idênticos** aos da baseline (`7023-af8bd2652cdf9ef2.js`, `fd9d1056-…`) — prova objetiva de que nada de comportamental mudou.

Nenhum teste falhou; nenhum teste foi alterado, desabilitado ou removido.

**Ressalva honesta:** 3 suítes (157 testes) estão marcadas como *skipped* — são os testes de integração do People, que exigem banco ativo. Estavam skipped antes e continuam. **Não validei essas rotas em execução real**, e o histórico deste projeto mostra que build verde não prova funcionamento. Ver riscos.

---

## ETAPA 11 — ANTES × DEPOIS

| Métrica | Antes | Depois |
|---|---|---|
| Arquivos versionados | 1.002 | **981** |
| Arquivos removidos | — | 21 |
| Arquivos movidos (quarentena) | — | 3 |
| Arquivos criados | — | 1 (este relatório) |
| Dependências de produção (backend) | 33 | **32** |
| Dependências de produção (frontend) | 25 | **20** |
| Pacotes em `node_modules` (frontend) | — | **−31** |
| Grafias de diretório do site | 2 (`Website` + `website`) | **1** |

**Problemas corrigidos:** contexto de build quebrado em Linux · 21 arquivos mortos · 7 dependências sem uso · duplicata exata de vídeo · mídia órfã na imagem de produção.

**Problemas registrados e não corrigidos:** módulos gigantes (40) · páginas gigantes (`cadastros` 2.945 linhas) · duas convenções arquiteturais convivendo · documentação em três diretórios de raiz · `Orkiestri Core` com espaço no nome · `seed-demo2/3` mal nomeados · conflito de `react-is`.

---

## RISCOS EM ABERTO

1. **A correção do compose muda o comportamento em Linux.** Antes o build do site falhava ou reutilizava imagem antiga; agora vai construir de verdade a partir de `./website`. Isso é o certo, mas é **a primeira vez** que esse caminho será exercitado em servidor. **Verifique o `<title>` de `/` depois do primeiro deploy** — o site institucional é o que responde na raiz do domínio.

2. **Se algum ambiente tiver uma pasta `Website/` fisicamente no servidor**, ela virou órfã. Vale conferir e limpar manualmente.

3. **Nada disto foi validado em execução real.** Build e testes passam, mas este projeto tem histórico documentado de build verde com sistema quebrado. Antes de considerar concluído: subir os containers, **fazer um login de verdade até chegar ao dashboard**, e abrir uma tela de cada módulo tocado indiretamente (agenda, orçamento, frota, financeiro — as que usam import dinâmico).

4. **`_quarentena/` precisa de decisão.** Ou apaga, ou tira do versionamento. Não deixe indefinidamente.

---

## RECOMENDAÇÕES (não executadas, por risco)

**Prioridade alta**
1. Migrar `frota.module.ts` (2.455 linhas, 17 controllers) para o formato de `people/`. É o pior caso e o de maior retorno. Um módulo por vez, com testes antes.
2. Quebrar `cadastros/page.tsx` (2.945 linhas) usando o padrão `_components/` já adotado nos módulos novos.

**Prioridade média**
3. Consolidar documentação: `Orkiestri Core/`, `orkiestri-design-system/` e `docs/` na raiz. **Atenção:** há 19+ referências textuais cruzadas entre eles, e `website/src/config/*.ts` cita `orkiestri-design-system` como fonte da verdade. Consolidar exige atualizar todas — por isso não fiz.
4. Renomear `Orkiestri Core/` para `orkiestri-core/`: o espaço no nome quebra scripts shell e contextos Docker. Mesmo custo de referências acima.
5. Renomear `seed-demo2/3.js` para algo descritivo (`seed-demo-agenda.js`, `seed-demo-frota-clientes.js`).

**Prioridade baixa**
6. Habilitar os testes de integração do People em CI com banco efêmero — hoje 157 testes nunca rodam.
7. Adicionar ESLint ao backend e ao frontend do produto (só o `website/` tem).
8. `core.ignorecase = false` no git do projeto, para que colisões de caixa como a do `Website/` apareçam no dia em que forem criadas, e não meses depois em produção.

---

## REGRA DE OURO — COMO FOI APLICADA

Nenhuma funcionalidade foi reescrita. Nenhum teste foi alterado para "passar". Nenhum arquivo foi removido por ausência de referência estática apenas — cada remoção tem evidência independente, e a categoria 🟠 existe justamente porque **seis conjuntos de arquivos sem nenhuma referência estática estão vivos** e foram preservados.

Onde havia dúvida, quarentena. Onde havia risco de quebrar, recomendação em vez de execução.
