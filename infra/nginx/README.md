# nginx — configuração por ambiente

Cópia versionada do nginx que está rodando em cada servidor.

| arquivo | servidor | caminho lá |
|---|---|---|
| `homologacao.conf` | `planner@10.192.4.123` | `/home/planner/orkestri/nginx/nginx.conf` |
| `producao-ssl.conf` | `orkestri-prod` | `/opt/orkestri/nginx/nginx-ssl.conf` |

## Estes arquivos NÃO são publicados pelo deploy

O `scripts/deploy.sh` publica apenas `backend` e `frontend`, e isso é
deliberado: compose, `.env` e nginx são as três coisas que **legitimamente
diferem** por ambiente. Produção termina TLS e serve o site institucional em
`/`; homologação não faz nem uma coisa nem outra. Copiar um por cima do outro
já derrubou o TLS de produção em silêncio uma vez.

Então aqui a relação se inverte: **o servidor é a fonte, o repositório é a
cópia**. Estes arquivos existem para responder três perguntas que antes não
tinham resposta fora do servidor:

1. o que está configurado hoje em cada ambiente?
2. alguém mexeu à mão e esqueceu de contar?
3. se este servidor sumir, o que precisa existir no lugar?

## Por que passaram a ser versionados

Em 17/08/2026 o tempo real do módulo de Monitoramento estava desligado nos
DOIS ambientes, e ninguém sabia. Faltava um `location /socket.io` — sem ele o
handshake do WebSocket caía no `location /`, que em produção é do site
institucional. Nenhum log de erro, nenhuma tela quebrada: só a faixa "conexão
em tempo real perdida" que se atribuía à rede.

A correção foi aplicada à mão nos dois servidores. Fora do git, ela morreria no
primeiro servidor recriado — e do mesmo jeito silencioso.

## Conferir se o servidor bateu com o repositório

```bash
bash scripts/verificar-nginx.sh homologacao
bash scripts/verificar-nginx.sh producao
```

Sai 1 quando divergem, e mostra o diff. Rodar depois de qualquer mexida no
nginx, e antes de acreditar que o repositório descreve a realidade.

## Aplicar uma mudança

Na ordem, sempre — o `nginx -t` ANTES de sobrescrever é o que evita derrubar o
ambiente com um erro de sintaxe:

```bash
# 1. backup datado no servidor
sudo cp /opt/orkestri/nginx/nginx-ssl.conf /opt/orkestri/nginx/nginx-ssl.conf.bak-$(date +%Y%m%d-%H%M%S)

# 2. copiar para um arquivo de TESTE e validar lá dentro
sudo docker cp novo.conf orkestri_nginx:/etc/nginx/nginx.conf.test
sudo docker exec orkestri_nginx nginx -t -c /etc/nginx/nginx.conf.test

# 3. só então sobrescrever e recarregar
sudo cp novo.conf /opt/orkestri/nginx/nginx-ssl.conf
sudo docker exec orkestri_nginx nginx -t && sudo docker exec orkestri_nginx nginx -s reload
```

Depois de mexer em produção, conferir o que a mudança pode ter derrubado sem
avisar — TLS, site institucional e login:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://orkiestri.com/login
curl -s https://orkiestri.com | grep -o "<title>[^<]*</title>"
```
