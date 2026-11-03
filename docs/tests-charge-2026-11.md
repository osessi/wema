# Tests de charge, de robustesse et de justesse : novembre 2026

_Tour 4, 3 novembre 2026. Mesures faites sur le Mac de développement : Postgres 17 dans Docker (partagé avec d'autres travaux en cours), `services/math` partagé, une seule API Node (`node --import tsx`), sans IA réelle. Les chiffres sont des ordres de grandeur. Ils ne valent pas une mesure sur le serveur de production._

## 1. Jeu de données

Une base à part, `wema_load`, avec une API sur le port 4200. Les scripts sont dans le scratchpad de la session (`charge/seed-volume.mts`, `bench.mts`, `load.mts`, `extreme.mts`). Ils ne font pas partie du dépôt.

| Contenu                  | Volume                                                       |
| ------------------------ | ------------------------------------------------------------ |
| école « Collège charge » | 30 classes de maths (4e et 3e, France), 30 profs             |
| élèves                   | 900 (30 par classe)                                          |
| familles                 | 300 parents, 450 liens parent ↔ enfant                       |
| journal d'apprentissage  | 35 240 réponses (20 à 60 par élève, sur 60 jours)            |
| devoirs                  | 1 par classe, soit 900 variantes vérifiées par services/math |
| messages                 | 2 700 (40 annonces par classe et des fils prof ↔ élève)      |

Les comptes, les classes et les devoirs ont été créés par l'API. Le journal et les messages ont été écrits directement en SQL. Le nombre de requêtes SQL est compté par une sonde chargée au démarrage de l'API de charge. Il inclut un peu de bruit, venu des tâches pg-boss.

## 2. Routes clés : avant et après

Chaque appel est fait seul, l'un après l'autre. On donne la médiane du temps de réponse et le nombre de requêtes SQL par appel.

| Route                                          | Avant : temps | Avant : requêtes | Après : temps | Après : requêtes |
| ---------------------------------------------- | ------------- | ---------------- | ------------- | ---------------- |
| carte de classe (30 élèves)                    | 87 ms         | 90               | 29 ms         | 19               |
| vue d'ensemble de l'école (30 classes)         | 1 367 ms      | 2 135            | 489 ms        | 132              |
| besoins de la banque (sans IA)                 | 1 369 ms      | 2 102            | 405 ms        | 72               |
| `/learner/next`                                | 29 ms         | 46               | 21 ms         | 30               |
| `/learner/path`                                | 20 ms         | 33               | 9 ms          | 15               |
| `/learner/profile`                             | 41 ms         | 144              | 16 ms         | 28               |
| `/learner/assignments`                         | 16 ms         | 22               | 5 ms          | 4                |
| `/parent/children` (2 enfants)                 | 22 ms         | 31               | 23 ms         | 21               |
| export RGPD (élève, ou parent pour son enfant) | 47 ms         | 151              | 34 ms         | 52               |
| banque de la semaine (lecture)                 | 6 ms          | 7                | 4 ms          | 4                |
| fils de messages (prof)                        | 11 ms         | 6                | 13 ms         | 6                |
| agrégats collectifs (calcul)                   | 369 ms        | 40               | 430 ms        | 40               |

Ce qui a changé :

- **Requêtes N+1.** La carte de classe, la vue d'ensemble et la banque lisaient le journal élève par élève : deux requêtes par élève, et le programme du pays relu pour chaque classe. Désormais, `learnerModels` et `EventStore.listByLearners` lisent les journaux d'une classe en une seule requête, et les programmes sont mis en cache pendant l'appel. La vue d'ensemble ne parcourt plus le journal de toute la plateforme : la dernière activité vient du journal déjà lu pour la carte. Le profil explicable et l'export ne relisent plus le programme pour chaque notion.
- **La session était vérifiée jusqu'à 6 fois par requête.** Plusieurs groupes de routes sont montés au même chemin (`/`, `/learner`, `/admin`), et chacun avait son garde de session. Chaque appel faisait donc jusqu'à 6 `UPDATE sessions` et 6 lectures des appartenances. Le garde ne s'exécute plus qu'une fois par requête.
- **Index (migration `0026_load_indexes.sql`).** Liens parent ↔ enfant par parent et par enfant ; essais, messages envoyés et journal d'audit par personne, pour l'export et la purge RGPD.

Limite qui reste : la vue d'ensemble d'une école de 900 élèves coûte environ 0,5 s de calcul, dont 0,2 s pour lire 35 000 lignes de journal et 0,13 s pour les valider. Pendant ce temps, l'API ne traite rien d'autre.

## 3. Charge concurrente

Le scénario : 80 % d'élèves, qui se connectent, ouvrent l'accueil (`next`, devoirs, notifications, `path`), répondent au devoir (services/math, 3 essais au plus), ouvrent les messages ou écrivent au prof. S'y ajoutent 10 % de profs (carte de classe, messages), 10 % de parents et une direction, qui ouvre la vue d'ensemble toutes les 10 s. Chaque utilisateur attend entre 0,75 et 2,25 s entre deux actions. La charge monte sur 10 s.

| Essai                                           | Requêtes par seconde | Erreurs                          | p50    | p95      | p99      |
| ----------------------------------------------- | -------------------- | -------------------------------- | ------ | -------- | -------- |
| 50 utilisateurs, 2 min (avant)                  | 56                   | 0                                | 26 ms  | 259 ms   | 1 538 ms |
| 200 utilisateurs, 2 min 30 (avant)              | 71                   | **347** (connexions abandonnées) | 292 ms | 3 459 ms | 30 s     |
| 200 utilisateurs (après toutes les corrections) | **217**              | 0                                | 23 ms  | 252 ms   | 1 344 ms |
| 100 utilisateurs, 5 min (endurance)             | 120                  | 0                                | 16 ms  | 142 ms   | 460 ms   |

**Ce qui cassait à 200 utilisateurs : la connexion.** Chaque mot de passe se vérifie par scrypt (N = 2¹⁷, environ 300 ms et 128 Mo par calcul), 4 calculs à la fois au plus. La file d'attente n'avait pas de limite : en rafale, l'attente dépassait les 30 s de patience du client, et le serveur continuait de calculer pour des clients déjà partis. Plus aucune connexion n'aboutissait. En plus, ces 4 calculs occupaient les 4 fils de libuv : la résolution de `localhost` (Postgres, services/math) attendait derrière eux, et toutes les routes ralentissaient. Corrections :

- au-delà de 32 calculs en attente, `/auth/login`, `/auth/learner` et `/auth/register` répondent tout de suite `503 server_busy`, avec `Retry-After: 2` ;
- `UV_THREADPOOL_SIZE=16` dans l'image Docker de l'API ;
- le pool Postgres passe de 10 à 20 connexions, réglable par `DATABASE_POOL_MAX`.

Avec toutes les corrections, 200 personnes se connectent dans les 10 s : la dernière connexion aboutit en 7,5 s au plus, après quelques réponses « réessayez ».

**Mémoire.** Après un ramasse-miettes forcé, le tas fait 47 Mo avant l'essai d'endurance de 5 min et 47 Mo après : aucune fuite constatée. La mémoire résidente monte jusqu'à 900 Mo pendant les rafales de connexion, à cause des tampons de scrypt (4 × 128 Mo). Elle redescend vers 220 Mo ensuite.

**Pool Postgres.** À 200 utilisateurs, jusqu'à 80 requêtes attendent une connexion libre au plus fort de la charge, sans erreur ni délai dépassé. Il n'y a eu aucun verrou mortel ni aucune transaction bloquée. Les essais simultanés sur une même variante sont déjà rangés l'un après l'autre par un verrou consultatif : aucune variante n'a dépassé 3 essais.

## 4. Robustesse

| Situation                                                        | Avant                                                                                                      | Après                                                                                                                                 |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Postgres coupe ses connexions (redémarrage, panne)               | **l'API s'arrête** : erreur `error` sans écouteur sur le pool `pg`                                         | l'erreur est notée, le pool rouvre des connexions, l'API continue                                                                     |
| Postgres injoignable 5 s, sous charge (50 utilisateurs)          | (l'API s'arrêtait)                                                                                         | 318 réponses en erreur pendant la coupure, aucune après ; désormais `503 service_unavailable` avec `Retry-After: 5`, au lieu de `500` |
| Une transaction perd sa connexion                                | le `ROLLBACK` échoue, masque l'erreur d'origine, et la connexion cassée retourne dans le pool              | l'erreur d'origine remonte et la connexion est écartée                                                                                |
| API tuée net (`kill -9`) sous charge, puis relancée              | erreurs seulement pendant les 8 s d'arrêt ; les sessions survivent                                         | idem ; journal intact (empreinte md5 identique), aucun doublon, aucun essai sans réponse au journal                                   |
| Arrêt normal (`docker stop`, mise à jour)                        | les requêtes en cours étaient coupées net                                                                  | les requêtes en cours finissent (8 s au plus)                                                                                         |
| services/math arrêté                                             | `503 math_unavailable` en 20 ms, sans essai consommé ; le devoir est créé sans variantes (« à compléter ») | inchangé, correct                                                                                                                     |
| services/math qui ne répond plus                                 | `503` au bout de 10 s ; les autres routes répondent normalement                                            | inchangé, correct                                                                                                                     |
| Un élève envoie 12 réponses lourdes en même temps (« 1e999999 ») | services/math est saturé (3 s par calcul, 4 calculs à la fois) : la réponse d'un autre élève attend 8,6 s  | une seule vérification à la fois par élève (`429 slow_down`) : l'autre élève reçoit sa réponse en 0,13 s                              |
| JSON malformé                                                    | `500 internal_error`                                                                                       | `400 invalid_json`                                                                                                                    |
| Caractère nul dans un texte                                      | `500` (Postgres refuse `\u0000`)                                                                           | `422 invalid_text`                                                                                                                    |

Les 46 entrées extrêmes testées, sur les routes publiques et élève, ne donnent plus aucune erreur 500 : textes de 10 000 caractères, mot de passe de 1 Mo, corps de 7 Mo, JSON imbriqué 5 000 fois, emoji, zalgo, caractères de droite à gauche, nombres de 200 chiffres, `1e999999`, `2**99999999`, `factorial(100000)`, division par zéro, `NaN`… Les réponses mathématiques illisibles ou trop lourdes donnent `422 unreadable_answer`, sans consommer d'essai.

## 5. Justesse des règles pédagogiques

Tests ajoutés dans les paquets du cœur : `learner-model/src/edge-cases.test.ts`, `orchestrator/src/next-actions.test.ts` et `exercises/src/edge-cases.test.ts`.

Vrais bugs trouvés et corrigés, chacun avec un test qui échouait avant la correction :

1. **La maîtrise restait figée à 1 (gravité haute).** Après 24 bonnes réponses sur une notion, le calcul en virgule flottante arrondit la maîtrise à exactement 1. Or, à 1, une erreur ne fait plus jamais baisser la maîtrise : la notion restait « Validée » pour toujours, quoi que fasse l'élève, et les re-tests espacés ratés ne la rouvraient pas. La maîtrise est désormais plafonnée à 0,9999 (`MASTERY_CEILING`) : 4 erreurs d'affilée la font repasser sous le seuil « Validé ». Un seuil « Validé » réglé au-dessus de ce plafond est refusé. Le profil étant recalculé depuis le journal, la correction s'applique aussi à l'historique.
2. **Notion vue seulement par une copie photographiée (gravité moyenne).** Une copie relue, avec une idée fausse peu sûre, créait une entrée « non vue » dans le profil. La prochaine action « commencer la notion » l'excluait alors, et aucune autre action ne la reprenait : la notion disparaissait des propositions. Le critère est maintenant « aucune réponse ».
3. **Ordre des réponses à la même milliseconde (gravité basse).** Pour repérer « 3 erreurs d'affilée » et calculer les re-tests, l'orchestrateur triait les réponses par date seule. Le profil, lui, les trie par date puis par identifiant. Selon l'ordre de fourniture du journal, deux élèves au même journal pouvaient donc recevoir des actions différentes. Le tri est désormais le même partout.

Vérifié sans bug : reconfirmation à 72 h pile (validée), à 72 h moins une minute (pas validée), ou à travers le changement d'heure (le délai se compte en heures réelles) ; mêmes instants écrits dans des fuseaux différents ; profil identique quel que soit l'ordre du journal, même avec des égalités ; une erreur qui retire la validation impose un nouveau délai de 72 h ; idées fausses actives ou inactives (l'IA peu sûre doit la voir deux fois ; la confiance de 0,85 pile suffit ; seules les bonnes réponses de la même notion la lèvent) ; devoir mis en tête à 3 jours pile de l'échéance ; re-tests espacés (un rappel trop tôt n'allonge pas l'intervalle, plafond de 60 jours) ; relances (rien sans activité connue, ni avant 2 jours pile) ; `planVariant` aux seuils exacts ; un candidat à la validation n'est jamais guidé par l'apprentissage collectif ; contrôle des nombres d'une reformulation (signes moins typographiques, emoji, très grands nombres, texte de 40 000 caractères, réponse négative qui fuit) ; plages de paramètres extrêmes ; choix des notions de la banque.

À trancher, sans être un bug : avec les paramètres BKT par défaut, après 15 bonnes réponses il faut 11 erreurs d'affilée pour repasser sous 0,95, et 4 au plafond. C'est le comportement normal de BKT, mais il est très confiant : à revoir avec les vraies données (`pSlip`).

## 6. Banc d'essai du prof IA (`evals/`)

Une seule exécution, avec la vraie IA (Claude Haiku 5.5 par OpenRouter). Elle n'utilise aucune base de données : elle écrit seulement un rapport dans `evals/reports/`.

**20 réponses parfaites sur 21, 0 échec bloquant**, 2 réponses rattrapées par le contrôle (confirmation, vérification orale, tour 2), 0 premier jet fautif sur 18. Le seul critère manqué n'est pas bloquant : « une seule question (deux au plus) », au tour 2 du scénario `indices`. Rapport : `evals/reports/2026-11-03T21-58-17-482Z.json`.

## 7. Capacité estimée d'un serveur

Une API (un processus Node) a tenu 217 requêtes par seconde, sans erreur, avec un p95 de 250 ms. Le serveur de mesure (un Mac partagé, Postgres dans Docker) est moins rapide qu'un serveur dédié. Un élève réel en séance fait plutôt une requête toutes les 5 à 10 s : une page ouverte, puis une réponse toutes les 30 à 60 s. On peut donc compter, pour le serveur conseillé (4 vCPU, 8 Go), sur **environ 1 000 élèves actifs en même temps**, avec de la marge. Les goulots, dans l'ordre :

1. **La connexion.** Environ 13 connexions par seconde par serveur, à cause de scrypt. Une classe de 30 élèves se connecte en 2 à 3 s ; 500 élèves qui se connectent à la même minute attendent jusqu'à 40 s, avec des réponses « réessayez ». Si cela devient gênant, on peut lancer plusieurs processus API, ou baisser le coût de scrypt pour les codes élève.
2. **Le profil recalculé depuis tout le journal, à chaque requête.** C'est un choix délibéré : le profil est une projection du journal. Le coût croît avec l'historique : ici 35 réponses par élève, peut-être 1 000 après une année. La vue d'ensemble d'une école de 900 élèves prend déjà 0,5 s. La suite logique : un instantané du profil, mis à jour à chaque nouvel événement, et dont la règle de calcul ne change pas.
3. **Postgres.** Encore 15 à 50 requêtes par page, qui pourraient être regroupées : droits d'accès par notion, notions du programme.

## 8. Limites connues, non corrigées

- **Essai sans réponse au journal.** Si le processus est tué net pendant l'analyse d'une mauvaise réponse par l'IA, l'essai est compté mais la réponse n'entre pas au journal. Il faut pour cela un plantage (`kill -9`), car l'arrêt normal attend désormais la fin des requêtes. Ce cas n'a pas été observé.
- **Contacts de la messagerie.** La requête lit toutes les classes de la plateforme. Un essai avec `NOT MATERIALIZED` s'est révélé plus lent à cette taille : 11 ms de planification, contre 4 ms d'exécution. À revoir au-delà d'environ 10 000 membres de classe.
- **Compteurs en mémoire.** Les compteurs d'échecs de connexion et le garde « une vérification à la fois » vivent dans un seul serveur. Les compteurs d'échecs ne se vident pas tant qu'une clé n'est pas réutilisée : une attaque par adresses au hasard les fait grossir lentement (13 essais par seconde au plus, à cause de scrypt).
- **Erreurs de validation.** Elles renvoient encore le détail brut de Zod (`{"success":false,"error":{"name":"ZodError",…}}`), pas le format `{"error":{"code"}}`.
- **Messages d'erreur côté web.** Les nouveaux codes (`server_busy`, `service_unavailable`, `slow_down`) sont traduits dans les messages du back-office. Côté élève, c'est le texte générique qui s'affiche.
- **Conditions de mesure.** Mesures sur un poste de développement, sans réseau entre les services, et sans IA réelle pendant la charge. Le prof IA, la BD et les relances rédigées n'ont pas été mesurés.
