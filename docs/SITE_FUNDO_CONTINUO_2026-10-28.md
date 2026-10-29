# Fundo contínuo e monograma da Aurélia — 28/10/2026

Branch: `codex/site-continuous-atmosphere`. Base: `origin/codex/site-orange-gradients` em `f92c8131ba66a58eb6c0dbad21f879c135b8ec32`.

## Problema e resultado

O degradê e a textura reiniciavam em cada seção, criando faixas horizontais entre os blocos. Ambos passam a ocupar camadas fixas únicas atrás da página inteira. Seções e rodapé ficam transparentes, sem divisórias; a área da agenda passa ao mesmo tema escuro. Os menus usam o mesmo campo de luz com base opaca para preservar a legibilidade.

A composição da Aurélia deixa de usar medalhão e órbitas. Um monograma amplo, com preenchimento e contorno suaves, gira em 70 segundos atrás da captura real do WhatsApp. A captura permanece fixa e clicável. A animação respeita movimento reduzido; nenhum pixel das imagens reais foi alterado.

## Verificação

- Inspeção visual das junções da home, agenda, produtos e página de cadastro em desktop e celular, incluindo a diferença de textura que o teste anterior de presença de degradê não detectava.
- Auditoria de 25 páginas: fundo único fixo e seções transparentes, sem transbordamento em 1440 px; sete páginas principais também conferidas em 390 px.
- Menu móvel conferido com fundo opaco, sem texto da página atravessando a navegação.
- TypeScript aprovado. Build local gerou 32 páginas; aviso conhecido de symlink standalone no Windows. A imagem de publicação será construída e verificada em Linux, isolada da rede.
- Actions e webhooks GitHub conferidos antes do push: nenhum configurado. Main permanece protegida.

## Publicação autorizada

O usuário autorizou expressamente publicar esta correção sem nova confirmação. O escopo é exclusivamente o serviço website, com auditoria dos fontes, preservação dos demais containers, imagem anterior para rollback e verificações públicas após a troca. Não executar migrations, seeds ou mensagens reais. O resultado da publicação será registrado em documento próprio após a validação.
