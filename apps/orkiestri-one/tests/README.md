# Testes da entrega

Estes são os testes de integração usados na entrega, fora das imagens de runtime. Não executá-los com o banco ou o provedor de mensagens de clientes.

O ensaio usou PostgreSQL e Redis próprios em rede Docker interna, copiando somente a estrutura e o histórico de migrations da produção. A API candidata executou as novas migrations antes dos testes. Provedor Evolution simulado em `127.0.0.1:18080` por `fake-provider.cjs`; o ASR foi real, com voz sintética local, sem dados pessoais.

- `test-one-http.cjs`: rotas autenticadas, projetos/demandas e seus efeitos, cadastro, concorrência, prévias, áudio e arquivos privados. Dentro da API de teste: `node /tests/test-one-http.cjs`.
- `test-menu-case.cjs`: sequência `menu → 0 → texto → 9`, conta somente com gastos e recusa de números soltos.
- `test-cohorts.cjs`: ativação, janelas completas de retenção e escopo de plataforma.
- `test-media-worker.cjs`: transcrição, autenticação, formato, ocupação, duração e limpeza. Usa a amostra criada por `create-portuguese-fixture.cjs` e montada em `/fixtures/portuguese.wav`.
- `run-one-regression.cjs inicio|rotina|cadastro|recibos`: executa os quatro cenários históricos contra os módulos compilados da imagem candidata, adaptando o contrato atual de boas-vindas sem senha provisória. Cada cenário exige seu banco vazio com os nomes verificados no próprio teste.

Montar esta pasta como `/tests:ro` e disponibilizar os módulos da imagem em `NODE_PATH=/app/node_modules`. O runtime de teste precisa de `JWT_SECRET`, `WHATSAPP_INBOUND_SECRET` e das URLs dos serviços de teste. As verificações de nome do banco recusam a base de produção nos cenários HTTP/coortes/menu.

Os testes reais em produção ficam separados em `../scripts/test-production.cjs` e `test-menu-production.cjs`, exigem usuário/telefone explicitamente autorizados via variáveis e removem os registros técnicos. Entradas são injetadas pelo webhook autenticado; os envios e a transferência de mídia usam o provedor real. Isso não comprova entrega ou leitura no aparelho.
