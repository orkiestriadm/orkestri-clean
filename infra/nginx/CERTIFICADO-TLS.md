# Certificado TLS — renovação, reload e como conferir

O certificado de produção se renova sozinho há mais de um ano. Mesmo assim, em
15/10/2026 produção passou ~16h servindo certificado **vencido**. Este
documento existe por causa dessa distância entre "renova" e "está no ar".

---

## O defeito: renovar não é publicar

O `orkestri_certbot` renova o certificado **no disco**
(`ssl/letsencrypt/live/orkiestri.com/fullchain.pem`, que é um symlink para o
`archive/fullchainN.pem` da vez).

O `orkestri_nginx` lê esse arquivo **uma única vez, ao iniciar**. Depois disso
ele serve da memória. Não existia nada entre os dois containers que mandasse o
nginx reler — e o certbot não alcança o nginx nem com `--deploy-hook`, porque
está em outro container; só alcançaria com o socket do Docker exposto dentro
dele, que não vale o risco.

Resultado: o certificado novo fica pronto no disco e o nginx segue entregando o
velho até alguém reiniciar ou recarregar o nginx por outro motivo. Se esse
"outro motivo" não aparecer antes do vencimento, produção cai.

### O que aconteceu em 15/10/2026

| quando | o quê |
|---|---|
| agosto/2026 | `orkestri_nginx` sobe e carrega `fullchain2.pem` (válido 17/07 → **15/10**) |
| 15/09/2026 | certbot renova: grava `fullchain3.pem` (válido até **14/12/2026**). nginx não relê |
| 15/10, 03:56 GMT | o cert2, ainda em memória, vence. Produção passa a servir certificado vencido |
| 15/10, ~20h | `docker exec orkestri_nginx nginx -s reload` resolve em segundos |

Durou ~16h. O sintoma visível era o navegador com "sua conexão não é
particular". O sintoma **invisível**, e o que mais custou: o container
`orkestri_evolution_v2` falhou **toda** entrega de webhook nesse período, com
`Error: certificate has expired` em `p.sendData-Webhook`. Ou seja, cada mensagem
recebida no WhatsApp foi descartada em silêncio — sem erro na tela de ninguém.

Sem conserto, o mesmo acontece em **14/12/2026**.

---

## O conserto: o nginx se recarrega a cada 6h

Em `docker-compose.prod.yml`, o serviço `nginx` ganhou um `command` que roda um
laço em paralelo ao processo principal:

```yaml
    command:
      - /bin/sh
      - -c
      - |
        while :; do
          sleep 21600
          echo "[cert-reload] $$(date -Is) recarregando nginx para reler o certificado"
          nginx -s reload
        done &
        exec /docker-entrypoint.sh nginx -g 'daemon off;'
```

Por que assim, e não de outro jeito:

- **`nginx -s reload` não derruba conexão.** O master relê a configuração e os
  certificados, sobe workers novos e deixa os antigos drenarem o que estavam
  atendendo. Diferente de reiniciar o container, que derruba.
- **6h de atraso não importam.** O certbot renova 30 dias antes do vencimento,
  então a pior janela possível entre "renovou" e "está no ar" é irrelevante.
- **Não precisa do socket do Docker.** A alternativa — certbot sinalizar a
  renovação e o nginx reagir — exigiria um laço de vigia do mesmo jeito, só que
  com um arquivo de estado a mais entre os dois containers. Mais peças para o
  mesmo efeito.
- **Vale para certificado trocado à mão também**, não só para o do certbot: o
  laço relê o que estiver no disco, qualquer que seja a origem.
- **`exec /docker-entrypoint.sh nginx -g 'daemon off;'`** preserva o
  comportamento padrão da imagem e deixa o nginx como PID 1, então `docker stop`
  continua terminando o container do jeito normal.

O `certbot` também ganhou `--deploy-hook 'date -Is >> /etc/letsencrypt/renovacoes.log'`.
Isso **não recarrega nada** — só deixa registrada a data de cada renovação, que
foi exatamente o dado que faltou durante o incidente (teve que ser deduzido pelo
número do `archive/fullchainN.pem`). Lê-se com:

```bash
cat /opt/orkestri/ssl/letsencrypt/renovacoes.log
```

---

## Como APLICAR em produção

> ⚠️ **Não copie o `docker-compose.prod.yml` do repositório por cima do
> servidor.** O arquivo que está em `/opt/orkestri` foi editado à mão e tem
> diferenças (o bloco de TLS, entre outras). Copiar por cima já derrubou o HTTPS
> em silêncio. Esta mudança se aplica **editando o bloco à mão**.

```bash
ssh orkestri-prod
cd /opt/orkestri

# 1. backup datado
cp docker-compose.prod.yml docker-compose.prod.yml.bak-$(date +%Y%m%d-%H%M%S)
```

**2.** Abrir `docker-compose.prod.yml` e, dentro de `services:` → `nginx:`,
inserir o bloco `command:` acima entre `ports:` e `volumes:`. Só isso — não
mexer em `ports`, `volumes` nem `depends_on`.

**3.** (opcional, o log de renovações) No serviço `certbot:`, trocar a linha

```
          certbot renew --quiet --webroot -w /var/www/certbot;
```

por esta, **numa linha só**:

```
          certbot renew --quiet --webroot -w /var/www/certbot --deploy-hook 'date -Is >> /etc/letsencrypt/renovacoes.log';
```

> Numa linha só porque o `entrypoint: >` é um bloco *folded* do YAML: linha
> mais indentada que a anterior vira quebra de linha **literal**. Quebrado em
> duas, o `--deploy-hook …` viraria um comando separado e o container
> entraria em laço de erro. (Testado: o compose realmente preserva a quebra.)

**4.** Conferir que o compose entende o arquivo **antes** de aplicar:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml config >/dev/null && echo "compose OK"
```

**5.** Aplicar. Isto **recria** o container do nginx (mudança de `command` não
tem como ser aplicada sem recriar) — são poucos segundos de 80/443 fora:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d nginx certbot
```

**6.** Verificar (a seção abaixo). A recriação em si já faz o nginx reler o
certificado; o laço é para as próximas renovações.

---

## Como VERIFICAR — e por que `curl -k` não serve

```bash
# 1. qual certificado está REALMENTE no ar (não o que está no disco)
echo | openssl s_client -connect orkiestri.com:443 -servername orkiestri.com 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates

# 2. HTTPS de ponta a ponta, SEM -k
curl -sS -o /dev/null -w "%{http_code}\n" https://orkiestri.com/login
```

**O `-k` foi o que escondeu o problema em 15/10.** Ele manda o curl aceitar
qualquer certificado: com o certificado vencido no ar, `curl -k` devolvia 200
alegremente enquanto todo navegador mostrava alerta e o Evolution descartava
webhook. **Verificação de TLS sem validar o TLS não é verificação.** Em
checagem de certificado, nunca `-k`, nunca `--insecure`, nunca
`NODE_TLS_REJECT_UNAUTHORIZED=0`.

Comparar o que está no ar com o que está no disco — é essa diferença que mata:

```bash
ssh orkestri-prod
# no disco (o que o certbot renovou)
sudo openssl x509 -in /opt/orkestri/ssl/letsencrypt/live/orkiestri.com/fullchain.pem -noout -dates
# em memória (o que o nginx entrega)
echo | openssl s_client -connect orkiestri.com:443 -servername orkiestri.com 2>/dev/null \
  | openssl x509 -noout -dates
# as duas datas TÊM que bater. Se não baterem, falta reload:
docker exec orkestri_nginx nginx -s reload
```

Conferir que o laço está vivo (um registro a cada 6h):

```bash
docker logs orkestri_nginx 2>&1 | grep cert-reload | tail -5
```

E o lado que ninguém olhou, o Evolution — é aqui que o certificado vencido
aparece como mensagem de WhatsApp perdida:

```bash
docker logs orkestri_evolution_v2 --since 24h 2>&1 | grep -i "certificate has expired" | tail
```

---

## Homologação (`planner@10.192.4.123`) — risco parecido, causa diferente

Conferido em 15/10/2026, só leitura. **Homologação não usa certbot**: não há
container `orkestri_certbot` no ar nem diretório `ssl/letsencrypt`. O nginx de
lá monta `/home/planner/orkestri-ssl` em `/etc/nginx/ssl`, com um certificado
comercial colocado à mão:

| | produção | homologação |
|---|---|---|
| certificado | Let's Encrypt `orkiestri.com` | wildcard `*.triunfotransbrasiliana.com.br` |
| emissor | Let's Encrypt | GlobalSign (AlphaSSL CA 2025) |
| validade | 15/09 → **14/12/2026** | 07/05 → **22/11/2026** |
| renovação | automática (certbot, 12h) | **manual** — alguém baixa e copia o arquivo |
| reload depois de renovar | agora, a cada 6h | **nenhum** |

Hoje homologação está correta: o arquivo foi gravado em 15/09 às 13:51 e o
container subiu às 16:59 do mesmo dia, depois disso — então o que está em
memória é o que está no disco.

O risco é o mesmo, só que chega antes e por outro caminho: **o wildcard vence em
22/11/2026**, três semanas antes do de produção, e quando o arquivo novo for
copiado para `/home/planner/orkestri-ssl/` o nginx de lá vai continuar servindo
o antigo até alguém recarregar.

**O que fazer lá:** nada automático por enquanto — o laço de 6h resolveria do
mesmo jeito, mas homologação é linha de versão própria e só se promove item a
item. Por ora, quem trocar o wildcard precisa fechar a troca com:

```bash
ssh planner@10.192.4.123
docker exec orkestri_nginx nginx -t && docker exec orkestri_nginx nginx -s reload
echo | openssl s_client -connect localhost:443 -servername hub.triunfotransbrasiliana.com.br 2>/dev/null \
  | openssl x509 -noout -subject -dates          # a data TEM que ser a do arquivo novo
```

---

## Como isto foi testado antes de ser proposto

Não é "o compose está válido". O defeito foi **reproduzido** e o conserto
**medido**, em 15/10/2026, num `nginx:1.25-alpine` descartável no Docker local,
com o mesmo `command` e `sleep` encurtado de 21600s para 15s:

| o que se queria saber | como se mediu | resultado |
|---|---|---|
| o `$$(date -Is)` chega certo no container? | `ps` dentro do container | chega como `$(date -Is)`; o laço loga a cada ciclo |
| o nginx continua sendo PID 1? | `ps -o pid,args` | `1 nginx: master process` — `docker stop` levou **1s**, `ExitCode=0` |
| o defeito existe mesmo? | trocar o `.pem` no disco e consultar a porta | logo após a troca ainda servia o **CERT-ANTIGO** — reproduzido |
| o laço conserta? | esperar um ciclo e consultar de novo | passou a servir o **CERT-RENOVADO**, com `RestartCount=0` e `StartedAt` inalterado |
| o reload derruba requisição? | 90 requisições HTTPS validadas (sem `-k`) atravessando um reload | **90 OK, 0 falhas** |
| cabe no `mem_limit: 64m`? | `docker stats` | 3,0 MiB |
| o `--deploy-hook` do certbot roda mesmo? | a linha exata do compose, com um `certbot` de mentira num alpine | o hook rodou e gravou a data no `renovacoes.log` |

Reproduzir de novo leva ~2 min e não toca em servidor nenhum: dois certificados
self-signed, um `nginx.conf` com `listen 443 ssl`, o `command` com `sleep 15`,
trocar o `.pem` e consultar `openssl s_client` antes e depois.

---

## Em uma linha

Renovar o certificado e publicá-lo são duas coisas. O certbot faz a primeira; o
laço de 6h do nginx faz a segunda; e só `openssl s_client` ou um `curl` **sem
`-k`** provam que a segunda aconteceu.
