# Orkiestri One — fonte consolidada de produção

Este diretório contém a edição efetivamente usada em produção. O código empresarial mantido na raiz do repositório é preservado: não deve ser substituído nem enviado ao servidor 10.192.4.123 como parte desta entrega.

Backend, frontend, migrations, processamento local de mídia e scripts de release devem ser construídos juntos a partir deste diretório. Arquivos `.env` e chaves não são copiados para a fonte nem para os artefatos.

As validações usam banco e cache isolados, sem dados de clientes. A publicação é somente em produção, por instrução expressa do proprietário. Cada release deve registrar hashes dos fontes, dependências resolvidas, imagens e evidências de teste.

Entrega de 25/10/2026 publicada e validada: contextos, demandas, prévias, áudio local, anexos privados, métricas e operação. A correção adicional de `9` após `0` também está publicada. Evidências e limites em `../../docs/WHATSAPP_CONSOLIDACAO_2026-10-25.md`.

Builds usam `npm ci` com os lockfiles e os Dockerfiles desta pasta. O processamento de mídia fixa o commit do Whisper.cpp e verifica o checksum do modelo. A release registra os digests das imagens e hashes dos artefatos; preserve esses insumos para reproduzir a mesma versão. Scripts de publicação são registros desta release e possuem verificações de versão anterior para impedir sobrescritas acidentais. Execute-os como arquivos, sem fornecer o script pela entrada padrão de um comando interativo.
