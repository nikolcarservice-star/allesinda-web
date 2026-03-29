# Next.js 15 standalone — production (Coolify / Docker). Репозиторий использует pnpm.
# Build: docker build -t allesinda-frontend .
# Run:  docker run -p 3000:3000 --env-file .env.production allesinda-frontend

FROM node:22-bookworm-slim AS deps
RUN npm install -g pnpm@9
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-bookworm-slim AS builder
RUN npm install -g pnpm@9
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Docker/Coolify подставляет HOSTNAME=id контейнера — Next слушает не весь интерфейс → 502 за Traefik.
# Принудительно задаём HOSTNAME только в момент запуска Node (перебивает рантайм).
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["sh", "-c", "exec env HOSTNAME=0.0.0.0 node server.js"]
