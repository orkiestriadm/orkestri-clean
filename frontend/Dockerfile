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
# Teto explícito de heap durante o build evita OOM-kill silencioso no Lightsail 2GB,
# que estava produzindo bundle corrompido (main-app.js de 475 bytes) e tela branca.
ENV NODE_OPTIONS="--max-old-space-size=1024"
RUN npm run build
# Verificação de integridade: aborta build se o bundle principal saiu muito pequeno.
RUN sh -c 'SIZE=$(find /app/.next/static/chunks -name "main-app-*.js" -exec stat -c "%s" {} + | head -1); if [ -z "$SIZE" ] || [ "$SIZE" -lt 20000 ]; then echo "❌ main-app bundle invalido ($SIZE bytes) — build provavelmente foi truncado por OOM"; exit 1; fi; echo "✅ main-app bundle: $SIZE bytes"'

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