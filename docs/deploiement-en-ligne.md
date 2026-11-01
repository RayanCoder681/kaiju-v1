# Déploiement en ligne — procédure

> Prérequis obligatoires (voir aussi `docs/deploiement.md`) : hébergeur avec **disque persistant**
> et **WebSocket**. Kaiju utilise SQLite (fichier) et Socket.IO (connexions longues) — un hébergeur
> « serverless / edge » à système de fichiers éphémère **ne convient pas**.

Les variables d'environnement de production sont listées dans `.env.production.example`.
Les trois durcissements production sont déjà dans le code : cookie `secure`, `trust proxy`,
et QR/URL basés sur `PUBLIC_URL`. Le premier compte exige aussi `SETUP_KEY` en production, et les
tentatives d'authentification sont limitées par IP.

## Choisir une plateforme

Kaiju est un serveur Express/Socket.IO monolithique avec SQLite sur disque. Le même processus sert
l'interface, l'API et les WebSockets ; le volume doit conserver `/data` entre redémarrages.

| Plateforme | Offre gratuite | Compatibilité avec le dépôt actuel |
| --- | --- | --- |
| Vercel | Fonctions serverless | Non recommandée : l'application a besoin d'un stockage SQLite persistant et d'un processus Socket.IO unique. Une migration demanderait une base externe et une architecture temps réel partagée. |
| Render | Web Service gratuit | Démo temporaire uniquement : le service s'endort après 15 minutes sans trafic entrant et SQLite est perdu au redémarrage/sommeil. Pas de disque persistant gratuit. |
| Oracle Cloud Always Free | VM selon quotas et capacité disponible | Compatible avec le Dockerfile et le Compose Caddy du dépôt. Demande administration SSH, domaine et ouverture des ports ; Oracle peut récupérer une VM jugée inactive. |
| Railway Hobby | 5 USD/mois minimum, consommation incluse jusqu'à 5 USD | Déploiement simple avec volume persistant (plafond de 5 Go sur Hobby) et WebSockets ; ce n'est pas gratuit. |

Pour rester à coût nul sans réécrire le stockage, le chemin prévu ici est la VM Oracle avec
`deploy/docker-compose.yml`. Ce choix n'est pas une garantie de disponibilité : vérifier les quotas
et conditions OCI au moment de la création. Pour une démonstration ponctuelle dont les données
peuvent être perdues, Render Free peut suffire ; ne pas y saisir de sessions à conserver.

## Option — Railway (la plus simple, déploiement depuis GitHub, payant)

1. Pousser le dépôt sur GitHub (voir « Ce dont j'ai besoin » dans le chat).
2. Sur railway.app : **New Project → Deploy from GitHub repo** → choisir le dépôt. Railway détecte
   le `Dockerfile`. Pour utiliser `deploy/railway.json`, indique son chemin dans les réglages du
   service ; pour un nouveau service, règle le démarrage et le healthcheck dans le tableau de bord,
   car le format Railway Config as Code est en cours de retrait.
3. **Volume** : onglet du service → **Add Volume**, point de montage `/data`.
4. **Variables** (onglet Variables) : copier celles de `.env.production.example`. Mettre
   `DATABASE_PATH=/data/kaiju.sqlite`, `BACKUP_DIR=/data/backups`, `UPLOAD_DIR=/data/uploads`,
   un `SESSION_SECRET` long, une `SETUP_KEY` différente, et `TRUST_PROXY=1`. Garder la `SETUP_KEY`
   secrète : elle autorise la création du premier compte organisateur. Limiter les tentatives de
   connexion est activé côté serveur.
5. **Domaine** : Settings → **Generate Domain**. Copier l'URL obtenue dans `PUBLIC_URL`, puis
   redéployer (pour que le QR pointe vers ce domaine).
6. Ouvrir `https://<domaine>/host`, créer le compte organisateur, lancer une session de test.

## Option — Fly.io (volume + contrôle fin, payant)

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
