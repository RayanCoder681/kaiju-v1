# Déploiement en ligne — procédure

> Prérequis obligatoires (voir aussi `docs/deploiement.md`) : hébergeur avec **disque persistant**
> et **WebSocket**. Kaiju utilise SQLite (fichier) et Socket.IO (connexions longues) — un hébergeur
> « serverless / edge » à système de fichiers éphémère **ne convient pas**.

Les variables d'environnement de production sont listées dans `.env.production.example`.
Les trois durcissements production sont déjà dans le code : cookie `secure`, `trust proxy`,
et QR/URL basés sur `PUBLIC_URL`.

## Option A — Railway (la plus simple, déploiement depuis GitHub)

1. Pousser le dépôt sur GitHub (voir « Ce dont j'ai besoin » dans le chat).
2. Sur railway.app : **New Project → Deploy from GitHub repo** → choisir le dépôt. Railway détecte
   le `Dockerfile` (config dans `deploy/railway.json`).
3. **Volume** : onglet du service → **Add Volume**, point de montage `/data`.
4. **Variables** (onglet Variables) : copier celles de `.env.production.example`. Mettre
   `DATABASE_PATH=/data/kaiju.sqlite`, `BACKUP_DIR=/data/backups`, `UPLOAD_DIR=/data/uploads`,
   un `SESSION_SECRET` long, et `TRUST_PROXY=1`.
5. **Domaine** : Settings → **Generate Domain**. Copier l'URL obtenue dans `PUBLIC_URL`, puis
   redéployer (pour que le QR pointe vers ce domaine).
6. Ouvrir `https://<domaine>/host`, créer le compte organisateur, lancer une session de test.

## Option B — Fly.io (volume + contrôle fin)

Prérequis : `flyctl` installé et connecté (`fly auth login`). Config dans `deploy/fly.toml`
(renseigner `<APP_NAME>` et `<REGION>`, ex. `cdg` = Paris).

```bash
fly launch --no-deploy --copy-config --config deploy/fly.toml
fly volumes create kaiju_data --size 1 --region <REGION>
fly secrets set SESSION_SECRET="$(openssl rand -hex 48)" PUBLIC_URL="https://<APP_NAME>.fly.dev"
fly deploy --config deploy/fly.toml
```

Le volume `kaiju_data` est monté sur `/data` (SQLite + médias + sauvegardes y persistent).

## Vérifications post-déploiement (à faire systématiquement)

- [ ] `GET /api/health` répond `{ ok: true }` (healthcheck vert).
- [ ] HTTPS actif ; la connexion organisateur fonctionne (cookie `secure` posé).
- [ ] Le QR d'une session encode l'URL **publique** (pas une IP privée ni localhost).
- [ ] Un participant rejoint depuis un autre réseau (4G) via le QR.
- [ ] Un quiz en direct se synchronise (Socket.IO/WebSocket OK derrière le proxy).
- [ ] **Persistance** : après un redéploiement, les sessions et comptes sont conservés
      (preuve que le volume fonctionne).
- [ ] Une sauvegarde manuelle se crée (Diagnostic) et le dossier survit au redéploiement.

## Limites & rappels

- Le rate-limiter d'entrée est **par IP** : derrière un proxy, `TRUST_PROXY=1` garantit la vraie IP
  cliente. Sans cela, tous les participants partageraient l'IP du proxy et seraient bridés ensemble.
- Sauvegarder le volume hors de l'instance (téléchargement périodique du dossier `backups/`).
- Coûts : dépendent de l'offre, de la région et de la taille du volume — à vérifier dans le panneau
  de l'hébergeur avant de confirmer. Aucun abonnement n'est souscrit sans ton accord.
