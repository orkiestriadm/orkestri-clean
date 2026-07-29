# ORKIESTRI
## Motion System
Version 2.0

---

# Objetivo

O Motion System define como a interface se comporta.

Animações não existem para chamar atenção.

Existem para orientar o usuário.

Cada movimento deve possuir um propósito.

---

# Filosofia

Motion should feel invisible.

A melhor animação é aquela que o usuário percebe sem notar.

O movimento deve transmitir:

Elegância

Precisão

Velocidade

Qualidade

Confiança

Nunca espetáculo.

---

# Princípios

As animações devem:

Guiar o olhar

Criar continuidade

Explicar mudanças de estado

Reduzir sensação de espera

Reforçar hierarquia

---

Nunca devem:

Distrair

Atrasar a navegação

Parecer infantis

Competir com o conteúdo

---

# Biblioteca

Utilizar:

Framer Motion

Nunca utilizar bibliotecas pesadas.

---

# Duração

Micro interação

120ms

---

Hover

180ms

---

Entrada

250ms

---

Modal

280ms

---

Drawer

300ms

---

Página

350ms

---

Nunca ultrapassar

500ms

---

# Curvas

easeOut

Elementos entrando.

---

easeInOut

Mudanças suaves.

---

spring

Pequenas interações.

Nunca exagerar.

---

# Entrada de Página

Ao carregar uma página:

Fade

Opacity

0 → 1

TranslateY

16px → 0

Duration

300ms

---

# Hero

Sequência

Navbar

↓

Badge

↓

Título

↓

Descrição

↓

Botões

↓

Dashboard

Intervalo

60ms

entre elementos.

---

# Scroll Reveal

Cada seção aparece apenas uma vez.

Nunca repetir.

---

Elementos

Fade

TranslateY

24px

Opacity

0

↓

Opacity

1

TranslateY

0

---

Delay

Escalonado.

---

Cards

Entram em cascata.

Cada card:

+60ms

---

# Hover

Botões

Scale

1 → 1.02

---

Cards

TranslateY

-4px

Border muda suavemente.

---

Ícones

Scale

1.05

ou

Rotate

3°

Nunca mais que isso.

---

# Links

Underline cresce da esquerda.

180ms

---

# Navbar

Hero

Transparente.

↓

Scroll

Background branco.

Blur

Border inferior.

Shadow extremamente discreta.

---

# Mega Menu

Fade

Scale

0.98

↓

1

Duration

180ms

---

# Dashboard Preview

Indicadores aparecem um após outro.

Nunca todos juntos.

---

# Contadores

Animar apenas uma vez.

Quando entram na viewport.

---

# Progress

Preencher suavemente.

Nunca instantâneo.

---

# Accordion

Abrir

Height Auto

Fade

Rotate ícone

180°

---

# Tabs

Linha inferior desliza.

Conteúdo troca com Fade.

---

# Modal

Backdrop

Fade

Blur

Conteúdo

Scale

0.96

↓

1

Fade

---

# Drawer

Deslizar lateralmente.

Nunca Fade puro.

---

# Tooltip

Fade

TranslateY

4px

---

# Toast

Entrar

Slide Right

Fade

Sair

Fade

---

# Loading

Sempre Skeleton.

Nunca spinner sozinho.

---

# Skeleton

Animação shimmer.

Muito discreta.

---

# Formulários

Focus

Border laranja.

Glow extremamente leve.

---

Erro

Shake pequeno.

Nunca exagerado.

---

Sucesso

Ícone aparece.

Fade.

---

# Botões

Loading

Texto desaparece.

Spinner pequeno.

Mesmo tamanho.

Sem mudar largura.

---

# Mouse

Cursor padrão.

Sem efeitos personalizados.

---

# Parallax

Muito discreto.

Apenas Hero.

Máximo

20px

---

# Vídeos

Nunca autoplay com áudio.

Preferir loop silencioso.

---

# Scroll

Scroll suave.

Nunca lento.

---

# Página

Mudança entre páginas.

Fade.

Sem efeitos chamativos.

---

# CTA

Quando entra na viewport.

Fade.

Scale

0.98

↓

1

---

# Footer

Fade apenas.

---

# Performance

Todas animações:

GPU Accelerated.

transform

opacity

Nunca animar:

width

height

left

top

Sempre utilizar:

translate

scale

opacity

---

# Reduced Motion

Respeitar

prefers-reduced-motion

Desabilitar:

Parallax

Scale

Scroll Reveal

Animações longas

---

# Mobile

Reduzir:

Quantidade

Distância

Duração

---

# Nunca Fazer

Bounce

Zoom exagerado

Flip

Rotate 360°

Animações infinitas

Elementos piscando

Texto deslizando continuamente

Carrosséis automáticos

Confetes

Efeitos chamativos

---

# Sempre Fazer

Microinterações

Feedback visual

Scroll elegante

Hover suave

Transições rápidas

Movimentos discretos

---

# Inspiração

As animações devem transmitir a mesma sensação de qualidade encontrada em grandes produtos digitais modernos.

O objetivo não é impressionar pelo movimento, mas pela fluidez e consistência da experiência.

---

# Conclusão

Toda animação deve melhorar a experiência.

Se uma animação não ajuda o usuário a entender a interface, ela não deve existir.

A experiência da Orkiestri deve ser lembrada pela naturalidade, rapidez e sensação de produto premium.