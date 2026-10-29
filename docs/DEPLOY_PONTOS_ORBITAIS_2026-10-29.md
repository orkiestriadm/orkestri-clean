# Publicação dos pontos orbitais — 29/10/2026

Publicação expressamente autorizada pelo usuário, concluída em **29/10/2026, 08:39:15 (America/Sao_Paulo)**. Código: **fa60e8970faf0d23630c4521c915afe96cafaf83**, branch **codex/site-whatsapp-orbit-dots**, PR #22 (rascunho).

O monograma foi removido e substituído por quatro pontos de tamanhos e velocidades diferentes em elipse invisível ao redor da captura real do WhatsApp. Órbita proporcional ao contêiner, escala móvel reduzida e captura fixa e clicável. Preferência por movimento reduzido respeitada. Capturas reais e fundo contínuo preservados.

Somente o website foi substituído; frontend, API, PostgreSQL, Redis, Evolution, media-worker e nginx mantiveram seus containers. Nginx recebeu apenas reload. Sem migrations, seeds, alterações de contas ou mensagens de teste.

## Validação

- 262 fontes auditados, sem divergência em relação à base publicada antes da troca.
- Build Linux completo, 32 páginas e pacote standalone válido.
- Candidato sem rede, read-only e limitado a 256 MB: 22 verificações de páginas, CSS, camadas, quatro pontos sem monograma, oito hashes de imagens e otimizador aprovadas.
- Transferência conferida por SHA-256 e imagem Linux amd64 validada.
- Após ativação: nove verificações de rotas públicas, oito hashes de capturas e otimizador aprovados; API saudável e containers preservados por ID.
- Navegador público conferido em desktop e celular: quatro pontos, monograma ausente, offset-distance variando, captura fixa, sem overflow horizontal. A prévia já havia validado a ampliação e o movimento em 1440 e 390 px.

Imagem ativa: sha256:722913f190e3a6c174ff11c4f9d186c5b73c6d14e59103a1a4f609ac22c02d1f. Rollback: orkestri/website:rollback-orbits-fa60e89-20261029. Backups e relatórios privados: /opt/orkestri/releases/orbits-fa60e89-20261029. Rollback preparado e não acionado.

Referência compartilhada: origin/codex/site-whatsapp-orbit-dots enquanto o PR #22 estiver aberto. Main intacta, sem auto-merge. A manutenção de banco registrada separadamente no PR #21 não foi reaplicada. Esta autorização cobre somente esta publicação.
