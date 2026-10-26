# ORKIESTRI
## Design System
Version 2.0

---

# Objetivo

Este documento define a identidade visual oficial da Orkiestri.

Todo componente do website deve seguir estas diretrizes.

Nenhuma tela deve ser construída fora deste padrão.

O objetivo é criar uma identidade premium, moderna e atemporal.

---

# Princípios

A interface deve transmitir:

Confiança

Elegância

Tecnologia

Organização

Performance

Clareza

Minimalismo

Nunca transmitir:

Poluição visual

Excesso de cores

Excesso de sombras

Cards exagerados

Muitos elementos competindo pela atenção

---

# Filosofia

Less Interface.

More Experience.

A interface deve desaparecer.

O conteúdo deve ser o protagonista.

---

# Visual Style

Minimalista

Premium

Corporativo

Tecnológico

Muito espaço em branco

Muito respiro

Pouco ruído

---

# Layout

Utilizar layout widescreen.

Container máximo:

1440px

Conteúdo:

1280px

Padding lateral:

Desktop

96px

Tablet

48px

Mobile

24px

Nunca utilizar conteúdo ocupando 100% da largura.

---

# Sistema de Grid

12 colunas

Gap:

32px

Mobile:

4 colunas

Tablet:

8 colunas

Desktop:

12 colunas

---

# Espaçamentos

Utilizar escala de 8 pontos.

4

8

16

24

32

40

48

64

80

96

128

Nunca utilizar valores aleatórios.

---

# Bordas

Radius

Cards

20px

Inputs

14px

Botões

14px

Modal

24px

Imagens

24px

Nunca utilizar cantos retos.

---

# Tipografia

Fonte Principal

Inter

Fallback

System UI

Peso

400

500

600

700

800

---

# Hierarquia

Hero

72px

Desktop

60px

Tablet

44px

Mobile

---

Título

56px

---

H2

44px

---

H3

32px

---

H4

24px

---

Texto

18px

---

Texto Pequeno

16px

---

Legenda

14px

---

Line Height

140%

---

Letter Spacing

Negativo apenas em títulos.

---

# Paleta

## Primary

Orange

#F97316

---

Primary Hover

#EA580C

---

Primary Soft

#FFEDD5

---

Dark

#0F172A

---

Dark Soft

#1E293B

---

Gray 900

#111827

Gray 800

#1F2937

Gray 700

#374151

Gray 600

#4B5563

Gray 500

#6B7280

Gray 400

#9CA3AF

Gray 300

#D1D5DB

Gray 200

#E5E7EB

Gray 100

#F3F4F6

Gray 50

#F9FAFB

---

Success

#22C55E

Warning

#F59E0B

Error

#EF4444

Info

#3B82F6

---

# Background

Branco nas páginas internas do site e em todo o sistema.

**Exceção: a home (landing page) é escura.** Decisão do cliente em 26/10/2026,
depois de três referências visuais escuras que ele mesmo trouxe. A home é a
única página de conversão do site e precisa ser impactante; as internas
continuam claras, e nenhuma delas deve ser escurecida sem nova decisão.

Escala escura da landing (definida em `website/src/app/globals.css`):

| Token | Valor | Uso |
| --- | --- | --- |
| `ink` | `#07080B` | fundo base |
| `ink-raise` | `#0E1016` | faixa alternada |
| `panel` | `#15181F` | superfícies |
| `flame` | `#FF6A1A` | a luz — glow, fio aceso, gradiente |
| `ember` | `#FFC48A` | âmbar, para dados e microdetalhe |
| `signal` | `#25D366` | verde do WhatsApp, **só** no botão de cadastro |
| `chalk` / `chalk-dim` / `chalk-faint` | `#F4F6F9` / `#99A0AD` / `#868E9D` | texto |

Três regras que sustentam o resultado:

1. O laranja do escuro é `#FF6A1A`, não o `#F97316` da marca: sobre quase
   preto, o `#F97316` perde brilho e vira ocre.
2. O laranja é **fonte de luz**, não tinta de fundo. Glow largo demais tinge a
   página inteira de marrom — é preciso vinheta para devolver o preto às
   bordas.
3. O verde aparece **uma vez por tela**. Usá-lo como cor de enfeite destrói o
   que ele comunica: que o clique sai do site e abre uma conversa.

Dark Mode do sistema (app) continua apenas previsto, não implementado.

---

# Botões

Primary

Laranja sólido.

Texto branco.

Hover discreto.

Radius 14px.

Height

52px

---

Secondary

Outline.

Border cinza.

Background branco.

Hover cinza muito claro.

---

Ghost

Sem borda.

Sem background.

---

Icon Button

40px

Radius circular.

---

# Cards

Background branco.

Radius 20px.

Border fina.

Sem sombras pesadas.

Hover:

TranslateY

-4px

Border laranja

Transition suave.

---

# Sombras

Muito discretas.

Nunca utilizar sombras fortes.

Preferir:

Border

Blur

Glass extremamente leve

---

# Ícones

Lucide Icons

Stroke

2px

Sempre lineares.

Nunca coloridos.

Tamanho

20

24

32

48

---

# Imagens

Sempre reais.

Nunca utilizar mockups genéricos.

Priorizar:

Dashboard

Equipe

Tecnologia

Integrações

Código

Operação

---

# Fotografias

Empresas.

Pessoas trabalhando.

Escritórios modernos.

Tecnologia.

Nunca utilizar pessoas apontando para câmera.

Nunca utilizar imagens artificiais.

---

# Ilustrações

Utilizar apenas quando necessário.

Preferência para visual 3D minimalista.

---

# Motion

Todas animações entre:

180ms

300ms

Nunca acima de 500ms.

---

# Scroll

Muito suave.

Fade

Translate

Blur

Scale

---

# Hover

Botões

Scale 1.02

---

Cards

Translate Y

-4px

---

Ícones

Rotate leve

ou

Scale 1.1

---

Navbar

Transparente no Hero.

Após scroll:

Background branco.

Blur.

Border inferior.

---

# Hero

Altura

100vh

Conteúdo centralizado.

Título gigante.

Muito espaço.

Imagem ocupando metade da tela.

CTA em destaque.

---

# Seções

Alternar:

Muito branco.

Cinza extremamente claro.

Nunca utilizar blocos coloridos enormes.

---

# Componentes

Navbar

Mega Menu

Hero

Feature Grid

Services Grid

Products Grid

Stats

Timeline

Testimonials

CTA

Footer

Pricing

FAQ

Blog Cards

Forms

---

# Inputs

Height

52px

Radius

14px

Border cinza.

Focus:

Laranja.

---

# Badges

Muito discretas.

Radius

999px

Texto pequeno.

---

# Labels

Uppercase.

Tracking positivo.

Peso

600.

---

# Tabelas

Muito limpas.

Sem linhas excessivas.

Hover nas linhas.

---

# Dashboards

Inspirados em:

Linear

Stripe

Vercel

Notion

Muito espaço.

Pouca informação.

Indicadores destacados.

---

# Responsividade

Desktop First.

Tablet.

Mobile.

Nenhum componente pode quebrar.

---

# Performance

Todas imagens otimizadas.

Lazy Loading.

Prefetch.

Server Components.

Streaming.

---

# Acessibilidade

WCAG AA.

Contraste adequado.

Focus visível.

Alt obrigatório.

ARIA quando necessário.

---

# Nunca Fazer

Gradientes exagerados.

Sombras fortes.

Cards coloridos.

Muito texto.

Carrosséis automáticos.

Popups invasivos.

Vídeos iniciando automaticamente.

Animações longas.

Mais de duas cores fortes na mesma tela.

---

# Sempre Fazer

Muito espaço.

Tipografia grande.

Componentização.

Microinterações.

Hierarquia visual.

Clareza.

Velocidade.

Elegância.

Consistência.

---

# Inspiração

A identidade visual deve transmitir o mesmo nível de qualidade percebida de empresas de software reconhecidas mundialmente.

Não copiar layouts.

Não reproduzir componentes.

Não replicar identidade visual.

Usar apenas como referência de qualidade, simplicidade, hierarquia e experiência.

---

# Conclusão

Todo elemento visual deve reforçar a percepção de que a Orkiestri é uma empresa de tecnologia premium.

O design deve parecer atual hoje e continuar moderno pelos próximos anos.

A simplicidade é uma característica intencional, não uma limitação.

Cada detalhe deve transmitir confiança, organização e excelência.