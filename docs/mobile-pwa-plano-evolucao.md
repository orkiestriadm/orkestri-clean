# Plano de Evolução do Orkiestri — Mobile, PWA e App Corporativo

> **Status:** Aguardando aprovação. **Nenhuma alteração será executada antes do "ok" explícito do owner do produto.** Após aprovação, qualquer entrega será publicada primeiro em **homologação** para validação humana antes de subir para produção.
>
> **Documento:** v1.0 — `docs/mobile-pwa-plano-evolucao.md`
> **Worktree de análise:** `zen-jepsen-3e18cf` (somente leitura nesta fase)
> **Data:** 2026-06-09
> **Autor:** Auditoria automatizada Claude + revisão humana pendente

---

## 0. Princípio inegociável: Desktop é intocável

A versão desktop do Orkiestri está em produção, aprovada e estável. Este plano respeita literalmente a regra:

| Garantia | Como é assegurada tecnicamente |
|---|---|
| Layouts desktop intactos | Toda regra mobile vive **dentro de `@media (max-width: 767px)`**. Nenhuma classe Tailwind base ou variável CSS existente será alterada. |
| Nenhum componente desktop refatorado | Componentes mobile **novos e separados** (`*.mobile.tsx`) renderizados via **renderização condicional** (`useIsMobile()` + SSR-safe). |
| Sidebar/Topbar desktop preservados | Já existe `.sidebar-desktop` vs `.sidebar-mobile` em `globals.css` linha 397-407 — vamos **aproveitar essa separação**, sem tocar na regra desktop. |
| Estilos globais preservados | Novos estilos mobile vivem em arquivo isolado `styles/mobile.css` importado **depois** do `globals.css`, com escopo `@media` ou classe `.mobile-only`. |
| Reversibilidade total | Cada incremento mobile é uma feature flag ou um arquivo separado. Remover o arquivo = voltar ao estado atual. |
| Validação em homologação | PR-by-PR, deploy em ambiente de staging antes de qualquer subida em produção. |

Se em algum momento uma melhoria mobile **exigir** alteração desktop, a regra é: **parar, documentar o risco, propor alternativa isolada — não implementar.**

---

## 1. Sumário executivo

### 1.1. Estado atual em uma linha
O Orkiestri tem **base mobile mínima** (sidebar hambúrguer, scroll horizontal em tabelas), **não é PWA** (sem manifest, sem viewport meta, sem cache offline) e tem **34 páginas com grids fixos** que comprimem ou estouram em tela pequena.

### 1.2. O que precisa ser feito (visão de 30 mil pés)

| Fase | Entrega | Esforço | Risco desktop |
|---|---|---|---|
| **F0 – Fundação técnica** | Viewport meta + manifest + ícones + hook `useIsMobile()` + arquivo `mobile.css` isolado | 0,5 sem | Zero |
| **F1 – Responsividade segura** | Corrigir 34 páginas com renderização condicional para mobile (Topbar, Sidebar já estão prontos) | 3-4 sem | Zero (componentes paralelos) |
| **F2 – PWA completo** | SW de cache, splash, instalação Android/iOS, offline parcial | 1-2 sem | Zero |
| **F3 – Orkiestri Mobile (rotas `/m/*`)** | Dashboard executivo, notificações, command center, equipes, aprovações, IA conversacional — todos em telas dedicadas | 5-7 sem | Zero (rotas novas) |
| **F4 – Arquitetura futura** | Decisão PWA-first → eventual React Native opcional | continuado | — |

**Total estimado para mobile production-ready:** **9 a 13 semanas** com 1 dev full-time, ou **5 a 7 semanas** com 2 devs.

### 1.3. Recomendação técnica
**PWA-first.** Justificativa detalhada na Fase 5. Resumo: 80% do valor com 20% do custo, sem manter dois codebases. React Native fica como **opção futura** se aparecer demanda real por features nativas (câmera/biometria/geofencing).

---

## 2. Fase 1 — Auditoria técnica

### 2.1. Stack e arquitetura atual

| Camada | Tecnologia | Versão | Observação |
|---|---|---|---|
| Framework | Next.js (App Router) | 14.2.0 | `output: 'standalone'` (Docker-friendly) |
| UI runtime | React | 18.3 | — |
| Styling | Tailwind CSS | 3.4 | Tokens shadcn-style em `globals.css` |
| Componentes | Radix Slot + Lucide + Recharts + Framer Motion | — | Sem shadcn instalado completo, mas com base |
| State | Zustand | 4.5 | Auth, toast |
| Backend | NestJS + Prisma + Postgres | — | Multi-tenant (memória do projeto) |
| Deploy | Docker + nginx | — | Frontend = Next standalone |

### 2.2. Inventário de superfícies

**Páginas (rotas `/dashboard/*`):** 38 módulos
```
agenda, apontamentos, aprovacoes, ativos, automacoes, billing, cadastros,
capacity, catalogo, chamados, clientes, cmdb, configuracoes, conhecimento,
contratos, csat, executivo, faturas, gantt, historico, ia, keep, orcamento,
perfil, processos, projetos, relatorios, superadmin, whatsapp-config, workforce
```

**Componentes de layout:** 2 (`Sidebar.tsx`, `Topbar.tsx`) — bem coesos.

**Componentes UI compartilhados:** 19 em `components/ui/`
- Modais grandes: `EventModalAgenda`, `TaskDetailModal`, `CsvImportModal`, `FocusMode`, `AlertConfigPage`
- Widgets: `NotificationBell`, `PasswordRequests`, `UserStatus`, `ThemeToggle`
- Configurações: `SegurancaConfig`, `SistemaConfig`, `WhatsAppSettings`, `WhatsAppUserConfig`
- Utilitários: `CommandPalette`, `AlertBanner`, `MemberSelector`, `ToastContainer`, `TaskComments`, `Logo`, `Button`

**Componentes agenda:** isolados em `components/agenda/` (já há `MiniCalendar` etc.)

**Layouts compartilhados:**
- `src/app/layout.tsx` — root, ThemeProvider + anti-FOUC dark mode
- `src/app/dashboard/layout.tsx` — auth + Sidebar + main area
- `src/app/portal/...`, `src/app/kb/...`, `src/app/entenda-orkiestri/...` — landing/portais

### 2.3. Breakpoints atuais

| Onde | Breakpoint | Comportamento |
|---|---|---|
| `globals.css` linha 340 | `max-width: 768px` | Ativa `.mobile-menu-btn` (hambúrguer) |
| `globals.css` linha 397 | `max-width: 768px` | Esconde sidebar desktop, ativa sidebar mobile overlay 280px |
| `globals.css` linha 408 | `769-1024px` | Reduz sidebar para 220px |
| Tailwind default | `sm:640 md:768 lg:1024 xl:1280 2xl:1400` | Usado pontualmente (`hidden sm:flex`) |

**Conclusão:** existe uma base de mobile, mas é **rasa** — só trata o chrome (sidebar + topbar). Conteúdo das páginas não foi pensado para mobile.

### 2.4. Diagnóstico de responsividade — Problemas encontrados

#### CRÍTICO

| # | Problema | Arquivo | Impacto |
|---|---|---|---|
| **C1** | **Falta `<meta name="viewport">`** | `src/app/layout.tsx` linha 13-16 | iOS renderiza a página em 980px e mostra **zoom out**. Touch targets ficam minúsculos. **Bloqueia qualquer experiência mobile decente.** |
| **C2** | **Sem `manifest.json`** | `public/` | Impossível instalar como PWA. Sem ícone na home screen, sem splash screen, sem `display: standalone`. |
| **C3** | **Sem ícones PWA** (192px, 512px, maskable, apple-touch-icon) | `public/` | SW.js já referencia `/icon-192.png` (linha 21), mas o arquivo **não existe**. Notificações sem ícone. |
| **C4** | **Service Worker minimalista — sem cache, sem offline** | `public/sw.js` (39 linhas, só faz `setTimeout` para notificação local) | Não há estratégia de cache, network-first, fallback offline. Reload em offline = página em branco. |

#### ALTO

| # | Problema | Onde | Impacto |
|---|---|---|---|
| **A1** | **Grids inline com colunas fixas** `repeat(N,1fr)` com N=3..7 | 30+ ocorrências em 18 páginas (ver lista §2.5) | Em telas <600px, colunas viram fatias ilegíveis ou estouram. Ex: `clientes/page.tsx:399` usa `repeat(6,1fr)` com `overflowX: auto` — usuário precisa scrollar lateralmente para ler KPIs. |
| **A2** | **Topbar repetido em 34 páginas** com elementos `hidden sm:flex` (busca, divisor, data) | Cada `dashboard/*/page.tsx` importa `Topbar` | Mobile já esconde alguns elementos, mas título+descrição podem cortar e os botões `btn-icon` ficam apertados (NotificationBell + ThemeToggle + Focus + PasswordRequests = 4 botões em 36px = 144px competindo com o título). |
| **A3** | **Modais com largura fixa** (NotificationBell 360px, FocusMode 360px+padding 40px, modal-box 520px) | `components/ui/` | Em iPhone SE (320px), NotificationBell vaza 40px à direita e FocusMode estoura completamente. |
| **A4** | **Tabelas com scroll horizontal** (27 arquivos com `overflow-x: auto`) | Páginas de cadastros, chamados, ativos, etc. | UX ruim no mobile: scroll bidimensional, contexto se perde. Funciona, mas não é "moderno". |
| **A5** | **Sidebar mobile usa `<Sidebar>` desktop completo** | `dashboard/layout.tsx:77` | Os mesmos 38 itens em coluna 280px com nested accordions — denso, fonte 13px, alvos de toque ~32px (Apple recomenda ≥44px). |

#### MÉDIO

| # | Problema | Onde | Impacto |
|---|---|---|---|
| **M1** | Padding `px-6` no Topbar e `px-5` no banner impersonation | `Topbar.tsx:72`, linha 63 | Desperdiça largura no mobile (recomendado 12-16px). |
| **M2** | Botão "Buscar" ⌘K esconde em `sm:flex` mas não há substituto mobile | `Topbar.tsx:86` | Mobile perde acesso ao Command Palette. |
| **M3** | Inputs `.input-o` com `padding: 10px 14px` e `font-size: 13px` | `globals.css:251` | Em iOS, fonte <16px causa **zoom automático ao focar** — bug clássico mobile. |
| **M4** | `100dvh` em `.app-shell` e `.sidebar` | `globals.css:184, 192` | Bom (já trata barra dinâmica iOS), mas precisa testar com teclado virtual aberto. |
| **M5** | `backdrop-filter: blur(24px)` em `.glass` e `bg-primary/80` | `globals.css:217`, `Topbar.tsx:72` | Cara em mobile. Já está em uso no desktop — manter no mobile pode ser aceitável, mas avaliar performance em Android mid-tier. |
| **M6** | Modais com `padding: 24px` no overlay | `globals.css:368` | Em mobile já reduz para `padding: 20px` (linha 402), mas modal `max-width: 520px` ainda força scroll vertical em modais grandes. |

#### BAIXO

| # | Problema | Onde | Impacto |
|---|---|---|---|
| **B1** | Scrollbars 6px customizados | `globals.css:171` | Bom no desktop. iOS ignora. Sem impacto. |
| **B2** | Animações Framer Motion sem `prefers-reduced-motion` | Globais | Acessibilidade — não bloqueante. |
| **B3** | `useNotifications` registra SW mas não pede permissão proativamente | `lib/useNotifications.ts:21` | Pequeno — depende do fluxo. |

### 2.5. Grids inline críticos (snapshot)

Lista exemplificativa das colunas fixas mais problemáticas em mobile (todas devem ser convertidas via media query em mobile-only, **sem alterar a linha desktop**):

```
agenda/page.tsx        →  repeat(7,1fr) — calendário semanal/mensal (precisa view alt mobile)
clientes/page.tsx:399  →  repeat(6,1fr) + overflowX auto — KPIs
clientes/page.tsx:682  →  repeat(4,1fr) — métricas
capacity/page.tsx      →  repeat(4,1fr), repeat(7,1fr) — heatmap
ativos/monitoramento   →  repeat(4,1fr), repeat(5,1fr) — KPIs
superadmin/page.tsx    →  repeat(5,1fr) — KPIs admin
cadastros/page.tsx     →  repeat(3,1fr) x5, repeat(4,1fr) — formulários
automacoes/page.tsx    →  repeat(3,1fr) — botões
```

Já estão OK (`auto-fill minmax(...)` adapta sozinho):

```
ativos/page.tsx        →  minmax(260px,1fr)  ✓
conhecimento/page.tsx  →  minmax(280px,1fr)  ✓
ativos/monitoramento   →  minmax(280px,1fr)  ✓
historico/page.tsx     →  minmax(140px,1fr)  ✓
cadastros/page.tsx:690 →  minmax(240px,1fr)  ✓
clientes/page.tsx:792  →  minmax(280px,1fr)  ✓
```

### 2.6. Backend — base já existente para mobile/notificações

✓ **Bom:** o backend já tem o que precisamos para a maior parte do mobile:
- `notifications/notifications.module.ts` — sistema de notificações
- `notifications/alert.scheduler.ts` — alertas agendados
- `notifications/whatsapp.service.ts` — canal WhatsApp
- `notifications/email.service.ts` — canal email
- Auth JWT (memória do projeto) → cookie HttpOnly funciona em PWA
- API REST em `/api/*` consumida via axios → reusável

✗ **Faltam para mobile pleno:**
- **Web Push (VAPID)** — atualmente notificações são só locais (Notification API). Para receber alertas com app fechado, precisamos:
  - Gerar par de chaves VAPID
  - Endpoint `POST /api/push/subscribe` (salvar `endpoint + keys` do usuário)
  - Endpoint `POST /api/push/send` (broadcast)
  - Lib `web-push` no NestJS
- **Endpoints agregados para o "Command Center Mobile"** — uma chamada que devolve `{ status, alertas, projetosRisco, slaViolados, gargalos }` em vez de 6 chamadas separadas
- **Endpoint da IA** — `/api/ia/chat` recebendo `{ pergunta, contextoUsuario }` e devolvendo `{ resposta, dadosCitados }`. **Hoje não existe** (frontend tem `/dashboard/ia` mas sem backend dedicado)

---

## 3. Fase 2 — Plano de responsividade segura

### 3.1. Princípio de isolamento (revisão técnica)

Toda regra mobile deve ser **detectável**, **revertível** e **invisível ao desktop**. Três técnicas combinadas:

**Técnica A — Media query mobile-only**
```css
/* mobile.css (NOVO arquivo, importado depois de globals.css) */
@media (max-width: 767px) {
  .mobile-card-stack { display: flex !important; flex-direction: column; }
}
```
Desktop ignora 100% das regras (`max-width: 767px` é falso ≥768px). Linha existente do desktop nunca toca.

**Técnica B — Renderização condicional via hook**
```tsx
// lib/useIsMobile.ts (NOVO)
"use client";
import { useEffect, useState } from "react";
export function useIsMobile() {
  const [m, setM] = useState(false);  // SSR-safe: desktop por padrão
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setM(mq.matches);
    const cb = (e: MediaQueryListEvent) => setM(e.matches);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  }, []);
  return m;
}

// uso em página existente:
export default function Page() {
  const isMobile = useIsMobile();
  if (isMobile) return <PageMobile />;   // componente NOVO, paralelo
  return <PageDesktop />;                 // ⚠ código desktop existente, ZERO alteração
}
```

Sob SSR, `isMobile` é `false` → desktop renderiza igual. No client, hydration troca para mobile se aplicável.

**Técnica C — Wrapper `<MobileOnly>` / `<DesktopOnly>`**
```tsx
// components/responsive/Responsive.tsx (NOVO)
export const MobileOnly = ({ children }: { children: React.ReactNode }) => (
  <div className="mobile-only">{children}</div>
);
export const DesktopOnly = ({ children }: { children: React.ReactNode }) => (
  <div className="desktop-only">{children}</div>
);

// mobile.css
.mobile-only { display: none; }
@media (max-width: 767px) {
  .mobile-only { display: block; }
  .desktop-only { display: none !important; }
}
```

### 3.2. Onde aplicar cada técnica

| Caso | Técnica recomendada | Razão |
|---|---|---|
| Página inteira tem layout fundamentalmente diferente em mobile (ex: Agenda calendário → lista vertical) | **B (renderização condicional)** | Mantém código desktop puro |
| Página tem mesmo conteúdo, só precisa empilhar | **A (media query)** | Mais leve, sem duplicação |
| Pequena variação (esconder data, mostrar botão alternativo) | **C (wrapper)** | Pontual, sem refactor |

### 3.3. Itens a entregar — F0 + F1

#### F0 — Fundação técnica (0,5 semana) **PRÉ-REQUISITO**

| # | Item | Arquivo | Risco desktop |
|---|---|---|---|
| F0.1 | Adicionar `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` | `src/app/layout.tsx` `<head>` | **Crítico avaliar** — adicionar viewport pode mudar como o desktop é interpretado em telas <1024px (ex: tablet). **Mitigação:** o tag é universal e Next.js já espera ele; não há mudança visível em desktop ≥1024px. Validar em homologação com QA desktop completo. |
| F0.2 | Criar `src/styles/mobile.css` (vazio inicial) e importar após `globals.css` | `src/app/layout.tsx` | Zero — arquivo vazio |
| F0.3 | Criar `src/lib/useIsMobile.ts` | novo | Zero — não é usado ainda |
| F0.4 | Criar `src/components/responsive/{MobileOnly,DesktopOnly}.tsx` | novo | Zero |
| F0.5 | Criar `public/manifest.json`, `icon-192.png`, `icon-512.png`, `icon-maskable.png`, `apple-touch-icon.png` | novo | Zero |
| F0.6 | Linkar manifest no `<head>` | `src/app/layout.tsx` | Zero (apenas tags `<link>` e `<meta>` adicionais) |

#### F1 — Responsividade segura por página (3-4 semanas)

Ordem de prioridade (mais usado / mais quebrado primeiro):

| Sprint | Páginas | Esforço |
|---|---|---|
| S1 | `dashboard/page.tsx` (Visão Geral), `executivo`, `chamados` | 1 sem |
| S2 | `aprovacoes`, `projetos`, `agenda` | 1 sem |
| S3 | `clientes`, `contratos`, `faturas`, `ativos`, `cadastros` | 1 sem |
| S4 | Restante (configurações, históricos, IA, etc.) + modais | 1 sem |

**Para cada página o trabalho é:**

1. Criar `PageMobile.tsx` ao lado da `page.tsx` existente
2. Mover lógica de dados para hook reutilizável (`usePageData()`) — sem alterar a tela desktop, só **extração**
3. Implementar a versão mobile (cards empilhados, listas em vez de tabelas, accordions)
4. Trocar em `page.tsx`:
   ```tsx
   const isMobile = useIsMobile();
   if (isMobile) return <PageMobile />;
   /* daqui pra baixo: código desktop ORIGINAL, intocado */
   ```

**Modal-by-modal:** mesma técnica — `EventModalAgendaMobile.tsx`, etc., com bottom-sheet em vez de modal centralizado.

**Sidebar mobile dedicada:** novo `SidebarMobile.tsx` com:
- Apenas grupos top-level (sem accordion duplo)
- Alvos de toque ≥48px
- Favoritos em destaque
- Logout + perfil em rodapé fixo

### 3.4. Riscos identificados na Fase 2 e mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| `<meta viewport>` mudar renderização em tablet/laptop pequeno | Baixa | QA visual em 1024×768, 1280×800, 1440×900 antes do merge |
| Hook `useIsMobile` causar flicker (SSR=false, client=true) | Média | Default desktop no SSR + transição suave; aceita-se flash discreto (alternativa: cookie `viewport-hint` setado pelo nginx por User-Agent) |
| Aumento de bundle (dois componentes por página) | Média | Dynamic import: `const PageMobile = dynamic(() => import("./PageMobile"))` — só baixa quando `isMobile === true` |
| Duplicação de manutenção (mudar feature em dois lugares) | Alta — assumido | Extrair toda lógica de dados em hooks; UI mobile e desktop consomem o mesmo hook. Manutenção fica em camadas: dados (1×) + UI (2×). |

---

## 4. Fase 3 — Transformação em PWA

### 4.1. Componentes do PWA

| Item | Onde | Status atual | Ação |
|---|---|---|---|
| `manifest.json` | `public/manifest.json` | **Inexistente** | Criar (template abaixo) |
| Viewport meta | `<head>` | **Inexistente** | Adicionar (F0.1) |
| Ícones 192, 512, maskable, apple-touch | `public/` | **Inexistentes** | Gerar a partir do `logo-orkiestri-dark.png` |
| Splash screens iOS (vários tamanhos) | `public/splash/` | **Inexistente** | Gerar via `pwa-asset-generator` |
| Service Worker (cache + offline) | `public/sw.js` | Existe mas só notifica | Reescrever (preservando notificação atual) |
| Registro do SW | `useNotifications.ts:21` | OK | Manter, talvez mover para `RootProvider` |
| `theme-color` (status bar) | `<head>` | **Inexistente** | `<meta name="theme-color" content="#0f0f12">` |
| iOS PWA tags | `<head>` | **Inexistentes** | `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, etc. |
| Banner de instalação Android | client-side | **Inexistente** | Componente `<InstallPrompt />` ouvindo `beforeinstallprompt` |
| Instrução de instalação iOS | client-side | **Inexistente** | Componente `<IOSInstallHint />` (iOS não tem prompt automático) |
| Web Push (notificações com app fechado) | backend + frontend | **Inexistente** | Implementar VAPID + `web-push` (back) + `pushManager.subscribe()` (front) |

### 4.2. `manifest.json` proposto

```json
{
  "name": "Orkiestri",
  "short_name": "Orkiestri",
  "description": "Sistema de Organização de Demandas",
  "lang": "pt-BR",
  "start_url": "/dashboard?source=pwa",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#09090b",
  "theme_color": "#0f0f12",
  "categories": ["productivity", "business"],
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    { "name": "Aprovações pendentes", "url": "/m/aprovacoes", "icons": [{ "src": "/icon-192.png", "sizes": "192x192" }] },
    { "name": "Command Center", "url": "/m/command-center", "icons": [{ "src": "/icon-192.png", "sizes": "192x192" }] },
    { "name": "IA Orkiestri", "url": "/m/ia", "icons": [{ "src": "/icon-192.png", "sizes": "192x192" }] }
  ],
  "screenshots": [
    { "src": "/screenshots/mobile-dashboard.png", "sizes": "390x844", "type": "image/png", "form_factor": "narrow" },
    { "src": "/screenshots/desktop-dashboard.png", "sizes": "1280x800", "type": "image/png", "form_factor": "wide" }
  ]
}
```

### 4.3. Service Worker — estratégia de cache

Reescrever `public/sw.js` preservando o handler de notificação atual. Estratégia híbrida:

| Tipo de requisição | Estratégia | Justificativa |
|---|---|---|
| HTML (navegação) | **Network-first** com fallback `/offline.html` | Sempre tenta servidor; se cair, mostra página offline amigável |
| `_next/static/*` (JS/CSS hashed) | **Cache-first** indefinido | Imutáveis pelo hash; cache para sempre |
| `/api/*` (GET) | **Stale-while-revalidate** com TTL 60s | Mostra cache instantâneo, busca atualização em paralelo |
| `/api/*` (POST/PUT/DELETE) | **Network-only** | Mutações não podem ser servidas do cache |
| Imagens (`/icon-*`, logos) | **Cache-first** com TTL 30 dias | Raramente mudam |
| Fonts (Google Fonts) | **Cache-first** indefinido | Imutáveis |

Implementação com **Workbox** (`workbox-webpack-plugin` ou `next-pwa`) para reduzir boilerplate. Avaliar `@ducanh2912/next-pwa` (manutenção ativa).

### 4.4. Funcionamento offline — Mapeamento por módulo

| Módulo | Cabe offline? | Como |
|---|---|---|
| **Visão Geral / Executivo** | ✅ Leitura | Cache stale-while-revalidate dos endpoints de stats. Mostra "Atualizado há Xmin" se offline. |
| **Aprovações** (lista) | ✅ Leitura | Cache da lista. Ação de aprovar enfileira via **Background Sync API** e dispara quando voltar online. |
| **Notificações** (histórico) | ✅ Leitura | Cache. Novas notificações continuam chegando via Push Server-side. |
| **Agenda** | ✅ Leitura próximo 7 dias | Cache do range visível. Edição offline = enfileirada. |
| **Keep** (notas) | ✅ Leitura + edição local | Usa IndexedDB; sync ao voltar online (estrutura existente já é simples). |
| **Chamados** | ⚠️ Leitura | Lista cacheada. **Criar chamado offline:** enfileirar (Background Sync) — só implementar se houver demanda. |
| **IA Orkiestri** | ❌ | LLM exige rede. Mostrar estado offline claro. |
| **Command Center / tempo real** | ❌ | Por definição precisa de rede. Mostrar última atualização + indicador "offline". |
| **Cadastros / Configurações / Relatórios / Faturas / Contratos / Ativos / CMDB / Gantt / Processos / Workforce / Capacity** | ❌ desktop-only intencional | Mobile não vai oferecer essas telas no F3. PWA simplesmente redireciona para o desktop com aviso. |

### 4.5. Instalação Android × iOS

| Plataforma | UX de instalação | O que implementar |
|---|---|---|
| **Android (Chrome/Edge)** | Banner automático após critérios (visited 2x em 5min, manifest válido, SW ativo, HTTPS) | `<InstallPrompt />` ouvindo `beforeinstallprompt`, mostrando CTA custom "Instalar Orkiestri". |
| **iOS (Safari)** | **Sem prompt automático.** Usuário precisa: Compartilhar → "Adicionar à Tela de Início" | `<IOSInstallHint />` detecta `navigator.userAgent` iOS + não-standalone, mostra modal explicativo com screenshot. |
| **Desktop (Chrome)** | Ícone na barra de URL | Mantém sem alteração. |

---

## 5. Fase 4 — Conceito Orkiestri Mobile

### 5.1. Princípio do app mobile

> **Não é um clone do desktop.** É uma **camada de comando e acompanhamento** para gestores em movimento.

Rotas mobile vivem em `/m/*` (paralelas a `/dashboard/*`). O hook `useIsMobile` em `/dashboard/*` pode redirecionar automaticamente para `/m/*` se o usuário preferir (toggle em configurações).

### 5.2. Mapa de telas

```
/m/                      → Home / Dashboard Executivo
/m/notificacoes          → Central de Notificações
/m/command-center        → Status operacional em tempo real
/m/equipes               → Lista de equipes + tarefas
/m/equipes/[id]          → Detalhe de equipe
/m/aprovacoes            → Lista de aprovações pendentes
/m/aprovacoes/[id]       → Detalhe + aprovar/rejeitar
/m/ia                    → Chat conversacional
/m/perfil                → Perfil + status + logout
```

**Navegação:** bottom tab bar com 5 ícones (Home, Notif, Command, Aprov, IA). Perfil acessível pelo cabeçalho.

### 5.3. Especificação dos módulos mobile

#### 5.3.1. Dashboard Executivo (`/m/`)

**Layout:** scroll vertical, sem grids horizontais.

- **Bloco 1 — Status pill** colorido: "OPERACIONAL" / "ATENÇÃO" / "CRÍTICO" (mesma lógica de `dashboard/page.tsx` `systemStatus()`)
- **Bloco 2 — Cards KPI empilhados** (1 coluna):
  - Chamados abertos / urgentes / SLA violados
  - Projetos ativos / críticos
  - Aprovações aguardando sua decisão
  - Garantias vencidas / contratos vencendo
- **Bloco 3 — Mini-charts** (Recharts AreaChart) ocupando largura total: chamados por dia (7d)
- **Bloco 4 — Atividades recentes** (lista compacta tap-to-detail)

**Reutiliza:** lógica de `computeAlerts()` + `systemStatus()` extraídas em hook `useDashboardAlerts()`.

#### 5.3.2. Central de Notificações (`/m/notificacoes`)

**Layout:** lista cronológica, agrupada por dia.

- Cada item: ícone tipo + título + corpo + timestamp + ação rápida (botão direito de swipe)
- **Filtros chips no topo:** Tudo · Incidentes · Aprovações · Vencimentos · Chamados
- **Pull-to-refresh** nativo
- **Push em tempo real** via WebSocket OU polling 30s (a definir conforme backend)
- **Ação rápida por tipo:**
  - Aprovação → "Aprovar" / "Rejeitar" inline (modal de confirmação)
  - Chamado crítico → "Abrir" (navega para detalhe simplificado)
  - SLA violado → "Ver no Command Center"

**Reutiliza:** endpoint `/api/notifications` existente + `notifications.module.ts` no backend.

#### 5.3.3. Command Center Mobile (`/m/command-center`)

**Visão:** estado operacional em uma tela rolável.

- **Topo:** indicador grande (semáforo) — Operacional / Atenção / Crítico
- **Seção "Alertas críticos":** lista vermelha (SLA violado, urgentes em aberto, recursos zerados)
- **Seção "Times em risco":** time + métrica do problema (ex: "Suporte L2 — 4 chamados em atraso, capacidade 95%")
- **Seção "Projetos em risco":** projeto + dias de atraso + responsável
- **Seção "Gargalos operacionais":** ex: "Tarefas bloqueadas há +5d", "Aprovações engasgadas em João Silva (12 pendentes há 3d)"

**Backend:** **endpoint novo** `GET /api/command-center/snapshot` consolidando os dados (evita 6 requests). Atualização a cada 30s (visible) / 5min (background).

#### 5.3.4. Gestão de Equipes (`/m/equipes`)

- Lista de equipes (cards) → toque abre detalhe
- Detalhe da equipe (`/m/equipes/[id]`):
  - Cabeçalho: nome, responsável, headcount
  - **KPIs:** chamados ativos, tarefas em andamento, taxa de entrega, SLA
  - **Lista de tarefas em andamento** com responsável e prazo
  - **Membros** com status atual (online/foco/ausente — usa `UserStatus` existente)
  - **Ações:** ⊕ Atribuir tarefa, ↻ Marcar como concluída (swipe)

#### 5.3.5. Aprovações (`/m/aprovacoes`)

**Lista:** cada aprovação como card grande:
- Ícone do tipo (despesa/horas/viagem/etc.)
- Solicitante + valor + prazo
- **Botões grandes** "✓ Aprovar" e "✗ Rejeitar" (alvo ≥48px)

**Detalhe (`/m/aprovacoes/[id]`):**
- Payload completo
- Histórico de aprovações (timeline)
- Botões aprovar/rejeitar com sheet de confirmação ("Tem certeza?" + campo opcional de observação)

**Reutiliza:** lógica e configs (`TIPOS`, `STATUS_CFG`) de `dashboard/aprovacoes/page.tsx`. Backend não precisa mudar.

#### 5.3.6. Assistente IA Orkiestri (`/m/ia`)

**UI:** chat full-screen estilo ChatGPT mobile.
- Cabeçalho: "IA Orkiestri" + status do modelo
- Mensagens em bolhas (user direita, assistente esquerda)
- Citações de dados como cards expandíveis ("Fonte: 4 chamados em projeto X, atualizado há 2min")
- Input no rodapé com sugestões rápidas (chips):
  - "Quais projetos estão em risco?"
  - "Mostre os incidentes críticos"
  - "Qual equipe tem mais atraso?"
  - "SLA por setor neste mês"

**Backend (NOVO):**
```
POST /api/ia/chat
Body: { mensagem: string, conversaId?: string }
Response (streaming SSE): { delta: string } ... { fontes: [...], conversaId: string }
```

**Implementação backend (proposta):**
- Módulo `ai` em `backend/src/modules/ai/`
- Tool-calling: a IA chama funções tipadas (`buscarProjetos`, `buscarChamados`, `buscarSlaPorSetor`, etc.) que executam queries Prisma scoped por `organizationId`
- Provider configurável: Claude API (recomendado — ver memória) ou OpenAI
- Cache de respostas frequentes (5min)
- Limite por org (rate limit + quota)

**Custo estimado:** ~$5-20/mês por org ativa, depende do volume. Cobrar como add-on no plano.

### 5.4. Princípios de UX mobile a respeitar

| Princípio | Implementação |
|---|---|
| Touch targets ≥44×44pt (Apple) / 48dp (Material) | Botões mínimo `h-12 px-4` |
| Fonte mínima 16px em inputs | Evita zoom iOS. Override em `mobile.css` para `.input-o` em mobile |
| Bottom sheet > modal centralizado | `<MobileSheet>` componente com swipe-to-dismiss |
| Pull-to-refresh em listas | Lib leve (`react-pull-to-refresh` ou custom 50 linhas) |
| Skeleton durante load | Reusar `.skeleton` de globals.css ✓ |
| Safe-area (notch iPhone) | `padding: env(safe-area-inset-top)` no header mobile |
| Gesto de voltar | Botão grande no header esquerdo + `swipe-back` nativo no iOS (via PWA `standalone`) |
| Modo escuro | Já existe (toggle por dispositivo) — mobile herda |

---

## 6. Fase 5 — Arquitetura futura: comparação

### 6.1. Opções avaliadas

| Critério | **Opção 1: PWA** | **Opção 2: React Native** | **Opção 3: Nativo (Swift + Kotlin)** |
|---|---|---|---|
| **Codebase** | Único (compartilha 90% com web) | Compartilhado lógica, UI separada | Dois codebases (iOS + Android) |
| **Time-to-market** | 9-13 semanas | 16-24 semanas | 32-48 semanas |
| **Custo inicial** | R$ 80k-130k (1 dev x ~3 meses) | R$ 200k-300k | R$ 500k+ |
| **Custo de manutenção/ano** | R$ 50k | R$ 120k | R$ 250k+ |
| **Reuso de código existente** | ~95% (Next.js, Tailwind, hooks) | ~40% (lógica TS, mas UI 0%) | 0% |
| **Acesso a câmera, GPS, biometria, NFC** | Limitado (camera/GPS sim, biometria/NFC parcial) | Completo via libs | Completo nativo |
| **Push notifications** | Sim (Web Push VAPID) — sem entregar app fechado em iOS<16.4 | Sim (FCM/APNs) | Sim |
| **Instalação** | Add to home screen (sem App Store) | App Store + Play Store | App Store + Play Store |
| **Aprovação em store** | N/A | Sim (semanas, revisões) | Sim |
| **Performance UI** | Boa (60fps em mid-tier) | Excelente (~native) | Nativa |
| **Onboarding de devs** | Trivial (já são devs Next.js) | Curva (RN + native modules) | Alta (Swift + Kotlin + 2 IDEs) |
| **Atualizações** | Imediata (deploy web) | OTA via CodePush (parcial) ou store | Apenas via store |
| **Distribuição corporativa (MDM)** | Sim (via configuração) | Sim | Sim |
| **Offline robusto** | Bom (SW + IndexedDB) | Excelente | Excelente |
| **Risco para o desktop** | Zero | Zero (codebase separado) | Zero |

### 6.2. Recomendação técnica fundamentada

**PWA-first** — implementar todas as fases F0→F4 deste plano como PWA. Razões:

1. **80% do valor com 20% do custo.** O escopo descrito (Dashboard Executivo, Notificações, Command Center, Equipes, Aprovações, IA) é **leitura + decisões simples** — não exige nada que PWA não dê.
2. **Aproveita todo o investimento atual.** Next.js, Tailwind, Zustand, axios, componentes — tudo é reusável.
3. **Sem aprovação de loja.** Update em produção = `git push`. Fix de bug crítico em 15 minutos, não 3 dias esperando review da Apple.
4. **Distribuição via WhatsApp / link.** Onboarding corporativo = "abra esse link no Chrome, toque em instalar". Sem App Store account, sem certificados Apple Developer ($99/ano), sem Play Console ($25 setup).
5. **Migração para React Native fica viável depois.** Se em 6 meses houver demanda por biometria ou geofencing, RN compartilha boa parte da lógica TS que já foi escrita.

**Quando reconsiderar React Native:**
- Necessidade de biometria (Touch ID / Face ID) para login
- Necessidade de câmera para anexar fotos em chamados
- Necessidade de GPS contínuo (rastreamento de equipe em campo)
- Volume de instalações justificar presença em loja (>5.000 usuários ativos)
- Cliente corporativo exigir publicação em loja (compliance)

**Nunca recomendar nativo (Swift+Kotlin)** para este caso de uso. Custo 4-5× sem benefício correspondente. Reservado para apps com UX hiper-otimizada (jogos, edição de mídia, AR/VR).

### 6.3. Plano de evolução arquitetural recomendado

```
HOJE         → Next.js web responsivo (parcial)
F0-F4 (3m)   → PWA completo + Orkiestri Mobile (rotas /m/*)
+ 6 meses    → Reavaliar: se >2.000 PWAs instaladas, considerar React Native
+ 12 meses   → Se decidir RN: módulos compartilhados via npm interno
+ 24 meses   → Possível app nativo apenas para verticais específicas
```

---

## 7. Roadmap consolidado

```
┌─────────────────────────────────────────────────────────────────────┐
│ F0 — FUNDAÇÃO (Sem 1)             ████░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│   • viewport, manifest, ícones, useIsMobile, mobile.css            │
├─────────────────────────────────────────────────────────────────────┤
│ F1 — RESPONSIVIDADE (Sem 2-5)     ░░░░████████████████░░░░░░░░░░  │
│   S1: Visão Geral, Executivo, Chamados                             │
│   S2: Aprovações, Projetos, Agenda                                 │
│   S3: Clientes, Contratos, Faturas, Ativos, Cadastros              │
│   S4: Configurações, Históricos, Modais                            │
├─────────────────────────────────────────────────────────────────────┤
│ F2 — PWA (Sem 6-7)                ░░░░░░░░░░░░░░░░░░░░████████░░  │
│   • SW de cache, splash, install prompts, Web Push (VAPID)         │
├─────────────────────────────────────────────────────────────────────┤
│ F3 — ORKIESTRI MOBILE (Sem 6-12)  ░░░░░░░░░░░░░░░░░░░░░░████████  │
│   S5-6: Dashboard Executivo Mobile, Notificações                   │
│   S7-8: Command Center Mobile, Equipes                             │
│   S9-10: Aprovações Mobile, IA Orkiestri (back + front)            │
│   S11-12: Polish, testes em dispositivos reais, beta interno       │
├─────────────────────────────────────────────────────────────────────┤
│ HOMOLOGAÇÃO + UAT (Sem 13)        ░░░░░░░░░░░░░░░░░░░░░░░░░░░██   │
│ PRODUÇÃO faseada (Sem 14)         ░░░░░░░░░░░░░░░░░░░░░░░░░░░░██  │
└─────────────────────────────────────────────────────────────────────┘
```

**Total: 13-14 semanas com 1 dev full-time.** Com 2 devs paralelizando F1 e F3, **8-9 semanas**.

### 7.1. Pré-requisitos de cada fase

| Fase | Requer aprovação para iniciar | Subir produção após |
|---|---|---|
| F0 | ✅ Aprovação deste documento | Apenas após QA visual desktop em 5 viewports |
| F1 | F0 mergeado em homologação | Sprint-by-sprint, cada um com tag específica |
| F2 | F0 + F1 sprint 1 mínimo | Após teste em iPhone + Android real |
| F3 | F2 mergeado | Beta com 5-10 usuários internos antes de geral |

### 7.2. Critérios de aceitação (DoD)

Cada PR mobile deve cumprir:

1. **Print desktop antes/depois** mostrando zero diferença visual
2. **Print mobile** mostrando o novo comportamento em iPhone SE (320px), iPhone 14 (390px), Pixel 7 (412px)
3. **Lighthouse Mobile ≥85** para Performance + ≥95 PWA (após F2)
4. **Build sem warnings**
5. **Teste manual** em dispositivo real ou DevTools mobile emulado
6. **Sem alteração de `globals.css` linhas 1-396** (apenas adições no fim ou em `mobile.css`)

---

## 8. Estimativa de esforço por entrega

| Entrega | Horas | Dias úteis |
|---|---|---|
| F0.1 - F0.6 (fundação) | 16-24h | 2-3d |
| F1.S1 (3 páginas críticas) | 32-40h | 4-5d |
| F1.S2 (3 páginas) | 32-40h | 4-5d |
| F1.S3 (5 páginas) | 40-48h | 5-6d |
| F1.S4 (restante + modais) | 32-40h | 4-5d |
| **Sidebar mobile dedicada** | 16h | 2d |
| **Topbar mobile dedicado** | 12h | 1,5d |
| F2 - PWA completo + Web Push (front + back) | 40-56h | 5-7d |
| F3 - Dashboard Executivo Mobile | 24h | 3d |
| F3 - Central de Notificações Mobile | 32h | 4d |
| F3 - Command Center Mobile (front + endpoint backend) | 40h | 5d |
| F3 - Gestão de Equipes Mobile | 32h | 4d |
| F3 - Aprovações Mobile (front; back reusa) | 24h | 3d |
| F3 - IA Orkiestri (back novo + front chat) | 64-80h | 8-10d |
| Polish + bottom tab bar + safe-areas | 24h | 3d |
| QA + ajustes em dispositivos reais | 32h | 4d |
| **Total** | **~470-530h** | **~60-66 dias** |

Com 1 dev = ~13 semanas. Com 2 devs = ~7 semanas.

---

## 9. Riscos e mitigações consolidados

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| R1 | `<meta viewport>` afetar render em tablet/desktop pequeno | Baixa | Médio | QA em 5 viewports antes de F0 mergear. Possível rollback em 5min (1 linha). |
| R2 | Flicker de hidratação (`useIsMobile` SSR=false) | Média | Baixo | Default desktop + `display: none` inicial; possível upgrade para cookie viewport-hint via nginx. |
| R3 | Bundle JS crescer (componentes duplicados) | Média | Médio | Dynamic import por rota; verificar bundle size com `next build --profile`. |
| R4 | Service Worker servir versão antiga após deploy | Alta (clássico PWA) | Médio | Skip-waiting + `clients.claim()` + endpoint `/version.json` no app shell checando hash a cada 5min, sugerindo "Recarregar" toast. |
| R5 | Web Push iOS exigir iOS ≥16.4 | Alta | Baixo (limitação conhecida) | Fallback para notificações via WhatsApp (módulo já existe) em dispositivos antigos. |
| R6 | IA expor dados sensíveis (vazamento cross-tenant) | Média | **Crítico** | Tool calls **obrigatoriamente** scoped por `organizationId` do JWT. Rate limit. Auditoria. Testes de penetração antes de liberar. |
| R7 | Backend não suportar carga de polling do Command Center | Baixa | Médio | Cache em Redis (5s TTL) + WebSocket para push (deferred). Endpoint agregado evita N requests. |
| R8 | Custo de LLM (OpenAI/Claude) explodir | Média | Médio | Rate limit por usuário (10 perguntas/h), cache de perguntas comuns, modelo barato em tier free + upgrade pago. |
| R9 | Manutenção dobrada (mobile + desktop) | Alta — assumido | Médio | Hooks de dados compartilhados; UI duplicada conscientemente. Documentação clara. |
| R10 | Designer/produto não acompanhar ritmo mobile | Média | Médio | Definir agora um set de design tokens mobile e referência visual aprovada (ex: Linear app, Notion app). |

---

## 10. Garantia de não-impacto no desktop — checklist final

Para cada PR mobile, o reviewer **deve confirmar**:

- [ ] Nenhuma linha do `globals.css` entre 1-396 foi modificada
- [ ] Nenhum componente em `components/ui/`, `components/layout/`, `components/agenda/` foi modificado *ou* a modificação é puramente aditiva (novas props opcionais com default = comportamento atual)
- [ ] Nenhuma página `dashboard/*/page.tsx` teve seu JSX alterado fora do bloco `if (isMobile) return <PageMobile />`
- [ ] Build de produção rodou sem warnings
- [ ] Screenshot desktop antes/depois idênticos em: 1280×800, 1440×900, 1920×1080, 2560×1440
- [ ] Smoke test desktop: login, navegar 5 páginas principais, criar 1 evento, abrir 1 modal — tudo igual
- [ ] Variáveis CSS (`--bg-primary`, `--accent-violet`, etc.) **não** foram alteradas, apenas consumidas
- [ ] Tailwind config não foi alterado (exceto adições isoladas com prefixo `m-`)
- [ ] Toda regra CSS nova está **dentro de** `@media (max-width: 767px)` ou em classe com prefixo `.m-*` / `.mobile-only`

---

## 11. Próximos passos — pedido de aprovação

**Este documento NÃO produz nenhuma alteração de código.** Para avançar, peço aprovação explícita em 3 pontos:

### 11.1. Decisão de arquitetura
- [ ] **Aprovar PWA-first** (recomendado)
- [ ] **Discutir** alternativa (React Native ou outro caminho)

### 11.2. Decisão de escopo F0+F1
- [ ] **Aprovar F0 (fundação técnica) como primeiro PR isolado**, em homologação, para validação
- [ ] **Aprovar plano F1** com a priorização sugerida (Visão Geral → Executivo → Chamados → ...)

### 11.3. Decisão de design mobile
- [ ] **Aprovar abertura de design** mobile (precisamos definir tokens mobile, paleta, referências visuais antes do F3 começar)
- [ ] **Indicar designer** ou aprovar uso de referência de mercado (Linear / Notion / Vercel mobile)

### 11.4. Restrições explícitas confirmadas
- [x] Nada vai para produção sem passar por homologação primeiro
- [x] Nada altera código desktop sem aprovação caso-a-caso
- [x] Qualquer risco identificado durante a implementação → para, documenta, propõe alternativa, **não implementa**

---

## Apêndice A — Inventário rápido para referência

### A.1. Arquivos críticos a tocar em F0
```
src/app/layout.tsx                    ← viewport meta + links manifest/ícones
src/styles/mobile.css                 ← NOVO (vazio inicialmente)
src/lib/useIsMobile.ts                ← NOVO
src/components/responsive/*.tsx        ← NOVO
public/manifest.json                   ← NOVO
public/icon-{192,512,maskable}.png    ← NOVO (gerar do logo)
public/apple-touch-icon.png           ← NOVO
public/offline.html                   ← NOVO (página fallback)
```

### A.2. Arquivos com grids fixos (alvos de F1)
```
agenda/page.tsx           — repeat(7) calendário
clientes/page.tsx         — repeat(6), repeat(4) KPIs
capacity/page.tsx         — repeat(7), repeat(4) heatmap
ativos/monitoramento      — repeat(4), repeat(5) KPIs
superadmin/page.tsx       — repeat(5) admin
cadastros/page.tsx        — múltiplos repeat(3), repeat(4) forms
automacoes/page.tsx       — repeat(3) botões
```

### A.3. Modais com largura fixa (alvos de F1)
```
components/ui/NotificationBell.tsx    width: 360
components/ui/FocusMode.tsx           width: 360 + padding 40
components/ui/UserStatus.tsx          width: 180 (OK pequeno)
components/ui/PasswordRequests.tsx    width: 340
components/ui/WhatsAppSettings.tsx    img 220×220
components/ui/CsvImportModal.tsx      maxWidth 640
```

### A.4. Endpoints backend a CRIAR
```
GET  /api/command-center/snapshot     ← agregado para Command Center mobile
POST /api/push/subscribe              ← Web Push VAPID
POST /api/push/unsubscribe
POST /api/push/test                   ← debug
POST /api/ia/chat        (SSE)        ← IA conversacional
GET  /api/ia/conversas
GET  /api/version                     ← para SW detectar nova versão
```

### A.5. Bibliotecas a avaliar
```
@ducanh2912/next-pwa     ← geração de SW + manifest (manutenção ativa)
web-push                 ← VAPID server-side
workbox-window           ← register/update do SW no client
@anthropic-ai/sdk        ← LLM (já compatível com a stack — ver memória)
react-pull-to-refresh    ← gesto pull-refresh (ou implementar 50 linhas)
@vercel/og               ← geração de imagens (splash dinâmico, opcional)
```

---

_Fim do documento. Aguardando aprovação para iniciar pela Fase F0 em homologação._
