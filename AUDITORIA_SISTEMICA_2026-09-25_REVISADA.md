# Auditoria sistêmica — revisão e plano de execução

**Data:** 25/09/2026
**Documento de origem:** `AUDITORIA_SISTEMICA_2026-09-25.md` (mantido como está)
**Bases conferidas:** Hub (homologação) = `origin/hub/desbloqueio-usuario` · 1.46.2 — Produção = `origin/main` · 1.35.0
**Natureza:** parecer e plano para aprovação. Nada aqui foi executado; cada etapa depende de aprovação explícita.

---

## 1. Parecer

O relatório original é **um bom diagnóstico e merece confiança**. Conferi no código, uma a uma, as evidências de 30 achados P0/P1: todas existem como descritas, nas duas bases. Não encontrei achado inventado. O método é honesto (separa confirmado de hipótese, declara o que não executou) e a seção de cuidados é valiosa.

Ele não serve, porém, como plano de execução sem ajustes, por cinco motivos:

1. **Auditou o ambiente errado para o nosso uso.** Leu a `main` (produção 1.35.0). Quem tem usuários e dados reais é o Hub (1.46.2), com base própria. Toda correção nasce no Hub e só vai à produção item a item, com aprovação — regra já em vigor.
2. **Não conhece o contexto dos ambientes.** Trata tudo como SaaS multiempresa. A produção quase não tem dado operacional; o Hub é da Triunfo e tem RH, frota, compliance e documentos reais. Para o Hub o maior risco é **perder dado** e **tomada de conta**; isolamento entre empresas pesa mais na produção.
3. **Subestima um achado.** SEG-22 foi classificado P1 "a validar". Pelo código, **o e-mail sozinho concede Super Admin** (`auth.service.ts:758–760`, Hub). Dependendo de configuração (seção 3), isso pode ser tomada total da plataforma. Sobe para P0.
4. **Tem um erro factual.** INF-10 diz que o worker de monitoramento não existe; ele roda no Hub (`orkestri_monitor_worker`). O problema real é falta de documentação e de versionamento dele.
5. **70 itens é mais do que o necessário.** Os P0/P1 concretos justificam trabalho. Boa parte dos P2/P3 são boas práticas genéricas; entram no backlog só quando houver problema real.

---

## 2. O que muda em relação ao original

| Tema | Original | Revisado | Por quê |
|---|---|---|---|
| SEG-22 Super Admin por e-mail | P1 · a validar | **P0** · validar primeiro | E-mail editável concede privilégio global; ver seção 3 |
| INF-01/02 backup sem documentos | Etapa B | **Etapa 1** | Hub tem documentos reais de RH/compliance/frota sem cópia |
| SEG-03 usuários | P1 | P1, **parcial no Hub** | Desbloqueio já confere organização desde 1.46.2 (hoje) |
| INF-10 worker | "não localizado" | documentar | O worker existe e roda no Hub |
| DAD-07 portal | P1 | P1, **verificar uso** | Se o portal é usado, abrir chamado deve estar falhando; se não, cai de prioridade |
| SEG-01 2FA | P0 | P0, **com opção rápida** | Se ninguém usa 2FA, esconder a opção resolve o risco de "falsa segurança" até o fluxo ficar pronto |
| Etapa D (UX) e matriz de módulos | plano | **backlog** | Sem defeito concreto demonstrado, exceto UX-07 |

---

## 3. Fatos que precisam ser levantados antes de mexer (Etapa 0)

São leituras, sem alteração. Foram bloqueadas nesta sessão por permissão; precisam de liberação.

| # | Pergunta | Onde | Por que muda o plano |
|---|---|---|---|
| F1 | Qual o valor de `SUPER_ADMIN_EMAIL` em Hub e produção, e **existe um usuário com esse e-mail** em cada banco? | env do container `api` + `users` | Se o e-mail configurado não existir como usuário, **qualquer pessoa que se cadastrar com ele vira Super Admin** (produção tem cadastro público de teste pela landing). É o item mais urgente do documento. |
| F2 | Quantas organizações o Hub tem e em qual está o usuário SA? | `organizations`, `users` | Define o peso de SEG-03..07 no Hub e se um administrador consegue criar o e-mail do SA na própria empresa. |
| F3 | Alguém tem 2FA ligado? | `user_profiles.two_factor_ativo` | Decide entre fazer o fluxo completo agora ou esconder a opção. |
| F4 | Existe e-mail duplicado entre organizações? | `users` | Login pega o primeiro que achar (SEG-22). |
| F5 | O `/sa/` responde de fora, no Hub e na produção? `SA_TOKEN` está definido? | nginx + env `sa_panel` | Define a urgência real de SEG-11/12/13. |
| F6 | Que backup roda de fato no Hub (cron, destino, volumes), e quando foi o último restaurável? | crontab, diretórios, volumes | Define o trabalho de INF-01..04. |
| F7 | O portal do cliente e a Base de Conhecimento pública (`/kb`) são usados? | acessos / registros | Prioridade de DAD-07 e SEG-14. |
| F8 | Há usuários com `primeiro_acesso` pendente e senha temporária? | `users` | Mede a exposição de SEG-02 + SEG-23. |

**Pronto quando:** as oito respostas estão registradas neste documento, e o plano abaixo é reajustado se alguma mudar a prioridade.

---

## 4. Situação dos achados P0/P1 conferidos

Legenda: ✅ confirmado no código · ⚠️ confirmado, impacto depende da Etapa 0 · 🟡 parcialmente resolvido · — não reconferido.
Referências de linha são da base do Hub.

### Autenticação e acesso

| ID | Achado | Hub | Prod | Evidência | Etapa |
|---|---|---|---|---|---|
| SEG-22 | E-mail concede Super Admin; login ambíguo por e-mail | ⚠️ | ⚠️ | `auth.service.ts:758–760` compara com `SUPER_ADMIN_EMAIL` (padrão `administrator@orkiestri.com`) | **1** |
| SEG-02 | Regra de primeiro acesso nunca bloqueia | ✅ | ✅ | `main.ts:97` guard global; `first-access.guard.ts:23` libera quando ainda não há usuário — e sempre não há, porque roda antes do JWT | **1** |
| SEG-01 | Login não exige 2FA | ✅ | ✅ | `login()` não lê `twoFactorAtivo`; `twofa.module.ts:74–90` só devolve "válido" | 2 |
| SEG-23 | Senha temporária e código de teste com `Math.random` | ✅ | ✅ | `auth.service.ts:1034`, `:1204` | 2 |
| SEG-19 | Token de reset usa o mesmo segredo do acesso; troca de senha não derruba sessões | ✅ | ✅ | `auth.service.ts:1451` (`type: "reset"`); `jwt.strategy.ts` não confere tipo | 2 |
| SEG-09 | Política de senha gravada numa organização fixa e não aplicada | ✅ | ✅ | `twofa.module.ts:191–219` usa `DEFAULT_ORG` | backlog |
| SEG-18 | Redis fora do ar desliga rate limit e revogação | ✅ | ✅ | `cache.service.ts:67–73` devolve 0 | 4 |
| SEG-21 | Rate limit confia no 1º IP do `X-Forwarded-For` | ✅ | ✅ | `auth.controller.ts:118`, `:140` | 4 |

### Painel SA e conteúdo ativo

| ID | Achado | Hub | Prod | Evidência | Etapa |
|---|---|---|---|---|---|
| SEG-11 | Comando de shell montado com nome/e-mail | ⚠️ | ⚠️ | `sa-panel/server.js:141–143` (`exec` + só escapa aspas) | **1** |
| SEG-12 | Pasta do servidor servida como estática, antes da autenticação | ✅ | ✅ | `server.js:110` | **1** |
| SEG-13 | Token padrão `change-me-in-production`; token em `localStorage`; `innerHTML` | ⚠️ | ⚠️ | `server.js:10`; `index.html:1138`, `:1120` | **1** |
| SEG-14 | Base de Conhecimento renderiza HTML sem sanitizar (inclusive `/kb` público) | ✅ | ✅ | `conhecimento/page.tsx:347`, `kb/page.tsx:110`; nenhum sanitizador no frontend | **1** |

### Isolamento entre empresas e permissões

| ID | Achado | Hub | Prod | Evidência | Etapa |
|---|---|---|---|---|---|
| SEG-03 | Usuário alterado antes de conferir a empresa | 🟡 | ✅ | `users.module.ts:299` (`findUnique` só por id); desbloqueio já corrigido no Hub | 3 |
| SEG-04 | CSAT avalia qualquer chamado pelo id | ✅ | ✅ | `csat.module.ts:37` | 3 |
| SEG-05 | Setores gravam fora do tenant | — | — | apontado pelo relatório; reconferir na execução | 3 |
| SEG-06 | Lembretes editados/excluídos só pelo id | ✅ | ✅ | `alert-config.module.ts:62–67` | 3 |
| SEG-07 | Vínculos aceitam ids de outra empresa | ✅ | ✅ | `apontamentos.module.ts:40`; faturas `contratoId @Allow()`; reservas sem checagem de veículo | 3 |
| SEG-08 | Faturas gravam com permissão de leitura | ✅ | ✅ | 10 rotas com `crm:ver` em `faturas.module.ts` | 3 (com você) |
| SEG-10 | Backup, logs e caminhos acessíveis a master de empresa | ✅ | ✅ | `sistema.module.ts:340–361` | 3 |
| SEG-24 | Aviso de SLA vai para masters de todas as empresas | ✅ | ✅ | `alert.scheduler.ts:171` sem `organizationId` | 2 (com DAD-09) |
| API-02 | Escopo opcional devolve tudo; papéis sem filtro | — | — | reconferir na execução | 3 |

### Integridade de dados

| ID | Achado | Hub | Prod | Evidência | Etapa |
|---|---|---|---|---|---|
| DAD-09 | Escalonamento de SLA quebra (delegate inexistente) | ✅ | ✅ | `alert.scheduler.ts:161` `comentarioChamado` | 2 |
| DAD-01 | Excluir usuário apaga chamados, projetos, aprovações | ✅ | ✅ | 13 `deleteMany` em `users.module.ts` `remove` | **2** (decisão sua) |
| DAD-07 | Portal cria chamado sem organização e com número "máximo + 1" | ✅ | ✅ | `portal.module.ts` ~l.116–130; leitura usa `conteudo/publico` que não existem | 4 (sobe se F7 = usado) |
| DAD-08 | Cadastro de organizações usa `req.user.sub` (não existe) | ✅ | ✅ | 3 ocorrências em `cadastro-request.module.ts` | 4 |
| DAD-02 | Anonimização conta arquivo como removido mesmo com falha | ✅ | ✅ | `document-storage.service.ts:92–94` | 4 |
| DAD-04/05/06 | Reservas, workflows, billing, cadastro e indicação sem transação | ✅ | ✅ | 0 `$transaction` nos cinco módulos | 4 |
| DAD-03 | Dinheiro em `Float` | ✅ | ✅ | schema | backlog (plano próprio) |

### Recuperação e infraestrutura

| ID | Achado | Hub | Prod | Evidência | Etapa |
|---|---|---|---|---|---|
| INF-01 | Backup não cobre volumes de documentos | ⚠️ | ⚠️ | `scripts/backup.sh:61` só `orkestri_uploads_data` | **1** |
| INF-02 | Falha no backup de arquivos termina como sucesso | ✅ | ✅ | `backup.sh:64` `\|\| true` | **1** |
| INF-04 | Restore ignora erro SQL; formato da API (`-Fc`) incompatível com o script | ✅ | ✅ | `restore.sh` sem `ON_ERROR_STOP`; `sistema.module.ts:147` | **1** |
| INF-03 | Backup da API sem volume no compose do git | ⚠️ | ⚠️ | não aparece no `docker-compose.yml`; servidores têm compose editado à mão | 1 (F6) |
| INF-05 | Health não testa banco nem Redis | ✅ | ✅ | `health.module.ts` | 4 |
| SEG-15/16/17/25 | WebSocket, webhook de pagamento, webhook de saída, SSH do OSA | ✅ | ✅ | `monitoramento.gateway.ts:21,68`; `billing.module.ts:1009`; `webhooks.module.ts:155–158`; `osa.module.ts:245` | 4 |
| ENG-01 | CI não ativado | ✅ | ✅ | nenhum `.github/workflows` | 4 |

---

## 5. Plano de execução

### Regras que valem para todas as etapas

1. **Base:** toda correção parte da base atual do Hub (hoje `origin/hub/desbloqueio-usuario`) e é conferida por hash contra o servidor antes de publicar.
2. **Uma entrega por item**, pequena o bastante para revisar. Nada de juntar correção de segurança com refatoração ou redesign.
3. **Todo item tem teste do caso negativo** (ex.: "empresa A não altera registro da B"; "sessão de primeiro acesso recebe 403"). Sem teste, o item não está pronto.
4. **Versão sobe a cada entrega**, nas duas constantes, com histórico na tela Sobre.
5. **Verificação real após publicar:** versão no `/api/health`, login de verdade chegando ao dashboard, marca do Hub no `/login`, e o cenário do item testado na tela ou na API.
6. **Produção só com aprovação item a item.** Chegando lá, a versão segue a linha da produção (1.35.x), não a do Hub.
7. **Backup antes de migration ou script que altere dado**, com contagem de dependentes que aborta — nunca só imprime.

### Etapa 0 — Levantar os fatos (leitura, ~½ dia)
Responder F1–F8 da seção 3. Se F1 indicar que o e-mail do SA não existe como usuário na produção, **o item 1.1 vira emergência**: a correção sobe no mesmo dia, antes de qualquer outra coisa.

### Etapa 1 — Fechar as portas críticas e garantir recuperação

| # | Entrega | Pronto quando | Tamanho |
|---|---|---|---|
| 1.1 | **SEG-22** — Super Admin só pela tabela `super_admins` (por id); remover a concessão por e-mail; login determinístico quando o e-mail existir em mais de uma empresa | Usuário comum com o e-mail do SA não vira SA; o SA real continua entrando e vendo o painel | P |
| 1.2 | **SEG-02** — Primeiro acesso aplicado depois da autenticação (checagem dentro da estratégia JWT ou guard que autentica antes), mantendo troca de senha e logout livres | Sessão com `primeiroAcesso` recebe 403 numa rota comum via API; troca de senha e logout funcionam; login normal inalterado | P |
| 1.3 | **SEG-11/12/13** — Painel SA: `execFile` com argumentos separados e validados; pasta pública dedicada; recusar subir sem `SA_TOKEN`; escapar texto no `innerHTML` | Nome com caracteres de shell é gravado literalmente; `server.js` não é servido por HTTP; sem `SA_TOKEN` o serviço não sobe; provisionar um tenant de teste funciona | M |
| 1.4 | **SEG-14** — Sanitizar o HTML da Base de Conhecimento (interna e `/kb`) | Script e `javascript:` ficam inertes; artigos existentes seguem legíveis (conferir amostra real) | P |
| 1.5 | **INF-01/02/04** — Backup cobrindo banco + todos os volumes de documentos; falha vira erro; restore com parada em erro e formato certo | **Restore de verdade** num banco descartável recupera registros e arquivos de People, Compliance, Frota, Strategy e Projetos | M |

### Etapa 2 — Sessões, credenciais e defeitos que já quebram

| # | Entrega | Pronto quando | Tamanho |
|---|---|---|---|
| 2.1 | **SEG-01** — Opção A: login em duas etapas (senha → desafio TOTP/código de recuperação → sessão), com limite de tentativas. Opção B (se F3 = ninguém usa): esconder o 2FA até a opção A | A: senha certa sem código não acessa nada. B: a opção não aparece mais | A: G · B: P |
| 2.2 | **SEG-23 + SEG-19** — Gerador criptográfico; token de reset com segredo/tipo próprio e uso único; trocar ou resetar senha derruba as outras sessões | Token de reset não abre rota de negócio; dois usos do mesmo reset falham; sessão antiga cai após troca | M |
| 2.3 | **DAD-09 + SEG-24 juntos** — Corrigir o delegate e restringir destinatários à empresa do chamado | Escalonamento grava o comentário interno e avisa só os masters da mesma empresa | P |
| 2.4 | **DAD-01** — Excluir usuário passa a desativar e transferir responsabilidades; expurgo vira ação explícita com prévia do impacto | Remover um usuário não some com chamados, projetos nem aprovações | M |

### Etapa 3 — Isolamento e permissões
SEG-03 (restante), SEG-04, SEG-05, SEG-06, SEG-07, SEG-10, API-02: um padrão só — **resolver o alvo e cada id relacionado dentro da organização antes de gravar** (reaproveitando `acharNaOrganizacao`), com uma suíte de teste que cria duas empresas e tenta cruzar os dados em cada rota corrigida.
SEG-08 (faturas): criar `faturas:editar`/`faturas:baixar`, **definir com você quais papéis recebem** e migrar os perfis antes de trocar as rotas, para ninguém perder acesso.

**Pronto quando:** a suíte de duas empresas passa para todas as rotas da etapa, e um usuário real do Hub continua fazendo o que fazia.

### Etapa 4 — Integridade e robustez
DAD-07 e DAD-08 (defeitos funcionais), DAD-02, DAD-04 (reserva concorrente), DAD-05 (workflow), DAD-06 (billing/indicação, relevante na produção), SEG-15, SEG-16, SEG-17, SEG-18, SEG-21, SEG-25, INF-05 (health com banco e Redis) e ENG-01/02 (CI ativo e integrações não puladas em silêncio — requer permissão de workflows no token do GitHub).
Ordem interna definida ao fim da Etapa 3, pelo que a Etapa 0 mostrar de uso real.

### Backlog — só com problema concreto ou decisão sua
DAD-03 (dinheiro em `Float`: exige plano próprio de migração e reconciliação), SEG-09, SEG-20, API-01/03/04/05/06, ENG-03 a ENG-09, INF-06 a INF-11 (INF-10 vira "documentar o worker"), UX-01 a UX-10 (UX-07, contato do site que confirma sem entregar, pode entrar antes se o site estiver recebendo contatos).

---

## 6. O que este plano deliberadamente não faz

- Não reescreve módulos nem troca arquitetura; o monólito modular fica.
- Não atualiza dependências em massa.
- Não liga `strict` do TypeScript de uma vez.
- Não aplica nada na produção sem pedido item a item.
- Não apaga dados, documentos, scripts ou seeds para "limpar" achados.
- Não declara risco resolvido sem o teste do item e a verificação no ambiente.

---

## 7. Decisões que preciso de você

1. **Liberar a Etapa 0** (leituras no Hub e na produção, incluindo banco e env, sem alteração).
2. **Aprovar a Etapa 1** para o Hub, na ordem 1.1 → 1.5.
3. **2FA:** opção A (fluxo completo) ou B (esconder até A)? — a resposta de F3 ajuda.
4. **DAD-01:** excluir usuário passa a ser desativar por padrão?
5. **Produção:** se F1 mostrar risco real de Super Admin na produção, autoriza levar o item 1.1 para lá no mesmo dia?
