FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl openssl-dev python3 make g++
COPY package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl openssl-dev
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY nest-cli.json ./
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate
RUN npx nest build

FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache openssl openssl-dev postgresql-client
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
# Os pontos de montagem precisam existir e pertencer ao usuário `app` ANTES do
# volume ser montado: o Docker herda dono/permissão do diretório da imagem ao
# inicializar um volume vazio. Sem isso o volume nasce como root e o processo,
# que roda como `app`, não consegue escrever.
#
# Tudo sob `secure/` fica fora de `uploads` de propósito — aquele é publicado
# estaticamente pelo nginx, estes só saem pelo endpoint autenticado de download:
# documento de colaborador, anexo de licença e anexo de projeto.
#
# `compliance-docs` FALTAVA aqui, e o defeito era invisível: o volume montava,
# a aplicação subia saudável, e só falhava no momento de anexar um arquivo a
# uma obrigação — com erro de permissão que não aponta para o Dockerfile.
# Descoberto em 10/08/2026, ao acrescentar `project-docs`.
#
# Corrigir a imagem NÃO conserta volume que já nasceu como root: é preciso
# ajustar o dono do volume existente, uma vez, em cada ambiente.
RUN mkdir -p /app/uploads /app/secure/people-docs /app/secure/compliance-docs /app/secure/project-docs \
 && chown -R app:app /app
USER app
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]