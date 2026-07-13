# Build context = repository root (see docker-compose.yml: context ../..).
# The gallery depends on the @kerkit/* workspace packages, so the whole npm
# workspace graph has to be present and built in dependency order (Turbo).

FROM node:22-bookworm-slim AS build
WORKDIR /app

# Workspace manifests first (better layer caching), then sources.
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY examples ./examples

RUN npm ci
# Turbo builds packages (core → ai/server/pack) then the gallery
# (tsc for the server + vite build for the web bundle).
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3010

# Copy the whole built tree so the node_modules workspace symlinks stay intact.
COPY --from=build /app ./

# Drop privileges: run as the image's built-in unprivileged `node` user (uid
# 1000) instead of root. The tree is world-readable, the store is in-memory,
# and 3010 is unprivileged, so nothing here needs root.
USER node

EXPOSE 3010
# Serves the built SPA + /api on the same port. Mock provider unless
# OPENAI_API_KEY is set in the environment.
CMD ["node", "examples/gallery/server/dist/server.js"]
