# Degradê laranja, Aurélia ao fundo e posts — 28/10/2026

Branch de trabalho: codex/site-orange-gradients. Base: origin/codex/site-real-dark-captures em a8d4d67a6a22b0a44beee8da3ce434b3a2b7a6c6. O código anterior b790e15 já foi publicado; esta alteração visual foi posteriormente autorizada e publicada no commit 91b2292. Ver DEPLOY_DEGRADE_LARANJA_2026-10-28.md.

## Tratamento visual do site

O mesmo degradê radial laranja da primeira dobra agora usa a variável compartilhada --site-orange-wash. Ela é aplicada ao corpo, seções escuras, superfícies ink/panel, rodapé, menus desktop/mobile e banners, alcançando todas as páginas sem duplicar cores e ajustes por rota. Camadas antigas que encobriam o degradê nas aberturas internas e no fechamento foram removidas. O fundo claro da seção editorial da agenda e os pixels das capturas reais permanecem preservados.

A marca da Aurélia foi restaurada em um plano decorativo atrás do print real do WhatsApp. O A gira continuamente em 32 segundos e as órbitas mantêm seu movimento; o card do WhatsApp não recebe rotação e ocupa a camada superior. O fundo não captura cliques. A animação só é habilitada quando prefers-reduced-motion permite, e a posição é adaptada ao celular para continuar visível ao redor do print.

## Validação local

- TypeScript e build Next.js completo aprovados, com 32 páginas geradas. O Windows apresentou o aviso já conhecido de symlink no empacotamento standalone; uma futura publicação deve construir pacote Linux próprio.
- Navegador em 1440 px e 390 px: sem transbordamento horizontal; menu mobile com degradê; menus de produtos/soluções e destaque com degradê; marca animada abaixo do print fixo.
- Conferência dos estilos renderizados em 25 páginas: zero superfícies do escopo sem o degradê. Fundo editorial claro permaneceu rgb(237, 234, 229).
- Capturas e relatório detalhado preservados nos artefatos locais da tarefa, sem inclusão de dados privados no Git público.

Rotas conferidas:
- /products
- /services
- /services/software-factory
- /services/ai-solutions
- /services/cloud-solutions
- /services/consulting
- /services/integrations
- /services/outsourcing
- /company
- /technology
- /demo
- /products/orkiestri-one
- /products/one-space
- /products/one-finance
- /products/one-projects
- /products/one-desk
- /products/one-quality
- /products/one-core
- /contact
- /blog
- /cases
- /privacy
- /terms
- /company/careers
- /

## Artes para Instagram

Sete posts verticais foram gerados com a ferramenta nativa image_gen usando a marca laranja oficial do site: apresentação do sistema, Aurélia, agenda, projetos, gastos, anotações e convite para começar. As telas usadas como referência contêm dados fictícios de demonstração. Nenhuma arte foi aplicada ao site e nenhuma publicação foi enviada à rede social.

Entrega local na pasta Imagens do usuário: sete PNGs numerados por dia da semana, legendas prontas, prompts completos, manifesto com dimensões/hashes e ZIP. As imagens mantêm suas dimensões nativas; os originais foram preservados. Há uma cópia privada dos entregáveis em .sync-review/instagram-semana-1/finais, ignorada pelo Git. Os binários e caminhos pessoais não integram este repositório público.
