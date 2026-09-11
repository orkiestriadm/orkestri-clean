# Strategy — Implantação e rollback

Versão **1.35.0**. Migration `20260910120000_estrategico_gestao_estrategica`
(14 tabelas novas, nenhuma alteração em tabela existente).

## Antes do deploy — o que o `deploy.sh` NÃO faz

O deploy publica `backend/` e `frontend/`. **Compose fica fora** — e o módulo
precisa de um volume novo para os documentos. Em cada servidor, uma vez:

1. Backup do compose do servidor (`cp docker-compose.yml docker-compose.yml.bak-AAAAMMDD`).
2. Em `volumes:` (topo), acrescentar `estrategico_docs_data:`.
3. No serviço `api`, em `volumes:`, acrescentar `- estrategico_docs_data:/app/secure/estrategico-docs`.
4. `docker compose config --quiet` para validar.

O Dockerfile já cria `/app/secure/estrategico-docs` com dono `app` — volume
novo nasce com o dono certo. (Se o volume tiver sido criado antes da imagem
nova, ajustar uma vez: `docker run --rm -v orkestri_estrategico_docs_data:/d alpine chown -R 100:101 /d`
— conferir o uid/gid do usuário `app` na imagem com `docker exec orkestri_api id`.)

## Deploy

```bash
bash scripts/deploy.sh homologacao origin/<branch>
```

As migrations rodam no boot da API. Verificar:

1. `/api/health` responde `1.35.0`.
2. **Login de verdade até o dashboard** — o JWT carrega a lista de permissões e o
   módulo acrescenta 17 ao papel administrador (nginx já tem `proxy_buffer_size 16k`).
3. Menu **Strategy** aparece para master/administrador; não aparece para visualizador.
4. Abrir Painel, Assuntos, Configurações.
5. `docker exec orkestri_api ls -ld /app/secure/estrategico-docs` → dono `app`; anexar um arquivo de teste.

## Carga inicial (planilha)

Pela tela (preferível — fica o usuário na auditoria): **Strategy › Configurações ›
Importar planilha** → Pré-visualizar → Confirmar.

Pela linha de comando (sem sessão logada):

```bash
docker cp "Acompanhamento Estratégico.xlsx" orkestri_api:/tmp/planilha.xlsx
docker exec orkestri_api node dist/modules/estrategico/cli/importar-planilha.js /tmp/planilha.xlsx <organizationId> --simular
docker exec orkestri_api node dist/modules/estrategico/cli/importar-planilha.js /tmp/planilha.xlsx <organizationId>
docker exec orkestri_api rm /tmp/planilha.xlsx
```

A planilha **não** vai para o git: tem informação estratégica da empresa.

A coluna **Prazo** (desde 1.39.0) vira o prazo final do assunto: data → prazo
final (entra no farol: amarelo a 15 dias, vermelho vencido); "N/A", "-" e vazio →
sem prazo; texto que não é data → pendência para revisar. Planilha sem a coluna
continua sendo lida.

## Substituir a carga por uma versão mais nova da planilha

Reimportar sozinho **não** atualiza nada: o importador reconhece o assunto pelo
título e ignora o que já existe — e um título alterado na planilha viraria um
assunto NOVO ao lado do antigo. Para trocar a carga inteira:

```bash
docker cp "Acompanhamento Estratégico.xlsx" orkestri_api:/tmp/planilha.xlsx
docker exec -u root orkestri_api chown app:app /tmp/planilha.xlsx
docker exec orkestri_api node dist/modules/estrategico/cli/importar-planilha.js /tmp/planilha.xlsx <organizationId> --substituir --simular
docker exec orkestri_api node dist/modules/estrategico/cli/importar-planilha.js /tmp/planilha.xlsx <organizationId> --substituir
docker exec -u root orkestri_api rm /tmp/planilha.xlsx
```

- **Apaga de vez** a carga atual da organização — assuntos (inclusive os já
  excluídos), andamentos, dependências, tarefas, documentos (e os arquivos),
  comentários, valores, histórico, catálogos, reuniões, decisões e registros de
  aviso — e importa a planilha no lugar, **na mesma transação**. Os códigos
  recomeçam em EST-0001.
- **É recusado** se houver trabalho feito sobre a carga: assunto cadastrado à
  mão ou validado, próxima ação/responsável/risco/descrição/farol manual
  preenchidos, andamento, tarefa, documento, comentário, decisão, reunião não
  excluída, dependência com data e valor alterado no sistema. O `--simular`
  mostra o que seria apagado e os bloqueios. Depois que a equipe começou a
  trabalhar, a planilha deixa de ser a fonte: atualizar pelo sistema.
- Faça `pg_dump -t 'estrategico_*'` antes, se quiser poder voltar.

## Acesso

O acesso é tudo-ou-nada: o módulo é da alta gestão e quem entra cadastra,
edita, exclui e configura (decisão de 11/09/2026). Enxergam o módulo:

- quem tem o papel **Alta Gestão (Strategy)** — criado no boot da API em cada
  organização, com as 17 permissões do módulo e nenhuma de outro. Conceder em
  Administração › Cadastros › Usuários, somando aos papéis que a pessoa tenha;
  quem só tem este papel cai direto no Painel do Strategy;
- o papel **administrador** e o **master**.

Nenhum outro papel padrão recebe o módulo (visualizador e auditor ficam de fora
de propósito). Conferir em **Strategy › Configurações › Quem tem acesso**.

## Rollback

O módulo é aditivo — voltar a versão não quebra nada do resto do sistema.

1. **Código:** `bash scripts/deploy.sh homologacao <ref-anterior>`. As tabelas
   `estrategico_*` ficam no banco sem uso; a API anterior as ignora.
2. **Remover arquivo órfão no servidor** (o `git checkout` do deploy não apaga
   arquivo removido, e `nest build` compila todo `src/`): não é necessário ao
   voltar para um ref *anterior* ao módulo, porque os arquivos do módulo
   importam só código que continua existindo. Se o build falhar por eles,
   apagar `backend/src/modules/estrategico` no servidor e redeployar.
3. **Banco — só se for abandonar o módulo de vez** (destrói os dados do módulo;
   fazer `pg_dump -t 'estrategico_*'` antes):

   ```sql
   DROP TABLE IF EXISTS estrategico_alerta_envios, estrategico_configs, estrategico_decisoes,
     estrategico_reunioes, estrategico_historico, estrategico_valores_historico,
     estrategico_comentarios, estrategico_documentos, estrategico_dependencias,
     estrategico_tarefas, estrategico_eventos, estrategico_caso_areas,
     estrategico_casos, estrategico_catalogos CASCADE;
   DELETE FROM _prisma_migrations WHERE migration_name = '20260910120000_estrategico_gestao_estrategica';
   ```

4. **Permissões:** as linhas `estrategico.*` em `permissions`/`role_permissions`
   podem ficar (sem endpoint, não dão acesso a nada) ou ser removidas.
