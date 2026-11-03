# 0007 · Déploiement : un serveur, Docker Compose, Caddy, pg-boss

- **Date :** 2026-11-03
- **Statut :** accepté

## Contexte

Wema doit passer en production pour les premiers bêta-testeurs (élèves de Charles, quelques familles et écoles). Il faut un déploiement qu'Olivier peut tenir seul : peu de pièces, pas de plateforme propriétaire, des sauvegardes et une restauration testées. Le serveur fait tourner quatre programmes : Postgres, `services/math` (Python), l'API (Node) et le web (Next.js). Les tâches périodiques (suivi actif, envois, banque hebdomadaire) tournaient sur des minuteries internes de l'API, valables pour un seul processus.

## Décision

- **Un seul serveur (VPS) avec Docker Compose** : `infra/docker-compose.prod.yml`. Une image par programme (`apps/api/Dockerfile`, `apps/web/Dockerfile`, `services/math/Dockerfile`), construites sur le serveur depuis le dépôt (`docker compose up -d --build`). Pas de registre d'images pour l'instant ; la CI construit les trois images à chaque modification pour détecter une casse.
- **Caddy en frontal** : seul service exposé (80 et 443), certificats Let's Encrypt automatiques, redirection vers HTTPS, HSTS. Postgres, `services/math` et l'API ne sont joignables que sur le réseau interne ; le web relaie `/api` vers l'API (une seule origine, cookie de session « first-party »).
- **API lancée par tsx** (comme en développement) plutôt que compilée : les paquets du monorepo sont exportés en TypeScript, et un bundle aurait dû traiter à part pg, PGlite et pg-boss. L'image est plus grosse (environ 900 Mo), sans conséquence sur un serveur.
- **Web en sortie « standalone »** de Next.js : image légère, `node apps/web/server.js`. `WEMA_API_URL` est lu à la construction (relais `/api`).
- **pg-boss pour les tâches périodiques** dès qu'il y a un Postgres (`apps/api/src/scheduler.ts`) : rythmes cron en base, files « exclusives » (un seul passage en attente ou en cours, tous serveurs confondus), pas de nouvel essai d'un passage en échec (le suivant le rattrape). Sans Postgres (PGlite), les minuteries internes restent. La logique des tâches ne change pas : les garanties (une relance par élève et par jour, banque une fois par semaine et par organisation) restent dans la base.
- **Sauvegarde quotidienne** par un service du compose : `pg_dump` au format « custom » (compressé), vérifiée par `pg_restore --list` avant d'être gardée, rotation après 14 jours (réglable), dans `infra/backups/`. Restauration par `infra/restore.sh` (arrête l'API et le web, recrée la base, restaure, relance). Testée de bout en bout le 3 novembre 2026.
- **Configuration de production stricte** (`apps/api/src/config.ts`) : l'API refuse de démarrer sans `DATABASE_URL`, `WEMA_CODE_SECRET` (32 caractères au moins), `WEMA_HEALTH_KEY`, une `WEMA_PUBLIC_URL` en https ; les messages d'erreur ne recopient aucune valeur. Cookies `Secure` en production. Le web envoie une CSP, HSTS, `X-Frame-Options`, `nosniff`, une `Permissions-Policy` (micro et caméra pour Wema seulement). Les journaux restent sans donnée personnelle (types d'erreur, compteurs), avec rotation des fichiers de logs Docker ; pas de journal d'accès Caddy (adresses IP).

## Conséquences

- Un seul serveur : une panne arrête Wema le temps de la réparer. Acceptable pour la bêta ; le passage à plusieurs serveurs est déjà possible côté tâches (pg-boss) et côté base (`DATABASE_URL` vers un Postgres géré).
- Les sauvegardes sont sur le même serveur : il faut les copier ailleurs (sauvegardes de l'hébergeur, ou copie régulière vers un stockage externe, voir `docs/deploiement.md`). La clé `WEMA_HEALTH_KEY` doit être conservée à part : sans elle, les données de santé d'une sauvegarde sont illisibles.
- La CSP autorise les scripts en ligne (`'unsafe-inline'`), nécessaires à Next.js sans nonce. Passer à une CSP à nonce demandera un middleware (proxy) côté web.
- L'hébergement des données de santé peut être soumis à des obligations selon le pays des utilisateurs (par exemple une certification d'hébergeur en France) : à vérifier avant d'ouvrir la saisie des besoins de santé à grande échelle.
