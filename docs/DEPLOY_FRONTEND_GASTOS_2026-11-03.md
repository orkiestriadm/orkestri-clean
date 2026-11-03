# Publicação do frontend 5.1.2 — 03/11/2026

Publicação expressamente autorizada pelo usuário. Código: **4d3ac85**, branch **claude/orkiestri-audit-benchmark-4a28b4**.

## O que entrou

A tela **Meus Gastos** parou de esconder o erro e passou a dizer de qual conta é a lista.

O caso que originou a correção: uma conta com nove gastos corretos no banco, a API respondendo 200, e a tela mostrando "Comece a anotar seus gastos". Custou um dia de investigação. Duas causas, as duas de interface:

1. O `catch` era vazio, com o comentário *"silencioso: a tela mostra estado vazio"*. Falha de rede, 403 e "você não tem gasto nenhum" viravam a mesma tela. Agora o erro tem estado próprio, com mensagem distinta para 403 e para falha de rede, e botão de repetir.
2. Nada dizia de quem era a lista. Gasto é filtrado por usuário, de propósito — é a regra de privacidade publicada na página de segurança. Mas, na conta errada, isso aparecia como "você não tem nada". O e-mail da sessão agora aparece no subtítulo e no estado vazio.

## Só o frontend subiu, e a versão diz isso

`frontend/src/lib/version.ts` foi para **5.1.2**; `backend/.../health.module.ts` ficou em **5.1.1**, de propósito. O comentário do próprio `health.module.ts` explica: as constantes são separadas para que a divergência revele deploy pela metade. É exatamente o que está acontecendo, e é informação, não defeito.

**Por que a API não subiu:** o branch carrega `b4a05ff`, o núcleo de regras do plano anual, que é trabalho em andamento e não foi testado com as dependências instaladas. Construir a API a partir deste branch levaria esse código a produção. O diff conferido antes do build mostrou exatamente um arquivo de diferença no frontend e um no backend — e só o do frontend foi publicado.

## Procedimento

Mesmo da série do site. Build local `linux/amd64` com `--provenance=false --sbom=false`, candidato exercitado em container isolado, SHA-256 conferido nas duas pontas, tag de rollback antes da troca.

Os build args ficaram nos **padrões do Dockerfile** (`NEXT_PUBLIC_MARCA=Orkiestri`), que é como a produção foi construída. Conferido no candidato: seis ocorrências de "Orkiestri" e nenhuma de "Hub" ou "Transbrasiliana" — a marca do white-label de homologação não vazou.

| | |
|---|---|
| Código | `4d3ac85` |
| Imagem ativa | `sha256:95189d35fa70fd21ba6792f7359719b0b7b1526196c595a78258addc544cb976` |
| Rollback | `orkestri/frontend:rollback-gastos-20261103` → `sha256:13b750aefbe019b6fd4b9acfcfd55eef1f84dacde21f1ffdd8ea71925a9e66a8` |
| SHA-256 do pacote | `14d0e7d871240ec4cd059b6c952675194868ed8c47033ee90d75ce4355e075c3` |
| Container | `orkestri_frontend` `7bfbeae60ec9` → `b7988949d876` |

Os outros nove containers mantiveram o id e a API seguiu `healthy`. Sem migration, seed, alteração de conta ou envio de mensagem.

## Validação

**Antes de publicar**, a tela foi vista rodando na stack local, com um usuário de teste e três gastos semeados. Os três estados conferidos no navegador:

- com gastos, o subtítulo traz a conta da sessão;
- sem gastos, o estado vazio diz "Lançou em outra conta? Os gastos ficam na conta de quem lançou";
- com 403 (permissão revogada de propósito na conta de teste), a mensagem de acesso e o botão de repetir.

O 403 levou quase cinco minutos para aparecer: o cache de permissões do Redis tem TTL de 300s e segurava a permissão antiga. É o comportamento conhecido, e vale lembrar dele em qualquer mudança de permissão.

Os dados de teste foram apagados do banco local depois. Ficaram a senha de teste e a marca de primeiro acesso limpa na conta `maria.teste@exemplo.local`, que é usuário de desenvolvimento.

**Depois da troca:** três rotas públicas em 200 por HTTPS, as duas frases novas presentes no `page.js` da imagem em execução, bundle em 5.1.2, `/api/health` em 5.1.1 e a tela de login conferida no navegador na URL pública, com formulário e marca certos.

Rollback preparado e não acionado.

## Pendências que esta publicação não toca

- O backend do plano anual está pronto em `claude/ecstatic-sammet-9e9b04` (commit `cdcee37`), fora deste checkout e não publicado. A chave `PLANO.anualAtivo` do site segue `false`.
- `b4a05ff`, o núcleo de regras do anual neste branch, continua sem deploy.
- Prova social e a separação entre consultoria e produto seguem com o cliente.
