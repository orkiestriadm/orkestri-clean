# A planilha de origem — sgi.xlsx

Análise da planilha que o módulo Compliance substitui. Serve para justificar as
decisões de modelagem que a especificação (`gestaodeobrigacoes.md`) não previa,
e para que quem mexer no módulo depois entenda **por que** certas regras existem.

Autor da planilha: Carlos Eduardo dos Santos. Duas abas, 12 colunas idênticas,
36 registros.

---

## Estrutura original

| Col | Cabeçalho | Natureza |
|---|---|---|
| A | Item | numeração manual |
| B | Tipo de Licença / Documento | texto livre — mistura sigla + descrição + nº do processo + escopo |
| C | Validade (Anos) | número, **decorativo**: não gerava nada |
| D | Data de Emissão | data |
| E | Data de Validade | data digitada |
| F | Prazo Mínimo de Solicitação de Renovação (dias) | exigência do órgão |
| G | Prazo Interno de Renovação | **fórmula `=E−F−60`** |
| H | Prazo Fatal de Renovação | **fórmula `=E−F`** |
| I | Status | texto livre, digitado |
| J | Observação | texto livre, digitado |
| K | Responsável | 4–5 e-mails empilhados numa célula |
| L | Telefone | 4–5 telefones empilhados na mesma célula |

Aba 1 = **Meio Ambiente** (18 itens), aba 2 = **Segurança do Trabalho** (18).
As abas viraram as categorias.

**Toda a automação eram essas duas fórmulas.** Nenhuma formatação condicional,
validação de dados, autofiltro, farol de cor, comentário ou macro. `Status` e
`Observação` eram digitados à mão.

---

## As regras que sobreviveram ao módulo

### 1. Prazo fatal = validade − antecedência exigida pelo órgão

É o último dia para protocolar dentro da janela legal. **Não é a validade** —
confundir os dois faz alguém perder a licença achando que tinha quatro meses.

Vive em `domain/obrigacao.entity.ts → calcularPrazos()`.

### 2. Prazo interno = prazo fatal − folga

A folga era `60` hardcoded dentro da fórmula. No módulo é política da categoria
(`ComplianceCategoria.folgaInternaDias`), porque licença ambiental e laudo de
insalubridade não têm a mesma inércia.

### 3. Renovação automática por protocolo tempestivo

**Esta regra não está na especificação e é a mais importante da planilha.**

Três licenças ambientais estavam vencidas há anos e mesmo assim marcadas
`Válida - Renovação Automática`:

| Item | Validade | Status na planilha |
|---|---|---|
| LO 709/2008 | 31/07/2012 | Válida – Renovação Automática |
| ASV 970/2014 | 29/03/2020 | Válida – Renovação Automática |
| LI 1212/2018 | 25/04/2022 | Válida – Renovação Automática |

Não é erro: o protocolo tempestivo de renovação prorroga a validade até decisão
do órgão. Sem representar isso, o painel acusaria vencimento permanente e o
usuário aprenderia a ignorar o alerta.

No módulo: `renovacaoAutomatica` + `protocoloNumero`/`protocoloEm`, com a
materialização em `prorrogacaoVigente`. Só o protocolo **tempestivo** prorroga —
ver o caso da ABIO abaixo.

---

## O que a planilha não estava pegando (em 06/08/2026)

| Item | Aba | Validade | Prazo interno | O que a planilha dizia |
|---|---|---|---|---|
| AVCB Sede Administrativa | SST | 17/08/2026 (11 dias) | 18/06/2026 — vencido | Status "Válida", observação **vazia** |
| ABIO 960/2018 | MA | 29/08/2026 (23 dias) | 01/05/2026 — vencido | "Fora do Prazo", anotado à mão |
| CCB Fábrica de Placa | SST | 05/09/2026 (30 dias) | 07/07/2026 — vencido | Status "Válida", observação **vazia** |
| CCB BSO 4 | SST | 19/10/2026 | 20/08/2026 (14 dias) | prestes a estourar |

**16 dos 36 vencem ainda em 2026**, 11 só na aba de SST — cinco no mesmo dia
22/12. A concentração de out–dez/2026 sozinha justifica o módulo.

Depois da carga, o módulo classifica exatamente esses casos sem ninguém digitar
nada: 3 vencidas, 1 com prazo fatal estourado, 2 com renovação devida.

---

## Defeitos de dado preservados na carga

Preservados de propósito, com aviso no console do seed — corrigi-los em silêncio
esconderia problema real do cliente.

- **Duplicata:** BSO 5 e BSO 6 têm o mesmo número de CCB `264433/3529005/2023`.
- **Coluna C não bate com E:** BSO 1 tem "3 anos", emissão 22/12/2023, validade
  06/01/2027 (3a + 15d). LI 1514/2025 e LI 1510/2025 erram por 1 dia; AVCB P3
  por 3. A validade **digitada** prevalece.
- **`LI` significa duas coisas:** Licença de Instalação (MA) e Laudo de
  Insalubridade (SST). Por isso a sigla é campo da obrigação e não cadastro
  global.
- **Numeração quebrada:** o Laudo de Periculosidade não tem nº de item; o item 3
  fica compartilhado.
- **Responsáveis desalinhados:** a aba SST tem 4 e-mails para 5 campos de
  telefone na primeira linha. E a lista é idêntica em todas as linhas — na
  prática é responsabilidade *por categoria*, não por obrigação.
- **Erros de digitação nos cabeçalhos:** "Solitação", "Solictação", "À Vencer".
  Só `"Fábrica d ePlaca"` foi corrigido (para "Fábrica de Placa"), por ser nome
  de instalação que vira dimensão de agrupamento.

---

## Campos que estavam escondidos dentro da coluna B

O escopo estava enfiado no nome do documento. Viraram dimensões próprias:

| Como estava | Virou |
|---|---|
| `(Sede Administrativa)`, `(P1)`…`(P4)`, `(BSO 1)`…`(BSO 7)`, `(Fábrica de Placa)` | `unidade` |
| `(Lote 1)`, `(Lote 3)` | campo personalizado "Lote / Obra" (e `projectId` quando houver projeto) |
| `Nº Série: 368956544` | `ativoIdentificador` — **9 dos 36** registros são obrigações de um EQUIPAMENTO |
| `LO`, `ASV`, `AVCB`… | `sigla` |
| `709/2008`, `1035.8.2025.63314` | `numeroDocumento` |

---

## O que NÃO foi preenchido na carga

Deixado em branco de propósito. A planilha não tem essas colunas, e deduzi-las
entregaria dado plausível que ninguém conferiu:

- **Órgão emissor** — exceto onde o próprio nome do documento o declara
  ("Auto de Vistoria do **Corpo de Bombeiros**").
- **Custos**, centro de custo, fornecedor, nota fiscal.
- **Criticidade individual** — atribuída por tipo de documento, não por item.
- **Protocolo das três licenças de renovação automática** — a planilha marcava a
  flag mas nunca registrou número nem data. Por isso elas aparecem como
  **vencidas** no painel, que é a verdade: sem protocolo registrado não há
  prorrogação.

---

## Lacunas da especificação frente à planilha

A especificação é superset da planilha em quase tudo (anexos, custos, órgão,
workflow, auditoria, versionamento — nada disso existia). Mas **cinco regras da
planilha não estavam nela**, e todas foram implementadas:

1. Renovação automática / prorrogação por protocolo tempestivo.
2. Prazo mínimo do órgão, com **prazo fatal derivado** — a especificação tratava
   "Data limite (fatal)" como campo digitado.
3. Folga interna configurável (os 60 dias da fórmula).
4. Obrigação vinculada a **equipamento/nº de série**, não só a empresa/filial.
5. Separação entre **status declarado** e **situação derivada**. Na planilha,
   `Status` e `Observação` misturavam três conceitos: estado do documento
   (`Válida`), etapa de processo (`Pendente de Análise`) e um valor derivado da
   data (`À Vencer`) que era digitado à mão — e por isso estava errado em três
   linhas.
