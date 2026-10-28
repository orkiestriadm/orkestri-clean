# Recuperação de acesso ao dashboard

Publicado em produção em 27/10/2026, às 10h12 de Brasília.

## Diagnóstico confirmado

A rota `/dashboard` existe. O middleware verificava apenas se havia um cookie de sessão; qualquer valor, inclusive inválido, fazia `/login` redirecionar para `/dashboard`. Quando a API recusava a sessão, o frontend tentava apagar o cookie antes de retornar ao login, sem prazo para essa requisição terminar. O layout exibia um carregamento sem alternativa visível e redirecionava também em erros de rede.

Antes da alteração, um pedido HTTP a `/login` com `orkestri_token=invalid` devolvia redirecionamento 307 para `/dashboard` nos dois domínios.

## Alterações publicadas

- Login acessível mesmo com cookie antigo; a validação de sessão continua na API.
- Recuperação de sessão com prazo máximo de dois segundos para a limpeza do cookie, cancelamento da chamada pendente e uma única navegação para requisições simultâneas.
- Verificação inicial do dashboard com timeout de dez segundos; conteúdo protegido só aparece depois da validação.
- Falhas mostram mensagem, botão de nova tentativa e acesso ao login, sem carregamento indefinido.
- Erros de comunicação deixam de afirmar que o usuário está sem internet; timeout e cancelamento têm tratamento próprio.
- Fluxos existentes de assinatura suspensa e primeiro acesso preservados.

Fontes da edição One: `apps/orkiestri-one/frontend/src/middleware.ts`, `src/lib/api.ts`, `src/lib/session-redirect.ts` e `src/app/dashboard/layout.tsx`. Os arquivos empresariais da raiz foram preservados. Os arquivos equivalentes em produção foram comparados por hash antes da aplicação.

## Validação

- Verificação completa de tipos da edição One: aprovada.
- Build de produção do frontend: aprovado.
- Testes em `docs/dashboard-session-test-20261027.cjs`: limpeza pendente, falha da limpeza, vários 401 simultâneos, cookies inválidos/expirados/revogados, login sem cookie, proteção de subrotas, sessão válida, sessão expirada, timeout e nova tentativa. O interceptor Axios real foi testado com respostas simuladas, incluindo assinatura suspensa e credenciais incorretas.
- Oito verificações HTTP públicas após ativação: login normal e com cookie inválido, saúde da API e dashboard sem autenticação, em `orkiestri.com` e `www.orkiestri.com`.
- Login com cookie inválido agora responde 200; dashboard sem cookie redireciona para login.
- API e site institucional mantiveram os mesmos contêineres. Não foram alterados usuários, vencimentos ou pagamentos. Não foi utilizado login real de administrador nos testes.

Imagem ativa: `orkestri/frontend:latest`, ID `sha256:0053f04aeadff5d332519f794ab9dcd1990e7800a4b9b7d0a32cea8b69b506e5`.

Backup das fontes anteriores: `/opt/orkestri/backups/dashboard-session-before-20261027T130756Z.tar.gz`.

Imagem de reversão: `orkestri/frontend:rollback-dashboard-session-20261027`.

Manifesto: `docs/dashboard-release-20261027.json`. Ativação: `docs/dashboard-activate-20261027.py`.

Auditoria e proposta de assinatura mensal: `docs/PAGAMENTOS_MERCADO_PAGO_2026-10-27.md`. A integração de R$ 11,90/mês ainda precisa ser implementada e configurada; esta entrega não ativou cobranças.
