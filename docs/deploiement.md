# Mettre Wema en ligne

Ce guide explique, pas à pas, comment faire tourner Wema sur un serveur à vous, avec votre nom de domaine et le HTTPS. Comptez une heure la première fois. Les choix techniques sont expliqués dans la fiche `docs/decisions/0007-deploiement.md`.

## 1. Le principe

Un seul serveur loué (un « VPS »), sur lequel Docker fait tourner six petits programmes :

| Programme  | Rôle                                                                    |
| ---------- | ----------------------------------------------------------------------- |
| `caddy`    | la porte d'entrée : reçoit les visiteurs, gère le HTTPS automatiquement |
| `web`      | le site Wema (Next.js)                                                  |
| `api`      | le serveur (comptes, exercices, prof IA, tâches planifiées)             |
| `math`     | la vérification mathématique (Python)                                   |
| `postgres` | la base de données                                                      |
| `backup`   | une sauvegarde de la base chaque nuit, gardée 14 jours                  |

Tout est décrit dans un seul fichier : `infra/docker-compose.prod.yml`. Seul `caddy` est visible depuis Internet.

### Adresses : site, /app, /api

Tout est servi sous un seul domaine (ex. `https://wema.winneragency.co`) :

| Adresse  | Qui répond                      | Exemples                                                                            |
| -------- | ------------------------------- | ----------------------------------------------------------------------------------- |
| `/`      | le site public (`apps/site`)    | page d'accueil, présentation                                                        |
| `/app/…` | l'application (`web`, Next.js)  | `/app/connexion`, `/app/eleve`, `/app/prof`, `/app/compte`, `/app/mentions-legales` |
| `/api/…` | le serveur (`api`), directement | `/api/health`, `/api/auth/oauth/google/callback`                                    |

- Le chemin `/app` est le `basePath` de Next, lu **au build** dans `WEMA_BASE_PATH` (`/app` par défaut, en développement comme en production : mêmes adresses partout). Côté API, `WEMA_APP_PATH` (`/app` par défaut) sert à construire les liens vers les pages (e-mails, notifications, retours de paiement Stripe et Kkiapay, retour après Google ou Apple). Les deux doivent rester égaux.
- `WEMA_PUBLIC_URL` est l'**origine** seule (`https://wema.winneragency.co`, sans `/app`) : origine autorisée pour les écritures, base des adresses `/api/…` (désinscription, retours OAuth à déclarer chez Google et Apple : `https://<domaine>/api/auth/oauth/google/callback` et `…/apple/callback`).
- Le navigateur appelle toujours `/api/…` à la racine. Le frontal doit envoyer `/api/*` à `api:4000`, `/app/*` à `web:3000` et le reste au site. En développement (et en repli si le frontal envoie tout au web), Next relaie `/api/*` vers l'API (`WEMA_API_URL`) et redirige `/` vers `/app`.
- Le cookie de session est posé avec `Path=/` : il vaut pour `/app` et pour `/api`.
- Appli mobile : `EXPO_PUBLIC_WEMA_API_URL=https://<domaine>` (sans `/api`) et `EXPO_PUBLIC_WEMA_WEB_URL=https://<domaine>/app` (pages légales).

## 2. Louer un serveur

Ce qu'il faut : **2 processeurs (vCPU), 4 Go de mémoire au minimum (8 Go conseillés), 40 Go de disque**, système **Ubuntu 24.04**.

Choisissez la région du centre de données la plus proche de la majorité de vos utilisateurs (vous pouvez mesurer le temps de réponse depuis chez eux). Deux hébergeurs simples, avec une interface claire et une facturation au mois :

| Hébergeur                             | Offre conseillée                       | Coût approximatif | Points forts                                                                                      |
| ------------------------------------- | -------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| **Hetzner Cloud** (hetzner.com/cloud) | 4 vCPU, 8 Go (gamme « CX » ou « CPX ») | 8 à 15 € par mois | le plus simple et le moins cher ; sauvegardes automatiques du serveur en option (+20 %)           |
| **OVHcloud VPS** (ovhcloud.com)       | VPS 4 vCPU, 8 Go                       | 7 à 15 € par mois | nombreuses régions ; offres certifiées pour les données de santé si vous en avez besoin plus tard |

Les prix changent : vérifiez sur le site au moment de commander. Ajoutez environ 10 à 15 € par an pour le nom de domaine.

À la commande, ajoutez votre **clé SSH** (l'hébergeur explique comment) : c'est elle qui vous permet de vous connecter au serveur sans mot de passe.

> Données de santé : selon le pays de vos utilisateurs, la loi peut exiger un hébergeur certifié pour les besoins de type dys ou TDAH (par exemple la certification « HDS » en France). Renseignez-vous avant d'ouvrir largement cette fonction.

## 3. Le nom de domaine

Chez votre registraire (OVHcloud, Gandi, Namecheap…), dans la zone DNS du domaine, créez un enregistrement :

- type **A**, nom `@` (ou `app` si vous voulez `app.votredomaine.com`), valeur : **l'adresse IP du serveur** ;
- si l'hébergeur vous donne aussi une adresse IPv6, ajoutez un enregistrement **AAAA** avec elle.

Il faut parfois attendre quelques minutes, jusqu'à une heure. Pour vérifier depuis votre Mac : `ping votredomaine.com` doit afficher l'adresse IP du serveur.

## 4. Préparer le serveur

Connectez-vous (remplacez par l'adresse IP de votre serveur) :

```sh
ssh root@ADRESSE_IP
```

Puis, sur le serveur :

```sh
# Mises à jour et pare-feu : seuls SSH, HTTP et HTTPS sont ouverts.
apt update && apt upgrade -y
apt install -y git ufw
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable

# Docker (script officiel).
curl -fsSL https://get.docker.com | sh
```

## 5. Récupérer le code

Le dépôt GitHub est privé : le serveur a besoin d'une **clé de déploiement** (accès en lecture seule).

```sh
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
```

Copiez la ligne affichée dans GitHub : dépôt `osessi/wema` → Settings → Deploy keys → Add deploy key (laissez « Allow write access » décoché). Puis :

```sh
git clone git@github.com:osessi/wema.git /opt/wema
cd /opt/wema
```

## 6. Renseigner les variables

```sh
cp infra/env.prod.example infra/.env
nano infra/.env
```

À renseigner obligatoirement :

| Variable                    | Quoi mettre                                             |
| --------------------------- | ------------------------------------------------------- |
| `WEMA_DOMAIN`               | votre domaine, sans `https://` (ex. `wema.exemple.com`) |
| `ACME_EMAIL`                | votre e-mail (pour les certificats HTTPS)               |
| `POSTGRES_PASSWORD`         | résultat de `openssl rand -hex 24`                      |
| `WEMA_CODE_SECRET`          | résultat de `openssl rand -hex 32`                      |
| `WEMA_HEALTH_KEY`           | résultat de `openssl rand -base64 32`                   |
| `WEMA_SUPER_ADMIN_EMAIL`    | votre e-mail de super admin                             |
| `WEMA_SUPER_ADMIN_PASSWORD` | un mot de passe d'au moins 12 caractères                |
| `OPENROUTER_API_KEY`        | votre clé OpenRouter (sans elle, pas d'IA)              |

Les commandes `openssl` se tapent sur le serveur ; copiez leur résultat dans le fichier.

**Très important : copiez `WEMA_HEALTH_KEY` dans votre gestionnaire de mots de passe.** Sans elle, les données de santé d'une sauvegarde sont illisibles, pour toujours. Ne la changez jamais une fois Wema en service.

Facultatif : les prestataires d'envoi (SMS, WhatsApp, e-mail), la connexion Google et Apple, etc. Leurs variables sont décrites dans `.env.example` à la racine du dépôt : recopiez dans `infra/.env` celles des prestataires que vous activez. Sans elles, Wema fonctionne, mais sans ces fonctions.

Si une variable obligatoire manque ou est mal formée, l'API refuse de démarrer et dit laquelle (`docker compose … logs api`).

## 7. Démarrer

```sh
cd /opt/wema
docker compose -f infra/docker-compose.prod.yml up -d --build
```

La première fois, la construction prend 5 à 10 minutes. Ensuite :

```sh
docker compose -f infra/docker-compose.prod.yml ps
```

Tous les services doivent être `Up`, et `postgres`, `math`, `api`, `web` marqués `(healthy)`. Ouvrez `https://votredomaine.com/app/connexion` : la page de connexion s'affiche, avec le cadenas HTTPS. Connectez-vous avec le super admin.

Pour ne pas retaper le chemin du fichier à chaque commande :

```sh
echo 'alias wema="docker compose -f /opt/wema/infra/docker-compose.prod.yml"' >> ~/.bashrc && source ~/.bashrc
```

Les exemples ci-dessous utilisent ce raccourci `wema`.

Facultatif, le jeu d'exemple du référentiel (France et Bénin, quelques notions) : `wema exec api node --import tsx src/seed.ts`.

## 8. Sauvegardes

- Chaque nuit à 03:00 (heure UTC, réglable par `BACKUP_AT`), la base est sauvegardée dans `/opt/wema/infra/backups/` (fichiers `wema-AAAAMMJJ-HHMMSS.dump`). Les fichiers de plus de 14 jours sont supprimés (`BACKUP_KEEP_DAYS`).
- Sauvegarde immédiate (avant une mise à jour, par exemple) : `wema exec backup /bin/bash /backup.sh now`.
- **Copiez les sauvegardes hors du serveur.** Si le serveur disparaît, ses sauvegardes aussi. Le plus simple : activer les sauvegardes automatiques du serveur chez l'hébergeur, et de temps en temps rapatrier le dernier fichier sur votre Mac :

  ```sh
  scp root@ADRESSE_IP:/opt/wema/infra/backups/$(ssh root@ADRESSE_IP 'ls -t /opt/wema/infra/backups | head -1') .
  ```

### Restaurer

La base actuelle est **remplacée** par la sauvegarde choisie. Wema est coupé une à deux minutes.

```sh
cd /opt/wema
ls -lt infra/backups/            # choisir le fichier
infra/restore.sh infra/backups/wema-20261103-030000.dump
```

Le script demande de taper `oui`, arrête l'API et le web, restaure, puis relance tout.

## 9. Mettre à jour Wema

```sh
cd /opt/wema
wema exec backup /bin/bash /backup.sh now    # sauvegarde par précaution
git pull
wema up -d --build
```

Les changements de la base (migrations) s'appliquent seuls au démarrage de l'API. Le site est coupé quelques secondes pendant le redémarrage.

Pour revenir en arrière : `git checkout <version précédente>`, puis `wema up -d --build` (et, si une migration a abîmé des données, restaurer la sauvegarde faite juste avant).

## 10. Surveiller et dépanner

| Besoin                         | Commande                                         |
| ------------------------------ | ------------------------------------------------ |
| état des services              | `wema ps`                                        |
| journaux de l'API (100 lignes) | `wema logs --tail 100 api`                       |
| suivre les journaux en direct  | `wema logs -f api web`                           |
| redémarrer un service          | `wema restart api`                               |
| place restante sur le disque   | `df -h /`                                        |
| tout arrêter / tout relancer   | `wema down` / `wema up -d` (les données restent) |

Les journaux ne contiennent aucune donnée personnelle (pas d'e-mail, de téléphone ni de contenu d'élève) et sont limités en taille. Les services redémarrent seuls en cas de plantage et au redémarrage du serveur.

Problèmes fréquents :

- **Le site ne s'ouvre pas en HTTPS** : le domaine ne pointe pas encore vers le serveur (étape 3), ou les ports 80 et 443 sont fermés. Regardez `wema logs caddy`.
- **`api` ne devient pas `healthy`** : une variable manque ou est mal formée. `wema logs api` dit laquelle.
- **Erreur « à renseigner dans infra/.env »** au lancement : la variable citée est vide dans `infra/.env`.

N'utilisez jamais `wema down -v` : le `-v` efface la base.

## 11. Ce qui n'est pas encore couvert

- Un seul serveur : s'il tombe en panne, Wema est indisponible jusqu'à sa réparation (ou sa recréation à partir d'une sauvegarde).
- Pas d'alerte automatique si un service tombe : un service de surveillance gratuit (qui appelle `https://votredomaine.com/api/health` toutes les minutes et vous écrit en cas de problème) est un bon complément.
- L'application mobile se publie séparément, sur les magasins d'applications.
- Capacité mesurée (novembre 2026) : environ 1 000 élèves actifs en même temps pour le serveur conseillé ; détails, goulots et réglages (`DATABASE_POOL_MAX`, `UV_THREADPOOL_SIZE`) dans `docs/tests-charge-2026-11.md`.
