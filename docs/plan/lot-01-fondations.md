# Lot 1 · Fondations du cœur : plan d'implémentation

> **Pour les agents qui exécutent ce plan :** sous-skill requis, superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans, pour avancer tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

**Objectif :** poser le vocabulaire du domaine, un référentiel validé (4 notions de maths du collège, France et Bénin), un journal d'événements en ajout seul dans Postgres, et un premier profil de l'élève (maîtrise par notion et idées fausses actives) recalculé à partir de ce journal.

**Architecture :**
- Les types purs vivent dans `@wema/domain`.
- `@wema/curriculum` charge et valide `content/curriculum/` (fichiers YAML).
- `@wema/db` stocke les `LearningEvent` dans une table protégée contre toute modification, par du SQL simple, sans ORM à ce stade.
- `@wema/learner-model` est une fonction pure qui projette la liste d'événements en `LearnerModel`, en estimant la maîtrise par Bayesian Knowledge Tracing (BKT).
- Un test de bout en bout dans `apps/api` assemble le tout.

**Pile :** TypeScript 7 en mode strict, Vitest, Zod (validation), `yaml`, PGlite (Postgres embarqué pour les tests).

**Spécification :** `docs/architecture.md` (§2.1 à 2.3, §3, §5) et `AGENTS.md`.

**Branche :** `lot-01-fondations`, avec une pull request vers `main` à la fin.

## Contraintes globales

- Tout ce qui est au produit est en français : textes, commentaires, messages de commit. Les identifiants sont en anglais, selon `docs/glossaire.md`.
- TypeScript strict, sans `any`. Pas de `as`, sauf dans les constructeurs de types marqués (`asNotionId`, etc.).
- Les erreurs attendues sont des valeurs `Result<T, E>`. Une exception signale un bug.
- Aucune matière ni aucun pays n'est écrit en dur dans le code. Ils viennent tous de `content/curriculum/`.
- Les seules dépendances internes autorisées sont celles de `docs/architecture.md` §5. Le script de la tâche 1 le contrôle.
- Aucune donnée personnelle réelle dans les tests : les identifiants sont des UUID inventés.
- Paramètres BKT par défaut : `pInit 0.2`, `pLearn 0.15`, `pSlip 0.1`, `pGuess 0.2`.
- Seuils de statut :
  - `in_progress` à partir de `pKnown ≥ 0.5` ;
  - candidat à la maîtrise à partir de `pKnown ≥ 0.95` ;
  - le statut `mastered` exige en plus une **reconfirmation**, c'est-à-dire une bonne réponse au moins **72 h** après le passage du seuil.
- Une idée fausse reste active tant que l'élève n'a pas donné **2 bonnes réponses** sur la notion depuis sa dernière apparition.
- Chaque tâche se termine par `pnpm lint`, `pnpm typecheck` et `pnpm test` au vert.

## Points de vigilance

1. **Événements dans le désordre.** Une copie papier peut être saisie le lendemain avec une date passée. La projection trie par `occurredAt`, puis par `id`. _(Test : tâche 5.)_
2. **Événements d'un autre élève mélangés.** La projection renvoie une erreur `mixed_learners` et ne calcule rien. _(Test : tâche 5.)_
3. **Référentiel incohérent.** Un prérequis inexistant, un cycle de prérequis, un identifiant en double ou un pays non déclaré doivent donner une erreur claire qui nomme la notion. Le référentiel n'est jamais chargé à moitié. _(Tests : tâches 3 et 4.)_
4. **Envoi en double d'un événement.** Le réseau ou un webhook peuvent renvoyer deux fois le même événement. Un second `append` du même `id` avec le même contenu ne crée pas de doublon. Le même `id` avec un contenu différent renvoie `id_conflict`. _(Test : tâche 6.)_
5. **Fausse maîtrise.** Trois bonnes réponses dans la même séance ne suffisent pas : sans reconfirmation 72 h plus tard, la notion reste `in_progress`. _(Test : tâche 5.)_

---

### Tâche 1 : outillage (tests, contrôle des dépendances, CI)

**Fichiers :**
- Modifier : `package.json` (racine), `turbo.json`, et chaque `packages/*/package.json` et `apps/*/package.json` (script `test`)
- Créer : `scripts/check-boundaries.ts`, `.github/workflows/ci.yml`

**Interfaces :**
- Produit : `pnpm test` (Vitest dans chaque paquet) et `pnpm check:boundaries`.

- [ ] **Étape 1 :** créer la branche : `git checkout -b lot-01-fondations`.
- [ ] **Étape 2 :** ajouter Vitest à la racine : `pnpm add -Dw vitest`. Dans chaque `package.json` d'espace de travail, ajouter le script `"test": "vitest run --passWithNoTests"`. Dans `turbo.json`, la tâche `test` ne dépend plus de `^build` : `"test": {}`.
- [ ] **Étape 3 :** écrire `scripts/check-boundaries.ts`.
  - Il lit chaque `packages/*/package.json` et compare les dépendances `@wema/*` (champs `dependencies` et `devDependencies`) à cette table :

    ```ts
    const ALLOWED: Record<string, readonly string[]> = {
      domain: [], ui: [],
      curriculum: ["domain"],
      "learner-model": ["domain", "curriculum"],
      "ai-gateway": ["domain"],
      db: ["domain"],
      exercises: ["domain", "curriculum", "learner-model", "ai-gateway"],
      tutor: ["domain", "curriculum", "learner-model", "exercises", "ai-gateway"],
      orchestrator: ["domain", "curriculum", "learner-model", "exercises", "tutor"],
    };
    ```

  - Un paquet de `packages/` absent de la table, ou une dépendance hors de la table, fait afficher `✗ @wema/<paquet> ne peut pas dépendre de @wema/<dep>`, puis le script sort avec le code 1. Sinon il affiche `✓ dépendances conformes`.
  - Les `apps/*` ne sont pas contrôlées.
  - Ajouter le script racine `"check:boundaries": "node scripts/check-boundaries.ts"`. Node 22 exécute directement le TypeScript ; si la version installée refuse, utiliser `node --experimental-strip-types`.
- [ ] **Étape 4 :** vérifier le contrôle.
  - Lancer `pnpm check:boundaries`. Attendu : `✓ dépendances conformes`.
  - Ajouter temporairement `"@wema/tutor": "workspace:*"` dans `packages/domain/package.json` et relancer. Attendu : `✗ @wema/domain ne peut pas dépendre de @wema/tutor` et une sortie en code 1.
  - Annuler la modification.
- [ ] **Étape 5 :** écrire `.github/workflows/ci.yml`.
  - Déclencheurs : `push` et `pull_request` sur `main`.
  - Étapes : `pnpm/action-setup@v4`, `actions/setup-node@v4` (Node 22, `cache: pnpm`), `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm check:boundaries`.
- [ ] **Étape 6 :** lancer `pnpm lint && pnpm typecheck && pnpm test`. Attendu : tout passe (aucun test pour l'instant).
- [ ] **Étape 7 :** commit `Outillage : Vitest, contrôle des dépendances entre paquets, CI`.

### Tâche 2 : vocabulaire du domaine (`@wema/domain`)

**Fichiers :**
- Créer : `packages/domain/src/ids.ts`, `result.ts`, `curriculum.ts`, `events.ts`, `status.ts`, `events.test.ts`
- Modifier : `packages/domain/src/index.ts` (réexporte tout), `packages/domain/package.json` (dépendance `zod`), `docs/glossaire.md`

**Interfaces (produites) :**

```ts
// ids.ts : types marqués. Un constructeur par type ; c'est le seul endroit où `as` est permis.
type Brand<T, B extends string> = T & { readonly __brand: B };
export type NotionId = Brand<string, "NotionId">;          // ex. "maths.pythagore"
export type SubjectId = Brand<string, "SubjectId">;        // ex. "maths"
export type CountryCode = Brand<string, "CountryCode">;    // ex. "fr", "bj"
export type MisconceptionId = Brand<string, "MisconceptionId">;
export type LearnerId = Brand<string, "LearnerId">;        // UUID
export type EventId = Brand<string, "EventId">;            // UUID
export const asNotionId: (s: string) => NotionId;          // idem pour chaque type

// result.ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
export const ok: <T>(value: T) => Result<T, never>;
export const err: <E>(error: E) => Result<never, E>;

// curriculum.ts
export interface Country { code: CountryCode; name: string }
export interface Subject { id: SubjectId; name: string }
export interface Misconception { id: MisconceptionId; description: string }
export interface CurriculumMapping { grade: string; chapter: number | null; verified: boolean }
export interface Notion {
  id: NotionId; subjectId: SubjectId; name: string; description: string;
  prerequisites: readonly NotionId[];
  misconceptions: readonly Misconception[];
  mappings: Readonly<Partial<Record<CountryCode, CurriculumMapping>>>;
}

// events.ts
export type EventSource = "app" | "web" | "messaging" | "paper" | "teacher";
export interface AnswerSubmitted {
  type: "answer.submitted"; notionId: NotionId; correct: boolean;
  hintsUsed: number;                        // entier ≥ 0
  misconceptionId: MisconceptionId | null;  // idée fausse repérée dans la réponse
  exerciseRef: string | null;
}
export type LearningEventPayload = AnswerSubmitted;  // union, s'agrandit aux lots suivants
export interface LearningEvent {
  id: EventId; learnerId: LearnerId; occurredAt: Date; source: EventSource;
  payload: LearningEventPayload;
}
export const parseLearningEvent: (input: unknown) => Result<LearningEvent, string>;
// schéma Zod : UUID pour id et learnerId ; occurredAt accepte un Date ou une chaîne ISO 8601

// status.ts
export type NotionStatus = "not_seen" | "needs_work" | "in_progress" | "mastered";
```

- [ ] **Étape 1 :** dans `packages/domain`, lancer `pnpm add zod`.
- [ ] **Étape 2 :** écrire `events.test.ts` avec 4 tests :
  - `parseLearningEvent` accepte un événement valide dont `occurredAt` est une chaîne `"2026-10-01T18:05:00Z"`, et renvoie un `Date` égal à `new Date("2026-10-01T18:05:00Z")` ;
  - il refuse `hintsUsed: -1` ;
  - il refuse un `learnerId` qui n'est pas un UUID ;
  - il refuse `payload.type: "inconnu"`.

  Chaque refus renvoie `ok: false`.
- [ ] **Étape 3 :** lancer `pnpm --filter @wema/domain test`. Attendu : échec, `parseLearningEvent` n'existe pas.
- [ ] **Étape 4 :** écrire les fichiers des interfaces ci-dessus et les réexporter depuis `index.ts`.
- [ ] **Étape 5 :** relancer le test. Attendu : 4 tests passent.
- [ ] **Étape 6 :** ajouter au glossaire ces lignes : `Non vue` = `not_seen`, `À travailler` = `needs_work`, `En cours` = `in_progress`, `Validé` = `mastered`, `Source d'un événement` = `EventSource`.
- [ ] **Étape 7 :** commit `Domaine : identifiants, Result, référentiel, événements, statuts`.

### Tâche 3 : construction et validation du référentiel (`@wema/curriculum`)

**Fichiers :**
- Créer : `packages/curriculum/src/schema.ts`, `build.ts`, `build.test.ts`
- Modifier : `packages/curriculum/src/index.ts`, `packages/curriculum/package.json` (dépendance `zod`)

**Interfaces :**
- Consomme : les types de `@wema/domain` (tâche 2).
- Produit :

```ts
export interface Curriculum {
  countries: readonly Country[];
  subjects: readonly Subject[];
  notions: readonly Notion[];
  getNotion(id: NotionId): Notion | undefined;
}
export type CurriculumError =
  | { kind: "parse"; file: string; message: string }
  | { kind: "duplicate_id"; id: string }
  | { kind: "unknown_subject"; notionId: NotionId; subjectId: string }
  | { kind: "unknown_prerequisite"; notionId: NotionId; prerequisiteId: string }
  | { kind: "prerequisite_cycle"; cycle: readonly NotionId[] }
  | { kind: "unknown_country"; notionId: NotionId; country: string }
  | {
      kind: "duplicate_misconception";
      notionId: NotionId;
      misconceptionId: string;
    };
export interface CurriculumInput {
  countries: unknown;
  subjects: unknown;
  notions: readonly unknown[];
}
export function buildCurriculum(
  input: CurriculumInput,
): Result<Curriculum, CurriculumError[]>;
```

`schema.ts` définit les schémas Zod des fichiers. Une notion a ce format :

```yaml
id: maths.pythagore
subject: maths
name: Théorème de Pythagore
description: …
prerequisites: [maths.carres-racines]
misconceptions: [{ id: mauvaise-hypotenuse, description: … }]
mappings: { fr: { grade: 4e, chapter: null, verified: false } }
```

Un élément invalide donne `{ kind: "parse", file: "<index ou id>", message }`. `buildCurriculum` **accumule toutes les erreurs** avant de répondre, et ne renvoie jamais un référentiel partiel.

- [ ] **Étape 1 :** écrire `build.test.ts`. Le jeu minimal valide contient 1 pays `fr`, 1 matière `maths` et 2 notions, A et B, où B a A pour prérequis. Tests :
  - jeu valide : `ok`, et `getNotion("maths.b")` renvoie un résultat dont `prerequisites` vaut `["maths.a"]` ;
  - prérequis `maths.zzz` inexistant : une erreur `unknown_prerequisite` avec `prerequisiteId: "maths.zzz"` ;
  - cycle A→B→A : une erreur `prerequisite_cycle` dont `cycle` contient `maths.a` et `maths.b` ;
  - deux notions avec le même `id` : une erreur `duplicate_id` ;
  - un `mappings.xx` sur un pays non déclaré : une erreur `unknown_country` avec `country: "xx"` ;
  - deux idées fausses avec le même `id` dans une notion : une erreur `duplicate_misconception` ;
  - deux défauts à la fois (prérequis inconnu et pays inconnu) : les **deux** erreurs sont renvoyées.
- [ ] **Étape 2 :** lancer `pnpm --filter @wema/curriculum test`. Attendu : échec.
- [ ] **Étape 3 :** implémenter `schema.ts` et `build.ts`. Pour les cycles, faire un parcours en profondeur avec trois couleurs (non visité, en cours, terminé) et reconstruire le cycle à partir de la pile.
- [ ] **Étape 4 :** relancer le test. Attendu : 7 tests passent.
- [ ] **Étape 5 :** commit `Référentiel : construction et validation (prérequis, cycles, pays, doublons)`.

### Tâche 4 : chargement des fichiers et premier contenu

**Fichiers :**
- Créer : `packages/curriculum/src/load.ts`, `load.test.ts`, `content/curriculum/countries.yaml`, `content/curriculum/subjects.yaml`, `content/curriculum/maths/calcul-litteral.yaml`, `equations-1er-degre.yaml`, `carres-racines.yaml`, `pythagore.yaml`
- Modifier : `packages/curriculum/package.json` (dépendance `yaml`), `content/README.md` (le format définitif remplace l'exemple indicatif)

**Interfaces :**
- Consomme : `buildCurriculum` (tâche 3).
- Produit : `loadCurriculum(rootDir: string): Promise<Result<Curriculum, CurriculumError[]>>`. Cette fonction lit `countries.yaml`, `subjects.yaml` et tous les `*/*.yaml` (une notion par fichier). Une erreur de syntaxe YAML devient `{ kind: "parse", file: <chemin relatif> }`.

**Contenu à écrire :**

| Fichier               | Prérequis                           | Idées fausses (`id` : description)                                                                                                                                                                                                                            |
| --------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `calcul-litteral`     | aucun                               | `additionne-termes-non-semblables` : écrit 2x + 3 = 5x · `confond-2x-et-x-carre` : confond 2x et x² · `distributivite-partielle` : k(a + b) = ka + b                                                                                                          |
| `equations-1er-degre` | `calcul-litteral`                   | `change-de-cote-change-de-signe` : déplace un terme en changeant son signe sans comprendre l'opération faite des deux côtés · `operation-un-seul-cote` : applique une opération à un seul membre · `soustrait-le-coefficient` : de 3x = 15, déduit x = 15 − 3 |
| `carres-racines`      | aucun                               | `racine-de-la-somme` : √(a + b) = √a + √b · `carre-egal-double` : x² = 2x                                                                                                                                                                                     |
| `pythagore`           | `carres-racines`, `calcul-litteral` | `mauvaise-hypotenuse` : prend un côté de l'angle droit pour l'hypoténuse · `oublie-racine-finale` : s'arrête à BC² = 100 · `triangle-non-rectangle` : applique le théorème sans angle droit                                                                   |

Pays : `fr` (France) et `bj` (Bénin). Matière : `maths` (Mathématiques).

Correspondances, toutes avec `verified: false` et `chapter: null` en attendant la validation par un enseignant de chaque pays :

| Notion                | France | Bénin |
| --------------------- | ------ | ----- |
| `calcul-litteral`     | 5e     | 5e    |
| `equations-1er-degre` | 4e     | 3e    |
| `carres-racines`      | 4e     | 4e    |
| `pythagore`           | 4e     | 4e    |

- [ ] **Étape 1 :** dans `packages/curriculum`, lancer `pnpm add yaml`.
- [ ] **Étape 2 :** écrire `load.test.ts` avec 2 tests :
  - **chargement réel** de `../../content/curriculum`, résolu depuis `import.meta.url` : `ok`, 4 notions, `getNotion("maths.pythagore")` a 2 prérequis et 3 idées fausses, et chaque notion a une correspondance `fr` et une `bj` ;
  - **YAML cassé** : un dossier temporaire (`fs.mkdtemp`) avec un fichier `maths/x.yaml` contenant `id: [` donne une erreur `parse` dont `file` vaut `maths/x.yaml`.
- [ ] **Étape 3 :** lancer le test. Attendu : échec.
- [ ] **Étape 4 :** écrire `load.ts` et les 6 fichiers YAML.
- [ ] **Étape 5 :** relancer le test. Attendu : 2 tests passent. Ce test valide désormais le contenu en CI à chaque modification de `content/`.
- [ ] **Étape 6 :** mettre à jour `content/README.md` : format définitif, règle « une notion par fichier », signification de `verified`.
- [ ] **Étape 7 :** commit `Référentiel : chargement YAML et 4 notions de maths (France, Bénin)`.

### Tâche 5 : profil de l'élève (`@wema/learner-model`)

**Fichiers :**
- Créer : `packages/learner-model/src/bkt.ts`, `bkt.test.ts`, `project.ts`, `project.test.ts`
- Modifier : `packages/learner-model/src/index.ts`, `docs/architecture.md` (§6 : le calcul de maîtrise est en TypeScript ; Python reste pour SymPy et, plus tard, l'ajustement des paramètres) et `docs/decisions/0001-socle-technique.md` (même précision)

**Interfaces :**
- Consomme : `LearningEvent`, `NotionStatus`, `Result`, et les identifiants de `@wema/domain`.
- Produit :

```ts
export interface BktParams { pInit: number; pLearn: number; pSlip: number; pGuess: number }
export const DEFAULT_BKT: BktParams;            // { pInit: 0.2, pLearn: 0.15, pSlip: 0.1, pGuess: 0.2 }
export function updateMastery(pKnown: number, correct: boolean, p: BktParams): number;

export interface MisconceptionState {
  misconceptionId: MisconceptionId; occurrences: number; lastSeenAt: Date;
  active: boolean; evidence: readonly EventId[];
}
export interface NotionState {
  notionId: NotionId; pKnown: number; observations: number; status: NotionStatus;
  masteryCandidateAt: Date | null; evidence: readonly EventId[];
  misconceptions: readonly MisconceptionState[];
}
export interface LearnerModel {
  learnerId: LearnerId; eventCount: number;
  notions: Readonly<Record<string, NotionState>>;   // clé : NotionId ; seules les notions observées
}
export type ProjectionError = { kind: "mixed_learners"; expected: LearnerId; found: LearnerId; eventId: EventId };
export function projectLearnerModel(
  learnerId: LearnerId, events: readonly LearningEvent[], params?: BktParams,
): Result<LearnerModel, ProjectionError>;
export function notionStatus(model: LearnerModel, id: NotionId): NotionStatus; // "not_seen" si absente
```

Formule de `updateMastery` (BKT classique) :

```
bonne réponse     : post = p·(1−s) / (p·(1−s) + (1−p)·g)
mauvaise réponse  : post = p·s / (p·s + (1−p)·(1−g))
ensuite           : p' = post + (1 − post)·t        (s = pSlip, g = pGuess, t = pLearn)
```

Règles de la projection :
1. Trier une copie des événements par `occurredAt`, puis par `id`.
2. Pour chaque `answer.submitted` : `pKnown` démarre à `pInit` pour une notion encore jamais vue, puis passe par `updateMastery`. L'`id` de l'événement est ajouté à `evidence`.
3. Quand `pKnown` atteint ou dépasse `0.95` et que `masteryCandidateAt` vaut `null`, on y met `occurredAt`. Quand `pKnown` repasse sous `0.95`, on remet `masteryCandidateAt` à `null` et la confirmation est perdue.
4. La notion est **confirmée** si une bonne réponse arrive au moins 72 h après `masteryCandidateAt`.
5. Statut : `mastered` si la notion est confirmée et que `pKnown ≥ 0.95` ; sinon `in_progress` si `pKnown ≥ 0.5` ; sinon `needs_work`.
6. Quand `misconceptionId` n'est pas `null`, `occurrences` augmente de 1, `lastSeenAt` prend la date de l'événement, et l'idée fausse redevient active. Elle passe `active: false` après 2 bonnes réponses sur la notion postérieures à `lastSeenAt`.

- [ ] **Étape 1 :** écrire `bkt.test.ts` avec les valeurs par défaut, en `toBeCloseTo(…, 6)` :
  - `updateMastery(0.2, true)` donne `0.6` ;
  - `updateMastery(0.2, false)` donne `0.175758` ;
  - `updateMastery(0.6, true)` donne `0.890323`.
- [ ] **Étape 2 :** écrire `project.test.ts`, avec des événements fabriqués par une petite fonction `answer(at, notionId, correct, misconceptionId?)` locale au test :
  - aucun événement : `eventCount 0`, `notions` vide, `notionStatus(m, "maths.pythagore")` vaut `"not_seen"` ;
  - 1 bonne réponse : `in_progress`, `pKnown` proche de `0.6` ; 1 mauvaise réponse : `needs_work` ;
  - **fausse maîtrise** : 3 bonnes réponses le 1er oct. à 18h00, 18h05 et 18h10 donnent `pKnown ≥ 0.95` et le statut `in_progress`. Une 4e bonne réponse le 4 oct. à 18h10 (72 h plus tard) donne `mastered`. Une 4e bonne réponse le 3 oct. à 18h09 donne toujours `in_progress` ;
  - **désordre** : les mêmes événements fournis en ordre inverse donnent un modèle identique (`toEqual`) ;
  - **autre élève** : un événement d'un autre `learnerId` donne `ok: false` et `error.kind === "mixed_learners"` ;
  - **idée fausse** : une mauvaise réponse avec `change-de-cote-change-de-signe` la rend active (`occurrences 1`) ; après 1 bonne réponse elle reste active ; après 2 elle passe `active: false` ; si elle réapparaît, `occurrences` vaut 2 et elle redevient active ;
  - **preuves** : `evidence` de la notion contient les `id` des événements dans l'ordre chronologique.
- [ ] **Étape 3 :** lancer `pnpm --filter @wema/learner-model test`. Attendu : échec.
- [ ] **Étape 4 :** implémenter `bkt.ts` et `project.ts`.
- [ ] **Étape 5 :** relancer le test. Attendu : tous les tests passent.
- [ ] **Étape 6 :** mettre à jour `docs/architecture.md` §6 et la fiche 0001 (voir « Fichiers »).
- [ ] **Étape 7 :** commit `Profil de l'élève : maîtrise BKT, reconfirmation à 72 h, idées fausses actives`.

### Tâche 6 : journal d'événements (`@wema/db`)

**Fichiers :**
- Créer : `packages/db/migrations/0001_learning_events.sql`, `packages/db/src/executor.ts`, `migrate.ts`, `event-store.ts`, `event-store.test.ts`
- Modifier : `packages/db/src/index.ts`, `packages/db/package.json` (`@electric-sql/pglite` en dépendance de développement)

**Interfaces :**
- Consomme : `LearningEvent`, `parseLearningEvent`, `Result` et les identifiants de `@wema/domain`.
- Produit :

```ts
export interface SqlExecutor {
  query<T>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<void>;
}
export function fromPglite(db: PGlite): SqlExecutor; // l'adaptateur Postgres de production viendra avec apps/api
export function migrate(db: SqlExecutor): Promise<void>; // applique migrations/*.sql dans l'ordre, une seule fois chacune
export type AppendError = { kind: "id_conflict"; id: EventId };
export interface EventStore {
  append(
    event: LearningEvent,
  ): Promise<Result<{ inserted: boolean }, AppendError>>;
  listByLearner(learnerId: LearnerId): Promise<LearningEvent[]>; // ordre : occurred_at, id
}
export function createEventStore(db: SqlExecutor): EventStore;
```

La migration `0001_learning_events.sql` :
- crée `schema_migrations(name text primary key, applied_at timestamptz not null default now())` ;
- crée `learning_events(id uuid primary key, learner_id uuid not null, occurred_at timestamptz not null, recorded_at timestamptz not null default now(), source text not null, type text not null, payload jsonb not null)` avec l'index `(learner_id, occurred_at)` ;
- installe un déclencheur `BEFORE UPDATE OR DELETE` qui lève l'exception `learning_events est en ajout seul`.

`append` insère avec `ON CONFLICT (id) DO NOTHING`. Si aucune ligne n'est insérée, on relit la ligne existante : si son contenu est identique (`learner_id`, `occurred_at`, `source`, `payload`), on renvoie `inserted: false`, sinon `id_conflict`. `listByLearner` passe chaque ligne par `parseLearningEvent` ; une ligne invalide est un bug et lève une exception.

- [ ] **Étape 1 :** dans `packages/db`, lancer `pnpm add -D @electric-sql/pglite`.
- [ ] **Étape 2 :** écrire `event-store.test.ts`. Chaque test démarre une base `new PGlite()` en mémoire et appelle `migrate`. Tests :
  - `append`, puis `listByLearner`, rend l'événement à l'identique (`toEqual`, `occurredAt` est un `Date`) ;
  - deux événements insérés dans le désordre reviennent triés par `occurredAt` ;
  - **doublon identique** : le second `append` renvoie `ok` avec `inserted: false`, et `listByLearner` ne contient qu'un événement ;
  - **même `id`, contenu différent** : `ok: false`, `error.kind === "id_conflict"` ;
  - **ajout seul** : `db.exec("UPDATE learning_events SET source = 'web'")` et `db.exec("DELETE FROM learning_events")` échouent tous deux avec un message contenant `ajout seul` ;
  - `migrate` appelé deux fois ne lève pas d'erreur et n'applique la migration qu'une fois (`schema_migrations` contient 1 ligne).
- [ ] **Étape 3 :** lancer `pnpm --filter @wema/db test`. Attendu : échec.
- [ ] **Étape 4 :** écrire la migration, `executor.ts`, `migrate.ts` (lit le dossier `migrations/` résolu depuis `import.meta.url`) et `event-store.ts`.
- [ ] **Étape 5 :** relancer le test. Attendu : 6 tests passent.
- [ ] **Étape 6 :** commit `Base : journal d'événements en ajout seul, idempotent, avec migrations`.

### Tâche 7 : test de bout en bout (`apps/api`)

**Fichiers :**
- Créer : `apps/api/src/core-loop.test.ts`
- Modifier : `apps/api/package.json` (`@electric-sql/pglite` en dépendance de développement)

**Interfaces :**
- Consomme : `loadCurriculum` (tâche 4), `migrate`, `createEventStore` et `fromPglite` (tâche 6), `projectLearnerModel` et `notionStatus` (tâche 5).
- Produit : aucune API, seulement la preuve que les briques s'assemblent.

- [ ] **Étape 1 :** écrire `core-loop.test.ts`, test « un élève progresse sur Pythagore et une idée fausse est suivie » :
  1. Charger le référentiel réel. Vérifier `ok`.
  2. Démarrer une base PGlite et appeler `migrate`.
  3. Ajouter, pour un même élève, des réponses sur `maths.pythagore` :
     - le 1er oct., une mauvaise réponse avec `oublie-racine-finale` (vérifier d'abord que cet identifiant fait partie des idées fausses de la notion dans le référentiel), puis 3 bonnes réponses ;
     - le 5 oct., une bonne réponse.
  4. Relire avec `listByLearner`, puis projeter.
  5. Attendu :
     - `notionStatus(m, "maths.pythagore")` vaut `"mastered"` ;
     - `oublie-racine-finale` a `occurrences 1` et `active: false` ;
     - `notionStatus(m, "maths.equations-1er-degre")` vaut `"not_seen"`.
- [ ] **Étape 2 :** lancer `pnpm --filter @wema/api test`. Attendu : le test passe. S'il échoue, le défaut est dans une tâche précédente : corriger là-bas, pas dans `apps/api`.
- [ ] **Étape 3 :** lancer la vérification complète : `pnpm lint && pnpm typecheck && pnpm test && pnpm check:boundaries`. Attendu : tout au vert.
- [ ] **Étape 4 :** commit `Test de bout en bout : référentiel, journal et profil assemblés`.
- [ ] **Étape 5 :** pousser la branche et ouvrir la pull request `Lot 1 · Fondations du cœur`. Description : ce qui est livré, les points de vigilance couverts, et le fait que les correspondances par pays sont à faire valider par un enseignant (`verified: false`).

---

## Hors périmètre (lots suivants)

Génération et vérification d'exercices (`services/math`), prof IA, orchestrateur, entretien initial, hypothèses de profil sur la façon d'apprendre, adaptateur Postgres de production, purge réglementaire du journal, applis web et mobile.
