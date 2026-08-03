# ORKIESTRI
## UI Components
Version 2.0

---

# Objetivo

Este documento define todos os componentes oficiais do website institucional da Orkiestri.

Todo componente deve ser reutilizável.

Nunca desenvolver páginas utilizando HTML repetido.

Todos os componentes devem seguir Atomic Design.

Atoms

↓

Molecules

↓

Organisms

↓

Templates

↓

Pages

---

# Regras Gerais

Todos os componentes devem possuir:

Responsividade

Estados

Hover

Focus

Loading

Disabled (quando aplicável)

Dark Mode Ready

Acessibilidade

Animações

---

# Navbar

## Objetivo

Ser discreta.

Nunca competir com o Hero.

---

## Desktop

Logo à esquerda.

Menu centralizado.

CTA à direita.

Transparente no Hero.

Após scroll:

Background branco.

Blur.

Border inferior.

Altura

80px

---

Itens

Empresa

Soluções

Produtos

Tecnologia

Cases

Blog

Contato

CTA

Solicitar Demonstração

---

Hover

Linha inferior animada.

Texto muda para laranja.

Transição 200ms.

---

# Mega Menu

Produtos

Grid

3 colunas

Cada card contém:

Ícone

Nome

Descrição

Seta

Hover

Background cinza claro.

Border laranja.

TranslateY -2px.

---

# Hero

Layout

2 colunas

Esquerda

Texto

CTA

Badges

Direita

Imagem da plataforma

Dashboard

Mockup

---

Elementos

Eyebrow

Título

Descrição

Botões

Indicadores

Imagem

---

Botões

Primary

Conhecer Plataforma

Secondary

Solicitar Demonstração

---

Indicadores

99.9% Uptime

Cloud Native

AI Ready

API First

---

# Feature Card

Radius

20px

Border

1px

Background

Branco

Padding

32px

Conteúdo

Ícone

Título

Descrição

CTA opcional

Hover

TranslateY

-4px

Border laranja.

---

# Product Card

Imagem superior.

Ícone.

Nome.

Descrição.

Tags.

Botão.

Hover

Imagem aumenta 3%.

Card sobe.

---

# Service Card

Ícone

Título

Descrição

Botão

Layout vertical.

---

# Statistics

Layout

4 colunas

Desktop

2 colunas

Tablet

1 coluna

Mobile

Número grande.

Descrição pequena.

---

# Testimonial

Foto

Nome

Empresa

Cargo

Texto

Avaliação

Layout horizontal.

---

# Timeline

Linha vertical.

Pontos conectados.

Cada etapa:

Número

Título

Descrição

---

# CTA Section

Background branco.

Título gigante.

Texto curto.

Dois botões.

Muito espaço.

---

# Footer

Logo

Descrição

Links

Produtos

Empresa

Serviços

Contato

Redes sociais

Newsletter

---

# Forms

Inputs

52px

Radius

14px

Labels acima.

Mensagens de erro abaixo.

---

Campos

Nome

Empresa

Email

Telefone

Mensagem

---

Botão

Enviar Solicitação

---

# Modal

Width

640px

Radius

24px

Padding

40px

Overlay

Blur

---

# Badge

Radius

999px

Padding

8x16

Texto

14px

Peso

600

---

# Chips

Selecionáveis.

Hover.

Ativo.

---

# Accordion

FAQ

Apenas um aberto por vez.

Animação suave.

---

# Tabs

Linha inferior animada.

Nunca utilizar abas pequenas.

---

# Pricing Card

Plano

Preço

Benefícios

CTA

Plano recomendado

Badge

Mais Popular

---

# Blog Card

Imagem

Categoria

Título

Resumo

Autor

Data

Tempo de leitura

---

# Technology Card

Logo

Nome

Descrição

---

# Team Card

Foto

Nome

Cargo

LinkedIn

---

# Process Card

Número

Título

Descrição

Fluxo

Discovery

UX

Arquitetura

Desenvolvimento

QA

Deploy

Suporte

---

# Dashboard Preview

Mostrar dashboards reais.

Nunca utilizar imagens genéricas.

Priorizar capturas da própria plataforma.

---

# Empty State

Ícone

Título

Descrição

Botão

---

# Notifications

Success

Warning

Info

Error

Toast discreto.

---

# Breadcrumb

Sempre visível.

Separador "/"

---

# Search

Input grande.

Ícone esquerdo.

Busca instantânea.

---

# Pagination

Minimalista.

Setas.

Página atual destacada.

---

# Avatar

Circular.

Fallback com iniciais.

---

# Social Links

LinkedIn

GitHub

Instagram

YouTube

Hover laranja.

---

# FAQ

Layout accordion.

Pergunta

Resposta

CTA ao final.

---

# Newsletter

Título

Texto

Campo Email

Botão

---

# Cookie Banner

Minimalista.

Aceitar

Configurar

Política

---

# Error Pages

404

Título

Página não encontrada.

Botão

Voltar ao início.

---

500

Mensagem amigável.

Botão

Tentar novamente.

---

# Loading

Skeleton.

Nunca spinner sozinho.

---

# Scroll Animation

Fade Up

Fade Left

Fade Right

Scale

Blur

Duração

200ms

Delay escalonado.

---

# Hover Rules

Botões

Scale 1.02

Cards

TranslateY -4px

Ícones

Rotate 3°

Links

Underline animado

---

# Responsividade

Desktop

≥1280

Notebook

1024

Tablet

768

Mobile

390

Nunca ocultar conteúdo importante.

Reorganizar.

Nunca remover.

---

# Component Naming

Navbar

Hero

FeatureCard

ServiceCard

ProductCard

TechnologyCard

Stats

Timeline

CTASection

Footer

FAQ

ContactForm

PricingCard

Testimonial

Newsletter

LogoCloud

MegaMenu

Breadcrumb

SearchInput

CookieBanner

Modal

Toast

DashboardPreview

---

# Estrutura de Componentes (Next.js)

components/

layout/

Navbar.tsx

Footer.tsx

MegaMenu.tsx

Section.tsx

Container.tsx

hero/

Hero.tsx

HeroActions.tsx

HeroStats.tsx

cards/

FeatureCard.tsx

ProductCard.tsx

ServiceCard.tsx

TechnologyCard.tsx

CaseCard.tsx

BlogCard.tsx

sections/

Services.tsx

Products.tsx

Platform.tsx

Technology.tsx

Testimonials.tsx

CTA.tsx

FAQ.tsx

Contact.tsx

shared/

Button.tsx

Input.tsx

Badge.tsx

Modal.tsx

Tabs.tsx

Accordion.tsx

Toast.tsx

Loading.tsx

Skeleton.tsx

---

# Conclusão

Todos os componentes devem transmitir a identidade da Orkiestri.

Cada elemento deve parecer parte de um único ecossistema.

A consistência é mais importante do que criatividade.

O usuário deve reconhecer o padrão da plataforma em qualquer página do website.