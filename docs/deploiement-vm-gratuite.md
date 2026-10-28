# Déploiement gratuit et durable — VM "Always Free" + HTTPS

Objectif : héberger Kaiju **gratuitement**, avec données **persistantes** et **toujours en ligne**,
sans réécrire la base SQLite. On utilise une VM gratuite (ex. Oracle Cloud Always Free) qui exécute
l'image Docker Kaiju derrière Caddy (HTTPS automatique).

> Pourquoi pas un PaaS « un clic » gratuit ? Les tiers gratuits de Railway/Fly/Render soit facturent
> le disque persistant, soit s'endorment et effacent le fichier SQLite au redémarrage. Une VM Always
> Free garde le disque et reste allumée.

## 0. Ce qu'il faut

- Un **compte** chez un fournisseur de VM gratuite. Recommandé : **Oracle Cloud Free Tier**
  (« Always Free », VM ARM Ampere, disque persistant, gratuit en continu). Alternatives : Google
  Cloud `e2-micro` Always Free, ou tout petit VPS si un coût minime est acceptable.
  *(L'inscription demande une carte pour vérification ; l'usage Always Free reste gratuit.)*
- Un **nom de domaine** pointant vers l'IP publique de la VM (un sous-domaine gratuit convient :
  DuckDNS, ou un domaine que tu possèdes — ton site `zoxbt.is-a.dev` peut fournir un sous-domaine).
  Le domaine est nécessaire pour le HTTPS automatique.

## 1. Créer la VM

- Oracle Cloud → Compute → Instances → Create. Choisir une image **Ubuntu 22.04**, forme
  **Always Free** (Ampere A1 ou VM.Standard.E2.1.Micro). Ajouter ta clé SSH publique.
- Réseau : autoriser les ports **80** et **443** entrants (Security List / NSG de l'hébergeur),
  en plus de 22 (SSH).

## 2. Installer Docker sur la VM

```bash
ssh ubuntu@<IP_PUBLIQUE>
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
# Pare-feu interne (si ufw actif) :
sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw allow 22
```

## 3. Récupérer le code sur la VM

Deux options :

- **Via GitHub** (une fois le dépôt poussé — voir le chat) :
  ```bash
  git clone https://github.com/<ton-compte>/kaiju.git && cd kaiju
  ```
- **Via l'archive** : transférer `kaiju-deploy.zip` par `scp`, puis `unzip kaiju-deploy.zip && cd kaiju`.

## 4. Pointer le domaine

Créer un enregistrement **A** `kaiju.tondomaine` → `<IP_PUBLIQUE>` de la VM. Attendre la propagation
(quelques minutes). Vérifier : `ping kaiju.tondomaine` doit renvoyer l'IP de la VM.

## 5. Lancer Kaiju (HTTPS automatique)

```bash
export DOMAIN=kaiju.tondomaine
export EMAIL=ton-email@exemple.com
export SESSION_SECRET=$(openssl rand -hex 48)
docker compose -f deploy/docker-compose.yml up -d --build
```

Caddy obtient automatiquement un certificat Let's Encrypt pour `DOMAIN`. Au bout d'une minute :

- Console : `https://kaiju.tondomaine/host` → créer le compte organisateur.
- Les participants rejoignent via le QR, qui encode désormais l'URL publique.

## 6. Vérifications (voir aussi `docs/deploiement-en-ligne.md`)

- [ ] `https://kaiju.tondomaine/api/health` → `{ ok: true }`.
- [ ] Connexion organisateur OK (HTTPS, cookie `secure`).
- [ ] QR d'une session = URL publique ; un téléphone en 4G rejoint et répond à un quiz en direct.
- [ ] `docker compose restart` puis reconnexion : sessions/comptes **conservés** (volume OK).

## 7. Exploitation

```bash
docker compose -f deploy/docker-compose.yml logs -f kaiju     # journaux
docker compose -f deploy/docker-compose.yml pull && \
  docker compose -f deploy/docker-compose.yml up -d --build    # mise à jour
```

Sauvegardes : elles sont dans le volume `kaiju_data` (`/data/backups`). Les copier hors VM
régulièrement :

```bash
docker run --rm -v kaiju_kaiju_data:/data -v $PWD:/out alpine \
  sh -c 'cd /data && tar czf /out/kaiju-backup-$(date +%F).tgz backups kaiju.sqlite'
```

## Repli si tu préfères éviter la mise en place VM

Si un **petit coût** (quelques USD/mois) est acceptable, **Fly.io** (fichiers `deploy/fly.toml`)
demande seulement 4 commandes depuis ton PC et gère le volume + HTTPS. Voir
`docs/deploiement-en-ligne.md`, option B.
