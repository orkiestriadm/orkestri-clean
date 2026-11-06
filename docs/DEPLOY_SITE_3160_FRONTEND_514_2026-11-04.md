# Deploy Website `3.16.0` / `3.17.0` + Frontend `5.1.4` — 05/11/2026

## Resumo das alterações publicadas

### 1. Website (`3.17.0`) — Restauração completa do PWA no site institucional
- **Meta tags e Manifest global (`website/src/lib/seo.ts`):**
  - Adicionado `manifest: "/manifest.webmanifest"`, `icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" }` e `appleWebApp: { capable: true, title: "Orkiestri One", statusBarStyle: "black" }` em `buildMetadata()`, garantindo que todas as páginas do site (`https://www.orkiestri.com/`, `/aurelia`, `/planos`, `/products/*`, etc.) declarem o PWA no `<head>`.
- **Registro global do Service Worker (`/sw.js`) e captura do prompt de instalação (`website/src/components/layout/experience-effects.tsx`):**
  - Registrado `navigator.serviceWorker.register("/sw.js")` ao carregar qualquer página do site institucional, ativando o ícone nativo de instalação na barra de endereços do Chrome/Edge e no menu do Android/iOS já na Home.
- **Botão explícito `"Baixar aplicativo (PWA)"` (`website/src/components/ui/install-pwa-button.tsx`, `footer.tsx` e `mobile-nav.tsx`):**
  - Adicionado botão no rodapé e no menu mobile que aciona o prompt nativo `beforeinstallprompt` (Chrome/Edge/Android) ou exibe o guia passo a passo para iPhone/iPad (Safari), Android e Computador.

### 2. Website (`3.16.0`) — Ajustes visuais e alinhamentos
- **`/products/one-space` (`website/src/app/products/[slug]/page.tsx`):**
  - Adicionada separação estrutural (`<Section className="pt-8 md:pt-12">`) e cabeçalho explicativo (`<SectionHeader eyebrow="Visão na plataforma" title="Tudo o que você manda pelo WhatsApp, organizado em tela grande." ... />`) entre o vídeo de tutorial interativo e o mockup da plataforma em tela grande (`<Notebook />`).
- **Alinhamento de CTAs e padronização para `"Teste grátis"`:**
  - Alterado o rótulo padrão de `"Teste grátis de 7 dias"` para **`"Teste grátis"`** em `website/src/components/ui/whatsapp-button.tsx`, `website/src/components/layout/mobile-nav.tsx` e `website/src/config/navigation.ts`.
  - Ajustada a altura do botão secundário de vídeo no Hero (`website/src/components/sections/hero.tsx`) para `h-14` (`56px`), ficando exatamente alinhado lado a lado com o botão principal `WhatsAppButton`.
- **Rodapé (`website/src/components/layout/footer.tsx` e `website/src/config/site.ts`):**
  - Corrigido o grid desktop de 5 colunas para **6 colunas** (`lg:grid-cols-[1.45fr_repeat(5,minmax(0,1fr))] lg:items-start lg:gap-8`).
  - Configurados os links oficiais nos ícones de redes sociais do rodapé (`LinkedIn`, `GitHub` e `Instagram`).

### 3. Frontend (`5.1.4`) — Redesign de `/login` e `/recuperar-senha`
- **Nova identidade visual com Aurélia e órbita (`frontend/src/app/login/page.tsx`):**
  - Removido o fundo antigo de planeta (`/branding/planeta.jpg`) em `/login` e `/recuperar-senha`.
  - Adicionado card visual interativo com **órbita animada da Aurélia** e prévia da conversa no WhatsApp.
  - Removido o antigo link `"Solicitar acesso"` e substituído por CTA direto para o WhatsApp da Aurélia (**`"Começar teste grátis com a Aurélia"`**).

## Ambientes sincronizados
- **Produção (`https://www.orkiestri.com` / `orkestri-prod`):**
  - `orkestri_website` (`3.17.0`)
  - `orkestri_frontend` (`5.1.4`)
- **Localhost (`http://localhost`):**
  - `orkestri_website` (`3.17.0`) e `orkestri_frontend` (`5.1.4`) recriados e ativos.
