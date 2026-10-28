# Capturas reais em dark e recuperação do login — 28/10/2026

Branch de revisão: codex/site-real-dark-captures. Base: codex/fix-agenda-reminders-by-organization, commit 9f71dbab3446bb6e6e26ea6bcc0ca22e64d8b6a1. Esta tarefa não autoriza deploy.

## Site

As cinco capturas ativas dos módulos passam a mostrar o frontend real em modo escuro. Elas foram obtidas de uma instância local do código atual, com PostgreSQL e Redis descartáveis e organização fictícia. A conta, os gastos, projetos, chamados e artigos exibidos são de demonstração. Nenhuma credencial de produção foi passada aos processos locais; integrações de WhatsApp, e-mail e pagamento não foram habilitadas.

A primeira dobra e as seções da Aurélia agora usam três recortes reais do WhatsApp Web: menu, conferência/confirmação do compromisso e lembrete automático. São trechos do teste de agenda realizado nesta conversa. Não foi reconstruído texto, gerada interface por IA ou alterado o conteúdo das mensagens. Apenas recorte e codificação WebP sem perdas. CPF, e-mail, telefone, cadastro, lista de conversas e identificadores internos de eventos ficaram fora dos assets públicos. Os arquivos de origem completos permanecem em artefatos privados locais.

A demonstração antiga com escolha pessoal/empresa foi removida. O texto explica cadastro único com nome de organização obrigatório (ou o nome da própria pessoa), sem pedir telefone novamente. Capturas de módulos identificam dados demonstrativos e preservam ampliação. Os cartões de Gastos passaram a usar tokens reais do tema: variáveis antigas inexistentes faziam os painéis ficarem brancos e ilegíveis em dark.

| Asset em website/public/screenshots/real-dark | Origem | SHA-256 |
|---|---|---|
| agenda.webp | /dashboard/agenda | 94042bd5a9ee8e197d002d18d1727a5c3285d4bdd679bf337ac6db85a5bf7622 |
| chamados.webp | /dashboard/chamados | eb0959912da718320fe8f5d80930a7d86cc8cd3eabe314b40f8b613061dabc9e |
| conhecimento.webp | /dashboard/conhecimento | 51faa36c0287dbbc78d4a5f990b3243aed67674700c44143b13ff0a336035ec9 |
| gastos.webp | /dashboard/financeiro/gastos | 996a9c913deb612efab8cce9c5852c3f75a01fcc6b4f3f7e29064781b8362c55 |
| projetos.webp | /dashboard/projetos | da2cd8a83ed09574e7e19975e66548dd18785bcaf19618268ea33903cc0e0f4c |
| whatsapp-confirmacao.webp | WhatsApp Web — conversa de teste | d876c202259906c1ca4d0c5f94583512d572e015eec1341d6204c778663288ba |
| whatsapp-lembrete.webp | WhatsApp Web — conversa de teste | ac3be205a2bcdacec5ec5c2d705546f50a38e76c33c12e8aedff70992fd4863e |
| whatsapp-menu.webp | WhatsApp Web — conversa de teste | 99cd461f2844fca8287cf1dd54f59b7117f7a9931e9c3e583dd5198ff23e4bcf |

## Login travado após Entrar

Diagnóstico confirmado em leitura dos logs do nginx: respostas 401 em /api/auth/me seguidas de 403 em POST /api/auth/clear e repetição de /dashboard. O fetch de limpeza não enviava X-CSRF-Token. O cookie HttpOnly inválido permanecia; o middleware interpretava sua presença como sessão e redirecionava o formulário de volta ao dashboard.

A recuperação agora envia o token CSRF, reúne chamadas concorrentes numa única tentativa e limita a limpeza a cinco segundos. Em seguida abre /login?reauth=1, inclusive quando o endpoint de limpeza falha. Esse parâmetro só permite ver o formulário: não libera /dashboard nem altera validação de credenciais ou da API. O layout deixa de disputar redirecionamentos com o interceptor. Falhas de rede/servidor exibem tentativa novamente; bloqueios de assinatura e primeiro acesso mantêm seus destinos.

## Validação

- Seis testes isolados de regressão aprovados: CSRF/cookies/deduplicação, falha de rede, timeout, redirecionamento normal, recuperação com cookie inválido e proteção do dashboard.
- No banco/API local, limpeza sem CSRF reproduziu 403; com o header, retornou 200 e apagou o cookie.
- Navegador local com cookie inválido chegou ao formulário; novo login com a conta fictícia abriu o dashboard em dark.
- TypeScript do frontend e do site aprovado.
- Builds completos do frontend (45 páginas) e do site (32 páginas) concluídos com código de saída zero. O Windows apresentou aviso EPERM apenas na cópia de links simbólicos para standalone; os pacotes locais standalone não devem ser usados como imagem de produção. Uma publicação deve gerar seu próprio pacote Linux.
- Revisão visual em desktop 1440 px e celular 390 px: imagens carregadas, sem transbordamento horizontal; troca de etapas e ampliação funcionam. A legenda da seção clara teve o contraste corrigido.
- Antes do push: nenhum workflow GitHub Actions ou webhook de repositório configurado; main não recebe push/merge.

Produção foi consultada apenas para diagnóstico de respostas públicas e contagens anônimas de logs. Não houve publicação, migration, modificação de contas reais ou envio de mensagens nesta tarefa. Publicar exige autorização expressa separada, conforme AGENTS.md.

## Revisão no GitHub

PR em rascunho: https://github.com/orkiestriadm/orkestri-clean/pull/18. Commit de implementação: bde33e25cb6481047d8e27b9219e461d8a54d7e5. A branch preserva a base publicada do PR #17; main permanece intacta. Publicação do frontend e do site segue pendente de autorização expressa.
