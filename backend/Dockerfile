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
RUN mkdir -p /app/uploads && chown -R app:app /app
USER app
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]