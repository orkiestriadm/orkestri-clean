# Inventário de sincronização — 28/10/2026

Cópias de preservação de trabalho local; não são releases nem autorização para deploy. Nenhuma branch original foi trocada ou reescrita. Os commits foram preparados com índices temporários, sem alterar os índices das outras IAs.

Base de coordenação: main em `3859c35e2502907a4346f60c77b9eba5325ba84d`. Total de pastas inventariadas: 33.

| Branch de preservação | Commit | Arquivos pendentes preservados |
|---|---|---:|
| `codex/sync-20261028/hub-local` | `a85fef953c4c91eb9f6da9f49ebc4855ae1eddcb` | 910 |
| `codex/sync-20261028/admiring-yalow-ad576c` | `401c3e6d226e916b83ad4aa8831333374fcf53ff` | 1 |
| `codex/sync-20261028/intelligent-chatterjee-246299` | `1dc34c26e66ca0f4924654dce8675fcdaaa01179` | 1 |
| `codex/sync-20261028/interesting-archimedes-aa3639` | `2be9973276f27ea385e6f7fcc6cd8f729a1b6255` | 6 |
| `codex/sync-20261028/landing-page-audit-redesign-2a4359` | `314f95480f1d3adda8d2803198c98160c3cba004` | 44 |
| `codex/sync-20261028/pensive-mclaren-070752` | `19b2f4b62965d02685d1ba705d923da1df94b639` | 20 |
| `codex/sync-20261028/sweet-elion-0fd745` | `83421ba2a7f48fff07f7b17bb8e2a060309430d3` | 6 |
| `codex/sync-20261028/thirsty-neumann-1a8c88` | `7cdf5515afbb63a6181138cc70d68c0709ae2140` | 123 |
| `codex/sync-20261028/zen-jepsen-3e18cf` | `854c523cc91587105a984545469c7abf8ccafdf9` | 1 |
| `codex/sync-20261028/history-99ace3db3453` | `99ace3db3453199fbcca66ebf2e7d832897517da` | 0 |
| `codex/sync-20261028/history-8bada01354ad` | `8bada01354ad127ddadfa58a0285a4a7d6c158a4` | 0 |
| `codex/sync-20261028/history-91d58e2cbd64` | `91d58e2cbd6454e9d32c804fab4b3217e2477f85` | 0 |
| `codex/sync-20261028/history-35aa5c9a9403` | `35aa5c9a9403122aac2a300deb2b9ea932d14d59` | 0 |
| `codex/sync-20261028/history-98b834f5c9be` | `98b834f5c9be2edf9a8f8c4aff6fdd4147092730` | 0 |
| `codex/sync-20261028/history-6c05f2f7f6ba` | `6c05f2f7f6baf4b4908b3fd5d4fc2befebf2108d` | 0 |
| `codex/sync-20261028/history-308e45c0078d` | `308e45c0078d0e6273f5fb3392c7ae56949b6960` | 0 |

## Exclusões

Não foram incluídos arquivos de ambiente, chaves, caches, builds, sessões, seeds temporários SQL, documentos internos, materiais de clientes e documentos binários sem revisão de conteúdo. Backups before-* também permanecem locais. A lista detalhada de caminhos excluídos está em `.sync-review/reviewed-inventory.json` na máquina original, fora do Git público. As exclusões não apagam os arquivos locais.

## Validação e uso

Os arquivos candidatos foram inspecionados por padrões de credenciais, com revisão das ocorrências de configuração e testes. Isso reduz o risco, sem certificar ausência de qualquer dado sensível. As cópias preservam trabalho em andamento e não receberam validação funcional completa. Não executar scripts de publicação nem testes que usem serviços reais.

A próxima IA deve escolher uma única base de produto conforme `SINCRONIZACAO_GITHUB.md`. As branches history-* preservam sete commits que ainda não eram alcançáveis pelas branches remotas consultadas. Não fazer merge automático dessas versões antigas na main.

## Resultado da sincronização

As 17 branches foram enviadas ao GitHub em 28/10/2026: nove cópias de trabalho pendente, sete referências para histórico local e a branch de coordenação. A main permaneceu em 3859c35e2502907a4346f60c77b9eba5325ba84d.

Validações locais: git diff --check passou na branch de coordenação; três suites Jest isoladas da linha Hub passaram (11 testes): auth.cooldown, whatsapp-rotina e whatsapp-status. Os testes usam mocks e funções locais; não foram executados testes contra produção, deploys, builds de containers ou migrations. Esses resultados não validam funcionalmente todas as árvores preservadas.

A revisão automática bloqueou inicialmente o envio amplo por possíveis credenciais. A revisão adicional classificou as 37 ocorrências incluídas: 23 fixtures sintéticas de testes, oito expressões que usam tokens em tempo de execução sem valor fixo e seis ocorrências de senha padrão já existente na branch Hub pública. Nenhum segredo novo foi identificado nessa revisão. A verificação de padrões dos 17 commits a enviar não apontou ocorrências pendentes; o envio foi então autorizado pela revisão e concluído.
