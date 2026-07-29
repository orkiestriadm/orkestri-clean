# ORKIESTRI
## Technical Architecture
Version 2.0

---

# Objetivo

Este documento define a arquitetura técnica oficial do website institucional da Orkiestri.

Todo o projeto deve seguir estes padrões.

A arquitetura deve priorizar:

- Escalabilidade
- Performance
- SEO
- Componentização
- Manutenibilidade
- Acessibilidade
- Segurança

O objetivo é criar um projeto preparado para crescer durante muitos anos.

---

# Stack Tecnológica

Framework

Next.js 15+

---

Linguagem

TypeScript

Strict Mode

---

UI

React 19

---

Estilização

Tailwind CSS v4

---

Componentes

shadcn/ui

---

Ícones

Lucide React

---

Animações

Framer Motion

---

Gerenciamento de Estado

Zustand

---

Server State

TanStack Query

---

Validação

Zod

React Hook Form

---

SEO

Next Metadata API

Schema.org

Open Graph

Twitter Cards

Sitemap

Robots

Canonical

JSON-LD

---

Imagens

next/image

AVIF

WebP

Lazy Loading

---

Deploy

Vercel

ou

AWS Amplify

---

Analytics

Google Analytics 4

Google Tag Manager

Microsoft Clarity

PostHog

---

Monitoramento

Sentry

OpenTelemetry

---

# Estrutura do Projeto

src/

app/

components/

features/

hooks/

lib/

services/

types/

schemas/

store/

styles/

providers/

constants/

config/

assets/

public/

---

# App Router

Utilizar exclusivamente App Router.

Não utilizar Pages Router.

---

# Estrutura das Rotas

app/

layout.tsx

page.tsx

loading.tsx

error.tsx

not-found.tsx

(company)/

(products)/

(services)/

(blog)/

(api)/

---

# Estrutura de Componentes

components/

layout/

navigation/

hero/

cards/

sections/

forms/

footer/

dashboard/

shared/

icons/

animations/

ui/

---

# Organização

Cada componente possui:

Component

Types

Hooks

Styles (quando necessário)

Tests

Story

---

Exemplo

ProductCard/

ProductCard.tsx

ProductCard.types.ts

ProductCard.test.tsx

index.ts

---

# Server Components

Utilizar Server Components por padrão.

Client Components apenas quando necessário.

---

Client Components apenas para:

Forms

Menus

Animações

Estados locais

Interações

---

# Fetch

Utilizar:

Server Actions

ou

Fetch nativo do Next.

Evitar APIs desnecessárias.

---

# Estado Global

Zustand apenas para:

Theme

Menu

Usuário

Preferências

---

Nunca utilizar Zustand para dados vindos do backend.

---

# Server State

TanStack Query

Cache

Retry

Invalidation

Background Refetch

---

# Tipagem

Nunca utilizar any.

Utilizar interfaces claras.

Criar tipos compartilhados.

---

# Alias

@

Para imports.

Exemplo

@/components

@/lib

@/hooks

---

# Nomenclatura

Componentes

PascalCase

---

Hooks

camelCase

useHero()

---

Arquivos

kebab-case

---

Pastas

lowercase

---

Constantes

UPPER_CASE

---

# Estilo de Código

Funções pequenas.

Componentes pequenos.

Máximo

250 linhas

por componente.

Extrair lógica sempre que possível.

---

# Componentização

Nunca repetir código.

Criar componentes reutilizáveis.

---

# Tailwind

Classes organizadas.

Nunca utilizar CSS inline.

Nunca utilizar !important.

---

Preferir

clsx

tailwind-merge

---

# Temas

Preparar Dark Mode.

Mesmo que inicialmente desabilitado.

---

# SEO Técnico

Todas páginas devem possuir:

Title

Description

Canonical

Open Graph

Twitter Card

Schema

Robots

Breadcrumb

---

# Metadata

Utilizar Metadata API.

Nunca inserir meta tags manualmente.

---

# Schema.org

Organization

SoftwareApplication

Product

BreadcrumbList

Article

FAQPage

Service

---

# Sitemap

Gerado automaticamente.

---

# Robots

Configuração dinâmica.

---

# Segurança

Headers

CSP

HSTS

Referrer Policy

X-Frame

Permissions Policy

---

Nunca expor:

Secrets

Tokens

Keys

---

# Variáveis

Utilizar

.env.local

.env.production

Nunca hardcode.

---

# Performance

Objetivo Lighthouse

Performance

100

SEO

100

Accessibility

100

Best Practices

100

---

Core Web Vitals

LCP < 2.5s

CLS < 0.1

INP < 200ms

---

# Imagens

Sempre:

next/image

Responsive

Lazy

Blur Placeholder

AVIF

WebP

---

Nunca utilizar imagens maiores que o necessário.

---

# Fontes

next/font

Inter

Display swap

---

# Código

ESLint

Prettier

Husky

Lint Staged

---

# Git

main

develop

feature/*

hotfix/*

release/*

---

Commits

Conventional Commits

feat

fix

refactor

style

perf

docs

test

build

---

# Testes

Vitest

React Testing Library

Playwright

---

Cobertura mínima

80%

---

# Storybook

Todos os componentes reutilizáveis devem possuir stories.

---

# Formulários

React Hook Form

+

Zod

---

Validação

Client

Server

---

# Internacionalização

Preparar arquitetura.

Inicialmente

pt-BR

Preparar

en-US

es-ES

---

# APIs

/api/contact

/api/demo

/api/newsletter

---

Resposta padrão

success

message

data

errors

---

# Logs

Nunca utilizar console.log em produção.

Utilizar logger centralizado.

---

# Erros

Error Boundary

Loading

Not Found

Fallback UI

---

# Acessibilidade

WCAG AA

ARIA

Keyboard Navigation

Screen Reader

Focus Management

---

# Animações

Framer Motion.

Nunca CSS Animation complexa.

---

# Lazy Loading

Sections

Blog

Maps

Vídeos

Gráficos

---

# Código Limpo

SOLID

DRY

KISS

Clean Code

Composition over Inheritance

---

# Dependências

Adicionar apenas quando realmente necessário.

Evitar bibliotecas pesadas.

---

# Deploy

Pipeline

Lint

↓

Type Check

↓

Tests

↓

Build

↓

Deploy

---

# CI/CD

GitHub Actions

Preview Deploy

Production Deploy

---

# Estrutura Final

src/

app/

components/

features/

hooks/

providers/

services/

schemas/

types/

store/

config/

constants/

lib/

styles/

assets/

public/

---

# Objetivo Final

Construir um website institucional que represente o nível de engenharia esperado de uma empresa de software moderna.

O código deve ser tão elegante quanto a interface.

A arquitetura deve permitir crescimento contínuo, facilidade de manutenção e excelente desempenho, servindo como base para futuras evoluções do ecossistema digital da Orkiestri.