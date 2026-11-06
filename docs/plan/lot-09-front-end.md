# Lot 9 · Front-end web : plan d'implémentation

**Objectif :** donner une interface à tout le back-end (lots 1 à 8). Chaque rôle a son espace : élève, prof, parent, école, plus le back-office Wema. Tout est branché à la vraie API. Le design sera repris ensuite, à partir de la charte (artefact « Wema · Charte graphique »).

**Cadre :** demandé par Olivier le 3 novembre 2026 (« développe tout de A à Z, ne m'attends pas »). Branche `lot-09-front-end`.

## Choix techniques

- **shadcn/ui** (Radix) dans `@wema/ui` (`packages/ui/src/components/ui/`). Le code est celui de shadcn, tel quel : les règles de lint sont assouplies pour ce seul dossier (`biome.json`).
- **Tailwind 4.** Les variables shadcn pointent sur les jetons de la charte (`packages/ui/src/globals.css`) :
  - thème clair « Crayon » et thème sombre « Nuit » (`next-themes`) ;
  - pastels par matière en classes Tailwind (`bg-butter`, `text-mint-ink`…).
- **Polices :** Urbanist (titres), Inter (texte), Lexend (lecture facile), STIX (formules), chargées par `next/font`.
- **Icônes Phosphor** pour l'application. Les composants shadcn gardent lucide en interne.
- **Champ mathématique :** MathLive. **Graphiques :** Recharts, via `chart.tsx` de shadcn.
- **Textes :** un fichier de messages par espace (`apps/web/messages/fr/<espace>.json`), fusionnés par `src/i18n/request.ts`.

## Espaces

| Espace      | URL       | Qui y a accès                                                    |
| ----------- | --------- | ---------------------------------------------------------------- |
| Élève       | `/eleve`  | inscrit dans une classe, ou compte sans autre rôle               |
| Prof        | `/prof`   | prof d'une classe, ou `exercises.write` dans une organisation    |
| Parent      | `/parent` | a au moins un enfant lié                                         |
| École       | `/ecole`  | `members.manage` ou `classes.manage` dans une école ou un réseau |
| Back-office | `/admin`  | sections visibles selon les permissions de plateforme            |

- L'aiguillage est fait par `lib/spaces.ts`, qui s'appuie sur la nouvelle route `GET /api/me/spaces`.
- `/` envoie vers le premier espace disponible.
- Le menu de la coquille permet de changer d'espace.

## Jeu de démonstration

`pnpm --filter @wema/api seed:demo` se lance après `seed`, avec l'API en marche. Il crée :
- une école avec une direction et une prof ;
- une classe de 4e en maths, avec 3 élèves et un devoir ;
- une famille avec un parent.

Ce sont des comptes fictifs en `@wema.test`, avec le mot de passe `demo-wema-2026`.

## Hors de ce lot

- Le design final.
- L'application mobile (Expo).
- La messagerie.
- La photo de copie.
- La voix (dictée, lecture à voix haute).
- La facturation.
