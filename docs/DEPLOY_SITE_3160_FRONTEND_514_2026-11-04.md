# Deploy Website `3.16.0` + Frontend `5.1.4` — 04/11/2026

## Resumo das alterações publicadas

### 1. Website (`3.16.0`)
- **`/products/one-space` (`website/src/app/products/[slug]/page.tsx`):**
  - Adicionada separação estrutural (`<Section className="pt-8 md:pt-12">`) e cabeçalho explicativo (`<SectionHeader eyebrow="Visão na plataforma" title="Tudo o que você manda pelo WhatsApp, organizado em tela grande." ... />`) entre o vídeo de tutorial interativo e o mockup da plataforma em tela grande (`<Notebook />`).
- **Alinhamento de CTAs e padronização para `"Teste grátis"`:**
  - Alterado o rótulo padrão de `"Teste grátis de 7 dias"` para **`"Teste grátis"`** em `website/src/components/ui/whatsapp-button.tsx`, `website/src/components/layout/mobile-nav.tsx` e `website/src/config/navigation.ts`.
  - Ajustada a altura do botão secundário de vídeo no Hero (`website/src/components/sections/hero.tsx`) para `h-14` (`56px`), ficando exatamente alinhado lado a lado com o botão principal `WhatsAppButton`.
- **Rodapé (`website/src/components/layout/footer.tsx` e `website/src/config/site.ts`):**
  - Corrigido o grid desktop de 5 colunas (`lg:grid-cols-[1.4fr_repeat(4,1fr)]`) para **6 colunas** (`lg:grid-cols-[1.45fr_repeat(5,minmax(0,1fr))] lg:items-start lg:gap-8`), alinhando a coluna da marca + as 5 colunas de navegação (`Produtos`, `O produto`, `Soluções`, `Empresa` e `Contato`) na mesma linha horizontal sem quebrar `Contato` para baixo.
  - Configurados os links oficiais nos ícones de redes sociais do rodapé:
    - **LinkedIn:** `https://www.linkedin.com/in/guilherme-l-rodrigues`
    - **GitHub:** `https://github.com/orkiestriadm`
    - **Instagram:** `https://www.instagram.com/orkiestri`

### 2. Frontend (`5.1.4`) — Redesign de `/login` e `/recuperar-senha`
- **Nova identidade visual com Aurélia e órbita (`frontend/src/app/login/page.tsx`):**
  - Removido o fundo antigo de planeta (`/branding/planeta.jpg`) em `/login` e `/recuperar-senha`.
  - Aplicada a atmosfera escura oficial do Orkiestri (`#090a0d` com glows radiais em `#f97316` e grid sutil de engenharia).
  - Adicionado card visual interativo com **órbita animada da Aurélia** (anéis orbitais, satélites em movimento, prévia ao vivo da conversa no WhatsApp e os 4 pilares do ecossistema: *Agenda e rotina*, *Meus gastos*, *Projetos e tarefas*, *Chamados e notas*).
  - Textos reformulados para refletir o momento atual do Orkiestri (*"Uma conversa no WhatsApp. Tudo organizado no seu painel."* e *"Entre com o e-mail e a senha que você recebeu ao concluir seu cadastro com a Aurélia."*).
  - Removido o antigo link `"Solicitar acesso"` e substituído por CTA direto para o WhatsApp da Aurélia (**`"Começar teste grátis com a Aurélia"`**).

## Ambientes sincronizados
- **Produção (`https://www.orkiestri.com` / `orkestri-prod`):**
  - `orkestri_website` (`3.16.0`) — Rollback image: `orkestri/website:rollback-before-3160-51b9a78255b6`
  - `orkestri_frontend` (`5.1.4`) — Rollback image: `orkestri/frontend:rollback-before-514-1279413d1439`
- **Localhost (`http://localhost`):**
  - `orkestri_website` (`3.16.0`) e `orkestri_frontend` (`5.1.4`) recriados e ativos.
