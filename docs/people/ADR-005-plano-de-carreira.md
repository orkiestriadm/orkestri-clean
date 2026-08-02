# ADR-005 — Plano de carreira

**Data:** 30/07/2026
**Situação:** aceito, implementado na versão 1.4.0

## Contexto

O módulo People fechou as fases 0–7 (cadastro, documentos, férias, benefícios,
desenvolvimento, remuneração, feedback) sem plano de carreira. Era a última
lacuna funcional: o sistema sabia quanto alguém ganha e como foi avaliado, mas
não sabia responder **"o que falta para essa pessoa crescer"**.

Havia três peças já no lugar que qualquer desenho precisava respeitar:

| Peça | O que já governa |
|---|---|
| `Position` (cargo) | nível (`nivel`) e **faixa salarial** (`salario_minimo/medio/maximo`) |
| `CollaboratorSkill` | competência em escala júnior → especialista |
| `PerformanceReview` | nota de avaliação, ciclos, metas |

## Decisão

### 1. A trilha ordena CARGOS. Não existe nível dentro do cargo.

A alternativa óbvia era criar níveis internos — "Analista I, II, III" dentro do
cargo "Analista". Foi **recusada**.

O catálogo de cargos já carrega o nível, e a faixa salarial está amarrada ao
cargo. Um segundo eixo criaria duas respostas para a mesma pergunta — *que
nível essa pessoa é?* — e a faixa não saberia a qual das duas obedecer: a
pessoa seria "Analista II" com a faixa de "Analista", sem lugar para a diferença.

Com a trilha ordenando cargos, **progredir é passar a ocupar o próximo cargo**.
Isso move faixa salarial, organograma e histórico funcional de uma vez, porque
todos os três sempre foram governados pelo mesmo campo (`positionId`).

Consequência aceita: uma organização que queira degraus mais finos precisa
cadastrá-los como cargos. É o custo de ter uma verdade só.

### 2. O valor está na prontidão, não no desenho.

Uma trilha desenhada é um diagrama. O que muda uma conversa de carreira é
responder, com nome e número, **o que falta para o próximo degrau**. Por isso o
núcleo do módulo é `avaliarProntidao()` — puro, testável sem banco, com 31
testes.

Regras que os testes fixam:

- **Conferência manual nunca é dada como atendida sozinha** e **não entra no
  percentual**. Contá-la como pendência deixaria a pessoa presa num número que o
  sistema jamais completa; contá-la como atendida seria mentir.
- **Diferencial** (requisito não obrigatório) conta a favor sem travar: aparece
  como próximo passo, não como bloqueio.
- **Degrau sem requisito automático fica em 100%, não em 0%.** Não é um degrau
  impossível — é um degrau que depende só de decisão.
- **Sem data de referência, o tempo vira conferência, não pendência.** Mostrar
  "0 de 18 meses" para quem talvez já tenha os 18 é culpar a pessoa por um
  cadastro incompleto.
- **Sem nenhuma avaliação, a nota exigida FICA pendente.** Aqui a ausência *é* a
  pendência: ninguém confere por fora o que não foi avaliado.

### 3. Tempo no degrau sai do histórico, não de coluna nova.

`collaborator_history` já grava `mudanca_cargo` no campo `positionId` desde a
Fase 1. Uma coluna `desde_quando_no_cargo` criaria uma segunda verdade que
diverge na primeira correção manual. Sem evento de mudança, vale a admissão —
quem nunca mudou de cargo está nele desde que entrou.

### 4. A trilha do colaborador é opcional e inferível.

`collaborators.career_track_id` é nulo por padrão. Quando nulo, o serviço
**infere** a trilha pelo cargo atual — mas só decide quando o cargo aparece em
**exatamente uma** trilha ativa. Com duas, escolher a primeira seria chutar em
silêncio; a tela precisa poder dizer "defina a trilha".

Exigir o preenchimento obrigaria a migrar o quadro inteiro antes de a primeira
trilha existir, que é a ordem inversa do uso real.

### 5. Ler é amplo, desenhar é restrito.

`people.carreira:ver` entra nos perfis de leitura padrão; `people.carreira:gerenciar`
não. Um plano de carreira que a pessoa não pode consultar não muda comportamento
nenhum — é o oposto de salário, que é restrito por natureza.

## Modelo

```
career_tracks           trilha (nome, ativo)
career_track_steps      degrau = (trilha, cargo, ordem) + meses_minimos + nota_minima
career_step_requirements requisito do degrau: competencia | treinamento | manual
collaborators.career_track_id  trilha atribuída (opcional)
```

Restrições que valem citar:

- `UNIQUE(track_id, ordem)` — dois degraus na mesma posição tornariam "o
  próximo" ambíguo, que é a pergunta que a tela existe para responder.
- `UNIQUE(track_id, position_id)` — o degrau atual é descoberto pelo cargo;
  repetição faria a descoberta empatar.
- `position_id` com **RESTRICT** — apagar um cargo que é degrau abriria um
  buraco no meio da progressão e o "próximo degrau" de quem está abaixo passaria
  a apontar para o errado, em silêncio.
- `career_track_id` com **NOT VALID** — a base de produção tem linha com FK
  quebrada apesar das constraints, e validação retroativa já derrubou a API por
  20 minutos no deploy do People.

## Alternativas descartadas

**Nível dentro do cargo.** Ver decisão 1 — duas verdades sobre nível, faixa sem
dono.

**Requisitos só estruturados (sem texto livre).** A parte que mais importa numa
promoção raramente é automatizável ("liderar um projeto de ponta a ponta"). Um
sistema que só aceita o que sabe medir empurra a decisão real para fora dele.

**Requisitos só em texto livre.** Aí não há prontidão nenhuma a calcular, e a
trilha vira o PDF que ninguém abre.

**Promover pelo sistema.** Fora de escopo: a mudança de cargo já existe em
`PUT /employees/:id` e passa pelo histórico funcional. Duplicar isso na carreira
criaria dois caminhos para o mesmo fato.
