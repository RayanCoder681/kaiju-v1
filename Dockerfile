# ─────────────────────────────────────────────────────────────
# Kaiju — image de production.
# Étape 1 : build (installe tout, compile shared + server + client).
# Étape 2 : runtime léger (dépendances de prod + artefacts compilés).
# ─────────────────────────────────────────────────────────────

# ---- Étape build ----
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Outils de compilation pour le module natif better-sqlite3.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Manifests d'abord (cache des couches d'install).
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci

# Sources + build complet.
COPY . .
RUN npm run build

# Élaguer vers les dépendances de production uniquement (better-sqlite3 reste compilé).
RUN npm prune --omit=dev

# ---- Étape runtime ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# libstdc++ suffit à l'exécution du binaire natif déjà compilé.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Artefacts et dépendances de prod depuis l'étape build.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist

# Dossiers persistants (montés sur un volume en production — voir docs/deploiement.md).
RUN mkdir -p server/data server/backups server/uploads

EXPOSE 4000

# Démarre le serveur compilé : applique les migrations, sert l'API + le client + le temps réel.
CMD ["node", "server/dist/index.js"]
