FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package*.json ./
RUN npm install --legacy-peer-deps

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_PUBLIC_API_URL=/api
ENV NEXT_TELEMETRY_DISABLED=1

# Marca exibida na interface. Precisa entrar como ARG e virar ENV ANTES do
# build: o Next embute variáveis `NEXT_PUBLIC_*` no bundle do navegador em
# tempo de compilação — defini-las só no runtime do compose não tem efeito
# nenhum na tela.
#
# O padrão é a marca do produto; um ambiente white-label passa a do cliente pelo
# `build.args` do compose. Assim a customização mora na configuração daquele
# ambiente e não no código, que é o que faz ela sobreviver ao próximo deploy —
# e é o que permite os três ambientes rodarem o MESMO Dockerfile.
#
# Estava só em homologação, que exibe "Hub Transbrasiliana". Enquanto viveu lá
# fora do versionamento, qualquer deploy que trouxesse este arquivo do git
# apagava a marca do cliente em silêncio: o build continuava passando, e o
# defeito só aparecia na tela.
ARG NEXT_PUBLIC_MARCA=Orkiestri
ARG NEXT_PUBLIC_APP_DOMINIO=app.orkiestri.com
ENV NEXT_PUBLIC_MARCA=$NEXT_PUBLIC_MARCA
ENV NEXT_PUBLIC_APP_DOMINIO=$NEXT_PUBLIC_APP_DOMINIO

# Fundo do login e logotipo, pela mesma razão e com o mesmo mecanismo.
#
# Vazio em LOGO_ARQUIVO mantém o símbolo vetorial do produto. Os dois arquivos
# de imagem ja vivem em `public/branding`, versionados: o ambiente escolhe qual
# usar em vez de sobrescrever um pelo outro em disco.
#
# LOGO_ARQUIVO_CLARO é a mesma marca em versão para fundo claro. O menu lateral
# acompanha o tema, e logotipo branco sobre fundo branco não aparece. Vazio cai
# no LOGO_ARQUIVO, então ambiente com uma única versão da marca segue igual.
ARG NEXT_PUBLIC_LOGIN_FUNDO=/branding/planeta.jpg
ARG NEXT_PUBLIC_LOGO_ARQUIVO=
ARG NEXT_PUBLIC_LOGO_ARQUIVO_CLARO=
ENV NEXT_PUBLIC_LOGIN_FUNDO=$NEXT_PUBLIC_LOGIN_FUNDO
ENV NEXT_PUBLIC_LOGO_ARQUIVO=$NEXT_PUBLIC_LOGO_ARQUIVO
ENV NEXT_PUBLIC_LOGO_ARQUIVO_CLARO=$NEXT_PUBLIC_LOGO_ARQUIVO_CLARO
# Teto explícito de heap durante o build. Sem isso, o Node pode crescer até o
# cgroup limit e ser OOM-killed silenciosamente em hosts pequenos como Lightsail 2GB.
ENV NODE_OPTIONS="--max-old-space-size=1024"
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
RUN chown -R app:app /app
USER app
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
CMD ["node", "server.js"]