# syntax=docker/dockerfile:1.7
# Um Dockerfile, dois alvos: `server` (WebSocket) e `web` (Next.js standalone).
# As duas imagens finais são distroless e rodam como usuário sem privilégios.

FROM node:22-bookworm-slim AS deps
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN npm install --global pnpm@10.15.1
WORKDIR /repo
# Só os manifestos primeiro: a camada de dependências fica em cache enquanto eles não mudam.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/protocol/package.json packages/protocol/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# O endereço do socket é embutido no bundle do navegador durante o build.
ARG NEXT_PUBLIC_WS_URL=ws://localhost:4000/metrics
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @realtime-metrics/server build \
 && pnpm --filter @realtime-metrics/web build

FROM gcr.io/distroless/nodejs22-debian12:nonroot AS server
WORKDIR /app
ENV NODE_ENV=production PORT=4000
COPY --from=build /repo/apps/server/dist/index.js ./index.js
EXPOSE 4000
CMD ["index.js"]

FROM gcr.io/distroless/nodejs22-debian12:nonroot AS web
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
CMD ["apps/web/server.js"]
