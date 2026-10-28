FROM node:20-alpine

# iputils: binario 'ping' | samba-client: 'smbclient' p/ ler metadados de share (OSA)
RUN apk add --no-cache iputils samba-client openssl tini

WORKDIR /app

# Build context = repo root. Copia worker code + prisma schema do backend.
COPY monitoring-worker/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Schema vem do backend para nao duplicar
COPY backend/prisma ./prisma
RUN npx prisma generate

COPY monitoring-worker/index.js ./
COPY monitoring-worker/lib ./lib

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

ENTRYPOINT ["/sbin/tini","--"]
CMD ["node","index.js"]
