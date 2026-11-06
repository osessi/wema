# Application mobile élève (Expo)

L'appli mobile (`apps/mobile`) est la version téléphone de l'espace élève : accueil (prochaine étape, devoirs, relances), devoirs et exercices, réponse avec des touches mathématiques, retour « Pas encore » / « Bravo », photo de la feuille, prof IA (fil de messages, indices, modes), chemin de progression, profil et préférences, messages avec les profs, lecture à voix haute. Elle parle à la même API que le web.

- **Pile :** Expo SDK 58 (React Native 0.88), Expo Router (routes dans `src/app/`), TypeScript strict.
- **Textes :** tous dans `src/i18n/fr.ts` (tutoiement). **Charte :** `src/theme.ts` (couleurs de `packages/ui/src/globals.css`, Urbanist et Inter, thèmes clair et sombre selon le réglage du téléphone).
- **Session :** jeton gardé dans le coffre chiffré du téléphone (expo-secure-store), envoyé en `Authorization: Bearer`. Voir « Comment l'API reconnaît l'appli » plus bas.

## 1. La lancer sur ton téléphone avec Expo Go (développement)

Il faut : l'ordinateur avec Wema qui tourne (API sur le port 4000), et le téléphone **sur le même réseau Wi-Fi** que l'ordinateur.

1. Sur le téléphone, installe **Expo Go** (App Store ou Google Play, gratuit, à jour : l'appli utilise le SDK 58).
2. Sur l'ordinateur :

   ```sh
   export PATH="$HOME/.local/node/bin:$PATH"
   pnpm --filter @wema/mobile start
   ```

   Un QR code s'affiche dans le terminal.
3. Scanne le QR code : avec l'appareil photo de l'iPhone, ou depuis Expo Go sur Android. L'appli s'ouvre dans Expo Go.
4. Connecte-toi avec un compte de démonstration : `eleve1@wema.test` / `demo-wema-2026` (onglet « E-mail »), ou un compte élève avec son identifiant et son code (onglet « Identifiant élève »).

**Adresse de l'API.** Sans réglage, l'appli appelle l'ordinateur qui fait tourner Expo, port 4000 (elle l'affiche en bas de l'écran de connexion). Pour une autre adresse, copie `apps/mobile/.env.example` en `apps/mobile/.env` et renseigne `EXPO_PUBLIC_WEMA_API_URL` (sans `/api`), puis relance `start`. Les pages légales (écran d'acceptation des conditions) s'ouvrent sur le site web : `EXPO_PUBLIC_WEMA_WEB_URL` (par défaut le même ordinateur, port 3000).

**Si le téléphone ne trouve pas l'ordinateur** (réseau d'entreprise, Wi-Fi qui isole les appareils) : `pnpm --filter @wema/mobile start -- --tunnel` (Expo propose d'installer son outil de tunnel la première fois). Le tunnel ne sert que pour l'appli : l'API doit alors être joignable depuis le téléphone (adresse publique dans `EXPO_PUBLIC_WEMA_API_URL`).

**Limites d'Expo Go :** les notifications push n'y marchent pas (Android) ou pas pour notre projet (iOS) : il faut une version installée (ci-dessous). Tout le reste marche dans Expo Go.

## 2. Vérifications

```sh
pnpm --filter @wema/mobile typecheck      # types (y compris les routes d'API utilisées)
pnpm --filter @wema/mobile test           # tests (format des réponses, clavier, voix)
pnpm exec biome check apps/mobile
cd apps/mobile && npx expo-doctor         # configuration Expo et versions
cd apps/mobile && npx expo export --platform ios   # le code se compile pour iOS (pareil pour android)
```

Les types des réponses viennent du serveur (`AppType` de `@wema/api`) : si une route change de forme, `typecheck` le signale dans l'appli.

## 3. La publier sur les stores (EAS Build)

On utilise **EAS** (le service d'Expo) : il construit l'appli iOS et Android dans le cloud, sans Xcode ni Android Studio sur ton Mac.

### 3.1 Les comptes à créer (une fois)

| Compte                  | Où                                | Coût                                                | Délai                                                           |
| ----------------------- | --------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| Expo                    | expo.dev (gratuit pour commencer) | gratuit, offres payantes pour plus de constructions | immédiat                                                        |
| Apple Developer Program | developer.apple.com/programs      | 99 $ par an                                         | quelques jours ; pour une entreprise, il faut un numéro D-U-N-S |
| Google Play Console     | play.google.com/console           | 25 $ une fois                                       | quelques jours (vérification d'identité)                        |

Conseil : ouvre les comptes Apple et Google au nom de la société Wema (compte « organisation »), pas à titre personnel : le nom affiché sur les stores est celui du compte.

### 3.2 Lier le projet à Expo (une fois)

```sh
cd apps/mobile
npx eas-cli@latest login        # ton compte Expo
npx eas-cli@latest init         # crée le projet sur expo.dev et ajoute son identifiant (extra.eas.projectId) dans app.json
```

L'identifiant du projet sert aussi aux notifications push.

Avant de publier, vérifie dans `app.json` : le nom (`Wema`), l'identifiant `app.wema.eleve` (iOS `bundleIdentifier`, Android `package` : il ne pourra plus changer après la première publication ; mets le domaine que vous possédez), l'icône et l'écran de démarrage (`assets/` contient encore les images par défaut d'Expo, à remplacer par celles de Wema).

### 3.3 Construire

Dans `eas.json`, remplace `https://REMPLACER-PAR-L-ADRESSE-DE-L-API` par l'adresse HTTPS de l'API de production (Android refuse le HTTP simple dans une appli publiée).

```sh
cd apps/mobile
npx eas-cli@latest build --profile preview --platform android   # .apk à installer à la main, pour les bêta-testeurs
npx eas-cli@latest build --profile production --platform all    # versions pour les stores
```

EAS demande à la première construction s'il doit créer les certificats (iOS) et la clé de signature (Android) : réponds oui, il les garde pour toi.

### 3.4 Envoyer aux stores

```sh
npx eas-cli@latest submit --platform ios       # vers App Store Connect (puis TestFlight pour les testeurs)
npx eas-cli@latest submit --platform android   # vers la Google Play Console (piste de test interne d'abord)
```

Sur chaque store, il reste à remplir la fiche (description, captures d'écran, politique de confidentialité : reprends les pages légales du web), et à déclarer qu'il s'agit d'une appli **pour des mineurs** (Apple : catégorie Éducation, âge ; Google : questionnaire « Familles »). Apple relit chaque version (un à deux jours en général).

Les corrections de code JavaScript peuvent ensuite être envoyées sans repasser par les stores avec **EAS Update** (`npx eas-cli@latest update`), tant que les modules natifs ne changent pas.

## 4. Comment l'API reconnaît l'appli (session par jeton)

Le web utilise un cookie `HttpOnly`. L'appli, elle :

1. envoie toujours l'en-tête `x-wema-client: mobile` ;
2. à la connexion (`/api/auth/login`, `/api/auth/learner`, `/api/auth/register`, `/api/auth/phone/verify`), l'API répond `{ ok: true, token }` **au lieu** de poser un cookie ;
3. l'appli garde le jeton dans le coffre du téléphone et l'envoie ensuite en `Authorization: Bearer <jeton>` ;
4. la déconnexion (`POST /api/auth/logout`) ferme la session côté serveur.

Le jeton est le même jeton de session que le cookie (même durée, même fermeture quand le code élève change). Une requête qui porte `Authorization` ou `x-wema-client` n'est **jamais** authentifiée par un cookie : c'est ce qui permet de l'exempter du contrôle d'origine (`checkOrigin`) sans risque de CSRF. Une page d'un autre site ne peut pas poser ces en-têtes sans requête préalable CORS, que l'API n'autorise pas. Le web garde exactement le même comportement. Tests : `apps/api/src/mobile-auth.test.ts`.

## 5. Notifications push

- L'appli demande l'autorisation depuis « Moi » > « Notifications », puis enregistre le jeton Expo de l'appareil : `POST /api/me/push-tokens` `{ token, platform }` ; `DELETE /api/me/push-tokens` `{ token }` à la déconnexion. Table `push_tokens` (migration `0023_push_tokens.sql`) ; un appareil n'appartient qu'au dernier compte connecté, 10 appareils au plus par personne.
- **Envoi** : le module d'envoi (`apps/api/src/notify/dispatch.ts`) pousse chaque notification du canal « app » (relances, messages regroupés, rappels de séance) aux appareils de la personne, par `https://exp.host/--/api/v2/push/send` (adaptateur `notify/expo.ts`, 100 messages par appel), hors heures calmes (sauf le rappel 1 h avant une séance). Un ticket `DeviceNotRegistered` retire le jeton aussitôt ; les tickets acceptés (`push_receipts`, migration 0025) sont relus 15 min plus tard par `getReceipts`, et un reçu `DeviceNotRegistered` retire aussi le jeton. Variable facultative côté API : `EXPO_ACCESS_TOKEN` (sécurité renforcée des envois, dans les réglages du projet sur expo.dev). La notification porte `data.path` (page du web correspondante), pas encore utilisé par l'appli.
- Pour qu'iOS accepte les push, EAS crée la clé APNs à la première construction ; pour Android, il faut ajouter la clé FCM (Firebase) dans le projet expo.dev (guide « Push notifications setup » d'Expo).
- Une notification ouvre l'appli ; elle n'ouvre pas encore un écran précis.

## 6. Limites connues

- Les formules sont affichées en texte (pas de rendu LaTeX comme sur le web) ; la réponse se tape au clavier avec des touches mathématiques (x, =, fraction, racine, puissance, « ou »…) et est convertie au format de `services/math`.
- Les réponses du prof IA arrivent d'un bloc (pas d'affichage mot à mot comme sur le web).
- Pas de dictée vocale (la lecture à voix haute, elle, marche avec la voix du téléphone).
- Pas de connexion Google / Apple ni par code SMS dans l'appli pour l'instant (e-mail et identifiant élève seulement).
- Pas de mode hors ligne : chaque écran se recharge à l'ouverture, et en tirant vers le bas.
- La version web de l'appli (`expo export --platform web`) n'est pas une cible : le site web existe déjà.
