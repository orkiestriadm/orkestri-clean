# Orkiestri — Website (Project Phoenix)

Site institucional da **Orkiestri**, uma Enterprise Software Company.
Reconstrução completa seguindo a documentação em [`../orkiestri-design-system`](../orkiestri-design-system).

## Stack

- **Next.js 15** (App Router) + **React 19**
- **TypeScript** (strict)
- **Tailwind CSS v4** (design tokens em `src/app/globals.css`)
- **Framer Motion** (motion system)
- **shadcn/ui**-style components + **Radix UI** (accordion)
- **Lucide** (ícones)
- **Zod** + **React Hook Form** (formulários)

## Scripts

```bash
npm run dev         # ambiente de desenvolvimento
npm run build       # build de produção
npm run start       # servir build
npm run lint        # eslint
npm run type-check  # tsc --noEmit
```

## Estrutura

```
src/
├── app/            # rotas (App Router) + api/ + sitemap/robots
├── components/
│   ├── ui/         # primitivas (Button, Input, Section, Accordion…)
│   ├── layout/     # Navbar, MegaMenu, MobileNav, Footer, Logo
│   ├── sections/   # blocos de página (Hero, Platform, Stats, FAQ…)
│   ├── cards/      # ProductCard, ServiceCard, FeatureCard
│   ├── forms/      # ContactForm
│   └── animations/ # Reveal (scroll reveal)
├── config/         # site, products, services, navigation, content
├── lib/            # utils (cn), seo, motion tokens
├── schemas/        # zod schemas
└── types/          # tipos compartilhados
```

## Design System

- Cor primária: laranja `#F97316` · Dark `#0F172A` · fundo branco
- Tipografia: Inter · escala de 8pt · radius cards 20px / botões 14px
- Filosofia: *"Less Interface. More Experience."*
- Fonte da verdade: `orkiestri-design-system/06-design-system.md`

## Conteúdo dinâmico

Os 11 aplicativos do Orkiestri One e os serviços são definidos em
`src/config/products.ts` e `src/config/services.ts` — as páginas e cards são
gerados a partir desses dados (zero duplicação).
